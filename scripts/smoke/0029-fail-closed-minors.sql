-- 0029 Fail-closed minors smoke (local dev only; fresh reset DB, single run).
-- Reuses the seed fixture: demo …0001 (the OBSERVER session — any other
-- authenticated user looking at the three profile states), isolation …0002
-- (untouched, used as the publish-only outsider check), outsider …0003.
-- Three NEW auth.users fixtures in the free 1000…09xx family (0026-0028 use
-- 3000…06xx/0711, 07xx, 08xx; 0024/0025 use 3000…002/001 — no collision):
--   …0901 MINOR   — declares a dob INSIDE 18 years, via the real client write
--                   path (authenticated `update (date_of_birth)`, 0017 line 71),
--                   so the profiles_minor_flag trigger is the only writer.
--   …0902 ADULT   — declares the grandfathered 2002-10-10 (23 in 2026).
--   …0903 UNKNOWN — dob left NULL on purpose: the fail-closed state.
-- The 0006 on_auth_user_created trigger auto-creates each profiles row, so
-- …0903 starts life with date_of_birth IS NULL. One fixture song
-- 2000…0e1 (0028 owns 0d1-0d4) owned by …0903, …0901 and …0902 so the
-- publish gate is reached past its initPlan/license/ownership checks.
-- Matrix: the three states resolve correctly for the PUBLIC SEARCH surface
-- (profiles_select_search): adult visible, minor hidden (0017 behaviour),
-- UNKNOWN hidden (the NEW 0029 behaviour — the most important assertion here).
-- Self-select is proven untouched so fail-closed does not lock a user out of
-- their OWN row. The publish gate raises two DISTINCT messages: the guardian one
-- for a known minor, the new dob one for unknown. record_guardian_consent still
-- raises 'Consent is only required for minors.' for an unknown-dob session —
-- the deliberate non-change (0029 section 4) that keeps unknown out of the
-- consent flow. Backfill: zero NULL date_of_birth remain, and the seeded demo
-- row carries the grandfathered date. Assertions that read contract tables
-- directly run under role postgres (deny-by-default; RLS is the client gate).
-- Role switches use `select set_config(...)` (bare calls are not valid
-- top-level statements).
-- expects 19 PASS / 0 FAIL
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

-- ══════════════ 1. MIGRATION SURFACE + BACKFILL (postgres) ══════════════
-- Runs BEFORE the new fixtures are created, so the backfill assertion sees the
-- grandfathered base only — …0901-0903 are inserted in section 2, after this.
select tmp_assert(
  '0029 backfill left zero profiles with a NULL date_of_birth',
  (select count(*) from public.profiles where date_of_birth is null) = 0
);

select tmp_assert(
  '0029 backfill grandfathers the seeded base to 2002-10-10 as adult',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-000000000001'
             and p.date_of_birth = date '2002-10-10' and p.is_minor = false)
);

select tmp_assert(
  '0029 both private helpers exist (profile_dob_known, profile_not_verified_adult)',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname in ('profile_dob_known', 'profile_not_verified_adult')) = 2
);

select tmp_assert(
  '0029 profiles_select_search is fail-closed (uses profile_not_verified_adult)',
  exists (select 1 from pg_policies
           where schemaname = 'public' and tablename = 'profiles'
             and policyname = 'profiles_select_search'
             and qual like '%profile_not_verified_adult%')
);

-- ══════════════ 2. FIXTURES: THREE PROFILE STATES (postgres) ══════════════
-- auth.users insert → 0006 on_auth_user_created creates the profiles row with
-- date_of_birth NULL. …0901/…0902 then declare a dob as THEMSELVES below.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'minor@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000901', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Minor","lastName":"User","displayName":"Minor User"}', now(), now()),
  ('10000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'adult@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000902', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Adult","lastName":"User","displayName":"Adult User"}', now(), now()),
  ('10000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'unknowndob@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000903', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Unknown","lastName":"Dob","displayName":"Unknown Dob User"}', now(), now())
  on conflict do nothing;

-- One song per publishing fixture, owned by that fixture (so the publish gate is
-- reached past its ownership check and the observed error is the age gate).
insert into public.songs (id, title, artist, genre, created_by)
values
  ('20000000-0000-0000-0000-0000000000e1', 'Minor Publish Probe', 'Fixture', 'worship',
   '10000000-0000-0000-0000-000000000901'),
  ('20000000-0000-0000-0000-0000000000e2', 'Adult Publish Probe', 'Fixture', 'worship',
   '10000000-0000-0000-0000-000000000902'),
  ('20000000-0000-0000-0000-0000000000e3', 'Unknown Publish Probe', 'Fixture', 'worship',
   '10000000-0000-0000-0000-000000000903');

-- …0901 declares a dob INSIDE 18 years. (current_date - interval '10 years') is
-- used instead of a literal so the fixture cannot silently age into adulthood.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000901","role":"authenticated"}',false);

update public.profiles
   set date_of_birth = (current_date - interval '10 years')::date
 where id = '10000000-0000-0000-0000-000000000901';

-- …0902 declares the grandfathered adult date.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000902","role":"authenticated"}',false);

update public.profiles
   set date_of_birth = date '2002-10-10'
 where id = '10000000-0000-0000-0000-000000000902';

-- …0903 declares NOTHING — this is the fail-closed state under test.

-- ══════════════ 3. TRIGGER-RECOMPUTED is_minor (postgres) ══════════════
-- The trigger (0017 lines 48-66) is the ONLY writer: the two UPDATEs above
-- changed date_of_birth alone and is_minor followed from the same formula.
select set_config('role','postgres',false);

select tmp_assert(
  '0029 trigger recomputed is_minor=true for the dob-inside-18-years profile',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-000000000901' and p.is_minor = true)
);

select tmp_assert(
  '0029 trigger recomputed is_minor=false for the 2002-10-10 profile',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-000000000902' and p.is_minor = false)
);

select tmp_assert(
  '0029 unknown-dob profile is_minor stays false (unknown is not a minor claim)',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-000000000903'
             and p.date_of_birth is null and p.is_minor = false)
);

-- ══════════════ 4. profiles_select_search — THE THREE STATES (observer …0001) ══════════════
-- Demo …0001 is an adult post-backfill, so it is a valid "somebody else" reading
-- the three fixtures. RLS is the only gate here: no postgres bypass.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

select tmp_assert(
  '0029 ADULT profile (dob 2002-10-10) IS visible in profiles_select_search',
  (select count(*) from public.profiles
     where id = '10000000-0000-0000-0000-000000000902') = 1
);

select tmp_assert(
  '0029 MINOR profile is NOT visible in profiles_select_search (0017 behaviour holds)',
  (select count(*) from public.profiles
     where id = '10000000-0000-0000-0000-000000000901') = 0
);

-- THE NEW FAIL-CLOSED ASSERTION: an unknown dob is not a verified adult, so the
-- row must not reach a public surface. 0017 fail-opened here.
select tmp_assert(
  '0029 UNKNOWN-dob profile is NOT visible in profiles_select_search (fail-closed, new)',
  (select count(*) from public.profiles
     where id = '10000000-0000-0000-0000-000000000903') = 0
);

-- Self-select (0006 profiles_select_self) is NOT fail-closed: the unknown-dob
-- account still reads its OWN row, so it can complete its profile (WU2).
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000903","role":"authenticated"}',false);

select tmp_assert(
  '0029 unknown-dob account still reads its OWN profile (self-select untouched)',
  (select count(*) from public.profiles
     where id = '10000000-0000-0000-0000-000000000903') = 1
);

-- ══════════════ 5. PUBLISH GATE — TWO DISTINCT MESSAGES ══════════════
-- (a) unknown dob → the new fail-closed message.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000903","role":"authenticated"}',false);

select tmp_expect_error(
  '0029 unknown-dob publish blocked: Complete your date of birth before publishing.',
  $$select public.publish_song_to_library(
      '20000000-0000-0000-0000-0000000000e3', 'CC-BY-4.0', true, null)$$,
  '%Complete your date of birth before publishing.%'
);

-- (b) known minor, no approved consent → the UNCHANGED guardian wording wins
-- over the dob message (branch order is the contract, 0029 section 3).
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000901","role":"authenticated"}',false);

select tmp_expect_error(
  '0029 minor publish blocked: Guardian approval required for public sharing',
  $$select public.publish_song_to_library(
      '20000000-0000-0000-0000-0000000000e1', 'CC-BY-4.0', true, null)$$,
  '%Guardian approval required for public sharing%'
);

-- (c) adult with a dob PUBLISHES — the positive control for the acceptance
-- criterion "an adult with dob set can do both".
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000902","role":"authenticated"}',false);

select public.publish_song_to_library(
  '20000000-0000-0000-0000-0000000000e2', 'CC-BY-4.0', true, null);

select set_config('role','postgres',false);

select tmp_assert(
  '0029 adult-with-dob publish SUCCEEDS (public_songs row is live)',
  exists (select 1 from public.public_songs ps
           where ps.song_id = '20000000-0000-0000-0000-0000000000e2'
             and ps.contributor_id = '10000000-0000-0000-0000-000000000902'
             and ps.status = 'live')
);

-- (d) unknown-dob publish inserted NOTHING (fail-closed blocks, not warns).
select tmp_assert(
  '0029 unknown-dob publish left no public_songs row (blocked, not partial)',
  not exists (select 1 from public.public_songs
                where song_id = '20000000-0000-0000-0000-0000000000e3')
);

-- ══════════════ 6. DELIBERATE NON-CHANGE — UNKNOWN IS NEVER A MINOR CLAIM ══════════════
-- 0029 section 4: the consent RPCs keep private.session_is_minor(), the KNOWN
-- minor predicate. If 0029 had fail-closed them, an unknown-dob session would
-- pass the "not a minor" test and be pushed into the guardian-consent flow —
-- asking a stranger to consent for an adult. The known-minor predicate is what
-- makes "not a minor" TRUE here, so this call must still be refused.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000903","role":"authenticated"}',false);

select tmp_expect_error(
  '0029 record_guardian_consent still refuses unknown-dob session (not pushed to consent)',
  $$select public.record_guardian_consent(
      '10000000-0000-0000-0000-000000000903', 'A Guardian', 'guardian@cemurm.app', 'v1 text')$$,
  '%Consent is only required for minors.%'
);

select set_config('role','postgres',false);

-- The refused call must not have minted a consent row either.
select tmp_assert(
  '0029 refused consent call created no guardian_consents row',
  (select count(*) from public.guardian_consents
     where user_id = '10000000-0000-0000-0000-000000000903') = 0
);

-- ══════════════ 7. CLEANUP (postgres) ══════════════
delete from public.public_songs where song_id in (
  '20000000-0000-0000-0000-0000000000e1',
  '20000000-0000-0000-0000-0000000000e2',
  '20000000-0000-0000-0000-0000000000e3'
);
delete from public.songs where id in (
  '20000000-0000-0000-0000-0000000000e1',
  '20000000-0000-0000-0000-0000000000e2',
  '20000000-0000-0000-0000-0000000000e3'
);
-- profiles cascade from auth.users (profiles.id references auth.users on delete
-- cascade); the trigger-recomputed is_minor flags go with the rows.
delete from auth.users where id in (
  '10000000-0000-0000-0000-000000000901',
  '10000000-0000-0000-0000-000000000902',
  '10000000-0000-0000-0000-000000000903'
);

select tmp_assert(
  '0029 fixture tidy: profiles/songs/public_songs rows removed',
  (select count(*) from public.profiles
     where id in ('10000000-0000-0000-0000-000000000901',
                  '10000000-0000-0000-0000-000000000902',
                  '10000000-0000-0000-0000-000000000903')) = 0
  and (select count(*) from public.songs
        where id::text like '20000000-0000-0000-0000-0000000000e%') = 0
  and (select count(*) from public.public_songs
        where song_id::text like '20000000-0000-0000-0000-0000000000e%') = 0
);

-- ══════════════ 8. POST-CLEANUP INVARIANT (postgres) ══════════════
-- The fixtures are gone; the grandfathered base must still be whole.
select tmp_assert(
  '0029 base intact after cleanup: still zero NULL date_of_birth',
  (select count(*) from public.profiles where date_of_birth is null) = 0
);

reset role;
