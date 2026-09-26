// Degree resolution data layer (ADR 0002 refactor 2, engine/lookup split).
// Owns the ONLY impure part of degree resolution: the scale_catalog read
// behind `findScaleByName`. The music theory itself — noteToSemitone,
// extractRoot, rootToDegree, qualityForDegree, formatRomanNumeral,
// parseKeyContext — stays pure in domain/music/degreeResolver.js.
//
// These two entry points were `export async` before the split only because
// the catalog read forced it; the engine could not be reached from a test
// without a Supabase round trip. Callers are unchanged in shape: both still
// take a key context (string or parsed object) plus a concrete chord.

import { findScaleByName } from './scaleCatalog.js'
import { extractRoot, formatRomanNumeral, noteToSemitone, parseKeyContext, qualityForDegree, rootToDegree } from '../../domain/music/degreeResolver.js'

/**
 * Resolve the roman numeral degree for a concrete chord within a key context.
 *
 * @param {object} keyContext - { tonic: 'E', scaleName: 'Phrygian dominant' } or parsed key string
 * @param {string} concreteChord - The chord string (e.g. "E7", "F", "Bm")
 * @returns {Promise<string|null>} Roman numeral string or null if unresolvable
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

// Self-check: node -e "import('./src/data/repositories/degrees.js').then(m => m.demo())"
export async function demo() {
  const assert = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`degrees demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  // Without Supabase, degree resolution returns null (catalog not loaded).
  const deg = await resolveDegree({ tonic: 'C', scaleName: 'Major' }, 'G')
  assert(deg, null, 'no catalog → null')
  assert(await resolveDegree({ tonic: 'C', scaleName: 'Major' }, ''), null, 'no chord → null')

  console.log('degrees demo OK: 2 asserts (graceful null without a catalog)')
}
