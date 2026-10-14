# Offboarding cascade — the missing half of `offboarding-cascade`

- **Change:** N2 unit 1 of Hito 6 (privacy slice). Migration `0038_offboarding_cascade.sql`.
- **Branch:** `feat/offboarding-cascade-pr1-cascade` (from `origin/main` = `8a9b1b2`), then
  `feat/offboarding-cascade-pr2-blast-radius`, then `feat/offboarding-cascade-pr3-record-docs`, then
  `feat/offboarding-cascade-pr4-rejection-surface` (added 2026-10-14 — see "Slice 4").
- **Delivery:** `stacked-to-main` chain, four slices — see "Slice boundaries".
- **Status:** all four slices committed and verified. Slice 1 =
  [#368](https://github.com/davidjesus516/cemurm/pull/368), slice 2 =
  [#369](https://github.com/davidjesus516/cemurm/pull/369), slice 3 = [#370](https://github.com/davidjesus516/cemurm/pull/370),
  slice 4 = [#371](https://github.com/davidjesus516/cemurm/pull/371); all four open,
  awaiting human review. Merge is the maintainer's.
- **TDD:** off (`openspec/config.yaml:13`). Runner `pnpm test` for the JS gates. This unit is
  SQL behaviour, so its honest verification is the smoke script — see "Why not the gherkin tier".
- **RDD:** on (global), but **native review must not be started on this runtime** (OpenCode
  `2.0.25` = V2; the Review Execution Contract forbids starting a review on V2). Substitute for a
  receipt: one fresh independent adversarial verifier. This is a substitute, not a receipt.

## Objective

Close the two offboarding requirements that are genuinely absent, without touching the ones that
already hold.

`features/offboarding-cascade.feature:43-52`:

- `:43-47` **Pending substitution requests are auto-cancelled** — "the request closes as cancelled",
  "the leader is notified: `Sofia left — bass part uncovered`".
- `:48-52` **A former member cannot be re-assigned** — "the assignment is rejected with
  `Sofia is no longer a member`", "she is excluded from new substitution candidate lists".

## Problem and why

`docs/master-plan.md` filed `offboarding-cascade` under "no implementation exists for any of its six
features" (§4's blanket claim; the row's dated correction now qualifies it). For this feature that was
**materially wrong**, and it matters because it changes the size of the work: the membership model,
the `former` state and `left_at` (`0001`), `notify_user` and `transfer_setlist_ownership` (`0008`,
Hito 3), `withdraw_public_song` (`0012`) and `leave_organization` (`0016`, both Hito 4) all already
exist. What did not exist was the **cascade**:

- `private.org_leave` (`0016:437-453`) flipped the membership to `former` and stopped there. A member
  could leave with her open substitution request left dangling — never closed — and the leader never
  told. The `service_assignments` row is deliberately kept, before and after this migration: the plan
  still lists her on the part, so what 0038 changes is the request state and the notification, not the
  plan.
- `private.assign_musician` (`0018:462-524`) accepted any user id as an assignee, so a former member
  could still be put on a service.

Both are real, reachable holes. Neither is a new feature. The `docs/master-plan.md` row is corrected
as part of this unit.

## Scope

**In scope** (migration `0038`, one file):

- `private.org_leave`: before the status flip, close every **open** substitution request the leaver
  raised for a service **in this org**, log it, and notify that service's leader.
- `private.assign_musician`: reject a non-active member as an assignee with the Gherkin's literal
  message.

**Out of scope, deliberately:**

- `features/offboarding-cascade.feature:53` setlist handoff — **not** blocked by the data model, as
  first assumed. The Gherkin resolves it itself: "she transfers ownership to **an active member**"
  and "the setlist stays with the org under its new owner". `transfer_setlist_ownership`
  (`0008:214-246`) already exists, but its precondition is **not** the one the Gherkin states: it
  requires the new owner to be an **accepted collaborator of that setlist** (`accepted_at is not
  null`, `0008:227-231`), never an org member with `status = 'active'`. So
  WU2 must first put the target member on the setlist as an accepted collaborator, then do the
  **two-phase leave** (the handoff gates the status flip) — more than the "the data model already has
  it" first read suggested.
- `:14`, `:24`, `:28`, `:33`, `:63`, `:67` (nothing deleted, personal annotations, personal fork,
  gig records, public attribution, withdrawal) — the retention halves hold by construction or RLS, but
  not every second half does. See finding 4: `:37` needs code, so WU3 is not assertions-only there.
- Removing a former member from **frozen** `candidates` arrays on requests created before the leave.
  The Gherkin says "excluded from new substitution candidate lists", and new lists already exclude
  them (`0023:92` filters `m.status = 'active'`). Frozen arrays are deliberately untouched; the
  smoke asserts that boundary instead of enforcing it.
- Self-accepting a substitution while sitting in a stale frozen `candidates` array
  (`respond_substitution`) is left as-is. Guarding it naively **would break cross-org events**:
  `0023` T10 legitimately assigns a member of org `a2` to a service of org `a1`. Recorded as a
  follow-up finding instead of a silent widening.
- Account export and erasure (N2 unit 2). Separate track.

## Constraints discovered

1. **`private.is_org_member` is session-bound** — `0002:16-18` filters `user_id = (select auth.uid())`,
   so it can only ever report the *caller's* membership. It cannot validate a *third party*.
   `0023:467-476` already hit this and solved it by reading `org_memberships` directly, with a
   comment. `0038` mirrors that precedent exactly rather than inventing a new shape.
2. **The assign guard is deliberately org-scoped, not event-scoped.** The candidate list spans
   participating orgs (`0023:69-85`), and `0023` T10 assigns across orgs through the substitution
   flow. A generic "the assignee must be an active member of the service's org" **trigger** would
   break that existing scenario. So the guard lives in `private.assign_musician` (the plan-editor
   path the Gherkin describes: "the leader tries to assign"), not in a table trigger.
3. **`service_change_log` is extensible through `detail.kind`, not through new `action` values.**
   `0023` writes `action = 'substitution'` with `detail ->> 'kind'` in
   `unavailable/send/decline/confirm/cancel/reclaim/overrule` (`0023:152, 211, 255, 300, 380, 439 and
   508`), while `services.js:532` filters on `action === 'song_swap'`. `0038` therefore logs
   `action = 'substitution'`, `detail.kind = 'member_left'` — additive, and it cannot blank a UI that
   switches on `action`.
4. **The gherkin tier does not read `.feature` files.** `src/test/gherkin/` is a hand-written Vitest
   suite: `createRunner(domainFns)` + `runScenario('collab', ['Given …'])` against pure
   `src/domain/**` functions, with `mockSupabase()` as a stub. Migration `0037`'s commit is the
   precedent — its verification is the SQL smoke. These two scenarios are SQL behaviour and cannot
   be honestly verified by a mocked JS tier.
5. Migration numbering: `main`'s top migration is `0037`; **`0038` was free in every remote branch**
   (re-checked, not assumed).
6. **Visibility is checked before writability.** Once the leaver is `former`, the service is no
   longer visible to her at all, so `assign_musician` raises `Service not found.` — not the
   leader-only message. That is a *better* outcome than a bespoke error (it leaks nothing), and the
   smoke asserts the observed behaviour rather than the expected-looking one.

## Tasks

- [x] **T1** — `0038`: cascade in `private.org_leave` (close the leaver's open requests in this org,
      log `kind = 'member_left'`, notify the leader with the exact Gherkin literal; never
      self-notify a leaving leader; never touch other orgs).
- [x] **T2** — `0038`: assignee guard in `private.assign_musician` (reject a non-active member with
      `'% is no longer a member'`).
- [x] **T3** — `scripts/smoke/0038-offboarding-cascade.sql`: fixtures, contract, cascade, guard,
      positive regression (an active member is still assignable), frozen-candidates boundary, and
      the post-leave RLS lockout.
- [x] **T4** — run the smoke on a fresh `supabase db reset`; record the PASS/FAIL count.
- [x] **T5** — JS gates: `pnpm test`, `pnpm test:gherkin`, `pnpm typecheck`, `pnpm lint`,
      `check-visual-contract.sh`, `pnpm build`, plus the `checkJs` baseline aliveness count.
- [x] **T6** — ODD record + Engram mirror + PRs with the honest-limitations section.

## Slice boundaries

The unit is 2.94× the repo's 400-changed-line budget in one piece (1177 changed lines: 1175 insertions
and 2 deletions across 6 files, `git diff --shortstat 8a9b1b2 HEAD`; slices 1-3 alone were 943
changed lines = 2.36×, and before the 2026-10-14 corrections the same measure was 831 = 2.08×), so it
ships as a `stacked-to-main` chain (the same strategy the tie-break chain used). No single slice
exceeds the budget; the unit does. The seams are **behaviour** vs **executable proof** vs
**documentation** vs **UI surfacing** (slice 4, added after the first three were pushed).

| Slice | PR | Branch | Holds | Changed lines |
|---|---|---|---|---|
| **1** | [#368](https://github.com/davidjesus516/cemurm/pull/368) | `feat/offboarding-cascade-pr1-cascade` | `0038_offboarding_cascade.sql` (202) + smoke assertions 1-11 (191) | **393** — under budget |
| **2** | [#369](https://github.com/davidjesus516/cemurm/pull/369) | `feat/offboarding-cascade-pr2-blast-radius` | smoke assertions 12-33 (+270/-10) | **280** — under budget |
| **3** | [#370](https://github.com/davidjesus516/cemurm/pull/370) | `feat/offboarding-cascade-pr3-record-docs` | `docs/master-plan.md` (+15/-1) and this record (274) | **290** — under budget |
| **4** | [#371](https://github.com/davidjesus516/cemurm/pull/371) | `feat/offboarding-cascade-pr4-rejection-surface` | `services.js` error mapping (+13/-1), `services.test.js` (97), the `master-plan` row correction and this record's slice-4 section | **268** — under budget |

The first cut put the smoke extension, the doc correction and this record in one 573-line slice, 173
over. The fix was a re-cut, not a `size:exception`: the seam is **executable proof** (slices 1-2)
versus **documentation** (slice 3), and each part fits on its own. Nothing was dropped to reach it —
the assertion count, the fixtures and this record are unchanged in content, and the unit's total is
the same 943 lines. Each slice is based on the one before, so every diff carries only its own work
unit.

Slice 4 postdates that re-cut and is new work, not a re-slice: it adds the UI surfacing that the first
three slices disclosed as missing. It is the only slice that changes JS, so it is the only one that
moves the `pnpm test` baseline (404/17 → 409/18), and it moves the unit's total off 943.

Assertions 1-11 are stable across the chain: slice 1's header correction touches no assertion, and
slice 2 adds fixtures, RPC setup and the appended assertions 12-33 — no existing assertion number ever moves.

Tested at both smoke tips, each on a fresh `supabase db reset`:

- slice 1 tip (`ae06180`): the smoke stops at assertion 11 and reports **11 PASS / 0 FAIL**.
- slice 2 tip (`45b7e94`, the last commit that changes the smoke; this record's commit sits on top): **33 PASS / 0 FAIL**, all of 1-33 present exactly once.

## Slice 4 — the UI rejection surfacing

Slice 4 was not part of the original cut: the gap below was disclosed while the WU1 PR bodies were
being written, and the maintainer asked for it as its own unit on 2026-10-14.

**The gap.** `handleError` (`services.js:298-302`) re-throws a rejection only when the message is an
exact member of `USER_ERRORS` (`services.js:255-268`) or matches `isOverlapError`'s dynamic suffix
(`services.js:277-279`). The re-assignment literal is *dynamic* — `<display name> is no longer a
member` (`0038:168`) — so `assignMusician` rejected with `Something went wrong. Please try again.`,
while `AssignForm` renders `err.message` verbatim (`ServiceDetail.jsx:232` set, `:277` rendered).
`features/offboarding-cascade.feature:51` therefore held in the database and was invisible in the
interface; the SQL half alone was never enough. **The fix** is `isFormerMemberError`
(`services.js:281-290`), matching the stable suffix `' is no longer a member'` — the shape
`isOverlapError` already uses — with `handleError` consulting all three sources. `USER_ERRORS` is
untouched, so no existing mapping changes.

**What slice 4 deliberately does NOT change: the member picker.** `AssignForm`'s "Known members…"
select is fed by `getService`'s `members` — *every profile the plan references*
(`services.js:517-523`, returned at `:569`) — and the former member stays in it because her
`service_assignments` row is deliberately retained (`0038` closes the request and notifies the leader;
it does not touch the plan). Excluding her was considered and dropped on three grounds:
`features/offboarding-cascade.feature:52` names the **substitution candidate list** — the
`substitution_candidates` RPC (`0023:46`, `m.status = 'active'` at `0023:92`), already asserted by
smoke assertion 24 — not the assignment picker; the picker's other half is a free-text search over
*all* profiles (`searchProfiles`, `profiles.js:60-73`, no org scope), so a picker-only filter would
exclude nobody who is actually reachable; and the scenario needs the leader to be *able to try* the
assignment for the rejection to exist at all. The entry rule settles it: an item is implemented only
when its hito or BDD feature requires it (`docs/engineering-review-backlog.md:5`).

One correction, kept because a wrong reason is not a reason: the first draft of this section argued
that filtering `members` would lose the *live* assignments' displayed names. It would not —
`flattenAssignment` bakes `memberName` into each row before `members` is built
(`services.js:357-373`, `:363`). The over-broad statement was caught by the independent verifier; a
global filter would only reach the non-leader published snapshot (`snapshotAssignmentsByBlock`,
`ServiceDetail.jsx:148-162`) and the substitution panel's name lookup (`ServiceDetail.jsx:860`,
`:891`). The picker was dropped for the three grounds above, not for that one.

**Verification.** This is the only JS slice, so its gates are the node ones:

| Gate | Result |
|---|---|
| `pnpm test` | **409 passed / 18 files** (exit 0) — was 404/17 before the slice |
| `pnpm test:gherkin` | 41 passed / 5 files (exit 0) |
| `pnpm typecheck` | 0 (exit 0) |
| `pnpm lint` | 0 (exit 0) |
| `scripts/check-visual-contract.sh` | OK — 12 rules checked, 0 failing |
| `pnpm build` | ✓ built in 4.52s |
| `npx tsc --noEmit --listFiles \| grep -c 'cemurm/src/'` | 65 — was 64; the +1 is the new `services.test.js`, which the `src/data` include reaches |

**Falsifiability — the point of the slice.** `src/data/repositories/services.test.js` is the first
data-layer test for `services.js` and copies the `annotations.test.js` mocking shape (`src/data/supabase.js`
throws in bare node without env vars, so it is mocked before the dynamic import). Removing
`|| isFormerMemberError(message)` from `handleError` turned exactly the two literal cases red:

```
AssertionError: expected 'Something went wrong. Please try agai…' to be 'Sofia is no longer a member'
  → src/data/repositories/services.test.js:58
AssertionError: expected 'Something went wrong. Please try agai…' to be 'Ana María Ochoa is no longer a member'
  → src/data/repositories/services.test.js:70
Tests  2 failed | 3 passed (5)
```

the generic-message, overlap and part-guard cases stayed green, and the revert restored 5/5. This was
run three times independently — by the writer, by the parent, and by the verifier — with the same
result each time. The assertions can fail, and they fail for the reason the slice claims.

**Honest note on ordering.** TDD is off in this repo (`openspec/config.yaml:13`), so this was not a
RED-first cycle: the matcher and the test landed in the same commit and falsifiability was established
by mutation *after* the fact. The mutation is real; the ordering is not what strict TDD would have
produced, and this record does not claim otherwise.

## Acceptance criteria

- A leaver's open substitution requests **in the leaving org only** become `status = 'closed'` with
  a non-null `resolved_at`; the leader receives a notification titled exactly
  `<name> left — <part> part uncovered`; a `service_change_log` row carries
  `action = 'substitution'`, `detail.kind = 'member_left'`.
- An open request belonging to **someone else** is untouched, including its frozen `candidates`
  array.
- Nothing is deleted by leaving: the membership row persists as `former`, the assignment row
  persists.
- Assigning a former member raises `'Sofia is no longer a member'`; assigning an active member
  still succeeds.
- The rejection reaches the user **as that literal**, not as the generic message — the DB half alone
  is not the criterion (slice 4).
- The leaving org's data is no longer readable by the former member (the existing `status = 'active'`
  RLS gate, asserted rather than assumed).

## Verification evidence

**Smoke of record** — `scripts/smoke/0038-offboarding-cascade.sql`, run on a fresh
`pnpm exec supabase db reset` with `-v ON_ERROR_STOP=1`:

| Tip | Result |
|---|---|
| slice 1 (`ae06180`) | **11 PASS / 0 FAIL** (`rc=0`) |
| slice 2 (`45b7e94`) | **33 PASS / 0 FAIL** (`rc=0`), numbers 1-33 each exactly once |

The smoke is **not idempotent** (it commits its writes); every run above was preceded by a reset.
A first slice-2 attempt re-run against a dirty database correctly died on `Not a member.` — the
header warning is load-bearing.

**Falsifiability pass (2026-10-14).** Assertions 25, 29 and 32 originally could not fail (25 only
checked `is not null`; 32 only checked the isolation org had no `former` rows, which the seed could
not violate; 29 asserted a non-notification that `notify_user` suppresses globally). They were
rewritten, and each rewrite was proven to go red against a real source mutation on a fresh reset:

| Mutation (reverted after) | Observed |
|---|---|
| drop `and p.instrument = v_assignment.part` from `0023`'s `substitution_candidates` | `[FAIL] 25`; 32 PASS / 1 FAIL |
| add `and s.leader_id is distinct from v_leaver` to the cascade's request loop | `[FAIL] 28` and `[FAIL] 29`; 31 PASS / 2 FAIL |
| drop `and s.org_id = p_org_id` from the cascade's request loop | `[FAIL] 12` and `[FAIL] 32`; 31 PASS / 2 FAIL |

After each revert: a fresh reset and a re-run gave **33 PASS / 0 FAIL**. Note assertion 12 counts
closed requests **globally**, so the org-scope mutation fails 12 as well as 32 — the org scoping is
not proven by 32 alone. Loosening the `0038` leader guard (`r.leader_id is not null` instead of
`r.leader_id <> v_leaver`) changed nothing observable: `notify_user` suppresses self-notifications
globally (`0008:55`). That is why assertion 29 asserts the `kind = 'member_left'` log row for the
leaving leader's own request rather than her (unobservable) notification.

**JS gates** — run at both tips, identical results (this unit adds no JS); re-verified at the
corrected tips (`ae06180` / `45b7e94`) on 2026-10-14, same readings:

| Gate | Result |
|---|---|
| `pnpm test` | 404 passed / 17 files (exit 0) |
| `pnpm test:gherkin` | 41 passed / 5 files (exit 0) |
| `pnpm typecheck` | 0 (exit 0) |
| `pnpm lint` | 0 (exit 0) |
| `scripts/check-visual-contract.sh` | OK — 12 rules checked, 0 failing |
| `pnpm build` | ✓ built in 4.8s / 4.6s (4.68s on the re-run) |
| `npx tsc --noEmit --listFiles \| grep -c 'cemurm/src/'` | 64 — baseline alive |

**On the 404/41 vs 410/44 baseline.** The tie-break chain's slice 2 branch reports 410/44; this
chain branches from `main`, which does not carry that slice. `git diff --stat origin/main
origin/fix/offline-tie-break-pr2 -- '*.test.js' 'src/test/**'` shows the entire delta lives in
PR2's three test files, and slices 1-3 touch no test file. The 404/41 reading is the `main`
baseline, not a regression.

**The baseline moves with slice 4** (the only JS slice): 404/17 → **409/18** and the `checkJs`
aliveness count 64 → 65. Both are additive — the new `services.test.js` and its five cases. Note that
`vitest.config.js`'s include reaches `src/**/*.test.js`, so the `pnpm test` figures **include** the
gherkin tier's 41 tests in 5 files; `pnpm test:gherkin` re-runs that subset. Nothing was removed to
move the number.

## Honest limitations

- **No review receipt.** The runtime is V2, where the native review must not be started. The
  substitute is one fresh independent adversarial verifier per slice. It is not a receipt and this
  record does not claim one.
- **The gherkin tier cannot verify this unit.** `features/offboarding-cascade.feature` is
  documentation here, not executable coverage: the tier never opens `.feature` files. Only the SQL
  smoke exercises `0038`.
- **Scenario 8 (setlist handoff) is not covered.** It needs the setlist-collaborator handoff plus a
  two-phase leave, which is WU2.
- **`respond_substitution` with a stale frozen `candidates` array is still open** — see the
  out-of-scope note. Deliberate: the naive fix breaks a cross-org scenario that already works.
- **The guard is org-scoped and lives on the plan-editor path only.** It does not protect the
  substitution flow's own assignment, which is a different code path with different tenancy rules.
- **Assertion 24 no longer isolates `0023`'s `status = 'active'` filter.** The other-org fixture that
  assertion 32 needs also gives Sofia an open request elsewhere, and the candidate query treats any
  open request as "busy", so she is excluded twice over for `ana_asg`. Removing `m.status = 'active'`
  alone leaves **33 PASS / 0 FAIL** — no assertion here goes red on that filter by itself. Recorded,
  not papered over.
- **Slice 4 leaves the member picker alone.** A former member is still selectable in `AssignForm` and
  gets rejected with the BDD literal — which is what the scenario describes. She is kept out of new
  *substitution candidate* lists by the DB filter (assertion 24), not by the picker. The three grounds
  for that decision are in "Slice 4"; the feature requires no more than this.

## Findings to carry forward

1. `respond_substitution` accepts a responder who is in the frozen `candidates` array but is no
   longer an active member of the service's org. Guarding it needs an event-scoped (not org-scoped)
   check so `0023` T10 keeps working.
2. **The stale "two confirmed users" claim is no longer in `docs/local-dev.md`.** That file was
   corrected on 2026-09-30: `docs/local-dev.md:29` now says three, with a dated correction at `:34`.
   The stale attribution survives in `AGENTS.md:166` and `docs/security.md:57,271`, which still locate
   "two" at `docs/local-dev.md:29` as if it were live. `docs/master-plan.md:489` does not: it already
   records that line as repaired. Pre-existing and unrelated to this unit.
3. **`0034_plan_freeze.sql` raises seven literals that `USER_ERRORS` does not carry** — the same defect
   class slice 4 just fixed for `0038`, found by the independent verifier while reviewing slice 4 and
   deliberately not fixed there (different unit, its own smoke): `publish_plan` (`0034:79`) raises
   `'Service not found'` (`:98`), `'Only the service leader can publish the plan'` (`:102`) and
   `'A completed service is read-only'` (`:105`); `get_published_plan` (`0034:178`) raises
   `'Service not found'` (`:193`) and `'Not visible to this user'` (`:197`); `list_plan_versions`
   (`0034:226`) raises `'Service not found'` (`:246`) and
   `'Only the service leader can view version history'` (`:249`). Five distinct literals, all without
   the trailing period that `USER_ERRORS` carries for `'Service not found.'`, so all five map to the
   generic message. The *mismatch* is verified by reading both sides; whether each is **reachable**
   from the UI is not — the publish button is gated on `isLeader && !completed` and the read paths are
   partly swallowed (`getPublishedPlan` in `ServiceDetail.jsx`), and no path was traced. Recorded as a
   verified literal mismatch, not as a verified user-visible bug.

4. **The record's own claim that `:33` "already holds by construction or RLS" is wrong for its second
   half.** Every gig, performance and performance-item policy is owner-scoped (`0004:64`, `:87`,
   `:147`), and `shared_to_branch` (`0001:300`) is written by the client (`gigs.js:439`, `:540`) but
   read by **no** policy and no RPC anywhere under `supabase/` — so "shared it to the branch" (`:34`)
   grants the branch nothing, and `:37` ("org members keep read-only access to the completed gig")
   cannot hold. `:36` does hold, for the same owner-only reason. `:37` therefore needs the
   branch-visibility read, not an assertion: WU3's estimate for that scenario is larger than this
   record first said. The identical claim in `docs/master-plan.md:446` and `:459-460` is corrected in
   this same slice. Found by the WU2 reconnaissance on 2026-10-14 and verified here by reading both
   sides. Separately, `:31`'s "right to rebase" depends on
   `personal-preferences-and-adaptations.feature:62-84`, which is itself unimplemented — a different
   feature's unit, but the `:28` assertion must not be written as if rebase already existed.

## Verification of the docs correction

`docs/master-plan.md:446` carried `| offboarding-cascade | 10 | none |` and the table's own
convention is a repaired list with dates and evidence. The row now names what shipped and what did
not, and records that the *count* of scenarios was right while the *size* of the work was not. A
later correction pass fixed the row's own citation of *where* those artefacts live — `0001`/`0008`/
`0012`/`0016`, not "Hito 1 (`0016`/`0018`)" — and qualified §4's blanket "no implementation exists for
any of its six features", which the row contradicted. No other row in that table was touched: the
erasure row (`account-data-export-and-erasure`) is Track B and is not authorized here, even though
its `none` looks equally wrong.

Slice 4 corrects that same row once more: the WU2 reconnaissance falsified "the missing piece was the
CASCADE" and "the scenarios that already hold by construction" for `:37`, which has no code at all —
finding 4.

## Next step

[#368](https://github.com/davidjesus516/cemurm/pull/368),
[#369](https://github.com/davidjesus516/cemurm/pull/369), [#370](https://github.com/davidjesus516/cemurm/pull/370) and
[#371](https://github.com/davidjesus516/cemurm/pull/371) are open and awaiting human review; merge is the
maintainer's call — no slice needs a `size:exception` (see "Slice boundaries").

The reviewer request could not be made through `gh pr edit --add-reviewer`: `gh` is authenticated as
the reviewer, GitHub refuses to request review from a PR's own author, and `gh` reports exit 0 and
prints a URL anyway while `reviewRequests` stays empty. All four PRs were notified by comment instead.
`--add-reviewer` looks like it worked from the outside; it does not.

After that: WU2, the two-phase leave that covers scenario 8.
