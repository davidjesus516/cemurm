-- 0041 gig shared-to-branch read smoke — the visibility scenario and its offboarding half.
-- (local dev only; fresh reset DB, single run.)
--
-- Requirement source:
--   features/gigs-and-performance-history.feature:128-135
--     Lucia creates the gig (private to her by default) and shares it to "Sede Madrid";
--     Juan, member of Sede Madrid, can open the gig and, once completed, its performance
--     record; Pedro, member of Sede Lima, cannot open the gig.
--   features/offboarding-cascade.feature:33-37
--     the owner keeps the gig and its performance record after leaving, and the remaining
--     org members keep read-only access to the completed gig.
--
-- Fixture map (FIXED literals — gen_random_uuid() would not cross role switches):
--   users     …-0801 Lucia  owner of every gig here, active org_admin @ Sede Madrid
--             …-0802 Juan   active @ Sede Madrid — THE reader
--             …-0803 Pedro  active @ Sede Lima — same org, different branch (the scenario's
--                           branch-scope assertion: he must see nothing)
--             …-0804 Marta  FORMER member of Sede Madrid (left 30 days ago)
--             …-0805 Nora   active member of a second org
--   tenancy   …-0811 Academia Musical | …-0812 Otra Academia
--             …-0821 Sede Madrid    | …-0822 Sede Lima
--   gigs      …-0831 completed + shared_to_branch = true + branch Sede Madrid — MUST be visible
--             …-0832 completed + NOT shared                 — "private to Lucia by default"
--             …-0833 planned   + shared_to_branch = true    — "and, once completed,"
--             …-0834 completed + shared + branch_id IS NULL  — fail closed
--             …-0835 planned   + not shared                 — throwaway, write-denial half
--   perform.  …-0841 on gig …-0831 | …-0842 on gig …-0832 (proves the hop fails closed)
--   items     …-0851, …-0852 on performance …-0841 | …-0853 on performance …-0842
--
-- 30000000-… is the family the 0026/0027/0032 smokes already use in their 6xx/7xx slots;
-- this file stays in the 8xx slot and never touches the seed's setlist family (…-000001…3).
-- The seed's own gigs live in the 61000000-… family and are not referenced here.
--
-- Conventions (0038): role switches use `select set_config(...)` (bare calls are not valid
-- top-level statements), the JWT arrives through request.jwt.claims, and contract row counts
-- run under role postgres because RLS would filter them for a member session.
--
-- Write denial is asserted as "0 rows affected", NOT as SQLSTATE 42501: an UPDATE/DELETE
-- whose RLS USING clause does not match filters the row out silently — it raises no error and
-- changes nothing. 42501 is what a missing TABLE privilege or a WITH CHECK violation raises,
-- and `authenticated` holds the table privileges here (assertion 1). The assertion that can
-- actually fail is the row count, so that is the assertion this file carries.
-- expects 23 PASS / 0 FAIL
set client_min_messages to notice;

create or replace function tmp_assert(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok then raise notice '[PASS] %', p_name;
  else raise notice '[FAIL] %', p_name; end if;
end $$;

-- ══════════════ FIXTURES (role postgres) ══════════════
select set_config('role', 'postgres', false);

insert into organizations (id, name, org_type, status) values
  ('30000000-0000-0000-0000-000000000811', 'Academia Musical', 'Academy', 'active'),
  ('30000000-0000-0000-0000-000000000812', 'Otra Academia', 'Academy', 'active')
  on conflict do nothing;

insert into branches (id, org_id, name, city, status) values
  ('30000000-0000-0000-0000-000000000821', '30000000-0000-0000-0000-000000000811',
   'Sede Madrid', 'Madrid', 'active'),
  ('30000000-0000-0000-0000-000000000822', '30000000-0000-0000-0000-000000000811',
   'Sede Lima', 'Lima', 'active')
  on conflict do nothing;

-- GoTrue v2 reads token/phone columns as plain strings: they must be '' and never NULL.
-- No `on conflict do nothing` here on purpose: auth.users carries UNIQUE (phone) and
-- UNIQUE (email), so a re-run against a dirty database would skip rows SILENTLY and fail
-- later on a foreign key from a table that looks fine. The phones below are the 06x slot,
-- free across scripts/smoke/ (03x–05x, 10x and 90x are taken).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('30000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lucia.gigread@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000061', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Lucia","lastName":"Owner","displayName":"Lucia"}', now(), now()),
  ('30000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'juan.gigread@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000062', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Juan","lastName":"Madrid","displayName":"Juan"}', now(), now()),
  ('30000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pedro.gigread@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000063', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Pedro","lastName":"Lima","displayName":"Pedro"}', now(), now()),
  ('30000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'marta.gigread@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000064', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Marta","lastName":"Former","displayName":"Marta"}', now(), now()),
  ('30000000-0000-0000-0000-000000000805', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'nora.gigread@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000065', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Nora","lastName":"Other","displayName":"Nora"}', now(), now());

-- The auth.users trigger creates the profile rows (0006:49); names are set here only so the
-- fixture world is legible in a failure message.
update profiles set display_name = v.display_name
from (values
  ('30000000-0000-0000-0000-000000000801'::uuid, 'Lucia'),
  ('30000000-0000-0000-0000-000000000802'::uuid, 'Juan'),
  ('30000000-0000-0000-0000-000000000803'::uuid, 'Pedro'),
  ('30000000-0000-0000-0000-000000000804'::uuid, 'Marta'),
  ('30000000-0000-0000-0000-000000000805'::uuid, 'Nora')
) as v(id, display_name)
where profiles.id = v.id;

-- Marta is the former member: status 'former' with left_at set is what makes her invisible,
-- because private.user_branch_ids (0002:20-24) aggregates ACTIVE memberships only.
insert into org_memberships (user_id, org_id, branch_id, role, status, left_at) values
  ('30000000-0000-0000-0000-000000000801', '30000000-0000-0000-0000-000000000811',
   '30000000-0000-0000-0000-000000000821', 'org_admin', 'active', null),
  ('30000000-0000-0000-0000-000000000802', '30000000-0000-0000-0000-000000000811',
   '30000000-0000-0000-0000-000000000821', 'org_member', 'active', null),
  ('30000000-0000-0000-0000-000000000803', '30000000-0000-0000-0000-000000000811',
   '30000000-0000-0000-0000-000000000822', 'org_member', 'active', null),
  ('30000000-0000-0000-0000-000000000804', '30000000-0000-0000-0000-000000000811',
   '30000000-0000-0000-0000-000000000821', 'org_member', 'former', now() - interval '30 days'),
  ('30000000-0000-0000-0000-000000000805', '30000000-0000-0000-0000-000000000812',
   null, 'org_member', 'active', null)
  on conflict do nothing;

insert into gigs (id, org_id, branch_id, owner_id, name, scheduled_at, status, shared_to_branch) values
  ('30000000-0000-0000-0000-000000000831', '30000000-0000-0000-0000-000000000811',
   '30000000-0000-0000-0000-000000000821', '30000000-0000-0000-0000-000000000801',
   'Friday Gig (shared)', now() - interval '7 days', 'completed', true),
  ('30000000-0000-0000-0000-000000000832', '30000000-0000-0000-0000-000000000811',
   '30000000-0000-0000-0000-000000000821', '30000000-0000-0000-0000-000000000801',
   'Friday Gig (unshared)', now() - interval '7 days', 'completed', false),
  ('30000000-0000-0000-0000-000000000833', '30000000-0000-0000-0000-000000000811',
   '30000000-0000-0000-0000-000000000821', '30000000-0000-0000-0000-000000000801',
   'Friday Gig (planned)', now() + interval '2 days', 'planned', true),
  ('30000000-0000-0000-0000-000000000834', '30000000-0000-0000-0000-000000000811',
   null, '30000000-0000-0000-0000-000000000801',
   'Friday Gig (branchless)', now() - interval '7 days', 'completed', true),
  ('30000000-0000-0000-0000-000000000835', '30000000-0000-0000-0000-000000000811',
   '30000000-0000-0000-0000-000000000821', '30000000-0000-0000-0000-000000000801',
   'Throwaway Gig', now() + interval '9 days', 'planned', false)
  on conflict do nothing;

insert into performances (id, gig_id, performed_at) values
  ('30000000-0000-0000-0000-000000000841', '30000000-0000-0000-0000-000000000831',
   now() - interval '7 days' + interval '90 minutes'),
  ('30000000-0000-0000-0000-000000000842', '30000000-0000-0000-0000-000000000832',
   now() - interval '7 days' + interval '90 minutes')
  on conflict do nothing;

insert into performance_items (id, performance_id, song_id, version_id, state, position) values
  ('30000000-0000-0000-0000-000000000851', '30000000-0000-0000-0000-000000000841',
   '20000000-0000-0000-0000-000000000001', null, 'played', 1),
  ('30000000-0000-0000-0000-000000000852', '30000000-0000-0000-0000-000000000841',
   '20000000-0000-0000-0000-000000000002', null, 'played', 2),
  ('30000000-0000-0000-0000-000000000853', '30000000-0000-0000-0000-000000000842',
   '20000000-0000-0000-0000-000000000001', null, 'played', 1)
  on conflict do nothing;

-- ══════════════ 1. THE GRANT CONTRACT (role postgres) ══════════════
\echo '--- 1. grant contract (role postgres) ---'
select set_config('role', 'postgres', false);

select tmp_assert(
  '1 authenticated holds SELECT on gigs, performances and performance_items — the new policies are inert without it',
  has_table_privilege('authenticated', 'public.gigs', 'select')
  and has_table_privilege('authenticated', 'public.performances', 'select')
  and has_table_privilege('authenticated', 'public.performance_items', 'select')
);

-- ══════════════ 2. THE READER — active member of Sede Madrid ══════════════
\echo '--- 2. Juan, active member of Sede Madrid ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000802","role":"authenticated"}', false);

select tmp_assert('2 Juan opens the completed gig shared to his branch',
  (select count(*) = 1 from public.gigs
    where id = '30000000-0000-0000-0000-000000000831'));
select tmp_assert('3 Juan reads its performance record',
  (select count(*) = 1 from public.performances
    where id = '30000000-0000-0000-0000-000000000841'));
select tmp_assert('4 Juan reads both items of that performance — the setlist is not empty',
  (select count(*) = 2 from public.performance_items
    where performance_id = '30000000-0000-0000-0000-000000000841'));
select tmp_assert('5 Juan sees exactly ONE gig of the fixture org — no negative leaked in',
  (select count(*) = 1 from public.gigs
    where org_id = '30000000-0000-0000-0000-000000000811'));

-- ══════════════ 3. EVERY NEGATIVE BRANCH ══════════════
\echo '--- 3. negatives ---'

-- (a) branch scope, not org scope: Pedro is active in the SAME org, other branch.
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000803","role":"authenticated"}', false);
select tmp_assert('6 Pedro (Sede Lima, same org) reads 0 rows — the scope is the branch, not the org',
  (select count(*) = 0 from public.gigs
    where id = '30000000-0000-0000-0000-000000000831'));

select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000802","role":"authenticated"}', false);
-- (b) never shared: "the gig is private to Lucia by default".
select tmp_assert('7 Juan reads 0 rows of the completed but UNSHARED gig — private to Lucia by default',
  (select count(*) = 0 from public.gigs
    where id = '30000000-0000-0000-0000-000000000832'));
-- (c) shared, but not completed yet: "and, once completed, its performance record".
select tmp_assert('8 Juan reads 0 rows of the shared but PLANNED gig — sharing exposes a completed gig only',
  (select count(*) = 0 from public.gigs
    where id = '30000000-0000-0000-0000-000000000833'));
-- (d) a former member of the branching branch.
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000804","role":"authenticated"}', false);
select tmp_assert('9 a FORMER member of Sede Madrid reads 0 rows (user_branch_ids covers active members only)',
  (select count(*) = 0 from public.gigs
    where id = '30000000-0000-0000-0000-000000000831'));
-- (e) a member of a different org.
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000805","role":"authenticated"}', false);
select tmp_assert('10 a member of the other org reads 0 rows',
  (select count(*) = 0 from public.gigs
    where id = '30000000-0000-0000-0000-000000000831'));
-- (f) fail closed: shared + completed, but the gig names no branch.
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000802","role":"authenticated"}', false);
select tmp_assert('11 Juan reads 0 rows of the shared completed gig with branch_id IS NULL — fail closed, no org-wide fallback',
  (select count(*) = 0 from public.gigs
    where id = '30000000-0000-0000-0000-000000000834'));

-- The two-hop path must fail closed too. Prove first that the rows EXIST, so the 0 below is
-- RLS and not absence.
select set_config('role', 'postgres', false);
select tmp_assert('12 the unshared gig DOES carry a performance with an item — the zeros below are RLS, not absence',
  (select count(*) = 1 from public.performances
    where id = '30000000-0000-0000-0000-000000000842')
  and (select count(*) = 1 from public.performance_items
    where performance_id = '30000000-0000-0000-0000-000000000842'));

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000802","role":"authenticated"}', false);
select tmp_assert('13 Juan reads 0 performances of the unshared gig (one hop fails closed)',
  (select count(*) = 0 from public.performances
    where gig_id = '30000000-0000-0000-0000-000000000832'));
select tmp_assert('14 Juan reads 0 performance_items of that performance (two hops fail closed)',
  (select count(*) = 0 from public.performance_items
    where performance_id = '30000000-0000-0000-0000-000000000842'));

-- ══════════════ 4. READ-ONLY IS STRUCTURAL (D4) ══════════════
\echo '--- 4. the reader cannot write ---'
select set_config('role', 'authenticated', false);

-- Gig …831 is the row Juan CAN read, so this is not "the row is invisible"; it is "a read
-- grant is not a write grant". An UPDATE whose RLS USING clause does not match changes 0
-- rows silently — no 42501 to catch, which is why the assertion is the row count.
with u as (
  update public.gigs set name = 'tampered by juan'
   where id = '30000000-0000-0000-0000-000000000831' returning id
)
select tmp_assert('15 Juan''s UPDATE of the gig he can read affects 0 rows',
  (select count(*) from u) = 0);

with d as (
  delete from public.gigs
   where id = '30000000-0000-0000-0000-000000000835' returning id
)
select tmp_assert('16 Juan''s DELETE affects 0 rows',
  (select count(*) from d) = 0);

select set_config('role', 'postgres', false);
select tmp_assert('17 both write attempts changed nothing: …831 keeps its name, …835 still exists',
  (select count(*) = 1 from public.gigs
    where id = '30000000-0000-0000-0000-000000000831'
      and name = 'Friday Gig (shared)')
  and (select count(*) = 1 from public.gigs
    where id = '30000000-0000-0000-0000-000000000835'
      and name = 'Throwaway Gig'));

-- The owner keeps both, through the same authenticated role.
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000801","role":"authenticated"}', false);
with u as (
  update public.gigs set name = 'Throwaway Gig (renamed by its owner)'
   where id = '30000000-0000-0000-0000-000000000835' returning id
)
select tmp_assert('18 the owner CAN update her own gig (1 row)',
  (select count(*) from u) = 1);

with d as (
  delete from public.gigs
   where id = '30000000-0000-0000-0000-000000000835' returning id
)
select tmp_assert('19 the owner CAN delete her own gig (1 row)',
  (select count(*) from d) = 1);

-- ══════════════ 5. THE OFFBOARDING HALF ══════════════
\echo '--- 5. the owner leaves the org ---'
-- The real path, not a hand-written UPDATE: public.leave_organization flips every active
-- membership of that org to former and stamps left_at (0038:36-106).
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000801","role":"authenticated"}', false);
select public.leave_organization('30000000-0000-0000-0000-000000000811');

select set_config('role', 'postgres', false);
select tmp_assert('20 Lucia''s membership is former with left_at set',
  (select status = 'former' and left_at is not null
     from public.org_memberships
    where user_id = '30000000-0000-0000-0000-000000000801'
      and org_id = '30000000-0000-0000-0000-000000000811'));

-- She is no longer in any branch (the shared policy cannot reach her), so these two pass on
-- the untouched owner policies alone — "the gig and its performance record stay with her".
select set_config('role', 'authenticated', false);
select tmp_assert('21 the former owner still reads her own gig after leaving',
  (select count(*) = 1 from public.gigs
    where id = '30000000-0000-0000-0000-000000000831'));
select tmp_assert('22 the former owner still reads its performance record after leaving',
  (select count(*) = 1 from public.performances
    where id = '30000000-0000-0000-0000-000000000841'));

-- "…and org members keep read-only access to the completed gig."
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000802","role":"authenticated"}', false);
select tmp_assert('23 a remaining branch member still reads the completed gig after the owner left',
  (select count(*) = 1 from public.gigs
    where id = '30000000-0000-0000-0000-000000000831'));

\echo
\echo 'If the expected count is 23 and you see 23 PASS notices with 0 FAIL, every contract here holds.'
\echo '(Do not grep the output for the bracketed words themselves: this banner would match and skew the count.)'
\echo 'The load-bearing ones: 6 proves branch scope (not org scope), 7/8 the sharing rules, 9 the former'
\echo 'member, 11 the fail-closed branch_id IS NULL, 13/14 the two-hop path, 15-19 read-only + owner intact,'
\echo '20-23 the offboarding half. 1 guards the table grants the policies depend on; 5 guards over-granting.'
\echo 'This script is NOT idempotent: it commits its writes. Reset before a second run.'
reset role;
