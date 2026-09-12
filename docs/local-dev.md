# CEMURM — Local Development (Supabase stack)

The app runs against a **local Supabase stack** (PostgreSQL 17, GoTrue auth, owner-scoped RLS). This project is NOT linked to a hosted Supabase project — verification and development are local-only today.

## Prerequisites

- **Docker** (running daemon)
- **Supabase CLI**
- **pnpm** (v11) — the package manager (never `npm install`)

## Start the stack

```bash
supabase start
```

Boots Postgres (+ Auth) on the local ports and applies `supabase/migrations/` + `supabase/seed.sql`. First run pulls images and takes a while.

## Reset the database

```bash
supabase db reset
```

Re-applies `0001_init.sql` (48 tables) + `0002_rls_core.sql` (RLS) + `seed.sql` from scratch. Use when migrations changed or state is dirty.

## Seed identities

`supabase/seed.sql` creates two confirmed users — `demo@cemurm.app` and `isolation@cemurm.app`. The password is the plaintext in the `crypt()` call inside that file.

## Environment variables

Run `supabase status` and copy into a gitignored `.env.local` at the repo root:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase status>
```

`src/lib/supabase.js` throws if either variable is missing.

## Run / stop

```bash
pnpm dev        # Vite dev server → http://localhost:5173
pnpm lint       # ESLint, zero warnings
pnpm build      # production build to dist/
supabase stop   # --no-backup also drops the local volumes
```