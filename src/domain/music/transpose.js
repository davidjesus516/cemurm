// @ts-check
// Chord transposition utility — pure functions, no DOM, no state.
// ponytail: handles root notes + common qualities (m, 7, maj7, dim, aug, sus, add, etc.).
// Does NOT handle polyphonic/slash chord bass transposition (e.g. C/E → D/F#).
// Upgrade path: full chord-parser library when slash-bass or complex voicings matter.

/**
 * A note name: pitch-class letter with optional accidental, e.g. "C", "C#", "Bb".
 * @typedef {string} NoteName
 */

/**
 * A chord token as written in ChordPro, e.g. "C", "Am", "G7", "Bbmaj7".
 * @typedef {string} ChordToken
 */

/**
 * A key string like "C", "C major", "Am", "Bb".
 * @typedef {string} KeyName
 */

/**
 * A chord placed at a character position within a lyric line.
 * @typedef {{ chord: ChordToken, position: number }} PlacedChord
 */

/**
 * A lyric line of a parsed song: text plus overlaid chords.
 * @typedef {{ text: string, chords: PlacedChord[] }} ParsedLine
 */

/**
 * A section of a parsed song (verse, chorus, ...).
 * @typedef {{ type: string, lines: ParsedLine[] }} ParsedSection
 */

/**
 * A parsed ChordPro song: song key plus ordered sections.
 * @typedef {{ key: string, sections: ParsedSection[] }} ParsedSong
 */

export const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

// Prefer flats for keys that naturally use them
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'])

/**
 * Resolve a note name to its chromatic index (0–11) and whether its spelling
 * prefers flats. Returns null for unparseable input.
 * @param {string} name
 * @returns {{ index: number, preferFlat: boolean } | null}
 */
function noteIndex(name) {
  const i = NOTES_SHARP.indexOf(name)
  if (i !== -1) return { index: i, preferFlat: false }
  const j = NOTES_FLAT.indexOf(name)
  if (j !== -1) return { index: j, preferFlat: true }
  return null
}

/**
 * Transpose a single note name by N semitones (octave-wrapped). Uses the
 * note's own spelling preference unless overridden.
 * @param {NoteName} noteName
 * @param {number} semitones
 * @param {boolean} [preferFlat] optional — override the note's default spelling
 * @returns {NoteName}
 */
function transposeNote(noteName, semitones, preferFlat) {
  const info = noteIndex(noteName)
  if (!info) return noteName
  const idx = (info.index + semitones % 12 + 12) % 12
  const useFlat = preferFlat !== undefined ? preferFlat : info.preferFlat
  return useFlat ? NOTES_FLAT[idx] : NOTES_SHARP[idx]
}

// Root note, optional accidental, everything else as the suffix.
//
// ChordPro's own spec treats the root as case-insensitive, accepts three
// spellings for a flat ('B♭', 'Bb', 'Bes') and the two unicode accidentals, and
// reserves a lowercase root for "this is a note, not a chord" when the `notes`
// config is enabled — so none of these is an error, they are the same chord
// written four ways.
//
// The regex used to be uppercase-only, so 'am' matched nothing and
// transposeChord returned it untouched, and 'B♭' matched only 'B' and carried
// '♭' into the suffix, producing 'C#♭'. Both are reachable from a stored chart:
// the parser keeps the token verbatim.
const CHORD_RE = /^(Bes|bes|BES|[A-Ga-g][#b♭♯]?)(.*)/

/**
 * Normalise a root to the app's uppercase + ASCII-accidental spelling.
 *
 * ChordPro accepts three spellings for a flat — `B♭`, `Bb` and `Bes` — the two
 * unicode accidentals `♭` (U+266D) and `♯` (U+266F), and treats the root as
 * case-insensitive, so all of them have to land on one form. `♭` and `b` both
 * mean flat; `♯` and `#` both mean sharp. `Bes` is German, and its `es` is part
 * of the ACCIDENTAL rather than a suffix, so it collapses to `Bb` and the `es`
 * must not survive as one — otherwise `Besm` becomes `C#esm`.
 *
 * Folding the unicode accidentals into the ASCII ones is what stops a pasted
 * chart from rendering a note name no musician writes. The stored text keeps
 * whatever the author typed; only the rendered name is normalised.
 *
 * Only the LETTER is case-folded. The accidental is left alone, which is what
 * keeps a lowercased `bb` meaning B-flat (`B` + flat `b`) rather than colliding
 * with the letter `b`.
 *
 * @param {string} raw
 * @returns {string | null} null only for an empty capture
 */
function normalizeRoot(raw) {
  if (!raw) return null
  if (raw === 'Bes' || raw === 'bes' || raw === 'BES') return 'Bb'
  const note = raw[0].toUpperCase()
  const accidental = raw.slice(1)
  if (accidental === '♭' || accidental === 'b') return `${note}b`
  if (accidental === '♯' || accidental === '#') return `${note}#`
  return note
}

/**
 * Transpose a chord token by N semitones: transposes the root, keeps the
 * quality suffix (e.g. "Am" → "Cm" at +3). Unparseable chords pass through.
 * @param {ChordToken} chord
 * @param {number} semitones
 * @param {boolean} [preferFlat]
 * @returns {ChordToken}
 */
export function transposeChord(chord, semitones, preferFlat) {
  const m = chord.match(CHORD_RE)
  if (!m) return chord
  // transposeNote is what rejects a note it has no table for, and an
  // unrecognised root comes back as the name itself, which leaves the token
  // untouched — the behaviour this branch already had.
  const root = normalizeRoot(m[1])
  if (!root) return chord
  return transposeNote(root, semitones, preferFlat) + m[2]
}

/**
 * Transpose a key string like "C major", "Am" or "Bb" by N semitones.
 * Flat-key roots stay flat (key's natural spelling wins), otherwise sharps.
 * @param {KeyName} key
 * @param {number} semitones
 * @returns {KeyName}
 */
export function transposeKey(key, semitones) {
  if (!key) return key
  // Handle "Am", "Bbm" — note + modifier without space.
  //
  // 'Bes' is German for B-flat and is the one flat spelling whose accidental is
  // written with LETTERS, so it cannot be expressed as [A-G][#b♭]? and would be
  // read as the note 'B' plus the modifier 'es'. It is rewritten to the ASCII
  // form first so everything below is a single code path.
  const german = /^(Bes|bes|BES)(.*)$/.exec(key)
  const spelled = german ? `Bb${german[2]}` : key
  //
  // Uppercase-only, unlike CHORD_RE. A key tonic starting with a lowercase letter
  // is not accepted: the text after a key's tonic is a modifier ('Am', 'Bbm'), so
  // 'atonal' would parse as the note 'a' plus the modifier 'tonal' and transpose
  // to the invented 'Btonal'. The ChordPro lowercase convention ('[f] [g] [a]')
  // is a CHORD token in the body, which is what CHORD_RE covers. A `{key: am}`
  // in a chart is returned verbatim, exactly as before this change.
  const m = spelled.match(/^([A-G][#b♭♯]?)(.*)$/)
  if (!m) return key
  const root = normalizeRoot(m[1])
  const noteInfo = root && noteIndex(root)
  if (!noteInfo) return key
  const preferFlat = FLAT_KEYS.has(transposeNote(root, semitones, noteInfo.preferFlat))
  return transposeNote(root, semitones, preferFlat) + m[2]
}

/**
 * Capo display (D7): "Capo N · sounds X" — X is the rendered key shifted by
 * the capo frets. Capo is a physical fret int, display-only: chord shapes
 * stay put; the sounding key for the band is X (scenario: rendered C + capo 2
 * → "Capo 2 · sounds D"). Empty string when no capo is set.
 * @param {KeyName} renderedKey
 * @param {number} capo — physical fret count; 0/null → no label
 * @returns {string}
 */
export function capoLabel(renderedKey, capo) {
  if (!renderedKey || !capo) return ''
  return `Capo ${capo} · sounds ${transposeKey(renderedKey, capo)}`
}

/**
 * Flat preference for a key's root — mirrors transposeParsed's check, so
 * annotations.js can reverse-lookup tokens enharmonically consistently.
 * @param {string} [key]
 * @returns {boolean}
 */
export function preferFlatForKey(key) {
  return FLAT_KEYS.has(String(key || '').split(/\s+/)[0])
}

/**
 * Smallest-shift distance from base to target key (3.6): G→D is −5 (perfect
 * fourth down), C→D is +2. Unparseable keys → 0.
 * @param {string} [baseKey]
 * @param {string} [targetKey]
 * @returns {number}
 */
export function semitonesBetween(baseKey, targetKey) {
  // '♭' and '♯' are accepted for the same reason as in transposeKey: they are
  // real spellings of a flat and a sharp, and matching only the 'B' of 'B♭'
  // measured the distance to B-natural. Lowercase is not accepted — a key is a
  // note name, and 'atonal' must not measure as the note 'a'.
  const base = String(baseKey || '').match(/^([A-G][#b♭♯]?)/)
  const target = String(targetKey || '').match(/^([A-G][#b♭♯]?)/)
  if (!base || !target) return 0
  const baseRoot = normalizeRoot(base[1])
  const targetRoot = normalizeRoot(target[1])
  if (!baseRoot || !targetRoot) return 0
  const bi = noteIndex(baseRoot)
  const ti = noteIndex(targetRoot)
  if (!bi || !ti) return 0
  let diff = (ti.index - bi.index + 12) % 12
  if (diff > 6) diff -= 12
  return diff
}

/**
 * Initial view semitones (D7): per-song override REPLACES the global offset
 * for that song (spec per-song override scenario: "explicit per-song
 * preference wins"). Seeds StageMode/Practice; fallback to global, else 0.
 * @param {number} [globalOffset]
 * @param {number} [songOverride]
 * @returns {number}
 */
export function initialSemitones(globalOffset, songOverride) {
  return Number(songOverride ?? globalOffset ?? 0)
}

/**
 * Transpose a parsed ChordPro object by N semitones.
 * Returns a new object — does not mutate the input.
 * @param {ParsedSong} parsed
 * @param {number} semitones — 0/undefined → input returned as-is
 * @returns {ParsedSong}
 */
export function transposeParsed(parsed, semitones) {
  if (!semitones) return parsed

  const preferFlat = FLAT_KEYS.has(parsed.key?.split(/\s+/)[0])

  const sections = parsed.sections.map((section) => ({
    ...section,
    lines: section.lines.map((line) => ({
      ...line,
      chords: line.chords.map((c) => ({
        ...c,
        chord: transposeChord(c.chord, semitones, preferFlat),
      })),
    })),
  }))

  return {
    ...parsed,
    key: transposeKey(parsed.key, semitones),
    sections,
  }
}

// Self-check: node -e "import('./src/domain/music/transpose.js').then(m => m.demo())"
export function demo() {
  /**
   * @param {unknown} a
   * @param {unknown} b
   * @param {string} msg
   */
  const assert = (a, b, msg) => {
    if (a !== b) throw new Error(`transpose demo FAILED: ${msg} — got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`)
  }

  assert(transposeNote('C', 2), 'D', 'C + 2 semitones')
  assert(transposeNote('C', -1), 'B', 'C - 1 semitone')
  assert(transposeNote('C', 12), 'C', 'C + 12 is octave')
  assert(transposeNote('Bb', 2, true), 'C', 'Bb + 2 with flat preference')
  assert(transposeChord('Am', 3), 'Cm', 'Am + 3 semitones')
  assert(transposeChord('G7', 5), 'C7', 'G7 + 5 semitones')
  assert(transposeChord('Bbmaj7', 2, true), 'Cmaj7', 'Bbmaj7 + 2 flat pref')
  assert(transposeKey('C major', 5), 'F major', 'key C→F')
  assert(transposeKey('Am', 3), 'Cm', 'key Am→Cm')

  const parsed = { key: 'C', sections: [{ type: 'lyrics', lines: [{ text: 'Hello', chords: [{ chord: 'C', position: 0 }, { chord: 'G', position: 5 }] }] }] }
  const t = transposeParsed(parsed, 5)
  assert(t.key, 'F', 'parsed key transposed')
  assert(t.sections[0].lines[0].chords[0].chord, 'F', 'first chord transposed')
  assert(t.sections[0].lines[0].chords[1].chord, 'C', 'second chord transposed')
  assert(parsed.sections[0].lines[0].chords[0].chord, 'C', 'original not mutated')

  // D7 capo display + initial semitones (3.3).
  assert(capoLabel('C', 2), 'Capo 2 · sounds D', 'capo 2 over rendered C sounds D')
  assert(capoLabel('Am', 3), 'Capo 3 · sounds Cm', 'minor key capo label')
  assert(capoLabel('C', 0), '', 'no capo → no label')
  assert(capoLabel('', 2), '', 'no rendered key → no label')
  assert(initialSemitones(2, undefined), 2, 'global offset alone')
  assert(initialSemitones(2, -1), -1, 'override replaces global')
  assert(initialSemitones(2, 0), 0, 'explicit override 0 wins over global')
  assert(initialSemitones(0, -1), -1, 'override alone')
  assert(initialSemitones(undefined, 2), 2, 'override without global')
  assert(initialSemitones(undefined, undefined), 0, 'no prefs → 0')

  // 3.6 practice key: shortest-shift distance (G→D = −5, C→D = +2).
  assert(semitonesBetween('G', 'D'), -5, 'G→D practice key is a fourth down')
  assert(semitonesBetween('C', 'D'), 2, 'C→D is a whole step up')
  assert(semitonesBetween('Bb', 'F'), -5, 'flat keys shortest path Bb→F')
  assert(semitonesBetween('C', 'C'), 0, 'same key → 0')
  assert(preferFlatForKey('Bb major'), true, 'flat key prefers flats')

  console.log('transpose demo OK: 28 asserts (notes, keys, parsed, capo, initial semitones, semitonesBetween)')
}
