# E2E harness — foundation correctness fixes

Execution record for the defect fixes applied to PR-1 of the stacked Playwright
E2E chain after the #288–#297 chain review.

Companion record: `odd/tasks/e2e-chain-ci-unblock.md` (the CI/packaging fixes).
The review findings themselves are published as PR comments on #288, #289 and #297.

## Objective

Make the `tests/e2e/` foundation actually able to run against the local Supabase
stack: valid database identifiers, a session injection the application can read,
a test-selection config that can select tests, and teardown that does not destroy
the developer's local database.

## Problem

The PR-1 foundation has seven defects, each independently sufficient to make every
test in the chain fail or silently do nothing:

- `generateFixtureUuid()` builds UUIDs whose final group is **13 hex characters**.
  Postgres `uuid_in` requires exactly 12, so all seven `create*` helpers fail
  `22P02`. Nothing else in the data factory is reachable until this is fixed.
- `injectSession()` writes `localStorage['supabase.auth.token']`. supabase-js
  derives its own key (`sb-${hostname.split('.')[0]}-auth-token`, i.e.
  `sb-127-auth-token` for the local stack) because `src/data/supabase.js` passes
  no `storageKey`. The injected session is therefore never read, and
  `isAuthenticated()` reads the same wrong key, so it reports success anyway.
- The injected session omits `expires_at`, which supabase-js needs to decide
  whether the session is still valid.
- `playwright.config.js` sets both `grep` and `grepInvert` to `/@chromium-only/`
  on the chromium project. A test must match `grep` **and** not match
  `grepInvert`, so chromium can never select a test. Lines 56 and 61 repeat only
  `grepInvert`, making the matrix inverted *and* asymmetric.
- `global-setup.js` writes `tests/e2e/.env.test` while `playwright.config.js`
  loads `.env.test` from the repository root. The paths do not match, and the
  config module is evaluated before `globalSetup` runs, so on a clean checkout
  the file cannot exist in time regardless of path.
- `global-teardown.js` runs `supabase stop --no-backup`, which discards volumes.
  A local `pnpm test:e2e` on a machine with the stack up destroys the local
  development database. The adjacent comment claims the opposite of what the
  flag does.
- `outsiderUser` declares `orgId`/`role` values that `supabase/seed.sql` does not
  create. `seed.sql:79-84` inserts exactly two `org_memberships` rows (demo,
  isolation); outsider exists only as a user, a profile, and a *pending*
  collaborator. `fixtures-smoke.spec.js` asserts the fabrication as truth.

Two further defects in the same layer:

- `song_versions` and `venues` both pass the prefix `'v'`, so once the length
  bug is fixed the two families generate identical UUIDs.
- `package.json` declares `test:gherkin` pointing at `src/test/gherkin`, which
  does not exist on this chain (it arrives in #287). The script is dead as
  written.

## Why now

PR-1 has been red on every run since it opened, and the four already-fixed
packaging defects (`odd/tasks/e2e-chain-ci-unblock.md`) only unblocked
`lint-and-build`. The E2E workflow itself is still structurally incapable of
executing a test, so nothing in the chain can produce evidence yet. These fixes
are prerequisites under every strategy for the page objects, which is why they
land before that decision is taken.

## Scope

**In scope** — correctness defects in code that already exists, on PR-1 and PR-2:

| ID | Change | File |
|---|---|---|
| F1 | Valid 12-hex-digit UUIDs, per-family ranges disjoint from `seed.sql` | `tests/e2e/fixtures/data-factory.js` |
| F2 | Derive the supabase-js storage key from the URL; include `expires_at` | `tests/e2e/fixtures/auth.js` |
| F3 | `grep`/`grepInvert` so `@chromium-only` means "chromium only" | `playwright.config.js` |
| F4 | Load `.env.local`; stop writing a `.env.test` that nothing can read | `playwright.config.js`, `tests/e2e/global-setup.js` |
| F5 | Teardown must not destroy the local database | `tests/e2e/global-teardown.js` |
| F6 | Truthful `outsiderUser` org fields, asserted to match | `tests/e2e/fixtures/users.js`, `tests/e2e/specs/hito1/fixtures-smoke.spec.js` |
| F7 | Distinct `song_versions` / `venues` UUID families | `tests/e2e/fixtures/data-factory.js` |
| F8 | Remove the dead `test:gherkin` script | `package.json` |
| P1 | `@chromium-only` tag semantics | `tests/e2e/page-objects/AuthPage.js` |
| P2 | Attach `waitForNetworkIdle` to `BasePage` so 13 call sites resolve | `tests/e2e/page-objects/BasePage.js` |
| P3 | Match both hyphen code points in the transpose selector | `tests/e2e/page-objects/components/ChordRenderer.js` |
| P4 | `/login` → `/auth` | `tests/e2e/page-objects/AuthPage.js` |

**Out of scope** — requires a strategy decision and is not touched here:

- The 453 `data-testid` selectors with no counterpart in `src/`.
- Page objects targeting routes that do not exist (`/theory`, `/offline`,
  `/comments`).
- Methods scripting UI that was never implemented (fullscreen, metronome,
  auto-scroll, capo select, transpose buttons).
- `TransposeControl` assertions that compare spec-supplied values instead of
  consulting the application.
- The Docker Hub rate limit blocking `e2e.yml` in CI.
- `test:e2e:ci` running with `--workers=1`.

## Constraints

- `pnpm` only. Never `npm install`, never add `package-lock.json`.
- Do not weaken a characterization assertion to make a gate pass. Where a test
  asserted a wrong expectation (`fixtures-smoke.spec.js` asserting the fabricated
  `outsiderUser` membership), the **source** is corrected and the assertion is
  updated to the corrected truth in the same commit.
- No `data-testid` is added to `src/` in this change. Instrumenting the
  application is the decision being deferred, and adding hooks now would
  pre-empt it.
- Each PR in the chain keeps its own slice; fixes land on the branch that
  introduced the file.
- Conventional Commits. No AI attribution.

## Acceptance criteria

- Every `create*` helper produces a UUID Postgres accepts, and no fixture UUID
  can collide with a `seed.sql` row.
- `injectSession()` writes the key `src/data/supabase.js`'s client actually
  reads, and the injected session is not treated as expired on load.
- The chromium project selects untagged tests; `@chromium-only` runs in chromium
  and is excluded from firefox and webkit.
- A local `pnpm test:e2e` leaves the local Supabase volumes intact.
- `outsiderUser` describes exactly the memberships `seed.sql` creates.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` all exit 0.

## Checks

```bash
pnpm install --frozen-lockfile
pnpm test && pnpm typecheck && pnpm lint && pnpm build
bash scripts/check-visual-contract.sh
```

Plus targeted structural checks recorded per task below.

## Progress

- [x] **F1** valid UUIDs with per-family ranges — `odd/tasks` recorded below
- [x] **F2** storage key derived from the URL, `expires_at` included
- [x] **F3** `grep`/`grepInvert` asymmetry removed
- [x] **F4** `.env.local` loaded; `.env.test` write removed
- [x] **F5** teardown no longer discards volumes
- [x] **F6** `outsiderUser` org fields match `seed.sql`
- [x] **F7** `song_versions` and `venues` given distinct families
- [x] **F8** dead `test:gherkin` script removed
- [x] **P1/P4** `AuthPage` targets `/auth`
- [x] **P2** `waitForNetworkIdle` attached to `BasePage`
- [x] **P3** transpose selector matches both hyphen code points

## Verification evidence

Recorded in the commit that closes each task; see the table in
`odd/tasks/e2e-chain-ci-unblock.md` for the packaging half.

## Next step

Take the page-object strategy decision, then either instrument the application
or trim the harness to what is reachable.