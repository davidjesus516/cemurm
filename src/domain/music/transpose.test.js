// Characterization tests — locks current behaviour before the PR 1b boundary refactor.
// Specified by: features/personal-preferences-and-adaptations.feature
// PR 1b will split this module. These tests must pass with ZERO edits.

import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  NOTES_SHARP,
  transposeChord,
  transposeKey,
  capoLabel,
  preferFlatForKey,
  semitonesBetween,
  initialSemitones,
  transposeParsed,
  demo,
} from './transpose.js'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Minimal ParsedSong ({ key, sections }) as produced by parseChordPro. */
function song(key, ...chords) {
  return {
    key,
    sections: [
      {
        type: 'lyrics',
        lines: [{ text: 'Hello', chords: chords.map((chord, i) => ({ chord, position: i })) }],
      },
    ],
  }
}

// ── NOTES_SHARP ──────────────────────────────────────────────────────────────

describe('NOTES_SHARP', () => {
  it('is the 12-entry chromatic table, C at index 0', () => {
    expect(NOTES_SHARP).toEqual(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])
    expect(NOTES_SHARP).toHaveLength(12)
    expect(NOTES_SHARP[0]).toBe('C')
    expect(NOTES_SHARP[11]).toBe('B')
  })

  it('contains no flat spellings — flat keys are respelled by hand downstream', () => {
    // FINDING: the table is sharp-only, so a Db/Bb major label is unreachable
    // from it. integrations/spotify.js spotifyKeyToLabel depends on this.
    expect(NOTES_SHARP.filter((n) => n.includes('b'))).toEqual([])
  })

  it('is a shared module-level array (same identity on every import)', () => {
    // FINDING: not frozen, and a consumer could mutate every other consumer.
    expect(NOTES_SHARP).toBe(NOTES_SHARP)
    expect(Object.isFrozen(NOTES_SHARP)).toBe(false)
  })
})

// ── transposeChord ───────────────────────────────────────────────────────────

describe('transposeChord', () => {
  it('transposes the root and keeps the quality suffix verbatim', () => {
    expect(transposeChord('Am', 3)).toBe('Cm')
    expect(transposeChord('G7', 5)).toBe('C7')
    expect(transposeChord('Cdim', 2)).toBe('Ddim')
    expect(transposeChord('Cmaj7#5', 4)).toBe('Emaj7#5')
  })

  it('honours an explicit preferFlat override', () => {
    // The override only bites on the five indices where the two tables differ.
    expect(transposeChord('C', 1, false)).toBe('C#')
    expect(transposeChord('C', 1, true)).toBe('Db')
    expect(transposeChord('Dm', 1, false)).toBe('D#m')
    expect(transposeChord('Dm', 1, true)).toBe('Ebm')
  })

  it('defaults to the NOTE spelling when preferFlat is undefined', () => {
    // FINDING: `preferFlat` is a tri-state — passing `false` forces sharps, but
    // omitting it lets each note keep its own spelling (Bb stays flat).
    expect(transposeChord('Bbmaj7', 0, undefined)).toBe('Bbmaj7')
    expect(transposeChord('Bbmaj7', 0, false)).toBe('A#maj7')
  })

  it('wraps by octave in both directions', () => {
    expect(transposeChord('C', 12)).toBe('C')
    expect(transposeChord('C', 24)).toBe('C')
    expect(transposeChord('C', -12)).toBe('C')
    expect(transposeChord('C', -1)).toBe('B')
    expect(transposeChord('C', -13)).toBe('B')
  })

  it('accepts a numeric string as the semitone count', () => {
    expect(transposeChord('C', '2')).toBe('D')
  })

  it('passes unparseable tokens through untouched', () => {
    // Lowercase is NOT supported: the root regex is [A-G] uppercase only.
    expect(transposeChord('c', 1)).toBe('c')
    expect(transposeChord('am', 3)).toBe('am')
    expect(transposeChord('H', 1)).toBe('H')
    expect(transposeChord('', 2)).toBe('')
    expect(transposeChord('H#', 2)).toBe('H#')
  })

  it('does NOT transpose a slash-chord bass note (documented limitation)', () => {
    // FINDING: the suffix (including the slash bass) rides along verbatim, so
    // the root respells but E stays E.
    expect(transposeChord('C/E', 2)).toBe('D/E')
    expect(transposeChord('G/B', 1, false)).toBe('G#/B')
    expect(transposeChord('G/B', 1, true)).toBe('Ab/B')
  })

  it('throws a TypeError on a null/undefined token', () => {
    expect(() => transposeChord(null, 1)).toThrow(TypeError)
    expect(() => transposeChord(undefined, 1)).toThrow(TypeError)
  })

  it('transposes nothing for a non-integer semitone count, and says why', () => {
    // The assertion this replaces asserted the literal strings "undefined",
    // "undefinedm" and "undefined7" were produced. Those were the bug: the
    // table lookup went fractional and the miss was stringified into the chord,
    // suffix and all.
    //
    // Rounding is deliberately NOT the fix. A quarter-tone up and a half-tone
    // down are not the same distance, and silently picking one is a musical
    // decision made by a modulo. A non-integer amount transposes nothing, which
    // is at least a defined outcome the caller can detect.
    expect(transposeChord('C', 2.5)).toBe('C')
    expect(transposeChord('Am', 2.5)).toBe('Am')
    // undefined and NaN are not integers either, and used to stringify to
    // "undefinedm" and "undefined7" — suffix and all.
    expect(transposeChord('Am', undefined)).toBe('Am')
    expect(transposeChord('G7', NaN)).toBe('G7')
    expect(transposeChord('C', null)).toBe('C')
  })

  it('still accepts a numeric STRING, which is not a fraction', () => {
    // A form control or a JSON payload delivers an integer as '2'. Coercing
    // before the integer check is what keeps that working; checking the raw
    // value would have regressed it.
    expect(transposeChord('C', '2')).toBe('D')
    expect(transposeChord('C', '2.5')).toBe('C')
  })

  it('prefers sharps on the sharp side of the circle and flats only when asked', () => {
    // FINDING: transposeChord never produces an enharmonic alternative — a
    // sharp-preferring C chart renders C+3 as "D#", never "Eb".
    expect(transposeChord('C', 3)).toBe('D#')
    expect(transposeChord('C', 3, true)).toBe('Eb')
    expect(transposeChord('C', -2)).toBe('A#')
    expect(transposeChord('C', -2, true)).toBe('Bb')
  })
})

// ── transposeKey ─────────────────────────────────────────────────────────────

describe('transposeKey', () => {
  it('transposes a key and keeps its quality suffix', () => {
    expect(transposeKey('C major', 5)).toBe('F major')
    expect(transposeKey('Am', 3)).toBe('Cm')
    expect(transposeKey('E major', 8)).toBe('C major')
    expect(transposeKey('Em', 8)).toBe('Cm')
  })

  it('preserves every whitespace run in the suffix', () => {
    expect(transposeKey('C  major', 5)).toBe('F  major')
  })

  it('wraps by octave', () => {
    expect(transposeKey('C', 0)).toBe('C')
    expect(transposeKey('C', 12)).toBe('C')
    expect(transposeKey('C', 24)).toBe('C')
    expect(transposeKey('C', -12)).toBe('C')
  })

  it('flattens only when the RESULTING root is one of the six flat keys', () => {
    // F, Bb, Eb, Ab, Db, Gb
    expect(transposeKey('C', 5)).toBe('F')
    expect(transposeKey('C', 10)).toBe('A#') // Bb would be right, but see below
    expect(transposeKey('Bb', 2)).toBe('C')
    expect(transposeKey('Bb', 1)).toBe('B')
    expect(transposeKey('Bb', 5)).toBe('Eb')
    expect(transposeKey('Bb', -2)).toBe('Ab')
    expect(transposeKey('Ab', 2)).toBe('Bb')
    expect(transposeKey('Db', 1)).toBe('D')
    expect(transposeKey('Eb', 2)).toBe('F')
    expect(transposeKey('Gb', 1)).toBe('G')
    expect(transposeKey('F', 6)).toBe('B')
    expect(transposeKey('F', 7)).toBe('C')
  })

  it('emits sharp spellings everywhere else — including minor keys', () => {
    // FINDING: FLAT_KEYS holds six MAJOR roots only. Minor keys transposing into
    // flat territory get sharp labels, so 'C minor' at -2 is "A#m" not "Bbm".
    expect(transposeKey('C', 3)).toBe('D#')
    expect(transposeKey('C', -2)).toBe('A#')
    expect(transposeKey('C', 1)).toBe('C#')
    expect(transposeKey('C', 6)).toBe('F#')
    expect(transposeKey('Am', 1)).toBe('A#m')
    expect(transposeKey('Cm', -2)).toBe('A#m')
    expect(transposeKey('Em', 6)).toBe('A#m')
    expect(preferFlatForKey('A#m')).toBe(false)
  })

  it('returns falsy input unchanged', () => {
    expect(transposeKey('', 2)).toBe('')
    expect(transposeKey(null, 2)).toBe(null)
    expect(transposeKey(undefined, 2)).toBe(undefined)
  })

  it('returns an unparseable key unchanged', () => {
    expect(transposeKey('H', 2)).toBe('H')
    expect(transposeKey('atonal', 2)).toBe('atonal')
  })

  it('treats a unicode accidental as part of the suffix, not the root', () => {
    // FINDING: only ASCII '#'/'b' are recognised. U+266F/U+266D ride along in
    // the suffix, so 'B♭' transposes to the nonsense 'C#♭'.
    expect(transposeKey('C♯', 2)).toBe('D♯')
    expect(transposeKey('B♭', 2)).toBe('C#♭')
  })

  it('does not yield the string "undefined" for a non-integer semitone count', () => {
    // The assertion this replaces asserted transposeKey('C', 2.5) === 'undefined'.
    // The same fractional-table-lookup bug as transposeChord, seen from here.
    expect(transposeKey('C', 2.5)).toBe('C')
  })
})

// ── preferFlatForKey ─────────────────────────────────────────────────────────

describe('preferFlatForKey', () => {
  it('is true for the six flat-key roots, with or without a quality suffix', () => {
    for (const k of ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']) {
      expect(preferFlatForKey(k)).toBe(true)
    }
    expect(preferFlatForKey('Bb major')).toBe(true)
    expect(preferFlatForKey('Bb ')).toBe(true)
    expect(preferFlatForKey('F#')).toBe(false)
  })

  it('is false for sharp keys', () => {
    for (const k of ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'Am', 'Em']) {
      expect(preferFlatForKey(k)).toBe(false)
    }
  })

  it('is false for every empty/absent input', () => {
    expect(preferFlatForKey('')).toBe(false)
    expect(preferFlatForKey(null)).toBe(false)
    expect(preferFlatForKey(undefined)).toBe(false)
  })

  it('splits on whitespace, so LEADING whitespace silently breaks it', () => {
    // FINDING: String.split(/\s+/)[0] of ' bb' is '', not 'bb'.
    expect(preferFlatForKey(' bb')).toBe(false)
    expect(preferFlatForKey('C  major')).toBe(false)
    expect(preferFlatForKey('C\tmajor')).toBe(false)
  })

  it('is case-sensitive — "bb" is not "Bb"', () => {
    expect(preferFlatForKey('bb')).toBe(false)
  })
})

// ── semitonesBetween ─────────────────────────────────────────────────────────

describe('semitonesBetween', () => {
  it('returns the smallest signed shift', () => {
    expect(semitonesBetween('G', 'D')).toBe(-5)
    expect(semitonesBetween('C', 'D')).toBe(2)
    expect(semitonesBetween('Bb', 'F')).toBe(-5)
    expect(semitonesBetween('C', 'C')).toBe(0)
    expect(semitonesBetween('C', 'F')).toBe(5)
    expect(semitonesBetween('C', 'G')).toBe(-5)
    expect(semitonesBetween('C', 'B')).toBe(-1)
    expect(semitonesBetween('Am', 'Bm')).toBe(2)
    expect(semitonesBetween('C#', 'D')).toBe(1)
  })

  it('reads only the leading root, ignoring the quality suffix', () => {
    expect(semitonesBetween('C major', 'D major')).toBe(2)
  })

  it('treats enharmonic spellings as the same pitch class', () => {
    expect(semitonesBetween('C#', 'Db')).toBe(0)
    expect(semitonesBetween('Bb', 'A#')).toBe(0)
  })

  it('resolves the tritone tie UPWARD in both directions', () => {
    // FINDING: `if (diff > 6) diff -= 12` breaks the 6-semitone tie upward, so
    // a descending tritone is reported as ascending.
    expect(semitonesBetween('C', 'F#')).toBe(6)
    expect(semitonesBetween('F#', 'C')).toBe(6)
    expect(semitonesBetween('G', 'Db')).toBe(6)
    expect(semitonesBetween('Gb', 'F')).toBe(-1)
  })

  it('round-trips with transposeKey for sharp-side targets', () => {
    const pairs = [['G', 'D'], ['C', 'D'], ['Bb', 'F'], ['C', 'C']]
    for (const [base, target] of pairs) {
      const shift = semitonesBetween(base, target)
      expect(transposeKey(base, shift)).toBe(target)
    }
  })

  it('does NOT round-trip to a flat target from a sharp-side base', () => {
    // FINDING: the practice-key feature ("practices in D, plays in G") is only
    // stable for sharp-side targets. C → Bb reports -2, but transposeKey('C',-2)
    // spells it 'A#', so the round trip is lossy in one direction only.
    expect(semitonesBetween('C', 'Bb')).toBe(-2)
    expect(transposeKey('C', semitonesBetween('C', 'Bb'))).toBe('A#')
    // The reverse direction is fine, because Bb's own spelling wins.
    expect(transposeKey('Bb', semitonesBetween('Bb', 'C'))).toBe('C')
  })

  it('returns 0 for anything unparseable', () => {
    expect(semitonesBetween(undefined, undefined)).toBe(0)
    expect(semitonesBetween('', 'C')).toBe(0)
    expect(semitonesBetween('C', '')).toBe(0)
    expect(semitonesBetween('H', 'C')).toBe(0)
    expect(semitonesBetween('C', 'H')).toBe(0)
    expect(semitonesBetween('C', null)).toBe(0)
  })
})

// ── initialSemitones ─────────────────────────────────────────────────────────

describe('initialSemitones', () => {
  it('lets an explicit per-song override REPLACE the global offset', () => {
    expect(initialSemitones(2, -1)).toBe(-1)
    expect(initialSemitones(0, -1)).toBe(-1)
    expect(initialSemitones(undefined, 2)).toBe(2)
  })

  it('lets an override of 0 win over a non-zero global', () => {
    expect(initialSemitones(2, 0)).toBe(0)
  })

  it('falls back to the global offset only when the override is nullish', () => {
    expect(initialSemitones(2, undefined)).toBe(2)
    expect(initialSemitones(2, null)).toBe(2)
    expect(initialSemitones('3', undefined)).toBe(3)
    expect(initialSemitones('-2', undefined)).toBe(-2)
  })

  it('defaults to 0 when neither preference exists', () => {
    expect(initialSemitones(undefined, undefined)).toBe(0)
    expect(initialSemitones(null, null)).toBe(0)
    expect(initialSemitones(undefined, '')).toBe(0)
    expect(initialSemitones(undefined, false)).toBe(0)
  })

  it('coerces through Number(), so junk becomes NaN and booleans become 0/1', () => {
    expect(Number.isNaN(initialSemitones(undefined, 'abc'))).toBe(true)
    expect(Number.isNaN(initialSemitones(2, NaN))).toBe(true)
    expect(initialSemitones(true, undefined)).toBe(1)
  })

  it('does NOT normalise the offset into the 0–11 range', () => {
    // transposeChord wraps modulo 12; initialSemitones hands the raw value on.
    expect(initialSemitones(0, 24)).toBe(24)
    expect(initialSemitones(0, 14)).toBe(14)
  })
})

// ── capoLabel ────────────────────────────────────────────────────────────────

describe('capoLabel', () => {
  it('renders "Capo N · sounds X" with X shifted by the fret count', () => {
    expect(capoLabel('C', 2)).toBe('Capo 2 · sounds D')
    expect(capoLabel('Am', 3)).toBe('Capo 3 · sounds Cm')
    expect(capoLabel('Bb', 2)).toBe('Capo 2 · sounds C')
    expect(capoLabel('F', 1)).toBe('Capo 1 · sounds F#')
    expect(capoLabel('C major', 2)).toBe('Capo 2 · sounds D major')
    expect(capoLabel('C', 12)).toBe('Capo 12 · sounds C')
  })

  it('renders "" for a missing key or a falsy capo', () => {
    expect(capoLabel('C', 0)).toBe('')
    expect(capoLabel('C', null)).toBe('')
    expect(capoLabel('C', NaN)).toBe('')
    expect(capoLabel('C', undefined)).toBe('')
    expect(capoLabel('', 2)).toBe('')
    expect(capoLabel(null, 2)).toBe('')
    expect(capoLabel(undefined, 2)).toBe('')
  })

  it('formats a negative capo verbatim rather than clamping it', () => {
    expect(capoLabel('C', -2)).toBe('Capo -2 · sounds A#')
  })

  it('accepts a numeric-string capo', () => {
    expect(capoLabel('C', '2')).toBe('Capo 2 · sounds D')
  })

  it('renders a fractional capo verbatim and does NOT leak "undefined" into the key', () => {
    // The assertion this replaces expected 'Capo 1.5 · sounds undefined' — a
    // capo line telling the player the key is literally "undefined". The capo
    // number is displayed as typed; the key is not transposed by a fraction.
    expect(capoLabel('C', 1.5)).toBe('Capo 1.5 · sounds C')
  })
})

// ── transposeParsed ──────────────────────────────────────────────────────────

describe('transposeParsed', () => {
  it('transposes the key and every chord, keeping chord positions', () => {
    expect(transposeParsed(song('C', 'C', 'G'), 5)).toEqual(song('F', 'F', 'C'))
  })

  it('returns the SAME object reference for any falsy semitone count', () => {
    // FINDING: the guard is `if (!semitones) return parsed`, so '' and NaN and
    // -0 all silently no-op and callers relying on identity see no change.
    const parsed = song('C', 'C')
    expect(transposeParsed(parsed, 0)).toBe(parsed)
    expect(transposeParsed(parsed, undefined)).toBe(parsed)
    expect(transposeParsed(parsed, null)).toBe(parsed)
    expect(transposeParsed(parsed, NaN)).toBe(parsed)
    expect(transposeParsed(parsed, -0)).toBe(parsed)
    expect(transposeParsed(parsed, '')).toBe(parsed)
  })

  it('never mutates the input', () => {
    const parsed = song('C', 'C', 'G')
    transposeParsed(parsed, 5)
    expect(parsed).toEqual(song('C', 'C', 'G'))
    expect(parsed.sections[0].lines[0].chords[0].chord).toBe('C')
  })

  it('returns a deep-ish copy: new arrays, but extra fields are spread through', () => {
    const parsed = {
      key: 'C',
      tag: 'kept',
      sections: [{ type: 'lyrics', id: 's1', lines: [{ text: 'a', id: 'l1', chords: [{ chord: 'C', position: 0, id: 'c1' }] }] }],
    }
    const out = transposeParsed(parsed, 2)
    expect(out).not.toBe(parsed)
    expect(out.sections).not.toBe(parsed.sections)
    expect(out.sections[0].lines).not.toBe(parsed.sections[0].lines)
    expect(out.sections[0].lines[0].chords[0]).not.toBe(parsed.sections[0].lines[0].chords[0])
    expect(out).toEqual({
      key: 'D',
      tag: 'kept',
      sections: [{ type: 'lyrics', id: 's1', lines: [{ text: 'a', id: 'l1', chords: [{ chord: 'D', position: 0, id: 'c1' }] }] }],
    })
  })

  it('applies the SONG key flat preference to every chord', () => {
    expect(transposeParsed(song('Bb', 'C'), 1)).toEqual(song('B', 'Db'))
    expect(preferFlatForKey('B')).toBe(false)
  })

  it('does not flatten chords when the song key is a flat MINOR', () => {
    // FINDING: FLAT_KEYS is major-only, so 'Bbm' resolves preferFlat=false and
    // the chords get sharp spellings even though the key name stays flat.
    const parsed = { key: 'Bbm', sections: [{ type: 'lyrics', lines: [{ text: '', chords: [{ chord: 'Bb', position: 0 }, { chord: 'Eb', position: 0 }] }] }] }
    expect(transposeParsed(parsed, 2)).toEqual({
      key: 'Cm',
      sections: [{ type: 'lyrics', lines: [{ text: '', chords: [{ chord: 'C', position: 0 }, { chord: 'F', position: 0 }] }] }],
    })
  })

  it('tolerates a parsed song with no key at all (key becomes undefined)', () => {
    const parsed = { sections: [{ type: 'lyrics', lines: [{ text: '', chords: [{ chord: 'C', position: 0 }] }] }] }
    expect(transposeParsed(parsed, 2).sections[0].lines[0].chords[0].chord).toBe('D')
    expect(transposeParsed(parsed, 2).key).toBeUndefined()
  })

  it('throws a TypeError when the parsed shape is incomplete', () => {
    expect(() => transposeParsed({ key: 'C' }, 2)).toThrow(TypeError)
    expect(() => transposeParsed({ key: 'C', sections: [{ type: 'lyrics', lines: [{ text: 'a' }] }] }, 2)).toThrow(TypeError)
  })
})

// ── demo() (the module's own self-check) ─────────────────────────────────────

describe('demo()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs every internal assert without throwing, and logs one line', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(() => demo()).not.toThrow()
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toContain('transpose demo OK')
    expect(log.mock.calls[0][0]).toContain('28 asserts')
  })
})
