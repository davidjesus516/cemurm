-- 0021 identity/account lifecycle — membership administration permission matrix
-- smoke (local dev only; fresh reset DB, single run, not idempotent).
--
-- Reverse migration ordering note: the smoke names do NOT track migration
-- numbers. This smoke covers `0021_identity_account_lifecycle.sql`, and is NOT
-- related to `scripts/smoke/0021-plan-freeze.sql`, which covers 0034.
--
-- Scope under test: the matrix `e3fbd00` introduced in
-- `private.change_member_role_core` and `private.remove_org_member_core` —
-- an `org_admin` (not only an `org_owner`) may change and remove
-- instructor/branch_admin/member members; neither may touch an `org_owner`;
-- and a caller with no membership at all is refused.
--
-- The removal assertions pin `status = 'former'`, not `'removed'`:
-- `member_status` is `enum('active','former','pending')` (0001:25), so
-- `'removed'` is not merely a different word, it is unrepresentable. `c8400b8`
-- had to revert exactly that, and this smoke is what would have caught it.
--
-- Run: supabase db reset, then
--   docker exec -i supabase_db_cemurm psql -U postgres -d postgres -X \
--     -v ON_ERROR_STOP=1 -f - < scripts/smoke/0021-identity-account-lifecycle.sql
-- Expects 16 PASS / 0 FAIL.
set client_min_messages to notice;

create or replace function tmp_assert(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok then raise notice '[PASS] %', p_name; else raise notice '[FAIL] %', p_name; end if;
end $$;

create or replace function tmp_expect_error(p_name text, p_sql text, p_like text) returns void language plpgsql as $$
declare err text := '';
begin
  begin
    execute p_sql;
  exception when others then
    err := sqlerrm;
  end;
  if err <> '' and err like p_like then raise notice '[PASS] %', p_name;
  else raise notice '[FAIL] % (got: %)', p_name, err; end if;
end $$;

-- ══════════════ FIXTURES (postgres) ══════════════
insert into organizations (id, name, org_type, status) values
  ('10000000-0000-0000-0000-0000000004a6', 'F1 Membership Academy', 'Academy', 'active')
  on conflict do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('60000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'f1.owner@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000601', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"F1","lastName":"Owner","displayName":"F1 Owner"}', now(), now()),
  ('60000000-0000-0000-0000-0000000006a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'f1.admin@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000602', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"F1","lastName":"Admin","displayName":"F1 Admin"}', now(), now()),
  ('60000000-0000-0000-0000-0000000006a3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'f1.member@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000603', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"F1","lastName":"Member","displayName":"F1 Member"}', now(), now()),
  ('60000000-0000-0000-0000-0000000006a4', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'f1.instructor@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000604', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"F1","lastName":"Instructor","displayName":"F1 Instructor"}', now(), now()),
  ('60000000-0000-0000-0000-0000000006a5', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'f1.branchadmin@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000605', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"F1","lastName":"BranchAdmin","displayName":"F1 BranchAdmin"}', now(), now()),
  ('60000000-0000-0000-0000-0000000006a6', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'f1.outsider@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000606', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"F1","lastName":"Outsider","displayName":"F1 Outsider"}', now(), now())
  on conflict do nothing;

-- 5a1 owner, 5a2 admin, 5a3 member, 5a4 instructor, 5a5 branch_admin.
-- 5a6 is deliberately NOT a member of this org: the rejection positive control.
insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('60000000-0000-0000-0000-0000000006a1', '10000000-0000-0000-0000-0000000004a6', null,
   'org_owner', 'active'),
  ('60000000-0000-0000-0000-0000000006a2', '10000000-0000-0000-0000-0000000004a6', null,
   'org_admin', 'active'),
  ('60000000-0000-0000-0000-0000000006a3', '10000000-0000-0000-0000-0000000004a6', null,
   'member', 'active'),
  ('60000000-0000-0000-0000-0000000006a4', '10000000-0000-0000-0000-0000000004a6', null,
   'instructor', 'active'),
  ('60000000-0000-0000-0000-0000000006a5', '10000000-0000-0000-0000-0000000004a6', null,
   'branch_admin', 'active')
  on conflict do nothing;

-- ══════════════ PRE (postgres) ══════════════
select set_config('role', 'postgres', false);
select tmp_assert('pre1 five memberships in 4a6 and the outsider has none',
  (select count(*) = 5 from public.org_memberships
    where org_id = '10000000-0000-0000-0000-0000000004a6' and status = 'active')
  and
  (select count(*) = 0 from public.org_memberships
    where user_id = '60000000-0000-0000-0000-0000000006a6'));

-- ══════════════ T1 an org_admin may change every non-owner role ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000006a2","role":"authenticated"}', false);
select public.change_member_role('10000000-0000-0000-0000-0000000004a6',
  '60000000-0000-0000-0000-0000000006a3', 'instructor');
select public.change_member_role('10000000-0000-0000-0000-0000000004a6',
  '60000000-0000-0000-0000-0000000006a4', 'branch_admin');
select public.change_member_role('10000000-0000-0000-0000-0000000004a6',
  '60000000-0000-0000-0000-0000000006a5', 'member');

select set_config('role', 'postgres', false);
select tmp_assert('1 org_admin re-roled member to instructor',
  (select role = 'instructor' from public.org_memberships
    where user_id = '60000000-0000-0000-0000-0000000006a3'
      and org_id = '10000000-0000-0000-0000-0000000004a6'));
select tmp_assert('2 org_admin re-roled instructor to branch_admin',
  (select role = 'branch_admin' from public.org_memberships
    where user_id = '60000000-0000-0000-0000-0000000006a4'
      and org_id = '10000000-0000-0000-0000-0000000004a6'));
select tmp_assert('3 org_admin re-roled branch_admin to member',
  (select role = 'member' from public.org_memberships
    where user_id = '60000000-0000-0000-0000-0000000006a5'
      and org_id = '10000000-0000-0000-0000-0000000004a6'));

-- ══════════════ T2 nobody but another org_owner may touch an org_owner ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000006a2","role":"authenticated"}', false);
select tmp_expect_error('4 org_admin cannot change the owner role',
  $q$select public.change_member_role('10000000-0000-0000-0000-0000000004a6',
    '60000000-0000-0000-0000-0000000006a1', 'member')$q$,
  'cannot modify org_owner');

select set_config('role', 'postgres', false);
select tmp_assert('5 the owner still holds org_owner, active',
  (select role = 'org_owner' and status = 'active' from public.org_memberships
    where user_id = '60000000-0000-0000-0000-0000000006a1'
      and org_id = '10000000-0000-0000-0000-0000000004a6'));

-- ══════════════ T3 an org_admin may remove every non-owner role ══════════════
-- Roles at this point: 5a3 instructor, 5a4 branch_admin, 5a5 member.
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000006a2","role":"authenticated"}', false);
select public.remove_org_member('10000000-0000-0000-0000-0000000004a6',
  '60000000-0000-0000-0000-0000000006a3');
select public.remove_org_member('10000000-0000-0000-0000-0000000004a6',
  '60000000-0000-0000-0000-0000000006a4');
select public.remove_org_member('10000000-0000-0000-0000-0000000004a6',
  '60000000-0000-0000-0000-0000000006a5');

select set_config('role', 'postgres', false);
select tmp_assert('6 removed instructor is status former with left_at set',
  (select status = 'former' and left_at is not null from public.org_memberships
    where user_id = '60000000-0000-0000-0000-0000000006a3'
      and org_id = '10000000-0000-0000-0000-0000000004a6'));
select tmp_assert('7 removed branch_admin is status former with left_at set',
  (select status = 'former' and left_at is not null from public.org_memberships
    where user_id = '60000000-0000-0000-0000-0000000006a4'
      and org_id = '10000000-0000-0000-0000-0000000004a6'));
select tmp_assert('8 removed member is status former with left_at set',
  (select status = 'former' and left_at is not null from public.org_memberships
    where user_id = '60000000-0000-0000-0000-0000000006a5'
      and org_id = '10000000-0000-0000-0000-0000000004a6'));

-- ══════════════ T4 nobody but another org_owner may remove an org_owner ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000006a2","role":"authenticated"}', false);
select tmp_expect_error('9 org_admin cannot remove the owner',
  $q$select public.remove_org_member('10000000-0000-0000-0000-0000000004a6',
    '60000000-0000-0000-0000-0000000006a1')$q$,
  'cannot remove org_owner');

select set_config('role', 'postgres', false);
select tmp_assert('10 the owner is still active',
  (select status = 'active' from public.org_memberships
    where user_id = '60000000-0000-0000-0000-0000000006a1'
      and org_id = '10000000-0000-0000-0000-0000000004a6'));

-- ══════════════ T5 a caller with no membership in the org is refused ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000006a6","role":"authenticated"}', false);
select tmp_expect_error('11 non-member cannot change a role',
  $q$select public.change_member_role('10000000-0000-0000-0000-0000000004a6',
    '60000000-0000-0000-0000-0000000006a2', 'member')$q$,
  'not authorized');
select tmp_expect_error('12 non-member cannot remove a member',
  $q$select public.remove_org_member('10000000-0000-0000-0000-0000000004a6',
    '60000000-0000-0000-0000-0000000006a2')$q$,
  'not authorized');

-- ══════════════ T6 the audit trail records the six successes and no refusal ══════════════
select set_config('role', 'postgres', false);
select tmp_assert('13 six audit rows: three changes, three removals',
  (select count(*) = 3 from public.admin_audit_log
    where action = 'change_member_role'
      and actor_id = '60000000-0000-0000-0000-0000000006a2')
  and
  (select count(*) = 3 from public.admin_audit_log
    where action = 'remove_org_member'
      and actor_id = '60000000-0000-0000-0000-0000000006a2'));
select tmp_assert('14 no audit row was written by the refused outsider',
  (select count(*) = 0 from public.admin_audit_log
    where actor_id = '60000000-0000-0000-0000-0000000006a6'));

select tmp_assert('15 total audit rows for this org = 6, so the two refusals wrote nothing',
  (select count(*) = 6 from public.admin_audit_log
    where detail->>'org_id' = '10000000-0000-0000-0000-0000000004a6'));
