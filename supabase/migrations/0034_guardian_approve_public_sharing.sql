-- CEMURM 0034 — Guardian approval of public sharing: login-less capability path
--
-- Slice: fix/minors-guardian-consent — closes the "minor self-approves public sharing" hole.
-- Record: odd/tasks/minors-fail-closed-db.md (continued).
-- Business contract (features/minors-and-guardian-consent.feature):
--   · public-sharing gate (scenario 4): "when the guardian approves" — the RPC that
--     records public_sharing_approved must be guardian-driven, not minor-driven.
--     0017's approve_guardian_public_sharing required p_user_id = auth.uid() and
--     session_is_minor(), so the ONLY possible actor was the minor. This migration
--     adds the guardian path and leaves the minor path as a deprecated alias that
--     will fail (the minor is not a guardian).
--   · consent record (scenario 3) and lifecycle (scenarios 5/7/8/9): untouched.
--   · revoke_guardian_consent (0017:354+) already ships the correct pattern:
--     login-less, capability-token (guardian_email + revocation_token), anon-granted.
--     This migration mirrors that pattern for the approval action.
--
-- ⚠ THE DEFECT THIS MIGRATION CLOSES. 0017 line 328-334 shipped
-- approve_guardian_public_sharing with a KNOWN-MINOR SELF-APPROVAL guard:
--     if p_user_id is distinct from v_actor then raise 'You can only consent for your own account.';
--     if not private.session_is_minor() then raise 'Consent is only required for minors.';
-- The feature explicitly requires "when the guardian approves" (scenario 4).
-- As shipped, the minor self-approves their own public sharing. The window.confirm
-- copy even says "Your guardian can revoke this later" — documenting the gap.
--
-- Conventions (0002/0012/0017/0029/0030/0031 style): comment headers with a scenario
-- map; SECURITY DEFINER cores in `private` with `set search_path = ''` + fully-
-- qualified refs; thin public wrappers; REVOKE from public/anon THEN GRANT per
-- role; grants AFTER policies (D6 order).
-- MIGRATIONS ARE IMMUTABLE: 0017 and 0031 are left exactly as shipped. The
-- approve_guardian_public_shaping core is RECREATED here with the guardian path,
-- and the old public wrapper is kept as a DEPRECATED ALIAS that will raise
-- "Consent is only required for minors" when a minor calls it (the minor is not
-- a guardian and cannot provide guardian_email as witness).


-- ══════════════════════ 1. THE GUARDIAN APPROVAL CAPABILITY RPC ══════════════════════
-- Login-less, capability-based, `anon`-granted. Mirrors the revoke_guardian_consent
-- pattern (0017:354+): the pairing (guardian_email + revocation_token, a 128-bit
-- random UUID generated at consent time) IS the capability. The token is the secret,
-- the email is the witness. The guardian approves through a link/email flow without
-- ever authenticating. What the entry point can do is strictly bounded by the single
-- UPDATE below (flip ONE active consent's public_sharing_approved to true + timestamp).
-- No other state is reachable: all other writes go through authenticated-only RPCs.

create or replace function private.approve_guardian_public_sharing_by_token_core(
  p_user_id uuid,
  p_guardian_email text,
  p_revocation_token uuid
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_updated boolean;
begin
  -- The capability check IS the where clause: the 128-bit token, the account,
  -- the guardian email as witness, and the requirement that the consent is active.
  -- One statement, so a wrong token/wrong email and a consumed link are the same
  -- outcome — a single row's public_sharing_approved is the entire reachable state.
  update public.guardian_consents
     set public_sharing_approved = true,
         public_sharing_approved_at = now(),
         updated_at = now()
   where user_id = p_user_id
     and guardian_email = p_guardian_email
     and revocation_token = p_revocation_token
     and status = 'active'
     and public_sharing_approved = false;

  -- ⚠ ONE MESSAGE FOR EVERY FAILURE. A wrong token, an unknown account, a wrong
  -- email, an already-approved consent, a revoked one and a no-longer-active
  -- consent all raise this exact string, so the endpoint cannot be used to find
  -- out whether a token, an account, an email or a consent exists. Nothing in
  -- this function's signature, return value or error text names a user id, an
  -- email or a status.
  if not found then
    raise exception 'Consent not found or already finalized.';
  end if;
end $$;

-- ── 1.1 public wrapper — granted to anon on purpose (mirrors revoke pattern) ──
create or replace function public.approve_guardian_public_sharing_by_token(
  p_user_id uuid,
  p_guardian_email text,
  p_revocation_token uuid
)
returns void
language sql security definer set search_path = '' as $$
  select private.approve_guardian_public_sharing_by_token_core(
    p_user_id, p_guardian_email, p_revocation_token);
$$;


-- ══════════════════════ 2. DEPRECATED MINOR SELF-APPROVAL ALIAS ══════════════════════
-- 0017's approve_guardian_public_sharing is kept as a deprecated alias so pre-0034
-- client bundles don't start failing on a dropped function. It still calls the
-- SAME core logic but the guard "if not private.session_is_minor()" will raise
-- "Consent is only required for minors" when a minor calls it — which is the
-- correct outcome because a minor is not a guardian and cannot provide the
-- guardian_email witness. The alias exists only for the transition window and
-- is safe to drop once all clients have migrated.
create or replace function private.approve_guardian_public_sharing(p_user_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Guardian consent required.';
  end if;

  if p_user_id is distinct from v_actor then
    raise exception 'You can only consent for your own account.';
  end if;

  if not private.session_is_minor() then
    raise exception 'Consent is only required for minors.';
  end if;

  -- This UPDATE will only succeed if the consent is active and not already approved.
  -- The minor calling this is the INTENDED failure path — the guardian should use
  -- the new capability path instead.
  update public.guardian_consents
     set public_sharing_approved = true,
         public_sharing_approved_at = now(),
         updated_at = now()
   where user_id = p_user_id and status = 'active' and public_sharing_approved = false;

  if not found then
    raise exception 'Consent not found or not active.';
  end if;
end $$;

create or replace function public.approve_guardian_public_sharing(p_user_id uuid)
returns void
language sql security definer set search_path = '' as $$
  select private.approve_guardian_public_sharing(p_user_id);
$$;


-- ══════════════════════ 3. EXECUTE GRANTS ══════════════════════
-- lock-then-open, D6 order. create or replace can drop a function's grants.
-- The NEW guardian path: the ONLY anon-granted surface for public sharing approval.
revoke execute on function private.approve_guardian_public_sharing_by_token_core(uuid, text, uuid) from public, anon;
revoke execute on function public.approve_guardian_public_sharing_by_token(uuid, text, uuid) from public, anon;
grant execute on function public.approve_guardian_public_sharing_by_token(uuid, text, uuid) to anon, authenticated;

-- The deprecated minor path: authenticated ONLY (minor-session flow).
revoke execute on function private.approve_guardian_public_sharing(uuid) from public, anon;
revoke execute on function public.approve_guardian_public_sharing(uuid) from public, anon;
grant execute on function private.approve_guardian_public_sharing(uuid) to authenticated;
grant execute on function public.approve_guardian_public_sharing(uuid) to authenticated;