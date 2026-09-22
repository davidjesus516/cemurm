# Hito 5 — MIDI Integration (Program Change) (#56)

Feature: `features/midi-integration.feature` (11 BDD scenarios).
Chain: stacked-to-main, PR #148. Delivery: auto-chain, size:exception documentado (práctica #143–#147).

## Objective

Send a MIDI Program Change when the current song changes in Stage Mode, so a
performer's pedalboard/synth switches patches per setlist item. Mappings are
saved with the setlist (per song, 0–127), selected output device is a
browser-local performance setting, and everything degrades gracefully (no Web
MIDI support / denied permission / offline / no mapping → performance keeps
working).

## Problem

Web MIDI in CEMURM is greenfield (no existing surface beyond the Hito 2 USB HID
foot pedal, which is a different device class). The setlist_items table has no
MIDI column; the setlist client shape has no mapping; StageMode has no send
point. Scenarios S1–S3 need a device surface, S4–S7 need a dispatch on song
change, S8–S9 need persistence (+ duplication), S10/S11 need graceful
degradation and independence from transpose/capo.

## Why

Feature 6/10 of Hito 5 ("Integrations"), per `docs/mvp-scope.md` (Hito 5
integration surface lists `features/midi-integration.feature`). Needs only base
setlists + Stage Mode (Hito 1/2/4 surfaces, already shipped).

## Scope (authorized)

- Migration `0024_midi_program.sql`: `setlist_items.midi_program integer NULL`
  + CHECK 0–127. Existing table RLS/grants cover the column (no new policy).
- Smoke `scripts/smoke/0024-midi.sql` (fresh reset, NOT idempotent): column +
  constraint + owner update.
- `src/lib/midi.js`: pure Web MIDI helpers (support detection, program
  normalization, message bytes, localStorage settings) + node demo.
- `src/hooks/useMidi.js`: access/permission/device list/selection + send,
  non-blocking (mirrors useFootPedal mount-only philosophy).
- `src/lib/setlists.js`: `midi_program` on reads, `midiPrograms` map on the
  setlist shape, duplication carries mappings, `setMidiProgram` op (offline
  queue pattern of setSongVersion) + register in offlineSync WRITE_OPS.
- `src/pages/StageMode.jsx`: send program change on song change (skip initial).
- `src/pages/Settings.jsx`: MIDI section — support/deny messages, device list
  + selection (persist localStorage).
- `src/pages/SetlistDetail.jsx`: per-item MIDI program input (0–127, "No
  patch"), collab lock pattern like the version select.
- Validación: smoke 0024, demo node, lint/build, push, PR #148 (Closes #56).

## Key decisions

- **Persistencia del mapeo**: columna `setlist_items.midi_program` (por item;
  "saved with the setlist"; duplication copies items → mappings carry over).
  NULL = sin patch (S6: no se envía nada, no se repite el último).
- **Dispositivo de salida**: localStorage `cemurm:midi:settings`
  (`{ outputDeviceId, channel }`). Los puertos MIDI son hardware/browser-local
  (pattern precedent: projection deck localStorage). No a `device_configs`
  (esa tabla es para configuración persistente por dispositivo físico; el
  output MIDI es selección del navegador).
- **Envío**: hook `useMidi` montado en StageMode con `autoConnect` solo si el
  usuario YA concedió el permiso (`permissionGranted` en settings) → nunca se
  muestra el prompt de permiso durante una actuación (S2/S10). Dispatch por
  efecto en `song.id` viendo `setlist.midiPrograms[song.id]`, saltando el
  primer render (S4/S7: solo cambios; volver atrás re-envía).
- **Independencia transpose/capo**: el mapeo se lee del item del setlist, no
  del estado de render (S11).
- **Offline**: `setMidiProgram` encola como `setSongVersion` (WRITE_OPS +
  optimistic `mutateMidi`); el envío en stage sin dispositivo/permiso es un
  no-op silencioso (S10).
- Canal MIDI fijo 0 (spec no nombra canales); constant exportada para futuro.

## Iteration log

- **T1 find**: la columna `midi_program` YA existe en el contrato base
  (0001 setlist_items, docs/database-schema-v2.md línea 317) — 0024 NO hace
  `add column`, solo añade el CHECK 0–127 + comment. Reset fallaba con
  `column already exists` hasta corregirlo.
- **T1 find (RLS semantics)**: USING=false filtra la fila y devuelve 0 filas
  SIN error; WITH CHECK=false lanza `new row violates row-level security
  policy`. Smoke: el caso pending-collaborator (USING false) se asserta por
  valor intacto, no por error; y el assert debe correr bajo postgres (el
  outsider ni siquiera ve la fila por RLS de lectura).
- **T2 find**: en node 26 `typeof localStorage !== 'undefined'` es true (con
  warning) — el getter del demo usa el guard de parse, no la ausencia del
  objeto; el assert de defaults sigue pasando.
- **T6 design**: el input de programa usa drafts locales por item
  (`midiDrafts`) para no ser clobbered por refrescos realtime/shared; commit
  en blur/Enter con el MISMO patrón de collab lock del version select. El
  hook `useSetlists` expone `setMidiProgram` como `setSongVersion`.
- **Lint fix**: en StageMode, `midi.sendProgram` dentro del efecto con dep
  parcial viola exhaustive-deps → destructuring `const { sendProgram:
  midiSendProgram } = useMidi(...)` mantiene la dep estable (useCallback del
  hook).

## Tasks

### T1 — Migración 0024 + smoke
`supabase/migrations/0024_midi_program.sql`: `alter table public.setlist_items
add column midi_program integer;` + check `(midi_program is null or
midi_program between 0 and 127)` + comment. Smoke `scripts/smoke/0024-midi.sql`:
column exists/default null; check rechaza 128 y -1; update por owner (rol
authenticated) OK; update por no-owner/collaborador sin can_edit DENEGADO.

### T2 — Lib MIDI pura
`src/lib/midi.js`: `isMidiSupported()` (navigator.requestMIDIAccess presente),
`normalizeProgram()` (''/null/NaN → null; clamp/rechazar fuera 0–127),
`SETTINGS_KEY` + `loadMidiSettings()` / `saveMidiSettings()` (localStorage),
`programChangeBytes(channel, program)` → `[0xC0|channel, program]` (+validación)
y `channelSwitchBytes` si aplica. Demo node con asserts (guard de navigator/
localStorage en node).

### T3 — Hook useMidi
`src/hooks/useMidi.js`: `{ supported, permission, outputs, selectedId, label,
selectDevice, sendProgram, error }`. `request()` pide acceso; `autoConnect`
solo cuando settings.permissionGranted; listar outputs; selección persiste;
sendProgram hace send([0xC0|channel, program]) si hay output, no-op silencioso
si no. Nunca lanza al caller.

### T4 — Data layer setlists
`src/lib/setlists.js`: selects `setlist_items(..., midi_program)` en
listSetlists/fetchSetlistById/createSetlist; `flattenSetlist` → `midiPrograms`
({ songId: program }, omite null); `duplicateSetlist` copia `midi_program`;
nuevo `setMidiProgram(userId, setlistId, songId, program)` (patrón
setSongVersion: guard fetch, update, invalidate, offline enqueueOp +
buildOptimisticSetlist mutateMidi). `offlineSync.js` WRITE_OPS + `setMidiProgram`.

### T5 — StageMode dispatch
`src/pages/StageMode.jsx`: `useMidi({ autoConnect: settings.permissionGranted })`;
ref `prevSongId`; efecto en `song?.id`: si `prevSongId` inicial (skip first) y
`setlist?.midiPrograms?.[song?.id]` no-null → `midi.sendProgram(program)`.

### T6 — UI Settings + SetlistDetail
`Settings.jsx`: sección "MIDI output": no-support → "MIDI is not supported in
this browser" (disabled, S3); denied → "MIDI permission denied — performance
mode keeps working" (S2); else lista de outputs + select + label. `SetlistDetail.jsx`:
input numérico por item (0–127, placeholder "No patch", guard canEdit +
collab lock igual que el version select, S8/S9).

### T7 — Validación + push + PR
Smoke 0024 (reset limpio), demo node, lint/build, task doc + mirror, commits
work-unit, push `feat/hito5-midi`, PR #148 (base main, Closes #56,
size:exception), nota revisión visual (desktop browser no conectado para Web
MIDI real — validación del data layer + mensajes en demo; hardware MIDI queda
para revisión manual del usuario).

## Applicable checks

- Smoke 0024 postgres psql (docker exec supabase_db_cemurm).
- Demo node `src/lib/midi.js` + `src/lib/setlists.js` (si aplica).
- `pnpm lint` (zero warnings), `pnpm build`.
- UI visual + dispositivo MIDI real: revisión manual del usuario.

## Acceptance criteria

- 11/11 BDD escenarios cubiertos (mapeo escenario→componente en este doc).
- Mapeo guardado con el setlist; duplicado lo hereda; transposición no lo altera.
- Sin prompt de permiso MIDI en plena actuación; sin bloqueo offline.
- size:exception documentado; forecast de líneas al cierre.

## Progress

- [x] T0 branch `feat/hito5-midi` desde `feat/hito5-substitutions` (1143afa)
- [x] T1 migración 0024 + smoke (8/8 PASS: columna `midi_program` del contrato
  0001; CHECK 0–127; owner write/clear; denies collaborator/pending) — commit `3fe4286`
- [x] T2 lib `src/lib/midi.js` — helpers puros + demo node (todos los asserts)
- [x] T3 hook `src/hooks/useMidi.js` — permiso/dispositivos/envío, autoConnect
  sin re-prompt
- [x] T4 data layer: selects `midi_program`, `midiPrograms` en flatten,
  duplicado copia mappings, `setMidiProgram` + WRITE_OPS offline
- [x] T5 `StageMode` dispatch — send por cambio de canción (skip first, next+back)
- [x] T6 UI — Settings (S1/S2/S3) + SetlistDetail editor (S8/S9)
- [x] T7 validación final + mirror + push + PR #148

## T7 validation record

- Smoke 0024: **8/8 PASS** (reset limpio tras corrigir 0024 a constraint-only).
- Demo `src/lib/midi.js`: **todos los asserts OK** (support/node, normalize,
  bytes, settings guard, labels, send/spy).
- `pnpm lint`: **0 warnings** (fix exhaustive-deps vía destructuring).
- `pnpm build`: **green**.
- Forecast rama vs `feat/hito5-substitutions` (1143afa): **~843 líneas
  (835 insertions + 8 deletions)** → **size:exception** documentado (práctica
  de la cadena #143–#147).
- Nota revisión visual/Web MIDI real: desktop browser no conectado; hardware
  MIDI queda para revisión manual del usuario (data layer + mensajes cubiertos
  por smoke/demo/lint/build).