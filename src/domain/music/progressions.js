// @ts-check
// Client-side progression catalog — common chord progressions searchable
// by degree pattern. "The concrete chart is canonical; degrees are a
// derived view." Progression search matches declared degree patterns only;
// songs with no key never match (BDD: "keyless songs never match
// progression search").

/**
 * @typedef {object} Progression
 * @property {string} name        - Human label (e.g. "ii-V-I")
 * @property {string} pattern     - Degree pattern string for display/search
 * @property {string[]} degrees   - Array of scale-degree tokens (e.g. ["ii","V","I"])
 * @property {string} family      - Genre/style family
 * @property {string} description - Short description
 */

/** @type {Progression[]} */
const PROGRESSIONS = [
  // ── Diatonic staples ──────────────────────────────────────────────────────
  {
    name: 'I-IV-V',
    pattern: 'I - IV - V',
    degrees: ['I', 'IV', 'V'],
    family: 'Blues/Rock',
    description: 'The backbone of blues, rock, and country. Three chords, noFiller.',
  },
  {
    name: 'I-V-vi-IV',
    pattern: 'I - V - vi - IV',
    degrees: ['I', 'V', 'vi', 'IV'],
    family: 'Pop',
    description: 'The "pop four" progression — used in countless hit songs.',
  },
  {
    name: 'ii-V-I (major)',
    pattern: 'ii - V - I',
    degrees: ['ii', 'V', 'I'],
    family: 'Jazz',
    description: 'The most common jazz cadence. Resolves from dominant to tonic.',
  },
  {
    name: 'I-vi-IV-V',
    pattern: 'I - vi - IV - V',
    degrees: ['I', 'vi', 'IV', 'V'],
    family: 'Pop',
    description: 'Classic 50s progression — "Stand By Me", "Every Breath You Take".',
  },
  {
    name: '12-Bar Blues',
    pattern: 'I - I - I - I - IV - IV - I - I - V - IV - I - V',
    degrees: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'],
    family: 'Blues',
    description: 'Standard 12-bar blues form.',
  },
  {
    name: 'I-IV-vi-V',
    pattern: 'I - IV - vi - V',
    degrees: ['I', 'IV', 'vi', 'V'],
    family: 'Pop',
    description: 'Variation of the pop four with vi before V for emotional lift.',
  },
  {
    name: 'vi-IV-I-V',
    pattern: 'vi - IV - I - V',
    degrees: ['vi', 'IV', 'I', 'V'],
    family: 'Pop',
    description: 'Starts on the relative minor for a more reflective feel.',
  },
  {
    name: 'I-vi-ii-V',
    pattern: 'I - vi - ii - V',
    degrees: ['I', 'vi', 'ii', 'V'],
    family: 'Jazz/Pop',
    description: 'Circle-of-fifths turnaround — smooth voice leading.',
  },

  // ── Minor / modal progressions ────────────────────────────────────────────
  {
    name: 'i-iv-v (natural minor)',
    pattern: 'i - iv - v',
    degrees: ['i', 'iv', 'v'],
    family: 'Minor',
    description: 'Natural minor equivalent of I-IV-V.',
  },
  {
    name: 'i-iv-V (harmonic minor)',
    pattern: 'i - iv - V',
    degrees: ['i', 'iv', 'V'],
    family: 'Minor',
    description: 'Harmonic minor cadence — raised 7th creates a dominant V.',
  },
  {
    name: 'i-VII-VI-V',
    pattern: 'i - VII - VI - V',
    degrees: ['i', 'VII', 'VI', 'V'],
    family: 'Minor',
    description: 'Descending minor scale — "Stairway to Heaven" ending.',
  },
  {
    name: 'i-VI-III-VII',
    pattern: 'i - VI - III - VII',
    degrees: ['i', 'VI', 'III', 'VII'],
    family: 'Pop/Rock',
    description: 'Minor key four-chord loop — widely used in modern pop.',
  },
  {
    name: 'ii-V-i (minor)',
    pattern: 'iiø - V - i',
    degrees: ['ii', 'V', 'i'],
    family: 'Jazz',
    description: 'Minor key jazz cadence with half-diminished ii.',
  },

  // ── Cadences & special patterns ───────────────────────────────────────────
  {
    name: 'Andalusian cadence',
    pattern: 'i - bVII - bVI - V',
    degrees: ['i', 'bVII', 'bVI', 'V'],
    family: 'Flamenco',
    description: 'The iconic Flamenco descent — E Phrygian: Em - D - C - B.',
  },
  {
    name: 'Plagal cadence',
    pattern: 'IV - I',
    degrees: ['IV', 'I'],
    family: 'Classical/Hymn',
    description: 'The "Amen" cadence — subdominant to tonic.',
  },
  {
    name: 'Deceptive cadence',
    pattern: 'V - vi',
    degrees: ['V', 'vi'],
    family: 'Classical',
    description: 'V resolves to vi instead of I — surprise ending.',
  },
  {
    name: 'Romanesca',
    pattern: 'I - V - vi - iii - IV - I - IV - V',
    degrees: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'],
    family: 'Renaissance',
    description: '16th-century ground bass pattern, basis for Pachelbel\'s Canon.',
  },

  // ── Extended / jazz ───────────────────────────────────────────────────────
  {
    name: 'iii-vi-ii-V (turnaround)',
    pattern: 'iii - vi - ii - V',
    degrees: ['iii', 'vi', 'ii', 'V'],
    family: 'Jazz',
    description: 'Circle-of-fifths turnaround in major keys.',
  },
  {
    name: 'Coltrane changes',
    pattern: 'I - bIII - bVI - bII',
    degrees: ['I', 'bIII', 'bVI', 'bII'],
    family: 'Jazz',
    description: 'Major-third cycle substitutions — "Giant Steps".',
  },
]

/**
 * Search the progression catalog by degree pattern string.
 * Matches if the query is a substring of any progression's name, pattern,
 * or family. Case-insensitive.
 *
 * @param {string} query - Search term (e.g. "ii-V-I", "Andalusian", "blues")
 * @returns {Progression[]} Matching progressions
 */
export function searchProgressions(query) {
  if (!query) return PROGRESSIONS
  const q = query.toLowerCase().trim()
  return PROGRESSIONS.filter((p) => {
    const haystack = `${p.name} ${p.pattern} ${p.family} ${p.description}`.toLowerCase()
    return haystack.includes(q)
  })
}

/**
 * Get a progression by its exact name (case-insensitive).
 * @param {string} name
 * @returns {Progression|null}
 */
export function getProgressionByName(name) {
  if (!name) return null
  const q = name.toLowerCase().trim()
  return PROGRESSIONS.find((p) => p.name.toLowerCase() === q) || null
}

/**
 * Get all available progressions.
 * @returns {Progression[]}
 */
export function listProgressions() {
  return PROGRESSIONS
}

// Self-check: node -e "import('./src/domain/music/progressions.js').then(m => m.demo())"
export function demo() {
  /**
   * @param {unknown} actual
   * @param {unknown} expected
   * @param {string} label
   */
  const assert = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`progressions demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  assert(PROGRESSIONS.length > 10, true, 'catalog has entries')
  assert(searchProgressions('Andalusian').length, 1, 'search by name')
  assert(searchProgressions('ii-V-I').length >= 1, true, 'search by pattern')
  assert(searchProgressions('blues').length >= 1, true, 'search by family')
  assert(searchProgressions('').length, PROGRESSIONS.length, 'empty query returns all')
  assert(/** @type {Progression} */ (getProgressionByName('I-IV-V')).name, 'I-IV-V', 'exact lookup')
  assert(getProgressionByName('nonexistent'), null, 'missing lookup returns null')

  console.log('progressions demo OK: 7 asserts')
}
