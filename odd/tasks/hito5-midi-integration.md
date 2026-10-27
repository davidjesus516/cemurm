# Hito 5 — MIDI Integration (#56)

## Objective
Send MIDI Program Change (0-127) on song change in Stage Mode. The mapping lives on `setlist_items.midi_program` (migration 0024) so it travels with the setlist. Device selection is browser-local (localStorage) — MIDI ports are a per-browser hardware fact, not an account preference.

## BDD
`features/midi-integration.feature` (8 scenarios): program mapping saved per song in setlist detail; Stage Mode auto-connects when permission was granted; sends Program Change on next/prev song; no program change sent for unmapped songs; permission denied → performance mode keeps working; offline/absent device → silent no-op; settings page shows output selector when granted; browser without MIDI shows "not supported".

## Architecture decisions
1. **Database mapping**: `setlist_items.midi_program` (nullable integer 0-127) — migration 0024. A duplicated setlist reuses the same mapping. `normalizeProgram()` guards form/DB input (empty/invalid → null).
2. **Device settings**: browser-local `localStorage` (`cemurm:midi:settings`) with `outputDeviceId`, `channel` (fixed 0 for now), `permissionGranted`. Same localStorage precedent as projection deck.
3. **Data layer** (`src/lib/midi.js`): pure Web MIDI helpers + settings; DOM-free functions testable in node; `sendProgramChange()` returns `null` on absent/offline output (never throws).
4. **Hook** (`useMidi`): owns permission, output list, persisted selection, one-shot sends. `autoConnect` only fires `requestMIDIAccess` when `permissionGranted` was already persisted — no popup mid-performance.
5. **Stage Mode integration**: effect on song change sends `midiSendProgram(setlist.midiPrograms?.[song.id])` — first render skipped so opening doesn't fire.
6. **Settings page**: MIDI output section — unsupported/denied/granted states; device selector when granted; "Program mappings per song are saved with each setlist" note.

## Authorized scope
- Migration 0024 (`setlist_items.midi_program` + CHECK 0-127) — already on main.
- Data layer: `src/lib/midi.js` (pure functions + settings + demo).
- Hook: `src/hooks/shared/useMidi.js` (permission + device list + sendProgram).
- Settings page: MIDI output section (device selector, status messages).
- SetlistDetail: MIDI program input per song (controlled draft, committed on blur/Enter, collab lock).
- StageMode: auto-connect + send Program Change on song change.
- Smoke test: `scripts/smoke/0024-midi.sql`.

## Tasks
- [x] T1 — Migration 0024: `setlist_items.midi_program` integer CHECK (0-127), normalized on insert/update.
- [x] T2 — Smoke RLS: `scripts/smoke/0024-midi.sql` — owner can set/clear; outsider cannot; CHECK rejects 128+; duplicate copies mapping.
- [x] T3 — Data layer `src/lib/midi.js`: `normalizeProgram`, `programChangeBytes`, `sendProgramChange`, settings (load/save), labels, node demo.
- [x] T4 — Hook `useMidi`: permission (granted/denied/unsupported), output list, persisted selection, `sendProgram`, `autoConnect` restores granted device without prompt.
- [x] T5 — Settings page: MIDI output section (unsupported/denied/granted + device selector + active label).
- [x] T6 — SetlistDetail: MIDI program input (0-127, empty = No patch), controlled draft, commit on blur/Enter, collab lock.
- [x] T7 — StageMode: `useMidi({ autoConnect: loadMidiSettings().permissionGranted })` + effect on song change sends mapped program; first render skipped.
- [x] T8 — Duplicate setlist copies MIDI mapping.
- [x] CHK — `pnpm lint` + `pnpm test` + `pnpm build` + visual contract green.

## Validation evidence
- `pnpm lint` zero warnings; `pnpm test` 348 pass; `pnpm build` OK; visual contract green.
- Smoke `0024-midi.sql` (owner set/clear, outsider blocked, CHECK 0-127, duplicate copies): 6/6 PASS.
- Node demo (`midi demo`): 18 asserts PASS (normalization, message bytes, settings, labels).
- Live E2E (real JWT + PostgREST): owner sets mapping → Stage Mode sends bytes → display shows "Program N"; denied permission → performance mode works.

## Acceptance criteria
All 8 BDD scenarios covered by T3-T7; offline/absent device never throws; first-render skip prevents mid-performance prompt.

## Verification commands
- `pnpm lint && pnpm test && pnpm build && bash scripts/check-visual-contract.sh`
- `node -e "import('./src/lib/midi.js').then(m => m.demo())"` (node demo)
- `supabase db reset` + `scripts/smoke/0024-midi.sql` (local dev only)

## Delivery
- auto-chain (session), stacked-to-main; PR 4/10 of the Hito 5 chain.
- size: ~400 lines (data layer + hook + Settings + SetlistDetail + StageMode integration).