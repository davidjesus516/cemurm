-- 0031 Guardian consent by email smoke (local dev only; fresh reset DB, single run).
-- T4.1/T4.2: the 'pending' state, the two token RPCs, and the invariants that
-- make a login-less confirm endpoint inert without the token.
--
-- Reuses the seed fixture: demo …0001 is an adult post-0029-backfill, so it is
-- a valid session for the role-switch sanity check. THREE NEW auth.users
-- fixtures in the free 1000…0c1-0c3 family (0024 owns …0a1/…0a2; 0025 owns
-- …0b1; 0026-0028 use 3000…06xx/0711/07xx/08xx; 0029 uses …0901-0903; 0030
-- uses …0a3-0a5 and the claimless …0a9; songs 2000…0e1-0e4 are taken by
-- 0029/0030's neighbours — no collision):
--   …0c1 MINOR      — the guardian flow end to end: request → pending → confirm
--                     → active → approve sharing → publish → revoke → re-locked.
--   …0c2 MINOR      — the deprecated Hito 4 alias, and the second open row.
--   …0c3 INDEX PROBE— no consents of its own; the partial unique index tests.
-- …0c9 is NOT a fixture: it is only ever passed as an unknown user_id, which is
-- the "the account does not exist" arm of the indistinguishable-errors test.
-- All three start with date_of_birth NULL and declare a minor date here, so the
-- 0006 on_auth_user_created trigger has already created their profiles row.
--
-- WHAT THIS PROVES, in order:
--  1. The migration's shape: the schema DEFAULT is 'pending' (D4), consented_at
--     is nullable, the status vocabulary is enforced, and guardian_consents_one_open
--     replaced guardian_consents_one_active over both open states.
--  2. A request creates a PENDING row with no consent date, and the account is
--     STILL LOCKED while it is pending — asserted three ways: the definer helper
--     says no active consent, the publish gate still raises the guardian
--     message, and the sharing-approval RPC cannot find an active row.
--  3. The deprecated 0017 name creates a PENDING row too, so it is not a bypass.
--  4. THE CAPABILITY. Wrong token, unknown account, another account's token and
--     a token that never existed all raise the SAME message as each other — the
--     strings are compared byte-for-byte, not pattern-matched — and nothing
--     changes.
--  5. The correct token activates, as ANON (no session at all), one-shot: a
--     second confirm with the same token fails and changes nothing.
--  6. Confirm alone does not unlock publishing (scenario 4 needs the separate
--     sharing approval), and with that approval the minor publishes.
--  7. Revoking through the 0017 capability, login-less, RE-LOCKS the account
--     and deletes nothing (scenario 9). A wrong token on revoke is refused and
--     leaks nothing.
--  8. The partial unique index: one open row per account, while finalized rows
--     stay unconstrained.
--
-- Assertions that read contract tables directly run under role postgres
-- (deny-by-default; RLS is the client gate). Role switches use
-- `select set_config(...)` (bare calls are not valid top-level statements), and
-- every fixture is deleted as postgres — a claimless `authenticated` role sees
-- zero rows, so a `= 0` tidy-up assertion run as a client would pass vacuously.
--
-- ⚠ Read the ERROR count, not the PASS count. psql does not stop on error, so an
-- assertion that dies on `permission denied` disappears from the output while the
-- run still prints a green FAIL tally. Two POST-CONDITION checks did exactly that
-- for a while and the suite reported 66/0. The real check is:
--
--   docker exec -i supabase_db_cemurm psql -U postgres -d postgres -q \
--     < scripts/smoke/0031-guardian-consent-email.sql 2>&1 \
--     | grep -c ERROR        -- must be 0
--
-- and, to catch an assertion that never fires at all, compare the number of
-- emitted `[PASS]` notices against the number of call sites. Both counts are 68.
--
-- expects 68 PASS / 0 FAIL, and 0 psql ERROR lines
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

-- 0031 addition: capture the raw message instead of pattern-matching it. The
-- "every failure is indistinguishable" assertion compares two of these for
-- EQUALITY, which is a stronger claim than either matching a %literal% — a
-- message that leaked a user id would still contain the literal.
create or replace function tmp_capture_error(p_sql text) returns text language plpgsql as $$
declare err text := '';
begin
  begin
    execute p_sql;
  exception when others then
    err := sqlerrm;
  end;
  return err;
end $$;

-- ══════════════ 1. MIGRATION SURFACE (postgres) ══════════════════════
select tmp_assert(
  '0031 guardian_consents.status DEFAULT is now pending (D4 replaced 0017 default active)',
  (select column_default like '%''pending''%'
     from information_schema.columns
    where table_schema = 'public' and table_name = 'guardian_consents'
      and column_name = 'status')
);

select tmp_assert(
  '0031 consented_at is nullable — a pending row has no consent date to record',
  (select is_nullable = 'YES'
     from information_schema.columns
    where table_schema = 'public' and table_name = 'guardian_consents'
      and column_name = 'consented_at')
);

-- The state machine is enforced by the database, not by convention: a typo'd
-- status would otherwise mint a row that no gate can see.
select tmp_assert(
  '0031 the status vocabulary is CHECK-constrained to the four known states',
  exists (select 1 from pg_constraint
           where conrelid = 'public.guardian_consents'::regclass
             and contype = 'c'
             and pg_get_constraintdef(oid) like '%pending%'
             and pg_get_constraintdef(oid) like '%archived%')
);

-- 0017 line 100 admitted one 'active' row per account. The replacement has to
-- cover BOTH open states, and it has to have replaced it rather than joined it.
select tmp_assert(
  '0031 guardian_consents_one_active is gone',
  (select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'guardian_consents_one_active') = 0
);

select tmp_assert(
  '0031 guardian_consents_one_open is UNIQUE and covers pending AND active',
  exists (select 1 from pg_index i
            join pg_class c on c.oid = i.indexrelid
           where c.relname = 'guardian_consents_one_open'
             and i.indisunique
             and pg_get_expr(i.indpred, i.indrelid) like '%pending%'
             and pg_get_expr(i.indpred, i.indrelid) like '%active%')
);

select tmp_assert(
  '0031 both write entry points exist (private core + public wrapper each)',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname in ('request_guardian_consent', 'request_guardian_consent_core',
                        'confirm_guardian_consent_by_token', 'confirm_guardian_consent_core')) = 4
);

-- ⚠ THE GRANT SURFACE. confirm is the app's only login-less mutation and is
-- deliberately anon-reachable; its CORE is granted to nobody, and the request
-- path is not reachable at all without a session.
select tmp_assert(
  '0031 the anon-granted confirm wrapper is executable by anon and by a client',
  has_function_privilege('anon', 'public.confirm_guardian_consent_by_token(uuid,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.confirm_guardian_consent_by_token(uuid,uuid)', 'EXECUTE')
);

select tmp_assert(
  '0031 the confirm CORE is executable by nobody outside the owner (wrapper only)',
  not has_function_privilege('anon', 'private.confirm_guardian_consent_core(uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.confirm_guardian_consent_core(uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('public', 'private.confirm_guardian_consent_core(uuid,uuid)', 'EXECUTE')
);

select tmp_assert(
  '0031 the request path is NOT reachable by anon (authenticated only)',
  not has_function_privilege('anon', 'public.request_guardian_consent(uuid,text,text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'private.request_guardian_consent_core(uuid,text,text,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.request_guardian_consent(uuid,text,text,text)', 'EXECUTE')
);

-- D5: the Resend key is in Vault, reachable by the Edge Function's own
-- service_role and by nothing else. The Edge Function is a PostgREST client
-- like any other and PostgREST only serves `public` here, so the key reader
-- needs a thin public wrapper (0031 section 4.1) — the GRANT is what protects
-- the key, so all three of PUBLIC, anon and authenticated are asserted here.
select tmp_assert(
  '0031 the Vault key reader is service_role-only (not anon, not authenticated)',
  has_function_privilege('service_role', 'private.read_resend_api_key()', 'EXECUTE')
    and not has_function_privilege('anon', 'private.read_resend_api_key()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.read_resend_api_key()', 'EXECUTE')
    and not has_function_privilege('public', 'private.read_resend_api_key()', 'EXECUTE')
);

select tmp_assert(
  '0031 the Vault PUBLIC wrapper is service_role-only too (not one call from anon)',
  has_function_privilege('service_role', 'public.read_resend_api_key()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.read_resend_api_key()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.read_resend_api_key()', 'EXECUTE')
    and not has_function_privilege('public', 'public.read_resend_api_key()', 'EXECUTE')
);

-- The wrapper is a passthrough, not a second rule set: same NULL-on-missing
-- contract the Edge Function's missing-key guard depends on. NULL here is what
-- becomes `email_not_configured`, and an exception would become a 500.
select tmp_assert(
  '0031 the key reader returns NULL (not an exception) when Vault has no secret',
  (select private.read_resend_api_key()) is null
);

select tmp_assert(
  '0031 the key reader is granted to service_role and to NO client role at all',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'read_resend_api_key'
      and n.nspname in ('public', 'private')
      and has_function_privilege('anon', p.oid, 'EXECUTE')) = 0
);

-- The write-RPC-only invariant survives: the Edge Function reads the pending row
-- with service_role, and no client role may write the table on any path.
select tmp_assert(
  '0031 guardian_consents is still write-RPC-only for anon and authenticated',
  not has_table_privilege('anon', 'public.guardian_consents', 'INSERT')
    and not has_table_privilege('anon', 'public.guardian_consents', 'UPDATE')
    and not has_table_privilege('anon', 'public.guardian_consents', 'DELETE')
    and not has_table_privilege('authenticated', 'public.guardian_consents', 'INSERT')
    and not has_table_privilege('authenticated', 'public.guardian_consents', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.guardian_consents', 'DELETE')
);

-- ══════════════ 2. FIXTURES: THREE MINOR ACCOUNTS (postgres) ══════════════
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'guardianflow@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000c01', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Guardian","lastName":"Flow","displayName":"Guardian Flow"}', now(), now()),
  ('10000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'aliasminor@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000c02', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Alias","lastName":"Minor","displayName":"Alias Minor"}', now(), now()),
  ('10000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'indexprobe@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000c03', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Index","lastName":"Probe","displayName":"Index Probe"}', now(), now())
  on conflict do nothing;

-- Two songs for …0c1, because the publish guard checks "one live entry" BEFORE
-- the minor gate (0017 lines 209-232). Re-using the first song after the revoke
-- would raise 'Song already published.' and prove nothing about re-locking.
insert into public.songs (id, title, artist, genre, created_by)
values
  ('20000000-0000-0000-0000-0000000000c1', 'Guardian Flow Probe One', 'Fixture', 'worship',
   '10000000-0000-0000-0000-0000000000c1'),
  ('20000000-0000-0000-0000-0000000000c2', 'Guardian Flow Probe Two', 'Fixture', 'worship',
   '10000000-0000-0000-0000-0000000000c1');

-- Fixture setup as postgres, NOT through the client path: these UPDATEs
-- establish the minor state the RPCs are then exercised against.
update public.profiles
   set date_of_birth = (current_date - interval '10 years')::date
 where id in ('10000000-0000-0000-0000-0000000000c1',
              '10000000-0000-0000-0000-0000000000c2',
              '10000000-0000-0000-0000-0000000000c3');

select tmp_assert(
  '0031 fixtures: three accounts exist and the trigger made all three minors',
  (select count(*) from public.profiles
    where id in ('10000000-0000-0000-0000-0000000000c1',
                 '10000000-0000-0000-0000-0000000000c2',
                 '10000000-0000-0000-0000-0000000000c3')
      and is_minor = true) = 3
);

-- ══════════════ 3. THE REQUEST OPENS A LOCKED ACCOUNT (authenticated …0c1) ══════════════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000c1","role":"authenticated"}',false);

select tmp_expect_ok(
  '0031 a known minor can request guardian consent',
  $$select public.request_guardian_consent(
      '10000000-0000-0000-0000-0000000000c1', 'Rosa Guardian', 'rosa@cemurm.app', 'v1 consent text')$$
);

-- The load-bearing assertion of the whole work unit. Before 0031 this row came
-- out 'active' and the account unlocked on the spot (0017 line 88).
select tmp_assert(
  '0031 the request created a PENDING row, not an active one',
  exists (select 1 from public.guardian_consents gc
           where gc.user_id = '10000000-0000-0000-0000-0000000000c1'
             and gc.status = 'pending')
);

select tmp_assert(
  '0031 the pending row records NO consent date (consented_at is null)',
  exists (select 1 from public.guardian_consents gc
           where gc.user_id = '10000000-0000-0000-0000-0000000000c1'
             and gc.status = 'pending'
             and gc.consented_at is null)
);

select tmp_assert(
  '0031 the pending row kept the guardian identity and the exact consent text',
  exists (select 1 from public.guardian_consents gc
           where gc.user_id = '10000000-0000-0000-0000-0000000000c1'
             and gc.guardian_name = 'Rosa Guardian'
             and gc.guardian_email = 'rosa@cemurm.app'
             and gc.consent_text = 'v1 consent text')
);

-- "STILL LOCKED" — arm 1: the same definer helper the client gate and the
-- publish guard read says there is no active consent.
select tmp_assert(
  '0031 LOCKED while pending: guardian_consent_active() is false',
  not private.guardian_consent_active('10000000-0000-0000-0000-0000000000c1')
);

-- "STILL LOCKED" — arm 2, the real server-side gate: publishing is still
-- refused with the guardian message, not the dob message.
select tmp_expect_error(
  '0031 LOCKED while pending: publish still raises the guardian-approval gate',
  $$select public.publish_song_to_library(
      '20000000-0000-0000-0000-0000000000c1', 'CC-BY-4.0', true, null)$$,
  '%Guardian approval required for public sharing%'
);

-- "STILL LOCKED" — arm 3: the sharing-approval RPC cannot even find a row,
-- because it matches on status = 'active' (0017 line 340).
select tmp_expect_error(
  '0031 LOCKED while pending: public-sharing approval is refused (no active row)',
  $$select public.approve_guardian_public_sharing('10000000-0000-0000-0000-0000000000c1')$$,
  '%Consent not found or not active.%'
);

-- One open row per account. This is also the only brake on repeated requests,
-- so a minor cannot turn a guardian's inbox into a request generator.
select tmp_expect_error(
  '0031 a second request is refused while one is already open',
  $$select public.request_guardian_consent(
      '10000000-0000-0000-0000-0000000000c1', 'Someone Else', 'else@cemurm.app', 'v1 consent text')$$,
  '%A guardian consent request is already open for this account.%'
);

-- The request is only real if it can be delivered, so the row is validated
-- server-side rather than in the form. These three run as …0c2, because the
-- self-only guard above them would otherwise answer first.
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000c2","role":"authenticated"}',false);

select tmp_expect_error(
  '0031 a blank guardian name is rejected',
  $$select public.request_guardian_consent(
      '10000000-0000-0000-0000-0000000000c2', '   ', 'rosa2@cemurm.app', 'v1 consent text')$$,
  '%Guardian name is required.%'
);

select tmp_expect_error(
  '0031 a malformed guardian email is rejected (the channel the design depends on)',
  $$select public.request_guardian_consent(
      '10000000-0000-0000-0000-0000000000c2', 'Rosa Two', 'not-an-email', 'v1 consent text')$$,
  '%Enter a valid guardian email address.%'
);

select tmp_expect_error(
  '0031 empty consent text is rejected (scenario 3 evidence must not be blank)',
  $$select public.request_guardian_consent(
      '10000000-0000-0000-0000-0000000000c2', 'Rosa Two', 'rosa2@cemurm.app', '  ')$$,
  '%Consent text is required.%'
);

-- No session: the same wording as the BDD lock screen (scenario 2).
select set_config('request.jwt.claims','',false);

select tmp_expect_error(
  '0031 the request RPC refuses a caller with no session',
  $$select public.request_guardian_consent(
      '10000000-0000-0000-0000-0000000000c1', 'Rosa Guardian', 'rosa@cemurm.app', 'v1 consent text')$$,
  '%Guardian consent required.%'
);

-- The three rejections created nothing (post-conditions, not just exceptions).
select set_config('role','postgres',false);

-- THE CAPTURED TOKEN. Every guardian call below runs as `anon`, which cannot read
-- guardian_consents at all — so the capability has to be resolved HERE, as the
-- owner, and substituted as a literal by psql (`\gset` / `:'name'`). That is the
-- point of the whole design: the token is the only thing the guardian's request
-- carries, and this suite holds it the way an email link would.
select revocation_token as guardian_token
  from public.guardian_consents
 where user_id = '10000000-0000-0000-0000-0000000000c1'
   and status = 'pending'
\gset

select tmp_assert(
  '0031 POST-CONDITION: the three rejections created no consent row for …0c2',
  (select count(*) from public.guardian_consents
    where user_id = '10000000-0000-0000-0000-0000000000c2') = 0
);

select tmp_assert(
  '0031 POST-CONDITION: …0c1 still has exactly ONE row, still pending',
  (select count(*) from public.guardian_consents
    where user_id = '10000000-0000-0000-0000-0000000000c1') = 1
    and (select count(*) from public.guardian_consents
          where user_id = '10000000-0000-0000-0000-0000000000c1'
            and status = 'pending') = 1
);

-- ══════════════ 4. THE DEPRECATED 0017 NAME IS NOT A BYPASS (…0c2) ══════════════════════
-- public.record_guardian_consent kept its Hito 4 signature so the 0029
-- regression smoke and pre-0031 client bundles keep working. It delegates to
-- the same core, so it MUST create a pending row like every other request.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000c2","role":"authenticated"}',false);

select tmp_expect_ok(
  '0031 the deprecated record_guardian_consent alias still works',
  $$select public.record_guardian_consent(
      '10000000-0000-0000-0000-0000000000c2', 'Alias Guardian', 'alias@cemurm.app', 'v1 consent text')$$
);

select set_config('role','postgres',false);

select tmp_assert(
  '0031 the deprecated alias created a PENDING row — it is not a self-assertion path',
  exists (select 1 from public.guardian_consents gc
           where gc.user_id = '10000000-0000-0000-0000-0000000000c2'
             and gc.status = 'pending'
             and gc.consented_at is null)
);

select tmp_assert(
  '0031 the alias left …0c2 locked too',
  not private.guardian_consent_active('10000000-0000-0000-0000-0000000000c2')
);

-- ══════════════ 5. THE CAPABILITY: EVERY FAILURE IS INDISTINGUISHABLE (anon) ══════════════════════
-- The guardian is not logged in and never will be, so the RPC is granted to
-- anon. That makes it reachable by anyone, and the ONLY thing standing between a
-- stranger and a confirmed consent is the 128-bit token. The four arms below must
-- therefore be indistinguishable — compared for EQUALITY, not by substring — or
-- the endpoint becomes a token oracle.
select set_config('role','anon',false);
select set_config('request.jwt.claims','',false);

-- (a) the right account, a wrong token.
select tmp_expect_error(
  '0031 a wrong token is refused (correct account, wrong capability)',
  $$select public.confirm_guardian_consent_by_token(
      '10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ff')$$,
  '%Consent not found or already finalized.%'
);

-- ⚠ HOW THE TOKEN REACHES THESE CALLS. The guardian calls below run as `anon`,
-- which cannot read guardian_consents at all, so the capability has to be
-- substituted as a LITERAL by psql (section 3 captured it with `\gset`). psql
-- does NOT interpolate `:'var'` inside a dollar-quoted string — verified
-- against psql 17.6 — so every arm that needs the token builds its statement
-- with format('%L', …) instead. A dollar-quoted `$$ … :'guardian_token' … $$`
-- would hand a uuid parameter the literal text `:'guardian_token'`, and the
-- failure that produces (invalid input syntax) is NOT the message under test.

-- (b) the real token, against an account that does not (…0c9 is never a
--     fixture — no auth.users row, no profiles row).
select tmp_expect_error(
  '0031 another account''s token is refused (wrong account, correct capability)',
  format('select public.confirm_guardian_consent_by_token(%L, %L)',
         '10000000-0000-0000-0000-0000000000c9', :'guardian_token'),
  '%Consent not found or already finalized.%'
);

-- (c) a token that never existed anywhere.
select tmp_assert(
  '0031 an account with NO consent row refuses confirm with the same message',
  (select tmp_capture_error($q$select public.confirm_guardian_consent_by_token(
        '10000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000fe')$q$)
   = 'Consent not found or already finalized.')
);

-- THE assertion that makes the others mean something: arms (a) and (b) return
-- the SAME string. A message that named the account, the email or the status
-- would still match every %literal% above.
select tmp_assert(
  '0031 a wrong token and an unknown account are byte-identical (no token oracle)',
  (select tmp_capture_error($q$select public.confirm_guardian_consent_by_token(
        '10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ff')$q$)
   = tmp_capture_error(
       format('select public.confirm_guardian_consent_by_token(%L, %L)',
              '10000000-0000-0000-0000-0000000000c9', :'guardian_token')))
);

-- (d) a non-minor cannot be confirmed into an ACTIVE consent, and the refusal is
--     the same message — the minor→adult archive (0017 lines 53-57) owns that
--     transition, not this endpoint. The fixture is set up as the owner, because
--     `anon` may write neither table.
select set_config('role','postgres',false);
insert into public.guardian_consents (user_id, guardian_name, guardian_email, consent_text)
values ('10000000-0000-0000-0000-0000000000c3', 'A Guardian', 'c3@cemurm.app', 'v1 consent text');
update public.profiles set date_of_birth = date '2002-10-10'
 where id = '10000000-0000-0000-0000-0000000000c3';
select revocation_token as grown_token
  from public.guardian_consents
 where user_id = '10000000-0000-0000-0000-0000000000c3'
\gset
select set_config('role','anon',false);

select tmp_assert(
  '0031 a request that outlived the 18th birthday cannot be activated',
  (select tmp_capture_error(
      format('select public.confirm_guardian_consent_by_token(%L, %L)',
             '10000000-0000-0000-0000-0000000000c3', :'grown_token'))
   = 'Consent not found or already finalized.')
);

-- The two post-conditions below read the ledger directly, so they need a role
-- that may read it. `anon` may not (`0017` revokes all and grants select only to
-- `authenticated` under self-select RLS), and psql does not stop on error — so
-- running them as `anon` made them die with `permission denied` and continue,
-- which reported 66 PASS / 0 FAIL while these two never executed. Verified
-- caught by counting `[PASS]` notices against call sites, not by reading the
-- summary. They assert the state the rejected attempts left behind, so `postgres`
-- is the honest role; the client path is what the arms above exercise.
select set_config('role','postgres',false);

select tmp_assert(
  '0031 POST-CONDITION: the grown-up account''s request is still pending, not active',
  (select count(*) from public.guardian_consents
    where user_id = '10000000-0000-0000-0000-0000000000c3'
      and status = 'pending'
      and consented_at is null) = 1
);

-- Every rejected attempt changed nothing.
select tmp_assert(
  '0031 POST-CONDITION: no rejected confirm changed a single row',
  (select count(*) from public.guardian_consents where status = 'active'
    and user_id in ('10000000-0000-0000-0000-0000000000c1',
                    '10000000-0000-0000-0000-0000000000c2')) = 0
  and (select count(*) from public.guardian_consents
        where user_id in ('10000000-0000-0000-0000-0000000000c1',
                          '10000000-0000-0000-0000-0000000000c2')
          and status = 'pending') = 2
);

select set_config('role','anon',false);

-- ══════════════ 6. THE CORRECT TOKEN ACTIVATES — login-less (anon) ══════════════════════
-- Nothing differs from section 5's failures except the 128-bit token: still role
-- `anon`, still no JWT. psql substituted the literal the owner resolved in
-- section 3, exactly as the emailed link carries it.
select tmp_expect_ok(
  '0031 the correct token activates the consent with NO session at all',
  format('select public.confirm_guardian_consent_by_token(%L, %L)',
         '10000000-0000-0000-0000-0000000000c1', :'guardian_token')
);

-- The row is read back as the owner: `anon` has no SELECT on guardian_consents,
-- which is the whole reason the token had to be substituted rather than looked up.
select set_config('role','postgres',false);

select tmp_assert(
  '0031 the confirmed row is ACTIVE and now carries the consent date',
  exists (select 1 from public.guardian_consents gc
           where gc.user_id = '10000000-0000-0000-0000-0000000000c1'
             and gc.status = 'active'
             and gc.consented_at is not null)
);

select tmp_assert(
  '0031 guardian_consent_active() is now true — the client gate would release the account',
  private.guardian_consent_active('10000000-0000-0000-0000-0000000000c1')
);

-- The ledger invariant 0031 exists to create: a consent date is a record of
-- something that happened, so no row may carry one while not being active.
select tmp_assert(
  '0031 no ledger row carries a consent date without being active',
  (select count(*) from public.guardian_consents
    where consented_at is not null and status <> 'active') = 0
);

-- One-shot. The link is spent the moment it is clicked, or the capability would
-- be replayable for the whole life of the consent. Same anon caller, same token.
select set_config('role','anon',false);
select set_config('request.jwt.claims','',false);

select tmp_expect_error(
  '0031 a second confirm with the same token is refused (one-shot capability)',
  format('select public.confirm_guardian_consent_by_token(%L, %L)',
         '10000000-0000-0000-0000-0000000000c1', :'guardian_token'),
  '%Consent not found or already finalized.%'
);

-- Scenario 4 is a SEPARATE approval: confirming participation does not by
-- itself authorize publishing. This one needs the minor's own session —
-- publish_song_to_library is an authenticated entry point (0029/0017), so the
-- guardian's login-less context cannot even reach it.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000c1","role":"authenticated"}',false);

select tmp_expect_error(
  '0031 consent confirmed but public sharing is STILL blocked without the sharing approval',
  $$select public.publish_song_to_library(
      '20000000-0000-0000-0000-0000000000c1', 'CC-BY-4.0', true, null)$$,
  '%Guardian approval required for public sharing%'
);

-- The sharing approval now finds the active row (the same account, back in the
-- minor's own session — the guardian is still not signed in anywhere).
select tmp_expect_ok(
  '0031 the minor can now record the public-sharing approval',
  $$select public.approve_guardian_public_sharing('10000000-0000-0000-0000-0000000000c1')$$
);

select tmp_expect_ok(
  '0031 with consent active AND sharing approved, the minor publishes (positive control)',
  $$select public.publish_song_to_library(
      '20000000-0000-0000-0000-0000000000c1', 'CC-BY-4.0', true, null)$$
);

select set_config('role','postgres',false);

select tmp_assert(
  '0031 the published song is live under the minor''s own contribution',
  exists (select 1 from public.public_songs ps
           where ps.song_id = '20000000-0000-0000-0000-0000000000c1'
             and ps.contributor_id = '10000000-0000-0000-0000-0000000000c1'
             and ps.status = 'live')
);

-- ══════════════ 7. REVOKE RE-LOCKS — the 0017 capability, reused (anon) ══════════════════════
-- WU4 does not add a second revocation path: it calls the login-less
-- revoke_guardian_consent 0017 lines 361-417 already ships. 0031 only had to
-- make sure the confirm path did not weaken it.
select set_config('role','anon',false);
select set_config('request.jwt.claims','',false);

select tmp_expect_error(
  '0031 revoke with a wrong token is refused and leaks nothing',
  format('select public.revoke_guardian_consent(%L, %L, %L)',
         '10000000-0000-0000-0000-0000000000c1', 'rosa@cemurm.app',
         '00000000-0000-0000-0000-0000000000ff'),
  '%Consent not found or already finalized.%'
);

-- The failed revoke must have changed nothing. Read as the owner, for the same
-- reason the confirm read-back did.
select set_config('role','postgres',false);

select tmp_assert(
  '0031 POST-CONDITION: the wrong-token revoke left the consent ACTIVE',
  exists (select 1 from public.guardian_consents gc
           where gc.user_id = '10000000-0000-0000-0000-0000000000c1'
             and gc.status = 'active')
);

select set_config('role','anon',false);
select set_config('request.jwt.claims','',false);

select tmp_expect_ok(
  '0031 the guardian revokes with the full capability, still with no session',
  format('select public.revoke_guardian_consent(%L, %L, %L)',
         '10000000-0000-0000-0000-0000000000c1', 'rosa@cemurm.app',
         :'guardian_token')
);

select set_config('role','postgres',false);

select tmp_assert(
  '0031 the revoked row is still there — revocation never deletes data (scenario 9)',
  exists (select 1 from public.guardian_consents gc
           where gc.user_id = '10000000-0000-0000-0000-0000000000c1'
             and gc.status = 'revoked'
             and gc.revoked_at is not null
             and gc.consent_text = 'v1 consent text')
);

select tmp_assert(
  '0031 RE-LOCKED: guardian_consent_active() is false again after the revoke',
  not private.guardian_consent_active('10000000-0000-0000-0000-0000000000c1')
);

-- The second song, so the one-live-entry check cannot pre-empt the minor gate,
-- and the minor's own session, because that is the only context that can call
-- publish at all.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-0000000000c1","role":"authenticated"}',false);

select tmp_expect_error(
  '0031 RE-LOCKED: publishing is blocked again with the guardian message',
  $$select public.publish_song_to_library(
      '20000000-0000-0000-0000-0000000000c2', 'CC-BY-4.0', true, null)$$,
  '%Guardian approval required for public sharing%'
);

-- A finalized row does not block a fresh request, so the account can be
-- re-supervised after a revocation — and the ledger keeps both records.
select tmp_expect_ok(
  '0031 a revoked account may request consent again',
  $$select public.request_guardian_consent(
      '10000000-0000-0000-0000-0000000000c1', 'Rosa Guardian', 'rosa@cemurm.app', 'v1 consent text')$$
);

select set_config('role','postgres',false);

select tmp_assert(
  '0031 POST-CONDITION: the ledger now holds the revoked record AND the new pending one',
  (select count(*) from public.guardian_consents
    where user_id = '10000000-0000-0000-0000-0000000000c1') = 2
  and (select count(*) from public.guardian_consents
        where user_id = '10000000-0000-0000-0000-0000000000c1' and status = 'revoked') = 1
  and (select count(*) from public.guardian_consents
        where user_id = '10000000-0000-0000-0000-0000000000c1' and status = 'pending') = 1
);

-- The fresh request is pending, so it carries no consent date even though the
-- ledger now holds an ACTIVE-then-revoked record for the same account.
select tmp_assert(
  '0031 POST-CONDITION: the re-request is pending and re-locks the account again',
  (select count(*) from public.guardian_consents
    where user_id = '10000000-0000-0000-0000-0000000000c1'
      and status = 'pending'
      and consented_at is null) = 1
  and not private.guardian_consent_active('10000000-0000-0000-0000-0000000000c1')
);

-- ══════════════ 8. THE PARTIAL UNIQUE INDEX (postgres) ══════════════════════
-- Proved by attempting the writes the index exists to stop, as the table owner
-- — i.e. bypassing every RPC. Finalized rows must stay unconstrained.
select set_config('role','postgres',false);

select tmp_expect_error(
  '0031 INDEX: a second PENDING row for one account is rejected',
  $$insert into public.guardian_consents
      (user_id, guardian_name, guardian_email, consent_text, status)
    values ('10000000-0000-0000-0000-0000000000c3', 'A', 'a@cemurm.app', 't', 'pending'),
           ('10000000-0000-0000-0000-0000000000c3', 'B', 'b@cemurm.app', 't', 'pending')$$,
  '%guardian_consents_one_open%'
);

select tmp_expect_error(
  '0031 INDEX: a PENDING row next to an ACTIVE one is rejected',
  $$insert into public.guardian_consents
      (user_id, guardian_name, guardian_email, consent_text, status)
    values ('10000000-0000-0000-0000-0000000000c3', 'A', 'a@cemurm.app', 't', 'pending'),
           ('10000000-0000-0000-0000-0000000000c3', 'B', 'b@cemurm.app', 't', 'active')$$,
  '%guardian_consents_one_open%'
);

select tmp_expect_error(
  '0031 INDEX: two ACTIVE rows for one account are still rejected (0017 behaviour kept)',
  $$insert into public.guardian_consents
      (user_id, guardian_name, guardian_email, consent_text, status)
    values ('10000000-0000-0000-0000-0000000000c3', 'A', 'a@cemurm.app', 't', 'active'),
           ('10000000-0000-0000-0000-0000000000c3', 'B', 'b@cemurm.app', 't', 'active')$$,
  '%guardian_consents_one_open%'
);

select tmp_expect_error(
  '0031 the status CHECK rejects an unknown state (no orphan rows in the ledger)',
  $$insert into public.guardian_consents
      (user_id, guardian_name, guardian_email, consent_text, status)
    values ('10000000-0000-0000-0000-0000000000c3', 'A', 'a@cemurm.app', 't', 'approved')$$,
  '%guardian_consents_status_known%'
);

-- The contrast that makes the index assertion honest: finalized rows are NOT
-- constrained, so the ledger can keep every historical record.
select tmp_expect_ok(
  '0031 INDEX: two REVOKED rows for one account are allowed (the ledger keeps growing)',
  $$insert into public.guardian_consents
      (user_id, guardian_name, guardian_email, consent_text, status)
    values ('10000000-0000-0000-0000-0000000000c3', 'A', 'a@cemurm.app', 't', 'revoked'),
           ('10000000-0000-0000-0000-0000000000c3', 'B', 'b@cemurm.app', 't', 'archived')$$
);

-- Every rejected insert above rolled back with its statement, so the probe
-- account still holds exactly the two finalized rows this section inserted plus
-- the ONE pending row section 5 left behind — nothing else.
select tmp_assert(
  '0031 POST-CONDITION: the rejected inserts left only the two finalized rows',
  (select count(*) from public.guardian_consents
    where user_id = '10000000-0000-0000-0000-0000000000c3'
      and status in ('revoked', 'archived')) = 2
  and (select count(*) from public.guardian_consents
        where user_id = '10000000-0000-0000-0000-0000000000c3'
          and status = 'pending') = 1
);

-- ══════════════ 9. CLEANUP (postgres) ══════════════════════
-- profiles, songs, public_songs and guardian_consents all cascade from
-- auth.users. Contract-table reads and deletes run as the owner, never as a
-- claimless client role, whose `= 0` would be a vacuous pass.
delete from public.songs where id in (
  '20000000-0000-0000-0000-0000000000c1',
  '20000000-0000-0000-0000-0000000000c2'
);
delete from auth.users where id in (
  '10000000-0000-0000-0000-0000000000c1',
  '10000000-0000-0000-0000-0000000000c2',
  '10000000-0000-0000-0000-0000000000c3'
);

select tmp_assert(
  '0031 fixture tidy: no profiles row survives',
  (select count(*) from public.profiles
     where id in ('10000000-0000-0000-0000-0000000000c1',
                  '10000000-0000-0000-0000-0000000000c2',
                  '10000000-0000-0000-0000-0000000000c3')) = 0
);

select tmp_assert(
  '0031 fixture tidy: no guardian_consents row survives (no orphan ledger entries)',
  (select count(*) from public.guardian_consents
     where user_id in ('10000000-0000-0000-0000-0000000000c1',
                       '10000000-0000-0000-0000-0000000000c2',
                       '10000000-0000-0000-0000-0000000000c3')) = 0
);

select tmp_assert(
  '0031 fixture tidy: no song or public_songs row survives',
  (select count(*) from public.songs
     where id in ('20000000-0000-0000-0000-0000000000c1',
                  '20000000-0000-0000-0000-0000000000c2')) = 0
  and (select count(*) from public.public_songs
         where song_id in ('20000000-0000-0000-0000-0000000000c1',
                           '20000000-0000-0000-0000-0000000000c2')) = 0
);

-- ══════════════ 10. POST-CLEANUP INVARIANTS (postgres) ══════════════════════
-- The base the 0029/0030 suites depend on: the grandfather backfill and the
-- seed's own dates must both still be in force after this suite has run.
select tmp_assert(
  '0031 base intact after cleanup: still zero NULL date_of_birth',
  (select count(*) from public.profiles where date_of_birth is null) = 0
);

select tmp_assert(
  '0031 base intact after cleanup: the three seeded demo profiles are adults',
  (select count(*) from public.profiles
    where id in ('10000000-0000-0000-0000-000000000001',
                 '10000000-0000-0000-0000-000000000002',
                 '10000000-0000-0000-0000-000000000003')
      and date_of_birth = date '2002-10-10'
      and is_minor = false) = 3
);

reset role;
