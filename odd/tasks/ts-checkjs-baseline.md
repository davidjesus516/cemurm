# ts-checkjs-baseline — JSDoc + checkJs type baseline

> Feature: TypeScript re-evaluation per `docs/engineering-review-backlog.md` §1 (trigger: close of Hito 3, which shipped 2026-09-19).
> Authorized: 2026-09-23 by user ("yep lets make the change"). Branch: `feat/ts-checkjs-baseline` (isolated worktree, base `origin/main` f8b760a).

## Objective

Establish the low-risk type baseline prescribed by the engineering review: JSDoc annotations + `checkJs`, typed domain `lib/` only.

## Problem / Why

Hito 3 closed, so the back-log trigger fires. A full `.ts` migration is out of scope (repo contract is JSX; 130+ modules). The review prescribes: JSDoc + `checkJs` first (zero build cost), then types in domain `lib/` only. This change delivers exactly that slice.

## Scope

- `tsconfig.json` at repo root (allowJs, per-file opt-in via `// @ts-check` — see T1 deviation note).
- `package.json`: `typecheck` script + `typescript` devDependency (via pnpm).
- JSDoc types on the four domain libs: `src/lib/transpose.js`, `src/lib/annotations.js`, `src/lib/songs.js`, `src/lib/setlists.js`.

Out of scope (do NOT touch): `pages/`, `components/`, `hooks/`, other `src/lib/` files, `docs/`, `features/`, `supabase/migrations/0027_*`, `dist/`, any hito5 files.

## Tasks

- [x] T1 — Infra: install `typescript`, create `tsconfig.json`, add `typecheck` script. `pnpm typecheck` exits clean on current code. Commit `a2c6dca`.
- [x] T2 — JSDoc types on `src/lib/transpose.js`. Commit `7fe6a92`.
- [x] T3 — JSDoc types on `src/lib/setlists.js` (commit `8f57b53`) and `src/lib/annotations.js` + `src/lib/songs.js` (commit `774cd56`).
- [x] T4 — Final checks green: `pnpm typecheck`, `pnpm lint`, `pnpm build`; work-unit commits recorded.

## Acceptance criteria

- [x] `pnpm typecheck` exits 0 with no errors.
- [x] `pnpm lint` exits 0 (max-warnings 0).
- [x] `pnpm build` succeeds (pre-existing >500 kB chunk warning only).
- [x] Zero behavior changes: annotation + cast-only work; the three sort comparators use `.getTime()` (semantically identical via valueOf semantics); one runtime-neutral `updatedAt` in a fallback literal (always overwritten by the optimistic spread; the `Setlist` typedef requires the field).
- [x] Only the scoped files are modified/staged in commits; no unrelated files committed.
- [x] No `.ts` file conversions; JSX contract preserved.

## Checks

- TDD: OFF — project has no test runner (`AGENTS.md`); functional checks are typecheck + lint + build.
- Verification commands (writer + parent spot check): `pnpm typecheck` (0 errors; parent re-ran, exit 0), `pnpm lint` (0 warnings), `pnpm build` (success).

## Progress / Verification evidence

- Engram mirror: topic `odd/ts-checkjs-baseline/tasks`, project `cemurm` (obs 287, saved 2026-09-24; judgments: 3 not_conflict resolved).
- Chain (feature-branch-chain, user-approved 2026-09-24; original linear commit `87e2a94` split into two slices to keep every PR ≤400 changed lines — one honest slicing pass):
  - tracker `feat/ts-checkjs-baseline` @ `f8b760a` — draft PR → `main`, no-merge until children land
  - PR #1 `feat/ts-checkjs-baseline-pr1-infra` @ `a2c6dca` — tsconfig + typecheck script + typescript devDep + lockfile (242 changed, 211 generated)
  - PR #2 `feat/ts-checkjs-baseline-pr2-transpose` @ `7fe6a92` — transpose JSDoc (91)
  - PR #3 `feat/ts-checkjs-baseline-pr3-setlists` @ `8f57b53` — setlists JSDoc (320)
  - PR #4 `feat/ts-checkjs-baseline-pr4-songs-annotations` @ `774cd56` — songs + annotations JSDoc + this record (303)
- Baseline before annotations: 233 type errors (annotations 18, setlists 130, songs 61, transpose 24); after: 0.

## Deviations from the original plan (all reported, none silent)

1. **checkJs → per-file `// @ts-check` pragma.** Global `checkJs: true` with `include: ["src/lib"]` type-checks the whole `src/lib/` import graph (~760 errors, ~530 in out-of-scope files like gigs/rehearsals/services/comments/offlineCache). The four scoped files opt in individually with the canonical pragma — identical checking semantics for the opt-in files, exact checked surface. Rationale recorded in `tsconfig.json`. Remaining libs stay unchecked until a later pass.
2. **`Date - Date` → `.getTime()`** in 3 sort comparators (TS2362/2363 in tsc 5.9 + TS 7). Behavior identical (Date valueOf semantics).
3. **TS 7.0.2 catch-variable quirk**: catch vars infer `unknown` (5.9 gave `any`) → `/** @type {Error} */ (e)` casts at catch sites reading `e.message`.
4. **`listPlayedAt` statement split** + cardinality fix: untyped Supabase client types the to-one `performances(...)` embed as an ARRAY → double-cast to `PlayedAtRow | null | undefined`.
5. **TS1127 lexer quirk** — `@param {boolean} [name] —` (em-dash after optional bracket) is a parse error; avoided everywhere.
6. **One dead field**: `updatedAt` added to `buildOptimisticCollab`'s fallback literal — required by the `Setlist` typedef, always overwritten by the optimistic spread.

## Native review record (RDD enabled, global)

- Assessment: `gentle-ai review assess --cwd . --base-ref f8b760a --committed-only --json` → **medium** (reason: configuration_change in package.json), changed_paths 8, changed_lines 956, review_due reason `slice_budget_reached`.
- Preflight STATUS → `fresh_target_ready`; START executed provider-issued tokens (lineage `review-d8f2cb5a25581a96`, target `sha256:2657b6e…`, medium, 1 lens `review-reliability`, correction budget 200) after user consent **granted** (consent/v3 relayed losslessly).
- Collect reached `reviewer_results_required`; capture-result materialization failed: **the active runtime is not eligible for immutable receipt review** — supported immutable review runtimes: `claude-code`, `codex` (`gentle-ai.review-integration.failure/v2`, code `invalid_request`, phase preflight, mutation_outcome not_started). No reviewer was launched on an unsupported path (contract: never run V2 reviewer subagents on an unavailable transport).
- Disposition: authority released via `gentle-ai review abandon --reason operator_disposition` (record committed 2026-09-24, quarantine path in main `.git/gentle-ai/review-transactions/quarantine/`); residue `review-state.json`; findings_present false; no receipt, no approval.
- **Outcome per task record: unavailable** (transport). Delivery follows ordinary repository policy (RDD stays enabled; a future review of the same committed slice can be started from a `claude-code`/`codex` runtime).

## Delivery

- Strategy: **feature-branch-chain** (chained-pr skill; repo precedent: Hito 3 tracker integration `feat/hito-3-notifications` + `-prN-` children).
- 4 child PRs (each targets its immediate parent branch) + draft no-merge tracker PR → `main`. Review diffs show exactly one work unit each.
- Merge cascade after all reviews pass: PR #4 → PR #3 → PR #2 → PR #1 → tracker → `main`. Only the tracker merges to main.
- Push + PR creation: authorized by user 2026-09-24 ("Push + open all PRs"). Merge remains a user decision.
- PRs opened: #160 (infra→tracker), #161 (transpose→pr1), #162 (setlists→pr2), #163 (songs+annotations→pr3) — all `type:chore`, all checks green (lint-and-build + GitGuardian).
- **Tracker PR deferred**: GitHub refuses a PR with zero commits between base and head (`feat/ts-checkjs-baseline` == `main`). Create the draft tracker PR → `main` right after PR #160 merges into the tracker branch.