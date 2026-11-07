# Migration and smoke inventory — refresh against `main` = `d324021`

- **Change:** documentation repair of the inventory that every agent reads before writing a
  migration.
- **Branch:** `docs/migration-smoke-inventory`, from `origin/main` = `d324021`.
  Re-verified after #430 merged `0046`: the counts below are the post-merge measurement, and the
  earlier `86ab810` figures are kept only inside the historical notes.
- **TDD:** off (`openspec/config.yaml:13`, `strict_tdd: false`). Docs-only: no source behaviour, no
  test runner involved. Verification is that each number in the prose is re-measured from git and
  matches, plus CI on the PR.
- **RDD:** on (global). Native review must not be started on this runtime (OpenCode V2 — the Review
  Execution Contract forbids it). Substitute in place of a receipt: the fact-assertion run below,
  re-executed by the parent.

## Problem

`AGENTS.md` told the next agent, in the present tense:

> Migrations: **38 files on `main`**, numbered `0001`–`0040` … **The next free number is `0041`.**

`origin/main` carried **44 migrations through `0046_feedback_triage_and_github_link.sql`** at the
2026-11-04 re-verification (43 through `0045` when this record was written). `0041`–`0046` are all
taken. An agent following that paragraph picks a number that already exists;
`scripts/check-migrations-unique.sh` catches the collision in CI, so the cost is a wasted cycle, not
corruption — but the file states a fact that is false, which is the failure mode this repo keeps
recording (backlog #10–#12: a gate or a directive that reports something it never checked).

The smoke section was wrong the same way: "16 files … through `0039`" against 22 files through
`0046` (21 through `0045` at the time of writing). `docs/master-plan.md` §0 — the table introduced as "verified, not read from prose" — carried
the same 38 / `0040` / next `0041`, plus stale `main`, test-file, `@ts-check` and Hito 6 rows.

## Scope (authorised)

`AGENTS.md` (SQL smoke section + Database layer) and `docs/master-plan.md` (§0 table, §2
post-mortem note). Nothing else. `docs/mvp-scope.md` and `docs/technical-spec.md` carry their own
dated snapshots ("33 migrations, `0001`–`0033`, contiguous", verified 2026-09-30) and are correct
*as of their stated date*; they are listed under "Still stale" rather than edited here.

## What changed

| File | Fact | Was | Now |
|---|---|---|---|
| `AGENTS.md` | migrations on `main` | 38, `0001`–`0040` | **44, `0001`–`0046`**, `0021`/`0022` still a deliberate gap |
| `AGENTS.md` | next free number | `0041` | **`0047` — `0046` merged in #430** |
| `AGENTS.md` | smoke scripts | 16, through `0039` | **22, through `0046-feedback-triage.sql`** |
| `AGENTS.md` | smoke coverage | only `0036`/`0040` named as missing | explicit **has / has not** split |
| `AGENTS.md` | "wrong four times" | 4 | **5**, with the date and the exact stale claim recorded |
| `master-plan.md` §0 | header base | 2026-10-12 at `c14e977` | **2026-11-04 at `d324021`**, with the earlier passes listed |
| `master-plan.md` §0 | `main` | `d3f1269` | **`d324021`** |
| `master-plan.md` §0 | test files | 23 (18 + 5) | **32 (27 + 5)** |
| `master-plan.md` §0 | migrations / next free | 38 / `0041` | **44 / `0047` free** |
| `master-plan.md` §0 | smoke scripts | *(no row)* | **new row: 22, manual, not in CI, filename ≠ migration number** |
| `master-plan.md` §0 | Hito 6 | "not started — no implementation" | **privacy slice shipped** (`0038`/`0039`, `0042`–`0044`); four features unstarted |
| `master-plan.md` §0 | `@ts-check` opt-ins | 47; `tsc --listFiles` 62 | **48**; the 62 is labelled "at `c14e977`, not re-measured" |
| `master-plan.md` §0 + `AGENTS.md` §Methodology | `.feature` files / scenarios | 46 / 734 | **47 / 747** — the feedback-triage feature added 13 scenarios |
| `master-plan.md` §2 | post-mortem block | 38 / `0040` / next `0041` | **44 / `0046` / `0047` free**, with the old numbers kept as the measurement the block was written against |

## Verification

Every number in the prose is asserted against git, not eyeballed:

```bash
fail=0
chk() { if [ "$2" = "$3" ]; then echo "PASS  $1 = $3"; else echo "FAIL  $1: prose $2, measured $3"; fail=1; fi; }
mig=$(git ls-tree --name-only origin/main supabase/migrations/ | wc -l);          chk "migrations"        44 "$mig"
smo=$(git ls-tree --name-only origin/main scripts/smoke/ | wc -l);                chk "smokes"            22 "$smo"
tst=$(git ls-tree -r --name-only origin/main src/ | grep -cE '\.test\.(js|jsx)$'); chk "test files"      32 "$tst"
ght=$(git ls-tree -r --name-only origin/main src/test/gherkin/ | grep -cE '\.test\.(js|jsx)$'); chk "gherkin-tier files" 5 "$ght"
tsc_=$(git grep -l '@ts-check' origin/main -- 'src/**/*.js' | wc -l);             chk "ts-check opt-ins"  48 "$tsc_"
fea=$(git ls-tree --name-only origin/main features/ | wc -l);                     chk "feature files"     47 "$fea"
sce=$(git archive origin/main features | tar -xO --wildcards '*.feature' | grep -cE '^\s*(Scenario|Scenario Outline):'); chk "gherkin scenarios" 747 "$sce"
tip=$(git rev-parse --short origin/main);                                         chk "main tip"      d324021 "$tip"
for f in odd/tasks/offboarding-cascade.md odd/tasks/account-data-export-and-erasure.md odd/tasks/hito5-substitutions-and-coverage.md; do
  git cat-file -e origin/main:$f 2>/dev/null && echo "OK    $f" || { echo "MISSING $f"; fail=1; }
done
free=$(git ls-tree --name-only origin/main supabase/migrations/ | grep -c '^0047'); chk "0047 free on main" 0 "$free"
git diff --check && echo "no whitespace errors" || fail=1
if git grep -nE '^(<<<<<<<|>>>>>>>) ' -- . >/dev/null 2>&1; then echo "conflict markers found"; fail=1; else echo "no conflict markers"; fi
[ $fail -eq 0 ] && echo "RESULT: ALL PASS" || echo "RESULT: FAILURES"
```

Result at `main` = `d324021`:

```
PASS  migrations = 44
PASS  smokes = 22
PASS  test files = 32
PASS  gherkin-tier files = 5
PASS  ts-check opt-ins = 48
PASS  feature files = 47
PASS  gherkin scenarios = 747
PASS  main tip = d324021
OK    odd/tasks/offboarding-cascade.md
OK    odd/tasks/account-data-export-and-erasure.md
OK    odd/tasks/hito5-substitutions-and-coverage.md
PASS  0047 free on main = 0
no whitespace errors
no conflict markers
RESULT: ALL PASS
```

Every path the new prose cites resolves on `main` (gatekeeper rule: a path a doc claims must exist).

Not run, and why: `pnpm lint` / `typecheck` / `test` / `build` and `check-visual-contract.sh` read
`src/` and `.jsx`; this diff touches two `.md` files and one `odd/tasks/` record, so none of them
can change. CI runs the full chain on the PR regardless, and that is the gate of record.

## Still stale, deliberately not touched

- `docs/mvp-scope.md:243,380` — "33 migrations numbered `0001`–`0035`". True when Hito 5 closed; it
  is a dated milestone statement, not an instruction.
- `docs/technical-spec.md:241` — "33 migrations, `0001`–`0033`, contiguous", inside a block dated
  "verified 2026-09-30 against `main` = `762a040`". Also stale there: the CI chain it lists
  (`install → lint → check-visual-contract.sh → test → build`) predates `deno check`, `typecheck`,
  `test:gherkin` and the gate reordering from #337.
- `docs/mvp-scope.md:361,365` — the renumbering log's "next free is now `0036`". A log, correct at
  its entries.

These are a separate unit: each is a dated snapshot that needs a *dated correction*, not a new
number dropped into an old sentence.

## Risks

- **Low, and one of them is real:** a doc that states a false count is worse than a doc with no
  count, because it stops the reader from measuring. The mitigation is already in the text
  ("re-count rather than trusting this paragraph") and is now dated, so the next drift is visible
  rather than silent.
- The new "claimed by #430" wording becomes wrong the moment #430 merges. That is intentional: it
  names the PR, so the stale half is checkable in one step, instead of an unqualified "next free".

## Next

Nothing depends on this unit. The plan's next slice is N3's `export-and-sharing`
(`docs/master-plan.md` §6), which is a product decision, not a default.
