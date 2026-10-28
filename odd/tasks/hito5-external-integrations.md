# Hito 5 — #76→#78 External Integrations and Import — task doc

**Feature:** `features/external-integrations.feature` (17 scenarios) · Issue #78
**Branch:** `feat/hito5-external-integrations` FROM `feat/hito5-pdf-scan` (d1d6361) — NEVER from main
**PR:** base `main`, Closes #78, stacked after #159. Delivery `auto-chain` / `stacked-to-main`; forecast ≈3 000+ authored lines ⇒ maintainer-approved `size:exception` (precedent #148/#155/#156/#159).
**Migration:** next is **0028**. Smoke: `scripts/smoke/0028-import-integrations.sql`.

## Verified facts (2026-09-24)

- `songs` (0001:70): has `title NOT NULL, artist, genre, source, source_org_id, is_deleted, created_by…` — **NO `year`, NO `license`, NO `license_confirmed`** ⇒ 0028 adds them.
- `song_versions` (0001:100): `name, number, chart_file_id, base_key, base_tempo, section_context, is_ready, lineage_source(uuid→song_versions), metadata jsonb, owner_id, created_by, change_note` — import lineage records go to `songs.source` + version `name/change_note/metadata` (lineage_source is a uuid REF, cannot hold 'Imported from OnSong').
- `song_duplicates` (0001:133) **EXISTS**: `song_ids uuid[], canonical_id, merged_from, decided_by, decided_at, unmerge_ok` — dedupe contract. **0002:74 `revoke all … from anon, authenticated`** — CHECK whether 0002 grants select/insert/update afterward; if NOT, 0028 must add grants + owner policies (policy USING may subquery songs for owner scoping: `exists (select 1 from songs s where s.id = any(song_duplicates.song_ids) and s.created_by = (select auth.uid()))`).
- `external_enrichments` (0001:143): `source` comment already `'spotify' | 'musicbrainz' | 'lrclib'`; `field` comment already `'bpm'|'key'|'album_art'|'lyrics'|'genre'|'year'` — **enum-contracted, no DDL change**. No CHECK constraint (text) — still respect the documented values.
- `public_songs` (0001:442): `license NOT NULL DEFAULT 'CC-BY-4.0'` with `'public-domain' | 'CC-BY-4.0' | 'proprietary'` vocabulary — mirror it on songs.license CHECK.
- `external_connections` (0026): `provider text, status 'connected'|'revoked', unique(user_id, provider)`, no delete grant, revoke = status flip — **reused as-is for `'planningcenter'`** (no DDL change).
- `updateSong` (songs.js:418): `updateSong(userId, id, { title, key, bpm, body, durationSeconds }, provenanceSource)` — must gain `artist, genre, year` (provenance records for provided fields, #69 pattern: `provenance.<field> = { source, at }`).
- `addSong` (songs.js:~223): `addSong(userId, { title, key, bpm, hasChordChart, body, durationSeconds, pdfFile })` — gains ONE optional `meta = {}` param: `{ artist, genre, year, source, license, licenseConfirmed, importMeta, versionName, changeNote }`. Defaults preserve every existing call (Songs.jsx, SetlistDetail.jsx, useSongs.js). ChordPro/PDF paths unchanged.
- `flattenSong` (songs.js:134+): already exposes `artist, genre, sourceOrgId` — ADD `source, year, license, licenseConfirmed` (and keep versions[] metadata).
- `SongForm`: fields today = title/key/bpm/body + PDF source toggle (from #76). S1 prefill needs **artist/genre/year inputs** added (accept `initial` + render suggestion accept/reject). 1 caller: Songs.jsx.
- Pages wiring: Songs.jsx header "New Song" area (line ~90) hosts `Import files…` + `Import from URL` buttons; Setlists.jsx header "New Setlist" hosts `Import from Planning Center`; SetlistDetail.jsx hosts export actions; Settings.jsx has the Spotify Integrations section (mirror for Planning Center); SongDetail.jsx mounts EnrichmentPanel (#69).
- setlists data layer: `createSetlist(userId,{name})`, `addSongToSetlist(userId,setlistId,songId)` (append order), `getSetlist` — plan import composes these.
- Codegen/signatures verified: `parseChordPro` (chordpro/parser.js), enrichments.js exports (`getSpotifyConnection/ensureSpotifyConnected/disconnectSpotify/suggestEnrichment/applySuggestions/discardSuggestions/saveAlbumArt/…`).
- **No new dependencies.** Tailwind only. JSX. prop-types never installed (`/* eslint-disable react/prop-types */` convention).

---

## T1 — Migration 0028 + smoke + schema docs
**Commit:** `feat(supabase): add song year/license columns and song_duplicates access (0028)`

### `supabase/migrations/0028_import_pipeline.sql`
Header comment (0025/0026/0027 style: spec reference, design rationale).
1. `ALTER TABLE songs ADD COLUMN year integer;` — MusicBrainz prefill + import conflict home (S1/S8). Comment: declared metadata only, never guessed.
2. `ALTER TABLE songs ADD COLUMN license text NOT NULL DEFAULT 'CC-BY-4.0';`
   `ALTER TABLE songs ADD COLUMN license_confirmed boolean NOT NULL DEFAULT false;`
   + `CONSTRAINT songs_license_check CHECK (license IN ('public-domain','CC-BY-4.0','proprietary'))` (add as separate `ALTER TABLE … ADD CONSTRAINT`).
   Comment: import requires confirmation before a song lands (S9); default CC-BY-4.0 mirrors public_songs (0001:442); unconfirmed default keeps existing songs untouched; attribution (S10) shows source+license only when confirmed.
3. `song_duplicates` access (FIRST verify 0002 around line 74 — if select/insert/update grants already exist, skip re-granting; only add what's missing):
   - `grant select, insert, update on table public.song_duplicates to authenticated;` (no delete — audit rows persist)
   - 3 policies (0025 deny-by-default style): select/insert/update where song_ids contains at least one song owned by `(select auth.uid())` (scalar subquery over songs INSIDE the policy USING/WITH CHECK — allowed). Insert additionally requires `(select auth.uid()) is not null`.
   - No DDL on `external_connections` / `external_enrichments` (contract already covers PCO provider + mb/lrclib sources).

### `scripts/smoke/0028-import-integrations.sql`
0027 structure: fixed ids, `set_config('role','…',false)` switching with SELECT prefix, `[PASS]/[FAIL]`, expected count in header. Fixtures: demo owner `10000000-…-001`, outsider `…002`, songs `20000000-…-001/…-002`, version `30000…-0801`, duplicate rows `30000…-0811/…-0812` (check 0026/0027 fixtures for collisions — 0026 uses 3000…6xx+711, 0027 uses 3000…7xx).
Asserts:
- songs.year/licence columns exist: insert songs row with `year=1998, license='proprietary', license_confirmed=true` → ok; default insert → `license='CC-BY-4.0' AND license_confirmed=false`.
- license CHECK: insert `license='weird'` → error.
- song_duplicates (owner): insert group `[song1, song2]` + decision (decided_by demo, decided_at) → visible to demo; NOT visible to outsider (0 rows); outsider insert → RLS denied; update by owner (merge: set canonical_id) → ok. If 0002 already grants these, assert the same via existing policies instead of creating them here.
- expected count documented (e.g. "expects 11 PASS / 0 FAIL").

### Docs
- `docs/database-schema-v2.md`: short § note — 0028 (songs.year/license/license_confirmed + license vocabulary mirroring public_songs), song_duplicates now user-accessible as the dedupe audit trail (owner-scoped, no delete), import lineage = songs.source + version name/change_note/metadata (lineage_source stays a uuid ref), enrichments source/field enum already covers musicbrainz/lrclib/lyrics/genre/year.

**Verify T1:** reset protocol (sed 0019 → `supabase db reset` → `git checkout -- …0019…`) + `docker exec -i supabase_db_cemurm psql -U postgres -d postgres --no-psqlrc -q -v ON_ERROR_STOP=0 < scripts/smoke/0028-import-integrations.sql` → expected PASS / 0 FAIL.

---

## T2 — Providers: MusicBrainz + LRCLIB + data layer
**Commit:** `feat(lib): musicbrainz and lrclib providers, song metadata fields and lyrics provenance`

### `src/lib/musicbrainz.js` (new, guarded like spotify.js)
- `MB_LIVE = Boolean(import.meta.env?.VITE_MUSICBRAINZ_LIVE)` — **env-gated live, mock by default** (documented dev behavior; the API needs no credentials, only opt-in for rate-limit/CORS control).
- `searchMusicBrainzMetadata({ title, artist })` → `{ ok:true, match:{ title, artist, year, genre, source:'musicbrainz' } }` | `{ ok:true, match:null }` (noMatch) | `{ ok:false, error:'offline'|'unavailable' }`.
  - Live path: gated by `isOnline()`; MusicBrainz WS/2 recording search; any CORS/network error → `{ ok:false, error:'unavailable' }` (NO silent mock fallback).
  - Mock path (default): deterministic by title hash — title containing `unconfident`/`nomatch` → `match:null`; else year in 1970–2020 + genre from a fixed list + artist from hash (all deterministic; comment "dev mock — set VITE_MUSICBRAINZ_LIVE=true for the real API").
- Node-safe guards (no `window`/`fetch` assumptions at import time).

### `src/lib/lrclib.js` (new)
- `LRCLIB_LIVE = Boolean(import.meta.env?.VITE_LRCLIB_LIVE)` same contract.
- `fetchLrclibLyrics({ title, artist })` → `{ ok:true, match:{ lyrics, source:'lrclib' } }` | `match:null` | errors as above. Live: lrclib.net API (offline-gated). Mock: deterministic template lyric block (title embedded; `unconfident`/`nomatch` title → noMatch).

### `src/lib/enrichments.js` (extend — do NOT restructure existing exports)
- `saveLyrics(versionId, metadata, { text })` — mirrors `saveAlbumArt` (writes `metadata.lyrics = { text, source:'lrclib', at }` into the version row; merge with existing metadata; return updated metadata).
- Keep `suggestEnrichment/applySuggestions/discardSuggestions/listEnrichments` source-agnostic (they already take rows) — MusicBrainz rows: `{ source:'musicbrainz', fields:['genre','year'] }`; LRCLIB rows: `{ source:'lrclib', fields:['lyrics'] }`. Verify the insert shape (S1: title/artist suggestions are NOT persisted as rows — they live in UI state only because the field enum has no title/artist; genre/year/lyrics ARE persisted).

### `src/lib/songs.js` (extend)
- `updateSong(userId, id, { title, key, bpm, body, durationSeconds, artist, genre, year }, provenanceSource)` — write artist/genre/year to the songs row when provided; record `provenance.artist/genre/year = { source: provenanceSource, at }` in version metadata exactly like key/bpm (manual edits → source 'manual').
- `addSong(userId, { …, meta = {} })` — when meta present: set `artist, genre, year, source, license, licenseConfirmed` on the songs insert (license default per column default when meta omits it); when `meta.versionName`/`changeNote`/`importMeta` present → version row `name: meta.versionName`, `change_note: meta.changeNote`, `metadata: { …(meta.importMeta && { import: meta.importMeta }) }`. **All existing call sites behave identically when meta is omitted.**
- `flattenSong`: expose `source: row.source || ''`, `year: row.year ?? null`, `license: row.license || 'CC-BY-4.0'`, `licenseConfirmed: Boolean(row.license_confirmed)`.
- Readiness: year/license do NOT affect readiness (no change).

---

## T3 — Importers: OnSong parser + queue data layer + dedupe + URL metadata
**Commit:** `feat(lib): onsong/chordpro file importer, duplicate detection and url metadata prefill`

### `src/lib/importers/onsong.js` (new)
- `parseSongFile(text, fileName)` → `{ ok:true, song:{ title, artist, genre, year?, sections, chordpro } }` | throws/returns `{ ok:false, error:'Could not parse this file' }` (EXACT message from S5).
  - Input: ChordPro (existing `{title:}`/`{artist:}` directives + section directives) AND OnSong-flavored files (OnSong exports ChordPro-compatible directives; support `[S:Section]`-style section markers by mapping them to `{start_of_section…}` equivalents if present). Map into: title/artist/genre/year parsed from directives when present; `chordpro` = normalized ChordPro text (the chart content stored as-is + section mapping preserved); `sections` = ordered section names (for preview).
  - Malformed = empty/wholly-unparseable content (no `{` directive AND no `[` chord lines AND no lyrics text) → `{ ok:false, error:'Could not parse this file' }`. A file with ANY chart-like content parses (lenient), a corrupt/binary/empty file fails. **Never throws raw** — returns the ok shape.
- `demo()` node self-check: valid OnSong file → sections+chords mapped; empty file → exact error message; asserts print `onsong import demo OK`.

### `src/lib/importers/duplicates.js` (new)
- `normalizeTitle(t)` — lowercase, strip trailing parenthetical group `/\s*\([^)]*\)$/`, collapse to alphanumerics+spaces, trim.
- `findDuplicateCandidates(userId, title, excludeSongId)` — reads user's song titles (one query: id+title where created_by + not deleted), returns `[{ id, title }]` where normalized equality OR mutual containment (both normalized lengths ≥ 4).
- `recordDuplicateDecision(userId, { songIds, canonicalId = null, mergedFrom = null })` — inserts song_duplicates row with `decided_by: userId, decided_at: now` (merge sets canonical; keep-separate leaves canonical null — both audit the review).
- `getDuplicateGroup(songId)` — returns the group row for SongDetail badge (merged vs kept-separate state).
- `demo()`: 'Amazing Grace' vs 'Amazing Grace (traditional)' → candidate; 'Imagine' vs 'Hallelujah' → none; prints `duplicates demo OK`.

### `src/lib/importers/urlImport.js` (new)
- `metadataOnlyFromUrl(rawUrl)` → parse ONLY via `new URL()` — **hard rule: never fetch the URL itself** (no content scraping, S14/S15).
  - Chord-site domains (documented list: ultimate-guitar.com, chords.com, chordie.com, azchords.com, guitar tabs equivalents…) → `{ ok:true, chordSite:true, message:'We don\'t import content from chord sites — paste your own chart', prefill:{ title } }` (title from URL slug when derivable).
  - Other URLs → `{ ok:true, chordSite:false, prefill:{ title, artist } }` — title from the last meaningful path segment (decode + de-slugify); artist completed via `searchMusicBrainzMetadata` when online+live (or mock) — best-effort, empty string when unavailable.
  - Invalid URL → `{ ok:false, error:'Enter a valid URL.' }`.
- `demo()`: chord-site URL → message; normal URL → title prefill; asserts NO fetch occurs (pure function) — `url import demo OK`.

### `src/lib/importers/queue.js` (new) — pure-ish orchestration (no UI)
- `buildImportEntries(files)` → array `{ id, fileName, parsed:null, error:null|'Could not parse this file', status:'pending'|'approved'|'discarded'|'error', license:'CC-BY-4.0', licenseConfirmed:false, duplicate:{ candidates:[…], decision:null|'merge'|'separate', targetSongId:null }, conflicts:[{ field:'year', existing, proposed, chosen:null }] }`.
  - Parse each file via parseSongFile (captured per entry — malformed entries carry the error, others continue: S5 batch continues, no partial writes ever happen at parse time).
  - Duplicate detection per entry: `findDuplicateCandidates` against the library → flag with candidate names (S7 "both are flagged": the queue shows the existing song's title in the flag).
  - Conflict detection (S8): only in the MERGE path — when duplicate candidates found, for each candidate song with `year/genre` set AND parsed proposes a different value → conflict entry (existing vs proposed; user chooses; default existing).
- `approveEntry(userId, entry)` — MUST enforce: parse ok + `licenseConfirmed` true (else throw `'Confirm the license to import.'`) + duplicate decision set when flagged (else throw `'Resolve the possible duplicate first.'`) + conflict `chosen` set when flagged. Writes:
  - **merge** → attach to the EXISTING song: insert new chart_files row (format chordpro, content parsed.chordpro, object_key placeholder, size) + song_versions row `number = max+1, name:'Imported from OnSong', change_note:Imported from <file>, metadata:{ import:{ source:'OnSong', file, importedAt, mergedInto:<existingId> } , conflict:<chosen record when present> }`, apply chosen conflict values via `updateSong(…,'import')`; `recordDuplicateDecision({ songIds:[target, …], canonicalId:target })`.
  - **separate** (or no flag) → `addSong(userId, { title, key:null, body:parsed.chordpro, meta:{ artist, genre, year, source:'Imported from OnSong', license, licenseConfirmed:true, importMeta:{ source:'OnSong', file, importedAt }, versionName:'Imported from OnSong', changeNote:`Imported from ${fileName}` } })` + when flagged: `recordDuplicateDecision({ songIds:[existingId, createdId] })` (canonical null).
  - Both paths: single song-level write happens only here ⇒ malformed entries can never write (S5).
- `demo()` (or covered by T9 E2E): approve without license → throws exact message; malformed never approved.

---

## T4 — Import UI: queue + Songs page wiring
**Commit:** `feat(songs): batch file import with review queue, dedupe and license confirmation`

### `src/components/import/ImportQueue.jsx` (new — Tailwind, house style, prop-types eslint-disable)
- Props: `{ entries, onApprove(entry), onDiscard(entry), onDecision(entryId, decision), onConflictChange(entryId, field, chosen), onLicenseChange(entryId, license), onConfirmLicense(entryId), onAddFiles(files) }` (state owned by the page/hook).
- Row rendering: file name, parsed title/artist/sections preview OR error banner `Could not parse this file` (approve disabled), **duplicate flag** (⚠ `Possible duplicate: <existing titles>` + radio `Merge into existing` / `Keep separate`), **conflict chooser** (year/genre: `existing value` vs `proposed value` radio — S8), **license select** (default `CC-BY-4.0` label `CC-BY-4.0 (default)`, `Proprietary (private only)`, `Public domain`) + `I confirm the license` checkbox (S9), Approve/Discard buttons per row (approve gated on all requirements; gating messages visible).
- Empty state + "Add more files" input (`multiple accept=".chordpro,.cho,.onsong,.txt,.crd"`).
- Success summary after approvals (created n, discarded m).

### `src/hooks/useSongImports.js` (new — midi/hooks ref pattern: refs mirror state for stable callbacks)
- Owns entries state, `addFiles` (reads File.text() — guarded), approve/discard/decision/conflict/license handlers calling queue.js, `refresh` after approvals (invalidateSongs + optional callback), error surface.

### `src/pages/Songs.jsx`
- Header next to "New Song": `Import files…` (hidden file input, multiple) → opens ImportQueue panel/dialog; `Import from URL` → ImportUrlDialog (T7 — wire the placeholder state now, dialog lands in T7).
- SongForm (S1 MusicBrainz prefill) lands in T5 — do not block T4 on it.

---

## T5 — Metadata UI: MusicBrainz prefill (SongForm) + LRCLIB lyrics + attribution (SongDetail)
**Commit:** `feat(songs): musicbrainz prefill, lrclib lyrics and import attribution display`

### `src/components/songs/SongForm.jsx`
- Add `artist`, `genre`, `year` inputs (year: positive number, optional) — pass through to onSubmit (`{ title, key, bpm, artist, genre, year, body… }`) — Songs.jsx forwards them into `addSong(…, meta:{ artist, genre, year })` (no source/license for manual creation).
- **MusicBrainz lookup (S1):** `Look up metadata` button (enabled when title ≥ 3 chars) → `searchMusicBrainzMetadata` → suggestion chips per field (title/artist/year/genre) each with accept ✕ (accept fills the input; reject dismisses; per-field accept/reject — S1 "I can accept or reject the suggested metadata"). States: idle/looking/suggested/noMatch/offline/error. Suggestion values live in component state (title/artist NOT persisted as enrichments rows — enum has no such fields; genre/year acceptance DOES create enrichments rows via `suggestEnrichment` + immediate `applySuggestions` after the song is created — simplest honest flow: create rows at song creation when accepted: pass `meta.enrich = { genre, year }` … CAREFUL: addSong creates the song FIRST; enrichments rows need song_id. Design: SongForm onSubmit passes accepted genre/year values in meta (songs columns) AND Songs.jsx afterwards persists `suggestEnrichment+applySuggestions` rows source 'musicbrainz' fields genre/year for provenance (best-effort, after addSong returns the id — addSong returns the created song).)
- Offline → button disabled with tooltip; mock path works offline (default provider).

### `src/hooks/useLyricsEnrichment.js` (new — useSpotifyEnrichment ref pattern, same state vocabulary: idle/looking/suggested/applying/applied/discarded/noMatch/offline/error)
- `lookup()` → `fetchLrclibLyrics` (offline gate `isOnline()`, no connection requirement — LRCLIB is a public API, no external_connections row) → persist row `suggestEnrichment(source:'lrclib', field:'lyrics')`.
- `apply()` → `saveLyrics(versionId, metadata, { text })` FIRST, then `applySuggestions` flip, then refresh song (mirror #69 ordering: values first, rows second).
- `discard()` → `discardSuggestions`.

### `src/components/songs/LyricsPanel.jsx` (new) + SongDetail mount
- Lyrics flow: `Fetch lyrics (LRCLIB)` button → suggested block (preview) → Apply/Discard; applied → lyrics block with `Lyrics · LRCLIB` credit header + provenance badge (existing badge style); empty state text.
- **Attribution block (S10):** when `song.source` set → under the title show `Imported from OnSong` + `· <license label>` (license shown when `licenseConfirmed`; e.g. `CC-BY-4.0` / `Proprietary (private only)`).
- **Import badge (S7 durable flag):** `getDuplicateGroup(song.id)` on load → when group exists show `Possible duplicate (reviewed): merged into <title>` (canonical set) or `Possible duplicate (reviewed: kept separate)` (canonical null).
- EnrichmentPanel (#69 Spotify) stays mounted and untouched.

---

## T6 — Planning Center: connect, plan import, revoke
**Commit:** `feat(integrations): planning center connect, plan import and revoke gating`

### `src/lib/planningcenter.js` (new)
- **Mock provider (dev default):** deterministic plans — `listPlans(userId)` → `[{ id:'pco-sunday-10am', name:'Sunday 10am', songs:[{ title, artist }, …] }]` + a second plan; plan songs designed so ≥1 title matches the seeded library (e.g. 'Way Maker' — seeded song 20000000-…-001) and ≥1 has no chart/library match (created song → missing-chart flag). Deterministic by seed, comment "dev mock — real Planning Center OAuth requires a server-side callback (documented limitation, local-dev.md)".
- `getPcoConnection(userId) / ensurePcoConnected(userId) / disconnectPco(userId)` — mirror enrichments.js Spotify trio but provider `'planningcenter'` (reuse/genericize internally if clean: a shared `getConnection(userId, provider)` helper is fine; keep the Spotify exports byte-compatible).
- `importPlanToSetlist(userId, plan, { librarySongs })` → `createSetlist(`${plan.name} (from Planning Center)`)` then for EACH plan song in order: normalized-title match against library → `addSongToSetlist(existing)`; no match → `addSong(…, meta:{ source:null? NO — })`… decision: missing-chart songs created via `addSong(userId,{ title, artist })` (no body → readiness draft) then `addSongToSetlist` — order preserved by sequential append. Returns `{ setlistId, linked:n, createdMissing:m }`.
- `exportSetlistToPlan(planId, songs)` (T8 uses) → mock `{ ok:true, pushed: songs.length, planId }` — serializes ONLY title/key (no projections/annotations, S17).
- Connection gate: every plan read/export first checks `status === 'revoked'` → `{ ok:false, error:'integration revoked' }` (S13).
- `demo()`: plans list deterministic; revoke gate returns error — `pco demo OK`.

### `src/hooks/usePlanningCenter.js` (new — ref-mirror pattern)
- connection state on mount; `connect() / revoke() / loadPlans() / importPlan(plan) / exportToPlan(planId, songs)` with states: idle/working/ready/error + online gate.

### UI
- `src/pages/Settings.jsx`: `Planning Center` section mirroring the Spotify Integrations section — status (Connected/Revoked/Not connected), `Connect` button (→ ensurePcoConnected) and `Disconnect` (→ disconnectPco). Keep the Spotify section unchanged.
- `src/pages/Setlists.jsx`: header button `Import from Planning Center` (visible only when connected) → plan picker (inline panel listing plans) → import → navigate/refresh to the new setlist. Revoked → button hidden + inline note `integration revoked — reconnect in Settings`.
- `src/pages/SetlistDetail.jsx`: after plan import, items whose song has no chart (`!song.body && !song.isPdf`) show `Missing chart — add or import` (S12) — compute inline next to the item (works for ANY empty song, not only PCO imports — honest generalization; comment it).

---

## T7 — URL import dialog
**Commit:** `feat(songs): metadata-only url import with chord-site refusal`

### `src/components/import/ImportUrlDialog.jsx` (new)
- Input + `Import from URL` action → `metadataOnlyFromUrl` (NEVER fetches the page — comment + code review point).
- Chord-site response → show the EXACT message `We don't import content from chord sites — paste your own chart` + offer the metadata-only prefill (title) via a `Prefill new song` button.
- Normal response → prefilled title/artist shown + `Prefill new song` → closes dialog and opens the SongForm with `initial={{ title, artist }}` (Songs.jsx owns the state handoff; SongForm already accepts `initial`).
- Invalid URL → inline error. Offline → MusicBrainz artist completion skipped (best-effort), title still prefilled.

---

## T8 — Export: OnSong file + Planning Center push
**Commit:** `feat(setlists): export setlists to onsong format and planning center`

### `src/lib/exporters/onsong.js` (new)
- `serializeOnSong(setlist, songs)` → OnSong-compatible text: per song in SETLIST ORDER: `{title: …}`, `{artist: …}`, `{key: …}` (agreed key = the item's selected version `base_key`, else the song's current version key) + the chart body verbatim (ChordPro sections preserved). **Only title/artist/key/body — never personal projections/annotations/comments** (S17 comment + assert).
- `downloadOnSongFile(setlist, songs)` — Blob + `URL.createObjectURL` + anchor click (guarded for node).
- `demo()`: 3-song fixture → asserts order, `{key:}` presence, zero annotation text — `onsong export demo OK`.

### SetlistDetail.jsx export actions
- `Export for OnSong` (always available when ≥1 song; downloads `<setlist-name>.cho`).
- `Export to Planning Center` (visible when PCO connected) → plan picker inline → `exportSetlistToPlan` → success note `Pushed N songs to <plan>` (mock path) / revoked → gate message. Excludes projections by construction (serializer only takes title/key/body).

---

## T9 — Docs + full verification + PR
**Commit:** `docs(integrations): document import pipeline, providers and export flows`

- `docs/local-dev.md`: new section — MusicBrainz/LRCLIB providers (mock default, `VITE_MUSICBRAINZ_LIVE`/`VITE_LRCLIB_LIVE` opt-in, offline gate), Planning Center mock + real-OAuth-needs-server-callback limitation, URL import is metadata-only by design, export flows (OnSong `.cho` download, PCO mock push).
- `docs/database-schema-v2.md`: finish 0028 note (if any residue).
- Do NOT touch `.env.local`.

### Full verification (before PR)
1. Node demos: `node -e "import('./src/lib/importers/onsong.js').then(m=>m.demo())"`, same for `duplicates.js`, `urlImport.js`, `planningcenter.js`, `exporters/onsong.js`, plus `readiness.js` demo (must stay green).
2. Reset + smoke 0028 → expected PASS / 0 FAIL.
3. `pnpm lint` (0 warnings) + `pnpm build` (green).
4. E2E vs live local stack (Vite SSR + real GoTrue session, #76 pattern) covering EVERY acceptance criterion achievable at lib level — report exact counts: MB suggest/apply (mock), LRCLIB lyrics apply + credit, OnSong import (source+license+lineage version name/change_note/metadata), malformed rejection exact message + no row created, batch 5 → approve/discard, dedupe flag + merge (chart attached to existing, canonical set) + keep separate (new song + audit row), conflict chooser chosen-recorded-with-source, license default + proprietary + missing-confirmation rejection, PCO connect/import-plan (setlist name `(from Planning Center)`, 4 songs in order, linked vs missing-count)/revoke gate, URL chord-site message + metadata prefill + no page fetch, OnSong export content asserts (order/keys/no annotations), PCO export push. Browser-only surfaces (queue dialogs, chips, downloads) → manual validation note for the maintainer.
5. `size:exception` note in PR body.

### PR
- Branch `feat/hito5-external-integrations` from current head (`feat/hito5-pdf-scan` d1d6361). Work-unit commits T1–T9 (Conventional, English, no attribution) recorded here after each task. Push + `gh pr create --base main --title "feat(hito5): external integrations and import (closes #78)"` with body: 17-scenario map, verification results, size:exception, stacked note (#147→#148→#155→#156→#159→#78), manual-validation notes. NO `type:*`/`status:approved` labels (chain pattern).

---

## Acceptance criteria (17-scenario map)
1. MusicBrainz prefill (title/artist/year/genre, accept/reject) — T2/T5.
2. LRCLIB lyrics attached, LRCLIB credited — T2/T5.
3. OnSong import maps sections/chords/lyrics + source 'Imported from OnSong' — T3/T4.
4. Batch 5 → one review queue, approve/discard each — T3/T4.
5. Malformed → `Could not parse this file`, no partial song — T3 (queue-only writes).
6. Imported arrangement lineage (version name/change_note/metadata.import) + owner — T2/T3.
7. Possible-duplicate flag both + merge/keep decision before completion — T3/T4/T5 (badge).
8. Conflict asks which value wins, chosen recorded with import source — T3/T4.
9. License confirmation on import; default CC-BY-4.0; Proprietary option — T1/T3/T4.
10. Song detail shows source + license — T5.
11. Connect PCO account, read plans with authorization, revoke anytime — T6.
12. Import plan → setlist `<name> (from Planning Center)` 4 songs in order; existing link; missing-chart flag — T6.
13. Revoke stops future imports; imported setlists remain — T6 (gate + setlists are ordinary rows).
14. URL import metadata-only prefill (no content download) — T3/T7.
15. Chord sites refused with exact message + prefill offer — T3/T7.
16. OnSong export: format, order, charts, agreed keys — T8.
17. PCO export: order + agreed keys, no projections/annotations — T8.

## Progress
- [x] T1 migration 0028 + smoke + docs — `b60a99a`
- [x] T2 providers mb/lrclib + data layer — `cbabcd1`
- [x] T3 importers + demos — `417fcd8`
- [x] T4 import queue UI — `f90f9f1`
- [x] T5 metadata UI + attribution — `4c8e840`
- [x] T6 planning center — `122ddaf`
- [x] T7 url import dialog — `b5aef0f`
- [x] T8 exporters — `a501f6e`
- [x] T9 docs + verification + PR — `773beec`

## Completion record (2026-09-24, orchestrator)

Branch `feat/hito5-external-integrations` @ `2f97e9b`, from stack head `491aaf5` (feat/hito5-pdf-scan rebased). **Chain rebased onto new `main` (9f111dd, ts-checkjs-baseline) on 2026-09-24**: all 5 open chain PRs force-pushed and re-verified MERGEABLE (#148 8c027cf, #155 787bb3d, #156 df5de80, #159 491aaf5, #165 2f97e9b); lint 0 warnings + build green at top; conflicts were only JSDoc annotation/signature merges in `songs.js`/`setlists.js`/`transpose.js`, bodies preserved verbatim (updateSong artist/genre/year + provenance spot-checked intact).

Commits (work-unit, conventional, English; IDs post-rebase):

| Task | Commit | Message |
|------|--------|---------|
| T1 | `28062b3` | feat(supabase): add song year/license columns and song_duplicates access (0028) |
| T2 | `8cd180b` | feat(lib): musicbrainz and lrclib providers, song metadata fields and lyrics provenance |
| T3 | `a2242ff` | feat(lib): onsong/chordpro file importer, duplicate detection and url metadata prefill |
| T4 | `280d855` | feat(songs): batch file import with review queue, dedupe and license confirmation |
| T5 | `55abdea` | feat(songs): musicbrainz prefill, lrclib lyrics and import attribution display |
| T6 | `97a728e` | feat(integrations): planning center connect, plan import and revoke gating |
| T7 | `a959135` | feat(songs): metadata-only url import with chord-site refusal |
| T8 | `980b358` | feat(setlists): export setlists to onsong format and planning center |
| T9 | `ab859d2` | docs(integrations): document import pipeline, providers and export flows |
| Fix | `2f97e9b` | fix(integrations): allow plan import without injected library list |

Verification evidence:

- Smoke 0028 (live stack, writer): 15 PASS / 0 FAIL; DB clean after run.
- Node demos (writer + orchestrator re-run): onsong import, duplicates, urlImport, planningcenter, onsong export, readiness — 6/6 OK.
- `pnpm lint`: 0 warnings (writer + orchestrator re-run). `pnpm build`: green.
- Orchestrator E2E spot check vs live stack (Vite SSR + GoTrue session demo@cemurm.app, temp scripts removed after run): **35 PASS / 0 FAIL** covering S1–S17 surfaces reachable at lib level — MB mock hit/noMatch, addSong meta + import lineage (version name + metadata.import), updateSong genre/year + provenance source, saveLyrics credited lrclib, suggest/apply enrichments, malformed parse exact message, license gate exact message + no partial write, queue approve → song with import contract, dedupe merge (chart as NEW version on existing + song_duplicates canonical) and keep-separate (new song + canonical null), PCO connect → plans → import (setlist `… (from Planning Center)`, order preserved, linked+createdMissing = plan songs) → revoke gates reads AND imports.
- **Defect caught by spot check + fixed**: `importPlanToSetlist(userId, plan, { librarySongs } = null)` crashed when the third arg was omitted — `usePlanningCenter` calls it with 2 args, so the browser UI would throw on plan import. Fixed to `= {}` in `2f97e9b` (one line, contract says optional). Re-ran E2E: 35/0.

Size:exception: 26 files, +4 023 / −52 lines vs `d1d6361` (>400 by ~10x; chain precedent #147/#148/#155/#156/#159). No new dependencies (package.json/pnpm-lock untouched), `.env.local` untouched.

PR: created base `main` (stacked-to-main; branch from stack head). Remaining manual validation for maintainer: browser-only surfaces (queue dialogs, MB chips, download of `.cho`, PCO UI) — covered structurally + by lib-level E2E.

TDD mode: OFF (no test runner) — functional checks = node demos + smoke 0028 + lint + build + E2E. Commits: work-unit per task, conventional, English.
