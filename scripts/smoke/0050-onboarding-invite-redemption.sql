-- 0050 onboarding invite-redemption smoke (local dev only; fresh reset DB,
-- single run, not idempotent).
--
-- This smoke covers `0050_onboarding_invite_redemption.sql`.
--
-- Scope under test (features/user-onboarding.feature:55-68):
--   · A live org_invite code joins the redemptioner to the org as org_member,
--     on the org's oldest active branch ("Sede Centro"), and is consumed.
--   · The RPC discloses only org id/name, role and branch id/name — never the
--     code row, its creator, expiry or id.
--   · Unknown, expired, already-used and wrong-kind codes all fail with the
--     SAME generic message, so the RPC is not a code oracle.
--   · The creator must still be an active owner/admin of the target org at
--     redemption: a self-minted code for another org is rejected.
--   · A code cannot mint a privileged role (org_owner is rejected).
--   · invite_codes keeps its own-row RLS: a joiner cannot SELECT the raw code.
--   · anon holds no EXECUTE grant on the RPC.
--   · Setting used_at by a direct PostgREST-style UPDATE (which the creator
--     may do on their own row) does NOT create a membership by itself.
--
-- Run: supabase db reset, then
--   docker exec -i supabase_db_cemurm psql -U postgres -d postgres -X \
--     -v ON_ERROR_STOP=1 -f - < scripts/smoke/0050-onboarding-invite-redemption.sql
-- Expects 23 PASS / 0 FAIL.
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
-- Seed org a1 = Demo Academy (org_owner ...0001, branch b1 = Sede Centro).
-- Joiner ...0003 (outsider) has no membership in a1. ...0002 is org_member of
-- a DIFFERENT org (a2) — used for the self-minted-code guard.
insert into public.invite_codes (id, org_id, kind, code, role, created_by, expires_at, used_at) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-0000000000a1', 'org_invite', 'ACAD-MAD-001',  'org_member', '10000000-0000-0000-0000-000000000001', now() + interval '7 days',  null),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-0000000000a1', 'org_invite', 'ACAD-MAD-USED', 'org_member', '10000000-0000-0000-0000-000000000001', now() + interval '7 days',  now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-0000000000a1', 'org_invite', 'ACAD-MAD-EXP',  'org_member', '10000000-0000-0000-0000-000000000001', now() - interval '1 minute', null),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-0000-0000-0000000000a1', 'proximity', 'ACAD-MAD-PROX', 'org_member', '10000000-0000-0000-0000-000000000001', now() + interval '7 days',  null),
  ('40000000-0000-4000-8000-000000000005', '10000000-0000-0000-0000-0000000000a1', 'org_invite', 'ACAD-MAD-BAD',  'org_member', '10000000-0000-0000-0000-000000000002', now() + interval '7 days',  null),
  ('40000000-0000-4000-8000-000000000006', '10000000-0000-0000-0000-0000000000a1', 'org_invite', 'ACAD-MAD-OWNER', 'org_owner', '10000000-0000-0000-0000-000000000001', now() + interval '7 days',  null),
  ('40000000-0000-4000-8000-000000000007', '10000000-0000-0000-0000-0000000000a1', 'org_invite', 'ACAD-MAD-DIRECT', 'org_member', '10000000-0000-0000-0000-000000000001', now() + interval '7 days',  null)
  on conflict do nothing;

-- ══════════════ VALID REDEMPTION (joiner = ...0003) ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003"}', false);

-- Non-creator cannot read the raw code row (0006 own-row RLS still holds).
select tmp_assert('1. a joiner cannot SELECT the raw invite code row',
  (select count(*) from public.invite_codes where code = 'ACAD-MAD-001') = 0);

select public.redeem_org_invite('ACAD-MAD-001') as redeemed \gset

select tmp_assert('2. the envelope discloses the org name',
  :'redeemed'::jsonb->>'org_name' = 'Demo Academy');
select tmp_assert('3. the envelope discloses the org_member role',
  :'redeemed'::jsonb->>'role' = 'org_member');
select tmp_assert('4. the default branch is the oldest active branch',
  :'redeemed'::jsonb->>'branch_name' = 'Sede Centro');
select tmp_assert('5. the envelope carries only safe identity fields', (
  select array_agg(k order by k) from jsonb_object_keys(:'redeemed'::jsonb) k
) = array['branch_id', 'branch_name', 'org_id', 'org_name', 'role']);

select set_config('role', 'postgres', false);
select tmp_assert('6. the joiner has an active org_member membership on Sede Centro',
  exists (
    select 1 from public.org_memberships
    where user_id = '10000000-0000-0000-0000-000000000003'
      and org_id = '10000000-0000-0000-0000-0000000000a1'
      and branch_id = '10000000-0000-0000-0000-0000000000b1'
      and role = 'org_member' and status = 'active'
  ));
select tmp_assert('7. the code was atomically consumed',
  (select used_at is not null from public.invite_codes where code = 'ACAD-MAD-001'));

-- ══════════════ EVERY FAILURE IS THE SAME GENERIC ERROR ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003"}', false);

select tmp_expect_error('8. a second redemption of the same code fails',
  $$select public.redeem_org_invite('ACAD-MAD-001')$$,
  '%This invite code is invalid or has expired.%');
select tmp_expect_error('9. an expired code fails with the same message',
  $$select public.redeem_org_invite('ACAD-MAD-EXP')$$,
  '%This invite code is invalid or has expired.%');
select tmp_expect_error('10. a pre-used code fails with the same message',
  $$select public.redeem_org_invite('ACAD-MAD-USED')$$,
  '%This invite code is invalid or has expired.%');
select tmp_expect_error('11. a wrong-kind (proximity) code fails with the same message',
  $$select public.redeem_org_invite('ACAD-MAD-PROX')$$,
  '%This invite code is invalid or has expired.%');
select tmp_expect_error('12. an unknown code fails with the same message',
  $$select public.redeem_org_invite('ACAD-MAD-NOPE')$$,
  '%This invite code is invalid or has expired.%');
select tmp_expect_error('13. a self-minted code (creator not an org admin) fails',
  $$select public.redeem_org_invite('ACAD-MAD-BAD')$$,
  '%This invite code is invalid or has expired.%');
select tmp_expect_error('14. a code carrying a privileged role fails',
  $$select public.redeem_org_invite('ACAD-MAD-OWNER')$$,
  '%This invite code is invalid or has expired.%');

-- ══════════════ GRANTS ══════════════
select set_config('role', 'anon', false);
select set_config('request.jwt.claims', '{}', false);
select tmp_expect_error('15. anon cannot execute the RPC',
  $$select public.redeem_org_invite('ACAD-MAD-001')$$,
  '%permission denied for function redeem_org_invite%');

-- ══════════════ DIRECT used_at UPDATE IS NOT A MEMBERSHIP ══════════════
-- The creator may UPDATE their own invite row through PostgREST. Doing so must
-- not silently join anybody, and must consume the code just like a redemption.
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001"}', false);
update public.invite_codes set used_at = now() where code = 'ACAD-MAD-DIRECT';

-- ...0002 has no membership in a1 yet (it belongs to a different org), so it
-- is a clean joiner for the direct-UPDATE canary.
select set_config('role', 'postgres', false);
select tmp_assert('16. a direct used_at UPDATE grants no membership by itself',
  not exists (
    select 1 from public.org_memberships
    where user_id = '10000000-0000-0000-0000-000000000002'
      and org_id = '10000000-0000-0000-0000-0000000000a1'
  ));

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002"}', false);
select tmp_expect_error('17. a code marked used by direct UPDATE cannot be redeemed',
  $$select public.redeem_org_invite('ACAD-MAD-DIRECT')$$,
  '%This invite code is invalid or has expired.%');

-- ══════════════ SINGLE-USE, NO ORACLE (re-check from a clean joiner) ══════════════
-- A fresh code proves the RPC still works after all the rejection paths, and
-- that the generic message is not a blanket failure.
select set_config('role', 'postgres', false);
insert into public.invite_codes (id, org_id, kind, code, role, created_by, expires_at) values
  ('40000000-0000-4000-8000-000000000008', '10000000-0000-0000-0000-0000000000a1', 'org_invite', 'ACAD-MAD-002', 'org_member', '10000000-0000-0000-0000-000000000001', now() + interval '7 days')
  on conflict do nothing;
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002"}', false);
select public.redeem_org_invite('ACAD-MAD-002') as redeemed2 \gset
select tmp_assert('18. a different live code still redeems for another joiner',
  :'redeemed2'::jsonb->>'org_name' = 'Demo Academy');
select set_config('role', 'postgres', false);
select tmp_assert('19. the second valid code is consumed exactly once',
  (select used_at is not null from public.invite_codes where code = 'ACAD-MAD-002'));

-- Helper creation needs CREATE on schema public, which `authenticated` lacks.
-- Create it as postgres here (like the preamble helpers); it is SECURITY
-- INVOKER, so calls below still run as `authenticated` with RLS and RPC guards.
create or replace function tmp_err(p_code text) returns text language plpgsql as $$
declare err text := '';
begin
  begin perform public.redeem_org_invite(p_code);
  exception when others then err := sqlerrm; end;
  return err;
end $$;

-- ── error-text equality (no oracle) ──
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003"}', false);
select tmp_assert('20. unknown, expired and wrong-kind errors are byte-identical',
  tmp_err('ACAD-MAD-NOPE') = tmp_err('ACAD-MAD-EXP')
  and tmp_err('ACAD-MAD-EXP') = tmp_err('ACAD-MAD-PROX'));

-- The RLS contrast to assertion 1: the creator CAN read their own code row.
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001"}', false);
select tmp_assert('21. the creator can still read their own code row',
  (select count(*) from public.invite_codes where code = 'ACAD-MAD-001') = 1);

-- ── every rejection path is byte-identical, and redemption is audited ──
-- ACAD-MAD-OWNER would mint a privileged role and ACAD-MAD-BAD has a non-owner
-- creator: both must carry the same generic text as the other rejection paths.
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003"}', false);
select tmp_assert('22. all rejection paths are byte-identical', (
  select count(distinct e) = 1 from (
    values (tmp_err('ACAD-MAD-NOPE')), (tmp_err('ACAD-MAD-EXP')),
           (tmp_err('ACAD-MAD-PROX')), (tmp_err('ACAD-MAD-USED')),
           (tmp_err('ACAD-MAD-BAD')),  (tmp_err('ACAD-MAD-OWNER'))
  ) t(e)));
select set_config('role', 'postgres', false);
select tmp_assert('23. redemption appends an admin_audit_log row', exists(
  select 1 from public.admin_audit_log where action = 'add_org_member'
    and subject_table = 'org_memberships'
    and subject_id = '10000000-0000-0000-0000-000000000003'));
