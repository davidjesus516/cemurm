// Chord transposition utility — pure functions, no DOM, no state.
// ponytail: handles root notes + common qualities (m, 7, maj7, dim, aug, sus, add, etc.).
// Does NOT handle polyphonic/slash chord bass transposition (e.g. C/E → D/F#).
// Upgrade path: full chord-parser library when slash-bass or complex voicings matter.

const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

// Prefer flats for keys that naturally use them
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'])

function noteIndex(name) {
  const i = NOTES_SHARP.indexOf(name)
  if (i !== -1) return { index: i, preferFlat: false }
  const j = NOTES_FLAT.indexOf(name)
  if (j !== -1) return { index: j, preferFlat: true }
  return null
}

function transposeNote(noteName, semitones, preferFlat) {
  const info = noteIndex(noteName)
  if (!info) return noteName
  const idx = (info.index + semitones % 12 + 12) % 12
  const useFlat = preferFlat !== undefined ? preferFlat : info.preferFlat
  return useFlat ? NOTES_FLAT[idx] : NOTES_SHARP[idx]
}

// Match chord root: optional flat/sharp, then note letter
const CHORD_RE = /^([A-G][#b]?)(.*)/

function transposeChord(chord, semitones, preferFlat) {
  const m = chord.match(CHORD_RE)
  if (!m) return chord
  const newRoot = transposeNote(m[1], semitones, preferFlat)
  return newRoot + m[2]
}

// Update a key string like "C major", "Am", "Bb" to transposed version
export function transposeKey(key, semitones) {
  if (!key) return key
  // Handle "Am", "Bbm" — note + modifier without space
  const m = key.match(/^([A-G][#b]?)(.*)$/)
  if (!m) return key
  const noteInfo = noteIndex(m[1])
  if (!noteInfo) return key
  const preferFlat = FLAT_KEYS.has(transposeNote(m[1], semitones, noteInfo.preferFlat))
  return transposeNote(m[1], semitones, preferFlat) + m[2]
}

/**
 * Transpose a parsed ChordPro object by N semitones.
 * Returns a new object — does not mutate the input.
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

// Self-check: node -e "import('./src/lib/transpose.js').then(m => m.demo())"
export function demo() {
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

  console.log('transpose demo OK')
}
