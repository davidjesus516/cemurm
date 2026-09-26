// Unit tests for the degree-resolution PURE ENGINE.
//
// Specified by: this task (PR 1b, ADR 0002 refactor 2 — engine/lookup split)
// as the source of truth for the assertions below. No feature file specifies
// the engine in isolation: features/music-theory.feature reaches it only
// through the async data layer, which needs a scale_catalog read and so could
// not be unit-tested before this split. The engine below was UNREACHABLE from
// a test — unexported and shadowed by `export async` wrappers — until the
// split made it a leaf module with no imports.
//
// These assert what the code does TODAY, including the findings marked
// FINDING. Nothing here is aspirational.

import { describe, it, expect } from 'vitest'

import {
  noteToSemitone,
  extractRoot,
  rootToDegree,
  qualityForDegree,
  formatRomanNumeral,
  parseKeyContext,
} from './degreeResolver.js'

// ── fixtures ────────────────────────────────────────────────────────────────
// The seven diatonic interval sets, as offset-from-tonic semitone lists. This
// is the shape scale_catalog.intervals carries, and the only input the engine
// ever sees.
const C_MAJOR = [0, 2, 4, 5, 7, 9, 11]
const A_NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10]
const E_PHRYGIAN = [0, 1, 3, 5, 7, 8, 10]
const E_HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11]
const C_PENTATONIC = [0, 3, 5, 7, 10]
const C_CHROMATIC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

// ── noteToSemitone ───────────────────────────────────────────────────────────

describe('noteToSemitone', () => {
  it('maps the twelve sharp spellings to 0–11, C at 0', () => {
    expect(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
      .map(noteToSemitone)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('accepts the five flat spellings the app actually uses', () => {
    // FLAT_NOTES is not a full chromatic table: Db, Eb, Gb, Ab, Bb only.
    expect(noteToSemitone('Db')).toBe(1)
    expect(noteToSemitone('Eb')).toBe(3)
    expect(noteToSemitone('Gb')).toBe(6)
    expect(noteToSemitone('Ab')).toBe(8)
    expect(noteToSemitone('Bb')).toBe(10)
  })

  it('gives enharmonics the same semitone, and sharp is tried first', () => {
    // The sharp table is consulted before the flat table, so a note present in
    // both resolves through the sharp branch.
    expect(noteToSemitone('C#')).toBe(noteToSemitone('Db'))
    expect(noteToSemitone('D#')).toBe(noteToSemitone('Eb'))
    expect(noteToSemitone('G#')).toBe(noteToSemitone('Ab'))
    expect(noteToSemitone('A#')).toBe(noteToSemitone('Bb'))
  })

  it('returns null for every unrecognised spelling', () => {
    // Exact string match only — no normalisation of any kind.
    expect(noteToSemitone('H')).toBeNull() // no German/H naming
    expect(noteToSemitone('c')).toBeNull() // case-sensitive
    expect(noteToSemitone('C##')).toBeNull()
    expect(noteToSemitone('Cb#')).toBeNull()
    expect(noteToSemitone('F b')).toBeNull()
  })

  it('returns null for every falsy or non-string input, never throwing', () => {
    // The `if (!name)` guard catches '' , 0, null and undefined. A number
    // falls through both indexOf calls and lands on the same null.
    expect(noteToSemitone('')).toBeNull()
    expect(noteToSemitone(null)).toBeNull()
    expect(noteToSemitone(undefined)).toBeNull()
    expect(noteToSemitone(0)).toBeNull()
    expect(noteToSemitone(123)).toBeNull()
  })
})

// ── extractRoot ──────────────────────────────────────────────────────────────

describe('extractRoot', () => {
  it('takes the leading note and ignores the quality suffix', () => {
    expect(extractRoot('C')).toBe('C')
    expect(extractRoot('Cmaj7')).toBe('C')
    expect(extractRoot('E7')).toBe('E')
    expect(extractRoot('Am')).toBe('A')
    expect(extractRoot('C#dim')).toBe('C#')
    expect(extractRoot('F#m7b5')).toBe('F#')
    expect(extractRoot('Bb')).toBe('Bb')
  })

  it('ignores everything after the first slash or extension', () => {
    // Anchored regex: only the head of the string is considered.
    expect(extractRoot('C/E')).toBe('C')
    expect(extractRoot('Bb7/D')).toBe('Bb')
  })

  it('returns null when the string does not start with a note', () => {
    // The class is A–G, so H and a lowercase leading letter never match.
    expect(extractRoot('m')).toBeNull()
    expect(extractRoot('H')).toBeNull()
    expect(extractRoot('#C')).toBeNull()
    expect(extractRoot('bE')).toBeNull()
    expect(extractRoot('')).toBeNull()
  })

  it('throws a TypeError on null/undefined or a non-string', () => {
    // FINDING: there is no falsy guard, so `chord.match` is called blind. A
    // missing chord from a caller would take the whole degree-map loop down.
    expect(() => extractRoot(null)).toThrow(TypeError)
    expect(() => extractRoot(undefined)).toThrow(TypeError)
    expect(() => extractRoot(123)).toThrow(TypeError)
  })
})

// ── rootToDegree ─────────────────────────────────────────────────────────────

describe('rootToDegree', () => {
  it('returns the 1-based degree for every tone of the scale', () => {
    const degrees = C_MAJOR.map((semitone) => rootToDegree(0, C_MAJOR, semitone))
    expect(degrees).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('returns null for a chord root outside the scale', () => {
    // F# (6) is in no diatonic mode of C except Lydian / Locrian.
    expect(rootToDegree(0, C_MAJOR, 6)).toBeNull()
    expect(rootToDegree(0, E_PHRYGIAN, 6)).toBeNull() // Phrygian is 1,b2,b3,4,5,b6,b7
    // …but it IS in C Lydian ([0,2,4,6,7,9,11]), where it is the raised 4th.
    expect(rootToDegree(0, [0, 2, 4, 6, 7, 9, 11], 6)).toBe(4)
  })

  it('wraps a chord root BELOW the tonic through the octave', () => {
    // G (7) below A (9) is the 7th of A natural minor. The offset is
    // `((root - tonic) % 12 + 12) % 12`, so the negative modulo is corrected.
    expect(rootToDegree(9, A_NATURAL_MINOR, 7)).toBe(7)
  })

  it('returns null when either semitone is null', () => {
    expect(rootToDegree(null, C_MAJOR, 7)).toBeNull()
    expect(rootToDegree(0, C_MAJOR, null)).toBeNull()
    expect(rootToDegree(null, C_MAJOR, null)).toBeNull()
  })

  it('returns null for an empty scale, and throws on a missing scale', () => {
    expect(rootToDegree(0, [], 7)).toBeNull()
    // FINDING: `scaleIntervals.length` is read unguarded, so a scale row with
    // null intervals is a TypeError rather than a graceful null.
    expect(() => rootToDegree(0, undefined, 7)).toThrow(TypeError)
    expect(() => rootToDegree(0, null, 7)).toThrow(TypeError)
  })

  it('returns the FIRST index when the scale repeats a semitone', () => {
    expect(rootToDegree(0, [0, 4, 4, 7], 4)).toBe(2)
  })
})

// ── qualityForDegree ─────────────────────────────────────────────────────────

describe('qualityForDegree', () => {
  it('returns major, minor, diminished and augmented for tertian steps', () => {
    // The triad is read straight out of consecutive scale intervals, so
    // major/minor/dim/aug only appear when the first two STEPS are a third
    // and a fifth wide. These fixtures are built to satisfy that.
    expect(qualityForDegree([0, 4, 7, 8, 9, 10, 11], 1)).toBe('major') // 0→4→7
    expect(qualityForDegree([0, 3, 7, 8, 9, 10, 11], 1)).toBe('minor') // 0→3→7
    expect(qualityForDegree([0, 3, 6, 7, 8, 9, 10], 1)).toBe('diminished') // 0→3→6
    expect(qualityForDegree([0, 4, 8, 9, 10, 11, 7], 1)).toBe('augmented') // 0→4→8
  })

  it('returns "power" for EVERY degree of every real diatonic scale', () => {
    // FINDING — the biggest one in this module. The function treats
    // intervals[d] as a triad's THIRD and intervals[d+1] as its FIFTH, but in
    // a real 7-note scale those are the next SCALE STEP and the one after:
    // 1–2 semitones, never the 3–4 (third) or 6–8 (fifth) it tests for. So no
    // diatonic scale ever matches, and the `return 'power'` fallthrough takes
    // all 7 degrees. Consequence: resolveDegree formats every chord with an
    // uppercase major-mode numeral — degree 2 of A minor renders "II", not
    // "ii°". The 4 quality branches are only reachable from synthetic input.
    for (const intervals of [C_MAJOR, A_NATURAL_MINOR, E_PHRYGIAN, E_HARMONIC_MINOR]) {
      expect(intervals.map((_, d) => qualityForDegree(intervals, d + 1)))
        .toEqual(['power', 'power', 'power', 'power', 'power', 'power', 'power'])
    }
  })

  it('returns "power" for every degree of a non-heptatonic scale', () => {
    // The pentatonic short-circuit is the `len < 7` branch.
    expect(C_PENTATONIC.map((_, d) => qualityForDegree(C_PENTATONIC, d + 1)))
      .toEqual(['power', 'power', 'power', 'power', 'power'])
  })

  it('does NOT short-circuit a scale longer than seven notes', () => {
    // FINDING: the comment says "for non-heptatonic scales, return 'power'",
    // but the guard is `len < 7`, so a 12-note chromatic scale falls through
    // into the tertian analysis. It still lands on 'power' here, but by the
    // fallthrough, not the short-circuit.
    expect(qualityForDegree(C_CHROMATIC, 1)).toBe('power')
    expect(C_CHROMATIC).toHaveLength(12)
  })

  it('returns null for a degree outside 1..intervals.length', () => {
    expect(qualityForDegree(C_MAJOR, 0)).toBeNull()
    expect(qualityForDegree(C_MAJOR, -1)).toBeNull()
    expect(qualityForDegree(C_MAJOR, 8)).toBeNull()
    expect(qualityForDegree(C_PENTATONIC, 6)).toBeNull()
  })

  it('returns null for a missing scale, but "power" for a missing degree', () => {
    // FINDING: the guard is `!intervals || degree < 1 || degree > length`, and
    // `undefined < 1` is false, so an omitted degree slips past it and returns
    // 'power' instead of null.
    expect(qualityForDegree(null, 1)).toBeNull()
    expect(qualityForDegree(undefined, 1)).toBeNull()
    expect(qualityForDegree(C_MAJOR, undefined)).toBe('power')
  })
})

// ── formatRomanNumeral ───────────────────────────────────────────────────────

describe('formatRomanNumeral', () => {
  it('renders all seven degrees in both cases', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((d) => formatRomanNumeral(d, 'major')))
      .toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'])
    expect([1, 2, 3, 4, 5, 6, 7].map((d) => formatRomanNumeral(d, 'minor')))
      .toEqual(['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'])
  })

  it('suffixes diminished with the degree sign and augmented with a plus', () => {
    expect([1, 4, 5, 7].map((d) => formatRomanNumeral(d, 'diminished')))
      .toEqual(['i°', 'iv°', 'v°', 'vii°'])
    expect([1, 3, 4, 6].map((d) => formatRomanNumeral(d, 'augmented')))
      .toEqual(['I+', 'III+', 'IV+', 'VI+'])
  })

  it('renders "power" as the plain capitalized numeral', () => {
    // Because qualityForDegree always returns 'power' (see the FINDING above),
    // this is the branch production actually takes.
    expect([1, 2, 3, 4, 5, 6, 7].map((d) => formatRomanNumeral(d, 'power')))
      .toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'])
  })

  it('falls back to the capitalized numeral for an unknown quality', () => {
    expect(formatRomanNumeral(5, 'weird')).toBe('V')
    expect(formatRomanNumeral(5, undefined)).toBe('V')
  })

  it('returns "?" for a degree outside 1..7', () => {
    // The `!degree` test catches 0/null/undefined; the range test catches 8+.
    expect(formatRomanNumeral(0, 'major')).toBe('?')
    expect(formatRomanNumeral(8, 'major')).toBe('?')
    expect(formatRomanNumeral(-1, 'major')).toBe('?')
    expect(formatRomanNumeral(null, 'major')).toBe('?')
    expect(formatRomanNumeral(undefined, 'major')).toBe('?')
  })

  it('coerces a numeric-string degree through the comparisons', () => {
    // FINDING: `!degree` and the range checks use JS coercion, and
    // `ROMAN_MAJOR['1' - 1]` subtracts, so a string degree silently works.
    expect(formatRomanNumeral('1', 'major')).toBe('I')
    expect(formatRomanNumeral('5', 'minor')).toBe('v')
  })
})

// ── parseKeyContext ──────────────────────────────────────────────────────────

describe('parseKeyContext', () => {
  it('splits a tonic from a scale name', () => {
    expect(parseKeyContext('C major')).toEqual({ tonic: 'C', scaleName: 'major' })
    expect(parseKeyContext('E Phrygian')).toEqual({ tonic: 'E', scaleName: 'Phrygian' })
    expect(parseKeyContext('Ab')).toEqual({ tonic: 'Ab', scaleName: 'Major' })
    expect(parseKeyContext('E Phrygian dominant')).toEqual({ tonic: 'E', scaleName: 'Phrygian dominant' })
  })

  it('defaults a bare tonic to the Major scale', () => {
    expect(parseKeyContext('Bb')).toEqual({ tonic: 'Bb', scaleName: 'Major' })
    expect(parseKeyContext('C ')).toEqual({ tonic: 'C', scaleName: 'Major' })
  })

  it('trims the string and collapses runs of whitespace', () => {
    expect(parseKeyContext('  C major  ')).toEqual({ tonic: 'C', scaleName: 'major' })
    expect(parseKeyContext('C    major')).toEqual({ tonic: 'C', scaleName: 'major' })
    // The scale name is re-joined with SINGLE spaces, so an exotic multi-word
    // scale keeps its words but loses the original spacing.
    expect(parseKeyContext('E  Phrygian  dominant'))
      .toEqual({ tonic: 'E', scaleName: 'Phrygian dominant' })
  })

  it('does not normalise case of either half', () => {
    // `scaleName` is passed through verbatim for findScaleByName to fold.
    expect(parseKeyContext('c major')).toBeNull() // lowercase tonic is not a note
    expect(parseKeyContext('C MAJOR')).toEqual({ tonic: 'C', scaleName: 'MAJOR' })
  })

  it('returns null when the tonic is not a note name', () => {
    expect(parseKeyContext('H')).toBeNull()
    expect(parseKeyContext('H major')).toBeNull()
    expect(parseKeyContext('0')).toBeNull()
  })

  it('rejects a compound key like "C#m" that a user would write', () => {
    // FINDING: the tonic is validated with the WHOLE first token, so a
    // shorthand-quality key never parses — only a bare note plus a separate
    // scale name does. This is a different convention from
    // integrations/spotify.js canonicalKeyLabel, which accepts 'Em' → 'E
    // Natural Minor'. Two key parsers, two grammars.
    expect(parseKeyContext('C#m')).toBeNull()
    expect(parseKeyContext('Em')).toBeNull()
  })

  it('returns null for every falsy input', () => {
    expect(parseKeyContext('')).toBeNull()
    expect(parseKeyContext(null)).toBeNull()
    expect(parseKeyContext(undefined)).toBeNull()
    expect(parseKeyContext(0)).toBeNull()
  })

  it('throws a TypeError on a non-string, non-falsy input', () => {
    // FINDING: `keyString.trim()` runs before any guard, so a number throws.
    expect(() => parseKeyContext(123)).toThrow(TypeError)
    expect(() => parseKeyContext({})).toThrow(TypeError)
  })
})

// ── the engine composed: the path resolveDegree actually takes ──────────────

describe('engine composition — what a resolved numeral looks like', () => {
  it('renders I-IV-V in C major as three capitalized numerals', () => {
    // The end-to-end engine path, with the catalog read stubbed out by
    // passing the intervals directly. This is the exact sequence
    // data/repositories/degrees.js runs.
    const numeralFor = (chord) => {
      const degree = rootToDegree(0, C_MAJOR, noteToSemitone(extractRoot(chord)))
      return formatRomanNumeral(degree, qualityForDegree(C_MAJOR, degree))
    }
    expect(['C', 'F', 'G'].map(numeralFor)).toEqual(['I', 'IV', 'V'])
  })

  it('round-trips a chart transposed into a flat key', () => {
    // Ab major: the engine's FLAT spellings must agree with the CHART's, or a
    // transposed chord stops matching its degree.
    expect(extractRoot('Bbmaj7')).toBe('Bb')
    expect(noteToSemitone('Bb')).toBe(10)
    const degree = rootToDegree(noteToSemitone('Ab'), C_MAJOR, 10)
    expect(degree).toBe(2)
    expect(formatRomanNumeral(degree, qualityForDegree(C_MAJOR, degree))).toBe('II')
  })
})
