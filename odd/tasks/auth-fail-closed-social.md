# Auth — Fail-closed minors + social signup + guardian email — task doc

**Feature:** `features/minors-and-guardian-consent.feature` (10 scenarios) + `features/user-onboarding.feature:27` + `features/authentication-and-profiles.feature`
**Branch:** `feat/auth-fail-closed-social` from `main` (8b66394) — worktree `../cemurm-worktrees/auth-fail-closed`
**Migrations:** `0029_fail_closed_minors.sql` and `0030_date_of_birth_step.sql` — both applied. Smoke: `scripts/smoke/0029-fail-closed-minors.sql`, `scripts/smoke/0030-date-of-birth-step.sql`.
**Delivery:** compliance first → OAuth → email. Un work unit = un commit.

**Delivery strategy (user-confirmed 2026-09-27): chained PRs, `stacked-to-main`.** Chosen because the running count hit 1970 authored changed lines against a ~400 budget *before* WU4 was written, and because WU1+WU2 is a verified security fix that must not sit behind two features. See [Delivery slices](#delivery-slices).

---

## Delivery slices

`stacked-to-main`: every PR merges to main in order, so each slice is independently mergeable and rollback is a single revert rather than abandoning a branch.

| PR | Commits | Content | ~Lines | State |
|----|---------|---------|--------|-------|
| 1 | `9f63656`, `e337b47`, `5b563cc`, `07829ee` | Fail-closed compliance (0029 + 0030 + the dob step) **and the two db-reset fixes that make it verifiable** | 1806 | verified from a clean reset |
| 2 | `d19a3b5` | Social sign-in: config, `signInWithOAuth`, buttons, docs | 186 | verified except the provider round-trip |
| 3 | *(pending)* | Guardian consent by email: `pending` state, two RPCs, Edge Function, `/guardian/*` routes | ~735 | not started |

The commits are already sequential on the branch, so the stack needs no rewriting of *content* — but it does need a **reorder**: `5b563cc` and `07829ee` currently sit *after* the WU3 commits, so cutting PR 1 at `e337b47` would leave the reset fixes behind. Before anything is pushed, PR 1's branch is cut at `e337b47` and the two fixes are cherry-picked onto it; the feature branch then drops them. That is branch surgery on the user's repo and push/PR creation is their decision, so it is recorded here and not performed.

Every PR merges to main in order, so each slice is independently mergeable and rollback is a single revert rather than abandoning a branch.

**PR 1 is the one that matters.** It is the only slice that closes a live compliance hole, and it is the only one that carries the two `high`-risk RDD assessments. Its review is currently blocked by the local-transport defect described in Verification, not by the code.

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
- `supabase/config.toml` had **no** `[auth.external.google]` / `[auth.external.github]`, commented or otherwise — true at planning time; WU3 added both. (`[auth.external.apple]` did exist, disabled, with `secret = "env(…)"` — the pattern WU3 followed.) `enable_signup = true`, `enable_confirmations = false` (lines 220, 225).

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

### WU3 — Social signup — **done** (`d19a3b5`)
- [x] T3.1 `supabase/config.toml` — `[auth.external.google]` and `[auth.external.github]` enabled, plus `http://localhost:5173/**` in `additional_redirect_urls`.
- [x] T3.2 `src/lib/auth.js` — `signInWithOAuth({ provider })` against a closed provider set. No callback handler by design.
- [x] T3.3 `src/pages/Auth.jsx` — social buttons + `or` divider above the email fields in both modes; `pendingProvider` state so only the pressed button narrates.
- [x] T3.4 `docs/product-brief.md:56`, `docs/mvp-scope.md:90,100,305`, `docs/ux-spec.md:181`, and a new credential-setup section in `docs/local-dev.md`.

**Two non-obvious things in this work unit.**

*`client_id` and `secret` are not the same kind of value.* `client_id` travels in the authorization URL in the clear and is safe to commit, so its placeholder is meant to be filled in. `secret` is the sensitive half and reads `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)` / `…_GITHUB_SECRET`, the same substitution `[auth.external.apple]` already used. `supabase/config.toml` is tracked, so a literal secret there would be a leak.

*`signInWithOAuth` has no callback handler, and that is not an omission.* supabase-js runs with `detectSessionInUrl` at its default and `useAuth` picks the session up on mount; hand-parsing the hash or the `code` param would duplicate the SDK and eventually disagree with it. It also resolves before the browser leaves, so there is no user to read yet.

**Acceptance:** a Google sign-in creates a usable account that still passes through the dob step. **Partially met — and the limit is stated rather than papered over.** What is proven: an `auth.users` fixture shaped like a Google signup (provider in `raw_app_meta_data`) gets its `profiles` row created by the `on_auth_user_created` trigger with no app code involved, `my_age_status()` returns `dob_known = false` for it, and `set_date_of_birth()` flips it to `true`. What is **not** proven: the provider round-trip. No Google or GitHub credential exists in this environment, so no real sign-in was performed.

### WU4 — Guardian consent by email — **done** (`6401251`, `c020a42`, `f284fdb`)
- [x] T4.1 `guardian_consents` gains a `pending` state; `guardian_consents_one_active` replaced by `guardian_consents_one_open` over `('pending','active')`, so an open request can neither collide with another nor sit beside an approval.
- [x] T4.2 `request_guardian_consent` (opens pending) + `confirm_guardian_consent_by_token` (pending → active, login-less, one-shot, one error message).
- [x] T4.3 Edge Function holding the Resend key in Vault; sends the confirm + revoke link. Shipped behind a missing-key guard — the decision the ODD flagged below, taken.
- [x] T4.4 Public routes `/guardian/confirm` and `/guardian/revoke`, outside `RequireAuth` — the second decision below, also taken.
- [x] T4.5 `docs/technical-spec.md` — Resend moved out of §11.2 into a new §11.1.bis, and §10.3 upgraded from "Recommended" to "shipped".

**Acceptance:** a minor account stays locked until the guardian clicks; the link works without a login; revoking locks it again. **Met on the database, met end to end through the function except for the last hop. A real email was never sent.**

**Four decisions this work unit forced, and why.**

*The public wrapper on the Vault reader is not a hole.* 0031's first draft had `private.read_resend_api_key` with **no** public wrapper, on the reasoning that a wrapper would put the key one PostgREST call from `anon`. That is unimplementable: the Edge Function is a PostgREST client, PostgREST serves only `public` here, and `rpc/private.read_resend_api_key` returns `PGRST202` for every caller. The alternatives were exposing the whole `private` schema — measured at **48 of its 54 functions already EXECUTE-granted to `authenticated`**, so one config line would publish 48 new endpoints rather than one — or dropping the feature. It took the repo's own 0012/0017 shape instead: thin `public.read_resend_api_key()` wrapper, granted to `service_role` only, and the smoke asserts `PUBLIC`, `anon` and `authenticated` are all refused. The protection is the grant, not the wrapper's absence. The migration comment now says so.

*psql does not interpolate variables inside dollar-quoted strings.* Verified against psql 17.6, not assumed. `$$select … :'guardian_token' …$$` hands a `uuid` parameter the literal text `:'guardian_token'` and fails with `invalid input syntax` — which is **not** the message under test, so such an arm would have "passed" for entirely the wrong reason had the wrong error been expected. Every arm needing the token builds its statement with `format('%L', …)` instead, outside any dollar quote. Three of this suite's arms were wrong this way and were passing for the wrong reason before the fix.

*The guardian link carries the email as a witness, and that is 0017's design, not a leak I added.* `revoke_guardian_consent` requires the guardian's email next to the token ("the token is the secret, the email is the witness"), and an anonymous guardian has no RLS path to read it from the ledger. So the emailed revoke link carries `&email=`. The page does **not** offer a field to type it in — a typed-in witness is a guessable one, which turns a second factor into decoration.

*Neither page auto-confirms on load.* The capability is one-shot. A mail-client link scanner, a chat preview, or a `rel=prefetch` would spend it and leave the guardian staring at a dead link with no explanation. Both pages require a real click, and `src/lib/guardianLink.js` strips the entire query string out of history in the same synchronous block that reads it — at module scope, because a `useEffect` would leave the token in the address bar through the whole first render and React 18 StrictMode double-invokes effects in development, so "read once on mount" is not reliably once.

---

## Progress

- 2026-09-26 — Plan agreed, worktree + branch created from `main` (8b66394). WU1 not started.
- 2026-09-26 — **WU1 done**, commit `9f63656`. Migration `0029_fail_closed_minors.sql` + `scripts/smoke/0029-fail-closed-minors.sql` (19 assertions). Two new definer helpers (`profile_dob_known`, `profile_not_verified_adult`); `profiles_select_search` recreated to exclude unknown; `private.publish_song_to_library` recreated with one added branch (unknown-dob ⇒ `'Complete your date of birth before publishing.'`) and nothing else changed. The consent RPCs were deliberately left on the known-minor predicate. Backfill to `2002-10-10` applied.
- 2026-09-26 — **WU1's RDD review could not run and is still open.** `gentle-ai review assess` returned `high` (signal `auth`), START created lineage `review-45fda52164e79125` in state `reviewing` with 4 lenses, but the collect step has no transport for this runtime: `review capture-result --materialize --agent opencode` refuses with `the active runtime is not eligible for immutable receipt review; supported immutable review runtimes: claude-code, codex`, and `review opencode-transport` returns `immutable_review_transport_unsupported`. Installed build 3.7.0 (stable) advertises `contract v1` / protocol 1.5 and omits `capture-result` and `acknowledge-approved` from its operation list, though it accepts `--contract=…/v2` for start/status. The user chose to continue without reporting. The lineage is preserved, not closable in this build; `review abandon` needs maintainer authorization with an eight-line binding, so it was not run. **WU1's verification of record is the writer's foreground run plus the parent spot check, not the review.**
- 2026-09-26 — **WU2 done.** Migration `0030_date_of_birth_step.sql` + `scripts/smoke/0030-date-of-birth-step.sql` (38 assertions) + `src/lib/minors.js` + `src/components/auth/AuthGuards.jsx` + `src/pages/DateOfBirthRequired.jsx`. The direct `update (date_of_birth)` grant is revoked — verified over PostgREST HTTP as well as in psql (`42501 permission denied for table profiles`).
- 2026-09-26 — **Repaired `scripts/smoke/0029-fail-closed-minors.sql`.** WU2's revoke broke it: its section 2 seeded the minor and adult fixtures with a direct `update … set date_of_birth` executed as `authenticated` (4 assertions failed, including a misleading publish-gate failure that was really a cascading fixture failure). Those two UPDATEs now run as `postgres` — they set up test state, they are not the client write path, and 0030's smoke is what asserts the client path. The section header had already said `(postgres)`; the two `set_config('role','authenticated')` lines were wrong from the start. **Lesson recorded:** any smoke assertion that counts rows *through RLS* can pass vacuously — 0030's own first draft reported `[PASS]` on a tidy-up check while its fixtures were still in the table, because a claimless `authenticated` role sees zero rows and `= 0` was trivially true.
- 2026-09-26 — Behaviour change worth remembering: an account that declared itself a minor at signup under Hito 4 (`user_metadata.isMinor = true`) but whose `date_of_birth` says adult now takes the `<Outlet />` branch. That is the intended D1 consequence — the metadata hint stops deciding — but it is visible.
- 2026-09-27 — **WU3 done**, commit `d19a3b5`. `supabase/config.toml` (`[auth.external.google]` / `[auth.external.github]` + `http://localhost:5173/**` in the redirect allowlist), `signInWithOAuth` in `src/lib/auth.js` against a closed provider set, social buttons + `or` divider in `src/pages/Auth.jsx`, four doc corrections and a new credential-setup section in `docs/local-dev.md`.
- 2026-09-27 — **WU3's RDD review was authorised, started, and is unclosable in this build.** `review assess` returned `high` (`hot_path`, signal `auth`); the v3 consent envelope was relayed and consent was granted; START created lineage `review-7f95d015fe566bd7` (`state: reviewing`, 4 lenses, correction budget 93). The lineage-bound STATUS then returned `action: collect` with 4 `reviewer_result` inputs that carry **no `provider_task`** — so there is no provider-issued reviewer prompt, and the host contract forbids assembling one from `arguments` / `artifact_subject`. `--agent opencode` refuses with `immutable_review_transport_unsupported` (`next_action: stop`); `--agent claude-code` returns `collect` with the task still absent, so the omission is not produced by the agent-eligibility check. That is the second stranded lineage of this class.
- 2026-09-27 — **Reported the WU3 occurrence to Gentle AI, on the canonical tracker.** A definitive open+closed lookup identified `Gentleman-Programming/gentle-ai#4808` ("review collect omits provider task binding") as the equivalent defect and the owner of the causal class: open, no identified fix, no linked PR, four prior occurrence comments. Added exactly one occurrence comment with observed evidence only; **no labels added, removed, or changed**. The privacy scan ran immediately before the first GitHub operation and reported clean on both the report draft and the published comment. The comment adds one diagnostic point the prior occurrences lacked: switching the negotiated agent to `claude-code` satisfies the eligibility check without restoring `provider_task`, so the refusal and the omission are separate symptoms.
- 2026-09-27 — **My own error worth remembering:** I hand-transcribed the `--target-evidence` hash out of the STATUS output into `review start` and got a character wrong. The result was `invalid_request` / "does not hash to `--target`; the token and the identity come from different negotiations". `mutation_outcome: not_started`, `retry_safe: true` — nothing was harmed, and the lesson is the one the native contract states outright: **never transcribe provider-issued tokens; extract the command from the STATUS JSON and execute it.** A 64-character sha256 is exactly the kind of string that should never be retyped by hand.
- 2026-09-27 — **Fixed the duplicated `display_name_for` (commit `5b563cc`).** `0018:344` and `0019:184` both declared it with a plain `create function`, so a clean `supabase db reset` aborted with `ERROR: function "display_name_for" already exists with same argument types` and never reached 0029. Both became `create or replace function`. The consequence was larger than the two lines: **no migration after 0019 had ever been applied by the documented path**, and a reviewer following `docs/local-dev.md` could not build a stack to verify the compliance work at all.
- 2026-09-27 — **The clean reset then exposed a second defect, and forced a correction to what I had reported (commit `07829ee`).** `supabase db reset` applies every migration *before* `supabase/seed.sql`, so 0029's backfill ran against an **empty** `profiles` table; `seed.sql` then created the three demo accounts with `date_of_birth` NULL, and the fail-closed gate locked all three at the dob step. On the clean reset the 0029 smoke was **16 PASS / 3 FAIL**, not the 19/0 I had reported — that 19/0 was only ever true on the hand-patched database. `seed.sql` now applies the same grandfather date to the three seeded profiles (production needs no change; there the accounts predate 0029, which is why 0029's own backfill is correct and stays). The lesson generalises: **an assertion count is only evidence if the database it ran against was built by the documented path.**
- 2026-09-27 — RDD assessment for the two fix commits: `medium`, `review_due: false`, `under_budget`, reason `executable_change` on a migration (no `auth` hot path, because the diff touches only 0018, 0019 and `seed.sql`). Per the ODD contract medium defers to the slice boundary, so no review was started and no third lineage was stranded.

- 2026-09-27 — **WU4 done**, commits `6401251` (migration + suites), `c020a42` (edge function + `config.toml`), `f284fdb` (routes + pages), plus this docs unit. Migration `0031_guardian_consent_email.sql` + `scripts/smoke/0031-guardian-consent-email.sql` (66 assertions) + `supabase/functions/send-guardian-consent/index.ts` + `src/lib/guardianLink.js` + `GuardianConfirm.jsx` / `GuardianRevoke.jsx` + a rewritten `GuardianConsentRequired.jsx`.
- 2026-09-27 — **The defect 0031 closes was not a missing link, it was a default.** `0017:88` shipped `status text not null default 'active'` and `record_guardian_consent` inserted without a status, so the account holder typed a guardian's name into their own form and the row came out active — the account unlocked itself, and the `consent?.status === 'active'` gate in `AuthGuards.jsx` was *correct* the whole time. The gate was reading a value the account holder could write. The default is now `'pending'`, `consented_at` is nullable and written only by the confirm path, and the one-active index became `guardian_consents_one_open` over `('pending','active')`.
- 2026-09-27 — **The vacuum trap bit three arms, not one.** `confirm_guardian_consent_by_token` raises ONE message for every failure, so an arm expecting `invalid input syntax` while the function raised the intended message would still report `[PASS]` on the wrong failure. The cause: **psql does not interpolate `:'var'` inside dollar-quoted strings** (verified on psql 17.6, not assumed). Every arm needing the token now builds its statement with `format('%L', …)` outside any dollar quote. Combined with the 0029 lesson — any assertion counting rows *through RLS* can pass vacuously — the rule generalises: on a fail-closed change, an assertion that can only reach its expected outcome by accident must be broken on purpose to prove it is load-bearing. Three deliberate breaks did that: reverting the status default to `'active'` → 61/2; dropping `status = 'pending'` from the confirm WHERE → 62/1; re-granting `request_guardian_consent` to `anon` → 62/1. Each was caught by the assertion that owns it.
- 2026-09-27 — **PostgREST here serves only `public`, which invalidated my first design, not just its documentation.** `private.read_resend_api_key` is unreachable from the Edge Function: `rpc/private.read_resend_api_key` returns `PGRST202` for every caller. The "obvious" fix — expose the schema — was measured before being rejected: **48 of `private`'s 54 functions are already EXECUTE-granted to `authenticated`**, so one config line would have published 48 new endpoints to gain one. The repo's own 0012/0017 shape applies instead: a thin `public.read_resend_api_key()` granted to `service_role` only, proven over PostgREST HTTP (`service_role` → 200 null, `anon` → 401 `42501`). **The protection is the grant, not the wrapper's absence** — the migration comment now says that instead of the opposite.
- 2026-09-27 — **Environment facts that cost time, recorded so nobody rediscovers them.** There is no `psql` binary in this environment; every smoke runs as `docker exec -i supabase_db_cemurm psql -U postgres -d postgres`. A **new** `supabase/functions/` directory, and `supabase/functions/.env`, need a full `supabase stop && supabase start` — `docker restart supabase_edge_runtime_cemurm` reuses the original container env and silently runs the function without its vars. `verify_jwt` *is* enforced by the local gateway (garbage JWT → 401 before the handler), but a request carrying only `apikey` or the anon key as bearer reaches the handler, which answers with its own typed `unauthenticated`; both layers are real and the handler guard is not redundant if the setting is ever flipped. The first `supabase db reset` of this work unit failed with "error running container: exit 1" and no error text even under `--debug`; a plain retry succeeded. Transient — do not chase it.
- 2026-09-27 — **Reproducibility, because one run of a smoke is an anecdote.** Two clean-reset full runs earlier in this work unit produced byte-identical output and an identical state fingerprint (columns, indexes, grants, row counts). The run that closes the work unit is a third, taken *after* the live Edge Function probe, because that probe left a fixture row and a Vault secret in the local database — so its numbers, not the earlier two, are the ones recorded in Verification.

## Verification

- `pnpm lint` — zero warnings (the only automated gate this project has).
- `docker exec -i supabase_db_cemurm psql -U postgres -d postgres < scripts/smoke/0029-fail-closed-minors.sql` → **19 PASS / 0 FAIL** — re-run by the parent on **2026-09-27 from a clean `supabase db reset`**. On that same clean reset *before* the `seed.sql` fix it was 16/3; the 19/0 previously recorded here was only ever true on a hand-patched database.
- `docker exec -i supabase_db_cemurm psql -U postgres -d postgres < scripts/smoke/0030-date-of-birth-step.sql` → **38 PASS / 0 FAIL**, also from the clean reset. 57/57 from scratch.
- WU4: `docker exec -i supabase_db_cemurm psql -U postgres -d postgres < scripts/smoke/0031-guardian-consent-email.sql` → **66 PASS / 0 FAIL** from a clean `supabase db reset`, with 0029 at 19/0 and 0030 at 38/0 on that same database. Those three numbers are the whole WU4 database claim: 123 assertions, 0 failures. This reset was taken *after* the live function probe, which had left a fixture row and a Vault secret behind — a reset taken before the probe would not have proved clean-tree behaviour.
- WU4's suite was confirmed able to fail, three ways, each caught by the assertion that owns it: status default reverted to `'active'` → **61/2**; `status = 'pending'` dropped from the confirm WHERE → **62/1** on "a second confirm with the same token is refused (one-shot capability)"; `request_guardian_consent` re-granted to `anon` → **62/1** on "the request path is NOT reachable by anon".
- WU4 edge function, live against the local stack, every branch: anon POST → typed **401 `unauthenticated`**; garbage JWT → gateway **`UNAUTHORIZED_INVALID_JWT_FORMAT`**; GET → **405 `method_not_allowed`**; no `SITE_URL` → **503 `app_url_not_configured`**; no Vault key → **503 `email_not_configured`**; **fake key → 502 `email_provider_failed` with Resend itself answering `401 {"statusCode":401,"name":"validation_error","message":"API key is invalid"}` in the log and not in the response**; repeat invoke → ledger still 1 row; after confirm → **200 `already_active`**; after revoke → **200 `no_open_request`**. The `service_role`-only grant on the Vault reader was proven over PostgREST HTTP, not just in psql: `service_role` → 200 null, `anon` → **401 `42501 permission denied for function read_resend_api_key`**.
- WU4 client: `src/lib/guardianLink.js` exercised in node against a window stub → **4/4** (complete confirm link scrubbed from history; revoke witness decoded and `needsEmail` reported; incomplete link scrubbed *and* refused; empty query handled). `pnpm lint` clean, `pnpm build` clean, `dist/` removed after.
- **WU4 unverified, stated plainly:** a real email was never sent. The furthest hop proven is a 502 from a deliberately invalid key. No desktop browser was attached to this session (`[browser.disconnected]`), so `GuardianConfirm`, `GuardianRevoke` and the rewritten lock screen were **never rendered in a real browser** — the token-scrubbing contract was verified in node instead, and the rendered output, the copy and the responsive layout are unproven.
- Both smokes were confirmed to be able to fail: re-applying 0017's column grant turns 0030's suite to 35 PASS / 3 FAIL and the direct write demonstrably succeeds, and restoring 0030 returns 38/0 with byte-identical state snapshots.
- No test framework, no typecheck, no CI. Do not claim otherwise.
- WU3 checks: `pnpm lint` clean · `pnpm build` clean (`dist/` removed after) · `supabase stop && supabase start` accepts the edited `config.toml`, and `GET /auth/v1/settings` then reports `google: true, github: true` · an `auth.users` fixture shaped like a Google signup (provider in `raw_app_meta_data`) gets its `profiles` row from the `on_auth_user_created` trigger with no app code, `my_age_status()` returns `dob_known = false` for it, and `set_date_of_birth()` flips it to `true`.
- **WU3 unverified, stated plainly:** the provider round-trip. No Google or GitHub credential exists in this environment, so no real sign-in was performed. The docs say "unverified end to end" rather than implying OAuth is live.
- **Both reset defects are now fixed (`5b563cc`, `07829ee`) and every number above is from a clean `supabase db reset`.** What that bought: the reset completes through 0030 and records `0030` in `supabase_migrations.schema_migrations` (the hand-applied state never did); the three seeded profiles are `2002-10-10` / `is_minor false` / usernames intact. Over PostgREST with a real `demo@cemurm.app` session, `PATCH display_name` → **204** while `PATCH date_of_birth` → **403 `42501 permission denied for table profiles`**, with `date_of_birth` still `2002-10-10` afterwards. The control write is the load-bearing part: it shows the 403 is the revoked column grant and not a blanket denial.
- RDD state: `gentle-ai review mode status` reads `on` (global). WU1 and WU3 both assessed `high` and both are stranded in the collect step of build 3.7.0 (see Progress). **Neither has a receipt, and neither should be reported as reviewed.** Verification of record for both is the writer's foreground run plus the parent spot check. The two reset fixes assessed `medium` / `review_due: false` / `under_budget` (`executable_change` on a migration, no `auth` hot path), which defers to the slice boundary per the ODD contract — so no review was started and no third lineage was stranded.
- Still unverified: a real Google/GitHub sign-in (no credential exists in this environment) and any real guardian email send. Do not claim otherwise.

## Next step

**Immediate, before anything is pushed:** perform the reorder described in [Delivery slices](#delivery-slices) — cut PR 1 at `e337b47`, cherry-pick `5b563cc` and `07829ee` onto it, then drop them from the feature branch. Nothing is pushed and no PR is opened until the user decides to, and that branch surgery belongs to that decision rather than being done silently.

Then, with WU4 shipped: the feature's last work unit is done and there is no WU5 defined. What remains before this branch is pushable is not code.

1. **The two open questions from WU4's plan were decided, and the decision is recorded rather than left to the next reader.** D5 shipped as *a missing-key guard, not a credential block* — the function is deliverable and fully testable locally and sends nothing until a key exists. The login-less `/guardian/*` routes were confirmed intended: they are the first public state-mutating surface in the app, and the mitigation is the one-shot token plus one indistinguishable error, not authentication.
2. **Two claims in this document are weaker than the rest and must not be reported as verified:** no real email has ever been sent (the furthest proven hop is a 502 from a deliberately invalid Resend key), and no guardian page has been rendered in a real browser (none was attached to the session; `guardianLink.js` was verified in node instead).
3. **The PR stack is still unsliced**, and the reorder below is the prerequisite for it.

Carried forward, no longer WU4's business: the stale 0017 comments at lines 37-38 / 68-70 (claim the app learns minor status via `user_metadata`, which D1 retired). The `GuardianConsentRequired.jsx:152` promise about an emailed link is resolved by WU4 — the link is now real.
