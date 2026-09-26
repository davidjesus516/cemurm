# CEMURM — Agent Guide

PWA for musicians: repertoires, setlists, live performance, offline-first. React 18 + Vite + Tailwind against a **local** Supabase stack (PostgreSQL + GoTrue + RLS). Milestone status lives in `README.md` / `docs/mvp-scope.md` — don't duplicate it here.

## Commands

`pnpm` only. Lockfile is `pnpm-lock.yaml`; never add `package-lock.json` or run `npm install`/`npm run *`.

```bash
pnpm dev         # Vite dev server → localhost:5173
pnpm build       # production build to dist/
pnpm preview     # serve dist/
pnpm lint        # ESLint — --max-warnings 0, --report-unused-disable-directives
pnpm typecheck   # tsc --noEmit  (see "Type checking" below)
```

`pnpm-workspace.yaml` holds `allowBuilds: { esbuild: true }`; postinstall scripts are blocked by default.

There is **no unit test framework and no test runner**. "Verification" for JS work = `pnpm typecheck && pnpm lint && pnpm build`.

## CI does not run typecheck

`.github/workflows/ci.yml` (push to `main` + every PR) runs pnpm 11 / Node 22:

```
pnpm install --frozen-lockfile → pnpm lint → pnpm build
```

**`pnpm typecheck` is absent from CI.** Type errors ship with a green check. Run it locally before you claim a change is done.

## Type checking is per-file opt-in

`tsconfig.json` is `include: ["src/lib"]` with `allowJs` and **global `checkJs` deliberately OFF**. Only four files are actually checked, each via the canonical pragma:

- `src/lib/transpose.js`, `src/lib/annotations.js`, `src/lib/songs.js`, `src/lib/setlists.js`

**Do not flip `checkJs` on globally.** Doing so type-checks the whole `src/lib` import graph: ~760 errors, ~530 in files that were never in scope (rationale is recorded in `tsconfig.json`). To bring a new `src/lib` module under the baseline, add `// @ts-check` to that one file — not a global flag. Baseline history: `odd/tasks/ts-checkjs-baseline.md`.

TypeScript is **7.0.2** (not 5.x). Two quirks already cost time:
- `catch` variables infer `unknown`, so `e.message` needs a `/** @type {Error} */ (e)` cast.
- In JSDoc, an em-dash after an optional param (`@param {boolean} [name] —`) is a parse error (TS1127).

## SQL smoke tests (manual only)

`scripts/smoke/*.sql` — 6 files, `0023`–`0028`, one per recent migration. They are **not** in CI and **not** wired to any npm script. The invocation exists in exactly one place in the repo, `odd/tasks/hito5-substitutions-and-coverage.md`:

```bash
supabase db reset   # REQUIRED first — see below
docker exec -i supabase_db_cemurm psql -U postgres -d postgres -X -f - < scripts/smoke/0028-import-integrations.sql
```

- **Fresh `supabase db reset` before every run. Single run only — not idempotent.** There is no transaction wrapper, so scripts commit their writes. Re-running without a reset produces false PASS/FAIL.
- Pass `-v ON_ERROR_STOP=1` or a failure mid-file won't halt.
- `supabase db query` cannot run these (single-statement only). The container name `supabase_db_cemurm` comes from `project_id = "cemurm"` in `supabase/config.toml`.
- Each file carries an `expects N PASS / 0 FAIL` line and a mandatory preamble: `set client_min_messages to notice`, `tmp_assert`, `tmp_expect_error`.
- Conventions to follow when writing one: role switches use `select set_config('role', ..., false)` (bare calls are invalid top-level); JWT via `select set_config('request.jwt.claims', '{"sub":"..."}', false)`; contract assertions run under `role postgres` (RLS filters them otherwise); use **fixed UUID literals**, never `gen_random_uuid()` (won't cross role switches); smoke fixtures live in `30000…6xx/7xx/8xx` to avoid the seed's `30000000-…` setlist family.

## Database layer

**Local, not hosted.** `docs/local-dev.md` is authoritative: this project is NOT linked to a hosted Supabase project. `README.md` and `docs/technical-spec.md` still name a hosted project URL — that text is stale, ignore it.

Migrations: 25 files, highest `0028_import_pipeline.sql`. **0020–0022 are a deliberate gap — do not renumber.** Filename order is the dependency order. `supabase db reset` executes *every* `.sql` in `supabase/migrations/`, so never commit an ad-hoc query script there (that's why `scripts/smoke/` is a sibling directory). Never push the seed with `supabase db push`.

`supabase/seed.sql` is idempotent (`on conflict do nothing` everywhere) and defines the fixture every smoke test depends on. Three confirmed users, **all password `password1234`**:

| UUID suffix | Email | Fixture role |
|---|---|---|
| `10000000-…-0001` | `demo@cemurm.app` | org owner; owns Demo Setlist `30000000-…-001` and songs `2000…001/002` |
| `10000000-…-0002` | `isolation@cemurm.app` | outsider; **accepted** view-only collaborator on the demo setlist |
| `10000000-…-0003` | `outsider@cemurm.app` | outsider; **pending** collaborator (`accepted_at IS NULL`) |

(`docs/local-dev.md` says "two confirmed users" — stale, there are three.) Seed gotchas: GoTrue v2 scans token/phone columns as plain strings, so they must be `''` and never `NULL` or login fails; `profiles` rows are created by the `0006` trigger, so the seed only `UPDATE`s them.

Env (`.env.local`, gitignored): `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are the only required vars — `src/lib/supabase.js` throws without both. Local API is `http://127.0.0.1:54321`. Optional live-provider flags (default = mock, no silent fallback): `VITE_SPOTIFY_CLIENT_ID`, `VITE_SPOTIFY_CLIENT_SECRET`, `VITE_MUSICBRAINZ_LIVE=true`, `VITE_LRCLIB_LIVE=true`.

Schema contract: `supabase/migrations/` is authoritative; `docs/database-schema-v2.md` is the model/design origin. Its §3.1 org/branch visibility matrix is a **design target, not live** — implemented RLS is owner-scoped only.

## Architecture notes that aren't obvious from filenames

- `src/main.jsx` → `src/App.jsx` (router). The authed tree is wrapped by `RequireAuth` + `RequireGuardianConsent`; add new routes there, not in `main.jsx`.
- RLS is the client-side gate. The service worker (`public/sw.js`) + IndexedDB layer does read-cache, an offline write queue, and a drain on reconnect.
- The `charts` storage bucket is **private** with owner-folder RLS (first path segment must be `auth.uid()`); reads are 1-hour signed URLs only. The 10 MB PDF cap is **app-side only** — the DB deliberately accepts oversized rows.
- Import/enrichment provider clients **never throw**: they return `{ ok: true, … }` or `{ ok: false, error: 'offline' | 'unavailable' }`, gated by `isOnline()`.
- No `src/store/` and no Zustand — state lives in React context and hooks. (CONTRIBUTING.md still claims a Zustand store exists; it does not.)

## Conventions

- **JSX, not TSX.** The spec mentions TypeScript; the codebase is plain JS. Follow what exists.
- Tailwind only — no CSS modules, styled-components, or inline styles.
- Components `PascalCase.jsx`; hooks `camelCase` with `use` prefix; utilities `camelCase`.
- Conventional Commits. Feature branches from `main` (`feat/my-feature`). PRs stay ≤400 changed lines; bigger work ships as chained `-prN-` slices (precedent: `feat/hito-3-notifications` + children, `feat/ts-checkjs-baseline` + children). Merge is always a human decision.
- ESLint's `no-unused-vars` uses `varsIgnorePattern: '^[A-Z_]'`, so uppercase bindings (JSX components) are exempt from the unused check — don't "fix" that by renaming.
- **CONTRIBUTING.md is stale**: it says `npm install`, `npm run lint`, and lists a `src/store/` Zustand layer. Ignore those; use pnpm and the layout above.

## Where the real context lives

- `docs/local-dev.md` — local stack, reset procedure, seed identities, env vars. **Read before any DB work.**
- `docs/engineering-review-backlog.md` — open engineering debt, triggers planned work (e.g. the checkJs baseline).
- `odd/tasks/*.md` — one feature record per shipped unit, with commit SHAs, verification evidence, and deviations. This is where commands and rationale that never made it into `docs/` actually live; check here when a procedure seems undocumented.
- `features/*.feature` — Gherkin specs; the product source of truth, ahead of the README.
- `openspec/specs/` — shipped capability specs.
