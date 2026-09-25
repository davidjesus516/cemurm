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

### App-side flow

- **Create:** the song form's chart-source toggle selects *PDF scan* (no upload on save — just the file). `addSong` (in `src/lib/songs.js`) validates first (10 MB / type) and only then uploads + writes: `chart_files` row (`format = 'pdf'`), `song_versions` v1 ("Original").
- **View:** `PdfChartViewer` renders the scan with the browser's NATIVE PDF viewer (`<iframe>` + signed URL) — no PDF library. Zoom toolbar applies CSS `transform: scale()` (75%–200% + −/+); "Open in new tab" / "Download" are always available (fallback when the browser lacks inline PDF rendering). Text editing is impossible for scans by design; the key shown is the declared key.
- **Replace:** SongDetail's *Replace scan* uploads a new object and appends v{n+1} ("Corrected scan"); the previous scan and version stay in history (version picker shows "v1 · PDF scan", "v2 · PDF scan").
- **Stage mode:** full-screen viewer via the same component; transpose controls are hidden for PDF songs ("PDF scans need a new scan to change key"). Offline: the scan blob cached under `pdf` renders from `blob:` (objectURL) without network — cache by opening the song online beforehand.
- **No env vars** — Storage auth is server-side (migrations use the service role; the browser talks to the bucket through the anon key + storage RLS, never a public URL).

## Import providers (Hito 5 #78)

Three integration surfaces share the import pipeline (`external_connections` / `external_enrichments`, migration 0026+0028). All providers follow the spotify.js pattern: `{ ok:true, … } | { ok:false, error: 'offline'|'unavailable' }`, gated by `isOnline()`, **never throwing**.

### MusicBrainz + LRCLIB (metadata + lyrics)

- **Mock (default, no env vars):** `src/lib/musicbrainz.js` and `src/lib/lrclib.js` resolve deterministic dev contracts from the title/artist hash — MusicBrainz yields `{ title, artist, year, genre }`, LRCLIB a template lyric block. Titles containing `unconfident` / `nomatch` (case-insensitive) or missing title/artist → "no confident match" (`{ ok:true, match:null }`, nothing written).
- **Real API (opt-in, no credentials):** add to `.env.local`:

  ```env
  VITE_MUSICBRAINZ_LIVE=true
  VITE_LRCLIB_LIVE=true
  ```

  Both APIs are credential-free; the flags exist for rate-limit/CORS control during development. Offline or any network/CORS/HTTP failure resolves to `{ ok:false, error:'offline'|'unavailable' }` — **NO silent mock fallback** (mock ↦ live would silently change results in production).

### Planning Center (mock only)

Real Planning Center OAuth requires a **server-side callback** (the app is client-only today) — documented limitation, no real connection until a server component lands. The dev mock (`src/lib/planningcenter.js`) is a deterministic contract: connecting upserts the `external_connections` row (provider `'planningcenter'`, `unique(user_id, provider)` — shared with Spotify), and two plans are listed:

- **Sunday 10am** — 4 songs: `Way Maker` / `Oceans (Where Feet May Fail)` match seeded demo songs …-001/…-002 (linked), `Goodness of God` / `Kingdom` have no chart (created on import → the SetlistDetail missing-chart flag, S12).
- **Wednesday Rehearsal** — extra plan for picker coverage.

Import creates `<name> (from Planning Center)` as an ordinary, editable setlist (songs linked or created; revoke deletes nothing). Revoke flips the row to `status='revoked'`; every lib call then gates with the exact error `'integration revoked'` (S13) — the UI surfaces "reconnect in Settings". The connection state mirrors to `localStorage` (`cemurm:pco:connection:<userId>`) so gates render offline.

### URL import — metadata only by design

`src/lib/importers/urlImport.js` NEVER fetches the pasted URL — parsing is a pure `new URL()` + slug-derivation; the only network that may happen is the optional MusicBrainz artist completion (mock by default). Chord-tab domains (`ultimate-guitar.com`, `e-chords.com`, …) are refused with the exact message **"We don't import content from chord sites — paste your own chart"** (S15); other URLs prefill the New Song form's title + best-effort artist, and invalid URLs → `'Enter a valid URL.'`.

## Export flows (Hito 5 #78)

- **OnSong `.cho` file:** `src/lib/exporters/onsong.js` serializes the setlist in order, per song `{title:}` / `{artist:}` / `{key:}` (agreed key = the item's pinned version key, else the song's current key) + the chart body verbatim. Only title/artist/key/body — never projections, annotations or comments (S17). In the browser, `downloadOnSongFile` builds a Blob + object URL and clicks an anchor (`<setlist-name>.cho`); in node (no DOM) it returns `{ ok, filename, text }` so the demo asserts the exact payload.
- **Planning Center push (mock):** `exportSetlistToPlan` returns `{ ok:true, pushed, planId }` — the mock counts the payload; the serializer passed in already excludes projections by construction. Revoked → the same `'integration revoked'` gate. The SetlistDetail surface shows `Pushed N songs to <plan>`.

## Run / stop

```bash
pnpm dev        # Vite dev server → http://localhost:5173
pnpm lint       # ESLint, zero warnings
pnpm build      # production build to dist/
supabase stop   # --no-backup also drops the local volumes
```