-- 0051 onboarding org-creation smoke (local dev only; fresh reset DB,
-- single run, not idempotent).
--
-- This smoke covers `0051_onboarding_org_creation.sql`.
--
-- Scope under test (features/user-onboarding.feature:45-53, 70-75):
--   · create_organization inserts the org, its primary branch and the caller's
--     active org_owner membership, and emits an admin_audit_log row.
--   · add_org_branch is guarded by private.session_role_in: an active
--     owner/admin of that org may add a branch; an outsider may not.
--   · both RPCs reject blank/oversized input with one generic message.
--   · anon holds no EXECUTE grant on either RPC.
--
-- Run: supabase db reset, then
--   docker exec -i supabase_db_cemurm psql -U postgres -d postgres -X \
--     -v ON_ERROR_STOP=1 -f - < scripts/smoke/0051-onboarding-org-creation.sql
-- Expects 11 PASS / 0 FAIL.
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

-- ══════════════ CREATE ORG (joiner ...0003 has no membership) ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003"}', false);
select public.create_organization('Academia Nueva', 'Academy', 'Sede Centro', 'Madrid') as created \gset

select tmp_assert('1. create_organization returns the owner envelope',
  :'created'::jsonb->>'role' = 'org_owner'
  and :'created'::jsonb->>'org_name' = 'Academia Nueva'
  and :'created'::jsonb->>'branch_name' = 'Sede Centro');

select set_config('role', 'postgres', false);
select tmp_assert('2. the organization row exists', exists(
  select 1 from public.organizations where name = 'Academia Nueva' and org_type = 'Academy'));
select tmp_assert('3. the primary branch exists on that org', exists(
  select 1 from public.branches b join public.organizations o on o.id = b.org_id
  where o.name = 'Academia Nueva' and b.name = 'Sede Centro' and b.city = 'Madrid'));
select tmp_assert('4. the creator is the active org_owner on the primary branch', exists(
  select 1 from public.org_memberships m join public.organizations o on o.id = m.org_id
  where o.name = 'Academia Nueva' and m.user_id = '10000000-0000-0000-0000-000000000003'
    and m.role = 'org_owner' and m.status = 'active'));
select tmp_assert('5. org creation is audited', exists(
  select 1 from public.admin_audit_log where action = 'create_organization'
    and subject_table = 'organizations' and actor_id = '10000000-0000-0000-0000-000000000003'));

-- ══════════════ ADD BRANCH: OWNER YES, OUTSIDER NO ══════════════
-- ...0002 is a member of a DIFFERENT org, not of Academia Nueva.
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002"}', false);
select tmp_expect_error('6. an outsider cannot add a branch',
  $q$select public.add_org_branch(:'created'::jsonb->>'org_id', 'Sede Lima', 'Lima')$q$,
  '%Branch details are invalid.%');

select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003"}', false);
select public.add_org_branch(:'created'::jsonb->>'org_id', 'Sede Lima', 'Lima') as added \gset
select tmp_assert('7. the owner can add a branch',
  :'added'::jsonb->>'branch_name' = 'Sede Lima');
select set_config('role', 'postgres', false);
select tmp_assert('8. the new branch exists and is audited', exists(
  select 1 from public.branches b join public.organizations o on o.id = b.org_id
  where o.name = 'Academia Nueva' and b.name = 'Sede Lima'
    and exists (select 1 from public.admin_audit_log
                where action = 'add_org_branch' and subject_id = b.id)));

-- ══════════════ GENERIC ERRORS + GRANTS ══════════════
select set_config('role', 'authenticated', false);
select tmp_expect_error('9. blank org details are rejected',
  $q$select public.create_organization('   ', 'Academy', 'Sede X', '')$q$,
  '%Organization details are invalid.%');
select tmp_expect_error('10. oversized branch name is rejected',
  $q$select public.add_org_branch(:'created'::jsonb->>'org_id', repeat('x', 201), 'Lima')$q$,
  '%Branch details are invalid.%');
select set_config('role', 'postgres', false);
select tmp_assert('11. anon has no EXECUTE grant on either RPC',
  not exists (
    select 1 from information_schema.role_routine_grants
    where grantee = 'anon' and routine_name in ('create_organization', 'add_org_branch')));
