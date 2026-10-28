-- 0030 Date-of-birth step smoke (local dev only; fresh reset DB, single run).
-- Reuses the seed fixture: demo …0001 is an adult post-0029-backfill, so it is
-- a valid session for the FIRST assertion — the one that matters most.
-- THREE NEW auth.users fixtures in the free 1000…0a3-0a5 family (0024 owns
-- …0a1/…0a2; 0025 owns …0b1; 0026-0028 use 3000…06xx/0711/07xx/08xx; 0029 uses
-- …0901-0903; 0024/0025 songs use 2000…0001-0004 — no collision):
--   …0a3 ADULT   — dob starts NULL, declares the grandfathered 2002-10-10.
--   …0a4 MINOR   — dob starts NULL, declares a date inside 18 years.
--   …0a5 ATTACKER— dob starts NULL, declares a minor date, then tries to
--                   re-declare as an adult. Carries an ACTIVE guardian
--                   consent so the archive behaviour is observable.
--   …0a9 NO ROW  — NOT an auth.users fixture: only a JWT sub. auth.uid()
--                   resolves it from the claim, so my_age_status sees a caller
--                   with no profiles row (the "missing profile" state).
-- The 0006 on_auth_user_created trigger auto-creates each profiles row, so all
-- three start life with date_of_birth IS NULL — the fail-closed state WU2 asks
-- about. A 6th sub, no claim at all, is the "no session" state.
-- WHAT THIS PROVES, in order:
--  1. THE BYPASS IS CLOSED — as `authenticated`, a direct
--     `update public.profiles set date_of_birth = …` raises
--     'permission denied for table profiles'. Asserted FIRST, and paired with
--     the contrast that the denial is the COLUMN grant and not RLS: writing
--     `display_name` on the caller's own row still succeeds in the same session.
--  2. The declared date lands and is_minor is recomputed by the ONLY writer,
--     the 0017 profiles_minor_flag trigger (adult → false, minor → true).
--  3. Null / future / pre-1900 dates are rejected with three distinct messages
--     and change nothing.
--  4. NO-ESCALATION — a known minor declaring an adult date is refused AND is
--     still is_minor=true with an unchanged date afterwards. A minor may
--     correct to another minor date; an adult may correct a typo to another
--     adult date; the honest adult → minor correction is never blocked.
--  5. WHY RULE 5 EXISTS — the same escalation performed as `postgres` (the
--     table owner, i.e. what the RPC stands between a client and) flips
--     is_minor and ARCHIVES the active consent via 0017 lines 53-57. That is
--     the damage rule 5 prevents, observed directly.
--  6. my_age_status answers (dob_known, is_minor) for minor / adult / missing
--     row, and its result set carries no date value — proved live with
--     pg_typeof on both output columns.
--  7. Both RPCs raise with no session.
-- Assertions that read contract tables directly run under role postgres
-- (deny-by-default; RLS is the client gate). Role switches use
-- `select set_config(...)` (bare calls are not valid top-level statements).
-- expects 38 PASS / 0 FAIL
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

-- 0030 addition: the mirror of tmp_expect_error. Used where the assertion is
-- that a write MUST go through (a statement that is expected to succeed).
create or replace function tmp_expect_ok(p_name text, p_sql text) returns void language plpgsql as $$
declare err text := '';
begin
  begin
    execute p_sql;
  exception when others then
    err := sqlerrm;
  end;
  if err = '' then raise notice '[PASS] %', p_name;
  else raise notice '[FAIL] % (got: %)', p_name, err; end if;
end $$;

-- ══════════════ 1. MIGRATION SURFACE (postgres) ══════════════
select tmp_assert(
  '0030 the 0017 column grant is gone: authenticated has no privilege on date_of_birth',
  (select count(*) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated' and column_name = 'date_of_birth') = 0
);

select tmp_assert(
  '0030 the 0006 display_name column grant survives (only the age fact was revoked)',
  (select count(*) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated' and column_name = 'display_name'
      and privilege_type = 'UPDATE') = 1
);

select tmp_assert(
  '0030 both write entry points exist (private core + public wrapper)',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname in ('set_date_of_birth', 'set_date_of_birth_core')) = 2
);

-- my_age_status must be two booleans and nothing else — statically, from the
-- declared return type. A date here would defeat 0017's "birth dates stay
-- server-side" intent (0017 lines 37-38, 68-70).
select tmp_assert(
  '0030 my_age_status return type is exactly (dob_known boolean, is_minor boolean) — no date',
  (select pg_get_function_result(p.oid) = 'TABLE(dob_known boolean, is_minor boolean)'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'my_age_status')
);

-- ══════════════ 2. THE BYPASS IS CLOSED (authenticated, demo …0001) ══════════════
-- FIRST behavioural assertion on purpose: this is the defect 0030 exists for.
-- 0017 line 71 granted `update (date_of_birth) to authenticated`, so before
-- 0030 this exact statement SUCCEEDED and re-derived the caller's own age.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

select tmp_expect_error(
  '0030 direct column write DENIED: permission denied for table profiles (0017 bypass closed)',
  $$update public.profiles set date_of_birth = date '1990-01-01'
     where id = '10000000-0000-0000-0000-000000000001'$$,
  '%permission denied for table profiles%'
);

-- The contrast that makes the assertion honest: the SAME session may still
-- write an allowed column on its OWN row. So the denial above is the revoked
-- column grant, not RLS, not the role switch, not a missing policy.
select tmp_expect_ok(
  '0030 contrast: the same session still writes display_name on its own row (denial is the column grant)',
  $$update public.profiles set display_name = display_name
     where id = '10000000-0000-0000-0000-000000000001'$$
);

-- The refused write changed nothing.
select set_config('role','postgres',false);

select tmp_assert(
  '0030 the denied direct write left the demo row adult (still 2002-10-10)',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-000000000001'
             and p.date_of_birth = date '2002-10-10' and p.is_minor = false)
);

-- ══════════════ 3. FIXTURES: THREE NULL-DOB ACCOUNTS (postgres) ══════════════
-- auth.users insert → 0006 on_auth_user_created creates the profiles row with
-- date_of_birth NULL. Nothing here writes the column: 0030 removed the grant,
-- so every date below is set by the RPC under test.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'doblast@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000103', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Dob","lastName":"Adult","displayName":"Dob Adult"}', now(), now()),
  ('10000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dobminor@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000104', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Dob","lastName":"Minor","displayName":"Dob Minor"}', now(), now()),
  ('10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dobescalate@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000105', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Dob","lastName":"Escalate","displayName":"Dob Escalate"}', now(), now())
  on conflict do nothing;

-- An ACTIVE guardian consent for …0a5, so the escalation damage is observable
-- (0017 lines 53-57 archive it on a minor → adult transition).
-- 0031 changed the column DEFAULT from 'active' to 'pending' (D4), so this
-- fixture now states 'active' explicitly. It is the state the assertions below
-- require, and the assertions are untouched — 38 PASS is still the bar.
insert into public.guardian_consents (user_id, guardian_name, guardian_email, consent_text, status)
values ('10000000-0000-0000-0000-0000000000a5', 'A Guardian', 'guardian@cemurm.app', 'v1 text', 'active');

select tmp_assert(
  '0030 fixtures: three null-dob accounts exist, none is a minor yet',
  (select count(*) from public.profiles
    where id in ('10000000-0000-0000-0000-0000000000a3',
                 '10000000-0000-0000-0000-0000000000a4',
                 '10000000-0000-0000-0000-0000000000a5')
      and date_of_birth is null and is_minor = false) = 3
);

-- ══════════════ 4. THE VALIDATED WRITE PATH (authenticated) ══════════════
-- (a) null dob → adult date. This is the WU2 happy path: the account holder
-- declares an age and the app is released.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000a3","role":"authenticated"}',false);

select tmp_expect_ok(
  '0030 set_date_of_birth succeeds for a null-dob account declaring an adult date',
  $$select public.set_date_of_birth(date '2002-10-10')$$
);

select set_config('role','postgres',false);

select tmp_assert(
  '0030 the declared date landed on the row',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-0000000000a3'
             and p.date_of_birth = date '2002-10-10')
);

-- The trigger, not the RPC, wrote is_minor (0030 rule 6 keeps it out of the
-- UPDATE column list precisely so there is still only one writer).
select tmp_assert(
  '0030 the trigger recomputed is_minor=false for the adult declaration',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-0000000000a3' and p.is_minor = false)
);

-- (b) null dob → minor date. The other half of the acceptance criterion: the
-- same step hands a minor to the guardian flow, and the server knows it did.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000a4","role":"authenticated"}',false);

select tmp_expect_ok(
  '0030 set_date_of_birth succeeds for a null-dob account declaring a minor date',
  $$select public.set_date_of_birth((current_date - interval '10 years')::date)$$
);

select set_config('role','postgres',false);

select tmp_assert(
  '0030 the trigger recomputed is_minor=TRUE for the minor declaration',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-0000000000a4'
             and p.date_of_birth = (current_date - interval '10 years')::date
             and p.is_minor = true)
);

-- ══════════════ 5. VALIDATION — THREE REJECTIONS, NOTHING CHANGED (…0a3) ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000a3","role":"authenticated"}',false);

-- Rule 2: unknown is not a declaration, so "set it to null" is not reachable.
select tmp_expect_error(
  '0030 a null date is rejected: Enter your date of birth.',
  $$select public.set_date_of_birth(null)$$,
  '%Enter your date of birth.%'
);

-- Rule 3: no birth dates in the future.
select tmp_expect_error(
  '0030 a future date is rejected: Date of birth cannot be in the future.',
  $$select public.set_date_of_birth(current_date + 1)$$,
  '%Date of birth cannot be in the future.%'
);

-- Rule 4: absurd input, and the bound on the trigger's arithmetic.
select tmp_expect_error(
  '0030 a pre-1900 date is rejected: Date of birth must be after 1900.',
  $$select public.set_date_of_birth(date '1899-12-31')$$,
  '%Date of birth must be after 1900.%'
);

select set_config('role','postgres',false);

select tmp_assert(
  '0030 all three rejections left the row unchanged (2002-10-10, adult)',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-0000000000a3'
             and p.date_of_birth = date '2002-10-10' and p.is_minor = false)
);

-- ══════════════ 6. NO-ESCALATION — THE CRITICAL RULE (…0a5, a known minor) ══════════════
-- …0a5 is now a declared minor with an ACTIVE consent. It tries to re-declare
-- as an adult: the exact move the revoked column grant used to allow.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000a5","role":"authenticated"}',false);

select tmp_expect_ok(
  '0030 setup: the escalation attacker declares a minor date through the RPC',
  $$select public.set_date_of_birth((current_date - interval '15 years')::date)$$
);

select tmp_expect_error(
  '0030 NO-ESCALATION: a minor declaring an adult date is refused',
  $$select public.set_date_of_birth(date '1990-01-01')$$,
  '%A minor account cannot declare an adult date of birth.%'
);

-- Post-conditions, not just the exception: the refusal must be total. A raise
-- that still flipped the flag would be worse than no rule at all.
select set_config('role','postgres',false);

select tmp_assert(
  '0030 POST-CONDITION: the refused escalation left is_minor=true',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-0000000000a5' and p.is_minor = true)
);

select tmp_assert(
  '0030 POST-CONDITION: the refused escalation left the minor date unchanged',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-0000000000a5'
             and p.date_of_birth = (current_date - interval '15 years')::date)
);

select tmp_assert(
  '0030 POST-CONDITION: the refused escalation left the guardian consent ACTIVE',
  exists (select 1 from public.guardian_consents gc
           where gc.user_id = '10000000-0000-0000-0000-0000000000a5'
             and gc.status = 'active')
);

-- The permitted direction: a minor may correct their date to another MINOR
-- date. "Refused" must not mean "frozen".
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000a5","role":"authenticated"}',false);

select tmp_expect_ok(
  '0030 a minor correcting to a different MINOR date is allowed',
  $$select public.set_date_of_birth((current_date - interval '16 years')::date)$$
);

select set_config('role','postgres',false);

select tmp_assert(
  '0030 post-condition: the minor correction landed and is_minor is still true',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-0000000000a5'
             and p.date_of_birth = (current_date - interval '16 years')::date
             and p.is_minor = true)
);

-- An adult may correct a typo to another adult date (…0a3, the declaration
-- from section 4a). Nothing here is an escalation; the row is already adult.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000a3","role":"authenticated"}',false);

select tmp_expect_ok(
  '0030 an adult correcting a typo to another ADULT date is allowed',
  $$select public.set_date_of_birth(date '2001-06-15')$$
);

select set_config('role','postgres',false);

select tmp_assert(
  '0030 post-condition: the adult correction landed and is_minor is still false',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-0000000000a3'
             and p.date_of_birth = date '2001-06-15' and p.is_minor = false)
);

-- The honest direction is never blocked: an adult who declared 18+ by mistake
-- and then tells the truth only ever ADDS restrictions to their own account.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000a3","role":"authenticated"}',false);

select tmp_expect_ok(
  '0030 an adult correcting down to a MINOR date is allowed (restrictions only)',
  $$select public.set_date_of_birth((current_date - interval '12 years')::date)$$
);

select set_config('role','postgres',false);

select tmp_assert(
  '0030 post-condition: the adult→minor correction landed and is_minor is now true',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-0000000000a3'
             and p.date_of_birth = (current_date - interval '12 years')::date
             and p.is_minor = true)
);

-- ══════════════ 7. WHY RULE 5 EXISTS — THE ARCHIVE, OBSERVED (postgres) ══════════════
-- The exact same escalation, run as the TABLE OWNER instead of a client. This
-- is what rule 5 stands between an account holder and: the trigger recomputes
-- is_minor to false AND archives the active consent (0017 lines 53-57). Run as
-- postgres, the client cannot reach it — the RPC is the only door left, and
-- the RPC says no.
update public.profiles
   set date_of_birth = date '1990-01-01'
 where id = '10000000-0000-0000-0000-0000000000a5';

select tmp_assert(
  '0030 the owner-level escalation DOES flip is_minor (the hole rule 5 plugs)',
  exists (select 1 from public.profiles p
           where p.id = '10000000-0000-0000-0000-0000000000a5'
             and p.date_of_birth = date '1990-01-01' and p.is_minor = false)
);

select tmp_assert(
  '0030 and it DOES archive the active guardian consent (0017 lines 53-57)',
  exists (select 1 from public.guardian_consents gc
           where gc.user_id = '10000000-0000-0000-0000-0000000000a5'
             and gc.status = 'archived' and gc.archived_at is not null)
);

-- ══════════════ 8. my_age_status — TWO BOOLEANS, THREE STATES ══════════════
-- (a) the minor …0a5 is back to adult after section 7, so the minor state is
-- read on …0a4, which section 4b left a declared minor.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000a4","role":"authenticated"}',false);

select tmp_assert(
  '0030 my_age_status on a known MINOR returns (dob_known=true, is_minor=true)',
  (select dob_known and is_minor from public.my_age_status())
);

-- (b) an adult with a declared date. …0a3 declared a minor date in section 6, so
-- the adult here is the seeded demo …0001 (0029 backfill, adult, own session).
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

select tmp_assert(
  '0030 my_age_status on an ADULT returns (dob_known=true, is_minor=false)',
  (select dob_known and not is_minor from public.my_age_status())
);

-- (c) a session with NO profiles row. …0a9 is only a JWT sub — no auth.users,
-- no profiles — which is exactly the state a client must treat as "unknown",
-- never as "adult" (0029 private.profile_not_verified_adult, D2).
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000a9","role":"authenticated"}',false);

select tmp_assert(
  '0030 my_age_status with no profiles row returns (dob_known=false, is_minor=false)',
  (select not dob_known and not is_minor from public.my_age_status())
);

-- (d) the privacy posture, proved live rather than asserted in a comment: both
-- output columns are booleans, so no date can travel in this result set.
select tmp_assert(
  '0030 my_age_status result set carries NO date value (both columns are boolean)',
  (select bool_and(t = 'boolean') from (
     select pg_typeof(dob_known)::text as t from public.my_age_status()
     union all
     select pg_typeof(is_minor)::text from public.my_age_status()) s)
);

-- ══════════════ 9. NO SESSION — BOTH ENTRY POINTS REFUSE ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','',false);

select tmp_expect_error(
  '0030 set_date_of_birth with no session raises: Sign in to set your date of birth.',
  $$select public.set_date_of_birth(date '1990-01-01')$$,
  '%Sign in to set your date of birth.%'
);

select tmp_expect_error(
  '0030 my_age_status with no session raises: Sign in to check your age status.',
  $$select public.my_age_status()$$,
  '%Sign in to check your age status.%'
);

-- ══════════════ 10. CLEANUP (postgres) ══════════════
-- Back to postgres FIRST: section 9 left the session as `authenticated` with
-- an empty claim, which can neither delete auth.users nor read
-- profiles.date_of_birth. Contract-table reads and writes below run as the
-- owner (deny-by-default; RLS is the client gate).
select set_config('role','postgres',false);

-- profiles and guardian_consents cascade from auth.users (both FK
-- auth.users(id) on delete cascade).
delete from auth.users where id in (
  '10000000-0000-0000-0000-0000000000a3',
  '10000000-0000-0000-0000-0000000000a4',
  '10000000-0000-0000-0000-0000000000a5'
);

select tmp_assert(
  '0030 fixture tidy: profiles and guardian_consents rows removed',
  (select count(*) from public.profiles
     where id in ('10000000-0000-0000-0000-0000000000a3',
                  '10000000-0000-0000-0000-0000000000a4',
                  '10000000-0000-0000-0000-0000000000a5')) = 0
  and (select count(*) from public.guardian_consents
         where user_id in ('10000000-0000-0000-0000-0000000000a3',
                           '10000000-0000-0000-0000-0000000000a4',
                           '10000000-0000-0000-0000-0000000000a5')) = 0
);

-- ══════════════ 11. POST-CLEANUP INVARIANT (postgres) ══════════════
select tmp_assert(
  '0030 base intact after cleanup: still zero NULL date_of_birth',
  (select count(*) from public.profiles where date_of_birth is null) = 0
);

reset role;
