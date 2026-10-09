# Architecture hardening — boundaries, tests, and the offline outbox

## Objective

Close the measured gaps between cemurm's actual architecture and its stated one, without a
framework migration. Five targeted changes: enforce the domain boundary in lint, move two
domain leaks, add tests to the untested impure half, and give the offline queue a server-side
outbox.

## Problem

Measured on `main` (2026-10-09), not assumed:

| Finding | Evidence |
|---|---|
| Domain layer is not pure | `src/domain/music/degreeResolver.js:10` (static import of a pure catalog misfiled in `data/`), `src/domain/music/annotations.js:20` (lazy runtime `await import` of the live Supabase client) |
| Layering is prose only | `.eslintrc.cjs` has one custom rule (`no-unused-vars`); no `no-restricted-imports`, no `no-cycle`, no import plugin. `docs/decisions.md:224` (ADR-010) admits it: "the boundary is a rule, not a compiler check" |
| Risk and coverage are inverted | `src/domain/**` 269 tests; `src/data/repositories/**`, `src/offline/**`, `src/features/**`, `src/app/**`, `src/hooks/**` all zero |
| Offline sync loses writes silently | `last-write-wins` outside `RECONCILE_OPS` (`src/offline/drainer.js:6`); no idempotency key, no dedupe, `seq` is a local array index (`src/offline/queue.js:147`); explicitly non-transactional (`src/offline/queue.js:8-10`) |
| `AGENTS.md` is wrong about RLS | States "implemented RLS is owner-scoped only". Org/branch branching is implemented in 27 policies via `private.is_org_member()` and `private.session_org_ids()` |

## Why

The domain kernel is real and worth protecting: 2,495 of 3,009 production LOC are pure and
I/O-free (82.9%), across 11 of 13 files. The boundary already holds on its own. What it lacks is
a lock, tests where the risk actually is, and a server that can arbitrate offline writes.

Explicitly rejected: microservices (the backend is Postgres — 174 policies, 142 SQL functions,
51 RPCs, 1 edge function; splitting it duplicates or bypasses authorization and breaks atomic
multi-row writes) and a formal Hexagonal migration (would create ~100 ports where one has
leverage).

## Scope

### In
- `.eslintrc.cjs` — add one import-boundary rule
- `src/domain/music/degreeResolver.js`, `src/data/repositories/scaleCatalog.js`, all importers of `scaleCatalog`
- `src/domain/music/annotations.js` + a new module under `src/data/`
- `src/data/repositories/**` — test seam and tests
- `src/offline/**` — test seam and tests
- `supabase/migrations/0034_*.sql` — server-side outbox
- `AGENTS.md` — RLS correction

### Out
- No framework, bundler, or dependency change
- No change to `src/features/**` behavior
- No microservices, no additional edge functions
- No visual/token changes (`scripts/check-visual-contract.sh` must stay green untouched)

## Constraints

- pnpm only; never npm
- Vitest runs in the **node** environment — no jsdom, no testing-library. Tests that need
  IndexedDB or a Supabase client must inject a fake; this is what forces AH-4 and AH-5.
- Tests are **characterization** tests: they record what the code does today. A failing one is
  fixed in the source, never in the assertion.
- Migration numbering: `0001`–`0033` are contiguous on `main`; **0034 is free**.
- Worktree has its own `node_modules` (symlinking to the repo's would run stale versions).

## Checklist

- [x] **AH-0** Set up isolated worktree + feature branch from `origin/main` (6a8f414)
- [x] **AH-1** Add `no-restricted-imports` blocking `../../data` inside `src/domain`; correct the
      RLS claim in `AGENTS.md`
- [x] **AH-2** ~~Move `scaleCatalog.js` into `src/domain`~~ — **abandoned, premise was false.**
      `scaleCatalog.js` does I/O (reads the `scale_catalog` table). Moving it would have *added*
      a leak. Instead `degreeResolver.js` no longer looks scales up: it receives them.
- [x] **AH-3** Move the `annotations.js` network read out of the domain into `src/data/`
- [ ] **AH-4** Injectable client seam + characterization tests for `src/data/repositories/**`
      (started: `annotations.test.js` added)
- [ ] **AH-5** Injectable store seam + characterization tests for `src/offline/**`
- [ ] **AH-6** `0034_` server-side outbox: table + drain, giving idempotency and ordering to
      replace `last-write-wins`

## Deviations from the original plan

1. **AH-2 was planned as a file move and became a signature change.** The move was justified by
   the claim that `scaleCatalog.js` was pure (156 LOC, "zero imports"). It was not — it reads
   the `scale_catalog` table via a lazy `await import('../supabase.js')`. The claim came from a
   `grep` on `from ...` clauses, which cannot see a dynamic import. Decision taken with the
   maintainer: **Option A**, inject the scale instead of moving the file.
2. **`scaleCatalog.js` stays where it is.** It is a correct data-layer module.
3. **A second lint rule was required.** `no-restricted-imports` inspects only static import
   declarations, so the `annotations.js` dynamic leak was invisible to it. A `no-restricted-syntax`
   selector on `ImportExpression` closes that. Neither rule is redundant.

## Acceptance criteria

1. `no-restricted-imports` fails on a domain file importing `../../data` (proved by a temporary
   violating file, then removed).
2. Zero remaining cross-layer imports from `src/domain/**` to `src/data/**` or any other layer.
3. `pnpm test && pnpm typecheck && pnpm lint && pnpm build` green, plus
   `bash scripts/check-visual-contract.sh` green.
4. Repositories and offline modules have a non-zero test count.
5. No characterization test edited to make a gate pass.

## Checks

```bash
pnpm install --frozen-lockfile
pnpm test && pnpm typecheck && pnpm lint && pnpm build
bash scripts/check-visual-contract.sh
node /tmp/opencode/arch-graph2.mjs   # re-measure the dependency graph
```

## Progress

- **AH-0** — done. Worktree at `cemurm-worktrees/architecture-hardening`, branch
  `feat/architecture-hardening`, from `origin/main` (6a8f414). Isolated from the uncommitted
  `feat/design-infrastructure` work in the main checkout.
- **AH-3** — done, commit `0c556bc`. Network read moved to
  `src/data/repositories/annotations.js`; three feature pages repointed; first characterization
  test added under `src/data/repositories/**`.
- **AH-1 + AH-2** — done, commit `3ad8213`. Scale injected into `degreeResolver`, boundary
  enforced by two eslint rules, `AGENTS.md` RLS claim corrected.
- **AH-4** — in progress, `annotations.test.js` landed inside `0c556bc`.

## Verification evidence

| Commit | Tests | typecheck | lint | build | visual | gherkin |
|---|---|---|---|---|---|---|
| `0c556bc` | 354 / 15 files | clean | clean | ok | OK (10 rules, 0 failing) | — |
| `3ad8213` | 355 / 15 files | clean | clean | ok | OK (10 rules, 0 failing) | 41 |

**Domain purity, measured after `3ad8213`** with a whole-file import regex that resolves paths
(catches `await import(...)`, unlike a `from`-clause grep):

```
src/domain/** files:          21
edges domain -> other layer:    0     ← was 2 (degreeResolver.js:10, annotations.js:20)
edges domain -> domain:        11     (intra-domain, allowed)
```

**RED observed before GREEN**, as required. `pnpm lint` failed on exactly the two known leaks
before the source was fixed, which is what proved the rules actually bite.

**One self-check assertion authored wrong and corrected**: `resolveDegree(..., 'Fm', C_MAJOR)`
was expected to be `'ii'`; F is the 4th degree of C major, so the correct answer is `'iv'`. The
demo failed, and the expectation was corrected to the true value — this was a newly authored
assertion, not a characterization test weakened to pass.

## Next step

AH-4 — characterization tests for the remaining repositories, using the client seam that
`annotations.test.js` already demonstrates.