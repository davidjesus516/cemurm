# Minors & guardian consent — fail-closed, database-first

Work unit record for the compliance cut of the minors/guardian-consent work.
Base: `origin/main` @ `bfaf6e8`. Chain strategy: `stacked-to-main`, five slices.

## Objective

Close the three compliance holes in the Hito 4 minors system, and make guardian
consent reachable by email instead of only in-app.

The three holes, in the order this stack closes them:

1. **Unknown is treated as adult.** `0017`'s `private.profile_is_minor` coalesces
   a missing `date_of_birth` to `false`, so an account that never declared a date
   of birth is an adult for every guard that consults it. (0029)
2. **The client, not the server, decided.** `AuthGuards.jsx` gated on
   `user.isMinor` from GoTrue `user_metadata`, which the account holder can edit
   through `updateUser()`. Worse, `0017` shipped
   `grant update (date_of_birth) to authenticated` with **no** select grant on
   either age column — the client could overwrite the authoritative fact while
   being unable to read it back. On a minor→adult transition the 0017 trigger
   *archives* the account's active guardian consent, so one "correction"
   self-approves and takes the supervision audit trail with it. (0030)
3. **Consent was granted on creation.** `0017:88` declares
   `status text not null default 'active'`, so a consent row existed — and the
   account was unlocked — at the moment it was written, before any guardian saw
   anything. (0031)

## Why this shape and not the original

The first cut of this work was six PRs across a feature branch, including
social sign-in and client-side guardian routes. While it was in flight, `main`
moved 26 commits and performed the M0a module relocation, which moved every
client file the work touched:

| Original path | Current path |
| --- | --- |
| `src/App.jsx` | `src/app/router.jsx` |
| `src/lib/auth.js` | `src/data/repositories/auth.js` |
| `src/lib/minors.js` | `src/data/repositories/minors.js` |
| `src/components/auth/AuthGuards.jsx` | `src/app/providers/AuthGuards.jsx` |
| `src/pages/Auth.jsx` | `src/features/auth/pages/Auth.jsx` |
| `src/pages/GuardianConsentRequired.jsx` | `src/features/auth/pages/GuardianConsentRequired.jsx` |

The stack was re-cut database-first so it lands on the current `main` without
six orphaned files. The client re-plumb is deferred (§ Deferred). One piece of
it was unavoidable and is included: `AuthGuards.jsx` and `minors.js` are where
D1 (the server owns the age fact) is actually enforced, so a server-only stack
would have left `main` still gating on the editable flag.

`0029`–`0031` are collision-free against `main`: its highest migration is
`0028`. Only `0019_rehearsal_workflow.sql` changed on `main`, and that fix
already landed upstream, which retired the `create function` → `create or replace
function` patch this work had been carrying as `ca0fbe6`.

## Slices

| # | Branch | Tip | Commits | Lines | Files | Budget |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `fix/db-reset` | `6cc8c05` | 1 | 20 | 1 | ok |
| 2 | `fix/fail-closed-minors` | `d2806a9` | 2 | 1607 | 7 | `size:exception` |
| 3 | `feat/guardian-consent-db` | `425df2e` | 3 | 1263 | 3 | `size:exception` |
| 4 | `feat/guardian-email` | `2108af0` | 1 | 332 | 2 | ok |
| 5 | `docs/resend-guardian-consent` | (this branch's tip) | 3 | 358 | 6 | ok |

Total: 15 files, 3533 insertions, 21 deletions, 10 commits.

Slices 1–4 cite their tips because those commits are ancestors and cannot move.
Slice 5 does not cite its own: this record is inside that commit, so naming the
commit that contains the name is a loop that a single `--amend` invalidates.

Slice 5 is the Resend setup documentation (98), this record (218), and a
comment-only header correction across three migrations owned by slices 2 and 3
(30). That last part is the one blemish in the cut and it is deliberate: putting
those header fixes back into the commits that own the files needs an interactive
rebase per commit, and two of those attempts were recovered from the reflog
after losing history. A 30-line comment-only commit is cheaper than a
mis-rebased one. No file in it changes behaviour.

### `size:exception` — slices 2 and 3

Recorded, not gamed. Neither slice can be cut smaller without moving a
migration away from the evidence that proves it, and "migration first, evidence
after" is worse engineering than an oversized diff:

- Slice 2: migrations 253 + 207 lines, smokes 314 + 487, client 349. Smoke
  density is 16.5 and 12.8 lines per assertion — the evidence is not padding.
- Slice 3: migration 359, smokes 861 + a 7-line repair to slice 2's smoke, and
  the third smoke fix.

A by-concern decomposition (one PR per file) was considered and rejected: both
migrations carry numbered section headers that the smokes reference by number,
and `scripts/smoke/0031-*.sql` alone is 897 lines.

## Decisions that are load-bearing

- **D1** `profiles.date_of_birth` is the single source of truth for minor
  status. `user_metadata.isMinor` stops deciding anything.
- **D2** Fail-closed. `date_of_birth IS NULL` locks the account for everyone,
  OAuth and email alike. A *failed read* is also not an adult.
- **D3** The minor owns the account, including via OAuth. The guardian channel
  is email, through the existing 128-bit `revocation_token`.
- **D4** Consent is created `pending`; the account stays locked until the
  guardian clicks. This replaces 0017's `default 'active'`.
- **D5** Email is sent from a Supabase Edge Function (Deno/TS), with the Resend
  key in Supabase Vault behind a missing-key guard.
- **No-escalation (WU2)**: a minor may correct to another minor date, an adult
  may fix an adult-date typo, and a minor can *never* re-declare themselves as
  an adult. Adult → minor stays allowed; it only ever adds restrictions. The
  comparison reuses 0017's exact `current_date - interval '18 years'` formula
  rather than a second one, because two formulas would eventually disagree about
  who is a minor and the loser would be the security check.
- **The consent RPCs stay on the known-minor predicate.** Failing them closed on
  an unknown date of birth would let a session that has not declared one mint
  its own guardian consent row — the opposite of the intent.

## Verification of record

From a clean `supabase db reset` on this base, single run per smoke (they are
not idempotent — they commit their writes):

| Smoke | Assertions | Result | Lines/assertion |
| --- | --- | --- | --- |
| `scripts/smoke/0029-fail-closed-minors.sql` | 19 | 19 PASS / 0 FAIL | 16.5 |
| `scripts/smoke/0030-date-of-birth-step.sql` | 38 | 38 PASS / 0 FAIL | 12.8 |
| `scripts/smoke/0031-guardian-consent-email.sql` | 68 | 68 PASS / 0 FAIL | 13.2 |
| **Total** | **125** | **0 failures, 0 psql ERROR lines** | |

`pnpm lint` exit 0, `pnpm build` exit 0.

In every suite the emitted `[PASS]`/`[FAIL]` notice count equals the count of
`select tmp_assert(` / `tmp_expect_error(` / `tmp_expect_ok(` call sites
(0031: 43 + 17 + 8 = 68). That equality is the check that no assertion dies
silently on `permission denied` and still leaves a green tally.

Both load-bearing suites were confirmed **able to fail**: re-applying 0017's
column grant turns 0030 to 35/3 and the denied write demonstrably succeeds;
restoring 0030 returns 38/0 with byte-identical state snapshots. Dropping
`and status = 'active'` from `private.approve_guardian_sharing` turns 0031 to
65/3, and the first failure is the re-pointed sharing assertion itself.

## Defects this work found in its own evidence

Three, all fixed in-stack, all of the same class: *an assertion that cannot
reach its expected outcome — or does not run at all — while the suite reports
green.*

1. **Two of 0031's 68 assertions never executed.** Section 5 switched role to
   `anon` and the two POST-CONDITION calls sat behind it, so `permission denied`
   killed them before a notice was raised. The suite reported 66/0. Fixed in
   `36415d4`; the header now documents the `grep -c ERROR` check and the
   call-site comparison that expose it.
2. **The count method itself was wrong.** A grep matching only two of the three
   helpers reported 62 call sites against 68 notices, which read as "phantom
   assertions". There were none — the third helper, `tmp_expect_ok`, was simply
   not counted. Recorded in `425df2e` because the wrong count is what sent this
   work looking for a bug that did not exist.
3. **Three assertions targeted a function `main` retired.** See below.

## `main` superseded part of 0017

`0020_review_batch1.sql:399` drops
`public.approve_guardian_public_sharing(uuid)` — the "guardian approved, the
minor records it" model — and introduces
`public.approve_guardian_sharing(user_id, guardian_email, token)`, a one-shot
capability link. Running the 0031 suite against current `main` was the first
honest failure this work has produced: **64 PASS / 4 FAIL**, two of them
cascades.

The model moved; the property did not. `private.approve_guardian_sharing` still
requires `and status = 'active'`, so a pending consent is still refused. The
three assertions are therefore **re-pointed, not deleted** — an assertion is
removed only when the property it checks is genuinely gone, and never to turn a
suite green. The capability token is read from the row rather than hardcoded,
because 0020 mints it with `default gen_random_uuid()`; a literal would be a
guess, and a guess that fails to match is indistinguishable from a gate that
works.

Also checked and cleared: 0020 added `sharing_approval_token not null default
gen_random_uuid()`, and 0031's `request_guardian_consent` inserts without naming
it, so 0020's sharing flow keeps working. 0031 breaks nothing of main's.

## Deferred — not blocked, just not this stack

- **Social sign-in (OAuth).** Touches `src/features/auth/pages/Auth.jsx`,
  `src/data/repositories/auth.js` and the `[auth.external.*]` blocks in
  `supabase/config.toml`. Not a compliance requirement. The
  `docs/local-dev.md` section describing it was dropped with the OAuth cut.
- **Client guardian routes.** `GuardianConfirm.jsx` / `GuardianRevoke.jsx` and
  `/guardian/*` collide with **PR #194**, which implements a different design
  for the same capability (`GuardianApprove.jsx`,
  `approveGuardianSharing({userId, guardianEmail, token})`, `/guardian-approve`
  under `AppLayout`). Stacking both would produce two competing consent flows.
  This must be reconciled with #194, not merged beside it.
- **0017's own comments are wrong and are not fixed here.** Lines 8, 38 and 70
  all say the app "learns minor status via user_metadata", which D1 retires.
  0030's header now states the supersession where the age fact becomes
  authoritative, but 0017 still opens with the retired claim and still defines
  `guardian_consents`. Correcting a shipped migration's comments is a
  judgement call that belongs to whoever owns 0017's next change.

## Findings outside this stack

- **`src/lib/projection.js` on `main` has four dead imports** (`./supabase.js`,
  `./services.js`, `./songs.js`, `./chordpro/parser.js` — all removed by the
  M0a relocation). Nothing imports the file, so Rollup never resolves it and
  `pnpm build` stays green. Byte-identical to `origin/main`; not introduced here
  and not fixed here. It is dead code that should be deleted or re-plumbed.
- **PR #194** is a competing guardian design, unreconciled with this work. See
  Deferred.
- **Issues #149** (`[security] Migration chain broken + RLS tenant leaks`) and
  **#150** (`[security] Minors & guardian consent: server-side gate never
  engages`) both match this work and both lack `status:approved`, which this
  repo's entry rule requires before an item is implemented.

## Not verified — stated plainly

- **No email was sent.** The furthest proven hop is a 502 from a deliberately
  invalid key. `SITE_URL` is a required per-environment variable with no
  default, so a deployment that forgets it fails closed (503, sends nothing).
- **No guardian page was rendered in a real browser.** The browser session
  disconnected; `guardianLink.js` was verified 4/4 in node.
- **No real Google or GitHub sign-in.** No credential exists in this
  environment.
- **No native review receipt exists for any slice.**
  `gentle-ai review assess` returns `high`; the preflight STATUS returns
  `immutable_review_transport_unsupported` / `next_action: stop`. Reported
  upstream as `Gentleman-Programming/gentle-ai#4808` (comment
  `issuecomment-5855906499`, labels untouched, still open, no fix published).
  **None of this work may be reported as reviewed.**
