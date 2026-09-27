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

// Which spelling a key prefers, from the key's OWN name rather than a
// membership list. This replaces FLAT_KEYS, a set of six major key names, which
// had two defects the Gherkin does not allow:
//
//   - it was case- and whitespace-sensitive, so 'F minor' resolved to 'F' and
//     matched while 'Fminor' did not — the same key answered differently
//     depending on how it was written;
//   - it only listed MAJOR names, so every flat minor (F minor, Bb minor, Eb
//     minor, Ab minor, Db minor, Gb minor) and Cb major were read as sharp.
//
// The rule music-theory.feature states is "the key's preferred spelling", which
// is a property of the name itself. Three predicates cover all fifteen
// conventional keys:
//
//   1. the tonic carries a flat accidental — Bb, Eb, Ab, Db, Gb, Cb;
//   2. the tonic is F, which is one flat major and three flats minor, so its
//      own name has no accidental to carry the signature's;
//   3. the tonic is C AND the mode is minor, since C major has no accidentals
//      but C minor has three.
//
// That is the whole list, and there is no set to extend when a key is added:
// a new flat key is a name ending in 'b', and a new sharp key is anything else.

/**
 * @param {string} [key] e.g. "Bb", "F minor", "Gmaj7", "C#m"
 * @returns {boolean}
 */
function keyPrefersFlats(key) {
  const text = String(key || '').trim()
  const m = text.match(/^([A-G][#b]?)(.*)$/)
  if (!m) return false
  const [, tonic, rest] = m
  // The modifier carries the mode. A slash chord's bass note comes first so it
  // is dropped: 'C/E' is a C chord over E and the mode belongs to the C.
  //
  // Only 'm' and 'min' are minor markers. Nothing else is: in ChordPro a hyphen
  // is a diminished chord (C- is Cdim) and in lead-sheet spelling it is a sharp
  // (C- is C#), and 'dim' names a chord with no third at all. Both are sharp
  // keys for spelling purposes, and a version that read them as minor got both
  // wrong — Cdim as a minor key, C- as a minor key.
  //
  // The marker is tried longest-first and the leading space stripped, so
  // 'C minor' is not read as 'm' plus an extension called 'inor'. A lookahead
  // alone is not enough, because the space is part of what the regex sees.
  const mode = rest.split('/')[0].trim().replace(/^\s+/, '')
  if (/b$/.test(tonic)) return true
  if (tonic === 'F') return true
  if (tonic === 'C') return /^(minor|min|m)(?![a-z])/i.test(mode)
  return false
}

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

// Match chord root: optional flat/sharp, then note letter
const CHORD_RE = /^([A-G][#b]?)(.*)/

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
  const newRoot = transposeNote(m[1], semitones, preferFlat)
  return newRoot + m[2]
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
  // Handle "Am", "Bbm" — note + modifier without space
  const m = key.match(/^([A-G][#b]?)(.*)$/)
  if (!m) return key
  const noteInfo = noteIndex(m[1])
  if (!noteInfo) return key
  // The Gherkin is explicit that the TARGET key's spelling governs, so the
  // decision is made on the transposed name. It used to be made on the
  // transposed note alone, with the mode stripped: 'Gm' + 2 asked about 'A' and
  // never consulted that the key was minor. The mode now travels with the note.
  const target = transposeNote(m[1], semitones, noteInfo.preferFlat) + m[2]
  return transposeNote(m[1], semitones, keyPrefersFlats(target)) + m[2]
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
  return keyPrefersFlats(key)
}

/**
 * Smallest-shift distance from base to target key (3.6): G→D is −5 (perfect
 * fourth down), C→D is +2. Unparseable keys → 0.
 * @param {string} [baseKey]
 * @param {string} [targetKey]
 * @returns {number}
 */
export function semitonesBetween(baseKey, targetKey) {
  const base = String(baseKey || '').match(/^([A-G][#b]?)/)
  const target = String(targetKey || '').match(/^([A-G][#b]?)/)
  if (!base || !target) return 0
  const bi = noteIndex(base[1])
  const ti = noteIndex(target[1])
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

  const preferFlat = keyPrefersFlats(parsed.key)

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
