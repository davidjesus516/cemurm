# Proposal: Plausibly valid input renders a silently wrong chord, and each case needs a decision

> Change: `fix-unspecified-silent-wrong`
> Findings: **3 of the 7** unspecified "sharp edges" (`odd/tasks/music-theory-discrepancies.md:61-66`).
> That list is **unlettered** — the A–J lettering covers the 10 discrepancies, not these seven.
> Status: **implemented.** All three reproduced; the three product decisions are recorded under
> **Frozen decisions** and were taken before any code was written. Finding **B** remains a
> declared dependency and is **not** folded in — see the note at the end.
>
> **Path note — confirmed at apply time.** Every `src/lib/…` path in this proposal was written
> before M0a and is now `src/domain/music/…`: `src/lib/transpose.js` → `src/domain/music/transpose.js`,
> `src/lib/annotations.js` → `src/domain/music/annotations.js`,
> `src/lib/chordpro/parser.js` → `src/domain/chart/parser.js`. The renderer is
> `src/ui/patterns/ChordProRenderer.jsx`. Line numbers below are the ones **as written against the
> pre-M0a tree** and are kept so the reasoning stays auditable; the code comments carry the current
> numbers. The suite is M0b's, so all test paths existed at apply time.

## Intent

Three inputs a musician can plausibly produce, where the app renders *something* and never says the
result is wrong. No feature file names any of them — and unlike the sibling
`fix-unspecified-crashes`, none can be fixed by reading the existing spec.

## Problem

### 1. A lowercase chord passes through untransposed

```
transposeChord('am', 3) → "am"
```

`CHORD_RE = /^([A-G][#b]?)(.*)/` at `src/lib/transpose.js:79` is **case-sensitive**. A lowercase
token does not match, `m` is `null`, and `:91` returns the input unchanged. This is a real input,
not a synthetic one: the ChordPro parser takes the chord token **verbatim**, with no case
normalisation and no validation (`src/lib/chordpro/parser.js:35`:
`line.slice(i + 1, end).trim()`), so a chart containing `[am]` survives parsing and renders
half-transposed:

```
parsed chords: ["am","G"]  →  transposed +3: ["am","A#"]
```

`am` stays put while its neighbour moves. The musician asked for +3 and got one chord out of two.

**The decision, taken.** A lowercase chord is plausibly valid — the parser accepts it, the musician
reads `am` as A minor, and ChordPro's own documentation defines the root as case-insensitive — so it
is **accepted and normalised in `transposeChord`**, not in the parser and not rejected.
Normalising in the parser is out for the reason given above: `features/music-theory.feature:62`
makes the stored chart content canonical and a display decision must never rewrite it.
Normalising at display time keeps storage verbatim and still renders `Cm`.

The consequence is stated rather than hidden: **the rendered chord uses the app's spelling from then
on.** `[am]` transposed −3 renders `F#m`, not `am`, because the token is normalised on the way out
and the app has no record of the original case. A round trip does not restore the author's casing.
That is the accepted cost of not rewriting stored content.

**A deliberate non-goal: lowercase is accepted for CHORDS, not for KEY tonics.** `transposeKey` keeps
an uppercase-only root. The text after a key's tonic is a *modifier* (`Am`, `Bbm`), so a
case-insensitive key root parses `atonal` as the note `a` plus the modifier `tonal` and transposes it
to the invented `Btonal`. A `{key: am}` in a chart is returned verbatim, exactly as before. This was
implemented, measured as a regression against `Am` and `Bbm`, and reverted for that reason — the
finding is about chord tokens in a body, which is what `CHORD_RE` covers.

### 2. The unicode flat is read as a modifier

```
transposeKey('B♭', 2)   → "C#♭"
transposeKey('B♭m', 2)  → "C#♭m"
transposeKey('Bbm', 2)  → "Cm"
```

The unicode flat `♭` (U+266D) is in neither `NOTES_SHARP` (`:42`) nor `NOTES_FLAT` (`:43`). The key
regex at `:106` is `^([A-G][#b]?)(.*)$`, so it matches `B` as the note and captures `♭` as the
**modifier** `m[2]`, which `:111` re-appends verbatim. The tonic is transposed and the accidental is
not — the same half-transposed shape as finding 1, and a worse one, because the result is not a
chord any musician would write.

**The decision, taken.** `♭` is not a keyboard typo — it is exactly what a paste from a web page or a
ChordPro file authored in a Unicode-flat tool produces — so it is **accepted**, and so is its
mirror `♯` (U+266F), which is the same one-character paste and the same defect in the other
direction. Both are folded into the regexes and normalised to their ASCII form **at render time**,
so stored text is untouched and only the rendered name is normalised.

Folding `♯` in alongside `♭` was a scope call made at apply time, not in this proposal: the
proposal's option 1 said "fold U+266D and U+266F", and implementing only the flat would have left
`transposeKey('C♯', 2) === 'D♯'` — a note name no musician writes, and the identical bug shape. The
test that pinned that broken answer is inverted, not deleted.

The same normalisation reaches `semitonesBetween`, which also matched only the letter: `B♭` to `D`
measured 3 semitones (the distance from B-natural) instead of 4, and `C♯` to `D` measured 2 instead
of 1. This is a **silent wrong number**, not a rendering artefact, so it is fixed here rather than
deferred.

### 3. The same substitution works or does nothing depending on the chart's key

```
applySubstitution('Bb', 0, map, 'C')  → "Bb"     ← nothing applied
applySubstitution('Bb', 0, map, 'Bb') → "A"      ← same substitution, different base key
```

`src/lib/annotations.js:82-89`, in full:

```js
export function applySubstitution(token, semitones, substitutions, baseKey) {
  if (!token || !substitutions || !Object.keys(substitutions).length) return token
  const preferFlat = preferFlatForKey(baseKey)
  const concrete = transposeChord(token, -semitones, preferFlat)
  const target = substitutions[concrete]
  return target ? transposeChord(target, semitones, preferFlat) : token
}
```

The lookup key is `concrete` — the rendered token **reverse-transposed using the base key's flat
preference**. So whether an anchor written `"Bb"` matches depends on whether the chart's key
happens to be a flat key. Traced:

```
preferFlatForKey('C')  = false
preferFlatForKey('Bb') = true
concrete on a C chart  = "A#"   → in map? false
concrete on a Bb chart = "Bb"   → in map? true
```

On a C-major chart the reverse transpose re-spells `Bb` as `A#`, the lookup misses, and `:87`
returns the token **unchanged and with no signal of any kind**. The musician's personal
substitution silently does nothing, and the only visible result is that their arrangement is
ignored. The module's own docstring at `:71-73` claims the opposite — *"Consistent flat preference
keeps Bb-chart round-trips enharmonically stable"* — true for flat charts, false for sharp ones.
`baseKey` reaches this function from the parsed chart key at three confirmed sites:
`src/components/notation/ChordProRenderer.jsx:40` (default `baseKey = ''` at `:66`, and
`preferFlatForKey('')` is `false`), fed by `src/pages/SongDetail.jsx:977`,
`src/pages/Practice.jsx:209` and `src/pages/SubstitutionAssignment.jsx:59`.

**Why the Gherkin never caught it.** Neither scenario that specifies this names a key.
`features/personal-preferences-and-adaptations.feature:189-195` gives `"Bm -> Dmaj7"` on
"Canción W" and requires *"the substitution moves correctly when Pedro transposes the song"*;
`features/substitutions-and-coverage.feature:67-71` gives the same substitution and requires *"his
view renders Dmaj7 where the chart says Bm"*. Neither states the song's key, so a C chart and a
B♭ chart are **equally conforming readings** — and the code picks between them through
`preferFlatForKey`. The requirement is specified; the spelling of the match is not.

**The decision, taken: option 1, look up both spellings.** The whole change is inside
`annotations.js`, no stored row is touched, and annotations written before the fix start working.
Options 2 and 3 are not taken: option 2 needs a migration for existing `personal_annotations` rows
and stops the stored anchor being what the musician typed; option 3 pushes a display concern into
stored content, which `features/music-theory.feature:62` forbids.

The tradeoff is accepted: two enharmonically equal anchors (`"Bb"` and `"A#"`) now both match, and
one wins. **`Object.keys` order is not the tie-break.** The order is explicit and fixed, and it is
the tie-break this change was required to state:

1. the **concrete** key — the derived spelling, reverse-transposed with the base key's preference
   (the existing lookup, unchanged, and the one every Gherkin-pinned scenario depends on);
2. the **alternate** enharmonic of that concrete key — the same reverse transpose with the opposite
   spelling preference;
3. the **anchor as the musician typed it**, for a whole number of semitones only.

A written spelling therefore can never override a derived one, so a deliberately-chosen enharmonic
spelling is not silently replaced by the module's preference. Only when neither derived spelling is
in the map does the typed anchor get a turn, and it is last.

**A third lookup was added at apply time, beyond this proposal's option 1.** Inverting the
characterization test surfaced a case the two derived lookups cannot cover: an anchor typed in the
**rendered** spelling, e.g. `{"Am": "G/B"}` against the chord `Am`. The derived name is `Gm`, so
both derived lookups miss, and the chord came back **untransposed** — the most expensive shape of
this defect, because the musician's substitution is ignored *and* the pitch is wrong. The typed
anchor covers it, and it is the same class of accommodation as the enharmonic retry: the anchor is
human-entered text, not something this module produced.

That third lookup is **gated on `Number.isInteger(semitones)`**, and the gate is load-bearing. A
fractional amount has no valid reverse transpose, so both derived spellings degenerate to the same
non-note; without the gate the typed anchor would match across two different key spaces and render
`'undefinedmaj7'`. With the gate, a fractional amount matches nothing and the chord passes through —
the pre-existing behaviour, which `fix-unspecified-crashes` (#223) is changing independently. **This
PR and #223 both touch that assertion; whichever lands second needs the other.**

**Three Gherkin-pinned scenarios were verified byte-identical before and after**, which is the
evidence that widening the lookup did not weaken the specified contract:
`applySubstitution('Bm', 0, {Bm:'Dmaj7'}, 'C')` → `"Dmaj7"`,
`applySubstitution('Am', 2, {Gm:'G/B'}, 'C')` → `"A/B"`, and
`applySubstitution('B', 1, {Bb:'C'}, 'Bb')` → `"Db"`.

**Dependency on finding B — and it is a real one.** `preferFlatForKey`
(`src/domain/music/transpose.js`) is the exact function `fix-key-spelling-preference` (#219) is
about, and B's rule — derive flatness from the key's own spelling instead of `FLAT_KEYS`' six
hardcoded names — is a **prerequisite** for a durable fix here: while `preferFlatForKey('Cb')` is
`false`, a C-flat chart reverse-transposes sharp-spelled and reproduces this same silent miss for
the flattest major key there is. B is **not** folded in — different function, different call sites,
and a change with two rules cannot be tested against one feature file.

**What this PR does and does not buy, stated plainly.** The lookup change repairs the reported
behaviour for C-major and every other sharp-spelled chart, with or without B. The **C-flat edge
stays open until B lands**, and this PR does not claim to close it. B is also **not sufficient** on
its own: for a C-major chart `preferFlatForKey('C')` is `false` before and after, so B alone leaves
`applySubstitution('Bb', 0, map, 'C')` returning `"Bb"` identically once it lands. B is necessary for
full coverage; the lookup change is what actually fixes the reported behaviour.

## Scope

### In scope

- The three defects, each gated on the decision that change records, and the decisions themselves
  written into Frozen decisions **once the maintainer makes them** — not assumed by the implementer.
- New Gherkin pinning the chosen answer for each, and the missing key in the two existing
  substitution scenarios.
- Delta specs for `music-theory` (case and unicode-accidental requirements) and
  `substitutions-and-coverage` (anchor matching, this change's own spec).

### Out of scope

- **Finding B itself** — `fix-key-spelling-preference`, referenced as a prerequisite, not
  implemented here. The substitution fix is only durable once B is in.
- **`fix-unspecified-crashes`**, the sibling half of the same list: those inputs are invalid under
  every reading. Different question, one PR each.
- The `buildSubstitutionMap` guard. It was claimed to be defeated and that claim is **refuted**
  there, against seven malformed shapes; there is nothing to fix in `annotations.js:55-64`.
- Findings A, C, D, E, F, G, H, I, J, and `src/lib/spotify.js`'s own key table, which keeps its
  own spelling rule so neither change hard-codes the other's preference.
- Stored chart content, which `features/music-theory.feature:62` makes canonical — the reason
  option 3 is out of scope rather than deprioritised. A migration for existing
  `personal_annotations` rows, unless option 2 is the one taken.
## Capabilities

### New capabilities

None.

### Modified capabilities

- `substitutions-and-coverage` (new capability spec — the repository has no
  `openspec/specs/substitutions-and-coverage/` today, so **this change creates it**. Its entire
  content is the anchor-matching requirement, which is what finding 3 leaves unspecified.)
- `music-theory` (new capability spec — the repository has no `openspec/specs/music-theory/` today,
  so **this change creates it**.)

**The ownership hazard did not materialise, and that is verified, not assumed.** This proposal
predicted that `fix-key-spelling-preference` (#219) and `fix-parser-sectional-key` (#218) would also
create `music-theory/spec.md` and that "one owns the file, the others append". At apply time **all 16
`fix/*` branches were checked and not one of them adds any file under `openspec/specs/`** — every one
of them carries the same nine specs `main` has. So this change owns both new files outright and the
append-order question does not arise. If a sibling later adds `music-theory/spec.md`, this is the merge
conflict to expect, and it is a text conflict in a new file, not a behavioural one.

## Approach

One principle across all three: **an input the product accepts must not produce output that is
wrong without saying so.**

- Findings 1 and 2 share a mechanism — a case-sensitive `[A-G]` and a table with no U+266D — so
  they are fixed together, while each keeps its own decision, because the answer for one does not
  imply the answer for the other.
- Finding 3 is not a validation bug and must not be fixed as one. A "did the substitution apply?"
  signal in the renderer hides the defect one layer up; the miss is in the **lookup key**, and the
  honest fix changes the key.
- Every scenario is written **after** its decision, and the two existing substitution scenarios
  gain the key they were missing. A spec that names the key would have caught this; a spec that
  names only the substitution cannot.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/domain/music/transpose.js` | Modified | `CHORD_RE` (case + both unicode accidentals + `Bes`), the new `normalizeRoot`, the key regex, and `semitonesBetween`'s regex |
| `src/domain/music/annotations.js` | Modified | `applySubstitution` — the single `concrete` lookup became a three-step, explicitly ordered lookup |
| `src/domain/music/transpose.test.js` | Modified | three bug-pinning assertions inverted, two added |
| `src/domain/music/annotations.test.js` | Modified | three bug-pinning assertions inverted, one named and held for #223 |
| `features/music-theory.feature` | Modified | +3 scenarios (656 → 659) |
| `src/domain/chart/parser.js` | Confirmed, unchanged | the token really is stored verbatim, which is what makes findings 1 and 2 reachable |
| `src/ui/patterns/ChordProRenderer.jsx` and the three `baseKey` callers | Confirmed, unchanged | they only pass `baseKey`; this change is display-side and needs no caller edit |

**Paths confirmed at apply time.** The `src/lib/…` paths this proposal was written against are all
post-M0a now: `src/lib/transpose.js` → `src/domain/music/transpose.js`, `src/lib/annotations.js` →
`src/domain/music/annotations.js`, `src/lib/chordpro/parser.js` → `src/domain/chart/parser.js`. The
render call sites named above were re-located and need no change, because every one of them only
supplies `baseKey`.

## Verification — actual results, not intentions

All four gates were run and all four exit 0. Nothing below is a plan.

| Gate | Result |
|---|---|
| `pnpm test` | **236 passed** (main: 235). 3 bug-pinning assertions inverted, 3 added. |
| `pnpm typecheck` | exit 0. It **caught a real error** during this work — `normalizeRoot` returns `string \| null` and two call sites passed it straight into `noteIndex`, which is what forced the explicit `baseRoot`/`targetRoot` guards in `semitonesBetween`. |
| `pnpm lint` | exit 0. |
| `pnpm build` | exit 0, 195 modules. |
| `checkJs` baseline | 48 files, unchanged from main — the baseline did not silently die. |

**The red-to-green evidence, which is the point.** Each of the three findings had a characterization
assertion pinning the *broken* answer, and each was inverted rather than deleted:

| Finding | Was pinned | Is now |
|---|---|---|
| 1. lowercase chord | `transposeChord('c', 1) === 'c'`, with the comment *"Lowercase is NOT supported: the root regex is `[A-G]` uppercase only"* — the regex had become the specification | `'C#'` |
| 2. unicode accidental | `transposeKey('B♭', 2) === 'C#♭'`, with the comment that the flat *"rides along in the suffix"* | `'C'` for `B♭`, `Bb` and `Bes`; `'D#'` for `C♯` |
| 3. flat anchor | `applySubstitution('Bb', 0, {Bb:'C'}, 'C') === 'Bb'` — the *miss* was the expectation, and the sibling assertion showed it applying in key `Bb` | `'C'` in both keys |

**Three of my own expectations were wrong and the suite caught all three.** `bm` +3 is `Dm` not
`C#m`; `F♯m` +2 is `G#m` not `Gm`; `semitonesBetween('C♯','D')` is 1 not 2. Each was my arithmetic,
not the module's, and each is now asserted at the value the module actually produces after checking
it is the musically correct one. **Five of my own wrong claims have now been caught by execution
across this work, which is the reason nothing above is stated without a number attached to it.**

**A correction to a claim made earlier in this work, and it matters for every future PR.**
`pnpm build` was described as "the only coverage of imports — prove it by breaking one on purpose".
That is **false**, and it was measured rather than argued:

- `pnpm build` with a deliberately broken import: prints
  `"transposeNOPE" is not exported by …` — and **exits 0**, still writing `dist/`. Rollup classifies
  it as a warning.
- `pnpm test` with the same break: exit 1 — but only **incidentally**, because the tests happen to
  exercise the functions whose imports went missing.
- `pnpm lint` with the same break: **exit 1**, `no-undef` naming every call site. This is the real
  import gate, and it comes from `eslint:recommended` rather than an explicit rule in the config.

So a green build proves nothing about imports, and a green CI run catches a broken import only
through lint or through incidental test coverage. **Lint is the gate to rely on.**

**Not verified, and stated as such.** No rendering claim here was checked in a browser: this is a
display-side change reached through `ChordProRenderer`, and the three scenarios added to the Gherkin
are specifications, not executed UI tests — there is no jsdom and no testing-library in this
repository, so **no `.feature` file is executed by any gate**. `features/*.feature` is product truth
that nothing runs. A reviewer should eyeball a chart containing `[am]`, a key of `B♭m`, and a
`"Bb" -> "C"` substitution on a C-major chart before merging.

## Rollback

Two modules, three pages that only pass `baseKey`, two feature files, one new spec, and — only if
option 2 is taken — a migration for existing annotation rows. Without that migration this is
display-side and fully revertible.

## Frozen decisions

1. **The Gherkin is not edited to match the code.**
   `personal-preferences-and-adaptations.feature:189-195` and
   `substitutions-and-coverage.feature:67-71` are conformed to, not weakened; the missing key is
   **added**, which can only make the requirement stricter.
2. **A bug-pinning assertion inverts rather than gets deleted.** The flat-key round trip pinned at
   `annotations.js:149` is the artifact that made finding 3 reproducible. A real fix changes it to
   assert the spec; rewriting it to accept anything is the failure mode the delivery agreement
   forbids.
3. **Nothing lands before M0b (#171).** The characterization suite is the only regression net this
   repository has, and the substitution fix rewrites an assertion inside it.
4. **All three decisions were taken before the code was written, and are recorded in the Problem
   section above.** Lowercase chords are accepted and normalised at render time. Both unicode
   accidentals are folded into the ASCII spelling at render time. The anchor lookup is a three-step
   ordered fallback. The order is the tie-break and it is explicit, so the enharmonic collision this
   change knowingly introduces has a defined winner rather than an `Object.keys` accident.
5. **A fourth lookup was added beyond what was decided, and it is declared rather than smuggled:**
   the anchor as the musician typed it, third in the order and gated on a whole number of
   semitones. It exists because inverting the characterization test surfaced a case the two derived
   spellings cannot reach, and it is the only change here that was **discovered by the test rather
   than predicted by the proposal**. It is the one a reviewer should scrutinise hardest.
6. **A lowercase KEY tonic is still not accepted, deliberately.** Extending it was implemented,
   measured as a regression against `Am` and `Bbm` (a modifier legitimately starts with a letter),
   and reverted. `atonal` would have become `Btonal`. A `{key: am}` is returned verbatim, exactly as
   on main.
7. **Finding B is a dependency, not part of this change.** `preferFlatForKey` is B's function and
   its fix; this references it and does not edit it. B is also **not sufficient** — the C-major case
   is identical before and after — so the lookup change is what actually fixes the reported
   behaviour, while the **C-flat edge stays open until B lands** and is not claimed as fixed here.
8. **This change overlaps `fix-unspecified-crashes` (#223) on one assertion.** The fractional-semitone
   case is named by both, and the `Number.isInteger` gate exists so the two do not contradict each
   other. Whichever lands second needs the other; a ~2-line rebase, stated here rather than
   discovered later.
9. **Stored chart content is never rewritten.** `features/music-theory.feature:62` makes the
   concrete ChordPro text canonical. That constrains the decision rather than merely informing it.
10. **Not merged with `fix-unspecified-crashes`,** the sibling half of the same list. The split is
   *whether a product decision is required*: those inputs are invalid under every reading, so they
   fix cleanly and ship first. These three cannot ship without an answer.

## Appendix: what a browser actually shows (measured, and it is not what the specs imply)

Added by the fixture work in `test/music-theory-fixtures` (#226), because the rendering claims in
this series had never been observed in the app. Seeded fixtures that contain these exact inputs now
exist, and the readings below are from the running app on `main` (`bfaf6e8`) against the fix branches.

| Body token | `main` | after the fix | finding |
|---|---|---|---|
| `[am]` | `am` — untransposed beside its neighbours | `Bm` | 1 |
| `[E♭]` | `F#♭` — a chord nobody writes | `F` | 2 |
| `[Bb]` | `C` — substitution silently not applied | `D` | 3 |
| `[C♯7]` | `D♯7` | `D#7` | 2 |

**Finding 1 (the degree view) is NOT observable, and the reason is not `qualityForDegree`.** With the
roman-numeral view enabled, the app renders the **concrete chord** in a dimmed style and no numeral,
for **every** chord in the fixture, at both +2 and at zero offset. `resolveDegree('C major', 'G')`
returns `null` in a bare Node probe, and `G` in C major is unambiguously degree 5. The scale catalog
row is present and correct (`Major` = `{0,2,4,5,7,9,11}`, an `integer[]`), and `authenticated` holds
SELECT on `scale_catalog`, so the data is not the blocker. **The root cause is not pinned and is not
guessed here.**

Two consequences worth stating plainly:

1. `qualityForDegree` is downstream of a map that never populates, so **fixing it changes nothing
   observable in the app.** The Gherkin scenario "Degree quality derives from the scale" cannot pass
   in the running app regardless of the fix. That is a separate defect and deserves its own change.
2. `buildDegreeMap` keys the map by the **concrete** chord (`Dm`) while the renderer looks up the
   **transposed** one (`Em`), so at any non-zero offset the lookup can never hit. The zero-offset
   failure is separate and is the one that is not explained by this mismatch.

The seeded demo account also carries `transpose_offset = 2, capo = 1` in `user_preferences`, which is
what makes the offset non-zero for anyone signing in as `demo@cemurm.app`.
