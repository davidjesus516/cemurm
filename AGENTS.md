# CEMURM — Agent Guide

## What this is

PWA for musicians: repertoires, setlists, live performance, offline-first. Hito 1–4 are implemented (Hito 5 in progress): React Router shell, ChordPro parser/renderer, song/setlist CRUD + search, thin practice view, Stage Mode, offline-first via `public/sw.js` + IndexedDB (read cache, offline write queue, drain on reconnect), band collaboration (shared setlists, bandmates, comments, notifications), public library (contributions, profiles, follows, moderation), org repertoire, and services/rehearsals — all against hosted Supabase (48-table schema, RLS, GoTrue auth) wired through `src/lib/supabase.js` / `src/lib/auth.js`. Hito 5 (MIDI, external display, OBS overlay, plan freeze) is under development on feature branches; Hito 6 (beta polish) is planned.

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
- `src/App.jsx` — router; the authed tree is wrapped by `RequireAuth` + `RequireGuardianConsent` gates. Routes: `/`, `/songs`, `/songs/:id`, `/songs/:id/practice`, `/library`, `/moderation`, `/profile/:userId`, `/setlists`, `/setlists/:id`, `/setlists/:id/stage`, `/gigs`, `/gigs/:id`, `/bandmates`, `/organizations`, `/services`, `/services/:id`, `/rehearsals`, `/rehearsals/:id`, `/notifications`, `/settings`, `/settings/storage`, `/auth`, `*`.
- `index.html` — Vite entry, loads `src/main.jsx`.

## Project layout

```
src/
├── components/     # Reusable UI components (auth/, gigs/, layout/, moderation/, notation/, songs/)
├── pages/          # Route-level components (24 pages today)
├── hooks/          # Custom React hooks (14 hooks today)
├── lib/            # Utilities, API clients, parsers (31 modules today, incl. chordpro/, offline layer)
└── utils/          # Pure utility functions (relativeTime.js today)
```

`components/`, `pages/`, `hooks/`, `lib/`, and `utils/` are populated. `src/store/` does not exist (no Zustand — state lives in React context and hooks). New files follow this structure.

## Specs & docs

- `features/*.feature` — 42 Gherkin BDD specs defining the full product. Read these to understand what the app should do.
- `docs/technical-spec.md` — architecture, tech choices, database schema.
- `docs/database-schema-v2.md` — 48-table data model contract; implemented verbatim in `supabase/migrations/0001_init.sql` (+ RLS in `0002_rls_core.sql`, extended through `0019_rehearsal_workflow.sql` on main).
- `docs/mvp-scope.md` — milestone plan (Hito 1–6, 12-month timeline); Hito 1–4 shipped, Hito 5 in progress.
- `openspec/` — archived specs and change records for shipped work: specs under `openspec/specs/` (row-level-security, user-auth, gigs, personal-preferences, pwa-updates-storage, shared-setlist-collaboration, collaboration-bandmates, collaborative-comments, notifications); archived change dirs under `openspec/changes/archive/` (2026-09-11 rls-and-offline-first, 2026-09-15 hito-2-remainder, 2026-09-18 hito-3-band-collaboration, 2026-09-19 hito-3-notifications).
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