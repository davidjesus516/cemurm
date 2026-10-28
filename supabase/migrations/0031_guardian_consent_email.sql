-- CEMURM 0031 — Guardian consent by email: the 'pending' state, the two
-- token-based RPCs, and the Vault-backed Resend key
--
-- Slice: feat/guardian-consent-db — the consent state machine and its evidence.
-- Record: odd/tasks/minors-fail-closed-db.md.
-- Business contract (features/minors-and-guardian-consent.feature):
--  · signup age gate (scenario 1): UNCHANGED. A declared minor date still
--    routes the account into the consent flow (0030), and an adult is still
--    released by the same step. Nothing here reads or writes the age fact.
--  · account activation (scenario 2) — THE DEFECT THIS MIGRATION CLOSES.
--    0017 line 88 shipped `status text not null default 'active'` and the
--    consent RPC inserted without a status, so consent was SELF-ASSERTED: the
--    account holder typed a guardian's name into their own form and the row
--    came out 'active', which unlocked the account on the spot. Nothing ever
--    asked a guardian. D4 replaces that default with 'pending', so a request
--    opens a locked account and only the guardian can close it (scenario 5).
--  · consent record (scenario 3): the ledger keeps the guardian's identity and
--    the exact consent text they saw. `consented_at` becomes NULLABLE and is
--    written only by the confirm path — a pending row that already carried a
--    consent date would be a record of something that never happened, and this
--    table is supervision evidence.
--  · lifecycle (scenarios 5/7/8/9): confirm is the login-less sibling of the
--    revoke capability 0017 lines 361-417 already shipped; revocation is NOT
--    reimplemented here, it is reused. Revoking still never deletes (scenario 9)
--    and the minor→adult archive (0017 lines 53-57) is untouched, so turning 18
--    still ends the archive (scenario 8).
--  · public-sharing gate (scenario 4) and public-surface exclusion
--    (scenario 6): NOT recreated. 0029 owns them and this migration changes
--    nothing about what they do — a 'pending' row simply does not satisfy the
--    `status = 'active'` test they already read, which is the point.
--
-- ⚠ THE NEW PUBLIC SURFACE. `public.confirm_guardian_consent_by_token` is
-- granted to `anon` on purpose: a guardian must be able to act from an email
-- link with no account. That makes it the app's first unauthenticated,
-- state-mutating endpoint reachable by anyone on the internet, and every rule
-- below exists to keep it inert without the token:
--   · the 128-bit `revocation_token` IS the capability; there is no other input;
--   · EVERY failure raises the same message, so a wrong token, an unknown user,
--     an already-confirmed consent and a no-longer-minor account are
--     indistinguishable to the caller. No user id, email or status ever leaves
--     the function — not in the message, not in the return value;
--   · the whole effect is one UPDATE of one row's status, and only
--     'pending' → 'active'.
--
-- Conventions (0002/0012/0017/0029/0030 style): comment headers with a scenario
-- map; SECURITY DEFINER cores in `private` with `set search_path = ''` +
-- fully-qualified refs; thin public wrappers (0017 lines 304-313); REVOKE from
-- public/anon THEN GRANT per role; grants AFTER policies (D6 order).
-- MIGRATIONS ARE IMMUTABLE: 0017, 0029 and 0030 are left exactly as shipped.
-- The 'active' default and the one-active index are REMOVED here by altering
-- the table, never by editing the historical migration.


-- ══════════════════════ 1. THE 'pending' STATE ══════════════════════
-- Status is now a four-value state machine with an explicit vocabulary. The
-- check constraint is what stops a future typo from minting a row that is
-- neither pending, active, revoked nor archived — an orphan status would be
-- invisible to every gate and would read as "not consented" forever, which is
-- at least fail-closed, but it would also be invisible in the ledger.
alter table public.guardian_consents
  add constraint guardian_consents_status_known
  check (status in ('pending', 'active', 'revoked', 'archived'));

-- The D4 default. Fail-closed at the schema level: an insert that forgets to
-- state a status can no longer produce an unlocked account.
alter table public.guardian_consents alter column status set default 'pending';

-- scenario 3's "the date" is the date the consent was GIVEN. There is no such
-- date before the guardian clicks, so the column becomes nullable AND loses its
-- default: `not null default now()` would keep stamping a request with a
-- consent date, which is the same false record in a different place. The confirm
-- path (section 3) is the only writer from here on.
alter table public.guardian_consents alter column consented_at drop not null;
alter table public.guardian_consents alter column consented_at drop default;

-- The partial unique index, revisited. 0017 line 100 admitted one 'active' row
-- per user, which left the new state unguarded: two 'pending' rows would put two
-- approval emails in one guardian's inbox for the same decision, and a 'pending'
-- row sitting next to an 'active' one would make "is this account supervised?"
-- answerable two ways. The index now covers every OPEN row, so at most one
-- request-or-approval exists at a time; finalized rows (revoked/archived) stay
-- unconstrained so the ledger keeps growing.
drop index if exists public.guardian_consents_one_active;
create unique index guardian_consents_one_open
  on public.guardian_consents (user_id)
  where status in ('pending', 'active');


-- ══════════════════════ 2. request_guardian_consent — OPENS THE REQUEST ══════════════════════
-- The minor's own half of the flow, and the only client entry point that can
-- create a consent row. What it creates is a REQUEST, not a consent.
create or replace function private.request_guardian_consent_core(
  p_user_id uuid,
  p_guardian_name text,
  p_guardian_email text,
  p_consent_text text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_consent_id uuid;
begin
  -- initPlan guard (0002 line 130 shape), reusing the BDD lock-screen wording
  -- (scenario 2) so the client shows the same screen for a logged-out caller.
  if v_actor is null then
    raise exception 'Guardian consent required.';
  end if;

  -- self-only: consent is a personal record; you cannot request one for
  -- someone else.
  if p_user_id is distinct from v_actor then
    raise exception 'You can only consent for your own account.';
  end if;

  -- ⚠ KNOWN-minor predicate on purpose (0029 section 6 keeps it that way): an
  -- unknown date of birth is held at the dob step, and testing the fail-closed
  -- predicate here would push an adult onto the guardian screen and ask a
  -- stranger to consent for them.
  if not private.session_is_minor() then
    raise exception 'Consent is only required for minors.';
  end if;

  -- The request is only real if it can be delivered and read back, so the row
  -- is validated here rather than in the form: the guardian's address is the
  -- channel the whole design depends on (D3), and `consent_text` is the
  -- evidence the record is required to keep (scenario 3). btrim/coalesce so a
  -- NULL or all-whitespace value is rejected rather than stored.
  if btrim(coalesce(p_guardian_name, '')) = '' then
    raise exception 'Guardian name is required.';
  end if;

  if btrim(coalesce(p_guardian_email, ''))
       !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid guardian email address.';
  end if;

  if btrim(coalesce(p_consent_text, '')) = '' then
    raise exception 'Consent text is required.';
  end if;

  -- One OPEN row per account (the friendly half of guardian_consents_one_open;
  -- the index is the race-proof backstop). This is also the only brake on
  -- repeated requests, so a minor cannot turn a guardian's inbox into a
  -- request generator by submitting the form again and again.
  if exists (
    select 1 from public.guardian_consents gc
    where gc.user_id = p_user_id
      and gc.status in ('pending', 'active')
  ) then
    raise exception 'A guardian consent request is already open for this account.';
  end if;

  -- 'pending' is written EXPLICITLY even though section 1 made it the default.
  -- The ledger's most important field should not depend on a default that a
  -- later migration can change.
  insert into public.guardian_consents
    (user_id, guardian_name, guardian_email, consent_text, status)
  values
    (p_user_id, btrim(p_guardian_name), btrim(p_guardian_email), p_consent_text, 'pending')
  returning id into v_consent_id;

  -- Return the row id. The revocation_token is deliberately NOT returned: the
  -- Edge Function reads it server-side (service_role) to build the guardian's
  -- link, so the secret never crosses the client boundary.
  return v_consent_id;
end $$;

-- ── 2.1 public wrapper — the client entry point (0017 lines 304-313 pattern) ──
create or replace function public.request_guardian_consent(
  p_user_id uuid,
  p_guardian_name text,
  p_guardian_email text,
  p_consent_text text
)
returns uuid
language sql security definer set search_path = '' as $$
  select private.request_guardian_consent_core(
    p_user_id, p_guardian_name, p_guardian_email, p_consent_text);
$$;

-- ── 2.2 the Hito 4 name, kept as a DEPRECATED ALIAS ──────────────────────
-- 0017 shipped `record_guardian_consent` with the same four parameters, and
-- `record` is now a lie: it opens a request. The name is kept because the 0029
-- regression smoke calls it, and because a client bundle built before this
-- migration would otherwise start failing on a dropped function. It is a
-- one-line passthrough to the SAME core, so there is exactly one rule set and
-- one state transition here — an alias, not a second path, and it creates a
-- 'pending' row like every other request. Safe to drop once the 0029 smoke is
-- retired; 0031's smoke asserts it cannot diverge.
create or replace function private.record_guardian_consent(
  p_user_id uuid,
  p_guardian_name text,
  p_guardian_email text,
  p_consent_text text
)
returns uuid
language sql security definer set search_path = '' as $$
  select private.request_guardian_consent_core(
    p_user_id, p_guardian_name, p_guardian_email, p_consent_text);
$$;

create or replace function public.record_guardian_consent(
  p_user_id uuid,
  p_guardian_name text,
  p_guardian_email text,
  p_consent_text text
)
returns uuid
language sql security definer set search_path = '' as $$
  select private.request_guardian_consent_core(
    p_user_id, p_guardian_name, p_guardian_email, p_consent_text);
$$;


-- ══════════════════════ 3. confirm_guardian_consent_by_token — THE GUARDIAN ══════════════════════
-- Login-less, capability-based, `anon`-granted. Same shape as the revoke entry
-- point 0017 lines 361-417 already ships, and the same pairing of a secret
-- token with the account it belongs to — so the two guardian links a parent
-- receives read the same way and are handled the same way. What this one can do
-- is strictly bounded by the single UPDATE below: flip ONE 'pending' row to
-- 'active'. Nothing else is reachable — every other write goes through an
-- authenticated-only RPC or through guardian_consents having no client grants.
create or replace function private.confirm_guardian_consent_core(
  p_user_id uuid,
  p_revocation_token uuid
)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- The account must still be a KNOWN minor. A request that outlived the
  -- account holder's 18th birthday must not be activatable: the minor→adult
  -- archive (0017 lines 53-57) is what owns that transition, and re-activating
  -- here would hand an adult a consent record the trigger had already decided
  -- the state of. Refused with the SAME message as a bad token — see below.
  if not private.profile_is_minor(p_user_id) then
    raise exception 'Consent not found or already finalized.';
  end if;

  -- The capability check IS the where clause: the 128-bit token, the account,
  -- and the requirement that the request is still open. One statement, so a
  -- wrong token and a consumed link are the same outcome — a single row's
  -- status is the entire reachable state space.
  update public.guardian_consents
     set status = 'active',
         consented_at = now(),
         updated_at = now()
   where user_id = p_user_id
     and revocation_token = p_revocation_token
     and status = 'pending';

  -- ⚠ ONE MESSAGE FOR EVERY FAILURE. A wrong token, an unknown account, an
  -- already-confirmed consent, a revoked one and a no-longer-minor account all
  -- raise this exact string, so the endpoint cannot be used to find out whether
  -- a token, an account or a consent exists. Nothing in this function's
  -- signature, return value or error text names a user id, an email or a
  -- status.
  if not found then
    raise exception 'Consent not found or already finalized.';
  end if;
end $$;

-- ── 3.1 public wrapper — granted to anon on purpose (see the header) ──
create or replace function public.confirm_guardian_consent_by_token(
  p_user_id uuid,
  p_revocation_token uuid
)
returns void
language sql security definer set search_path = '' as $$
  select private.confirm_guardian_consent_core(p_user_id, p_revocation_token);
$$;


-- ══════════════════════ 4. THE RESEND KEY — VAULT, service_role ONLY ══════════════════════
-- D5: the key lives in Supabase Vault. Never in the repo (supabase/config.toml
-- is TRACKED, so a literal secret there is a leak) and never in the client
-- bundle (a VITE_ variable is shipped to every browser). The Edge Function reads
-- it through this function with the service_role key.
--
-- The operator creates the secret by hand, exactly once per environment:
--   select vault.create_secret('re_…', 'resend_api_key', 'Guardian email sender');
-- It is NOT seeded by this migration: a secret belongs to an environment, not to
-- a repository.
--
-- Returns NULL when the secret does not exist. That is deliberate — a missing
-- key is a configuration state the caller turns into a typed, non-leaking
-- `email_not_configured` answer, not a stack trace.
create or replace function private.read_resend_api_key()
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_key text;
begin
  -- order by created_at so a re-created secret name resolves to the newest one
  -- instead of whichever row the planner happens to return first.
  select s.decrypted_secret into v_key
    from vault.decrypted_secrets s
   where s.name = 'resend_api_key'
   order by s.created_at desc
   limit 1;
  return v_key;
end $$;

-- ── 4.1 public wrapper — service_role ONLY (0012/0017 pattern, NOT an oversight)
-- The Edge Function is a PostgREST client like any other, and PostgREST only
-- serves the `public` schema here (verified: PGRST202 for every `private.*`
-- function). The alternatives were both worse:
--   · exposing the `private` schema — 48 of its 54 functions are already
--     EXECUTE-granted to `authenticated` (0012/0017/0030 all grant their cores
--     to the client), so that one config line would publish 48 new endpoints
--     instead of one;
--   · no wrapper at all — impossible: the function could not be called.
-- So the key reader gets the same core + thin wrapper shape as every other
-- entry point in this schema, and the PROTECTION is the grant below, not the
-- wrapper's absence. `anon` and `authenticated` hold no key and get
-- `permission denied for function read_resend_api_key`; 0031's smoke asserts
-- that on all three of PUBLIC, anon and authenticated. The key is one
-- PostgREST call away from `anon` in exactly the same way every other
-- SECURITY DEFINER core is — which is to say, it is not.
create or replace function public.read_resend_api_key()
returns text
language sql security definer set search_path = '' as $$
  select private.read_resend_api_key();
$$;


-- ══════════════════════ 5. EXECUTE GRANTS (0017/0030 mirror) ══════════════════════
-- lock-then-open, D6 order. `create or replace` can drop a function's grants,
-- so 0017's grants on record_guardian_consent are re-declared here.
--
-- request / the deprecated alias: MINOR-session flows → authenticated ONLY. No
-- grant on anon, so a signed-out caller cannot even reach the core.
revoke execute on function private.request_guardian_consent_core(uuid, text, text, text) from public, anon;
revoke execute on function public.request_guardian_consent(uuid, text, text, text) from public, anon;
grant execute on function private.request_guardian_consent_core(uuid, text, text, text) to authenticated;
grant execute on function public.request_guardian_consent(uuid, text, text, text) to authenticated;

revoke execute on function private.record_guardian_consent(uuid, text, text, text) from public, anon;
revoke execute on function public.record_guardian_consent(uuid, text, text, text) from public, anon;
grant execute on function private.record_guardian_consent(uuid, text, text, text) to authenticated;
grant execute on function public.record_guardian_consent(uuid, text, text, text) to authenticated;

-- confirm: the ONLY new anon-granted surface, and the only entry point whose
-- core is granted to NOBODY — the wrapper is SECURITY DEFINER, so it does not
-- need execute on the core, and nothing outside this migration can reach the
-- rules directly.
revoke execute on function private.confirm_guardian_consent_core(uuid, uuid) from public, anon;
revoke execute on function public.confirm_guardian_consent_by_token(uuid, uuid) from public, anon;
grant execute on function public.confirm_guardian_consent_by_token(uuid, uuid) to anon, authenticated;

-- the Vault reader: the core AND its public wrapper are service_role only,
-- which is the Edge Function's own key. PUBLIC is revoked explicitly because
-- the new function would otherwise inherit the platform's default PUBLIC
-- execute grant.
revoke execute on function private.read_resend_api_key() from public, anon, authenticated;
revoke execute on function public.read_resend_api_key() from public, anon, authenticated;
grant execute on function private.read_resend_api_key() to service_role;
grant execute on function public.read_resend_api_key() to service_role;
