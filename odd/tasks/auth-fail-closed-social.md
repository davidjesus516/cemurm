# Auth — Fail-closed minors + social signup + guardian email — task doc

**Feature:** `features/minors-and-guardian-consent.feature` (10 scenarios) + `features/user-onboarding.feature:27` + `features/authentication-and-profiles.feature`
**Branch:** `feat/auth-fail-closed-social` from `main` (8b66394) — worktree `../cemurm-worktrees/auth-fail-closed`
**Migration:** next is **0029**. Smoke: `scripts/smoke/0029-fail-closed-minors.sql`.
**Delivery:** compliance first → OAuth → email. Un work unit = un commit.

---

## Problem

The minors system is shipped (Hito 4, migration `0017`) but **its server-side enforcement has never actually run**. Two independent defects:

1. **`is_minor` is client-owned.** `src/lib/auth.js:71` writes `user_metadata.isMinor` inside `signUp()`, and only there. `mapUser()` (`auth.js:32`) reads it back. With any other entry path, `isMinor` is always `false`. In GoTrue `user_metadata` is user-updatable via `updateUser()` and **no migration guards `raw_user_meta_data`** (grep across `supabase/migrations/` returns zero hits) — so the user can flip their own minor flag.

2. **`date_of_birth` has no writer.** Migration `0017:51` computes
   `is_minor := new.date_of_birth is not null and new.date_of_birth > (current_date - interval '18 years')`
   and `0017:71` grants `update (date_of_birth) to authenticated` — but grep across `src/` finds **no write of `date_of_birth` anywhere**, only comments. So `is_minor` is permanently `false` in the database, `private.session_is_minor()` is permanently `false`, and every RLS guard in `0017` is dead code.

Net effect: the only thing that has ever locked a minor account is a client-side boolean the account holder controls.

**Why now:** the user chose social signup (Google/GitHub) as the primary registration path. Adding OAuth before fixing this opens a **second** bypass of the same gate, on a path where `ageDeclaration` does not even exist.

---

## Decisions (2026-09-26, all user-confirmed)

| # | Decision |
|---|---|
| D1 | `profiles.date_of_birth` is the **single source of truth** for minor status. `user_metadata.isMinor` stops deciding (kept only as a UX hint; not removed in this work). |
| D2 | **Fail-closed.** `date_of_birth IS NULL` ⇒ account locked for **every** user, OAuth and email alike. Unknown ≠ adult. |
| D3 | The **minor owns the account**, including via OAuth. The guardian channel is email: the existing 128-bit `revocation_token` is really delivered. |
| D4 | Consent is created **`pending`**; the account stays locked until the guardian clicks the email. This replaces `0017`'s `status 'active' by default`. |
| D5 | Email is sent from a **Supabase Edge Function** (Deno/TS) with the Resend API key in Supabase Vault — never in the repo, never in the bundle. |
| D6 | Order: **WU1+WU2 → WU3 → WU4**. Compliance before OAuth. |

**Grandfather:** existing accounts are backfilled with `date_of_birth = 2002-10-10` (age 23 ⇒ adult, consistent with the backfill intent). User-confirmed: existing accounts are demo accounts for testing features. Accepted risk: a pre-existing minor account is treated as adult forever.

---

## Verified facts (2026-09-26, this worktree)

- `0017:126-129` — `private.profile_is_minor(uuid)` returns
  `coalesce((select p.is_minor from public.profiles p where p.id = p_user_id), false)` — **fail-open**: unknown and adult are indistinguishable.
- `0017:131-134` — `private.session_is_minor()` = `auth.uid() is not null and profile_is_minor(auth.uid())`.
- `0017:136-142` — `private.guardian_consent_active(uuid)` = exists a `guardian_consents` row with `status = 'active'`.
- `0017:160-163` — `profiles_select_search` policy: `using (auth.uid() is not null and not private.profile_is_minor(id))`. This is the public-surface exclusion (scenario 6). Recreating it to be fail-closed also excludes **unknown** rows from search — intended.
- `0017:227-232` — publish guard inside `private.publish_song_to_library`:
  `if private.session_is_minor() and not exists (… status='active' and public_sharing_approved) then raise 'Guardian approval required for public sharing'`.
- `0017:259-313` — `record_guardian_consent` (private core + public wrapper). Line 284: `if not private.session_is_minor() then raise 'Consent is only required for minors.'` — so making the helper fail-closed would make an unknown-dob user "a minor" and wrongly force consent. **The consent-required check must stay on the known-minor predicate, not the fail-closed one.**
- `0017:318-351` — `approve_guardian_public_sharing` (same `session_is_minor()` guard at line 332).
- `0017:361-417` — `revoke_guardian_consent`: login-less capability (guardian_email + revocation_token), flips ACTIVE → revoked, notifies org admins via `public.notify_user`. Granted to `anon, authenticated`.
- `0017:48-66` — `private.set_profile_minor_flag()` trigger, `SECURITY DEFINER`, `search_path = ''`, revoked from `public, anon, authenticated`. Only writer of `is_minor`. Archives ACTIVE consents on minor→adult.
- `0017:81-100` — `guardian_consents`: `status` text, `revocation_token uuid default gen_random_uuid()`, partial unique index `guardian_consents_one_active on (user_id) where status = 'active'`, `revoke all … from anon, authenticated`, then `grant select` only (self-select RLS at `0017:114-119`). No client writes.
- `0017:41-42` — `profiles.date_of_birth date` (nullable), `profiles.is_minor boolean not null default false`. Neither is client-selectable.
- `src/components/auth/AuthGuards.jsx:25-63` — `RequireGuardianConsent` reads `user?.isMinor === true`; non-minors hit `return <Outlet />` at line 42; minors read `getConsentStatus` and need `status === 'active'`.
- `src/App.jsx:41-46` — `RequireAuth` wraps `RequireGuardianConsent` wraps every authed route.
- `src/lib/minors.js` — `getConsentStatus` (self-select, `order created_at desc limit 1`), `recordConsent` (RPC), `approvePublicSharing` (RPC). `USER_ERRORS` set at `minors.js:18` holds `'Consent not found or not active.'`.
- `src/pages/GuardianConsentRequired.jsx` — `CONSENT_STATEMENT` hardcoded in **first-person parent voice** (line 15-16), button "I give consent" (line 147), and line 152 promises *"the link emailed at signup"* that nothing sends.
- No `api/`, no `functions/`, no `vercel.json`, no Edge Functions exist. The only `service_role` key on disk is the local demo one under `supabase/.temp/`. **The app is 100% client-only.**
- `docs/technical-spec.md:550` defers Resend ("cuando se necesiten emails de producto propios (… invitaciones de banda)"); `docs/technical-spec.md:326` already recommends "TypeScript via Supabase Edge Functions" as the intended backend.
- Smoke-test convention: `scripts/smoke/00NN-*.sql`, one per migration from 0023 onward.
- `supabase/config.toml` has **no** `[auth.external.google]` / `[auth.external.github]`, commented or otherwise. `enable_signup = true`, `enable_confirmations = false` (lines 220, 225).

---

## Constraints

- pnpm only; lockfile is `pnpm-lock.yaml`. Tailwind only. JSX not TSX. No test framework, no typecheck, no CI — **the only automated check is `pnpm lint` (zero warnings) plus the SQL smoke script run by hand**.
- `prop-types` is never installed; `useAuth.jsx` uses `/* eslint-disable react/prop-types */`. Any new component rendering props follows the same convention.
- Migration conventions from `0002`/`0012`/`0017`: `SECURITY DEFINER` + `set search_path = ''` + fully-qualified refs for definer cores; thin public wrapper; `revoke … from public, anon` then `grant` per role; comment header mapping the change to BDD scenarios.
- Never grant a client write the RPC path can own. `guardian_consents` stays write-RPC-only.

---

## Work units

### WU1 — Close the server-side hole (migration `0029`) — **next**
- [ ] T1.1 `supabase/migrations/0029_fail_closed_minors.sql` — add `private.profile_dob_known(uuid)`; add `private.profile_not_verified_adult(uuid)` = `dob is null or is_minor`; recreate `profiles_select_search` to exclude **unknown** as well as minors; tighten the publish guard so an unknown-dob session is blocked from public sharing; **leave** `record_guardian_consent` / `approve_guardian_public_sharing` on the known-minor predicate so an unknown-dob user is never pushed into the consent flow.
- [ ] T1.2 Backfill existing accounts: `date_of_birth = 2002-10-10` where null, so the grandfathered base is verifiably adult.
- [ ] T1.3 `scripts/smoke/0029-fail-closed-minors.sql` — assert the three states (minor / adult / unknown) resolve correctly for search visibility and the publish guard; assert the backfill result.
- [ ] T1.4 Re-verify the 10 scenarios in `features/minors-and-guardian-consent.feature` still hold against the new behaviour; update the doc's scenario-6 wording if "unknown is also excluded" needs stating.

**Acceptance:** a session whose `date_of_birth` is NULL cannot appear in `profiles_select_search` and cannot publish; an adult with dob set can do both; a minor still requires consent. Smoke script reports `[PASS]` for each assertion.

### WU2 — Fail-closed profile step (app)
- [ ] T2.1 RPC `set_date_of_birth` in `0029` (or a follow-up) so the client never writes the column directly.
- [ ] T2.2 `src/lib/minors.js` — client for the new RPC, added to `USER_ERRORS` as needed.
- [ ] T2.3 `src/components/auth/AuthGuards.jsx` — when dob is unknown, render a date-of-birth step instead of `<Outlet />`; keep the existing locked screen for known minors without active consent.
- [ ] T2.4 New page for the dob step, Tailwind-only, matching `GuardianConsentRequired` conventions.

**Acceptance:** a fresh account (OAuth or email) cannot reach `/songs` until a dob is set; setting it as an adult unlocks immediately; setting it as a minor routes to the guardian consent screen.

### WU3 — Social signup
- [ ] T3.1 `supabase/config.toml` — enable `[auth.external.google]` and `[auth.external.github]`.
- [ ] T3.2 `src/lib/auth.js` — `signInWithOAuth` + the callback path.
- [ ] T3.3 `src/pages/Auth.jsx` — social buttons; OAuth accounts land on the WU2 dob step.
- [ ] T3.4 Update `docs/product-brief.md:56`, `docs/mvp-scope.md:90,100,305`, `docs/ux-spec.md:181` — they still call OAuth pending.

**Acceptance:** a Google sign-in creates a usable account that still passes through the dob step.

### WU4 — Guardian consent by email
- [ ] T4.1 `guardian_consents` gains a `pending` state; `guardian_consents_one_active` index logic revisited so pending rows don't collide.
- [ ] T4.2 `request_guardian_consent` (creates pending) + `confirm_guardian_consent_by_token` (pending → active, login-less).
- [ ] T4.3 Edge Function holding the Resend key in Vault; sends the confirm + revoke link.
- [ ] T4.4 Public routes `/guardian/confirm` and `/guardian/revoke`.
- [ ] T4.5 Update `docs/technical-spec.md:550` — Resend is no longer deferred.

**Acceptance:** a minor account stays locked until the guardian clicks; the link works without a login; revoking locks it again.

---

## Progress

- 2026-09-26 — Plan agreed, worktree + branch created from `main` (8b66394). WU1 not started.

## Verification

- `pnpm lint` — zero warnings (the only automated gate this project has).
- `psql … < scripts/smoke/0029-fail-closed-minors.sql` — run by hand against the local stack; expected counts in the script header.
- No test framework, no typecheck, no CI. Do not claim otherwise.

## Next step

WU1 / T1.1 — author `supabase/migrations/0029_fail_closed_minors.sql`.
