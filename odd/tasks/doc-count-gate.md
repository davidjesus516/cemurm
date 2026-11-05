# Doc counts — the numbers in `AGENTS.md` and `master-plan.md`, verified

- **Change:** repository hygiene. A gate for counts that have drifted five times.
- **Branch:** `chore/doc-count-gate`, from `origin/main` = `ad6b34c`.
- **TDD:** off (`openspec/config.yaml:13`, `strict_tdd: false`). Shell + two documents; no unit
  test runner is involved. Verification is a positive run, two deliberate corruptions and CI.

## Problem

`AGENTS.md` and `docs/master-plan.md` tell the next agent how many migrations and smoke scripts
exist, how many features and scenarios the BDD tier holds, and which migration number is free.
Nothing verified any of it.

The record of that failure is in the files themselves: `AGENTS.md` said "wrong four times" until
2026-11-01 and "five times" after. The numbers were 38 migrations / 16 smokes while `main` carried
43 / 21; then 43 / 21 while it carried 44 / 22. `docs/master-plan.md` §0 is introduced as the table
that was "verified, not read from prose" and duplicated the same claims, so correcting one copy and
not the other is how the two came to disagree inside the same afternoon.

The 2026-11-04 session reproduced it three times in one day: #434 was re-measured once when it
opened, again after #430 merged, and again after #437 and #432 merged. Each time the numbers were
stale within hours, and each time a human noticed.

PR #435 wrote this check and deferred it (`odd/tasks/workflow-gates.md` T3/T4), for one honest
reason: a gate whose data is wrong on `main` cannot be green on `main`, and the data correction
belonged to #434. #434 has merged, so the dependency is satisfied.

## What it checks

| Claim | Source of truth |
|---|---|
| migrations on `main` | `supabase/migrations/*.sql` |
| next free migration number | the lowest `NNNN` no file claims, skipping the reserved `0021`/`0022` |
| smoke scripts | `scripts/smoke/*.sql` |
| feature files | `features/*.feature` |
| gherkin scenarios | `Scenario:` / `Scenario Outline:` lines across `features/*.feature` |

Each claim is read from **both** `AGENTS.md` and `docs/master-plan.md`, ten checks in total, so the
two copies cannot drift apart again.

## Constraints

- Bash + `grep` only, no install step and no network, matching `check-migrations-unique.sh`,
  `check-test-integrity.sh` and `check-visual-contract.sh`.
- Runs before the visual gate and after `test`/`build`, because it can exit 1 and a failing step
  under `set -euo pipefail` marks everything after it SKIPPED.
- Exit 0 prints every count it verified. Exit 1 names the claim, the documented number and the
  measured one, and says to fix the document rather than the script.

## Verification

Positive run on `main` = `ad6b34c`:

```
ok    AGENTS.md migrations         44
ok    AGENTS.md next free migration 0047
ok    AGENTS.md smoke scripts      22
ok    AGENTS.md feature files      47
ok    AGENTS.md scenarios          747
ok    master-plan migrations       44
ok    master-plan next free migration 0047
ok    master-plan smoke scripts    22
ok    master-plan feature files    47
ok    master-plan scenarios        747

doc counts: OK (44 migrations, 22 smokes, 47 features, 747 scenarios, 0047 free)
```

Negative run, two numbers corrupted in `AGENTS.md` on purpose (`44`→`43`, `0047`→`0041`):

```
FAIL  AGENTS.md migrations         documented 43, measured 44
FAIL  AGENTS.md next free migration documented 0041, measured 0047
...
exit=1
```

The seven untouched checks stayed green, which is what "names that exact claim" means.

## Also fixed here

`AGENTS.md` described `0046` as "already claimed by the open feedback-triage chain (#430)". #430
merged on 2026-11-04, so the slot is taken, not claimed. Small, but this PR exists because a
sentence like that is how the counts went wrong in the first place.

## Risks

- A gate over prose patterns is brittle: rewording the sentence it matches silently disables one
  check. `doc_num` returns empty when the pattern misses, and an empty documented value fails
  against a measured number rather than passing, so the failure mode is a red gate and not a
  green one. The patterns are anchored on the leading words of each claim for that reason.
- A `docs/master-plan.md` reflow breaks the row patterns. Same answer: it fails loudly.
- `Scenario Outline:` counts as one scenario, matching how the existing 747 was measured.
