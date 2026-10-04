# E2E chain — CI unblock (key filtration, lockfile, vitest, gitignore)

Work unit: repair the four defects that kept the Playwright E2E chain (#288–#297)
permanently red, without touching the harness design itself.

## Problem

All six PRs in the chain failed CI on every run since PR-1 opened (2026-10-03).
Four independent causes, all of the same class: **a required fix existed only in an
untracked local working tree**, so CI never saw it.

## Commits

| Branch | Commit | Change |
|---|---|---|
| `feat/e2e-playwright-harness-pr1` | `7afbf0d` | `build(deps): sync pnpm-lock.yaml with package.json` |
| `feat/e2e-playwright-harness-pr1` | `62fd5bd` | `test(vitest): exclude tests/e2e from the Vitest run` |
| `feat/e2e-playwright-harness-pr1` | `fab12f9` | `chore(gitignore): ignore .env.test and Playwright artifacts` |
| `feat/e2e-playwright-harness-pr6` | `b961eef` | `ci(e2e): pass the anon key through job outputs, not shell filtering` |
| `feat/e2e-playwright-harness-pr6` | `ba9d8f7` | cherry-pick: CodeQL autofix `permissions: contents: read` (see below) |

## Root causes

### 1. Lockfile never committed — `ERR_PNPM_OUTDATED_LOCKFILE`

`package.json` gained `@playwright/test`, `playwright` and `dotenv` in `fdd8130`,
but `pnpm-lock.yaml` was in none of the six PRs. Every job that installs failed at
line 23 of `ci.yml`, before lint or any test:

```
[ERR_PNPM_OUTDATED_LOCKFILE] pnpm-lock.yaml is not up to date with package.json
```

The diff is purely additive (41 lines): the three devDependencies plus transitive
closure. No existing dependency version moved.

### 2. Vitest collected Playwright specs

Vitest's default include glob `**/*.{test,spec}.?(c|m)[jt]s?(x)` matches
`tests/e2e/specs/**.spec.js`. `pnpm test` executed Playwright's `test.describe`
under Vitest:

```
You have two different versions of @playwright/test
Test Files  1 failed | 9 passed (10)
```

Fixed by committing `vitest.config.js` (`include: src/**/*.test.js`,
`environment: 'node'`, `exclude: tests/e2e`). Same 307 tests in 9 files run
before and after — only the Playwright spec stops being collected.

### 3. `env:` does not perform shell command substitution

GitHub Actions evaluates only `${{ }}` in `env:`. The three browser jobs passed Vite
the literal string `$(cat .env.test | grep VITE_SUPABASE_ANON_KEY | cut -d'=' -f2)`
as the Supabase anon key, at 6 sites. The setup job already used the correct idiom
at line 102, so the fix extends `${{ }}` across the `needs.setup` boundary — which
is what the declared `outputs.anon-key` was already there for. Net −22 lines: the
`.env.test` artifact round-trip (upload + 3 downloads) is gone, so a credential is
no longer shipped in a CI artifact to carry a value that is a constant of the local
stack anyway.

### 4. `.gitignore` missed the key and the artifacts

`.env` matches only that exact name and `.env.*.local` requires a `.local` suffix,
so `.env.test` matched neither — and it is written by `tests/e2e/global-setup.js`
and loaded by `playwright.config.js`, carrying the local anon key.
`playwright-report/` and `test-results/` were likewise untracked-but-not-ignored;
both directories were present in the working tree at the time of this work.

## Chain surgery

The lockfile fix only helps if it reaches every PR, so `pr2`→`pr6` were replayed
onto the new `pr1` (5 rebases, zero conflicts — no later slice touches
`pnpm-lock.yaml`, `.gitignore` or `vitest.config.js`). Verified afterwards that each
slice still contains exactly its own files and nothing leaked between PRs.

Before force-pushing, checked each remote head for third-party commits. **PR-6 had
one**: `f4ca696`, pushed by GitHub's PR-autofix bot at 15:54 during this session,
adding `permissions: contents: read` to `e2e.yml` for a CodeQL finding. It was not
in local history, so a blind force-push would have destroyed it. Cherry-picked
instead; both fixes are present in the pushed branch.

## Verification

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 — *"Lockfile is up to date, resolution step is skipped"* |
| `pnpm test` | 307 passed (9 files) |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `.github/workflows/e2e.yml` YAML parse | ok; 4 jobs; all 3 browser jobs `needs: setup`; setup exposes `anon-key` |
| `git check-ignore` for `.env.test`, `playwright-report/`, `test-results/` | all ignored |
| No tracked file caught by new ignore patterns | confirmed (`git ls-files -i -c` empty) |
| `lint-and-build` on #288, #289, #290, #291, #295, #297 | **all pass** (was red on all six) |
| `e2e.yml` run 37230649214 | still failing — see below |

## Not fixed — E2E workflow cannot pass in CI (environmental)

Both attempts of the `e2e.yml` run failed identically, before reaching any test:

```
Error response from daemon: toomanyrequests: Rate exceeded
Retrying after 4s: public.ecr.aws/supabase/kong:2.8.1
...
Supabase failed to become healthy
```

`ubuntu-latest` runners share an anonymous Docker Hub IP pool, and this workflow
cold-pulls ~10 Supabase images (postgres, kong, gotrue, postgrest, realtime,
storage-api, studio, imgproxy, postgres-meta, logflare) on **every job**. Four stack
boots per run, all unauthenticated. Under a busy period the pull never completes and
the health probe times out after 60s.

Consequences worth deciding on:

- The key fix at `b961eef` is **verified by construction and by review, not by a
  green run** — the workflow still dies upstream of it. It is latent, not proven.
- `--workers=1` in `test:e2e:ci` serialises the suite, so even a booting stack
  leaves little headroom inside the 30-minute per-job timeout.
- `npx supabase` is unpinned and not a devDependency (the log shows `npx` installing
  `supabase@2.119.0` mid-job): non-reproducible and a supply-chain surface.

Candidate directions, none taken here: authenticate with `docker/login-action`, cache
the images keyed on the Supabase CLI version, pin the CLI as a devDependency, or run
the stack on a self-hosted runner with images pre-pulled. The 4× redundant stack boot
(the `setup` job's Supabase + `supabase db reset` + Vite are discarded — every browser
job redoes them) would also go away if the setup job only exported the key.

## Pre-existing, not introduced here

`GitGuardian Security Checks` fails on #288 since 2026-10-03T20:02:42Z — before this
work. It passes on untouched PRs (#285, #286), so it is specific to the chain's diff,
not to these commits.

## Scope note

This unit fixed CI plumbing only. It did **not** touch the harness design, which a
full review found to be substantially non-functional — 452 `data-testid` selectors
against zero `data-testid` in `src/`, invalid UUIDs in the data factory, a Supabase
storage key that is never read, and `grep`/`grepInvert` set to the same regex so the
chromium project selects zero tests. That work is tracked separately.
