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

export function transposeChord(chord, semitones, preferFlat) {
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
 * Capo display (D7): "Capo N · sounds X" — X is the rendered key shifted by
 * the capo frets. Capo is a physical fret int, display-only: chord shapes
 * stay put; the sounding key for the band is X (scenario: rendered C + capo 2
 * → "Capo 2 · sounds D"). Empty string when no capo is set.
 */
export function capoLabel(renderedKey, capo) {
  if (!renderedKey || !capo) return ''
  return `Capo ${capo} · sounds ${transposeKey(renderedKey, capo)}`
}

// Flat preference for a key's root — mirrors transposeParsed's check, so
// annotations.js can reverse-lookup tokens enharmonically consistently.
export function preferFlatForKey(key) {
  return FLAT_KEYS.has(String(key || '').split(/\s+/)[0])
}

/**
 * Smallest-shift distance from base to target key (3.6): G→D is −5 (perfect
 * fourth down), C→D is +2. Unparseable keys → 0.
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
 */
export function initialSemitones(globalOffset, songOverride) {
  return Number(songOverride ?? globalOffset ?? 0)
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
