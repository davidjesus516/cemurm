-- 0038 offboarding cascade smoke — slice 1 of 3: THE NEW BEHAVIOUR
-- (local dev only; fresh reset DB, single run).
--
-- Requirement source: features/offboarding-cascade.feature
--   :43-47 Pending substitution requests are auto-cancelled
--   :48-52 A former member cannot be re-assigned
--
-- Slice 1 proves the cascade runs and the assignment guard holds. Slice 2 appends
-- the blast-radius half to this same file — what did NOT change (nothing deleted,
-- another member's request and its frozen candidates survive, the former member is
-- locked out, an active member is still assignable, a leaving leader is not told
-- about herself) — plus the master-plan correction and the ODD record. Assertions
-- are numbered 1..N so that slice 2 only APPENDS and never renumbers.
--
-- Reuses the seed tenancy: org 10000000-…-a1 (Demo Academy) + branch …-b1. Fixtures
-- use the 80000000-… family (unused by the seed and by the 0023/0026/0028/0037
-- smokes) with FIXED user literals — gen_random_uuid would not cross role switches.
-- Sofia must be display_name 'Sofia': the title asserted below is the Gherkin literal.
--
-- Assertions that read contract tables directly run under role postgres
-- (deny-by-default surface; the RPCs are the client contract). Role switches use
-- `select set_config(...)` (bare calls are not valid top-level statements); RPC
-- returns are captured with `\gset` so each call runs once.
-- expects 11 PASS / 0 FAIL
set client_min_messages to notice;

create or replace function tmp_assert(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok then raise notice '[PASS] %', p_name;
  else raise notice '[FAIL] %', p_name; end if;
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
-- Only the two people slice 1 needs: the leader who gets told, and the member who
-- leaves. Slice 2 adds the other members it needs for its regression assertions.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'nadia.offboard@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000041', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Nadia","lastName":"Leader","displayName":"Nadia Leader"}', now(), now()),
  ('80000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sofia.offboard@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000042', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Sofia","lastName":"Bass","displayName":"Sofia"}', now(), now())
  on conflict do nothing;

update profiles set username = 'nadiaoff', display_name = 'Nadia Leader', instrument = 'keys'
  where id = '80000000-0000-0000-0000-000000000001';
update profiles set username = 'sofiaoff', display_name = 'Sofia', instrument = 'bass'
  where id = '80000000-0000-0000-0000-0000000000a1';

insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active'),
  ('80000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active')
  on conflict do nothing;

insert into public.services (org_id, branch_id, name, status, leader_id, starts_at)
values ('10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000b1',
        'Sunday 10am', 'published', '80000000-0000-0000-0000-000000000001',
        now() + interval '3 days')
returning id \gset svc_

insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'svc_id', 'Worship', 1, 20, null, 0)
returning id \gset blk1_

-- Sofia is the leaver whose part the plan must stop advertising as covered.
insert into public.service_assignments (service_id, block_id, user_id, part)
values (:'svc_id', :'blk1_id', '80000000-0000-0000-0000-0000000000a1', 'bass')
returning id \gset sofia_asg_

-- ══════════════ 1. CONTRACT (role postgres) ══════════════
\echo '--- 1. contract (role postgres) ---'
select set_config('role', 'postgres', false);

select tmp_assert(
  '1 0038 replaced both cores with their original signatures',
  (select count(*) = 2 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and ((p.proname = 'org_leave'
            and pg_get_function_identity_arguments(p.oid) = 'p_org_id uuid')
        or (p.proname = 'assign_musician'
            and pg_get_function_identity_arguments(p.oid)
                = 'p_service_id uuid, p_block_id uuid, p_user_id uuid, p_part text')))
);

select tmp_assert(
  '2 authenticated still holds execute on the public wrappers',
  has_function_privilege('authenticated', 'public.leave_organization(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.assign_musician(uuid, uuid, uuid, text)', 'execute')
);

-- ══════════════ 2. anon deny ══════════════
\echo '--- 2. anon deny ---'
select set_config('role', 'anon', false);
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tmp_expect_error('3 anon cannot leave an organization',
  format('select public.leave_organization(%L)', '10000000-0000-0000-0000-0000000000a1'),
  'permission denied%');
select tmp_expect_error('4 anon cannot assign a musician',
  format('select public.assign_musician(%L, %L, %L, %L)', :'svc_id', :'blk1_id',
         '80000000-0000-0000-0000-0000000000a1', 'bass'),
  'permission denied%');

-- ══════════════ 3. Sofia marks herself unavailable ══════════════
\echo '--- 3. sofia marks herself unavailable ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select public.mark_unavailable(:'sofia_asg_id') as id \gset req_sofia_

select tmp_assert('5 sofia can read her org services before leaving',
  (select count(*) > 0 from public.services
    where org_id = '10000000-0000-0000-0000-0000000000a1'));

select set_config('role', 'postgres', false);
select tmp_assert('6 sofia''s request is open on the bass part of Sunday 10am',
  (select sr.status = 'open' and sr.resolved_at is null
          and sa.part = 'bass' and s.name = 'Sunday 10am'
     from public.substitution_requests sr
     join public.service_assignments sa on sa.id = sr.assignment_id
     join public.services s on s.id = sa.service_id
    where sr.id = :'req_sofia_id'));

-- ══════════════ 4. Sofia leaves — the cascade ══════════════
\echo '--- 4. sofia leaves the org ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select public.leave_organization('10000000-0000-0000-0000-0000000000a1');

select set_config('role', 'postgres', false);
select tmp_assert('7 membership is former with left_at set',
  (select status = 'former' and left_at is not null
     from public.org_memberships
    where user_id = '80000000-0000-0000-0000-0000000000a1'
      and org_id = '10000000-0000-0000-0000-0000000000a1'));
select tmp_assert('8 the leaver''s open request is closed (the model''s word for cancelled)',
  (select status = 'closed' and resolved_at is not null
     from public.substitution_requests where id = :'req_sofia_id'));
select tmp_assert('9 the cascade is logged as action=substitution kind=member_left',
  (select count(*) = 1 from public.service_change_log
    where action = 'substitution'
      and detail ->> 'kind' = 'member_left'
      and detail ->> 'request_id' = :'req_sofia_id'
      and service_id = :'svc_id'
      and actor_id = '80000000-0000-0000-0000-0000000000a1'));
select tmp_assert('10 the leader is notified with the exact Gherkin title',
  (select count(*) = 1 from public.notifications n
    where n.user_id = '80000000-0000-0000-0000-000000000001'
      and n.title = 'Sofia left — bass part uncovered'
      and n.payload ->> 'request_id' = :'req_sofia_id'));

-- ══════════════ 5. the assignment guard ══════════════
\echo '--- 5. assignment guard ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select tmp_expect_error('11 the leader cannot assign the former member',
  format('select public.assign_musician(%L, %L, %L, %L)', :'svc_id', :'blk1_id',
         '80000000-0000-0000-0000-0000000000a1', 'bass'),
  'Sofia is no longer a member%');

\echo
\echo 'If the expected count is 11 and you see 11 [PASS] lines with 0 [FAIL], the new behaviour holds.'
\echo 'This script is NOT idempotent: it commits its writes. Reset before a second run.'
reset role;
