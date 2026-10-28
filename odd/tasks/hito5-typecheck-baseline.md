# Hito 5 — typecheck baseline extension (chain fields) — task doc

**Feature:** follow-up to `feat/ts-checkjs-baseline` (main, 9f111dd) — extend the JSDoc baseline to the fields the Hito 5 chain added. Branch: `feat/hito5-typecheck-baseline` FROM stack head `2f97e9b` (feat/hito5-external-integrations) — NEVER from main.
**PR:** base `main`, stacked after #165 (`#147→#148→#155→#156→#159→#165→<this>`). Delivery `auto-chain` / `stacked-to-main`; forecast ≈150–200 authored lines ⇒ single small PR, no size:exception needed.
**Repo-relative locator:** `odd/tasks/hito5-typecheck-baseline.md` · Engram mirror topic `odd/hito5-typecheck-baseline/tasks`.

## Objective

Make `pnpm typecheck` (tsc --noEmit, per-file `// @ts-check` opt-in, include `src/lib`) pass on top of the merged Hito 5 chain, by extending the baseline typedefs in `src/lib/songs.js` and `src/lib/setlists.js` with the fields the chain added. No behavior changes; JSDoc only.

## Problem / Why

The baseline (odd/tasks/ts-checkjs-baseline.md) typed `transpose/annotations/songs/setlists` against the pre-Hito-5 schema. The chain (midi/obs/spotify/pdf/#78) extended those two domain libs with new rows and flattened fields, so `pnpm typecheck` currently fails with **53 errors** (40 `songs.js`, 13 `setlists.js`). Merging the chain into main without this slice leaves main's `typecheck` script red.

## Verified facts (2026-09-24, at stack head `2f97e9b`)

- `pnpm typecheck` → 53 errors, only in `src/lib/songs.js` + `src/lib/setlists.js`. Full inventory: `/tmp/opencode/typecheck-errors.txt` (recreate with `pnpm typecheck 2>&1 | grep "error TS"`).
- Typedef anchors: songs.js `RawChartRow` (:28), `RawVersionRow` (:36), `RawSongRow` (:49), `SongVersion` (:67), `Song` (:79), `SongInput` (:104); setlists.js `RawSetlistItemRow` (:23), `RawSetlistRow` (:37), `Setlist` (:52).
- Error classes:
  - `RawSetlistItemRow` missing `midi_program`; `Setlist` missing `midiPrograms` (setlists 182–183, 202, 296–297, 519).
  - `setMidiProgram` JSDoc has prose only — no `@param` tags → params implicit any (setlists 634). `e?.message` on `{}` in its catch (setlists 651).
  - `RawChartRow` missing `format`/`object_key`/`size_bytes`; `RawVersionRow` missing `metadata`; `RawSongRow` missing `source`/`year`/`license`/`license_confirmed`; `Song` missing `metadata`/`sizeBytes`/`isPdf`(check) (songs 199, 207, 227–259, 243, 683, 692, 788–789).
  - `SongInput` missing `pdfFile`/`meta` (songs 370); `songPatch` literal `{ created_by, title }` too narrow for artist/genre/year/source/license/license_confirmed (songs 401–405); `song` param implicit any in a callback (songs 309); `pdfSize` `number | undefined` where `number` required (songs 391).

## Scope

- `src/lib/songs.js`, `src/lib/setlists.js` — typedef extension + missing JSDoc only.
- Out of scope (do NOT touch): behavior, migrations, UI, docs, features/; do NOT flip `checkJs` globally in tsconfig; do NOT add `// @ts-check` to other libs (baseline contract: per-file opt-in, later pass).

## Constraints

- JSX/no TS syntax — JSDoc only, matching baseline style (see `transpose.js` typedef blocks; `/** @type {…} */` casts where a literal needs width, e.g. `flattenSetlist` fallback pattern at setlists 277).
- Lint must stay 0 warnings; build green; `pnpm typecheck` → 0 errors.
- Conventional commits, English, no attribution. No new dependencies.

## Acceptance criteria

1. `pnpm typecheck` exits 0 at slice head (and at each work-unit commit).
2. `pnpm lint` 0 warnings; `pnpm build` green.
3. Typedefs extended honestly (row/columns match `docs/database-schema-v2.md` + migrations 0024–0028 for `setlist_items.midi_program`, `songs.year/license/license_confirmed/source`, `song_versions.metadata`), no `any`-widening beyond baseline style.
4. Behavior unchanged (existing node-level checks: `git diff` shows JSDoc-only changes).

## Tasks

- [x] T1 extend setlists typedefs + setMidiProgram JSDoc (midiPrograms, midi_program, @param tags, catch cast) — `efb7eba`
- [x] T2 extend songs typedefs (chart/version/song rows, Song/SongInput, songPatch, callback+pdfSize) — `2637b5f`
- [x] T3 final checks: typecheck 0 + lint 0 + build green; PR prepared (stacked, no labels)

## Completion record (2026-09-24, orchestrator)

Branch `feat/hito5-typecheck-baseline` @ `2637b5f`, from stack head `2f97e9b` (feat/hito5-external-integrations).

Commits (work-unit, conventional, English):

| Task | Commit | Message |
|------|--------|---------|
| T1 | `efb7eba` | chore(lib): extend setlist type baseline for midi programs (midi_program, midiPrograms) |
| T2 | `2637b5f` | chore(lib): extend song type baseline for import metadata and pdf charts |

Verification evidence:

- `pnpm typecheck`: **53 errors → 0** (13 setlists + 40 songs before; 0 after both commits). Re-run by orchestrator at slice head: 0 errors.
- `pnpm lint`: 0 warnings (writer + orchestrator re-run). `pnpm build`: green (`✓ built in 2.08s`).
- Diff vs base `2f97e9b`: 2 files, +91 / −8 lines — JSDoc/typedef only. Orchestrator reviewed every non-comment diff line: no behavior changes (`pdfSize ?? 0` preserves behavior; catch `/** @type {Error} */` cast is type-only; songPatch/verPatch widening casts).
- Typedefs honest per migrations 0001/0024/0027/0028: `midi_program` 0–127 null; `songs.year` null; `license` vocabulary `'public-domain' | 'CC-BY-4.0' | 'proprietary'`; `license_confirmed` bool; `song_versions.metadata` jsonb; `RawChartRow.format/'object_key'/'size_bytes'`.

PR: base `main`, stacked after #165, **no Closes #N** — repo uses Markdown issue templates (no YAML form), and issue-creation contract forbids automated creation outside YAML forms; CI (`ci.yml`) does not enforce issue linkage (lint+build only). No labels (chain pattern). ~91 insertion lines — well under 400, no size:exception needed.

## Merge record (2026-09-25, user decision: "merge")

Chain merged in stack order via merge commits, main → `8b66394`:

| PR | Merge commit |
|----|--------------|
| #147 feat/hito5-substitutions | `de6ddaf` |
| #148 feat/hito5-midi | `c96b9ba` |
| #155 feat/hito5-obs | `9891445` |
| #156 feat/hito5-spotify-enrichment | `066e81d` |
| #159 feat/hito5-pdf-scan | `c40bbb1` |
| #165 feat/hito5-external-integrations | `24bfedb` |
| #166 feat/hito5-typecheck-baseline | `8b66394` |

Post-merge verification (orchestrator): `git diff origin/main feat/hito5-typecheck-baseline --stat` → empty (trees identical, merge commits don't change content); `pnpm typecheck` → 0 errors; `pnpm lint` → 0 warnings; `pnpm build` → green at `main` (= 8b66394). **Hito 5 chain complete on main.**

## Verification

- `pnpm typecheck` → 0 errors (authoritative).
- `pnpm lint` → 0 warnings. `pnpm build` → green.
- Commit(s): conventional, English; `git show --stat` per commit.