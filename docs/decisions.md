# Architecture Decision Records

Records for decisions **already made and in force** in this repository — the rationale that
`odd/tasks/*.md` deliberately does not carry (it records *what* was done and how it was verified,
not *why* the shape was chosen). When a decision changes, edit its status; do not delete it.

**Numbering:** `ADR-001` … `ADR-010`, assigned by theme, not chronology. Note that
`tsconfig.json`, `docs/master-plan.md` and `odd/tasks/cemurm-education-audit.md` all refer to an
"ADR 0002" for the layer boundaries — that document **never existed in the tree**
(`docs/master-plan.md` §5b: "ADR 0002 absent from the repo"). `ADR-010` below is its first
in-tree record; the older references are the same decision.

**Status vocabulary:** *Accepted* = in force today and verified against the code. Every ADR here
was checked against the current tree before being written; where a claim could not be verified it
says so in Consequences.

---

### ADR-001 — JSX and plain JavaScript instead of TypeScript

- **Status:** Accepted
- **Date:** 2026-09 (project inception; `docs/technical-spec.md` §2 already said "JS/JSX")
- **Context:** `docs/technical-spec.md:29` names TypeScript as the planned future migration
  (§10.8 D1), so every session can re-litigate whether new files should be `.tsx`.
- **Decision:** All application code is plain JS/JSX. Follow what exists: 63 `.jsx` files, 0 `.tsx`.
- **Alternatives:** (a) Full TypeScript migration now; (b) start new files as TSX while old ones
  stay JS (a split codebase); (c) JSDoc types without a compiler.
- **Reason:** The spec itself defers TS to "a future migration"; a half-migrated tree costs more
  than either endpoint, and `AGENTS.md` makes "JSX, not TSX" an explicit convention.
- **Consequences:** Positive — no build-step change, no type churn on every refactor. Tradeoff —
  no compiler-enforced types; the mitigation is ADR-002's opt-in checking plus JSDoc `@typedef`s
  (see `src/integrations/spotify.js`), which some modules already rely on.

---

### ADR-002 — Per-file `@ts-check` opt-in instead of global `checkJs`

- **Status:** Accepted
- **Date:** 2026-09 (baseline work; rationale recorded inside `tsconfig.json`)
- **Context:** Type-checking JSDoc is useful, but `checkJs: true` over the current `include`
  reports ~760 errors, ~530 of them in files that were never in scope.
- **Decision:** `allowJs: true`, global `checkJs` **off**. Modules opt in individually with the
  canonical `// @ts-check` pragma (baseline: `src/domain/music/{transpose,annotations}.js`,
  `src/data/repositories/{songs,setlists}.js`, plus the jsdoc-libs pass surface).
- **Alternatives:** (a) Global `checkJs` with a `@ts-nocheck` blanket; (b) `exclude`-lists to carve
  the noise out; (c) migrate to `.ts` first (blocked by ADR-001).
- **Reason:** Identical checking semantics for opted-in files, an exact and auditable checked
  surface, zero baseline debt. The rationale is written where the next agent will see it — in
  `tsconfig.json` itself.
- **Consequences:** Positive — the type gate stays green and meaningful. Tradeoff — the gate fails
  *silently* if a file moves out of `include`: verify with
  `npx tsc --noEmit --listFiles | grep -c 'cemurm/src/'` (must be > 1). Also note `pnpm typecheck`
  is **not** in CI (`.github/workflows/ci.yml` runs lint → visual contract → test → build).

---

### ADR-003 — React context and hooks for state; no Zustand, no `src/store/`

- **Status:** Accepted
- **Date:** 2026-08/09 (inception; re-confirmed by the tree relocation)
- **Context:** A global store is the default reflex for a SPA, and `CONTRIBUTING.md` still
  documents one — but the dependency was never installed.
- **Decision:** State lives in React context and hooks (`src/app/providers/`). There is no
  `src/store/` directory and no `zustand` in `package.json` or `pnpm-lock.yaml`.
- **Alternatives:** (a) Zustand; (b) Redux Toolkit; (c) a lightweight external store (Jotai/Valtio).
- **Reason:** The server state is already owned by Supabase + RLS, and the offline layer
  (`src/offline/`, service worker) owns queued writes — a third copy of state in a client store
  would be another thing to keep in sync.
- **Consequences:** Positive — zero store/middleware boilerplate, state colocated with the
  components that read it. Tradeoff — no devtools time-travel and prop/context threading must be
  watched for re-render cost. **`CONTRIBUTING.md` is stale on this point** (it lists
  `store/ # Zustand state stores`); `AGENTS.md` documents the discrepancy.

---

### ADR-004 — RLS as the client-side gate instead of API routes

- **Status:** Accepted
- **Date:** 2026-09-11 (recorded in `openspec/changes/archive/2026-09-11-rls-and-offline-first/`)
- **Context:** Authorization could live in a backend layer of routes, or in the database. The app
  is a client-only PWA with no API server of its own.
- **Decision:** Every read and write goes from the browser to PostgREST/Storage/RPC with the anon
  key plus the user's JWT, and **Row Level Security is the authorization layer**. Deny-by-default
  revokes before any policy (`supabase/migrations/0002_rls_core.sql`, design decisions D5/D6).
- **Alternatives:** (a) A REST/GraphQL API tier (Fastify/Node) enforcing permissions in code;
  (b) Supabase Edge Functions as the only data path; (c) RLS *and* a redundant API layer.
- **Reason:** The policy is enforced on the same connection that serves the data, so no future
  code path — a new hook, a service worker replay, a direct PostgREST call — can bypass it.
- **Consequences:** Positive — one enforcement point, offline queue and admin tools inherit it.
  Tradeoff — policy complexity lives in SQL migrations (renumbering is a real hazard, see
  `AGENTS.md`), and policy logic is harder to unit-test than a route handler; the repo answers
  this with `scripts/smoke/*.sql`. The single documented exception is an Edge Function acting as
  a courier (`supabase/functions/send-guardian-consent`), which holds no data rules of its own.

---

### ADR-005 — Local Supabase, not a hosted project

- **Status:** Accepted
- **Date:** 2026-09 (`docs/local-dev.md` is declared authoritative)
- **Context:** Shared environments make verification non-reproducible and put real data behind
  every experiment; the README and technical spec still name a hosted project URL.
- **Decision:** The stack runs locally (`supabase start` → `http://127.0.0.1:54321`) and
  `supabase db reset` + `supabase/migrations/` + `supabase/seed.sql` are the whole environment.
  This project is **not** linked to a hosted project.
- **Alternatives:** (a) A hosted Supabase project for dev and prod; (b) local dev + hosted staging;
  (c) Docker Compose hand-rolled instead of the Supabase CLI.
- **Reason:** Every migration, RLS matrix and smoke test (`scripts/smoke/*.sql`) must be runnable
  from scratch with no credentials and no shared state to corrupt.
- **Consequences:** Positive — reproducible resets, fixtures are code, no cloud cost or drift.
  Tradeoff — no shared preview environment, so multi-user flows are proven through seed fixtures
  (`demo@cemurm.app`, `isolation@cemurm.app`, `outsider@cemurm.app`). **Stale sources exist**:
  `README.md:14` and `docs/technical-spec.md` still cite a hosted URL; `docs/local-dev.md` wins.

---

### ADR-006 — Characterization tests record current behaviour and are never edited to go green

- **Status:** Accepted
- **Date:** 2026-09-26 (test strategy committed with the first slice; enforced by `AGENTS.md`
  delivery workflow clause 3)
- **Context:** The suite landed after the code existed (235 tests across 7 files, per
  `docs/master-plan.md` §1; the tree now carries 9 colocated `*.test.js` files), so its
  assertions describe today's behaviour — including known bugs.
- **Decision:** A red characterization test is fixed **in the source, never in the assertion**.
  Editing a test to pass, loosening a threshold, or skipping a case to clear a gate is forbidden.
- **Alternatives:** (a) TDD (its red step means "module missing", not "behaviour measured");
  (b) snapshot-heavy tests that re-bless automatically; (c) deleting the offending assertion.
- **Reason:** The suite's entire value is being an unmovable net: the refactor's proof is that it
  passes **unmodified** (`odd/tasks` strategy record; `docs/master-plan.md` §1).
- **Consequences:** Positive — refactors are provably faithful, and known spec findings are pinned
  deliberately: `src/domain/chart/parser.test.js` and `src/domain/music/transpose.test.js` carry
  `// FINDING:` comments next to assertions that record buggy behaviour on purpose (e.g. "the
  table is sharp-only, so a Db/Bb major label is unreachable"). Nuance: a *deliberate* behaviour
  change updates the assertion **as the deliverable**, documented in the PR — what stays forbidden
  is editing an assertion to make a gate pass without changing behaviour. Tradeoff — the suite will
  look "wrong" to anyone who does not know this rule; that is intentional.

---

### ADR-007 — Vite and Vitest move as a pair, never one alone

- **Status:** Accepted
- **Date:** 2026-09 (rule stated in `AGENTS.md`; exercised by PR #236)
- **Context:** Vitest declares Vite as a peer dependency, so a Vitest major fails hard against a
  Vite major it was not built for — Vitest 5 requires `vite ^6.4||^7||^8` and dies on Vite 5.
- **Decision:** When one major moves, move the other in the same change, install for real, and run
  the full gate. Tree currently resolves Vite 6.4.3 / Vitest 5.0.2 (`pnpm-lock.yaml`).
- **Alternatives:** (a) Upgrade Vitest alone; (b) upgrade Vite alone; (c) pin both forever and let
  the ecosystem drift away.
- **Reason:** Moving one without the other is a guaranteed break, and the pairing rule — not any
  specific version — is the invariant. The earlier pin at Vitest 3.2.7 / Vite 5.4.21 existed only
  because the pair had not moved yet.
- **Consequences:** Positive — the suite passed unchanged when both moved together. Tradeoff —
  verification has a trap: a worktree **symlinked to the repo's `node_modules` runs the old
  versions** and every gate passes against a dependency set nobody ships. Install the lockfile
  into the worktree with its own `node_modules` (`pnpm install --frozen-lockfile`) and compare the
  built bundle size before/after as well.

---

### ADR-008 — No animation library in the authenticated bundle; CSS-native motion first

- **Status:** Accepted
- **Date:** 2026-09 (`skills/cemurm-visual-system/SKILL.md`, `odd/tasks/visual-system-macos.md`)
- **Context:** Motion is required by the visual system, and adding GSAP/framer-motion is the
  default way to get it — in an app whose critical surface is a musician's tablet in a dark room.
- **Decision:** **0 bytes of animation library** in the authenticated bundle. `package.json`
  carries none (dependencies: `@fontsource/inter`, `@supabase/supabase-js`, `react`, `react-dom`,
  `react-router-dom`). Motion is CSS-native first: transitions, View Transitions,
  `animation-timeline: view()`, `@starting-style`, `opacity`/`transform` only.
- **Alternatives:** (a) GSAP + ScrollTrigger; (b) framer-motion; (c) a per-route lazy-loaded
  library for one surface.
- **Reason:** The skill calls it "project rule, not preference": stage performance and offline
  start-up cost are product properties, and a scroll/motion library taxes every route to animate
  one.
- **Consequences:** Positive — nothing competes with content on the performance surface. Tradeoff —
  no timeline API, so complex sequences are hand-authored CSS and harder to orchestrate; gated by
  `bash scripts/check-visual-contract.sh`, which runs in CI.

---

### ADR-009 — Tailwind pinned on the 3.4 line

- **Status:** Accepted
- **Date:** 2026-09-27 (toolchain review in `skills/cemurm-visual-system/references/toolchain-options.md`)
- **Context:** Tailwind 4 changes `shadow-*`, `ring` and `rounded-*` semantics and moves to a
  Vite plugin + `@import "tailwindcss"` model — those renames touch 40+ files, and the visual
  system's measured tokens were derived against 3.4's own defaults.
- **Decision:** Stay on Tailwind 3.4 (`package.json`: `"tailwindcss": "^3.4.4"`, lockfile resolves
  **3.4.19**), with the classic `tailwind.config.js` + `postcss.config.js`. Tailwind 4 is a
  deliberate future cycle, not a routine bump.
- **Alternatives:** (a) Migrate to Tailwind 4 now; (b) adopt v4-only tooling (shadcn/ui copy-in
  model) — explicitly deferred; (c) upgrade silently inside the caret range and fix fallout.
- **Reason:** Tailwind 3.4 compatibility is a hard gate of the visual system: every radius,
  shadow and font-size token in `assets/tokens.css` was validated against 3.4 defaults, and a
  major bump would change rendered output without failing any test.
- **Consequences:** Positive — the visual contract gate keeps meaning what it means. Tradeoff —
  no v4 features (native container queries, `@starting-style` helpers arrive via plain CSS
  anyway), and the version must be watched: the package range is `^3.4.4`, so the *pin* is really
  the lockfile — verify with `grep 'tailwindcss@' pnpm-lock.yaml`.

---

### ADR-010 — Layered architecture: pure domain, impure repositories, feature folders

- **Status:** Accepted (with known, logged violations — see Consequences)
- **Date:** 2026-09 (boundaries defined pre-relocation; executed by `docs/master-plan.md` M0a,
  "relocate 111 modules into the ADR 0002 boundaries", bundle byte-identical)
- **Context:** The pre-relocation tree mixed I/O into business logic, which made the
  characterization suite (ADR-006) impossible to write — a pure function cannot be asserted if it
  also fetches.
- **Decision:** `src/domain/**` = pure logic, no I/O. `src/data/repositories/` = the impure halves
  that talk to Supabase. `src/features/<feature>/` = pages and components. Leaf modules:
  `src/integrations/`, `src/offline/`, `src/ui/patterns/`. App shell: `src/app/` (entrypoint,
  router, providers). `src/lib/storage.js` is the one deliberate exception left in `src/lib/`.
- **Alternatives:** (a) Feature-first with each folder owning its own data access; (b) the classic
  `components/` + `pages/` + `store/` split the old docs describe; (c) no layering, colocate by
  convenience.
- **Reason:** The dependency direction is what the tests rely on: domain tests import no Supabase,
  so they run in the `node` environment with no mocking of HTTP.
- **Consequences:** Positive — the relocation was import-path-only and proved the bundle unchanged;
  domain/integration tests are cheap. Tradeoff — the boundary is a rule, not a compiler check, and
  violations exist: `docs/master-plan.md` §5b records `Overlay.jsx` and `useFootPedal.js` importing
  `supabase` directly (now from `src/data/supabase.js`), and `odd/tasks/cemurm-education-audit.md`
  adds `src/domain/music/degreeResolver.js` importing a repository. They are logged with a
  destination rather than hidden — an ADR that claims more than the code holds would be worse than
  no ADR at all.
