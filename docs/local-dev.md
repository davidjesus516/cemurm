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

`supabase/seed.sql` creates **three** confirmed users — `demo@cemurm.app`, `isolation@cemurm.app`
and `outsider@cemurm.app` — and **all three share the password `password1234`**. The plaintext is
`password1234`; the file stores it as `crypt('password1234', gen_salt('bf'))`, so the plaintext
inside that `crypt()` call *is* the password.

> **Correction (2026-09-30).** This line previously read "creates two confirmed users" and "the
> password is the plaintext in the `crypt()` call inside that file" — technically true but
> unusable, because it made you go read the SQL to learn a password you need in order to log in.
> The count was verified against `supabase/seed.sql` on `main` (three `crypt('password1234', …)`
> calls) and the password is now stated outright. `AGENTS.md` carries the same three users with
> their fixture roles.

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

## Guardian consent by email (Hito 4 / WU4) — the first server-side code

The guardian-consent flow is the first thing in the product that leaves the browser. A minor submits a request, and **the approval has to arrive in a parent's inbox** — a parent who has no CEMURM account and never will, which is why `/guardian/confirm` and `/guardian/revoke` sit outside `RequireAuth`. All the access-control rules still live in the database (`supabase/migrations/0031_guardian_consent_email.sql`); the Edge Function is a courier.

Three things have to be configured. Two of them are optional in the sense that the app runs without them — and says so honestly instead of pretending to have sent anything.

### 1. The Resend key — Supabase Vault (D5)

```bash
# once per environment; a secret belongs to an environment, not to a repository
docker exec -i supabase_db_cemurm psql -U postgres -d postgres \
  -c "select vault.create_secret('re_…', 'resend_api_key', 'Guardian email sender');"
```

Nothing else in the repo ever holds this value. `public.read_resend_api_key()` (migration 0031) reads it from `vault.decrypted_secrets` and is granted to **`service_role` only** — `anon` and `authenticated` get `permission denied for function read_resend_api_key`, and the smoke asserts it on `PUBLIC`, `anon` and `authenticated`. Not in `supabase/config.toml` (it is tracked), not in a `VITE_` variable (that ships to every browser).

**With no key the local stack is still a working stack:** the function answers `503 {"error":"email_not_configured"}` and sends nothing. That is the normal local state, and it is the reason this work unit is deliverable without credentials. There is no mock send anywhere in the function.

**The from-address — `RESEND_FROM`.** The function sends from `CEMURM <guardian@cemurm.app>` by default, and Resend only accepts a from-address on a **verified domain**. Without one — or to test without buying one — override it per environment:

```env
RESEND_FROM=onboarding@resend.dev
```

in `supabase/functions/.env`, under the same rules as `SITE_URL` below: gitignored, read once at `supabase start`, restart the stack after editing. Resend's test sender delivers **only to the account's own email address** — every other recipient gets `403` — which is enough to smoke-test locally with a guardian address that is your Resend account. Production keeps the default: verify the domain in Resend (DNS SPF/DKIM), then rely on `guardian@cemurm.app` or set `RESEND_FROM` with `supabase secrets set`.

### 2. `SITE_URL` — the app origin (not a secret)

The guardian link is absolute, so the function needs to know where the PWA lives. It does **not** read the request's `Origin` header: a spoofed origin would put a working approval link in a stranger's domain.

`supabase/functions/.env` is gitignored (the root `.gitignore` `.env` pattern matches at any depth) and is read by the local stack into the function's environment:

```env
SITE_URL=http://localhost:5173
```

Without it the function answers `503 {"error":"app_url_not_configured"}`. Restart the stack (`supabase stop && supabase start`) after adding it — the local stack only reads `functions/.env` at start, and a new function directory is likewise only picked up by a full restart, not `docker restart`.

### 3. The function itself

`supabase/functions/send-guardian-consent/index.ts`, declared in `supabase/config.toml`:

```toml
[functions.send-guardian-consent]
verify_jwt = true
```

`verify_jwt` is load-bearing: the function derives the account from the JWT `sub` and never from the request body, so a signed-in minor cannot mail a stranger's guardian. A malformed bearer is rejected by the gateway (`UNAUTHORIZED_INVALID_JWT_FORMAT`); the handler keeps its own typed `401` for a JWT that carries no user.

Calling it by hand, as a signed-in minor:

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/send-guardian-consent \
  -H "apikey: $ANON" -H "Authorization: Bearer $MINOR_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' -d '{}'
```

| Situation | Answer |
|-----------|--------|
| No / malformed JWT | `401` at the gateway |
| No `SITE_URL` | `503 app_url_not_configured` |
| No Vault key | `503 email_not_configured` |
| Fake or wrong Resend key | `502 email_provider_failed` (Resend's own body is logged, never returned) |
| Pending request, key accepted | `200 {"status":"sent","provider_message_id":"…"}` — the **only** success |
| Consent already `active` | `200 {"status":"already_active"}` — nothing sent |
| Request already finalized | `200 {"status":"no_open_request"}` — nothing sent |

The function is a courier, not a second writer: it reads the existing `pending` row and never creates one, so a retry cannot turn one request into two approval emails.

**A real send is NOT verified.** No Resend credential exists in this environment, so the last row above has never been observed. What *has* been observed is the call leaving the process — with a deliberately fake key, Resend answered `401 API key is invalid`, which proves the outbound fetch, the link building and the pending-row lookup all work. Do not report a real email as tested.

### Exercising the guardian pages

`pnpm dev`, then open a link straight out of the ledger as `postgres`:

```sql
select 'http://localhost:5173/guardian/confirm?user=' || user_id
       || '&token=' || revocation_token
  from public.guardian_consents where status = 'pending';
```

The revoke link needs the witness as well — 0017's `revoke_guardian_consent` requires the guardian's email next to the token, so the emailed link carries `&email=<guardian_email>`. Both pages strip the whole query string out of browser history the moment they read it (`src/lib/guardianLink.js`), and neither auto-confirms on load: a mail-client link scanner would otherwise spend the one-shot capability.

## Run / stop

```bash
pnpm dev        # Vite dev server → http://localhost:5173
pnpm lint       # ESLint, zero warnings
pnpm build      # production build to dist/
supabase stop   # --no-backup also drops the local volumes
```