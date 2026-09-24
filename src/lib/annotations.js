// @ts-check
// Personal annotations data layer (3.4, D7): reads personal_annotations
// (self-scoped RLS, 0002) and resolves anchors / substitutions into render
// values for ChordProRenderer. Pure helpers are node-testable; listAnnotations
// is the network read — offline or missing rows → [] (author-only notes, not
// worth a cache; ponytail: no read-through, add it if annotations grow).

import { transposeChord, preferFlatForKey } from './transpose.js'

/**
 * @typedef {{ section?: string, index?: number, chord?: string }} AnnotationAnchor
 * @typedef {{ kind: 'note' | 'chord_substitution', anchor?: AnnotationAnchor, value: string }} Annotation
 */

// ponytail: lazy import — supabase.js reads import.meta.env at eval time,
// which is undefined in bare node (this module's demo runs there).
/** @type {typeof import('./supabase.js').supabase | null} */
let supabaseClient = null
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('./supabase.js')).supabase
  return supabaseClient
}

/**
 * Note annotation for a lyric line, anchored {section: name, index: lineIdx}
 * (0001 comment: structural anchor; index = 0-based lyric line within the
 * {section} block — stable under transpose because transposeParsed keeps the
 * section/line structure 1:1).
 */
/**
 * @param {Annotation[] | null | undefined} annotations
 * @param {string} sectionName
 * @param {number} lineIndex
 * @returns {string | null}
 */
export function noteForLine(annotations, sectionName, lineIndex) {
  if (!annotations?.length) return null
  const match = annotations.find(
    (a) => a.kind === 'note'
      && a.anchor?.section === sectionName
      && a.anchor?.index === lineIndex,
  )
  return match?.value ?? null
}

/**
 * Map chord_substitution annotations to { concreteChordToken: value } —
 * anchors are concrete-key chord tokens (0001 comment). The renderer matches
 * via the reverse-transposed token so substitutions survive transposition.
 */
/**
 * @param {Annotation[] | null | undefined} annotations
 * @returns {Record<string, string>}
 */
export function buildSubstitutionMap(annotations) {
  /** @type {Record<string, string>} */
  const map = {}
  for (const a of annotations || []) {
    if (a.kind !== 'chord_substitution') continue
    const anchor = a.anchor?.chord ?? (typeof a.anchor === 'string' ? a.anchor : null)
    if (anchor) map[anchor] = a.value
  }
  return map
}

/**
 * Resolve a rendered chord token through the substitution map (D7: "match
 * transposed chord token, render transposed target"). Reverse-transpose the
 * rendered token to its concrete key, look up, then transpose the target
 * forward — the substitution moves correctly under transpose (spec: "moves
 * correctly when Pedro transposes"). No match → token unchanged (shared chart
 * keeps the original chord). Consistent flat preference keeps Bb-chart
 * round-trips enharmonically stable.
 */
/**
 * @param {string} token
 * @param {number} semitones
 * @param {Record<string, string>} substitutions
 * @param {string} baseKey
 * @returns {string}
 */
export function applySubstitution(token, semitones, substitutions, baseKey) {
  if (!token || !substitutions || !Object.keys(substitutions).length) return token
  const preferFlat = preferFlatForKey(baseKey)
  const concrete = transposeChord(token, -semitones, preferFlat)
  const target = substitutions[concrete]
  return target ? transposeChord(target, semitones, preferFlat) : token
}

/**
 * Read the author's personal annotations for a song (author-only, invisible
 * to others — RLS 0002 self policies). Returns [{ anchor, kind, value }];
 * never throws: offline or no rows → [].
 */
/**
 * @param {string} userId
 * @param {string} songId
 * @returns {Promise<Annotation[]>}
 */
export async function listAnnotations(userId, songId) {
  try {
    const { data, error } = await (await supabase())
      .from('personal_annotations')
      .select('anchor, kind, value')
      .eq('user_id', userId)
      .eq('song_id', songId)
    if (error) throw error
    return data || []
  } catch {
    return []
  }
}

// Self-check: node -e "import('./src/lib/annotations.js').then(m => m.demo())"
export async function demo() {
  /**
   * @param {unknown} actual
   * @param {unknown} expected
   * @param {string} label
   */
  const assert = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`annotations demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  /** @type {Annotation[]} */
  const annotations = [
    { kind: 'note', anchor: { section: 'Chorus', index: 2 }, value: 'breath here' },
    { kind: 'chord_substitution', anchor: { chord: 'Bm' }, value: 'Dmaj7' },
  ]

  assert(noteForLine(annotations, 'Chorus', 2), 'breath here', 'note anchored {section,index}')
  assert(noteForLine(annotations, 'Chorus', 1), null, 'no note on another line')
  assert(noteForLine(annotations, 'Verse 1', 2), null, 'no note in another section')
  assert(noteForLine([], 'Chorus', 2), null, 'no annotations → null')

  const map = buildSubstitutionMap(annotations)
  assert(map.Bm, 'Dmaj7', 'substitution map keyed by concrete chord')
  assert(Object.prototype.hasOwnProperty.call(map, 'Chorus'), false, 'note anchors never enter the map')

  // D7: match base token, render transposed target; unmatched chords stay put.
  assert(applySubstitution('Bm', 0, map, 'C'), 'Dmaj7', 'base render substitutes')
  assert(applySubstitution('C#m', 2, map, 'C'), 'Emaj7', 'substitution moves under +2')
  assert(applySubstitution('Am', -2, map, 'C'), 'Cmaj7', 'substitution moves under -2')
  assert(applySubstitution('C', 0, map, 'C'), 'C', 'unmatched chord unchanged')
  assert(applySubstitution('Bm', 0, {}, 'C'), 'Bm', 'no substitutions → unchanged')
  // Flat-key round trip: Bb chart at +1 renders B, reverse-lookup must land Bb.
  assert(applySubstitution('B', 1, { Bb: 'C' }, 'Bb'), 'Db', 'flat-key reverse lookup is consistent')

  assert((await listAnnotations('no-such-user', 'no-such-song')).length, 0, 'offline/no-row → []')

  console.log('annotations demo OK: 11 asserts (anchors, substitution map, transpose movement, offline)')
}