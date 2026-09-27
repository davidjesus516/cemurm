// @ts-check
// Pure JS ChordPro parser — no dependencies, no DOM (runs in Node and the browser).
// MVP scope: metadata directives ({title}/{key}/{artist}), {comment}/{section}
// annotations, plain lyric lines, and inline [Chord] annotations with the
// chord's column position preserved for rendering.
//
// Not implemented (later hito): transposition, chord theory/degrees, WASM,
// MusicXML/ABC, {start_of_*}/{end_of_*} blocks.

const KNOWN_META = new Set(['title', 'key', 'artist'])

/**
 * One inline [Chord] marker: the chord name plus the column it starts at in
 * the line's chord-stripped text (position drives rendering).
 * @typedef {object} ChordMark
 * @property {string} chord
 * @property {number} position
 */

/**
 * One line inside a section: the text with [Chord] markers stripped, plus the
 * markers that were removed. `chords: []` for directive/comment lines.
 * @typedef {object} ChordLine
 * @property {string} text
 * @property {ChordMark[]} chords
 */

/**
 * A run of consecutive lines. `type` is the directive that opened it:
 * 'comment', 'section' or 'lyrics' (the implicit default section).
 * @typedef {object} ChordSection
 * @property {string} type
 * @property {ChordLine[]} lines
 */

/**
 * A sectional key modulation: `{key: X}` inside a section records which
 * section it modulates, so the renderer can transpose from there.
 * @typedef {object} SectionKeyContext
 * @property {number} sectionIndex
 * @property {string} key
 */

/**
 * Directive metadata harvested from the chart body. The accumulator is a
 * free-form string map (any directive name is storable), while the parsed
 * result promotes the three directives the app reads.
 * @typedef {{ title?: string, key?: string, artist?: string }} ParsedMeta
 */

/**
 * A parsed {name, value} directive line, or null when the line is not one.
 * @typedef {object} Directive
 * @property {string} name
 * @property {string} value
 */

// Recognizes a directive line: {name: value} or {name}
/**
 * @param {string} line
 * @returns {Directive | null}
 */
function parseDirective(line) {
  const match = line.match(/^\s*\{([^:}]+):?\s*([^}]*)\}\s*$/)
  if (!match) return null
  return { name: match[1].trim().toLowerCase(), value: match[2].trim() }
}

// Strips inline [Chord] markers, returning the lyric text and each chord's
// column position in that stripped text.
/**
 * @param {string} line
 * @returns {ChordLine}
 */
function stripChords(line) {
  const chords = []
  let text = ''
  let position = 0
  let i = 0
  while (i < line.length) {
    if (line[i] === '[') {
      const end = line.indexOf(']', i + 1)
      if (end === -1) {
        // Unterminated bracket — treat literally.
        text += line[i]
        position += 1
        i += 1
        continue
      }
      const chord = line.slice(i + 1, end).trim()
      if (chord) chords.push({ chord, position })
      i = end + 1
      continue
    }
    text += line[i]
    position += 1
    i += 1
  }
  // Trailing whitespace is invisible; leading whitespace is kept so chord
  // positions stay aligned with columns.
  return { text: text.replace(/\s+$/, ''), chords }
}

/**
 * @param {string | null | undefined} text
 * @returns {ParsedMeta & { sections: ChordSection[], sectionKeyContexts: SectionKeyContext[] }}
 */
export function parseChordPro(text) {
  /** @type {Record<string, string>} */
  const meta = {}
  /** @type {ChordSection[]} */
  const sections = []
  /** @type {SectionKeyContext[]} */
  const sectionKeyContexts = []
  /** @type {ChordSection | null} */
  let current = null
  let currentSectionIndex = -1

  /**
   * @param {string} type
   * @returns {ChordSection}
   */
  function ensureSection(type) {
    if (!current || current.type !== type) {
      current = { type, lines: [] }
      sections.push(current)
      currentSectionIndex = sections.length - 1
    }
    return current
  }

  for (const raw of String(text ?? '').split('\n')) {
    const directive = parseDirective(raw)

    if (directive) {
      if (KNOWN_META.has(directive.name)) {
        meta[directive.name] = directive.value
        continue
      }
      if (directive.name === 'key') {
        // Sectional key context: {key: E} within a section records a
        // modulation. The song-level key is the first {key} directive; any
        // subsequent {key} within a section is a sectional override.
        if (meta.key === undefined) {
          meta.key = directive.value
        } else {
          ensureSection('lyrics')
          sectionKeyContexts.push({
            sectionIndex: currentSectionIndex,
            key: directive.value,
          })
        }
        continue
      }
      if (directive.name === 'section' || directive.name === 'comment') {
        if (directive.value) {
          ensureSection(directive.name).lines.push({ text: directive.value, chords: [] })
        }
        continue
      }
      // Unknown directive — tolerate it and keep it as a comment so nothing
      // typed into the chart silently disappears.
      ensureSection('comment').lines.push({ text: directive.value || directive.name, chords: [] })
      continue
    }

    ensureSection('lyrics').lines.push(stripChords(raw))
  }

  return { ...meta, sections, sectionKeyContexts }
}

// Self-check: run with `node -e "import('./src/domain/chart/parser.js').then(m => m.demo())"`
export function demo() {
  const sample = `{title: Imagine}
{artist: John Lennon}
{key: C}
{comment: Demo song}
{section: Verse 1}
[C]Imagine there's no [Em]heaven
No hell beneath us
[Am]It's easy if you [F]try`

  const parsed = parseChordPro(sample)

  /**
   * @param {unknown} actual
   * @param {unknown} expected
   * @param {string} label
   * @returns {void}
   */
  const expect = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`demo failed: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    }
  }

  expect(parsed.title, 'Imagine', 'title directive')
  expect(parsed.artist, 'John Lennon', 'artist directive')
  expect(parsed.key, 'C', 'key directive')
  expect(parsed.sections[0].type, 'comment', 'first section type')
  expect(parsed.sections[0].lines[0].text, 'Demo song', 'comment line')
  expect(parsed.sections[1].type, 'section', 'section header type')
  expect(parsed.sections[1].lines[0].text, 'Verse 1', 'section header text')

  const lines = parsed.sections[2].lines
  expect(lines.length, 3, 'lyric line count')
  expect(lines[0].text, "Imagine there's no heaven", 'stripped lyric text')
  expect(lines[0].chords.length, 2, 'two inline chords on line 1')
  expect(lines[0].chords[0].chord, 'C', 'first chord name')
  expect(lines[0].chords[0].position, 0, 'first chord position')
  expect(lines[0].chords[1].chord, 'Em', 'second chord name')
  expect(lines[0].chords[1].position, 19, 'second chord position')
  expect(lines[1].text, 'No hell beneath us', 'plain lyric line kept')
  expect(lines[1].chords.length, 0, 'plain lyric line has no chords')
  expect(lines[2].chords.length, 2, 'two inline chords on line 3')

  // Sectional key contexts
  expect(parsed.sectionKeyContexts.length, 0, 'no sectional keys in basic sample')

  const modSample = `{title: ModSong}
{key: C}
{section: Verse}
[C]Verse in C
{section: Chorus}
{key: G}
[G]Chorus in G`

  const modParsed = parseChordPro(modSample)
  expect(modParsed.key, 'C', 'song-level key is first directive')
  expect(modParsed.sectionKeyContexts.length, 1, 'one sectional key')
  expect(modParsed.sectionKeyContexts[0].key, 'G', 'sectional key is G')
  expect(typeof modParsed.sectionKeyContexts[0].sectionIndex, 'number', 'sectional key has sectionIndex')

  console.log('parser demo OK:', JSON.stringify(parsed, null, 2))
}