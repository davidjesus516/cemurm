# CEMURM — Agent Guide

PWA for musicians: repertoires, setlists, live performance, offline-first. React 18 + Vite + Tailwind against a **local** Supabase stack (PostgreSQL + GoTrue + RLS). Milestone status lives in `README.md` / `docs/mvp-scope.md` — don't duplicate it here.

## Commands

`pnpm` only. Lockfile is `pnpm-lock.yaml`; never add `package-lock.json` or run `npm install`/`npm run *`.

```bash
pnpm dev         # Vite dev server → localhost:5173
pnpm build       # production build to dist/
pnpm preview     # serve dist/
pnpm lint        # ESLint — --max-warnings 0, --report-unused-disable-directives
pnpm test        # Vitest run — characterization tests, node environment
pnpm test:watch  # Vitest watch mode
pnpm typecheck   # tsc --noEmit  (see "Type checking" below)
```

`pnpm-workspace.yaml` holds `allowBuilds: { esbuild: true }`; postinstall scripts are blocked by default.

Vitest is the only test dependency (no jsdom, no testing-library), running in the `node`
environment — which is Vitest's **default**: `vite.config.js` has no `test` block and configures
nothing. Tests are colocated as `<module>.test.js` beside the module under test, and
**characterization tests now guard the domain layer** (`src/domain/**`,
`src/integrations/spotify.js`): they assert what the code does *today*, so a failure is a
finding to report, never a reason to edit the source or weaken the assertion. "Verification"
for JS work = `pnpm test && pnpm typecheck && pnpm lint && pnpm build`.

**Vitest is pinned to 3.2.7 deliberately.** Vitest 5 declares `vite ^6.4||^7||^8` as a peer and
fails hard against Vite 5.4.21. Do not bump it without moving Vite first.

## CI does not run typecheck

`.github/workflows/ci.yml` (push to `main` + every PR) runs pnpm 11 / Node 22:

```
pnpm install --frozen-lockfile → pnpm lint → bash scripts/check-visual-contract.sh → pnpm test → pnpm build
```

**`pnpm typecheck` is absent from CI.** Type errors ship with a green check. Run it locally
before you claim a change is done.

## Type checking is per-file opt-in

`tsconfig.json` has `allowJs` with **global `checkJs` deliberately OFF**. Only four files are
actually checked, each via the canonical pragma, and the relocation moved all four:

- `src/domain/music/transpose.js`, `src/domain/music/annotations.js`
- `src/data/repositories/songs.js`, `src/data/repositories/setlists.js`

**Do not flip `checkJs` on globally.** Doing so type-checks everything the include can reach:
~760 errors, ~530 in files that were never in scope (rationale is recorded in `tsconfig.json`).
To bring a new module under the baseline, add `// @ts-check` to that one file — not a global
flag. Baseline history: `odd/tasks/ts-checkjs-baseline.md`.

**After any file move, verify the baseline is still alive.** This gate fails *silently*: a
wrong `include` leaves `tsc` checking one untyped file and still exiting 0.

```bash
npx tsc --noEmit --listFiles | grep -c 'cemurm/src/'   # must be > 1; was 1, now 48
```

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

Migrations: **33 files on `main`**, numbered `0001`–`0033` with **no gap in between**. The
`0020`–`0022` window is **closed** — `0020_review_batch1.sql`, `0021_plan_freeze.sql` and
`0022_projection.sql` are all on `main`. `0029` is taken as well (`0029_fail_closed_minors.sql`),
and `0032` went with it (`0032_overlay_access_token.sql`, the OBS overlay capability token, landed
in #225). **The next free number is `0034`,** and it is free unconditionally — nothing is claiming
it any more.

Before adding a migration, check every branch for a collision:
`git branch -r | xargs -I{} git ls-tree --name-only {} -- supabase/migrations/`. Two cautions on
that check, both learned the hard way:

- It reports collisions on **superseded** branches. `feat/hito5-in-app-feedback` still carries
  `0020_feedback.sql`, which collides with `main`'s `0020_review_batch1.sql` — but that branch is
  closed and superseded. Check the PR's state, not just the branch. Read the renumbering trail
  before trusting a number: the same feedback migration moved `0020` → `0029` and then on to
  `0033_feedback.sql`, while `0029` was taken in the meantime by an unrelated migration. "It was
  free when I looked" was true twice and false both times.
- A number free on `main` is not free *for you*. `0021` stayed free for the whole life of the four
  Hito 5 branches, which is why `0021_plan_freeze.sql` merged without a renumber — and that merge
  is what closed it. A slot is consumed when the PR carrying it lands, not when you pick it.

Filename order is the dependency order, so placement is a constraint, not a formality: `supabase db
reset` executes *every* `.sql` in `supabase/migrations/` in filename order, so a migration that
creates what an earlier one references must sort **before** it.

- **Self-contained** (creates its own tables, references only `auth.users(id)`) → position does not
  matter, so take the next free number, `0034` today. `0033_feedback.sql` is the precedent for
  renumbering when the natural slot is gone; it is self-contained, so `0033` cost nothing.
- **Must sort before an existing migration** → you cannot simply take `0034`. Land it in a genuinely
  free earlier slot, or renumber what it depends on. **There is no such slot left**: `0001`–`0033`
  is contiguous, so every position below `0033` is taken. This case now always needs a decision
  (renumber the dependency, or reorder the filenames) rather than a free number to drop into.

Never commit an ad-hoc query script in `supabase/migrations/` (that's why `scripts/smoke/` is a
sibling directory). Never push the seed with `supabase db push`.

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

The tree is post-relocation. `src/main.jsx`, `src/App.jsx`, `src/pages/` and `src/components/`
no longer exist — several `docs/` files and `odd/tasks/*.md` still cite them.

- Entrypoint is `index.html` → **`src/app/main.jsx`**. Router: `src/app/router.jsx`. Shell
  chrome: `src/app/AppLayout.jsx`. Providers: `src/app/providers/`.
- `src/domain/**` is pure logic with no I/O. `src/data/repositories/` holds the impure halves
  that talk to Supabase. `src/integrations/`, `src/offline/`, `src/ui/patterns/` are leaf
  modules. `src/features/<feature>/` holds that feature's pages and components.
  `src/lib/storage.js` is the one deliberate exception left in `src/lib/`.
- RLS is the client-side gate. The service worker (`public/sw.js`) + IndexedDB layer does read-cache, an offline write queue, and a drain on reconnect.
- The `charts` storage bucket is **private** with owner-folder RLS (first path segment must be `auth.uid()`); reads are 1-hour signed URLs only. The 10 MB PDF cap is **app-side only** — the DB deliberately accepts oversized rows.
- Import/enrichment provider clients **never throw**: they return `{ ok: true, … }` or `{ ok: false, error: 'offline' | 'unavailable' }`, gated by `isOnline()`.
- No `src/store/` and no Zustand — state lives in React context and hooks. (CONTRIBUTING.md still claims a Zustand store exists; it does not.)

## Methodology

Four layers run in this repo. They are not interchangeable — putting an artifact in the wrong one is the most common planning mistake here.

| Layer | Owns | Home |
|---|---|---|
| **BDD** | Product truth. 42 `.feature` files, 656 scenarios. The source of what to build | `features/*.feature` |
| **Milestones** | Temporal sequencing. Hitos 1–6, and the verified slice plan | `docs/master-plan.md`, `docs/mvp-scope.md` |
| **SDD (OpenSpec)** | **Capabilities and delta specs.** One spec per capability, archived when the change closes | `openspec/specs/`, `openspec/changes/` |
| **ODD** | **Execution records.** One file per work unit, with commit SHAs and verification evidence | `odd/tasks/*.md` |

The rule of thumb: if you are writing down *what a capability is*, it goes in OpenSpec. If you are writing down *what was done and how it was verified*, it goes in `odd/tasks/`. A change that ships writes to both — an OpenSpec spec for the capability, an `odd/tasks/` record for the unit.

**Entry rule** (`docs/engineering-review-backlog.md:5`): an item is implemented only when its hito or BDD feature requires it. YAGNI is active. This is the only rule here that does not accumulate debt — do not weaken it in the name of scalability.

## Visual system

**`skills/cemurm-visual-system/SKILL.md` is the single source of visual truth.** Read it before
touching any interface. Two older sources conflict with it and are **superseded** for visual
decisions: `docs/design-system.md` (464 lines, written 2026-09-06, never implemented) and
`odd/tasks/cemurm-brand-landing.md` §5–§6 (unmerged branch). When they disagree with the skill, the
skill wins.

The direction is the **macOS / Apple design language**, keeping the project's colour essence: a dark
ramp plus **one** amber accent. Classify the surface before styling it — the tiers have different
rules, and the failure mode is styling a live-performance surface like a product screen:

| The surface is | Tier | Rule |
|---|---|---|
| Nav, settings, dialogs, forms, auth, empty states | 1 | Full macOS language; materials allowed |
| Song and setlist lists, tables, editors | 2 | Partial; no material, no decorative shadow |
| `src/features/stage/pages/StageMode.jsx` — the musician's tablet | 3a | Full macOS language; radius and depth are correct here |
| `src/features/stage/**/Overlay*.jsx` — the OBS projector surface | 3b | **Chrome-free.** No radius, shadow, translucency, gradient or personal annotation |

Touched → tier 1 or 3a. Read at distance in a dark room → tier 3b.

```bash
bash scripts/check-visual-contract.sh   # the visual gate; runs in CI between lint and test
```

Two things the gate cannot tell you, because they are measured, not published: **Apple publishes no
numeric corner radius, spacing scale, elevation ladder or motion duration** — every such token in
`assets/tokens.css` is a project decision tagged as such. And **`corner-shape` is unavailable on
Safari iOS and Firefox Android**, so the macOS squircle cannot ship natively; `backdrop-filter`,
which carries the same visual language, is available everywhere.

## Conventions

- **JSX, not TSX.** The spec mentions TypeScript; the codebase is plain JS. Follow what exists.
- Tailwind only — no CSS modules, styled-components, or inline styles.
- Components `PascalCase.jsx`; hooks `camelCase` with `use` prefix; utilities `camelCase`.
- Conventional Commits. Feature branches from `main` (`feat/my-feature`). PRs stay ≤400 changed lines; bigger work ships as chained `-prN-` slices (precedent: `feat/hito-3-notifications` + children, `feat/ts-checkjs-baseline` + children). Merge is always a human decision.
- ESLint's `no-unused-vars` uses `varsIgnorePattern: '^[A-Z_]'`, so uppercase bindings (JSX components) are exempt from the unused check — don't "fix" that by renaming.
- **CONTRIBUTING.md is stale**: it says `npm install`, `npm run lint`, and lists a `src/store/` Zustand layer. Ignore those; use pnpm and the layout above.

## Delivery workflow (standing authorization)

The maintainer set this working agreement on 2026-09-27. It is standing, not per-PR:

1. Work lands as work-unit commits on the current feature branch.
2. When a unit is ready to ship, **update the branch and open the PR to `main`** yourself. Do not stop and ask for push/PR permission again — it is granted here for this cycle.
3. **Fix what breaks to make it correct.** Invasive refactors, signature changes, updating dependent call sites and docs are pre-authorized when they are required to land the unit honestly. Do not let a failing gate defer the decision.
4. **Merge stays human.** You open the PR; the maintainer approves and merges. Never merge or push to `main` directly.
5. Report honestly: if a check fails, a gate was weakened, or a spec conflict was found, say so in the PR body. Do not present a green run as covering something it does not.
6. **Notify, do not wait silently.** A PR that sits at `REVIEW_REQUIRED` with nobody notified is indistinguishable from a PR nobody opened. So:
   - **Always request a reviewer when you open the PR**: `gh pr edit <n> --add-reviewer davidjesus516`. The review request is itself the notification, and it fires without any extra step.
   - **When you push new commits onto a PR that already has an approval**, leave a comment mentioning `@davidjesus516` explaining what changed and why. GitHub does not re-notify a reviewer for later pushes.
   - **When a check goes red**, say so in the same thread. Do not let a failing gate sit in the checks tab.

   The repo's ruleset sets `require_last_push_approval`, so the last pusher cannot approve their own
   PR. **That is deliberate and correct — approval on `main` must be a second pair of eyes.** It does
   not remove the obligation to make the request, or to say so out loud when the branch moves.

The one limit on clause 3: **a failing characterization test is fixed in the source, never in the assertion.** Once the suite lands (M0b), it records current behaviour on purpose (`odd/tasks/cemurm-brand-landing.md` §12.1). Editing a test to go green, loosening a threshold, or adding a skip to clear a gate hides a regression. If a test genuinely encodes a wrong expectation, that is a finding to report, not to silently rewrite. The same rule governs any future test: a red test is information, not an obstacle.

## Where the real context lives

- `docs/local-dev.md` — local stack, reset procedure, seed identities, env vars. **Read before any DB work.**
- `docs/master-plan.md` — the verified slice plan: what is on `main`, what is not, and in what order it ships. **Read before starting any work that is not a trivial fix.** Supersedes the Hito 5/6 status claims in `docs/mvp-scope.md`, which are stale.
- `docs/engineering-review-backlog.md` — open engineering debt, triggers planned work (e.g. the checkJs baseline).
- `odd/tasks/*.md` — one feature record per shipped unit, with commit SHAs, verification evidence, and deviations. This is where commands and rationale that never made it into `docs/` actually live; check here when a procedure seems undocumented.
- `features/*.feature` — Gherkin specs; the product source of truth, ahead of the README.
- `openspec/specs/` — shipped capability specs.
