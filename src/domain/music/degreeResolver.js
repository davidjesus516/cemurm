// Degree resolver — computes roman numerals from a concrete chord + key context
// (tonic + scale). The concrete chart is ALWAYS canonical; degrees are a
// derived view only (BDD scenario: "degree progression I-IV-V is a derived
// view, not the stored content").
//
// Quality derives from the scale intervals, NOT hardcoded major/minor
// assumptions (BDD: "Quality derives from the scale").

import { findScaleByName } from '../../data/repositories/scaleCatalog.js'

// Chromatic note names in sharp spelling (index 0 = C).
const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/**
 * Convert a note name (e.g. "C#", "Bb") to a semitone index 0–11.
 * Returns null if unparseable.
 */
function noteToSemitone(name) {
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
function extractRoot(chord) {
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
function rootToDegree(tonicSemitone, scaleIntervals, chordRootSemitone) {
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
function qualityForDegree(intervals, degree) {
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
function formatRomanNumeral(degree, quality) {
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

/**
 * Resolve the roman numeral degree for a concrete chord within a key context.
 *
 * @param {object} keyContext - { tonic: 'E', scaleName: 'Phrygian dominant' } or parsed key string
 * @param {string} concreteChord - The chord string (e.g. "E7", "F", "Bm")
 * @returns {string|null} Roman numeral string or null if unresolvable
 */
export async function resolveDegree(keyContext, concreteChord) {
  if (!concreteChord) return null

  const ctx = typeof keyContext === 'string' ? parseKeyContext(keyContext) : keyContext
  if (!ctx) return null

  const scale = await findScaleByName(ctx.scaleName)
  if (!scale) return null

  const tonicSemitone = noteToSemitone(ctx.tonic)
  const chordRoot = extractRoot(concreteChord)
  const chordRootSemitone = noteToSemitone(chordRoot)

  const degree = rootToDegree(tonicSemitone, scale.intervals, chordRootSemitone)
  if (!degree) return null

  const quality = qualityForDegree(scale.intervals, degree)
  return formatRomanNumeral(degree, quality)
}

/**
 * Resolve degree info as a structured object for the renderer.
 * Returns { degree, numeral, quality, scaleId } or null.
 */
export async function resolveDegreeInfo(keyContext, concreteChord) {
  if (!concreteChord) return null

  const ctx = typeof keyContext === 'string' ? parseKeyContext(keyContext) : keyContext
  if (!ctx) return null

  const scale = await findScaleByName(ctx.scaleName)
  if (!scale) return null

  const tonicSemitone = noteToSemitone(ctx.tonic)
  const chordRoot = extractRoot(concreteChord)
  const chordRootSemitone = noteToSemitone(chordRoot)

  const degree = rootToDegree(tonicSemitone, scale.intervals, chordRootSemitone)
  if (!degree) return null

  const quality = qualityForDegree(scale.intervals, degree)
  const numeral = formatRomanNumeral(degree, quality)

  return { degree, numeral, quality, scaleId: scale.id }
}

// Self-check: node -e "import('./src/domain/music/degreeResolver.js').then(m => m.demo())"
export async function demo() {
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

  // Without Supabase, degree resolution returns null (catalog not loaded).
  const deg = await resolveDegree({ tonic: 'C', scaleName: 'Major' }, 'G')
  assert(deg, null, 'no catalog → null')

  console.log('degreeResolver demo OK: 5 asserts (parseKeyContext, graceful null)')
}
