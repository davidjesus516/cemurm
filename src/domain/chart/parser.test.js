// Characterization tests — locks current behaviour before the PR 1b boundary refactor.
// Specified by: features/music-notation.feature
// PR 1b will split this module. These tests must pass with ZERO edits.

import { describe, it, expect, vi, afterEach } from 'vitest'

import { parseChordPro, demo } from './parser.js'

// ── fixtures ────────────────────────────────────────────────────────────────
// Verbatim public-library chart body from supabase/seed.sql:226 (Amazing Grace).
const AMAZING_GRACE = `{title: Amazing Grace}
{artist: John Newton}
{key: G}
{section: Verse 1}
[G]Amazing [D]grace, how [G]sweet the [Em]sound
That [C]saved a [D]wretch like [G]me
[G]I once was [D]lost, but [G]now am [Em]found
Was [C]blind, but [D]now I [G]see
{section: Verse 2}
'Twas [G]grace that [D]taught my [G]heart to [Em]fear
And [C]grace my [D]fears re-[G]lieved
How [G]precious [D]did that [G]grace ap-[Em]pear
The [C]hour I [D]first be-[G]lieved`

// The module's own demo sample.
const DEMO_SAMPLE = `{title: Imagine}
{artist: John Lennon}
{key: C}
{comment: Demo song}
{section: Verse 1}
[C]Imagine there's no [Em]heaven
No hell beneath us
[Am]It's easy if you [F]try`

/** The one `lyrics` section of a single-section chart. */
function onlyLyrics(parsed) {
  expect(parsed.sections.filter((s) => s.type === 'lyrics')).toHaveLength(1)
  return parsed.sections.find((s) => s.type === 'lyrics')
}

// ── metadata directives ──────────────────────────────────────────────────────

describe('parseChordPro — metadata directives', () => {
  it('reads {title}, {artist} and {key}', () => {
    const parsed = parseChordPro(DEMO_SAMPLE)
    expect(parsed.title).toBe('Imagine')
    expect(parsed.artist).toBe('John Lennon')
    expect(parsed.key).toBe('C')
  })

  it('lets the LAST of a repeated directive win', () => {
    expect(parseChordPro('{title: A}\n{title: B}').title).toBe('B')
  })

  it('stores an empty value for a valueless known directive', () => {
    const parsed = parseChordPro('{title}')
    expect(parsed.title).toBe('')
  })

  it('lowercases and trims the directive name, so names are case-insensitive', () => {
    const parsed = parseChordPro('{TITLE: T}\n{Key: K}\n{ARTIST: A}')
    expect(parsed.title).toBe('T')
    expect(parsed.key).toBe('K')
    expect(parsed.artist).toBe('A')
  })

  it('allows a colon inside the value', () => {
    expect(parseChordPro('{title: A: B}').title).toBe('A: B')
  })

  it('tolerates leading and trailing whitespace around the braces', () => {
    const parsed = parseChordPro('   {title: T}   ')
    expect(parsed.title).toBe('T')
    expect(parsed.sections).toEqual([])
  })

  it('returns zero sections for a directives-only chart', () => {
    const parsed = parseChordPro('{title: X}')
    expect(parsed.sections).toEqual([])
  })
})

// ── sectional key ───────────────────────────────────────────────────────────

describe('parseChordPro — sectional key contexts', () => {
  const modSample = `{title: ModSong}
{key: C}
{section: Verse}
[C]Verse in C
{section: Chorus}
{key: G}
[G]Chorus in G`

  it('records a mid-chart {key} as a sectional override', () => {
    // The assertion this replaces asserted `sectionKeyContexts` was ALWAYS
    // empty. KNOWN_META contained 'key', so the generic meta branch matched
    // first and `continue`d before the sectional branch could run.
    const parsed = parseChordPro(modSample)
    expect(parsed.sectionKeyContexts).toEqual([{ sectionIndex: 2, key: 'G' }])
  })

  it('keeps the song key as the FIRST {key}, not the last', () => {
    // The module doc comment claims "the song-level key is the first {key}
    // directive"; the code took the last one, so a modulating chart reported
    // its chorus key as the song's key.
    const parsed = parseChordPro(modSample)
    expect(parsed.key).toBe('C')
  })

  it('points the override at the section it was written in, inventing none', () => {
    // The branch used to call ensureSection('lyrics') first, which pushed a new
    // section and then recorded THAT index rather than the section the
    // modulation belongs to. Here {key: G} sits between the Chorus header and
    // the Chorus lyric, so it belongs to the Chorus header at index 2 — and
    // the section count is unchanged, which is the half that was actually wrong.
    const parsed = parseChordPro(modSample)
    expect(parsed.sections).toHaveLength(4)
    expect(parsed.sections[2].type).toBe('section')
    expect(parsed.sections[2].lines[0].text).toBe('Chorus')
    expect(parsed.sectionKeyContexts[0].sectionIndex).toBe(2)
  })

  it('ignores a second {key} that arrives before any section opened', () => {
    // Not a modulation — no section to modulate — so it records nothing and
    // leaves the song key alone. A sectionIndex of -1 would be meaningless.
    const parsed = parseChordPro('{key: C}\n{key: D}\n{verse}\n[C]x')
    expect(parsed.key).toBe('C')
    expect(parsed.sectionKeyContexts).toEqual([])
  })

  it('still reads a single {key} as the song key', () => {
    for (const key of ['G', 'Em', 'F', 'Gb']) {
      expect(parseChordPro(`{key: ${key}}\n[G]x`).key).toBe(key)
    }
  })

  it('records no sectional key for a chart that never modulates', () => {
    for (const key of ['G', 'Em', 'F']) {
      expect(parseChordPro(`{key: ${key}}\n[G]x`).sectionKeyContexts).toEqual([])
    }
  })
})

// ── sections ─────────────────────────────────────────────────────────────────

describe('parseChordPro — sections', () => {
  it('emits section/comment/lyrics types in document order', () => {
    const parsed = parseChordPro(DEMO_SAMPLE)
    expect(parsed.sections.map((s) => s.type)).toEqual(['comment', 'section', 'lyrics'])
    expect(parsed.sections[0].lines[0].text).toBe('Demo song')
    expect(parsed.sections[1].lines[0].text).toBe('Verse 1')
  })

  it('starts a NEW section whenever the type changes', () => {
    const parsed = parseChordPro('{section: A}\n[C]x\n{section: B}\n[G]y')
    expect(parsed.sections.map((s) => s.type)).toEqual(['section', 'lyrics', 'section', 'lyrics'])
  })

  it('shares one section across consecutive same-type lines', () => {
    const parsed = parseChordPro('{section: A}\n{section: B}')
    expect(parsed.sections).toHaveLength(1)
    expect(parsed.sections[0].lines.map((l) => l.text)).toEqual(['A', 'B'])
  })

  it('holds every lyric line of a run in one section', () => {
    const lines = onlyLyrics(parseChordPro(DEMO_SAMPLE)).lines
    expect(lines).toHaveLength(3)
    expect(lines.map((l) => l.text)).toEqual([
      "Imagine there's no heaven",
      'No hell beneath us',
      "It's easy if you try",
    ])
  })

  it('gives a section-header line an empty chord list', () => {
    expect(parseChordPro('{section: Chorus}').sections[0].lines[0]).toEqual({ text: 'Chorus', chords: [] })
  })

  it('drops a {section} or {comment} directive with an empty value', () => {
    expect(parseChordPro('{section}\n[C]x').sections.map((s) => s.type)).toEqual(['lyrics'])
    expect(parseChordPro('{comment}\n[C]x').sections.map((s) => s.type)).toEqual(['lyrics'])
  })

  it('keeps an unknown directive as a comment so nothing typed is lost', () => {
    // FINDING: it is a 'comment' TYPE section, not a lyric line, so a chord
    // living inside an unknown directive is invisible to readiness.js.
    const parsed = parseChordPro('{foo: bar}')
    expect(parsed.sections).toEqual([{ type: 'comment', lines: [{ text: 'bar', chords: [] }] }])
  })

  it('falls back to the directive name when an unknown directive has no value', () => {
    expect(parseChordPro('{foo}').sections[0].lines[0].text).toBe('foo')
    expect(parseChordPro('{foo: }').sections[0].lines[0].text).toBe('foo')
  })

  it('treats chords inside a {comment} directive as literal text', () => {
    const parsed = parseChordPro('{comment: [C]hello}\n[G]real')
    expect(parsed.sections[0]).toEqual({ type: 'comment', lines: [{ text: '[C]hello', chords: [] }] })
    expect(onlyLyrics(parsed).lines[0].chords).toEqual([{ chord: 'G', position: 0 }])
  })

  it('can never collide with the returned sections/sectionKeyContexts keys', () => {
    const parsed = parseChordPro('{sections: x}\n{sectionKeyContexts: y}')
    expect(parsed.sections).toHaveLength(1)
    expect(parsed.sections[0].lines.map((l) => l.text)).toEqual(['x', 'y'])
    expect(parsed.sectionKeyContexts).toEqual([])
  })
})

// ── inline [Chord] stripping ─────────────────────────────────────────────────

describe('parseChordPro — inline chord extraction', () => {
  it('records the chord and its column in the STRIPPED text', () => {
    const line = onlyLyrics(parseChordPro("[C]Imagine there's no [Em]heaven")).lines[0]
    expect(line.text).toBe("Imagine there's no heaven")
    expect(line.chords).toEqual([
      { chord: 'C', position: 0 },
      { chord: 'Em', position: 19 },
    ])
  })

  it('strips the chord from the text but keeps the space before it', () => {
    // "Amazing " keeps its trailing space, so [D] lands at column 8.
    const line = onlyLyrics(parseChordPro('[G]Amazing [D]grace')).lines[0]
    expect(line.text).toBe('Amazing grace')
    expect(line.chords).toEqual([{ chord: 'G', position: 0 }, { chord: 'D', position: 8 }])
  })

  it('preserves LEADING whitespace so columns stay aligned', () => {
    const line = onlyLyrics(parseChordPro('   [C]x')).lines[0]
    expect(line.text).toBe('   x')
    expect(line.chords).toEqual([{ chord: 'C', position: 3 }])
  })

  it('trims TRAILING whitespace, which can push a chord past the end of the text', () => {
    // FINDING: positions are computed before the trailing strip, so the chord
    // column (4) exceeds the stripped text length (1).
    const line = onlyLyrics(parseChordPro('x   [C]')).lines[0]
    expect(line.text).toBe('x')
    expect(line.chords).toEqual([{ chord: 'C', position: 4 }])
  })

  it('keeps a chord that sits at the very end of the line', () => {
    const line = onlyLyrics(parseChordPro('[C]x[C]')).lines[0]
    expect(line.text).toBe('x')
    expect(line.chords).toEqual([{ chord: 'C', position: 0 }, { chord: 'C', position: 1 }])
  })

  it('gives two adjacent chords the SAME position', () => {
    const line = onlyLyrics(parseChordPro('[C][D]x')).lines[0]
    expect(line.chords).toEqual([{ chord: 'C', position: 0 }, { chord: 'D', position: 0 }])
  })

  it('trims whitespace inside the brackets', () => {
    expect(onlyLyrics(parseChordPro('[ C ]x')).lines[0].chords).toEqual([{ chord: 'C', position: 0 }])
  })

  it('deletes an empty bracket pair from the text without recording a chord', () => {
    expect(onlyLyrics(parseChordPro('a[]b')).lines[0]).toEqual({ text: 'ab', chords: [] })
  })

  it('treats an unterminated bracket as literal text and counts it as a column', () => {
    const line = onlyLyrics(parseChordPro('foo[bar')).lines[0]
    expect(line.text).toBe('foo[bar')
    expect(line.chords).toEqual([])
  })

  it('gives a plain lyric line an empty chord list', () => {
    expect(onlyLyrics(parseChordPro('No hell beneath us')).lines[0]).toEqual({
      text: 'No hell beneath us',
      chords: [],
    })
  })

  it('counts columns in UTF-16 units, so astral characters cost two columns', () => {
    // FINDING: '\u{1F3B5}' is a surrogate pair, so the [C] after "emoji + space"
    // lands at column 3, one past the glyph the reader sees.
    const line = onlyLyrics(parseChordPro('\u{1F3B5} [C]x')).lines[0]
    expect(line.text).toBe('\u{1F3B5} x')
    expect(line.chords).toEqual([{ chord: 'C', position: 3 }])
  })

  it('handles a non-ASCII lyric line', () => {
    const line = onlyLyrics(parseChordPro('[C]Canción Café')).lines[0]
    expect(line.text).toBe('Canción Café')
    expect(line.chords).toEqual([{ chord: 'C', position: 0 }])
  })
})

// ── input coercion and non-directive lines ───────────────────────────────────

describe('parseChordPro — input coercion', () => {
  it('always returns a {meta…, sections, sectionKeyContexts} object', () => {
    for (const input of ['', null, undefined, 42, '{}']) {
      const parsed = parseChordPro(input)
      expect(Array.isArray(parsed.sections)).toBe(true)
      expect(parsed.sectionKeyContexts).toEqual([])
    }
  })

  it('turns empty / nullish / numeric input into ONE empty lyrics line', () => {
    const expected = { sections: [{ type: 'lyrics', lines: [{ text: '', chords: [] }] }], sectionKeyContexts: [] }
    expect(parseChordPro('')).toEqual(expected)
    expect(parseChordPro(null)).toEqual(expected)
    expect(parseChordPro(undefined)).toEqual(expected)
    expect(parseChordPro(42)).toEqual({ ...expected, sections: [{ type: 'lyrics', lines: [{ text: '42', chords: [] }] }] })
  })

  it('strips the CR of a CRLF chart without leaving it in the text', () => {
    const parsed = parseChordPro('[C]ab\r\nplain\r')
    expect(onlyLyrics(parsed).lines).toEqual([
      { text: 'ab', chords: [{ chord: 'C', position: 0 }] },
      { text: 'plain', chords: [] },
    ])
  })

  it('does not recognise a directive that is not at the start of the line', () => {
    const line = onlyLyrics(parseChordPro('foo {comment: x}')).lines[0]
    expect(line.text).toBe('foo {comment: x}')
    expect(line.chords).toEqual([])
  })

  it('falls through to lyrics when a directive value contains a stray brace', () => {
    const line = onlyLyrics(parseChordPro('{title: A } B}')).lines[0]
    expect(line.text).toBe('{title: A } B}')
  })

  it('does not mutate the input string or share state between calls', () => {
    const body = '[C]x'
    parseChordPro(body)
    expect(body).toBe('[C]x')
    expect(parseChordPro(body).sections).not.toBe(parseChordPro(body).sections)
  })
})

// ── a real seed chart end to end ─────────────────────────────────────────────

describe('parseChordPro — the seeded Amazing Grace chart', () => {
  it('splits into one header section per {section} plus two lyrics sections', () => {
    const parsed = parseChordPro(AMAZING_GRACE)
    expect(parsed.title).toBe('Amazing Grace')
    expect(parsed.artist).toBe('John Newton')
    expect(parsed.key).toBe('G')
    expect(parsed.sections.map((s) => s.type)).toEqual(['section', 'lyrics', 'section', 'lyrics'])
    expect(parsed.sections[1].lines).toHaveLength(4)
    expect(parsed.sections[3].lines).toHaveLength(4)
  })

  it('keeps the lyric text of every line, including the re-hyphenated ones', () => {
    const parsed = parseChordPro(AMAZING_GRACE)
    expect(parsed.sections[3].lines.map((l) => l.text)).toEqual([
      "'Twas grace that taught my heart to fear",
      'And grace my fears re-lieved',
      'How precious did that grace ap-pear',
      'The hour I first be-lieved',
    ])
  })

  it('places every inline chord at a column inside its stripped line', () => {
    const parsed = parseChordPro(AMAZING_GRACE)
    for (const section of parsed.sections.filter((s) => s.type === 'lyrics')) {
      for (const line of section.lines) {
        expect(line.chords.length).toBeGreaterThan(0)
        for (const c of line.chords) {
          expect(c.position).toBeGreaterThanOrEqual(0)
          expect(c.position).toBeLessThanOrEqual(line.text.length)
        }
      }
    }
  })
})

// ── demo() (the module's own self-check) ─────────────────────────────────────

describe('demo()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('demo() now PASSES its own sectional-key asserts', () => {
    // The assertion this replaces asserted demo() MUST throw, and that it throw
    // /expected "C", got "G"/ — a test that pinned the bug by demanding the
    // shipped self-check stay broken. demo() asserts `key === 'C'` for a
    // two-{key} sample and one recorded sectional key; both now hold, so
    // demo() reaches its console.log instead of dying on the first assert.
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      expect(() => demo()).not.toThrow()
      expect(log).toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })
})
