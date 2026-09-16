# Apply Progress: hito-2-remainder

## Batch 1 — PR#1a (commit dfa7c75 #89)

- [x] 1a.1 `src/lib/gigs.js` data-layer CRUD (gig/venue/performance/items, `owner_id`/`org_id` on insert, `resolveOrgId` → `public.session_org_ids()`) + CRUD-focused `demo()`
- [x] 1a.2 `supabase/migrations/0005_public_session_org_ids.sql` — public SECURITY DEFINER bridge (PGRST202 blocker fix)
- [x] 1a.3 `src/hooks/useGigs.js` per useSongs pattern (CRUD subset; lifecycle wrappers land with the lifecycle slice)

## Batch 2 — PR#1a-lifecycle (commit `9f729ae`, merged as `052a3e1` #90)

Mode: Standard (strict_tdd false; no test runner; focused demo self-check + live local-stack seed harness)

### Work Unit Evidence (1a.4–1a.6)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `node -e "import('./src/lib/gigs.js').then(m=>m.demo())"` → `gigs demo OK: 26 asserts (flatten, lifecycle, completion, venue, guards)`, exit 0 |
| Diff stat vs main | `3 files changed, 255 insertions(+), 15 deletions(-)` (gigs.js +218, seed.sql +40, tasks.md 12) — within the ≤260 slice cap |
| Runtime harness command/scenario and exact result | `supabase db reset` clean; psql RLS session as demo user: 2 gigs + 1 performance + 2 items; isolation user: 0 demo rows → RLS ISOLATION PASS, exit 0 |
| Rollback boundary | Revert commit `9f729ae`; no unrelated files touched |

### Completed Tasks 1a.4–1a.6

- [x] 1a.4 Completion chain + lifecycle transitions; offline `enqueueOp`/optimistic wrappers **deferred to 2a.6** (maintainer decision)
- [x] 1a.5 Venue suggestion/reuse — `findVenueByName` + `createVenue` dedupe
- [x] 1a.6 Seed gig/venue/performance/user_preferences rows incl. isolation row

## Batch 3 — PR#1b: Gigs UI (commit `0066a2b`, on `feat/hito-2-remainder-pr1b`, base main@052a3e1)

Mode: Standard (strict_tdd false; no test runner; `pnpm build && pnpm lint` per tasks.md work-unit table)

### Work Unit Evidence (1b.1–1b.4)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm lint` → `$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`, exit 0, 0 errors 0 warnings; `pnpm build` → `✓ built in 2.58s`, exit 0 (124 modules; pre-existing lazy-import + chunk-size warnings only) |
| Runtime harness command/scenario and exact result | `node -e "import('./src/lib/gigs.js').then(m=>m.demo())"` → `gigs demo OK: 26 asserts (flatten, lifecycle, completion, venue, guards)`, exit 0 — untouched data layer, no regression. Render smoke: prod build parses all 5 new JSX files (`Gigs.jsx`, `GigDetail.jsx`, `GigCard.jsx`, `GigForm.jsx`, `VenueAutocomplete.jsx`) + routes; manual create/edit/cancel walk is a follow-up manual E2E item (no browser framework in repo) |
| Diff stat vs main (staged) | `8 files changed, 367 insertions(+), 4 deletions(-)` — **within the 400-line PR budget** |
| Rollback boundary | Revert commit `0066a2b` on this branch (or drop before merge): revert only UI files + App routes + nav + tasks.md; data layer (gigs.js/useGigs/seed), migrations, offline/SW/preferences untouched |

### Completed Tasks 1b.1–1b.4

- [x] 1b.1 `src/components/gigs/GigCard.jsx` (card + shared `StatusBadge` + `formatWhen`) + `VenueAutocomplete.jsx` (datalist suggestions, saved-venue reuse hint via `findVenueByName`)
- [x] 1b.2 `src/pages/Gigs.jsx`: list + inline create form (one linked setlist select; venue autocomplete; name/date validation)
- [x] 1b.3 `src/pages/GigDetail.jsx`: detail read (status badge, venue line, setlist link, performance items played/skipped/off_setlist when completed) + inline edit form (setlist swap) + Confirm/Cancel/Reopen action buttons per status; completed = terminal, no actions
- [x] 1b.4 `/gigs` + `/gigs/:id` auth-guarded routes in `src/App.jsx`; "Gigs" nav in `AppLayout.jsx`

Shared `GigForm.jsx` added (not in design's file table) to dedupe the create form (Gigs) and edit form (GigDetail) — the 400-line budget rule: trim duplication before exceeding. Task file paths `src/components/GigCard.jsx`/`VenueAutocomplete.jsx` implemented under `src/components/gigs/` per the repo's `components/<domain>/` convention (cf. `components/songs/SongForm.jsx`).

### Lifecycle UI separation (1b vs 1c)

Confirm/Cancel/Reopen + edit (incl. setlist swap) are in 1b.3 per tasks.md and wired. **Completion (StatusMode post-show "mark played" → `completeGig`) is NOT in this slice** — it belongs to 1c.1 (StageMode post-show flow). The detail page renders the performance record read-only when status is completed. Direct `updateGig({status:'completed'})` stays rejected by the data layer (task 1a.4 contract) — do not wire a complete button in 1b.

## Batch 4 — PR#1c: Stage Completion + Played Tags

Mode: Standard (strict_tdd false; no runner; `pnpm lint` + `pnpm build` per tasks.md work-unit table)

### Work Unit Evidence (1c.1–1c.2)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm lint` → `$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`, exit 0, 0 errors 0 warnings; `pnpm build` → `✓ built in 1.96s`, exit 0 (124 modules; pre-existing supabase dynamic-import + chunk-size warnings only) |
| Runtime harness command/scenario and exact result | `node -e "import('./src/lib/gigs.js').then(m=>m.demo())"` → `gigs demo OK: 26 asserts (flatten, lifecycle, completion, venue, guards)`, exit 0 — gigs.js untouched, no regression. Manual post-show complete walk (StageMode → Finish gig → completeGig → /gigs/:id) is the verify-phase E2E item |
| Diff stat vs main (staged) | see `git diff --stat main` below — insertions within the ≤400 PR budget |
| Rollback boundary | Revert this commit: only `StageMode.jsx` (finish panel), `useGigs.js` (+completeGig wrapper), `songs.js` (+listPlayedAt), `useSongs.js` (+getPlayedAt), `SongDetail.jsx` (played-at section), tasks/apply-progress — data layer `gigs.js`, migrations, offline/SW/preferences untouched |

### Completed Tasks 1c.1–1c.2

- [x] 1c.1 `StageMode.jsx` post-show completion: "✓ Finish gig" (visible when the setlist has open planned/confirmed gigs) → panel marks each setlist song played (default) / skipped, adds encores as `off_setlist` via repertoire picker → `completeGig(gigId, { performedAt, items })` → navigates to `/gigs/:id`. Gig picker when a setlist serves >1 open gig. `useGigs.js` gained the missing `completeGig` wrapper (task 1a.3 deferred it). The data-layer guard (no direct `updateGig({status:'completed'})`) is not bypassed — completion goes through `completeGig` only, which writes exactly one `performances` + `performance_items` (idempotent replay guard).
- [x] 1c.2 `src/lib/songs.js` `listPlayedAt(userId, songId)` → `[{ gigId, gigName, performedAt }]` for states `played` + `off_setlist` (both mean performed), newest first; **skipped never included**. `SongDetail.jsx` shows "Played at · demand N" tags linking each gig; demand count = tags length. Deliberately NOT read-through cached (derived data — fresh read avoids stale tags after same-session completion; IDB caching lands with PR#2a).

### Files Changed (PR#1c)

| File | Action | What Was Done |
|------|--------|---------------|
| `src/pages/StageMode.jsx` | Modified | Post-show "Finish gig" panel: played/skipped per setlist song (default played), encore picker (off_setlist), completeGig → navigate to gig detail; Esc closes panel first |
| `src/hooks/useGigs.js` | Modified | Added `completeGig(id, payload)` wrapper (was missing — 1a.3 deferred it) |
| `src/lib/songs.js` | Modified | Added `listPlayedAt` — played/off_setlist gigs for a song, never skipped (1c.2 data source + demand count) |
| `src/hooks/useSongs.js` | Modified | Added `getPlayedAt(id)` wrapper |
| `src/pages/SongDetail.jsx` | Modified | "Played at" tags + demand count section |
| `openspec/changes/hito-2-remainder/tasks.md` | Modified | 1c.1–1c.2 checkboxes `[x]` |

### Deviations from Design / Launch Prompt

- No new route: design puts the completion entry inside StageMode (`/setlists/:id/stage`), so `App.jsx` is untouched — no `/gigs/:id/stage` needed.
- `GigDetail.jsx` untouched: it already renders the performance read-only when completed; completion belongs to the stage post-show flow per design.
- Launch prompt's "touch ONLY" list omitted `songs.js`/`SongDetail.jsx`/`useSongs.js`, but assigned task 1c.2 explicitly names `src/lib/songs.js`/`SongDetail.jsx` — implemented per the tasks artifact (the authoritative slice definition).

## Files Changed (PR#1b)

| File | Action | What Was Done |
|------|--------|---------------|
| `src/components/gigs/GigCard.jsx` | Created | List card (name link, status badge, date, venue name); exports `StatusBadge`, `formatWhen` |
| `src/components/gigs/VenueAutocomplete.jsx` | Created | Venue text input + datalist of prior venues; reuse hint when a saved venue matches |
| `src/components/gigs/GigForm.jsx` | Created | Shared create/edit form: name, datetime-local, venue autocomplete, setlist select; client validation; resolves venueId (reuse → createVenue) |
| `src/pages/Gigs.jsx` | Created | List page + inline create |
| `src/pages/GigDetail.jsx` | Created | Detail read + status actions + inline edit + performance display |
| `src/App.jsx` | Modified | `/gigs`, `/gigs/:id` routes under `RequireAuth` |
| `src/components/layout/AppLayout.jsx` | Modified | "Gigs" nav link |
| `openspec/changes/hito-2-remainder/tasks.md` | Modified | 1b.1–1b.4 checkboxes `[x]` |

## Deviations from Design

- None in behavior. Files: `GigForm.jsx` added as a shared component (dedupe mandate); gig components live under `src/components/gigs/` (repo convention), not `src/components/` root.

## Issues Found

- Build emits a pre-existing warning: `src/lib/supabase.js` statically imported elsewhere while `gigs.js` lazy-imports it (intentional for the node demo — 1a.1 ponytail comment). Not introduced by this slice.
- No test runner: render correctness rests on `pnpm build` parsing every new page + manual walk (E2E item for verify phase).

## Remaining Tasks

- [ ] 2a.1–2a.6 SW pipeline + IDB v3 + queue ops (PR#2a) — 2a.6 owns the deferred gig offline enqueue/read-through
- [ ] 2b.1–2b.2 storage screen + eviction (PR#2b)
- [ ] 3.1–3.6 preferences (PR#3)

## Workload / PR Boundary

- Mode: chained PR slice (stacked-to-main), resolved in tasks.md (line 16)
- Current work unit: pr1c (stage completion + played tags)
- Boundary: from main@052a3e1 through 1c.1–1c.2; next slice PR#2a starts from this branch's merge
- Budget: within the 400-line cap (see git diff --stat below)

## Status

PR#2a complete via maintainer-directed split — **two conventional commits, each ≤400**:

1. `4ba443d` **feat(pwa): SW versioned pipeline + IDB v3 lockstep + storage eviction (PR#2a-SW, hito-2-remainder)** — 390 changed (332+58): sw.js versioned caches + cache-meta + UPDATE_READY/SKIP_WAITING; offlineCache v3 `applyUpgrade` + lockstep import in offlineQueue; storage.js policy + exemption guard; updateManager prompt (sessionStorage, stage/practice deferral); main.jsx registration swap; tasks 2a.1–2a.5 `[x]`.
2. `2d6ad36` **feat(offline): gig create/update/complete offline queue ops (PR#2a-queue, hito-2-remainder)** — 250 changed (174+76): gigs.js enqueue wrappers + optimistic pendingSync (replay-safe complete); offlineSync WRITE_OPS; tasks 2a.6 `[x]`.

**21/31 tasks done.** Lint clean, build clean, demos 26/6/13 green. Tracked worktree clean. Not pushed (no PR). Next: sdd-verify → deliver → PR#2b (storage screen; 10 tasks remaining).

## Batch 5 — PR#2a: STOPPED, budget breach (NO COMMIT, NO TASKS COMPLETED)

Mode: Standard (strict_tdd false; no runner; pnpm lint + pnpm build + node demos)

Full 2a slice implemented + verified in worktree (branch `feat/hito-2-remainder-pr2a` @ main `9a3df0c`), but staged diff vs main = **506 insertions + 134 deletions = 640 changed lines > 400 cap** → launch's own STOP rule fired. Nothing committed; tasks.md 2a.1–2a.6 checkboxes reverted to `[ ]`. Worktree keeps the tested implementation (uncommitted; `src/lib/storage.js` + `src/lib/updateManager.js` new/untracked) so the split run commits directly.

### Verification (all PASSED)
- `pnpm lint` → exit 0, 0 errors 0 warnings
- `pnpm build` → exit 0, `✓ built in 2.27s`, 125 modules (pre-existing warnings only)
- `node -e "import('./src/lib/gigs.js').then(m=>m.demo())"` → `gigs demo OK: 26 asserts`, exit 0 (regression clean)
- `node -e "import('./src/lib/offlineCache.js').then(m=>m.demo())"` → `offlineCache demo OK: 6 asserts (v3 additive upgrade, kv/outbox preserved)`, exit 0 (2a.1 RED)
- `node -e "import('./src/lib/storage.js').then(m=>m.demo())"` → `storage demo OK: 13 asserts (activate cleanup, eviction order + exemption)`, exit 0 (2a.3 RED)
- IDB: `applyUpgrade` (offlineCache.js, `<1 kv → <2 outbox → <3 cache-meta`, never drops); offlineQueue.js imports `{DB_VERSION, applyUpgrade}` — lockstep by construction (D5). Eviction exemption guard: `src/lib/storage.js` `isUserAuthoredKvEntry` (`pending:` keys + kv `pendingSync` values exempt).
- WRITE_OPS: `offlineSync.js` L19-21 `createGig/updateGig/completeGig` → gigs.js L230/329/416 call sites; unknown op warn+drop pre-existing (D6).
- SW: no `skipWaiting()`/`clients.claim()` mid-session (only user-initiated SKIP_WAITING); versioned caches `cemurm-{shell|songs|pdf|exports|data}-v2`; cache-meta on put/delete (versionless IDB open, best-effort); UPDATE_READY broadcast. Once/session prompt: `updateManager.js` `sessionStorage['cemurm:update-dismissed']` + DEFERRED_ROUTES (`/setlists/:id/stage`, `/songs/:id/practice`); PROD register in main.jsx; silent offline.

### Projection (additions+deletions, per file vs main)
| File | + | − | total |
|---|---|---|---|
| src/lib/gigs.js | 167 | 74 | 241 |
| public/sw.js | 114 | 26 | 140 |
| src/lib/storage.js (new) | 84 | 0 | 84 |
| src/lib/offlineCache.js | 62 | 9 | 71 |
| src/lib/updateManager.js (new) | 51 | 0 | 51 |
| src/lib/offlineQueue.js | 11 | 10 | 21 |
| src/lib/offlineSync.js | 6 | 1 | 7 |
| src/main.jsx | 5 | 8 | 13 |
| tasks.md | 6 | 6 | 12 |
| **TOTAL** | **506** | **134** | **640** |

### Proposed split (maintainer-pre-named: 2a-SW / 2a-queue, both stack to this branch)
- **2a-SW (~387 ≤ 400)**: sw.js (140) + offlineCache.js (71) + offlineQueue.js (21) + storage.js (84) + updateManager.js (51) + main.jsx (13) + tasks.md 2a.1–2a.5 (~7) — IDB v3 lockstep + versioned SW pipeline + prompt.
- **2a-queue (~253 ≤ 400)**: gigs.js (241) + offlineSync.js (7) + tasks.md 2a.6 (~5) — WRITE_OPS + gig enqueue wrappers; depends on 2a-SW's v3 (D5).

### Status
**blocked — workload decision required** (640 > 400, STOP rule). 0/6 tasks this batch; 2a.1–2a.6 still `[ ]`. Prior batches intact (15/31). Next: re-run apply as 2a-SW → 2a-queue.
## Batch 6 — PR#2a-SW: split corrective run (commit `4ba443d`, branch `feat/hito-2-remainder-pr2a` @ main `9a3df0c`)

Mode: Standard (strict_tdd false; no runner; lint/build/node demos). Split direction pre-established by maintainer (2a-SW → 2a-queue); corrective run staged + committed an EXISTING tested worktree — no re-design, no re-implementation.

### Work Unit Evidence (2a.1–2a.5)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | RED demos are the tasks' built-in evidence (module `demo()` self-checks, repo pattern): `offlineCache` demo 6 asserts (v3 additive upgrade, kv/outbox preserved — 2a.1), `storage` demo 13 asserts (activate cleanup, eviction order + exemption — 2a.3), both verified in Batch 5 and code unchanged; `pnpm lint` → exit 0, 0 errors 0 warnings (this run) |
| Runtime harness command/scenario and exact result | `pnpm build` → `✓ built in 1.66s`, 125 modules, exit 0 (pre-existing supabase dynamic-import + chunk-size warnings only); `node -e "import('./src/lib/gigs.js').then(m=>m.demo())"` → `gigs demo OK: 26 asserts`, exit 0 (regression clean, this run) |
| Diff stat vs main (staged) | `6 files changed, 327 insertions(+), 53 deletions(-)` (380) for the code slice; + tasks.md 10 changed → staged total **390** ≤ 400 |
| Rollback boundary | Revert commit `4ba443d` on this branch: only sw.js/offlineCache.js/offlineQueue.js/storage.js/updateManager.js/main.jsx (+tasks.md) — gigs.js/offlineSync.js worktree changes untouched (they are 2a-queue's next slice) |

### Verification (this run, all PASSED)
- `git diff --stat 9a3df0c` (staged): sw.js 140, offlineCache.js 71, offlineQueue.js 21, storage.js 84, updateManager.js 51, main.jsx 13 → 380 code lines ≤ 400 ✓
- `git diff --cached --name-only`: tasks.md + 6 code files; **gigs.js/offlineSync.js NOT staged** ✓
- `pnpm lint` → exit 0, 0 errors 0 warnings ✓
- `pnpm build` → exit 0, `✓ built in 1.66s`, 125 modules ✓ (worktree files all present — covers both slices' files, fine)
- gigs demo → `gigs demo OK: 26 asserts`, exit 0 ✓
- Lockstep: offlineQueue.js L11 `import { DB_VERSION, applyUpgrade } from './offlineCache.js'` ✓
- SW: no `skipWaiting()` in install/activate; only user-initiated SKIP_WAITING message handler (sw.js L104); UPDATE_READY broadcast (L78); no `clients.claim()` (L98-99) ✓

### Completed Tasks 2a.1–2a.5
- [x] 2a.1 RED demo: v3 upgrade preserves kv/outbox rows (offlineCache demo 6 asserts)
- [x] 2a.2 v3 lockstep: `applyUpgrade` exported from offlineCache.js, offlineQueue.js imports `{DB_VERSION, applyUpgrade}` — lockstep by construction; additive `<1 kv → <2 outbox → <3 cache-meta`, never drops
- [x] 2a.3 RED demo: storage demo 13 asserts — activate deletes foreign/stale caches only, eviction order + user-authored exemption
- [x] 2a.4 public/sw.js: versioned caches `cemurm-{shell|songs|pdf|exports|data}-v2`, no skipWaiting/claim mid-session, cache-meta on put/delete (versionless IDB open, best-effort), UPDATE_READY/SKIP_WAITING messaging
- [x] 2a.5 updateManager.js + PROD register in main.jsx: once/session prompt (`sessionStorage['cemurm:update-dismissed']`), defer on `/setlists/:id/stage` + `/songs/:id/practice`, silent offline retry

### NOT in this slice (left in worktree for 2a-queue)
- `src/lib/gigs.js` (241) + `src/lib/offlineSync.js` (7) — WRITE_OPS + gig enqueue wrappers (2a.6, D6). Uncommitted, changes intact.

### Deviations from Design
None — implementation matches D3/D4/D5 exactly. `storage.js`/`updateManager.js` export node-testable `demo()` self-checks (the RED evidence for 2a.1/2a.3), consistent with the repo pattern.

### Status after this batch
17/31 tasks complete (0, 1a.1–1a.6, 1b.1–1b.4, 1c.1–1c.2, 2a.1–2a.5). ONE conventional commit `4ba443d`, not pushed (no PR). Next: sdd-verify 2a-SW → apply 2a-queue (gigs.js + offlineSync.js + tasks.md 2a.6).
## Batch 7 — PR#2b: Storage Screen + Eviction (commit `67c055f`, branch `feat/hito-2-remainder-pr2b` @ main `53816e5`)

Mode: Standard (strict_tdd false; no runner; lint/build/node demos per tasks.md work-unit table)

### Work Unit Evidence (2b.1–2b.2)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `node -e "import('./src/lib/storage.js').then(m=>m.demo&&m.demo())"` → `storage demo OK: 19 asserts (activate cleanup, eviction order + exemption, planEviction)`, exit 0 — demo extended 13→19 with `planEviction` ordering asserts (the 2b.2 RED; design testing strategy lists "eviction ordering" as a demo-asserted unit) |
| Runtime harness command/scenario and exact result | `pnpm build` → `✓ built in 1.68s`, exit 0 (125 modules; pre-existing chunk-size warning only) — parses Storage.jsx + route; `pnpm lint` → exit 0, 0 errors 0 warnings; gigs demo 26/26 + offlineCache demo 6/6 exit 0 (no regression). Screen is offline-only (cache-meta + IDB kv reads, zero network); the browser category-clear walk is the verify-phase E2E item |
| Diff stat vs main (staged) | `6 files changed, 382 insertions(+), 3 deletions(-)` = **385 changed ≤ 400** (Storage.jsx 268, storage.js 76, offlineCache.js 34, App.jsx 2, AppLayout.jsx 1, tasks.md 4) |
| Rollback boundary | Revert commit `67c055f`: only Storage.jsx + storage.js (planEviction + demo) + offlineCache.js (cacheMetaList/cacheMetaRemove) + App route + AppLayout nav + tasks.md — SW pipeline, queue/gigs, updateManager, prefs untouched |

### Completed Tasks 2b.1–2b.2

- [x] 2b.1 `src/pages/Storage.jsx` + `/settings/storage` route (under RequireAuth, matching the settings-area placement): total + 4 rows (Songs / PDF scans / Exports / Setlists and gigs), offline-visible (cache-meta + IDB kv reads only, no network calls); per-category Clear deletes only that cache prefix (`cemurm-{cat}-v*`, all versions) + matching non-user-authored kv read copies (`songs:`/`song:` → Songs; `setlists:`/`setlist:`/`gig:` → Setlists and gigs); `isUserAuthoredKvEntry` skip guards outbox/pendingSync entries; underlying rows untouched
- [x] 2b.2 Quota warning (`navigator.storage.estimate()` usage/quota > 0.9; offline fallback tracked bytes > 50 MB) + one-tap cleanup: `planEviction` in storage.js — PDF → exports oldest-first via cache-meta `savedAt`, then non-user-authored kv read copies by age, stops once target freed (warning recomputes from fresh stats → clears when sufficient); shell/songs/data SW caches + user data never evicted

### Verification (this run, all PASSED)

- 1. `git diff --stat main` (staged): 6 files, 382+/3− = 385 ≤ 400 ✓ (per-file: Storage.jsx 268, storage.js 76, offlineCache.js 34, App.jsx 2, AppLayout.jsx 1, tasks.md 4)
- 2. `pnpm lint` → `$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`, exit 0, 0 errors 0 warnings ✓
- 3. `pnpm build` → `✓ built in 1.68s`, exit 0 (pre-existing chunk-size warning only) ✓
- 4. `node -e "import('./src/lib/storage.js').then(m=>m.demo&&m.demo())"` → `storage demo OK: 19 asserts (activate cleanup, eviction order + exemption, planEviction)`, exit 0 ✓
- 5. Route registered: `src/App.jsx` L34 `{ path: '/settings/storage', element: <Storage /> }` under RequireAuth ✓; nav: `AppLayout.jsx` L9 `{ to: '/settings/storage', label: 'Storage' }` ✓
- 6. Guard: clear path (`Storage.jsx` L146) + eviction path (`storage.js` L81 planEviction kv filter) both reference `isUserAuthoredKvEntry` ✓
- 7. tasks.md: 2b.1–2b.2 `[x]`; 3.1–3.6 `[ ]` ✓ (25 `[x]` / 6 `[ ]` greps)

### Deviations from Design

- Storage demo assert count 13 → 19 (extended with planEviction ordering asserts per the design's unit-test list). The 13-assert regression command still exits 0 — only the log line changed.
- Active-setlist protection is enforced by construction, not by id lookup: songs/data SW caches sit outside EVICTION_ORDER (never candidates), and kv eviction is oldest-first by `savedAt` (= least recently touched), so an actively used setlist is evicted last, not first. The critically-low scenario (only shell + active setlist survive) is the browser's own quota-eviction territory; our cleanup never targets shell or user data.
- Route chosen `/settings/storage` (settings-area placement per design's settings/storage grouping); nav label "Storage".

### Issues Found

- `navigator.storage.estimate()` is unavailable in insecure contexts — warning falls back to a tracked-bytes threshold (50 MB). Documented fallback in code.
- Pre-existing build warnings (chunk > 500 kB, supabase dynamic import) unchanged; no new warnings.

### NOT in this slice

- Preferences (3.x), transpose, ChordPro rendering, version picker untouched (out of scope). Storage screen adds no network calls — read + clear/evict only.

### Status after this batch

25/31 tasks complete (all of PR#0/#1a/#1b/#1c/#2a/#2b; PR#3 3.1–3.6 pending). ONE conventional commit `67c055f`, not pushed (no PR). Next: sdd-verify 2b → apply PR#3 (preferences).

## Batch 8 — PR#3a: Preferences core + Settings + capo helper (commit `d4dcca2`, branch `feat/hito-2-remainder-pr3a` @ main `5e4f7c4`)

Mode: Standard (strict_tdd false; no runner; lint/build/node demos per tasks.md work-unit 6)

### Work Unit Evidence (3.1–3.3)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `node -e "import('./src/lib/transpose.js').then(m=>m.demo())"` → `transpose demo OK: 21 asserts (notes, keys, parsed, capo, initial semitones)`, exit 0; `node -e "import('./src/lib/preferences.js').then(m=>m.demo())"` → `preferences demo OK: 12 asserts (defaults, D2 jsonb read shape, offline fallback)`, exit 0 |
| Runtime harness command/scenario and exact result | `pnpm lint` → exit 0, 0 errors 0 warnings; `pnpm build` → `✓ built in 1.96s`, 130 modules, exit 0 (pre-existing chunk-size + supabase dynamic-import warnings; preferences.js joins gigs.js in lazy-importing supabase for the node demo — same intentional pattern, 1a.1 ponytail comment); regression demos gigs 26/26 + storage 19/19 + offlineCache 6/6 exit 0 |
| Diff stat vs main | `9 files changed, 255 insertions(+), 9 deletions(-)` = **264 changed ≤ 400** (fresh files prefs/usePrefs/Settings 107+30+54 measured via wc) |
| Rollback boundary | Revert commit `d4dcca2`: only preferences.js/usePreferences.js/Settings.jsx/transpose.js/StageMode.jsx/Practice.jsx/App.jsx/AppLayout.jsx (+tasks.md) — data layer (gigs/songs/setlists), offline/SW pipeline, storage screen untouched |

### Completed Tasks 3.1–3.3

- [x] 3.1 `src/lib/preferences.js` (read-through `prefs:${userId}`, lazy supabase import, `DEFAULT_PREFS` {transpose 0, capo 0, default_version null}, `flattenPreferences` D2 jsonb read shape: default_version / override{songId} / practice{songId:{key,tempo}}, offline fallback → defaults, never throws) + `src/hooks/usePreferences.js` (per useSongs pattern; lazy mount-only fetch; read-only surface, no mutation)
- [x] 3.2 `src/pages/Settings.jsx` + `/settings` route (under RequireAuth) + "Settings" nav entry (end-prop so it doesn't co-highlight with Storage) — read-only table: Transpose / Capo / Default version; zero write calls
- [x] 3.3 `src/lib/transpose.js`: `capoLabel(renderedKey, capo)` → "Capo N · sounds X" (`transposeKey(rendered, capo)`, D7 scenario C+2→"Capo 2 · sounds D"; '' when no capo) + `initialSemitones(global, override)` = sum; demo extended 13→21 asserts. **Wired**: StageMode + Practice initial semitones = global + per-song override (baseline effect re-seeds on song/prefs change, manual +/- preserved; Practice resetKey resets to baseline). **Boundary**: capo/sounds display on rendered charts → 3b renderer (ChordProRenderer + chart surfaces); SongDetail initial transpose → 3b; practice key/tempo → 3.6

### Deviations from Design
None in behavior. `preferences.js` lazy-imports supabase (gigs.js pattern) so its demo runs in bare node — setlists.js's static import would abort the node demo (documented pre-existing limitation).

### Issues Found
- Build's supabase dynamic-import warning now lists preferences.js alongside gigs.js (same intentional lazy-import pattern); no new warning class.
- `prefs:` kv entries are not in any storage-category prefix, so the storage screen never lists/clears them and they never reach planEviction — eviction of pref copies is only browser-quota territory (harmless; re-fetch on next read). No code change needed.

### Status after this batch
28/31 tasks complete (all of PR#0/#1a/#1b/#1c/#2a/#2b + 3.1–3.3; 3.4–3.6 pending → PR#3b). ONE conventional commit `d4dcca2`, not pushed (no PR). Next: sdd-verify PR#3a → apply 3b (renderer annotations/substitution + version picker + practice key/tempo).

## Batch 9 — PR#3b: Renderer annotations/substitution + version picker + practice key/tempo (branch `feat/hito-2-remainder-pr3b` @ main `4397b22`)

Mode: Standard (strict_tdd false; no runner; lint/build/node demos per repo pattern; 3.4/3.5/3.6 share the rendered surfaces — **first committed as one 494-line slice, rejected at review (Reflection-3) for exceeding the 400 budget; maintainer chose the split resolution — rebuilt as two compliant commits**)

### Work Unit Evidence (3.4–3.6)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `node -e "import('./src/lib/transpose.js').then(m=>m.demo())"` → `transpose demo OK: 28 asserts` exit 0; `node -e "import('./src/lib/annotations.js').then(m=>m.demo())"` → `annotations demo OK: 11 asserts (anchors, substitution map, transpose movement, offline)` exit 0; `node -e "import('./src/lib/preferences.js').then(m=>m.demo())"` → 12 asserts exit 0; `node -e "import('./src/lib/setlists.js').then(m=>m.demo())"` → setlists demo exit 0 |
| Runtime harness command/scenario and exact result | `pnpm lint` → exit 0, 0 errors 0 warnings; `pnpm build` → exit 0 (pre-existing chunk-size + lazy-import warnings only) |
| Diff stat vs main | Slice A (`ef75a74`, 3.4 core): `3 files changed, 202 insertions(+), 22 deletions(-)` = **224 changed ≤ 400** ✓; Slice B (`fc33bce`, 3.5+3.6+wiring): `8 files changed, 242 insertions(+), 28 deletions(-)` = **270 changed ≤ 400** ✓; cumulative `11 files changed, 444 insertions(+), 50 deletions(-)` = 494 (honest total, split per maintainer decision) |
| Rollback boundary | Revert PR#3b commit(s): annotations.js + transpose.js helpers + ChordProRenderer.jsx (3.4), songs.js/setlists.js/useSetlists.js/SetlistDetail.jsx/SongDetail.jsx/offlineSync.js WRITE_OPS entry (3.5), Practice.jsx (3.6). StageMode.jsx, PWA/SW, storage, gigs untouched |

### Completed Tasks 3.4–3.6

- [x] 3.4 `ChordProRenderer.jsx`: annotations (`personal_annotations`, anchor `{section,index}`) + substitution (transposed match/render); preserved across transpose — new `src/lib/annotations.js` (noteForLine, buildSubstitutionMap, applySubstitution reverse/forward transpose with flat-key consistency, listAnnotations self-scoped read offline→[], demo 11 asserts); renderer tracks {section} header name + 0-based lyric-line index so notes anchor per the 0001 comment; chord tokens resolved via `applySubstitution` in LyricLine; wired in Practice + SongDetail (author view only)
- [x] 3.5 Version picker → `setlist_items.version_id`; default version opens first, picker offers others — songs.js flattenSong exposes `versions[]` (id/name/number/key/bpm/durationSeconds/isReady/body, no extra network); setlists.js flattenSetlist `versionIds{}` + `setSongVersion` (online update → refetch; offline enqueueOp + optimistic mutateVersions; 2 selects updated to read version_id); offlineSync.js WRITE_OPS += setSongVersion (D6 whitelist); useSetlists wrapper; SetlistDetail per-item select (Default⇒null) + chosen-version label; SongDetail opens prefs.defaultVersion when it matches a version, else latest, local picker marks "(default)"
- [x] 3.6 Practice key/tempo drive metronome/auto-scroll; stage key unchanged — Practice baseline semitones = practicePref.key shift (semitonesBetween smallest path, G→D = −5) when set, else global+override; displayBpm baseline = practicePref.tempo ?? song.bpm (offset reset on baseline change; resetTempo → pref tempo); control bar shows "Practice D · 70 BPM · ±N semitones"; capoLabel surfaces on Practice + SongDetail charts (3b renderer boundary from verify-report L743); StageMode.jsx untouched — grep-verified zero practice-pref refs

### Deviations from Design
None in behavior. `applySubstitution` lives in `annotations.js` (not the renderer) so its transpose math is node-testable — same reason transpose.js exports `transposeChord` + `preferFlatForKey`. Substitution anchors keyed by concrete chord token per the 0001 comment ("keys to concrete chord token"); reverse-transpose matches the rendered token (D7: "match transposed chord token").

### Issues Found
- `flattenSong`'s version-array variable collided with the sorted raw rows (`versions`) — renamed the raw array `versionRows`, derived array `versions`. Caught pre-test.
- Non-latest versions render their OWN chart body when picked ('' when the version has no chart) — correct per version semantics; the song list practice link still targets the latest chart (existing behavior).

### Status after this batch
31/31 tasks complete (entire hito-2-remainder change). TWO conventional commits, stacked, each ≤400 changed lines: `ef75a74` (PR#3b-1: renderer annotations/substitution core) + `fc33bce` (PR#3b-2: version picker + practice key/tempo + wiring; branch `feat/hito-2-remainder-pr3b` @ main `4397b22`), **not pushed (no PR)**. Initial single commit `bfc34e6` (494 lines) was reset at maintainer request (Reflection-3: over-budget must not stand without approved size:exception). Next: sdd-verify PR#3b (closes the change-level envelope: prefs spec 6 requirements / 12 scenarios).
