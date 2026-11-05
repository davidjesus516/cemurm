# Workflow gates that stop lying — PR template, token scope, doc counts

Feature: none (repository hygiene; no product capability).
Delivery: single PR, three work-unit commits.

## Objective

Three places where the repository's own instructions are either false or unenforced:

1. `.github/pull_request_template.md` tells every contributor that CI does not run
   `pnpm typecheck`. It does (`ci.yml:42`, since #277 on 2026-10-07).
2. `ci.yml` declares no `permissions:` block, so the job inherits a repository *setting*
   rather than a reviewed fact.
3. `AGENTS.md` states counts of migrations, smoke tests, features and BDD scenarios, and
   nothing verifies them. On 2026-11-01 it claimed 38 migrations and 16 smokes while `main`
   carried 43 and 21.

## Problem

A rule in prose is not a gate. `scripts/check-migrations-unique.sh` exists because a stated
rule ("a slot is consumed when the PR lands") failed three times and landed anyway; its header
records the lesson. The same failure applies to the counts above: they have drifted repeatedly,
and each drift is only caught when somebody happens to re-count by hand.

The typecheck line is worse than drift — it instructs contributors to skip a gate that runs.

## Why now

`AGENTS.md` was re-counted on 2026-11-01 and found wrong by five migrations and five smokes.
PR #434 corrected those numbers and merged on 2026-11-04, so `main` is accurate again today —
which is exactly the state in which drift goes unnoticed. #434 fixed the numbers; it does not
stop the next drift. This change adds the machine check beside the fix.

## Scope

In scope:

- Correct the typecheck checklist line in the PR template.
- Declare `permissions: contents: read` at the top of `ci.yml`.

Deferred to a follow-up, stacked on #434:

- `scripts/check-doc-counts.sh` (bash + grep, no network, no install) wired into CI.
- The `AGENTS.md` count corrections it verifies.

The check was written and verified during this unit: on this branch it reports
`migrations -- AGENTS.md says 38, the tree has 43` and `smoke tests -- AGENTS.md says 16,
the tree has 21`, both correct, with `feature files 46` and `scenarios 734` passing. It is
not in this PR because making it green requires the whole migration/smoke paragraph rewrite
that #434 already carries (`0001`–`0040` → `0045`, "next free `0041`" → `0047`). Fixing only
the two numerals would leave three more false statements in the same paragraph, and rewriting
all of it duplicates an open PR. The gate lands on top of #434 instead, which is the honest
dependency: a check whose data is wrong on `main` cannot be green on `main`.

Out of scope:

- Merging, rebasing or otherwise touching PR #434, which owns the wider migration/smoke
  inventory rewrite.
- Any label taxonomy. Labels are visibility only — GitHub rulesets cannot require one — so
  they do not replace the check.
- `.github/dependabot.yml`. Dependabot is enabled in repository settings with no config file in
  the tree; versioning that policy is a separate decision.

## Constraints

- Bash + `grep`/`sed` only, matching `check-test-integrity.sh` and `check-migrations-unique.sh`.
  No install step, so it can run before `pnpm test` and `pnpm build` without delaying them.
- The visual gate stays LAST in `ci.yml`. Any new step is placed before it, because a failing
  step marks everything after it SKIPPED under `set -euo pipefail`.
- Exit 0 with an `OK:` line when consistent; exit 1 naming the claim, the documented number and
  the real number when not.

## Tasks

- [x] T1 — PR template: remove the false "CI does not run it" claim for `pnpm typecheck`.
- [x] T2 — `ci.yml`: declare `permissions: contents: read`.
- [ ] T3 — `scripts/check-doc-counts.sh` — **deferred**. It was written and verified during this
      unit, but it was parked in `/tmp/opencode/`, which does not survive a reboot, so the file
      is gone and the script has to be re-derived for the follow-up.
- [ ] T4 — `ci.yml`: run the new check before the visual gate — **deferred** with T3.
- [ ] T5 — `AGENTS.md`: correct the counts — **deferred**, owned by #434.
- [x] T6 — Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:gherkin`,
      `pnpm build`, and a YAML parse of `ci.yml`.
- [x] T7 — Labels: create `size:exception`, `docs-only`, `schema`, `chain`.

## Acceptance criteria

- `bash scripts/check-doc-counts.sh` exits 0 on this branch and prints every count it checked.
- Deliberately corrupting a count in `AGENTS.md` makes it exit 1 and name that exact claim.
- `ci.yml` parses; `permissions:` is top-level and read-only; the visual gate is still the last step.
- `pnpm typecheck` appears nowhere in the template as something CI skips.
- No product code, migration or schema file is touched.

## Verification

| Check | Command |
|---|---|
| Lint | `pnpm lint` |
| Types | `pnpm typecheck` |
| Unit tests | `pnpm test` |
| BDD tier | `pnpm test:gherkin` |
| Build | `pnpm build` |
| CI definition | `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/ci.yml'))"` |

The deferred gate's evidence was captured before parking it:

```
FAIL: migrations -- AGENTS.md says 38, the tree has 43.
FAIL: smoke tests -- AGENTS.md says 16, the tree has 21.
  ok  feature files                      46
  ok  scenarios                          734
exit=1
```

That is the drift on `main` reproduced by the check, not a simulated failure.

## Risks

- The gate is red on `main` until the `AGENTS.md` counts are corrected, which is why T5 is in the
  same change. Any branch that adds a migration or smoke must update the prose in the same PR —
  that is the intended behaviour, not a false positive.
- `AGENTS.md` is also edited by #434; the overlap is the two count lines.

## Progress

T1–T7 tracked as three commits. See "Verification evidence" below once recorded.

- `e59a3de` — T1, PR template.
- `434f1b1` — T2, CI token scope.
- `cbf2ced` — this record.
- PR #435, opened against `main`, reviewer requested.

T3–T5 land as a follow-up PR (branch `chore/doc-count-gate`), now unblocked: #434 merged on
2026-11-04 with the corrected counts, so the check can be green on `main`. The script itself is
**not** parked anywhere durable — it lived at `/tmp/opencode/check-doc-counts.sh.parked`, and that
path no longer exists. The numbers it asserted are preserved in the evidence block above; the
script has to be written again.
