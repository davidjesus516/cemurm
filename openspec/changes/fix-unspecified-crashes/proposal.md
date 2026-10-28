# Proposal: Unspecified invalid input produces garbage chords or an uncaught exception

> Change: `fix-unspecified-crashes`
> Findings: **3 of the 7** unspecified "sharp edges" (`odd/tasks/music-theory-discrepancies.md:61-66`).
> That list is **unlettered** — the A–J lettering covers the 10 discrepancies, not these seven.
> Status: proposed. All three reproduced. **No product decision and no feature-file change**: each
> input is invalid under any reading, so no Gherkin could have specified it. A **fourth** claim in
> the same list is **refuted** below.
>
> **Path note:** `main` has `src/lib/transpose.js`, `src/lib/setlistCollab.js` and
> `src/lib/readiness.js`; after M0a they become `src/domain/music/transpose.js`,
> `src/domain/setlist/collab.js` and `src/domain/chart/readiness.js`
> (`odd/tasks/music-theory-discrepancies.md:178-185`). Every test path below is **confirmed at
> apply time** — no `src/domain/` and no test file exists on `main`, because the suite arrives with
> M0b (#171).

## Intent

Three inputs that no feature file describes, and that no reading of the product makes valid, reach
pure helpers that assume their caller already guaranteed the input. Two throw; the third emits a chord.

## Problem

All three were reproduced by execution against the modules on `main`.

### 1. A fractional semitone count emits the literal chord `"undefined"`

```
transposeChord('C', 2.5) → "undefined"
```

**It does not throw, and that is the point.** `transposeChord` (`src/lib/transpose.js:89-94`)
delegates to `transposeNote`, whose `:73` computes `(0 + 2.5 % 12 + 12) % 12` = `2.5`, so
`NOTES_SHARP[2.5]` at `:75` is `undefined` and the concatenation at `:93` produces the **string**.
The musician's screen shows a chord named `undefined`.

Reachability, checked rather than assumed: `user_preferences.transpose_offset` is a `smallint`
(`supabase/migrations/0004_gig_and_preferences_rls.sql:249`) and cannot be fractional, but the
per-song `overrides` live in the `preferences` **jsonb** column (`:251`), which accepts `2.5`, and
`initialSemitones` (`transpose.js:165-167`) applies `Number(...)` without flooring. No client
writes `overrides` (`src/lib/preferences.js:4` calls that slice read-only), so the write path is
**confirmed at apply time** — and the input is invalid under any reading either way.

### 2. `reconcileSetlistOp(null, {})` throws

```
reconcileSetlistOp(null, {}) → THROW: Cannot read properties of null (reading 'args')
```

`src/lib/setlistCollab.js:118-119` optional-chains the third argument slot and never guards `op`:

```js
export function reconcileSetlistOp(op, server) {   // :118
  const songId = op.args?.[2]                      // :119
```

`op.args?.` cannot help when `op` is null — the read that throws is the one on line 119. Verified
sites: the definition at `:118`, the import at `src/lib/offlineSync.js:15`, the single production
call at `offlineSync.js:111`, plus the module's own demo assertions at `setlistCollab.js:201-208`.
Further sites, if any, are **confirmed at apply time**.

### 3. `computeReadiness` throws on a truthy non-string key

```
computeReadiness({key: 1, body: 'C'}) → THROW: song.key.trim is not a function
```

`src/lib/readiness.js:23` gates on truthiness and then calls a string method, and `1` is truthy:

```js
if (!song || !song.key || !song.key.trim()) {   // :23
```

Nine call sites verified by search, all passing a `key` read from a database row:
`src/pages/Songs.jsx:311`, `src/pages/SongDetail.jsx:729`, `src/lib/importers/queue.js:224`, and
`src/lib/songs.js:244`, `:437`, `:438`, `:574`, `:705`, `:860`. One non-string row takes the whole
list down, and the page-level `computeReadiness(song).reason` has no error boundary around it.

### 4. The `buildSubstitutionMap` claim is refuted, not deferred

The same list also claimed: *"`buildSubstitutionMap` creates a key for an `undefined` value,
defeating `applySubstitution`'s own `Object.keys().length` guard."* **It is false.**
`src/lib/annotations.js:55-64` filters on `kind` at `:59` and on the anchor's truthiness at `:61`
(`if (anchor) map[anchor] = a.value`). Executed against seven malformed shapes — the labels are
the probe's own, not the repository's:

```
anchor:undefined        → claves: []
anchor:null             → claves: []
anchor:{chord:null}     → claves: []
anchor:{chord:""}       → claves: []
anchor:{chord:0}        → claves: []
anchor:42 (número)      → claves: []
anchor:"Bb" (legítimo)  → claves: ["Bb"]
```

Six malformed shapes create **no key**, so `Object.keys(map).length` is `0` and the guard at
`annotations.js:83` fires as intended. The control case matters as much: with a legitimate anchor
the map is `["Bm"]` and `applySubstitution('Bm', 0, map, 'C')` returns `"Dmaj7"` — the guard is
live, not inert, never defeated. This is the **fourth** of the seven claims in that list and it
does not survive execution; a refuted finding recorded as confirmed is worse than an unrecorded one.

## Scope

### In scope

- The three defects, fixed at the narrowest point each: reject or clamp at the helper's own
  boundary, not at the nine (or one) call sites.
- **A failing-first test per fix.** No existing test covers any of these inputs, so there is no
  assertion to invert — the test is the deliverable and it must be red before the fix.
- The refutation in §4, recorded so it is not re-raised as a finding later.

### Out of scope

- **`fix-unspecified-silent-wrong`**, the sibling split of the same list: those inputs are *plausibly
  valid* and need a product decision, these are invalid under every reading.
- **`fix-reconcile-silent-drop`**, which rewrites `reconcileSetlistOp` — the same function as
  defect 2. The guard lands here; the replay semantics land there.
- Every other `annotations.js` concern, and whether readiness is per song or per version
  (`fix-readiness-lifecycle`'s open decision — this change touches the guard and nothing else).

## Capabilities

### New capabilities

None.

### Modified capabilities

- `music-theory` (new capability spec — the repository has no `openspec/specs/music-theory/` today;
  `fix-key-spelling-preference` and `fix-parser-sectional-key` also create it, so **one** owns the
  file and this appends the invalid-input requirements only. Owner settled at apply time.)
- `offline-edit-conflict-policy` (new capability spec — none today; `fix-reconcile-silent-drop`
  creates it for the replay semantics, this appends the malformed-op guard only.)
- `song-lifecycle` (new capability spec — none today; `fix-readiness-lifecycle` creates it, this
  appends the non-string-key guard and touches no lifecycle rule.)

## Approach

One rule: **each fix rejects the invalid input at the function that receives it**, so the nine
readiness call sites and the drain loop need no change and no caller audit.

- Fractional `semitones` → `transposeNote` refuses it. A fractional semitone is not a near-miss, it
  is a type error, and `"undefined"` is worse than an exception because it is invisible.
- Null `op` → `reconcileSetlistOp` returns `{ drop: true, notice: true, reason: 'malformed' }`
  instead of throwing. This module's contract is that the drain loop always gets a decision back
  (`:114-117`), and the shape is the one `fix-reconcile-silent-drop` introduces for the
  *unidentifiable* op. The two reasons must stay distinct.
- Non-string `song.key` → `readiness.js:23` type-checks before `.trim()`. A readiness function that
  throws is unusable for a list view.

**No Gherkin is added or edited**, and that is why this change can go first: every input here is
invalid under any reading, so there is no scenario to write and none to amend. The gap is in the
code, not the spec.

**Sequencing.** No fix may be implemented until M0b (#171) merges. The characterization suite is
this repository's only regression net, and all three functions are reached transitively through
pages and the drain loop. The three fixes share no decision, so they may ship together; past 400
changed lines they become chained `-prN-` slices, defect 2 first because it alone changes a public
return value.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/transpose.js` | Modified | `:73` fractional index, `:75` the `undefined` table read, `:93` the concatenation |
| `src/lib/setlistCollab.js` | Modified | `:118-119` — guard `op`, return a decision instead of throwing |
| `src/lib/readiness.js` | Modified | `:23` — type guard before `.trim()` |
| `src/lib/annotations.js` | Unchanged | the `buildSubstitutionMap` guard is **refuted as defective**; nothing to change |
| `songs.js`, `Songs.jsx`, `SongDetail.jsx`, `importers/queue.js` | Unchanged | the 9 verified call sites; the fix is upstream of all of them |
| `src/domain/music/transpose.test.js`, `src/domain/setlist/collab.test.js`, `src/domain/chart/readiness.test.js` | New / Modified | one failing-first test each — all three **confirmed at apply time**; `collab.test.js` is the file `fix-reconcile-silent-drop` also touches |
| the three `openspec/specs/` files above | Modified | invalid-input and guard requirements appended to specs siblings create |

No feature file is touched. No schema, no migration, no persisted state.

## Verification

- `pnpm test` — the three named test files are the gate. Each new test **must be red before its
  fix**: `transposeChord('C', 2.5)` must not return `"undefined"`, `reconcileSetlistOp(null, {})`
  must not throw, `computeReadiness({key: 1, …})` must not throw. Green without that evidence means
  the tests were written after the fix and prove nothing.
- `pnpm typecheck && pnpm lint && pnpm build`. Typecheck is **not in CI** (`AGENTS.md`) — run it
  locally and do not present a green CI as covering it.
- Manual for defect 1 only, because a unit test cannot see the string: drive the stage transpose on
  a chart and confirm no chord renders as `undefined`. Defects 2 and 3 are fully proven by unit
  tests.

## Rollback

Three pure-function guards, three test files, three appended spec requirements. No feature file, no
schema, no migration, no persisted state. Reverting restores the current behaviour exactly,
including the two throws.

## Frozen decisions

1. **The Gherkin is not edited to match the code.** No feature file is touched by this change and
   none will be: these inputs are invalid under any reading, so there is no scenario to write.
2. **A bug-pinning assertion inverts rather than gets deleted.** These three tests are new rather
   than inverted, because nothing pins the behaviour today. Where a fix here does invert an
   existing assertion, it changes to assert the spec; rewriting one to accept anything is the
   failure mode the delivery agreement forbids.
3. **Nothing lands before M0b (#171).** The characterization suite is the only regression net this
   repository has, and all three functions are reached transitively by it.
4. **The `buildSubstitutionMap` claim is refuted, not deferred.** The guard at
   `annotations.js:59-61` is present and correct, verified against seven shapes. It is **not**
   written into any spec as a requirement and **not** re-opened as work.
5. **Not merged with `fix-unspecified-silent-wrong`,** the sibling half of the same list. The split
   is *whether a product decision is required*, not whether something crashes.
6. **Not merged with `fix-reconcile-silent-drop`,** which rewrites the same function. The null guard
   lands here; the replay semantics — including the `reason` vocabulary this reuses — land there.
