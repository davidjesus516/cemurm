# Minor compliance — remediation plan for the debt left open

> Status: **plan, not a record.** Nothing in this file has been implemented.
> Baseline: `origin/main` @ `bfaf6e8`.
> Scope: the debt carried out of the fail-closed minors / guardian consent work
> (PRs #199–#203, open, unmerged) plus what was already stale on `main`.
> Companion record: `odd/tasks/minors-fail-closed-db.md` (lands in PR #203).

Every item below carries the command that produced its evidence. An item whose
evidence could not be reproduced is marked `NOT ESTABLISHED` and must not be
closed on assertion.

---

## Sequencing — what blocks what

```
F-1a consent page no longer lies      ── DONE (1ed6b83, PR #201)
F-1b /guardian/confirm + /revoke      ── OPEN. The emailed link 404s, so a
                                         minor is still locked out — truthfully,
                                         but locked out. Blocks the feature.
      │
      └──► F-2  PR #194 conflict + duplicate guardian design
              blocks: all client-side guardian work, F-1b included

F-3  dead projection.js                ── independent, no blocker
F-4  retired user_metadata claim       ── independent, comment-only
F-5  issues #149/#150 unlabelled       ── blocked by F-1b (cannot claim closure)
F-6  no review receipt (upstream)      ── unblockable locally
F-7  email never proven end-to-end     ── independent; the trigger decision is
                                         resolved (app-invoked), the real-key
                                         run is still owed
F-8  OAuth — forward constraint, not debt
```

**The one thing that would make this stack shippable** is F-1b, and F-1b is
blocked on F-2. Everything else is cleanup, a missing label, or missing evidence.

---

## F-1 — After the stack merges, a minor is locked out by a page that says they are not

**Severity: was a blocker. Unit (a) is now fixed on `feat/guardian-consent-db`;
unit (b) is still open and still blocks the feature working end to end.**

> **Update — unit (a) shipped as `1ed6b83` on PR #201.**
> The page no longer claims an unlock, the app now invokes the edge function,
> and the status contract is wired to the function's real returns. The lie is
> gone. **The lockout is not**: `/guardian/confirm` still does not exist, so
> the guardian's emailed link leads to a 404 and a minor still cannot get out.
> Unit (b) below is therefore still required, and the flow is still not shippable
> as a feature.

### What happens

1. A minor reaches the lock screen. `AuthGuards.jsx:111` lets the account through
   only when `consent?.status === 'active'`.
2. `GuardianConsentRequired.jsx:49` calls `recordConsent(...)`, which resolves to
   `public.record_guardian_consent`.
3. `0031` lines 191–213 redefine that function as a **deprecated alias** of
   `request_guardian_consent_core` — "it creates a 'pending' row like every other
   request". The insert status is `pending`, not `active`.
4. `GuardianConsentRequired.jsx:82` renders **"Consent recorded — your account is
   now unlocked."**
5. `:57` calls `onSuccess()`, which re-reads the ledger. The status is `pending`,
   so step 1's condition is false and the **same lock screen re-renders**.
6. No email is sent. Nothing in `src/` invokes the `send-guardian-consent` edge
   function.

### Evidence

```
$ git show docs/resend-guardian-consent:supabase/migrations/0031_guardian_consent_email.sql | sed -n '191,213p'
  -- `record` is now a lie: it opens a request. ... it creates a 'pending' row
  -- like every other request.
  create or replace function public.record_guardian_consent(...) → private.request_guardian_consent_core(...)

$ git show docs/resend-guardian-consent:src/app/providers/AuthGuards.jsx | grep -n "status === 'active'"
  111:  if (consent?.status === 'active') return <Outlet />

$ git grep -nE "send-guardian-consent|functions\.invoke" docs/resend-guardian-consent -- 'src/**'
  (no call site — the edge function is never invoked by the app)
```

Note the function is **not** dropped; it is kept as an alias precisely so a
pre-0031 client bundle does not start erroring. That is why the failure is silent
— the call succeeds, returns a row id, and unlocks nothing.

### Why the RPC still points at the old name

`0029`'s regression smoke calls `record_guardian_consent`, so `0031` kept it.
`src/data/repositories/minors.js:85` still exports `recordConsent` against it, and
`GuardianConsentRequired.jsx` was **not** updated by slice 2 — verified:

```
$ git diff --stat origin/main...docs/resend-guardian-consent -- src/features/auth/pages/GuardianConsentRequired.jsx
  (empty — untouched)
```

### Net effect

A minor who consents is told they are unlocked, is not unlocked, has no guardian
email, and has no page that can call `confirm_guardian_consent_by_token` —
`/guardian/confirm` was in the deferred client half and does not exist. **There is
no path out of the lock screen.** This is worse than the fail-open hole the stack
was written to close.

### Action

**(a) Unblock — DONE, `1ed6b83` on PR #201.** The page was rewritten so it:
- states the account stays locked until the guardian confirms; the
  "your account is now unlocked" claim is gone and nothing rendered claims it;
- separates *request recorded* from *email sent*, with an explicit `no_email`
  state that says plainly nobody was reached;
- drops the form once a request exists (0031's `guardian_consents_one_open`
  would reject a second one) and offers resend plus an explicit re-check;
- calls `request_guardian_consent` — the honest name — instead of the
  deprecated alias, and `sendGuardianConsentEmail` invokes the edge function.

**(b) Close the loop — STILL OPEN, and still required.** `/guardian/confirm`
and `/guardian/revoke` pages calling `confirm_guardian_consent_by_token` and
0017's `revoke_guardian_consent`. Blocked on **F-2** (route and token model).
Until (b) lands, the emailed link 404s and the minor stays locked — now
truthfully, but locked.

### Decision — resolved 2026-09-27

**The app invokes the edge function.** The client calls
`send-guardian-consent` as soon as the request is recorded, so the minor does
not wait on an operator. The function derives both links itself from
`SITE_URL` and the row's `revocation_token`, so the browser sends nothing but
its session bearer. `verify_jwt = true`, so the function authenticates as the
minor and re-checks the row is theirs. The operator-triggered alternative was
rejected: a pending row nobody was told about reaches no guardian, and the
`no_open_request` / `unavailable` paths would have made an operator a hard
dependency in the only flow that can unlock a minor.

### Closure test

- ✅ A minor records a request → the UI says the account stays locked, not
  *unlocked*. (`1ed6b83`; proved by grepping rendered copy with comments
  stripped, and by breaking the new export to fail the build.)
- ⬜ The account is still locked. *(True by `AuthGuards.jsx:111`; not observed
  in a real session — there is no test coverage for `src/features/**`.)*
- ⬜ The guardian email arrives, the link is clicked once, and the account
  unlocks. **Blocked on (b) and on F-7's real-key run.**

---

## F-2 — PR #194 is a hard merge conflict *and* a second, different guardian design

**Severity: blocker for all client-side guardian work.**

### The conflict is measured, not predicted

```
$ gh pr view 194 --json state,baseRefName
  OPEN · base main · fix/m1-review-batch1-minors-ui-v2

$ git merge-tree --write-tree origin/fix/m1-review-batch1-minors-ui-v2 fix/fail-closed-minors
  CONFLICTO (contenido): Conflicto de fusión en src/data/repositories/minors.js
```

Both sides rewrite the same file — slice 2 by `+60/-4`, #194 by renaming the
export `approvePublicSharing`. A textual conflict here is unavoidable.

### The design is duplicated, not merely colliding

| | Stack #201 (deferred client half) | PR #194 |
|---|---|---|
| Pages | `GuardianConfirm.jsx`, `GuardianRevoke.jsx` | `GuardianApprove.jsx` |
| Routes | `/guardian/confirm`, `/guardian/revoke` | `/guardian-approve`, child of `AppLayout` |
| Token | 0017 `revocation_token` (128-bit) | 0020 `sharing_approval_token` |
| Consent it closes | account activation | public-sharing approval |
| Session | login-less, `anon`-granted | login-less, `anon`-granted |

Two capability columns on the **same** `guardian_consents` table, two login-less
entry points, two route families, for two different questions. That may be the
right model — consent and sharing approval genuinely are different decisions — but
nobody has written it down, and `minors.js` currently holds a third
(orphaned) shape: slice 2 keeps `approvePublicSharing` at line 102 while #194
renames it away.

#194's own body is honest about its gap:

> What is **not** verified is whether that already-merged migration actually
> defines the anon-granted RPC this branch calls.

### Action

1. **Decide the canonical model before either client side lands.** Write it into
   `features/minors-and-guardian-consent.feature` and an OpenSpec spec — it is a
   capability, not a task.
   - Recommended: consent and sharing approval are **two distinct capabilities**,
     each with its own token and its own login-less page; they share the table,
     not the flow. Keeps #194's rename valid and keeps 0017's revoke valid.
2. Re-point `minors.js` once: one `approveGuardianSharing` export, no
   `approvePublicSharing` leftover.
3. Rebase #194 onto the merged stack and resolve `minors.js` by hand against that
   decision. Do not resolve it mechanically.
4. Settle #194's unverified claim: prove 0020 defines an `anon`-granted
   `approve_guardian_sharing`, or change it.

### Closure test

`git merge-tree` reports no conflict between the stack tip and #194's head, and
one documented model explains both pages.

---

## F-3 — `src/lib/projection.js` is 306 dead lines with four unresolvable imports

**Severity: cleanup. No functional impact today.**

```
$ git show origin/main:src/lib/projection.js | wc -l
  306
$ git show origin/main:src/lib/projection.js | grep -n "^import"
  13: import { supabase }     from './supabase.js'
  14: import { getService }   from './services.js'
  15: import { getSong }      from './songs.js'
  16: import { parseChordPro } from './chordpro/parser.js'

$ for f in src/lib/supabase.js src/lib/services.js src/lib/songs.js src/lib/chordpro/parser.js; do
    git cat-file -e origin/main:$f && echo "EXISTS  $f" || echo "MISSING $f"; done
  MISSING ×4 — all four targets are gone

$ git grep -nE "from '(\.\./)*lib/projection" origin/main -- 'src/**'
  (no importers)
```

`pnpm build` stays green because Rollup never resolves a file nothing imports —
that is the trap. The next person to grep for "projection" finds a 306-line data
layer that cannot possibly run.

### Action

Delete it, or re-plumb it to the relocated targets and wire it. **Decision
needed** — it is not ours to guess: if the congregation-projection surface is
still planned, delete now and rewrite when it is built; if it is live, the missing
imports are a second bug hiding behind the first.

---

## F-4 — The retired `user_metadata` claim survives in five places on `main`

**Severity: documentation. It is the exact misunderstanding D1 exists to kill.**

Verbatim on `origin/main`:

| Location | Text |
|---|---|
| `0017_minors_guardian_consent.sql:8` | `the app routes on user_metadata — the DB keeps date_of_birth server-side only.` |
| `0017_minors_guardian_consent.sql:38` | `the app learns minor status via user_metadata / guardian_consents.` |
| `0017_minors_guardian_consent.sql:70` | `the app learns minor status via user_metadata and guardian_consents.` |
| `src/data/repositories/minors.js:3` | `the app learns minor-ness ONLY from user_metadata.isMinor` |
| `src/app/providers/AuthGuards.jsx:27,32,42` | `const isMinor = user?.isMinor === true` — the D1 hole itself |

`0030`'s header states the supersession, but `0017` still **opens** with the
retired claim, and a reader who starts at 0017 never reaches 0030. Slice 2 fixes
the two client files; the three `0017` sites survive.

### Action

A comment-only correction. **Owner decision required:** editing the comments of an
already-merged migration is normally acceptable because no function body changes
and the file has been applied in every environment — but if this repo forbids
touching merged migrations, the correction goes in a follow-up migration header
instead. Someone has to own that call; it is not a mechanical fix.

### Closure test

`git grep -n "user_metadata" origin/main -- supabase/migrations/0017_*` returns
only a sentence that says the claim is retired.

---

## F-5 — Issues #149 and #150 match this work but were never approved

```
$ gh issue view 149 --json state,labels
  OPEN · ["bug"]   [security] Migration chain broken + RLS tenant leaks (0014-0019)
$ gh issue view 150 --json state,labels
  OPEN · ["bug"]   [security] Minors & guardian consent: server-side gate never engages (0017 + UI)
$ gh label list | grep status
  status:approved   Approved for implementation
```

The label exists and both issues lack it. The repo's own entry rule is YAGNI with
an approval gate; unlabelled `[security]` issues that describe shipped-around work
are how debt becomes permanent.

#150 is the one this stack answers — **but only once F-1 is fixed.** It must not be
closed, or marked approved, while a minor is locked out by a page that claims the
opposite.

### Action

Decide per issue: closed by the stack, partially closed (say which half), or
still open. Apply `status:approved` only to the ones that are genuinely scheduled.
Then link the PRs from each issue.

### Closure test

Both issues carry an accurate state and a comment pointing at the PR that
addresses them.

---

## F-6 — No native review receipt exists for any slice

**Not fixable here. Recorded so no one mistakes hand-run gates for a review.**

```
$ gentle-ai review mode status
  receipt-driven development: on (decided by global)
    global: on
    clone-local: unset
$ gentle-ai --version
  gentle-ai 3.7.0
```

Receipt-driven development is **on**, and the review preflight returns
`immutable_review_transport_unsupported` with `next_action: stop` — reported
upstream as `Gentleman-Programming/gentle-ai#4808` (open, no fix; labels
untouched).

Consequence: **none of PRs #199–#203 may be described as reviewed.** The evidence
that does exist is `pnpm lint`, `pnpm build`, and 125 hand-run SQL assertions
across three suites (19 / 38 / 68), each suite proved load-bearing by deliberately
breaking it.

### Action

None locally. Track the upstream issue. When the transport is restored, the
candidates are the individual work-unit commits, not the accumulated stack.

---

## F-7 — The email path was never proven against real Resend

**Severity: the largest evidence gap in the stack.**

The furthest proven hop is a **502 from a deliberately invalid key**. No real
send, no real token, no browser-rendered guardian page. `SITE_URL` is a required
per-environment function variable with **no default**, so a deployment that
forgets it fails closed with a 503 and sends nothing — correct behaviour, but
untested in both directions.

### Action

One manual end-to-end run on a configured environment, recorded in an
`odd/tasks/` file: create a real minor account, request consent, receive the mail,
click the link, observe the unlock. Add the "guardian never receives the mail"
negative case, since fail-closed there is the property that matters.

The trigger question is **resolved** — the app invokes the edge function
(`1ed6b83`), so the run exercises the real production path rather than a
manual step. What is still owed is the run itself. Note the honest ordering: the
run cannot complete until F-1b exists, because the link the email carries has
nowhere to land.

### Closure test

A recorded run with a real key, covering the success case, the fail-closed case,
and one link reused after confirmation.

---

## F-8 — OAuth is a forward constraint, not debt

**This corrects an earlier claim in the work record.** Social sign-in does not
exist on `main`, so there is no OAuth surface to re-plumb.

```
$ git show origin/main:src/data/repositories/auth.js | grep -n "export"
  EMAIL_RE, signUp, signIn, signOut, getSession, getCurrentUser
  — no signInWithOAuth
$ git show origin/main:src/features/auth/pages/Auth.jsx | grep -niE "google|github|oauth"
  (no OAuth markup)
$ git show origin/main:supabase/config.toml | grep -A3 "auth.external"
  [auth.external.apple] enabled = false      — no google, no github
```

D2's "OAuth may not bypass the date-of-birth gate" is a **constraint on a feature
that has not been built**. It belongs in the social-signin spec, not in a debt
plan. The local branch `feat/social-signin` (`96a8bb8`) is unpublished; whoever
builds it inherits the constraint for free if it is written down now.

### Action

Add the constraint to the social-signin feature/spec when that work starts. No
code debt today.

---

## Repository state found while writing this plan

An abandoned interactive rebase was in progress on `fix/minors-fail-closed-db`
onto itself (`onto == orig-head == bace58e`, todo reduced to a single bogus
`edit TODO`, zero commands done, clean tree). It left HEAD detached and blocked
any branch checkout. Aborted via `git rebase --abort`; nothing was lost, because
`11beda7` was held by both `docs/resend-guardian-consent` and
`origin/docs/resend-guardian-consent`. The old six-branch pre-re-cut stack and
`backup/pre-reorder` remain on disk, unpublished, as a fallback.

---

## Not covered by this plan

- `docs/engineering-review-backlog.md` — six architectural bets (TS migration,
  microservices, R2, rate limiting, GitHub secrets, container builds). Separate
  concerns, separate file, not touched here.
- `docs/mvp-scope.md` vs `docs/master-plan.md` staleness — known, tracked there.
- The `#ts-checkjs-baseline` chain and other open PRs — unrelated workstreams.
