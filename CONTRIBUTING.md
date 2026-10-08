# Contributing to CEMURM

Thank you for your interest in contributing to CEMURM! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and constructive. We're building this for musicians of all backgrounds and skill levels.

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/davidjesus516/cemurm/issues) to avoid duplicates
2. Open a new issue using the **Bug Report** template
3. Include as much detail as possible (steps to reproduce, device, browser, screenshots)

### Suggesting Features

1. Check [existing issues](https://github.com/davidjesus516/cemurm/issues) for similar requests
2. Open a new issue using the **Feature Request** template
3. Explain the problem you're solving, not just the solution you want

### Submitting Code

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
3. Make your changes
4. Run the full check sequence locally:
   ```bash
   pnpm install --frozen-lockfile
   pnpm test && pnpm typecheck && pnpm lint && pnpm build
   bash scripts/check-visual-contract.sh
   ```
5. Commit with a clear message following [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add chord transposition controls"
   ```
6. Push and open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation changes
- `style:` — formatting, missing semicolons, etc.
- `refactor:` — code restructuring without behavior change
- `test:` — adding or updating tests
- `chore:` — tooling, dependencies, config

### Pull Request Guidelines

- Keep PRs focused on a single change
- Include a clear description of what changed and why
- Reference related issues (e.g., "Closes #42")
- Ensure `pnpm lint` passes with zero warnings, and that `pnpm test` and `pnpm typecheck` are green
- Add screenshots for UI changes
- Request at least one review before merging
- Keep PRs ≤400 changed lines where practical; larger work ships as chained `-prN-` slices

## Development Setup

```bash
# Clone the repository
git clone https://github.com/davidjesus516/cemurm.git
cd cemurm

# Install dependencies (pnpm only — never npm install / npm run *)
pnpm install --frozen-lockfile

# Start the local Supabase stack (PostgreSQL + auth). Required before you can sign in.
supabase start

# .env.local (gitignored) needs the local API URL + anon key:
#   VITE_SUPABASE_URL=http://127.0.0.1:54321
#   VITE_SUPABASE_ANON_KEY=<from `supabase status`>

# Start dev server
pnpm dev
```

The app runs at `http://localhost:5173`. This project is **not** linked to a hosted Supabase
project — see [`docs/local-dev.md`](docs/local-dev.md).

## Project Structure

The tree was relocated into ADR 0002 boundaries. The pre-relocation layout (`components/`,
`pages/`, `hooks/`, `store/`, `utils/`) **no longer exists** — those paths are gone, including
`store/`: there is **no Zustand** in this project, and state lives in React context and hooks.

```
src/
├── app/            # Entrypoint (main.jsx), router, AppLayout shell, providers
├── features/       # One directory per feature: its own pages/ and components/
├── data/           # Supabase client + repositories/ — the impure half
├── domain/         # Pure logic, no I/O
├── integrations/   # Third-party provider clients (Spotify, MusicBrainz, LRCLIB, Web MIDI)
├── offline/        # IndexedDB cache, write queue, drain-on-reconnect
├── ui/             # Shared UI patterns
└── lib/            # storage.js only — the one deliberate exception left here
```

`AGENTS.md` is the authoritative description of this layout and of the conventions below.

## Style Guide

- Use Tailwind CSS for all styling (no CSS modules or styled-components)
- Component files use PascalCase: `SongCard.jsx`
- Hook files use camelCase with `use` prefix: `useAuth.js`
- Utility files use camelCase: `transposition.js`
- Keep components small and focused (single responsibility)
- Extract reusable logic into custom hooks

## Questions?

Open a discussion on GitHub.

---

*Corrected 2026-09-30 against `main` = `762a040`: the `npm` commands, the `your-org` remote, the
missing `test`/`typecheck`/visual steps, and the pre-relocation `src/` tree (including the
`store/`-Zustand claim, which was never true of the current tree). See `AGENTS.md` for the
authoritative conventions.*
