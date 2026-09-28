# Substitutions and Coverage Specification

## Purpose

Substitution requests for unavailable members, and the personal chord substitutions that render on a
substitute's own copy. Coverage: `features/substitutions-and-coverage.feature` — the request lifecycle
and the personal chord substitution scenarios. Created by `fix-unspecified-silent-wrong`, whose entire
content is the anchor-matching requirement below; that requirement is what the two existing
substitution scenarios left unspecified.

## Requirements

### Requirement: A personal chord substitution matches the anchor the musician wrote

The system MUST apply a personal chord substitution when the anchor it was stored under matches the
chord being rendered, **regardless of how the musician spelled that anchor**. The anchor is
human-entered text; whether it matches must not depend on the chart's key happening to agree with
that spelling.

A miss is not a neutral outcome. Before this requirement the lookup silently did nothing on a
chart whose key disagreed with the anchor's spelling, leaving the chord untouched with no error and
no notice, so the only visible result was that the musician's arrangement was ignored.

The lookup is ordered, and the order is the tie-break when two anchors are enharmonically equal:

1. the **concrete** key — the rendered chord reverse-transposed with the chart key's spelling
   preference. This is the original lookup, unchanged, and the one every other requirement depends on.
2. the **alternate enharmonic** of that concrete key — the same reverse transpose with the opposite
   spelling preference.
3. the **anchor as the musician typed it** — consulted only when neither derived spelling is in the
   stored set, and only for a whole number of semitones.

A derived spelling always outranks a written one, so a deliberately chosen enharmonic spelling is
never silently replaced by the application's preference. `Object.keys` order is not a tie-break. An
anchor that genuinely does not cover the chord still leaves the chord untouched.

#### Scenario: A flat-spelled anchor applies on a sharp-spelled chart

- GIVEN a personal substitution with the anchor `Bb`
- AND the chart's key is C, which is sharp-spelled
- WHEN the chart is rendered
- THEN the substitution applies
- AND it applies identically when the chart's key is B-flat

#### Scenario: A sharp-spelled anchor applies on a flat-spelled chart

- GIVEN a personal substitution with the anchor `A#`
- AND the chart's key is B-flat
- WHEN the chart is rendered
- THEN the substitution applies, in either enharmonic spelling

#### Scenario: An anchor written in the rendered spelling still applies

- GIVEN a personal substitution whose anchor is the chord as it appears on screen
- WHEN the song is transposed
- THEN the substitution applies
- AND the chord is transposed too, rather than being returned untransposed

#### Scenario: An anchor that does not cover the chord changes nothing

- GIVEN a personal substitution whose anchor is a different chord
- WHEN the chart is rendered
- THEN the chord is left exactly as the chart says it

#### Scenario: The existing concrete-keyed substitution is unaffected

- GIVEN a personal substitution `Bm -> Dmaj7` on a song in C
- WHEN the substitute's view renders at no transposition
- THEN it renders Dmaj7 where the chart says Bm
- AND the shared chart keeps B minor
- AND transposing the song moves the substitution to the transposed target
