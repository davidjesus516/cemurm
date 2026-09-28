# Music Theory Model Specification

## Purpose

The pure music-theory layer: transpose, capo display, key-spelling preference, and smallest-shift
distance. No I/O — `src/domain/music/`. Coverage: `features/music-theory.feature` — the transposition,
spelling and key-distance scenarios. Created by `fix-unspecified-silent-wrong`, which is the first
change to specify chord-root parsing; `fix-key-spelling-preference` (#219) and
`fix-parser-sectional-key` (#218) also concern this capability and will append to this file.

## Requirements

### Requirement: Chord root parsing accepts every spelling the chart format defines

The system MUST parse a chord root from a ChordPro chord token in any spelling that format
defines, and MUST NOT leave a plausibly valid token untransposed. A token the system does not
recognise is returned untouched, which is correct; a token it recognises differently from the author
is a silent wrong output and is not acceptable.

The formats this must cover, per ChordPro's own chord documentation:

- the root letter in **either case** — `C` and `c` are the same root, and a lowercase root is a
  valid root rather than a parse failure;
- a flat written as `b`, as `♭` (U+266D), or as the German `Bes`;
- a sharp written as `#` or as `♯` (U+266F).

The rendered chord uses the application's own uppercase-ASCII-accidental spelling. Stored chart
content is never rewritten — a token stored as `[am]` stays `am` in storage, and it renders as `Cm`
when transposed.

#### Scenario: A lowercase chord root transposes like any other root

- GIVEN a chart contains the chord `[am]`
- WHEN it is transposed up 3 semitones
- THEN the chord renders as Cm
- AND it is not left in place while a neighbouring chord moves

#### Scenario: Every ChordPro spelling of a flat is the same chord

- GIVEN a chart contains `[B♭]` and `[Bes]`
- WHEN it is transposed up 2 semitones
- THEN both render as C
- AND a flat is never carried into the output as a stray character, so the chord is not left
  half-transposed as `C#♭`

#### Scenario: A genuinely unrecognised token is left untouched

- GIVEN a chord token that is not a note this application has a table for
- WHEN it is transposed
- THEN it renders exactly as it was typed, rather than as a partially transposed fragment

### Requirement: A key is a note name and is parsed as one

The system MUST parse a key as a note name plus a modifier. A key tonic that continues with letters
is a word, not a key: `atonal` is not the note `a` with the modifier `tonal`, and transposing it must
not invent a key. A key with no table entry is returned unchanged.

The unicode accidentals and the German `Bes` apply to a key exactly as they apply to a chord, because
they are the same spellings of the same notes.

#### Scenario: A word is not a key

- GIVEN a key string of `atonal`
- WHEN it is transposed
- THEN it is returned unchanged, not as an invented key beginning with `B`

#### Scenario: A unicode accidental is part of the key's tonic

- GIVEN a key of `B♭`
- WHEN it is transposed up 2 semitones
- THEN it renders as C, not as C with a stray flat, and the same holds for `Bb` and `Bes`

### Requirement: Key distance is measured from the whole tonic

The system MUST measure the smallest signed shift between two keys from the **complete** tonic,
including its accidental. A key distance is a number the rest of the app acts on, so an accidental
dropped from the tonic produces a wrong number rather than a cosmetic one.

#### Scenario: An accidental changes the measured distance

- GIVEN a base key of `B♭` and a target key of D
- WHEN the distance between them is measured
- THEN it is 4 semitones, the distance from B-flat
- AND measuring from B-natural would have said 3
