# Hito 5 — #69 External Auto-Tagging (Spotify) — task doc

**Feature:** `features/external-autotagging.feature` (9 scenarios) · Issue #69
**Branch:** `feat/hito5-spotify-enrichment` FROM `feat/hito5-obs` (4893c8a) — NEVER from main
**PR:** base `main`, Closes #69, stacked after #155. Delivery: `auto-chain` / `stacked-to-main`; forecast >400 authored lines ⇒ maintainer-approved `size:exception` (precedent #147/#148/#155).
**Data-layer facts (verified 2026-09-23):**
- `songs` (0001): title, artist, genre, source — NO art column. Owner-only RLS (`created_by = auth.uid()`, 0002).
- `song_versions` (0001): `base_key`, `base_tempo` (BPM; declared NEVER guessed), `metadata jsonb DEFAULT '{}'` — comment: "BPM/album-art suggestions with provenance; manual vs auto-filled provenance".
- `external_enrichments` (0001): song_id, source ('spotify'), field ('bpm'|'key'|'album_art'), value jsonb, state ('suggested'|'applied'|'discarded'), applied_by, created_at. **0002 already `revoke all` from anon, authenticated — deny-by-default today, no grants/policies.**
- `external_connections` (#41): designed in contract, **NOT ported**; user scope; "disconnect revokes future enrichment". Must be ported in 0026 (minimal).
- Client song model flattened: `key`→base_key, `bpm`→base_tempo, `versionId`, `chartFileId`. `fetchSongById` SELECTs `song_versions(*)` — metadata column flows through; `flattenSong` needs to expose `metadata`.
- `scale_catalog` (0014) + `src/lib/scaleCatalog.js` — canonical scale names + aliases (equal-spelling model hook).
- `transpose.js` — NOTES_SHARP/FLAT, FLAT_KEYS for rendering.
- Settings.jsx has interactive "MIDI output" section (#56) — pattern for the new "Integrations" section.
- midi.js / overlay.js — localStorage + best-effort + guarded runtime patterns.

---

## T1 — Migration 0026 + smoke + schema-v2 doc
**Commit:** `feat(supabase): port external_connections and open enrichment RLS (0026)`

### `supabase/migrations/0026_external_enrichment.sql`
Header comment (0025 style — describes spec, design, deviation).

1. **`external_connections`** (contract #41, minimal port for this feature):
   ```sql
   create table public.external_connections (
     id         uuid primary key default gen_random_uuid(),
     user_id    uuid not null references auth.users(id) on delete cascade,
     provider   text not null,                 -- 'spotify' (others land with #78)
     status     text not null default 'connected',  -- 'connected' | 'revoked'
     created_at timestamptz not null default now(),
     unique (user_id, provider)
   );
   ```
   RLS: enable; revoke all from public, anon; grant select, insert, update to authenticated; NO delete grant (revocation = status flip, row persists; YAGNI delete). Policies 0002 style:
   - select/insert/update `using/with check (select auth.uid()) is not null and user_id = (select auth.uid())`.
   - Insert with `status='connected'`; revoke = UPDATE status='revoked'` (keeps row; `unique(user_id,provider)` means reconnect upserts back to 'connected' — no connect UI in this feature, connection is implicit on first enrichment).

2. **`external_enrichments`** grants + policies (0002 revoked all — must now open selectively):
   - `grant select, insert, update on table public.external_enrichments to authenticated;` (NO delete — state machine only; no grant to anon).
   - **No ALTER, no new columns.** `applied_by` is the owner link for EVERY row: at insert the enriching user sets `applied_by = auth.uid()` (semantics: creator/action user — suggested rows are "created by", applied rows record who applied). Keeps 0001 DDL verbatim.
   - Policies:
     - select: `(select auth.uid()) is not null and (applied_by = (select auth.uid()) or (state = 'applied' and song_id in (select id from public.songs where created_by = (select auth.uid()))))` — owner of a song reads the applied-provenance on it; action rows readable by their creator.
     - insert: `(select auth.uid()) is not null and applied_by = (select auth.uid()) and state = 'suggested' and source in ('spotify')` — app inserts suggestions only; state transitions happen via update.
     - update: `(select auth.uid()) is not null and applied_by = (select auth.uid())` — only the creator flips state. App enforces the transition order (suggested → applied|discarded).

### `scripts/smoke/0026-spotify.sql`
Mirror 0025-obs.sql structure: fixed literal ids, rol switching via `set_config('role','…',false)` with SELECT prefix, grep-able `[PASS]`/`[FAIL]`. Fixture users: owner demo `10000000-0000-0000-0000-000000000001`, outsider `…0002`; song owner `20000000-0000-0000-0000-000000000001` (created_by=demo). Fixed enrichment row ids `30000…601`+.
Asserts:
- anon: SELECT/INSERT on external_connections and external_enrichments → `[PASS: anon denied]` (`%permission denied for table%`).
- authenticated owner: insert connection (provider spotify, status connected) → visible only to demo, NOT to outsider.
- owner: insert suggested enrichment rows (bpm/key/album_art, applied_by=demo, state suggested) → read back ok; outsider cannot see/update them (update filters 0 rows or permission-denied pattern → assert state unchanged under postgres).
- owner: update suggested → applied (2 rows), update one → discarded; song owner (demo) reads applied rows by song_id.
- revoke: owner updates connection status='revoked'; row persists; reconnect upsert flips back 'connected'.
- expected `[PASS]` count documented in header comment (e.g. “expects N PASS / 0 FAIL”).

### Docs
`docs/database-schema-v2.md`:
- §1 inventory line 11 note: `external_connections` (#41) is now ported in 0026 (minimal user-scope for #69); update the "designed but not ported" sentence + the 48-table counting note if it enumerates.
- §2: add the `external_connections` DDL block to the DDL section.
- §3 RLS matrix row for external_enrichments (add row if absent: "owner user action rows; applied values readable by song owner").
- Note the denial that `applied_by` carries all states (no column deviation).

**Verify T1:** `docker exec -i supabase_db_cemurm psql -U postgres -d postgres --no-psqlrc -q -v ON_ERROR_STOP=0 < scripts/smoke/0026-spotify.sql` after `supabase db reset` (remember: `sed` fix on 0019 → reset → `git checkout -- supabase/migrations/0019_rehearsal_workflow.sql`). All N PASS, 0 FAIL.

---

## T2 — Lib layer: spotify provider + enrichments data layer + songs metadata wiring
**Commit:** `feat(lib): spotify enrichment provider, provenance data layer and song metadata wiring`

### `src/lib/spotify.js` (new — pure + guarded, bandmates.js/midi.js pattern)
- `isSpotifyConfigured()` — `import.meta.env.VITE_SPOTIFY_CLIENT_ID && VITE_SPOTIFY_CLIENT_SECRET`.
- `isOnline()` — `navigator.onLine !== false` (guarded for node).
- `searchSpotifyMatch({ title, artist })` → Promise resolving:
  - `{ ok: true, match: { name, artist, albumArtUrl, bpm, keyIndex, mode, trackId } }`
  - `{ ok: true, match: null }` — no confident match (UI shows "No confident match — refine title or artist")
  - `{ ok: false, error: 'offline' | 'unavailable' }` — provider unreachable (incl. offline).
- **Mock provider (default, no credentials)**: deterministic. Title containing 'unconfident' (case-insensitive) or missing artist → match null. Otherwise plausible canned match derived from title hash: albumArtUrl = `https://i.scdn.co/image/cemurm-mock-<hash>` (UI has image onError→placeholder; no external fetch needed), bpm = 60 + (hash % 120), keyIndex = hash % 12, mode = 'major'. Document in header: mock is dev-contract, real API path exists but needs credentials (#78 surface).
- **Real provider**: when configured — Spotify Web API client-credentials token (POST /api/token), `GET /v1/search?type=track&q=<title> <artist>&limit=5`, pick first result with score ≥ threshold, then `GET /v1/audio-features/{id}` for tempo+key+mode. Best-effort try/catch → `{ok:false,error:'unavailable'}` on any failure (never throws).
- `spotifyKeyToLabel(keyIndex, mode)` — keyIndex 0–11 → NOTES_SHARP (import from `./transpose.js`), mode major|minor → `'E major'` / `'E minor'`. Return label + normalized form via `canonicalKeyLabel`.
- `canonicalKeyLabel(label)` — equal-spelling model (scenario 6): loads scale_catalog via `fetchScales()`, collapses aliases ('E' ≡ 'E major' for major, 'Em' ≡ 'E minor') into the catalog's canonical name; returns `{ label, canonical }`. NEVER silently conflicts: the enrichment UI compares `canonicalKeyLabel(declared base_key)` vs suggestion and shows a warning when different ("Spotify suggests E major — chart declares G major. Apply as suggestion?" does not write base_key).

### `src/lib/enrichments.js` (new — data layer, supabase.js pattern)
- `getSpotifyConnection(userId)` → row or null (offline-safe: localStorage mirror key `cemurm:spotify:connection:*` — read-through, overlay.js pattern).
- `ensureSpotifyConnected(userId)` → upsert connection status='connected' (first enrichment), mirror to localStorage.
- `disconnectSpotify(userId)` → UPDATE status='revoked'; applied metadata REMAINS (no delete of enrichments); mirror.
- `isSpotifyConnected(connection)` → `connection?.status === 'connected'`, with offline fallback from mirror.
- `suggestEnrichment(userId, songId, match)` → INSERT three rows (source 'spotify', fields bpm/key/album_art, value jsonb `{bpm: N}` / `{key: 'E major'}` / `{album_art: {url, trackId}}`, state 'suggested', applied_by userId) → returns rows.
- `applySuggestions(userId, songId, enrichmentRows)` → UPDATE state='applied' on owned suggested rows. Caller (component) ALSO persists applied values: BPM → existing `updateSong(userId, id, { bpm })` path; album art → `song_versions.metadata` jsonb merge `metadata.album_art = {url, source:'spotify', at: ISO}`; key stays a SUGGESTION only (never base_key — scenario 5).
- `discardSuggestions(userId, ids)` → UPDATE state='discarded'.
- `listEnrichments(userId, songId)` → rows ordered by field, created_at ASC; drives provenance display ("Auto-filled from Spotify", manual flags).
- Provenance helpers: `markManualProvenance(metadata, { key?, bpm? })` — when the user later manually edits key/bpm through updateSong, sets `metadata.provenance = { key: {source:'manual', at}, bpm: {...} }` merged alongside auto-filled entries (scenario 9).

### `src/lib/songs.js` (extend)
- `flattenSong`: expose `song.metadata` (= version.metadata jsonb) and any missing version fields used above (album art read path).
- `updateSong`: when `bpm` or `key` is passed by the USER edit form (not by enrichment), merge `metadata.provenance.<field> = {source:'manual', at: ISO}` (careful: enrichment apply uses BPM too — enrichment apply writes provenance source:'spotify' explicitly, so updateSong only marks manual when caller does not supply an explicit provenance override; simplest: updateSong accepts an optional 4th arg `provenanceSource = 'manual'` and enrichment apply calls with `'spotify'`).

---

## T3 — Hook + EnrichmentPanel + SongDetail wiring
**Commit:** `feat(songs): enrich from spotify with preview, apply/discard and provenance badges`

### `src/hooks/useSpotifyEnrichment.js` (new)
State machine: `idle | searching | suggested | applying | applied | discarded | noMatch | offline | error`. API: `lookup()`, `apply()`, `discard()`, `reset()`, `connection`, `match`, `rows`. Gating: `!isOnline() → offline` state before any provider call (scenario 7: no new Spotify call while offline). Gating: `!isSpotifyConnected → error 'integration revoked'` after revoke (client gate; backend ALSO has no path to enrich without owner row — revoke is enforced at the app level + RLS owner-only). Never blocks song reading — applied values ride the normal song cache.

### `src/components/songs/EnrichmentPanel.jsx` (new — Tailwind, house style, `/* eslint-disable react/prop-types */` per ~20-file convention; do NOT install prop-types)
Rendered in SongDetail (below the edit/save area, above comments). Contents:
- "Enrich from Spotify" trigger button (disabled + tooltip text while offline: "Offline — saved metadata stays available; new suggestions need a connection").
- searching → spinner text.
- noMatch → amber card: "No confident match — refine title or artist". Nothing written (scenario 2).
- suggested → preview card: album art thumbnail (img with onError → placeholder div), `BPM <n>`, key badge rendered via `canonicalKeyLabel` (equal-spelling), tracks declared base_key conflict check → amber note "Suggestion differs from declared key — applied as suggestion only". Buttons **Apply** / **Discard** (scenario 1 + 3; discard → rows 'discarded', song untouched).
- applied → success line + provenance strip: "BPM 120 · Auto-filled from Spotify" badges (scenario 4 provenance + scenario 5 key-as-suggestion line: "Suggested key stays a suggestion — declared key unchanged").
- error → neutral error card.
- `AlbumArt` inline component: shows applied art when `metadata.album_art` exists (offline-safe — it's on the version row).

### `src/pages/SongDetail.jsx` (extend)
- Mount `useSpotifyEnrichment`; render EnrichmentPanel after the body/save area; pass `song` (needs artist; if artist missing, panel prompts "Add an artist first" — the mock needs title+artist; artist edit lives in SongForm).
- Key/BPM display area: when version metadata provenance says spotify for bpm, show "Auto-filled" badge next to BPM; declared key area untouched (always shows base_key; suggestion key only inside the panel).
- No new route.

---

## T4 — Settings Integrations section + offline/revoke polish
**Commit:** `feat(settings): spotify integration status and disconnect`

### `src/pages/Settings.jsx`
New "Integrations" section below MIDI output (same card style):
- Spotify row: status line — "Connected" (green dot) / "Not connected" / "Revoked". Connect is implicit on first enrichment (no OAuth in this feature) — the row says so: "Connections are created automatically when you enrich a song."
- **Disconnect** button (when connected): confirm inline → `disconnectSpotify` → status Revoked; info line: "Disconnect stops future enrichments. Metadata already applied stays on your songs." (scenario 8). Not connected → text only, no button.
- Offline: read connection from localStorage mirror; no network required to render.

---

## T5 — Docs + verification + PR
**Commit:** `docs(spotify): document mock provider, env vars and enrichment flow`

- `docs/local-dev.md`: add Spotify provider section — `VITE_SPOTIFY_CLIENT_ID`/`VITE_SPOTIFY_CLIENT_SECRET` in `.env.local` switch to the REAL Spotify Web API (client-credentials; /search + /audio-features); without them the deterministic mock runs; note that real OAuth connect UX lands with #78.
- Make sure `.env.local` is NOT modified (it must keep pointing at the local stack, chmod 600).

### Full verification (before PR):
1. `pnpm lint` — 0 warnings (re-run by orchestrator).
2. `pnpm build` — green.
3. Reset protocol + `scripts/smoke/0026-spotify.sql` — N PASS / 0 FAIL.
4. Manual dev-server sanity: `pnpm dev`, enrich a song via mock, apply BPM+art, discard another, reload offline check (DevTools offline) → panel shows offline gate; Settings shows Connected → Disconnect → Revoked; enrichment button blocked.
5. `size:exception` note in PR body: forecast ~1 100–1 300 authored lines (chain precedent #148/#155).

### PR
- Branch `feat/hito5-spotify-enrichment` from current stack head (`feat/hito5-obs` 4893c8a). Work-unit commits T1–T5 (Conventional Commits, commit identity recorded here after each task). Open PR base `main`, title `feat(hito5): external auto-tagging from Spotify (closes #69)`, body: scenarios covered, smoke + lint/build results, size:exception, manual validation notes (mock provider; real API needs credentials → #78). No `type:*`/`status:approved` labels (chain pattern).

---

## Acceptance criteria (feature map)
1. Enrich flow with preview before apply — T3 panel.
2. Poor match → message, nothing written — T2 mock + T3 noMatch.
3. Discard → song untouched, rows 'discarded' — T2/T3.
4. Apply BPM + art → base_tempo + metadata.album_art + applied rows + spotify provenance — T2/T3.
5. Key stays suggestion, never base_key — T2/T3.
6. Equal-spelling via scale_catalog canonical labels; conflicting sources surfaced, never silent — T2 `canonicalKeyLabel` + T3 warning.
7. Offline: applied values cached; no new Spotify call — T2 isOnline gate + T3 disabled state.
8. Revoke in Settings stops future enrichment; applied metadata remains — T1/T2/T4.
9. Provenance visible; manual corrections marked manual — T2 metadata.provenance + T3 badges.

## Progress
- [x] T1 migration + smoke + docs — commit `d5eae3c` `feat(supabase): port external_connections and open enrichment RLS (0026)`
- [x] T2 lib layer — commit `70632be` `feat(lib): spotify enrichment provider, provenance data layer and song metadata wiring`
- [x] T3 hook + panel + SongDetail — commit `59d4a3d` `feat(songs): enrich from spotify with preview, apply/discard and provenance badges`
- [x] T4 Settings + offline/revoke — commit `bf0caa5` `feat(settings): spotify integration status and disconnect`
- [x] T5 docs + verification — commit `fd77caa` `docs(spotify): document mock provider, env vars and enrichment flow`
- [x] T6 PR — PR **#156** https://github.com/davidjesus516/cemurm/pull/156 (base main, Closes #69, rama `feat/hito5-spotify-enrichment`, pushed origin, sin labels — patrón de cadena)

## Verification record (2026-09-23)
- Writer (general): `pnpm lint` 0 warnings ✅ · `pnpm build` green ✅ · smoke 0026 fresh reset **24 PASS / 0 FAIL** ✅ · lib E2E via Vite SSR against live stack **26/26 PASS** (mock provider; suggest→apply with BPM provenance + metadata.album_art; key NEVER written to base_key; discard leaves song untouched; revoke→reconnect upsert) ✅ · `.env.local` untouched.
- Orchestrator re-check: `gentle-ai review assess --base-ref feat/hito5-obs --committed-only` → **risk medium** (executable smoke), 12 paths / 1677 lines; RDD off + native transport unsupported ⇒ tier: writer self-verification (done) + parent spot check ✅. Re-ran `pnpm lint` (0 warnings) + `pnpm build` (green). Structural readback of 0026 policies/grants, lib guards, panel states, Settings section ✅.
- Slice size (vs feat/hito5-obs): ~1 677 authored lines ⇒ `size:exception` (precedent #148/#155).

TDD mode: OFF (no test runner in repo) — functional checks = smoke vectors + lint + build. Commits: work-unit per task, conventional, English.