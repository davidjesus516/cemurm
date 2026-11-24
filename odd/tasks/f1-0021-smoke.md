# F1 `0021` — membership smoke (execution record)

Branch: `test/f1-0021-smoke-v2` (the smoke) and `test/f1-0021-smoke-record` (this
record), stacked. Supersedes #533 and #535.
Delivery: two chained slices — the smoke with its verification, then this
record. Manual SQL smoke; neither slice ships JS.
Scope source: `features/organization-members.feature` (F1).

> **This is not the F1 feature record.** `odd/tasks/f1-membership-admin.md` is,
> and the PR4 slice owns it (recovered as #540). This file is scoped to what
> this unit actually ships — the smoke that proves the `0021` permission matrix
> against a real database — under a name no other slice claims.

## Why this branch exists

#533 and #535 did the right thing in the wrong base. They were cut from a
`main` that predated #459 (audience view) and #530 (the F1 BDD), so merging
them would have reverted counts the tree had already moved past:

- `AGENTS.md` 49 features / 789 scenarios → 48 / 776
- `docs/master-plan.md` the same pair
- `AGENTS.md` the "Dependent slices use GitHub's native stacks" clause and
  delivery clause 7, both deleted

They also carried a doctrine change the maintainer did not accept (see
Decision 2). A branch already pushed cannot be rewritten — `force-with-lease`
is blocked in this environment — so the content was recut from the current
`main` instead. #533 and #535 are closed as superseded by this slice.

## The smoke

`scripts/smoke/0021-identity-account-lifecycle.sql`, 21 assertions, run once
after `supabase db reset` (not idempotent — see Decision 3):

- `org_admin` re-roles member → instructor → branch_admin → member.
- `org_admin` removes instructor, branch_admin and member; each lands as
  `status = 'former'` with `left_at` set — the assertion that would have caught
  `'removed'`.
- Neither `org_admin` touches an `org_owner`: `cannot modify org_owner`,
  `cannot remove org_owner`.
- A caller with no membership is refused with `not authorized`, and writes no
  audit row.
- A role change keeps the branch the caller did not pass.
- `org_admin` cannot appoint an `org_owner` through the role-change path.
- Re-adding a former member leaves exactly one active row.
- `authenticated` cannot insert into `org_memberships` directly.
- Deleting an actor leaves its audit rows with a null actor.

Observed: **21 PASS / 0 FAIL** on a fresh reset, against the header's
`-- Expects 21 PASS / 0 FAIL`. No smoke covered `0021` before this; the file
named `0021-plan-freeze.sql` covers `0034` and is unrelated.

The smoke grew from 16 assertions to 21 across #533 and #535: the last five
cover the four defects the migration review found (branch preservation, the
`org_owner` appointment rule, the org-level reactivation upsert and the
`revoke insert, update` on `org_memberships`) plus the actor-erasure audit row.

## Decisions

1. **Size — two chained slices, no `size:exception`.** The smoke is 310 lines
   and this record 138; together with the three prose lines they come to 465
   authored lines, over the 400 budget. `scripts/check-pr-size.mjs`
   offers a `size:exception` label, but the repo's own strategy for an
   oversized unit is a chained slice (`AGENTS.md`: "PRs stay ≤400 changed
   lines; bigger work ships as chained `-prN-` slices"), so the unit is cut
   rather than labelled:

   | Slice | Content | Authored lines | Base |
   |---|---|---|---|
   | A — `f82f072` | the smoke + the three prose lines | 327 | `main` |
   | B — this record | `odd/tasks/f1-0021-smoke.md` | 138 | slice A |

   The atomic verification is not split: the smoke and the doc lines that
   describe it ship together, and only the narrative record travels second.

2. **`0022` stays reserved; the next free number for general use is `0047`.**
   The maintainer ruled this on 2026-11-20. #533 had gone the other way: it
   removed the `0021`/`0022` special cases from `next_free` in
   `scripts/check-doc-counts.sh`, so the gate would report the genuine lowest
   unclaimed slot, `0022`, and the prose was rewritten to match.

   The reasoning behind the ruling: `AGENTS.md` reserves `0021`/`0022` for
   migrations that must sort **before** an existing one — the case that
   cannot simply take `0047`. #523 claimed `0021` because the F1 migration is
   self-contained and its position does not matter. `0022` is now the only
   early slot left, and reporting it as the general "next free" number
   invites a self-contained migration to take it and close that case. So
   `next_free` keeps skipping both `0021` and `0022`, and the prose keeps
   saying `0047`.

   The counter-evidence is recorded rather than hidden:
   `docs/master-plan.md:238` says *"The 0020–0022 gap is not deliberate. No
   ADR or decision record reserves those numbers."* That analysis was correct
   about the **past** — it described a numbering race from September 2026, and
   it explicitly retracted an older inference that the gap was deliberate.
   The 2026-11-20 ruling is a **new** decision, not that old inference coming
   back, so the post-mortem keeps its text and gains a dated note.

3. **The smoke is not idempotent, like the rest of the repo's smokes.** A
   fresh `supabase db reset` before every run. A second run over the same
   database yields three spurious FAILs (`pre1`, `13`, `15`) because the
   fixtures are already there. That is state, not a regression.

## Findings outside this slice

- PR2's `src/data/repositories/orgMembers.js` `USER_ERRORS` still lists
  `'only org_owner can change member roles'` and `'only org_owner can remove
  members'`. `e3fbd00` replaced both with `'not authorized'`, which the set also
  contains, so the mapping still surfaces the real error — the two entries are
  dead, not broken.
- Smoke filenames do not track migration numbers, and this one happens to
  match its migration. That is a coincidence, not a new convention.

## Size exception (2026-11-23)

`size:exception` is applied to #541 deliberately, and the unit is larger than
L5 planned. L5 cut the work into two slices (327 + 138 authored lines) so the
two would each fit under 400. #542 — the execution record — then merged into
this PR's branch, so the two slices measure as one PR: 478 authored lines
against `main` after the merge with #537/#540.

The alternative the gate suggests (slice it) is not available honestly here.
The smoke is one permission matrix: its assertions share a single fixture and a
single audit-row count (assertions 13–15), so splitting it would ship a partial
matrix and a second run against the same database, which the smoke is
on-purpose not idempotent for. The record cannot be deferred either — it is the
only place the `0022` ruling and the 400-line rationale are written, and #542
already merged, so re-opening it separately would require rewriting a pushed
branch, which this repo forbids. The reviewer reads the same 478 lines under
the label as without it; the label records the overage rather than hiding it.

## Log

**L1** (assistant): The smoke lands with 16 assertions covering the `0021`
permission matrix. Verified 16 PASS / 0 FAIL.

**L2** (assistant): `next_free` in `scripts/check-doc-counts.sh` loses its
`0021`/`0022` special cases so the gate reports the real lowest unclaimed
slot, `0022`; the prose follows. Verified with a temporary `0022_probe.sql`:
the gate reported `0047` and exited 1, then exited 0 again once the probe was
deleted.

**L3** (assistant): Five more assertions cover the four defects the migration
review found plus the actor-erasure audit row. 21 assertions total.

**L4** (assistant): The doctrine change is reverted and the slice is recut
from the current `main`. The maintainer ruled on 2026-11-20 that `0022` stays
reserved and `0047` remains the next free number for general use. The recut
also drops the stale-base regressions #533 carried (feature counts 49 → 48,
scenarios 789 → 776, and the deleted native-stacks clauses).

**L5** (assistant): The unit is cut into two slices (327 + 138 authored lines)
to stay inside the 400-line budget without a `size:exception` label. Verification
of the recut — lint, typecheck, 33 test files / 529 tests, build, doc counts
(46 migrations, 24 smokes, 49 features, 789 scenarios, 0047 free), visual
contract 12/12, and the smoke again at 21 PASS / 0 FAIL on a fresh reset.

**L6** (assistant): `scripts/check-doc-counts.sh` goes back to `main`'s version.
An explanatory comment had been added there, but the functional diff was zero —
`main` already skipped `0021` and `0022`, which is exactly the ruling — and the
same explanation is carried by `AGENTS.md`, `docs/master-plan.md` and this
record. The native review flagged the file path (`shell_process`), not the
change; with the redundant comment gone the candidate is `under_budget` again
and no shell file is in the diff.

**L7** (assistant): #537 and #540 merge to `main` (2026-11-23), and the branch
is brought up to date by merging `main` (no force-push, no conflicts). The
`authored-lines` check then reports 478 lines — the stacked record is now part
of this PR — so `size:exception` is applied with the justification above.
Re-verified after the merge: smoke 21 PASS / 0 FAIL on a fresh reset, lint,
typecheck, tests and build green, doc counts 46/24/49/789, visual contract
12/12.
