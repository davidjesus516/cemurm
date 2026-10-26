# Respond member guard — `respond_substitution` refuses a non-active responder

- **Change:** Hito 6 N2 carry-forward, **finding 1** of `odd/tasks/offboarding-cascade.md`.
- **Branch:** `feat/respond-member-guard-pr1-guard`, then `…-pr2-proof`, then `…-pr3-record`
  (stacked-to-main, same strategy as the offboarding chain).
- **Migration:** `0045_respond_member_guard.sql` — self-contained `create or replace` on the
  `0023` signature; next free number after `0044` on `origin/main` = `36174fc`}
  (verified from this branch before the first commit).
- **OpenSpec:** `openspec/changes/fix-respond-member-guard/proposal.md` — delta requirement for
  `features/substitutions-and-coverage.feature`'s lifecycle surface; no `.feature` edits (the
  offboarding scenario's promise is about candidate *generation*, which the DB already enforces).
- **TDD:** off (`openspec/config.yaml:13`). The honest verification for SQL behaviour is the two
  smoke scripts; the JS half has a vitest seam test (see Slice 1).

## Problem (one paragraph)

`respond_substitution` gated a response on the request's **frozen** `candidates` array only. A
listed candidate who has since left the org could still confirm (or decline) and, on accept,
self-assign onto the service plan — the `0038` cascade auto-cancels her own requests but leaves
other members' open requests with their frozen arrays untouched, by design. The fix re-checks
membership **at response time**, scoped like `substitution_candidates` (`0023:57-70`): the
service's org, widened to every `event_participants` org when the block's setlist belongs to an
event. That widening is what keeps the cross-org event accept (`0023` smoke T10) working; a plain
org-scoped guard was explicitly rejected because it breaks that specified behaviour.

## In scope / out of scope

**In:** the response-side guard in `respond_substitution` (accept + decline), the client allowlist
entry, the smoke, this record, the OpenSpec proposal. **Out:** the frozen arrays themselves (0038
boundary stands), the four sibling RPCs (`mark_unavailable` has its own member guard;
`cancel_substitution` requires the *current substitute* role, which leaving cannot strand;
`overrule_substitution` already carries its own active-member literal), and `.feature` edits.

## Tasks

- [x] **T1** — `0045`: event-scoped active-membership guard in `respond_substitution`, raising
      `'You are no longer an active member of this organization.'` before the frozen-candidates
      check. Grants persist (`create or replace` on the same signature — no re-grant).
- [x] **T2** — client: the literal joins `USER_ERRORS` (`substitutions.js`), so the UI surfaces it
      verbatim and the offline drain quarantines it as a permanent rejection on first failure
      (`drainFailure.js` case 7) instead of retrying a rejected op.
- [x] **T3** — `src/data/repositories/substitutions.test.js` (first test file for the module): 4
      cases pinning the mapping seam.
- [x] **T4** — `scripts/smoke/0045-respond-member-guard.sql` (327 lines): 14 assertions.
- [x] **T5** — falsifiability mutations on a fresh reset, both reverted byte-identical.
- [x] **T6** — ODD record + OpenSpec proposal + PR slices.

## Smoke: `0045-respond-member-guard.sql` — 14 PASS / 0 FAIL

On a fresh `supabase db reset`, single run, `rc=0`:

1. `pre1` fixture preconditions; `1–2` the request is org-scoped with frozen candidates `[ana]`;
   `3–4` the former member's **accept and decline** are refused with the exact literal;
   `5–6` the refusals wrote **nothing** (no substitute row, no accepted/declined responses row,
   request still open); `5b` a foreign-org member injected into the frozen array is refused too —
   membership in *an* org is not membership in *the scope*; `6–7` restoring the membership
   restores the ability (same accept now succeeds, exactly one confirm log);
   `8–9` the event scope still spans participating orgs and the cross-org accept succeeds (the
   0023 T10 shape, preserved); `10–11` the decline path on a second request is gated the same way
   and writes nothing.

Fixture surgery note: two assertions deliberately **inject** users into frozen arrays (`5b`, `10`).
The guard is response-side; candidate *generation* is already active-member-filtered
(`substitution_candidates`, `0023:92`). Injection isolates the property under test from the
generation side, which the 0038 record's reconciliation already relies on.

## Falsifiability (each mutation on a fresh reset, then byte-identical restore + 14/0 re-run)

| Mutation | Observed |
|---|---|
| **M1** — guard neutralised (`if false and not exists …`) | `3, 4, 5, 5b, 6` go red: the former member's accept **succeeds**, so the later attempts meet `'Position already covered.'` and the nothing-written assertions fail |
| **M2** — event widening removed (guard reads org-only) | the run **aborts mid-file after assertion 8**: tina's event accept raises the guard literal, psql `ON_ERROR_STOP` exits non-zero — the exact 0023-T10 break an org-scoped guard would cause |

Both mutations press the two independent halves of the guard: its existence (M1) and its scope
(M2). Neither could be red by accident against the *other*'s regression, which is why this unit
carries two rather than one.

## Regression smokes (fresh reset each)

| Smoke | Result |
|---|---|
| `0023-substitutions.sql` (cross-org T10 + full lifecycle) | **32 PASS / 0 FAIL**, `rc=0` |
| `0038-offboarding-cascade.sql` | **33 PASS / 0 FAIL** (its record's expected 33) |
| `0039-leave-handoff-guard.sql` | **18 PASS / 0 FAIL** (its record's expected 18) |

Note: 0023's smoke publishes no headcount of its own; 32/0 with `rc=0` is the recorded baseline
reading of this run. A first verification loop re-ran each non-idempotent smoke twice on one reset
and produced bogus tail FAILs ("Not a member."); the single-run readings above supersede that — a
lesson the 0038 header already warns about ("Single run only — not idempotent") and this record
re-learns honestly.

## JS gates

| Gate | Result |
|---|---|
| `pnpm test` | **466 passed / 25 files** (exit 0; additive — this unit contributes the one new file with 4 cases, so the pre-change tip read was 462/24) |
| `pnpm test:gherkin` | 44 passed / 5 files |
| `pnpm typecheck` | 0 (exit 0) |
| `pnpm lint` | 0 (exit 0) — after fixing a doubled comma the first allowlist edit left (`no-sparse-arrays`); caught by the gate, fixed in source |
| `pnpm build` | ✓ built |
| `scripts/check-visual-contract.sh` | OK — 12 rules checked, 0 failing |
| `npx tsc --noEmit --listFiles \| grep -c 'cemurm/src/'` | **78** — baseline alive (>1); +1 from the new test file |

## Honest limitations

- **No review receipt.** The runtime's native review is not started (V2); no adversarial verifier
  was run for this unit yet. The falsifiability pass (two mutations) plus the three regression
  smokes are the load-bearing evidence.
- **The smoke's whole-op rejections are proven by assertion, and the guard's place in the check
  order is load-bearing**: it runs *before* `Position already covered.`. A future reordering of
  the 0023 checks would change which literal a covered request shows a former member — still
  rejected, different words. Assertion 3 pins the current order; reordering it would be a
  behaviour change, not a refactor.
- **`respond_substitution` is not reachable through the offline queue's decline path** —
  `respondSubstitutionOfflineAware` queues **accepts only**; the decline mapping still matters for
  the online session (and for the drain replaying a queued accept). Recorded to keep the next
  reader from "simplifying" the CLIENT allowlist thinking the decline is dead code.
- **0023's smoke gained no new assertions** — the unit's blast radius is bounded by the three
  regression smokes plus the new one rather than by growing the old file, matching the 0038
  chain's precedent of appending, never renumbering.
- **AGENTS.md's smoke-file count is stale** (16 → 20 before `0045`, then 21 with it); not touched
  here — doc rot in the guide file is not this unit's surface, and every number in it is
  re-countable from `scripts/smoke/` in one line.

## Carry-forward

1. `docs/security.md:57,271` and `AGENTS.md:166` still claim "two confirmed users" against a
   `docs/local-dev.md` that says three (offboarding record finding 2 — untouched here).
2. `0034_plan_freeze.sql`'s seven unmapped literals (offboarding record finding 3 — untouched).
3. Doc rot on Hito 6 ("not started") in `mvp-scope.md`, `roadmap-ampliacion.md`,
   `bdd-coverage-map.md` and the generated `handbook.html` — the coverage map row for
   `offboarding-cascade` (`:134`) and `account-data` are the ones this unit's siblings falsified.
