# Hito 5 — External Display Output (#62)

## Objective
Mirror Performance Mode (Stage Mode) to a second display: the primary device keeps the full setlist navigator and controls while a clean audience-facing view (title + lyrics or chords, no chrome/annotations) runs on the second screen, following the current song and transpose in sync. No second screen → labeled in-app preview. Persist per-setlist settings (mode), survive mid-show disconnect, work offline, and prompt to re-launch after an app restart.

## BDD
`features/external-display.feature` (11 scenarios): request second screen from Performance Mode → full-screen presentation on second display + primary keeps navigator/controls; only primary display → labeled "External display preview" window; disconnect mid-show → primary keeps controls + offers re-open on reconnect; clean audience view (title + lyrics, no chrome/annotations); follows current song in sync; external display and congregation projection are separate targets (not in this slice — projection is feature #79); switch mode Lyrics/Chords with primary control updating; personal transpose applied on display while canonical chart stays unchanged; settings persist for next gig + one-tap relaunch; works offline; recovers after restart with prompt + last active song shown.

## Authorized scope
- Client-only slice (no migration): popup window + BroadcastChannel sync, shared clean `ExternalDisplayView` for both the popup page and the in-app preview modal.
- Persistence via localStorage keys per setlist (`settings` = mode, `active` marker for restart prompt, `last` state for popup restore).
- Stage Mode is the only entry point ("Performance Mode" per BDD); projection target separation is honored by namespacing this slice only (scenario 6 is satisfied here because this slice never touches any projection surface — that belongs to #79).
- Multi-screen detection via `window.screen.isExtended` where available; reconnect offer via polling while disconnected.

## Tasks
- [x] TD1 — `src/lib/externalDisplay.js`: channel name, open/close helpers (popup vs preview decision via `screen.isExtended`), postState, settings/active/last persistence, heartbeat tracking, reconnect polling.
- [x] TD2 — `src/components/external/ExternalDisplayView.jsx`: shared clean renderer (title + lyrics-with-chords OR chords-only by mode; no chrome); used by popup page AND preview modal.
- [x] TD3 — `src/pages/ExternalDisplay.jsx` + route `/external-display` (outside AppLayout): subscribes to channel, restores last state on open, heartbeats, closes cleanly.
- [x] TD4 — StageMode integration: Display menu (open/close, Lyrics/Chords mode persisted), state broadcast on song/transpose/mode change, preview modal when no second screen, disconnect detection (heartbeat timeout), reconnect offer (screen.isExtended polling), restart prompt (active marker), one-tap relaunch with last settings.
- [x] CHK — `pnpm lint` (zero warnings) + `pnpm build` green.

## Validation evidence
- `pnpm lint` zero warnings; `pnpm build` ✓ 3.34s.
- Structural readback: `/external-display` route outside AppLayout; popup page restores last state + heartbeats; StageMode broadcasts `displayState` (title, transposed sections, key, mode) only when display==='popup' and persists via `saveLastState`; preview modal labeled exactly "External display preview"; reconnect offer polls `screen.isExtended`; restart prompt reads the `active` marker.
- Client-only slice: no migration — proven by `supabase db reset` not needed for this branch (no `supabase/migrations/` changes).

## Delivery evidence
- Behavior notes: state is derived from the ALREADY-transposed chart (semitones + song override applied in StageMode), so the canonical arrangement on disk is never mutated. No projection surface is touched (congregation projection is #79) — scenario 6 separation holds by construction.

## Acceptance criteria
All 11 BDD scenarios satisfiable: popup/preview separation; clean view; sync following; transpose applied without mutating source; mode persisted + one-tap relaunch; offline works (all client-side); restart prompt shows last song.

## Verification commands (each task)
- `pnpm lint && pnpm build`; structural readback of StageMode integration + route.

## Delivery
- auto-chain (session), stacked-to-main; PR 2/10 of the Hito 5 chain; size:exception documented (expected > 400 lines, maintainer-accepted).

## Review status (RDD)
- Session policy: native review deferred (`immutable_review_transport_unsupported` on OpenCode runtime); recorded per-Hito-5-doc, not re-prompted.