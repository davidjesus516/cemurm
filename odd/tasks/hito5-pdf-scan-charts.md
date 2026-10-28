# Hito 5 — #76 PDF Scan Charts — task doc

**Feature:** `features/pdf-scan-charts.feature` (9 scenarios) · Issue #76
**Branch:** `feat/hito5-pdf-scan` FROM `feat/hito5-spotify-enrichment` (fd77caa) — NEVER from main
**PR:** base `main`, Closes #76, stacked after #156. Delivery: `auto-chain` / `stacked-to-main`; forecast >400 authored lines ⇒ maintainer-approved `size:exception` (precedent #148/#155/#156).
**Verified facts (2026-09-23):**
- `chart_files` (0001): format `chart_format` enum **already includes 'pdf'**, `content` nullable (PDF → NULL, object_key = storage path), `size_bytes`, `soft_deleted`, `created_at`. No DDL change needed for the table.
- `song_versions` (0001): append-only (number v1, v2…), `chart_file_id` per version ⇒ replace = NEW version row + NEW chart_files row, old preserved (no soft-delete of old chart).
- Client: `flattenSong` (songs.js:55) picks latest version by created_at desc, version chart via `chart_file_id`; exposes `versions[]` (picker exists in SongDetail via `openVersion`), `hasChordChart = !!chart.content`; does NOT yet expose format/object_key/size_bytes (must add). `addSong` (songs.js:168) inserts songs + chart_files (format 'chordpro', `object_key: crypto.randomUUID()` placeholder, content inline) + song_versions number 1.
- `computeReadiness` (readiness.js): pure, node-runnable demo; rules key → body → chord line → lyrics. Extend with a PDF branch (scan is the chart).
- Storage: `src/lib/storage.js` is the cache-policy module — `CACHE_CATEGORIES` ALREADY includes 'pdf', `EVICTION_ORDER = ['pdf','exports']` (offline PDF cache anticipated). Cache API in use: `src/pages/Storage.jsx` `caches.open(name)`; SW registered in PROD only (`updateManager.js` registers `/sw.js`). Local stack: `supabase/config.toml` storage enabled, `file_size_limit = "50MiB"`.
- Tech-spec: R2 signed URLs only, NO public bucket (production direction) → use Supabase Storage **private** bucket + signed URLs; Supabase free tier 1GB storage (~200MB estimated).
- StageMode: renders ChordPro only (parseChordPro/`song.body`); PDF songs have body '' → currently "No chord chart for this song."; transpose controls live there (hide for PDF + scenario 7 note). SongDetail: textarea edit + ChordProRenderer for body; version picker exists.
- #69 EnrichmentPanel: stays working for PDF songs (title/artist based; writes metadata only).
- Migrations: last is 0026 ⇒ next **0027**.
- **No ALTER on chart_files/songs/song_versions needed. 0027 = Storage bucket + storage.objects RLS only.**

---

## T1 — Migration 0027 (Storage bucket + RLS) + smoke + docs
**Commit:** `feat(supabase): add private charts bucket and owner-scoped storage RLS (0027)`

### `supabase/migrations/0027_pdf_chart_storage.sql`
Header comment (0025/0026 style — spec, design, size-limit rationale).
1. Bucket (private — tech-spec signed-URLs direction):
   ```sql
   insert into storage.buckets (id, name, public)
   values ('charts', 'charts', false)
   on conflict (id) do nothing;
   ```
2. storage.objects policies scoped to bucket 'charts', owner-folder pattern (`(storage.foldername(name))[1] = (select auth.uid())::text`, `name` LIKE `auth.uid()::text || '/%'`):
   - insert: bucket 'charts' + owner folder + `(select auth.uid()) is not null`
   - select: bucket 'charts' + owner folder (owner can introspect; direct reads go through signed URLs which the storage service authorizes separately)
   - update/delete: bucket 'charts' + owner folder (replace + future cleanup)
   - `drop policy if exists` guards, 0002 naming style (`storage_objects_insert_owner` etc. — actually namespace `pdf_objects_insert_owner` …).
3. Comment: object keys are `${auth.uid()}/${uuid}.pdf` so the owner folder IS the RLS boundary; file type/size enforced app-side (product limit 10 MB) + stack `file_size_limit` 50 MiB as the hard server cap (server-side trigger validation deferred — documented); `public` may NEVER be flipped (signed URLs only).

### `scripts/smoke/0027-pdf-charts.sql`
Mirror 0025/0026 structure: fixed ids, role switching via `set_config('role','…',false)` with SELECT prefix, grep-able `[PASS]`/`[FAIL]`, expected count in header. Fixtures: owner demo `10000000-…-001`, outsider `…002`, song `20000000-…-001`, chart row `30000…-070*`, version rows `…-071/…-072`.
Asserts:
- bucket exists: `select count(*) from storage.buckets where id='charts' and public=false` = 1 → assert public=false (signed-URLs contract).
- policies exist: count storage.objects policies referencing bucket 'charts' ≥ 3 (pg_policies).
- owner writes under his folder: insert storage.objects row (bucket 'charts', name `10000000-…001/<uuid>.pdf`) as authenticated demo → visible to demo, NOT visible to outsider role (select 0 rows).
- outsider cannot insert under demo's folder (WITH CHECK violation).
- PDF chart flow: chart_files insert format='pdf', content NULL, object_key set, size_bytes>0 → ok (owner); song_versions insert number=2 with new chart_file_id; assert BOTH version rows 1+2 present (previous preserved).
- Oversized guard is app-side — smoke asserts chart_files still accepts a row; the size rule is validated in lib (T2) and shown in docs (not a DB constraint).
- expected count documented (e.g. “expects 12 PASS / 0 FAIL”).

### Docs
- `docs/database-schema-v2.md`: add a short note (near §2 chart_files DDL or §2.10 area) — "Hito 5 #76: charts Storage bucket" — private bucket + owner-folder RLS + signed URLs (matches tech-spec R2 direction); chart_files columns unchanged (format pdf already in enum); size limits: product 10 MB app-level, stack 50 MiB server cap; PDF readiness = key + non-empty scan, "legible" = size > 0 (visual legibility is human QA, stated as a limitation).
- `docs/local-dev.md`: PDF charts section — bucket auto-created by 0027; uploads via local Supabase Storage; signed URLs.

**Verify T1:** reset protocol (sed 0019 → `supabase db reset` → `git checkout -- supabase/migrations/0019_rehearsal_workflow.sql`) then `docker exec -i supabase_db_cemurm psql -U postgres -d postgres --no-psqlrc -q -v ON_ERROR_STOP=0 < scripts/smoke/0027-pdf-charts.sql` → expected count PASS / 0 FAIL.

---

## T2 — Lib layer
**Commit:** `feat(lib): pdf chart storage, validation, offline cache and readiness`

### `src/lib/pdfCharts.js` (new — pure + guarded, midi.js/storage.js pattern)
- `PDF_MAX_BYTES = 10 * 1024 * 1024` (product limit; document stack 50 MiB).
- `PDF_CACHE_VERSION = 1` (use `cacheName('pdf', PDF_CACHE_VERSION)` from storage.js).
- `validatePdfFile(file)` → `{ ok: true, sizeBytes }` | `{ ok: false, reason: 'size' | 'type' }` — type: `file.type === 'application/pdf'` OR name ends '.pdf' (accept both); size ≤ PDF_MAX_BYTES; message constants exported for the UI ("PDF scans are limited to 10 MB" / "Only PDF files are accepted").
- `buildPdfObjectKey(userId, fileName)` → `${userId}/${crypto.randomUUID()}.pdf` (owner folder = RLS boundary).
- `uploadPdf(userId, file)` → `supabase.storage.from('charts').upload(key, file, { contentType: 'application/pdf', upsert: false })` → returns `{ path }`; throws on error (caller maps to user error).
- `signedPdfUrl(path, expiresInSeconds = 3600)` → `supabase.storage.from('charts').createSignedUrl(path, expiresInSeconds)` → `{ signedUrl }`; throws on error.
- Offline (scenario 5): `ensurePdfCached(path)` — guarded (`typeof caches === 'undefined'` or `!isOnline()` return false): fetch signed URL → `caches.open(cacheName('pdf', PDF_CACHE_VERSION))` → `cache.put(new Request(path), new Response(blob, { headers: { 'Content-Type': 'application/pdf' } }))`. Key = the object path (stable across re-signing). Best-effort try/catch (never throws).
- `getCachedPdfBlob(path)` → `caches.match(path)` → blob or null (guarded; no throw).
- `objectUrlForBlob(blob)` → `URL.createObjectURL(blob)` (guarded: `typeof URL.createObjectURL === 'function'`).
- `isPdfChart(song)` → `song?.format === 'pdf'`.
- Note: Node has no `caches`/`URL.createObjectURL` — every helper guarded; E2E exercises upload/validate/replace/readiness, cache pieces verified structurally/manually.

### `src/lib/songs.js`
- `flattenSong`: expose `format: chart?.format || 'chordpro'`, `objectKey: chart?.object_key || ''`, `sizeBytes: chart?.size_bytes ?? 0`, `isPdf`; add per-version `format`/`objectKey` in `versions[]` (each version resolves its own chart like `body`). Keep `hasChordChart` semantics (content-based).
- `computeReadiness({ key: latest?.base_key || '', body, hasPdfChart: isPdf })` in flattenSong + addSong (signature extension, T2 readiness).
- `addSong(userId, { title, key, bpm, hasChordChart, body, durationSeconds, pdfFile })` — when `pdfFile` present: `validatePdfFile` (reject → error message "PDF scans are limited to 10 MB" / "Only PDF files are accepted"), `uploadPdf`, then insert chart_files `{ format: 'pdf', object_key: <path>, content: null, size_bytes: file.size }`, version number 1 (name 'Original'). Reuse the existing songs/versions insert path (single entry point; ChordPro path unchanged).
- `replacePdfScan(userId, songId, file)` — validate + upload new object; insert NEW chart_files row; insert NEW song_versions row `number = max(existing numbers)+1`, `chart_file_id = newChart`, copy base_key/base_tempo from the current latest version, recompute readiness (per version READY), `owner_id/created_by = userId`; DO NOT soft-delete the old chart row (previous version preserved → version picker still shows v1 with its chart); invalidateSongs + return refetched song.
- `maybeCachePdf(song)` — fire-and-forget `ensurePdfCached(song.objectKey)` when `song.isPdf` and online; call best-effort (no await on the read path, never blocks) after fetchSongById success (and after replacePdfScan).
- updateSong: unchanged (PDF replace is the only mutation; text edit stays ChordPro-only).

### `src/lib/readiness.js`
- Extend: after the key rule, a PDF branch — `if (song.hasPdfChart) return (size > 0 ? ready : draft('Not ready: no PDF scan'))` — signature: computeReadiness({ key, body, hasPdfChart, sizeBytes }). "Legible" = non-empty scan (documented limitation: visual legibility is human QA).
- Extend `demo()` self-check: PDF song with key + size>0 → ready; PDF without key → 'Not ready: missing base key'; PDF with key but size 0 → 'Not ready: no PDF scan'; ChordPro path unchanged.

---

## T3 — UI: viewer + form + SongDetail
**Commit:** `feat(songs): pdf scan viewer, upload via song form and replace-with-history`

### `src/components/songs/PdfChartViewer.jsx` (new — Tailwind, house style, prop-types eslint-disable convention, NO prop-types dep)
- Props: `{ title, objectPath, sizeBytes }`.
- States: signing (get signedPdfUrl) → ready (iframe) | fallback | error.
- Inline renderer: `<iframe title src={signedUrl} className="h-full w-full" />` (native PDF rendering — no PDF library).
- **Zoom/pan (scenario 4):** overflow-auto container (native scroll = pan) + zoom toolbar buttons [−, 75%, 100%, 150%, 200%, +] applying CSS `transform: scale()` on a wrapper (transform-origin top-left; adjust container dimensions so scroll bounds track zoom). Keep implementation minimal (buttons + scale; no drag-pan beyond native scroll).
- **Fallback (scenario 9):** `canRenderPdfInline()` — `typeof navigator !== 'undefined' && navigator.pdfViewerEnabled !== false` (plus iframe error → fallback). Fallback UI: message + "Open in new tab" + "Download" `<a href={signedUrl} target="_blank" rel="noreferrer">` / download attr. The new-tab/download links are ALSO always present in a small toolbar (graceful degrade).
- Error state: "Couldn't load the PDF scan" + open/download retry.
- Offline-in-cache path (used by StageMode): optional prop `blobUrl` — when provided (objectURL from cache), render it directly without network (skip signing).

### `src/components/songs/SongForm.jsx`
- Chart source toggle: **ChordPro text** | **PDF scan** (two radio/segmented options).
- PDF mode: file input `accept="application/pdf,.pdf"`, shows chosen filename, validation errors inline from `validatePdfFile` ("PDF scans are limited to 10 MB" / "Only PDF files are accepted"); on submit passes `pdfFile` (addSong handles upload; the form itself only selects the file — no upload until save).
- ChordPro mode: unchanged.

### `src/pages/SongDetail.jsx`
- `song.isPdf` → render `PdfChartViewer` (current version's `objectKey`) instead of the ChordPro text edit/render; hide the body textarea + "edit chart" controls (scenario 2: cannot edit as text); show "PDF scan — not editable as text" note + declared key stays visible.
- **Replace scan (scenario 3):** "Replace scan" button + hidden file input (accept pdf, validate) → `replacePdfScan` → refresh song; success note: "Corrected scan saved as v{n} — previous scan preserved in version history".
- Version picker (already exists via `openVersion`): per-version label shows format badge ("v1 · PDF scan", "v2 · PDF scan"); switching versions renders that version's chart viewer (ChordPro or PDF).
- Transpose affordances on SongDetail: keep key display; for PDF show note "PDF scans need a new scan to change key" next to key (scenario 7 mirror; StageMode gets the same).
- #69 EnrichmentPanel: unchanged (keep mounted — it's title/artist based).

---

## T4 — StageMode full-screen + offline
**Commit:** `feat(stage): full-screen pdf charts with zoom/pan and offline cache`

### `src/pages/StageMode.jsx`
- When current song `isPdf`: render `PdfChartViewer` full-screen in the chart area instead of the ChordPro/transpose view; hide transpose controls (scenario 4 + 7); show the note "PDF scans need a new scan to change key" when transpose is otherwise available (scenario 7).
- Offline (scenario 5): before rendering, try `getCachedPdfBlob(song.objectKey)` → `objectUrlForBlob` and pass as `blobUrl` (no network). Ensure `maybeCachePdf` ran on song load (T2) so a previously-cached setlist renders offline.
- Overlay/MIDI push: unchanged; note in code comment that PDF-chart songs push `chart_body: ''` (overlay shows title only — chords not extractable from a scan; that is the honest behavior, existing note at StageMode snapshot push).
- "No chord chart" fallback (line 566) becomes unreachable for PDF songs (viewer covers it).

---

## T5 — Docs + verification + PR
**Commit:** `docs(pdf): document charts bucket, size limits and pdf chart flows`

- local-dev.md PDF section (extend T1), ensure `.env.local` untouched.
- Any schema-v2 note finishing touches.

### Full verification (before PR)
1. `node -e "import('./src/lib/readiness.js').then(m => m.demo())"` — extended demo PASS (T2).
2. Reset + `scripts/smoke/0027-pdf-charts.sql` — expected count PASS / 0 FAIL.
3. `pnpm lint` (0 warnings) + `pnpm build` (green) — orchestrator re-checks.
4. E2E against live stack (Vite SSR, real GoTrue session, like #69): add PDF song via SSR lib calls → format pdf + chart_files row + version v1; replace → v2 + old preserved; oversized file → rejected with size message; readiness: pdf with key ready, without key draft. Browser visual (viewer/zoom/pan/offline cache) → manual validation note for maintainer (no desktop browser attached).
5. `size:exception` note in PR body.

### PR
- Branch `feat/hito5-pdf-scan` from current stack head (`feat/hito5-spotify-enrichment` fd77caa). Work-unit commits T1–T5, Conventional Commits, English, no AI attribution, commit identities recorded here after each task. PR base `main`, title `feat(hito5): pdf scan charts (closes #76)`, body: scenarios covered, verification results, size:exception, stacked note (#147→#148→#155→#156→#76), manual validation notes (browser viewer/zoom/offline). No `type:*`/`status:approved` labels (chain pattern).

---

## Acceptance criteria (feature map)
1. Add song with PDF as chart → format pdf, stored, openable — T2/T3 (upload + viewer).
2. PDF viewable, NOT text-editable — T3 (viewer replaces textarea/edit).
3. Replace preserves previous version in history — T2 `replacePdfScan` append-only + T3 version picker.
4. StageMode full-screen + zoom/pan — T3 viewer reused + T4.
5. Offline availability — T2 `ensurePdfCached`/`getCachedPdfBlob` (Cache API 'pdf' category) + T4 blobUrl path.
6. Readiness with scan present ("legible" = non-empty) — T2 readiness branch.
7. No automated transposition on scans + note — T3/T4.
8. Oversized rejected, existing unchanged — T2 `validatePdfFile` pre-upload (existing chart untouched because upload happens only after validation).
9. Renderer unavailable → download/new-tab — T3 fallback + toolbar links always present.

## Progress — DONE (2026-09-23)
- [x] T1 migration + smoke + docs — commit `fa84efe` `feat(supabase): add private charts bucket and owner-scoped storage RLS (0027)`
- [x] T2 lib layer — commit `8b00e7d` `feat(lib): pdf chart storage, validation, offline cache and readiness`
- [x] T3 viewer + form + SongDetail — commit `8ad83f8` `feat(songs): pdf scan viewer, upload via song form and replace-with-history`
- [x] T4 StageMode + offline — commit `3fdb682` `feat(stage): full-screen pdf charts with zoom/pan and offline cache`
- [x] T5 docs + verification + PR — commit `d1d6361` `docs(pdf): document charts bucket, size limits and pdf chart flows`

**Verification evidence (all observed):**
- `readiness demo`: **readiness demo OK** (9 asserts) — re-run by orchestrator.
- Smoke 0027 (fresh reset, sed 0019 protocol): **10 PASS / 0 FAIL**.
- E2E live stack (Vite SSR, GoTrue demo@cemurm.app): **28 PASS / 0 FAIL** — add PDF song (format pdf, content NULL, owner-folder objectKey, v1 "Original"); replace → v2 + v1 preserved; oversized rejected with size message and no row created; wrong-type rejected; no-key song → draft.
- `pnpm lint`: 0 warnings (re-run by orchestrator). `pnpm build`: green (re-run by orchestrator, 2.74s).
- Authored lines: **1 164 added / 72 deleted ≈ 1 236** ⇒ maintainer-approved `size:exception` (precedent #148/#155/#156).
- Gatekeeper: PASS (contract conformance, artifacts, no hallucination, no drift T1→T5 map).
- Writer findings: (1) duplicate `private.display_name_for` in 0018:344 + 0019:184 — pre-existing reset blocker, fix aparte en main; (2) `psql -c` multi-statement single implicit transaction — rollback gotcha, usar `-c` separados.

**PR: https://github.com/davidjesus516/cemurm/pull/159 — `feat/hito5-pdf-scan` → main, Closes #76, base main, head `feat/hito5-pdf-scan`, sin labels** — stacked after #156 (merge ordenado por el maintainer). Sin labels `type:*`/`status:approved` (patrón cadena).

TDD mode: OFF (no test runner) — functional checks = readiness demo + smoke 0027 + lint + build. Commits: work-unit per task, conventional, English.