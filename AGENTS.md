# CEMURM — Agent Guide

## What this is

PWA for musicians: repertoires, setlists, live performance, offline-first. Hito 1 (core viewer + auth) is implemented: React Router shell, ChordPro parser/renderer, song/setlist CRUD + basic search (localStorage mocks), thin practice view, and a local Supabase stack (48-table schema, RLS, GoTrue auth) wired through `src/lib/supabase.js` / `src/lib/auth.js`. Offline-first surfaces (stage mode, service worker, offline queue) are planned, not built — the `outbox` table is schema-only today.

## Commands

Package manager is **pnpm** (v11). Scripts run identically:

```bash
pnpm dev       # Vite dev server → localhost:5173
pnpm build     # production build to dist/
pnpm lint      # ESLint (React + React Hooks plugins) — zero warnings enforced
pnpm install   # installs from pnpm-lock.yaml (pnpm ci equivalent: pnpm install --frozen-lockfile)
```

Never add `package-lock.json` or run plain `npm install` — the lockfile is `pnpm-lock.yaml`.

No test framework, no typecheck, no CI workflows. Don't look for them.

## Code style

- **Tailwind CSS only** — no CSS modules, styled-components, or inline styles.
- Component files: `PascalCase.jsx` (e.g. `SongCard.jsx`).
- Hook files: `camelCase` with `use` prefix (e.g. `useAuth.js`).
- Utility files: `camelCase` (e.g. `transposition.js`).
- **JSX, not TSX** — the spec mentions TypeScript but the codebase uses plain JS. Follow what exists.

## Entry points

- `src/main.jsx` — React root, mounts `<App />`.
- `src/App.jsx` — router (routes: `/`, `/songs`, `/songs/:id`, `/songs/:id/practice`, `/setlists`, `/setlists/:id`, `/auth`, `*`) with auth guards.
- `index.html` — Vite entry, loads `src/main.jsx`.

## Project layout

```
src/
├── components/     # Reusable UI components
├── pages/          # Route-level components
├── hooks/          # Custom React hooks
├── lib/            # Utilities, API clients, parsers
├── store/          # Zustand state stores
└── utils/          # Pure utility functions
```

`components/`, `pages/`, `hooks/`, `lib/` are populated; `store/` and `utils/` are not (yet). New files follow this structure.

## Specs & docs

- `features/*.feature` — 42 Gherkin BDD specs defining the full product. Read these to understand what the app should do.
- `docs/technical-spec.md` — architecture, tech choices, database schema.
- `docs/database-schema-v2.md` — 48-table data model contract; implemented verbatim in `supabase/migrations/0001_init.sql` (+ RLS in `0002_rls_core.sql`).
- `docs/mvp-scope.md` — milestone plan (Hito 1–6, 12-month timeline).
- `openspec/` — archived main specs for the two completed changes: `openspec/specs/row-level-security/spec.md`, `openspec/specs/user-auth/spec.md`.
- `docs/local-dev.md` — local Supabase stack: start/reset/stop, seed identities, `.env.local` vars.
- `CONTRIBUTING.md` — branch/commit/PR conventions.

## Conventions

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`.
- Feature branches from `main` (`feat/my-feature`).
- PRs: focused on one change, reference issues, lint must pass.
- **License**: MIT — see `LICENSE`.

## Gotchas for agents

- Lockfile is `pnpm-lock.yaml` (already committed). Use `pnpm` for everything.
- `pnpm-workspace.yaml` holds `allowBuilds` (postinstall scripts are blocked by default; approve explicitly there).
- `.env.local` (gitignored) supplies `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` for the local Supabase instance; `src/lib/supabase.js` throws if either is missing. Local stack config lives in `supabase/config.toml` (`supabase start`).
- The `features/` directory is your product spec source of truth, not the README.
- Tailwind config scans `src/**/*.{js,ts,jsx,tsx}` — but everything is `.js`/`.jsx` today.