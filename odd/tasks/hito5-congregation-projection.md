# Hito 5 — Feature 4/10: Congregation Projection (#79)

## Objective
Lyrics-only congregation display controlled from the operator's device, started from the service plan. 19 BDD scenarios (features/congregation-projection.feature). Delivered as PR in the stacked-to-main chain (PR #146 expected).

## Problem / Why
During live services the congregation needs to sing along while band members see chords on their own screens. The projection is a separate target from the audience phone view and from the performer's external display.

## Scope
- Operator console: start/stop projection from a service plan, Prev/Next slides, insert scripture + announcement slides, live typo fix, high-contrast + font scale settings (persisted).
- Congregation display surface: lyrics-only slides (title slide per song, one slide per lyric section, scripture centered, announcement text), no chords/keys/rehearsal notes/controls/annotations.
- License gate: songs with a live `public_songs` entry licensed `proprietary` are blocked on the display ("Not licensed for public projection") and the block is logged (service_change_log).
- Robustness: offline (cached slides), display reconnect resumes at last slide, operator crash recovery (same slide), multi-display sync via BroadcastChannel + connection-lost indicator.
- Typo fix: `record_typo_fix` RPC — updates the chart content and creates a NEW `song_versions` entry with `change_note='Fixed lyric typo'` (editor + timestamp from the row itself).

## Non-goals (explicit)
- QR audience phone view (belongs to export-and-sharing; projection must simply never drive that target). Scenario "separate targets" is satisfied by projection writing nothing to `audience_views`/setlists and using its own broadcast channel.
- External display second-screen output (#62) — separate feature/branch; the projector display here reuses the same BroadcastChannel popup pattern but over the projection channel.
- Realtime/persistent projection session table — the schema contract defines `projection_sessions` as pure client/runtime state (realtime surface, not persistent rows).

## Architecture decisions
1. **Client-side projection session** per the 48-table contract: deck (slide array) + slide index + settings live on the operator device, broadcast over `BroadcastChannel('cemurm:projection:<serviceId>')`, persisted per service in localStorage (`cemurm:projection:<serviceId>` deck + index + settings + last state). Display popups are fresh windows on the same origin that join the channel and, on open, resume from localStorage last state (reconnect) while waiting for the next broadcast (offline/cached).
2. **Backend additions (migration 0022)**, minimal and contract-consistent:
   - `private.projection_license(song_id)` -> returns `projectable boolean, reason text`: reads the live `public_songs` row for that song; `proprietary` -> blocked `Not licensed for public projection`; otherwise/absent (org-owned song) -> projectable.
   - `public.record_typo_fix(p_song_id uuid, p_body text)`: security-definer; updates the latest `chart_files.content`, inserts a new `song_versions` row (next number, `change_note='Fixed lyric typo'`, `created_by=auth.uid()`, `chart_file_id`). No direct `songs`/`chart_files`/`song_versions` exposure beyond existing RLS.
   - `public.log_projection_blocked(p_service_id uuid, p_song_id uuid, p_reason text)`: inserts into `service_change_log` (action `projection_blocked`) — security-definer, service-member check, never completed services? (block on completed: reader-only, log still allowed as an audit — decide in implementation: allow, it is an audit record).
   - RLS/grants: both RPCs `security definer` with revoke-public + explicit grant to `authenticated`; helper is `private` schema so no direct table access changes.
3. **Slide deck model**: song -> title slide then one slide per parsed lyric section (parser sections of type `lyrics`; `section` headers become the slide label; `comment` lines shown as non-chord context? Decision: comments never render — BDD says display shows lyrics and slide titles, not notes). Scripture/announcement slides are operator-inserted objects in the deck (ID + inserted-at position; announcement stored with the deck = "stored with the service plan").

## Authored changed lines forecast: ~750 (slice > 400, size:exception documented, auto-chain stacked-to-main)
Delivery strategy (cached): `auto-chain`; chain strategy (cached): `stacked-to-main`. Slice = this single feature PR.

## TDD Mode
Disabled (no test framework in repo; smoke = SQL + live E2E + lint/build).

## Checklist (stable task IDs)

### T1 — Backend migration 0022 (RPCs + log)
- [x] `private.projection_license(song_id)` helper (public_songs live join; proprietary -> blocked)
- [x] `public.record_typo_fix(p_song_id, p_body)` security-definer (chart update + new song_versions row with change_note 'Fixed lyric typo')
- [x] `public.log_projection_blocked(p_service_id, p_song_id, p_reason)` security-definer (service_change_log insert)
- [x] RLS/grants sealed: revoke public/anon/authenticated on new funcs -> grant execute authenticated; definer checks membership
- [x] Test: `supabase db reset` full chain passes (apply 0019 OR REPLACE fix first, restore after) — PASS, 0022 aplica limpio

### T2 — Smoke RLS matrix (scripts/smoke/0022-projection.sql)
- [x] T0: fixture service w/ blocks + setlists + songs (Worship A/B/C); Song C proprietary public_songs row
- [x] Leader: projection_license A/B projectable, C blocked w/ reason
- [x] Member: same read OK; Outsider (other org) cannot call record_typo_fix on A
- [x] record_typo_fix: new version number increments, change_note='Fixed lyric typo', created_by = caller, chart content updated
- [x] log_projection_blocked: row in service_change_log with action, only by org member; anon/outsider blocked
- [x] Readable via RPCs only; no direct table exposure beyond existing RLS
- [x] **Result: 12/12 PASS** (T4 assert fix: status flip como postgres — main no tiene grant update on services, eso es del 0021 sin mergear)

### T3 — Projection data layer (src/lib/projection.js)
- [x] `buildDeck(serviceId)` — fetch service via services.js, unfold blocks -> setlists -> items -> songs (title + parsed body), license-gate each song, produce slide deck (title slides, lyric sections, blocked slides)
- [x] Session store: deck + index + settings + last state, per-service localStorage, restore on boot
- [x] BroadcastChannel helpers (channel per service, state/heartbeat/close messages like externalDisplay.js pattern)
- [x] Controls: next/back/insertScripture/insertAnnouncement/fixTypo/start/stop (goTo/next/prev/insertSlide/removeSlide)
- [x] fixTypo: local slide text update + record_typo_fix RPC
- [x] License helpers: isProjectable(song), blocked reason text; logProjectionBlocked on attempt
- [x] Validación funcional aislada: lyricSlides filtra comments, mapea headers→labels, líneas sin acordes (verificado vía node)

### T4 — Operator console (src/pages/Projection.jsx) + route
- [x] Route `/services/:id/projection` (in App.jsx)
- [x] Deck navigation: Prev/Next per slide, slide counter (`n / total` en header)
- [x] Insert scripture slide (text + reference, centered on display)
- [x] Insert announcement slide (stored with deck)
- [x] Typo fix UI per song (edit chordpro body -> RPC + deck rebuild solo de slides de esa canción)
- [x] Settings: high-contrast toggle, font scale +/- (persist)
- [x] Blocked song shows "Not licensed for public projection" + operator log notice
- [x] Open display popup (`/projection/display?service=<id>`); preview in-page; reconnect offer

### T5 — Congregation display (src/pages/ProjectionDisplay.jsx) + route
- [x] Route `/projection/display` (no chrome shell; full-screen)
- [x] Lyrics-only slide render (no chords/keys/notes/annotations/controls)
- [x] Title slide, section slide (label + lyric lines), scripture centered, announcement, blocked slide
- [x] Joins BroadcastChannel; on open resumes last state (localStorage last-state)
- [x] High-contrast palette + font scale applied from settings
- [x] Offline: cached deck renders without errors
- [ ] Nota honesta: el DISPLAY no pinta indicador propio de "connection lost" — retiene la última diapositiva (offline-safe); el OPERADOR ve `disconnected` + botón Reconnect tras el heartbeat timeout (cubre el escenario BDD de reconexión desde el operador)

### T6 — Integration into ServiceDetail
- [x] "Start projection" button (operator: member or leader) -> navigate to console
- [x] Does not affect published-plan-freeze UI (separate branch; no snapshot coupling)

### T7 — Live validation
- [x] `supabase db reset` + smoke 0022 1/1 (full chain) — 12/12 PASS
- [x] Local E2E (real JWT vía PostgREST): member reads service, license gate batch uuid[], typo fix creates version, block audit member-visible, outsider denied — **7/7 PASS** (`/tmp/opencode/e2e-0022-projection.mjs`)
- [x] `pnpm lint` zero warnings
- [x] `pnpm build` green
- [ ] `git status` clean; commits split by work unit (T1-T2, T3-T4-T5, T6-T7) — pendiente en T8

### T8 — Wrap-up
- [ ] Work-unit commits + push feat/hito5-congregation-projection
- [ ] PR #146: `feat(projection): Congregation Projection (Hito 5 #79)`, base main, Closes #79, size:exception documented, diff vs main
- [ ] Engram mirrors: doc + discoveries/gotchas
- [ ] Update chain state (PR #146 open, next feature #81)

## Acceptance criteria (from BDD)
Every one of the 19 scenarios in features/congregation-projection.feature is covered by T1-T7; explicit non-leak of chords/annotations verified in T5; offline/reconnect/crash covered in T3/T5/T7.

## Evidence
- `scripts/smoke/0022-projection.sql` — runnable RLS matrix (fresh DB). Result: 12/12 PASS on reset chain (0019 OR REPLACE fix local, restored after).
- Live E2E at `/tmp/opencode/e2e-0022-projection.mjs` (real JWT + PostgREST vs local stack): 7/7 PASS.
- `lyricSlides` pure-function check (comments filtered, headers→labels, chord-free lines): PASS.
- Lint/build green: `pnpm lint` 0 warnings, `pnpm build` OK (2.4s).
- UI visual check pendiente de revisión manual del usuario (desktop browser no conectado a la sesión — misma limitación que #80: data layer validado live, render visual por revisar).