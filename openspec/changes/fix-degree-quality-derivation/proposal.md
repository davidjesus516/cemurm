# Proposal: Degree quality must derive from the scale, and an explicit chord must win

> Change: `fix-degree-quality-derivation`
> Finding: **E** of the 10 discrepancies (`odd/tasks/music-theory-discrepancies.md`)
> Status: proposed. Reproduced by execution, exhaustively. **No open product decision** — both
> halves are already stated in the Gherkin.
>
> **Path note:** on `main` today the file is `src/lib/degreeResolver.js`; after M0a it becomes
> `src/domain/music/degreeResolver.js`. The bug-pinning assertion lives in the matching
> `src/domain/music/degreeResolver.test.js` — that path follows the suite's convention (source
> basename + `.test.js`, as in `transpose.test.js` and `parser.test.js`) and is confirmed against
> the suite at apply time, because M0b (#171) has not landed and the file does not exist on
> `main` today.

## Intent

`features/music-theory.feature:72` requires that *"Degree quality derives from the scale"* — a
chart in E Phrygian stored as `Em - F - D` renders its tonic as `i`, not `I`. `:79` requires
that *"Musician override wins over derived quality"* — the same key with `E7` renders `I7`, the
stored chord is kept, and *"no later recomputation replaces the stored chord"*.

`qualityForDegree` returns `'power'` for every degree of every scale. Both scenarios fail, and
not because the algorithm is debatable: **the function is inert.**

## Problem

Its comment at `:75` claims to *"Build the triad on this degree: root, third, fifth"*, and then
indexes adjacent scale steps.

```js
// src/lib/degreeResolver.js:76-80
const root     = intervals[degree - 1]
const thirdIdx = degree + 1 <= len ? degree + 1 : degree + 1 - len
const fifthIdx = degree + 2 <= len ? degree + 2 : degree + 2 - len
const third    = intervals[thirdIdx - 1]
const fifth    = intervals[fifthIdx - 1]
```

`thirdIdx = degree + 1` and `fifthIdx = degree + 2` read the **next two scale steps**, not the
third and fifth **scale degrees** — an off-by-two index error. Consecutive steps in a heptatonic
scale essentially never produce a perfect fifth, so the classifier at `:86-97` never fires and
control reaches the `return 'power'` at `:99`.

**Verified by execution.** The body was transcribed verbatim and compared against correct
tertian stacking (scale degrees 1, 3, 5) across seven heptatonic scales, 49 cases. Each cell is
`actual → expected`:

| Scale | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| major | power→major | power→minor | power→minor | power→major | power→major | power→minor | power→diminished |
| natural minor | power→minor | power→diminished | power→major | power→minor | power→minor | power→major | power→major |
| harmonic minor | power→minor | power→diminished | power→augmented | power→minor | power→major | power→major | power→diminished |
| Phrygian | power→minor | power→major | power→major | power→minor | power→diminished | power→major | power→minor |
| Dorian | power→minor | power→minor | power→major | power→major | power→major | power→diminished | power→major |
| Lydian | power→major | power→major | power→minor | power→diminished | power→major | power→minor | power→minor |
| Mixolydian | power→major | power→minor | power→diminished | power→major | power→minor | power→minor | power→major |

```
overall agreement: 0/49
```

Zero out of 49 — no degree, no scale, including C major. `formatRomanNumeral` at `:127-128` maps
`'power'` to the capital major numeral, so **every modal degree renders as if the song were in a
major scale.** For the Gherkin's own case, E Phrygian degree 1: actual `power` → renders `"I"`;
`feature:76` requires `"i"`.

**The override is structurally impossible today.** `resolveDegreeInfo` (`:183-203`) calls
`extractRoot(concreteChord)` at `:193` for the root, then `qualityForDegree` at `:199`.
`extractRoot` at `:32-35` is `/^([A-G][#b]?)/` — it captures the root and **discards everything
after it**. The chord's own suffix (`7`, `m`, `maj7`, `dim`) is never parsed, so an explicit `E7`
and a bare `E` are indistinguishable to this function. `resolveDegree` at `:175` has the same
shape. No repair to `qualityForDegree` can make `feature:79` pass; this is the same finding's
second half, and the proposal covers both.

## Scope

### In scope

- `qualityForDegree` (`:68-100`): the index arithmetic and the classification. The `len < 7`
  early return at `:73` is **not** in scope — see Out of scope.
- Chord-suffix parsing, so an explicit quality is readable, and the override in
  `resolveDegreeInfo` and `resolveDegree`.
- The bug-pinning assertions in `src/domain/music/degreeResolver.test.js`. A real fix **inverts**
  them. Also: what happens when a chord's suffix is absent or unparseable.
- Delta spec for the `music-theory` capability, degree-quality requirements only, traced to
  `features/music-theory.feature:72` and `:79`.

### Out of scope

- **The `len < 7` → `'power'` early return at `:73`.** A deliberate documented choice (`:72`,
  and the docstring at `:65-66`); it is not part of this finding and does not change.
- `findScaleByName`'s catalog fetch and the graceful `null` return when no scale is found. Both
  work as designed and neither is implicated.
- Findings A, B, C, D, F, G, H, I, J.
- The stored chart content, which `feature:62` makes canonical while `:63` makes the degree view
  derived — it must stay derived. The resolver's consumers are updated as call sites.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `music-theory` (new capability spec — the repository has no `openspec/specs/music-theory/`
  today, so this change creates it, with the degree-quality requirements only.)

## Approach

The decision is settled by the Gherkin: **quality derives from the scale, and an explicit chord
quality overrides it.** What follows is only *how*.

**1. The triad, correctly stacked.** Scale degrees 1, 3, 5, wrapping on the length:
`at(d) = intervals[((d - 1) % len + len) % len]`, giving `root = at(degree)`, `third =
at(degree + 2)`, `fifth = at(degree + 4)`. Then classify the resulting intervals exactly as `:82-97` already does — M3+P5 major, m3+P5
minor, m3+d5 diminished, M3+A5 augmented — falling back to `'power'` otherwise. The classifier
is fine; only its inputs are wrong. The wrap must be index-based rather than the two conditional
subtractions at `:77-78`, which are correct only for offsets of 1 and 2 and do not generalise
to 2 and 4.

**2. The override, and the shape that makes it observable.** Parse the suffix `extractRoot`
throws away, in one place beside it: `parseChord('E7') → { root: 'E', quality: 'dominant7' }`.
`resolveDegreeInfo` then compares — if the chart explicitly wrote a quality, that quality wins
and the derived one is recorded alongside it. The returned object at `:202` is the right place,
and a `derived` field next to `quality` is what lets the UI, or a test, see that the scale would
have said `minor` while the stored chord says `dominant7`. **Without that field the override is
unobservable and `feature:85` has nothing to assert against.**

**3. Sevenths in the numeral, and unknown suffixes.** `formatRomanNumeral`'s docstring at `:111`
promises that sevenths get `'7'` appended, but `:118-131` has no branch that does it and
`feature:83` requires `I7` — the switch is the honest place for it, since the quality is known
there by then. An unparseable suffix is neither silent nor fatal: fall back to the derived
quality and mark it `derived: true`, because a chord the parser half-understands must not discard
the musician's intent and must not throw either.

**Scenarios to add**, in the degree section: each degree of C major, E Phrygian, A natural minor
and E harmonic minor rendered with the quality the scale implies — the table above, as Gherkin;
E Phrygian `Em` → `i` (`feature:76`, fails today) and a bare `E` in the same key → `i`, proving
the bare chord reads the scale; E Phrygian `E7` → `I7` with the stored chord unchanged (`:83`,
`:85`), which **cannot pass until the suffix is parsed**; and a pentatonic key still rendering
`power`, pinning the deliberate `:73` early return.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/degreeResolver.js` | Modified | index arithmetic at `:77-80`; suffix parsing beside `extractRoot` (`:32-35`); `resolveDegree` (`:175`) and `resolveDegreeInfo` (`:199`); the `derived` field on `:202`; the seventh branch in `formatRomanNumeral` |
| `src/domain/music/degreeResolver.test.js` | Modified | the characterization suite pins `'power'` for every degree on purpose; a real fix **inverts** it |
| `features/music-theory.feature` | Modified | the new degree-quality scenarios |
| `openspec/specs/music-theory/spec.md` | New | capability spec, degree-quality requirements only |
| `src/domain/chart/parser.js` | Read | supplies `concreteChord`; unchanged, but the coupling is confirmed at apply time |

## Verification

- `pnpm test` — `degreeResolver.test.js` is the gate. **Every assertion that currently expects
  `'power'` for a heptatonic scale inverts**, and that diff is the evidence. A green run with the
  old expectations still in place would mean the fix did nothing.
- `pnpm typecheck && pnpm lint && pnpm build`. Manual: a modal chart with the numerals column
  visible, then the same chart with its tonic rewritten `E` → `E7`. The numeral must follow the
  chart, and the concrete line must not change.
- **No finding may be implemented until M0b (#171) merges.** The 293-test characterization suite
  is this repository's only regression net, and this change rewrites assertions in it wholesale.
  Nothing can catch an unintended change until the suite is on `main`.

## Rollback

One module, one test file, one feature file, one new spec. No schema, no migration, no persisted
state — the degree view is derived and the stored chart is never rewritten. Reverting restores
the current behaviour exactly, which means it restores the bug; that is the honest cost of
reverting this one.

## Frozen decisions

1. **The Gherkin is not edited to match the code.** `features/music-theory.feature:72` and `:79`
   are the product source of truth, and this change conforms to them.
2. **The bug-pinning assertions invert; they do not get deleted.** The `'power'` expectations are
   the artifacts that made this finding reproducible, and a fix that leaves them green proves
   nothing. Editing them to accept anything is the failure mode the delivery agreement forbids.
3. **The `len < 7` → `'power'` early return at `:73` is out of scope.** It is a deliberate,
   documented choice about non-heptatonic scales, not part of this finding. It gets pinned by a
   new scenario and left alone.
4. **Both halves ship in one change.** The derived-quality fix and the override fix are one
   finding: `feature:79` cannot pass while the suffix is discarded, and shipping only the
   arithmetic fix would produce a confidently wrong `I` where the chart says `E7`. Relatedly, an
   explicit quality wins *and* the derived quality is still returned — overriding silently would
   make the spec's two scenarios indistinguishable in the output.
5. **Not merged with finding A.** Both touch `music-theory` and both are about a derived view, but
   A is a parser branch that never runs and this is an index error. Different modules, different
   PRs.
