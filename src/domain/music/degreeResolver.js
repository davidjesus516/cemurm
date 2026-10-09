// @ts-check
// Degree resolver — computes roman numerals from a concrete chord + key context
// (tonic + scale). The concrete chart is ALWAYS canonical; degrees are a
// derived view only (BDD scenario: "degree progression I-IV-V is a derived
// view, not the stored content").
//
// Quality derives from the scale intervals, NOT hardcoded major/minor
// assumptions (BDD: "Quality derives from the scale").

/**
 * What degree resolution needs from a scale: its id (echoed back in DegreeInfo)
 * and its semitone intervals — the entire musical content of the answer.
 *
 * Declared structurally rather than imported from
 * src/data/repositories/scaleCatalog.js. This module used to import that
 * repository and look the scale up itself, which made pure music theory perform
 * a network read to resolve a name. It now states what it requires instead of
 * pointing at whoever happens to supply it: the dependency points inward, and a
 * catalog row satisfies this by shape.
 *
 * @typedef {{ id: string, intervals: number[] }} ResolvableScale
 */

/**
 * The tertian quality qualityForDegree derives from a scale's own intervals.
 * 'power' is the honest answer for pentatonic/chromatic scales (cardinality
 * < 7) and for any root-third-fifth that is neither major/minor/dim/aug, so
 * the arm is part of the real surface, not a catch-all wildcard.
 * @typedef {'major' | 'minor' | 'diminished' | 'augmented' | 'suspended' | 'power'} DegreeQuality
 */

/**
 * A parsed key context: the tonic note plus the name the scale catalog is
 * looked up by. parseKeyContext defaults scaleName to 'Major' when the key
 * string names no scale, and leaves it in the STRING'S OWN casing ('C major'
 * → scaleName 'major'), which is what findScaleByName normalises.
 * @typedef {object} KeyContext
 * @property {string} tonic
 * @property {string} scaleName
 */

/**
 * The structured degree the renderer consumes.
 * @typedef {object} DegreeInfo
 * @property {number} degree
 * @property {string} numeral
 * @property {DegreeQuality | null} quality
 * @property {string} scaleId
 */

// Chromatic note names in sharp spelling (index 0 = C).
const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/**
 * Convert a note name (e.g. "C#", "Bb") to a semitone index 0–11.
 * Returns null if unparseable.
 * @param {string | null | undefined} name
 * @returns {number | null}
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
 * @param {string} chord
 * @returns {string | null}
 */
function extractRoot(chord) {
  const m = chord.match(/^([A-G][#b]?)/)
  return m ? m[1] : null
}

/**
 * Read the quality a chord spells out for itself, or null when it spells none.
 *
 * The scale is the fallback, not the authority: `music-theory.feature` says a
 * musician's explicit chord wins over the derived one, and until this existed
 * the suffix was never parsed, so an `E7` and a bare `E` were indistinguishable
 * and the override scenario could not pass.
 *
 * Returns { triad, seventh } — triad is one of major|minor|diminished|augmented
 * |power|suspended, seventh is 7|m7|M7|dim7|null.
 * @param {string | null | undefined} chord
 * @returns {{ triad: DegreeQuality, seventh: string | null } | null}
 */
function parseChordQuality(chord) {
  const suffix = String(chord || '').replace(/^[A-G][#b]?/, '').toLowerCase()
  if (!suffix) return null

  // Order matters: the more specific markers are tested before the bare ones.
  // `maj7` must be matched before `m7`, or a minor seventh is read as a major
  // one — a first version used `m(aj)?7` and rendered Cm7 as Imaj7.
  if (/^(dim|o)(7)?$/.test(suffix)) return { triad: 'diminished', seventh: /7$/.test(suffix) ? 'dim7' : null }
  if (/^(aug|\+)(7)?$/.test(suffix)) return { triad: 'augmented', seventh: null }
  if (/^maj7$/.test(suffix)) return { triad: 'major', seventh: 'M7' }
  if (/^(m|min|-)7$/.test(suffix)) return { triad: 'minor', seventh: 'm7' }
  if (/^7$/.test(suffix)) return { triad: 'major', seventh: '7' }
  if (/^(m|min|-)(9|11|13)?$/.test(suffix)) return { triad: 'minor', seventh: null }
  if (/^maj(9|11|13)?$/.test(suffix)) return { triad: 'major', seventh: null }
  if (/^(9|11|13)$/.test(suffix)) return { triad: 'major', seventh: '7' }
  if (/^sus(2|4)?$/.test(suffix)) return { triad: 'suspended', seventh: null }
  if (/^5$/.test(suffix)) return { triad: 'power', seventh: null }
  if (/^(maj|M)$/.test(suffix)) return { triad: 'major', seventh: null }
  return null
}

// Roman numeral labels for scale degrees (1-based index).
const ROMAN_MAJOR = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
const ROMAN_MINOR = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii']

/**
 * Determine whether a chord root matches a scale degree.
 * Returns the degree (1-based) or null if no match.
 * @param {number | null} tonicSemitone
 * @param {ResolvableScale['intervals']} scaleIntervals
 * @param {number | null} chordRootSemitone
 * @returns {number | null}
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
 * @param {ResolvableScale['intervals']} intervals
 * @param {number} degree
 * @returns {DegreeQuality | null}
 */
function qualityForDegree(intervals, degree) {
  if (!intervals || degree < 1 || degree > intervals.length) return null
  const len = intervals.length

  // For non-heptatonic scales, return 'power' — degree quality is less meaningful.
  if (len < 7) return 'power'

  // The triad on this degree stacks SCALE DEGREES 1, 3 and 5, which are
  // `degree`, `degree + 2` and `degree + 4` steps around the scale. This used to
  // read `degree` and `degree + 1` — the next two scale STEPS, one degree too
  // near each time. Consecutive steps of a heptatonic scale essentially never
  // span a perfect fifth, so the function returned 'power' for all 49
  // degree/scale pairs measured, and every modal degree rendered as a capital.
  const at = (/** @type {number} */ step) => intervals[(((step - 1) % len) + len) % len]
  const root = at(degree)
  const third = at(degree + 2)
  const fifth = at(degree + 4)

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
 * @param {number} degree
 * @param {DegreeQuality | null} quality
 * @param {string | null} [seventh]
 * @returns {string}
 */
function formatRomanNumeral(degree, quality, seventh) {
  if (!degree || degree < 1 || degree > 7) return '?'

  const majorNumeral = ROMAN_MAJOR[degree - 1]
  const minorNumeral = ROMAN_MINOR[degree - 1]
  const withSeventh = (/** @type {string} */ numeral) => {
    if (!seventh) return numeral
    if (seventh === 'm7') return `${numeral}7`
    if (seventh === 'M7') return `${numeral}maj7`
    // The diminished triad already carries its °, so a dim7 adds only the 7.
    // Appending '°7' as well produced 'i°°7'.
    if (seventh === 'dim7') return `${numeral}7`
    return `${numeral}7`
  }

  switch (quality) {
    case 'major':
      return withSeventh(majorNumeral)
    case 'minor':
      return withSeventh(minorNumeral)
    case 'diminished':
      return withSeventh(`${minorNumeral}°`)
    case 'augmented':
      return `${majorNumeral}+`
    // A suspended chord has no third, so the scale's quality does not apply and
    // there is nothing to derive — only the written "sus" survives.
    case 'suspended':
      return withSeventh(majorNumeral)
    case 'power':
      return majorNumeral
    default:
      return majorNumeral
  }
}

/**
 * Parse a key string like "C major", "E Phrygian", "Ab" into { tonic, scaleName }.
 * If no scale is specified, defaults to "Major" (standard convention).
 * @param {string | null | undefined} keyString
 * @returns {KeyContext | null}
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
 * @param {string | KeyContext} keyContext - { tonic: 'E', scaleName: 'Phrygian dominant' } or parsed key string
 * @param {string | null | undefined} concreteChord - The chord string (e.g. "E7", "F", "Bm")
 * @param {ResolvableScale | null | undefined} scale - The already-resolved scale.
 *   Callers look it up (src/data/repositories/scaleCatalog.js); this module never
 *   fetches anything, so it is synchronous.
 * @returns {string | null} Roman numeral string or null if unresolvable
 */
export function resolveDegree(keyContext, concreteChord, scale) {
  if (!concreteChord) return null

  const ctx = typeof keyContext === 'string' ? parseKeyContext(keyContext) : keyContext
  if (!ctx) return null

  if (!scale) return null

  const tonicSemitone = noteToSemitone(ctx.tonic)
  const chordRoot = extractRoot(concreteChord)
  const chordRootSemitone = noteToSemitone(chordRoot)

  const degree = rootToDegree(tonicSemitone, scale.intervals, chordRootSemitone)
  if (!degree) return null

  // The chord's own spelling outranks the scale; the scale only fills the gap.
  const explicit = parseChordQuality(concreteChord)
  const quality = explicit ? explicit.triad : qualityForDegree(scale.intervals, degree)
  return formatRomanNumeral(degree, quality, explicit?.seventh)
}

/**
 * Resolve degree info as a structured object for the renderer.
 * Returns { degree, numeral, quality, scaleId } or null.
 * @param {string | KeyContext} keyContext - Parsed key string or { tonic, scaleName }
 * @param {string | null | undefined} concreteChord
 * @param {ResolvableScale | null | undefined} scale - The already-resolved scale; see resolveDegree.
 * @returns {DegreeInfo | null}
 */
export function resolveDegreeInfo(keyContext, concreteChord, scale) {
  if (!concreteChord) return null

  const ctx = typeof keyContext === 'string' ? parseKeyContext(keyContext) : keyContext
  if (!ctx) return null

  if (!scale) return null

  const tonicSemitone = noteToSemitone(ctx.tonic)
  const chordRoot = extractRoot(concreteChord)
  const chordRootSemitone = noteToSemitone(chordRoot)

  const degree = rootToDegree(tonicSemitone, scale.intervals, chordRootSemitone)
  if (!degree) return null

  const explicit = parseChordQuality(concreteChord)
  const quality = explicit ? explicit.triad : qualityForDegree(scale.intervals, degree)
  const numeral = formatRomanNumeral(degree, quality, explicit?.seventh)

  return { degree, numeral, quality, scaleId: scale.id }
}

// Self-check: node -e "import('./src/domain/music/degreeResolver.js').then(m => m.demo())"
export function demo() {
  /**
   * @param {unknown} actual
   * @param {unknown} expected
   * @param {string} label
   */
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

  // No scale → null. This used to assert "Supabase was unreachable", which
  // depended on the environment rather than on the argument. The scale is a
  // parameter now, so the check is deterministic and can also be positive.
  const C_MAJOR = { id: 'major', intervals: [0, 2, 4, 5, 7, 9, 11] }
  assert(resolveDegree({ tonic: 'C', scaleName: 'Major' }, 'G', null), null, 'no scale → null')
  assert(resolveDegree({ tonic: 'C', scaleName: 'Major' }, 'G', C_MAJOR), 'V', 'G is the fifth of C major')
  assert(resolveDegree({ tonic: 'C', scaleName: 'Major' }, 'Fm', C_MAJOR), 'iv', 'explicit minor triad wins over the scale at degree 4')

  console.log('degreeResolver demo OK: 8 asserts (parseKeyContext, injected scale, graceful null)')
}
