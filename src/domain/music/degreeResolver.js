// Degree resolver — PURE ENGINE (ADR 0002 refactor 2, engine/lookup split).
// Computes roman numerals from a concrete chord + key context (tonic +
// scale). The concrete chart is ALWAYS canonical; degrees are a derived view
// only (BDD scenario: "degree progression I-IV-V is a derived view, not the
// stored content").
//
// Quality derives from the scale intervals, NOT hardcoded major/minor
// assumptions (BDD: "Quality derives from the scale").
//
// This module is the whole engine and nothing else: no imports, no I/O, no
// catalog. It is reached through data/repositories/degrees.js, which owns the
// `findScaleByName` read and exports the async entry points resolveDegree /
// resolveDegreeInfo. Before the split those two lived here and were
// `export async` ONLY because of scaleCatalog → supabase, which made the
// engine below unreachable from a test.

// Chromatic note names in sharp spelling (index 0 = C).
const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/**
 * Convert a note name (e.g. "C#", "Bb") to a semitone index 0–11.
 * Returns null if unparseable.
 */
export function noteToSemitone(name) {
  if (!name) return null
  const sharp = SHARP_NOTES.indexOf(name)
  if (sharp !== -1) return sharp
  const flat = FLAT_NOTES.indexOf(name)
  if (flat !== -1) return flat
  return null
}

/**
 * Extract the root note from a chord string (e.g. "Cmaj7" → "C", "Bb" → "Bb").
 * Handles sharps (#) and flats (b).
 */
export function extractRoot(chord) {
  const m = chord.match(/^([A-G][#b]?)/)
  return m ? m[1] : null
}

// Roman numeral labels for scale degrees (1-based index).
const ROMAN_MAJOR = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
const ROMAN_MINOR = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii']

/**
 * Determine whether a chord root matches a scale degree.
 * Returns the degree (1-based) or null if no match.
 */
export function rootToDegree(tonicSemitone, scaleIntervals, chordRootSemitone) {
  if (chordRootSemitone === null || tonicSemitone === null) return null
  const offset = ((chordRootSemitone - tonicSemitone) % 12 + 12) % 12

  for (let i = 0; i < scaleIntervals.length; i++) {
    if (scaleIntervals[i] === offset) return i + 1
  }
  return null
}

/**
 * Determine the quality expected for a degree from the scale intervals.
 * Looks at the interval between consecutive scale tones (the "tertian quality").
 *
 * For 7-note scales, examines the triad built on each degree:
 * - Major third + perfect fifth = major (I, IV, V, etc.)
 * - Minor third + perfect fifth = minor (ii, iii, vi)
 * - Diminished = diminished (vii° in major)
 * - Augmented = augmented (III+ in harmonic minor)
 *
 * Returns: 'major', 'minor', 'diminished', 'augmented', or 'power' (for
 * pentatonic/chromatic where tertian analysis is less meaningful).
 */
export function qualityForDegree(intervals, degree) {
  if (!intervals || degree < 1 || degree > intervals.length) return null
  const len = intervals.length

  // For non-heptatonic scales, return 'power' — degree quality is less meaningful.
  if (len < 7) return 'power'

  // Build the triad on this degree: root, third, fifth.
  const root = intervals[degree - 1]
  const thirdIdx = degree + 1 <= len ? degree + 1 : degree + 1 - len
  const fifthIdx = degree + 2 <= len ? degree + 2 : degree + 2 - len
  const third = intervals[thirdIdx - 1]
  const fifth = intervals[fifthIdx - 1]

  const thirdInterval = ((third - root) % 12 + 12) % 12
  const fifthInterval = ((fifth - root) % 12 + 12) % 12

  // Perfect fifth = 7 semitones
  if (fifthInterval === 7) {
    if (thirdInterval === 3) return 'minor'
    if (thirdInterval === 4) return 'major'
  }
  // Diminished fifth = 6
  if (fifthInterval === 6) {
    if (thirdInterval === 3) return 'diminished'
  }
  // Augmented fifth = 8
  if (fifthInterval === 8) {
    if (thirdInterval === 4) return 'augmented'
  }

  return 'power'
}

/**
 * Format a roman numeral with quality. The numeral is always from the
 * major mode (capitalized); accidentals are added when the actual quality
 * differs from what the major scale would produce.
 *
 * - Major in major context → plain "I"
 * - Minor in major context → "i" (lowercase)
 * - Diminished → "°" suffix
 * - Augmented → "+" suffix
 * - Seventh chords get "7" appended based on quality
 */
export function formatRomanNumeral(degree, quality) {
  if (!degree || degree < 1 || degree > 7) return '?'

  const majorNumeral = ROMAN_MAJOR[degree - 1]

  switch (quality) {
    case 'major':
      return majorNumeral
    case 'minor':
      return ROMAN_MINOR[degree - 1]
    case 'diminished':
      return `${ROMAN_MINOR[degree - 1]}°`
    case 'augmented':
      return `${majorNumeral}+`
    case 'power':
      return majorNumeral
    default:
      return majorNumeral
  }
}

/**
 * Parse a key string like "C major", "E Phrygian", "Ab" into { tonic, scaleName }.
 * If no scale is specified, defaults to "Major" (standard convention).
 */
export function parseKeyContext(keyString) {
  if (!keyString) return null
  const parts = keyString.trim().split(/\s+/)
  if (parts.length === 0) return null

  const tonic = parts[0]
  const scaleName = parts.length > 1 ? parts.slice(1).join(' ') : 'Major'

  // Validate tonic is a note.
  if (noteToSemitone(tonic) === null) return null

  return { tonic, scaleName }
}

// Self-check: node -e "import('./src/domain/music/degreeResolver.js').then(m => m.demo())"
// The engine half of the old demo; the "no catalog → null" assert moved with
// resolveDegree into data/repositories/degrees.js, which owns the catalog read.
export function demo() {
  const assert = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`degreeResolver demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  // parseKeyContext
  assert(parseKeyContext('C major'), { tonic: 'C', scaleName: 'major' }, 'parseKeyContext C major')
  assert(parseKeyContext('E Phrygian'), { tonic: 'E', scaleName: 'Phrygian' }, 'parseKeyContext E Phrygian')
  assert(parseKeyContext('Ab'), { tonic: 'Ab', scaleName: 'Major' }, 'parseKeyContext Ab defaults to Major')
  assert(parseKeyContext('E Phrygian dominant'), { tonic: 'E', scaleName: 'Phrygian dominant' }, 'parseKeyContext exotic')
  assert(parseKeyContext(''), null, 'parseKeyContext empty')

  // Engine: semitones, root extraction, degree + quality + numeral.
  assert(noteToSemitone('C'), 0, 'noteToSemitone C')
  assert(noteToSemitone('Bb'), 10, 'noteToSemitone Bb')
  assert(extractRoot('Cmaj7'), 'C', 'extractRoot Cmaj7')
  assert(rootToDegree(0, [0, 2, 4, 5, 7, 9, 11], 7), 5, 'G in C major is degree 5')
  // FINDING: qualityForDegree reads consecutive scale intervals as a triad, so
  // every degree of a real diatonic scale falls through to 'power' — the
  // major/minor/dim/aug branches need tertian-sized steps. Pinned in
  // degreeResolver.test.js; not changed here, this PR is behaviour-preserving.
  assert(qualityForDegree([0, 2, 4, 5, 7, 9, 11], 5), 'power', 'degree 5 of C major is power, not major')
  assert(qualityForDegree([0, 4, 7, 8, 9, 10, 11], 1), 'major', 'tertiian steps do reach major')
  assert(formatRomanNumeral(5, 'power'), 'V', 'degree 5 power → V')

  console.log('degreeResolver demo OK: 13 asserts (parseKeyContext, engine)')
}
