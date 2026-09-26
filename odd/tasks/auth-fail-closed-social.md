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

### WU1 — Close the server-side hole (migration `0029`) — **done** (`9f63656`)
- [x] T1.1 `supabase/migrations/0029_fail_closed_minors.sql` — `private.profile_dob_known()` + `private.profile_not_verified_adult()`; `profiles_select_search` recreated to exclude unknown as well as minors; publish guard gained a second branch for unknown-dob sessions; `record_guardian_consent` / `approve_guardian_public_sharing` deliberately left on the known-minor predicate.
- [x] T1.2 Backfill existing accounts to `2002-10-10`.
- [x] T1.3 `scripts/smoke/0029-fail-closed-minors.sql` — assert the three states (minor / adult / unknown) resolve correctly for search visibility and the publish guard; assert the backfill result.
- [x] T1.4 Re-verify the 10 scenarios in `features/minors-and-guardian-consent.feature` still hold against the new behaviour; update the doc's scenario-6 wording if "unknown is also excluded" needs stating.

**Acceptance:** a session whose `date_of_birth` is NULL cannot appear in `profiles_select_search` and cannot publish; an adult with dob set can do both; a minor still requires consent. Smoke script reports `[PASS]` for each assertion.

### WU2 — Fail-closed profile step (app) — **done**
- [x] T2.1 Migration **`0030_date_of_birth_step.sql`** (not 0029 — that file is now frozen history). Revokes 0017's `update (date_of_birth)` grant and routes every write through `public.set_date_of_birth()`. Adds `public.my_age_status()` because the client cannot SELECT either age column.
- [x] T2.2 `src/lib/minors.js` — `getAgeStatus()`, `setDateOfBirth()`; seven new messages registered in the existing `USER_ERRORS` set.
- [x] T2.3 `src/components/auth/AuthGuards.jsx` — three-way branch. `user.isMinor` is no longer consulted anywhere.
- [x] T2.4 `src/pages/DateOfBirthRequired.jsx` — Tailwind-only, matches `GuardianConsentRequired`.
- [x] T2.5 `scripts/smoke/0030-date-of-birth-step.sql` — 38 assertions.
- [x] T2.6 Repaired `scripts/smoke/0029-fail-closed-minors.sql` (see Progress).

**The no-escalation rule — why the RPC is not a blind upsert.** A minor may correct their date to another minor date, and an adult may fix a typo in an adult date, but **a minor can never re-declare themselves as an adult**. Without this the RPC would be exactly the bypass its own section removes: the trigger recomputes `is_minor` from the date just written, and 0017 lines 53–57 would archive the active guardian consent on the way out. Self-approval by "correcting" your birthday once, and the audit trail of supervision deleted by the same act. Adult→minor is deliberately *not* blocked: it only ever adds restrictions. The comparison reuses 0017's exact `current_date - interval '18 years'` formula rather than a second one — two formulas would eventually disagree about who is a minor, and the loser would be the security check.

**Acceptance:** a fresh account (OAuth or email) cannot reach `/songs` until a dob is set; setting it as an adult unlocks immediately; setting it as a minor routes to the guardian consent screen. **Met** — `AuthGuards.jsx:104` (`return <Outlet />`) is reachable only when `readFailed === false && age.dobKnown === true`, so neither an unknown dob nor a failed read can fall through.

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
- 2026-09-26 — **WU1 done**, commit `9f63656`. Migration `0029_fail_closed_minors.sql` + `scripts/smoke/0029-fail-closed-minors.sql` (19 assertions). Two new definer helpers (`profile_dob_known`, `profile_not_verified_adult`); `profiles_select_search` recreated to exclude unknown; `private.publish_song_to_library` recreated with one added branch (unknown-dob ⇒ `'Complete your date of birth before publishing.'`) and nothing else changed. The consent RPCs were deliberately left on the known-minor predicate. Backfill to `2002-10-10` applied.
- 2026-09-26 — **WU1's RDD review could not run and is still open.** `gentle-ai review assess` returned `high` (signal `auth`), START created lineage `review-45fda52164e79125` in state `reviewing` with 4 lenses, but the collect step has no transport for this runtime: `review capture-result --materialize --agent opencode` refuses with `the active runtime is not eligible for immutable receipt review; supported immutable review runtimes: claude-code, codex`, and `review opencode-transport` returns `immutable_review_transport_unsupported`. Installed build 3.7.0 (stable) advertises `contract v1` / protocol 1.5 and omits `capture-result` and `acknowledge-approved` from its operation list, though it accepts `--contract=…/v2` for start/status. The user chose to continue without reporting. The lineage is preserved, not closable in this build; `review abandon` needs maintainer authorization with an eight-line binding, so it was not run. **WU1's verification of record is the writer's foreground run plus the parent spot check, not the review.**
- 2026-09-26 — **WU2 done.** Migration `0030_date_of_birth_step.sql` + `scripts/smoke/0030-date-of-birth-step.sql` (38 assertions) + `src/lib/minors.js` + `src/components/auth/AuthGuards.jsx` + `src/pages/DateOfBirthRequired.jsx`. The direct `update (date_of_birth)` grant is revoked — verified over PostgREST HTTP as well as in psql (`42501 permission denied for table profiles`).
- 2026-09-26 — **Repaired `scripts/smoke/0029-fail-closed-minors.sql`.** WU2's revoke broke it: its section 2 seeded the minor and adult fixtures with a direct `update … set date_of_birth` executed as `authenticated` (4 assertions failed, including a misleading publish-gate failure that was really a cascading fixture failure). Those two UPDATEs now run as `postgres` — they set up test state, they are not the client write path, and 0030's smoke is what asserts the client path. The section header had already said `(postgres)`; the two `set_config('role','authenticated')` lines were wrong from the start. **Lesson recorded:** any smoke assertion that counts rows *through RLS* can pass vacuously — 0030's own first draft reported `[PASS]` on a tidy-up check while its fixtures were still in the table, because a claimless `authenticated` role sees zero rows and `= 0` was trivially true.
- 2026-09-26 — Behaviour change worth remembering: an account that declared itself a minor at signup under Hito 4 (`user_metadata.isMinor = true`) but whose `date_of_birth` says adult now takes the `<Outlet />` branch. That is the intended D1 consequence — the metadata hint stops deciding — but it is visible.

## Verification

- `pnpm lint` — zero warnings (the only automated gate this project has).
- `docker exec -i supabase_db_cemurm psql -U postgres -d postgres < scripts/smoke/0029-fail-closed-minors.sql` → **19 PASS / 0 FAIL** (re-run by the parent after the repair).
- `docker exec -i supabase_db_cemurm psql -U postgres -d postgres < scripts/smoke/0030-date-of-birth-step.sql` → **38 PASS / 0 FAIL** (re-run by the parent).
- Both smokes were confirmed to be able to fail: re-applying 0017's column grant turns 0030's suite to 35 PASS / 3 FAIL and the direct write demonstrably succeeds, and restoring 0030 returns 38/0 with byte-identical state snapshots.
- No test framework, no typecheck, no CI. Do not claim otherwise.
- Known pre-existing defect, unrelated to this work and not fixed here: `supabase/migrations/0018_service_planning.sql:344` and `0019_rehearsal_workflow.sql:184` both `create function private.display_name_for(uuid)` without `or replace`, so a clean `supabase db reset` can never get past 0019. Any local verification had to apply migrations by hand. This blocks reproducible setup and deserves its own work unit.

## Next step

WU3 — social signup: `supabase/config.toml` `[auth.external.*]`, `signInWithOAuth` in `src/lib/auth.js`, social buttons in `src/pages/Auth.jsx`. OAuth accounts must land on WU2's date-of-birth step, which is now the only thing standing between a Google sign-in and the app.
