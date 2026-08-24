# CEMURM — Agent Guide

## What this is

PWA for musicians: repertoires, setlists, live performance, offline-first. Early stage — the app shell is a placeholder (`src/App.jsx`). Backend (Supabase) not yet integrated.

## Commands

```bash
npm run dev      # Vite dev server → localhost:5173
npm run build    # production build to dist/
npm run lint     # ESLint (React + React Hooks plugins) — zero warnings enforced
```

No test framework, no typecheck, no CI workflows. Don't look for them.

## Code style

- **Tailwind CSS only** — no CSS modules, styled-components, or inline styles.
- Component files: `PascalCase.jsx` (e.g. `SongCard.jsx`).
- Hook files: `camelCase` with `use` prefix (e.g. `useAuth.js`).
- Utility files: `camelCase` (e.g. `transposition.js`).
- **JSX, not TSX** — the spec mentions TypeScript but the codebase uses plain JS. Follow what exists.

## Entry points

- `src/main.jsx` — React root, mounts `<App />`.
- `src/App.jsx` — app shell (currently placeholder).
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

Most of these directories don't exist yet. When creating new files, follow this structure.

## Specs & docs

- `features/*.feature` — 23 Gherkin BDD specs defining the full product. Read these to understand what the app should do.
- `docs/technical-spec.md` — architecture, tech choices, database schema.
- `docs/mvp-scope.md` — milestone plan (Hito 1–6, 12-month timeline).
- `CONTRIBUTING.md` — branch/commit/PR conventions.

## Conventions

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`.
- Feature branches from `main` (`feat/my-feature`).
- PRs: focused on one change, reference issues, lint must pass.
- **Proprietary license** — no open-source assumptions.

## Gotchas for agents

- There is no lockfile. `npm install` will create one — that's expected, not a mistake.
- No `.env` files exist yet. Supabase integration is future work.
- The `features/` directory is your product spec source of truth, not the README.
- Tailwind config scans `src/**/*.{js,ts,jsx,tsx}` — but everything is `.js`/`.jsx` today.
