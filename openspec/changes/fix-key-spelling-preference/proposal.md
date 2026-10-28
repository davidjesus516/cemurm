# Proposal: Rendered chord spelling must follow the key's own spelling

> Change: `fix-key-spelling-preference`
> Finding: **B** of the 10 discrepancies (`odd/tasks/music-theory-discrepancies.md`)
> Status: proposed. Reproduced by execution. **No open product decision** — the rule is already
> in the Gherkin; only the implementation is missing.
>
> **Path note:** on `main` today the file is `src/lib/transpose.js`; after M0a it becomes
> `src/domain/music/transpose.js`. The bug-pinning assertion is
> `src/domain/music/transpose.test.js:44` (`odd/tasks/music-theory-discrepancies.md:163`).
> Neither that test file nor `src/domain/` exists on `main` — the suite arrives with M0b (#171).

## Intent

A chart written in one spelling renders in that spelling throughout.
`features/music-theory.feature:149` requires the tonic to render as the key's own name (*"Then
the tonic renders as Gb, not F#"*), `:155` requires transposition to keep the target key's
spelling, and `:159` requires that *"the app does not mix sharp and flat spellings in the same
section"*.

Today the spelling is chosen by a hardcoded list of six major key names. A chart in C♭ major —
the flattest major key there is — renders entirely in sharps.

## Problem

Six memorized names stand in for a rule the Gherkin already states.

```js
// src/lib/transpose.js:46
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'])

// :134-136 — the exported decision, used for a whole section
export function preferFlatForKey(key) {
  return FLAT_KEYS.has(String(key || '').split(/\s+/)[0])
}

// :179 — the same set, consulted once for the section-wide flag
const preferFlat = FLAT_KEYS.has(parsed.key?.split(/\s+/)[0])
```

**1. C♭ major renders in sharps.** `:149` names this case in general and `:153` requires
*"every resolved chord uses flats consistent with the Gb key signature"*. Neither holds.

```
preferFlatForKey("Cb major")            = sharp    <- should be flat
transposeParsed({key:'Cb major', … B …}) = "B"         <- should be "Cb"
```

**2. The answer depends on whitespace, not on music.**

| Key written | Chosen | Same key, compact | Chosen |
|---|---|---|---|
| `F minor` | flat | `Fm` | sharp |
| `Bb minor` | flat | `Bbm` | sharp |
| `Eb minor` | flat | `Ebm` | sharp |
| `C minor` | sharp | `Cm` | sharp |
| `Cb major` | sharp | `Cbm` | sharp |

The set holds `"F","Bb","Eb","Ab","Db","Gb"` and not `"Fm","Bbm","Ebm"` — while the compact
spelling is explicitly supported, per `transposeKey`'s own docstring at `:105`: *"Handle "Am",
"Bbm" — note + modifier without space"*. A key the module claims to accept yields the opposite
answer from the same key written the long way.

**3. Secondary: `transposeKey` discards the mode.** At `:110` the flatness of the *transposed*
note name is looked up in `FLAT_KEYS`, while `m[2]` — the modifier, `major` or `m` — is appended
to the result and never consulted, so the mode is structurally invisible there and C major
cannot be told from C minor. A structural fact, read off the source; whether it changes any
rendered output is for apply time to confirm.

**What point 3 is not.** It is tempting to illustrate it with an enharmonic transposition, and
the first candidate is not one: `transposeKey("C", -2) === "A#"` is **correct**, because the rule
below reads the target key and A♯ minor is a real key name. That was measured and withdrawn
here for the same reason the 34-combination count was — see Frozen decisions 4. The mode defect
stands on its own, or not at all.

**Why it survived.** The two Gherkin scenarios exercise `Gb major` (`:150`) and `F# major`
(`:157`). Both names are in the six-element set, so both pass. The spec's rule is right; the
implementation satisfies only the two cases the spec happens to name.

## Scope

### In scope

- `preferFlatForKey` and the section-wide `preferFlat` in `transposeParsed`: one rule, both sites.
- `FLAT_KEYS` itself, which the new rule deletes, and `transposeKey`'s decision at `:110`,
  including whether the mode must be read.
- The bug-pinning assertion at `src/domain/music/transpose.test.js:44`. A real fix **inverts** it.
- Delta spec for the `music-theory` capability, spelling requirements only, traced to
  `features/music-theory.feature:149`, `:155` and `:159`.

### Out of scope

- Findings A, C, D, E, F, G, H, I, J.
- **Finding I** specifically: `src/lib/spotify.js` has its own sharp-only table, and its proposal
  keeps its own spelling rule so neither change hard-codes the other's preference.
- The *stored* chart content, which `feature:62` makes canonical and which a display decision must
  never rewrite. ChordPro parsing and the `annotations.js` reverse lookups are call sites.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `music-theory` (new capability spec — the repository has no `openspec/specs/music-theory/`
  today, so this change creates it, with the spelling requirements only. The other scenarios in
  the feature file stay unwritten until their own changes land.)

## Approach

The decision is settled by the Gherkin: **the spelling of a target key is decided by the key's
own spelling.** What follows is only *how*.

**The rule, covering all 15 conventional keys and both spellings.** `preferFlat` is true when
the tonic carries a flat accidental (`Bb`, `Eb`, `Ab`, `Db`, `Gb`, `Cb`); **or** the tonic is
`F`, which is one flat major and three flats minor; **or** the tonic is `C` **and** the mode is
minor. Otherwise sharp. Three predicates replace the set, and failure 1 falls out of rule 1 for
free. Rules 2 and 3 are needed because F and C minor are the two cases where the tonic's own
spelling does not carry its signature's accidentals, so they must be named, not derived.

**How the mode is read.** Rule 3 needs it, which is why the two sites drift — each splits on
whitespace by hand. One shared helper returning `{ index, preferFlat }` for a key string, the
shape `noteIndex` already returns for a note at `:54`, keeps them from diverging again. The
docstring at `:128-130` already says `preferFlatForKey` exists to *"mirror transposeParsed's
check"*; that mirroring is exactly what fails.

**The thing not to do.** The rule reads the **target** key, not the source chord, and
`transposeChord` at `:89` already takes a `preferFlat` override for this. Do not make it "keep
the chord's own spelling": `feature:155` decides that case — C major transposed to F♯ major
renders `A#`, and that is correct.

**Scenarios to add**, under ENHARMONIC SPELLING: a C♭ major chart whose tonic renders `Cb` and
not `B#`; `Cbm` rendering identically to `Cb major`; an F minor chart rendering in flats, pinning
rule 2; a C minor chart rendering in flats, pinning rule 3; both spellings of one key yielding one
answer.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/transpose.js` | Modified | `FLAT_KEYS` deleted; `preferFlatForKey` (`:134`) and `transposeParsed` (`:179`) share one rule; `transposeKey` (`:110`) — the mode question is confirmed at apply time |
| `src/domain/music/transpose.test.js` | Modified | the characterization suite; `:44` pins the bug and a real fix **inverts** it |
| `src/lib/annotations.js` | Possibly | a `preferFlatForKey` consumer; call site only |
| `features/music-theory.feature` | Modified | the new spelling scenarios |
| `openspec/specs/music-theory/spec.md` | New | capability spec, spelling requirements only |

## Verification

- `pnpm test` — `transpose.test.js` is the gate. It pins the six-element set's behaviour on
  purpose, so **a real fix inverts those assertions rather than editing them to accept anything.**
  The diff in that file is the evidence; a green run with the old expectations still in place
  would mean the fix did nothing.
- `pnpm typecheck && pnpm lint && pnpm build`. Manual, and the only way to check what matters: a
  C♭ major chart and an F minor chart, transposed, every chord in a section inspected for a stray
  sharp. A unit test asserts the rule; a player asserts the page.
- **No finding may be implemented until M0b (#171) merges.** The characterization suite is this
  repository's only regression net, and this change rewrites an assertion inside it. Nothing can
  catch an unintended change until the suite is on `main`.

## Rollback

One module, one test file, one feature file, one new spec. No schema, no migration, no persisted
state — the spelling decision is display-side and the stored chart is never rewritten. Reverting
restores the current behaviour exactly. Low risk.

## Frozen decisions

1. **The Gherkin is not edited to match the code.** `features/music-theory.feature:149-159` is
   the product source of truth, and this change conforms to it.
2. **The bug-pinning assertion inverts; it does not get deleted.**
   `src/domain/music/transpose.test.js:44` is the artifact that made this reproducible. Rewriting
   it to accept anything is the failure mode the delivery agreement forbids.
3. **The rule is the key's own spelling, derived from the Gherkin — not chosen here.**
   `FLAT_KEYS` is deleted rather than extended; extending it leaves the whitespace defect in place
   and needs a new entry for every compact spelling of every flat key.
4. **The earlier claim of "34 failing key × semitone combinations" is withdrawn and is not a
   finding.** The Gherkin rule is that the spelling follows the **target** key, so cases like
   `F major +1 → F#` are correct and were never failures. The count measured the wrong thing, and
   a precise-looking number that does not is worse than no number. It appears in no scenario.
5. **Not merged with finding I**, whose sharp-only `spotify.js` table is a different function
   reading a provider index. One change with two consumers cannot be tested against one. The
   stored concrete chart is likewise never rewritten by this rule, per `feature:62`.
