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

## Spotify enrichment provider (mock vs real API)

Song enrichment (Hito 5 #69) runs against the **Spotify Web API** — or a deterministic **mock** when no Spotify credentials are configured.

- **Mock (default, no credentials):** `src/lib/spotify.js` derives a plausible match from the song title+artist — album-art URL is a fake `i.scdn.co`-style path (the UI shows a placeholder instead of fetching it), BPM 60–179, key 0–11, mode major. Titles containing `unconfident` (case-insensitive) or missing artist → "No confident match". Records land in `external_enrichments`; the connection row lands in `external_connections` (migration 0026), created implicitly on the first enrichment.
- **Real API (with credentials):** add to `.env.local`:

  ```env
  VITE_SPOTIFY_CLIENT_ID=<client id>
  VITE_SPOTIFY_CLIENT_SECRET=<client secret>
  ```

  When both are present, `searchSpotifyMatch` switches to the real client-credentials flow: `POST https://accounts.spotify.com/api/token` → `GET /v1/search?type=track&q=<title> <artist>&limit=5` (first result scoring ≥ 0.7) → `GET /v1/audio-features/{id}` for tempo + key + mode. Any failure resolves to "unavailable" — the provider never throws.

The real OAuth connect UX (user-authorized scopes, per-user tokens) lands with #78 — today the connection is implicit on first enrichment, and disconnect only revokes future suggestions (already-applied metadata stays on the songs).

## PDF scan charts

PDF scans (Hito 5 #76) upload to the **`charts` Storage bucket** — created by migration 0027 as PRIVATE (`public = false`) with owner-folder RLS on `storage.objects`; object keys are `${auth.uid()}/${uuid}.pdf`, so each user can only see/write their own folder.

- Uploads go through local Supabase Storage: `supabase.storage.from('charts').upload(...)`; the browser never talks to the bucket directly.
- Reads use **signed URLs** (`createSignedUrl`, 1-hour default) — the bucket stays private by design (no public URL ever).
- Local upload cap: `supabase/config.toml` `file_size_limit = "50MiB"` (hard server cap). The app additionally enforces the 10 MB product limit before any upload (see `src/lib/pdfCharts.js`).
- Offline: PDF scans are cached in the browser Cache API under the `pdf` category (`cemurm-pdf-v1`); the Storage screen shows/clears them under "PDF scans".

## Run / stop

```bash
pnpm dev        # Vite dev server → http://localhost:5173
pnpm lint       # ESLint, zero warnings
pnpm build      # production build to dist/
supabase stop   # --no-backup also drops the local volumes
```