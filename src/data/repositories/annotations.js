// Personal annotations data layer (3.4, D7): reads personal_annotations
// (author-only, self-scoped RLS, 0002). Extracted verbatim from
// src/domain/music/annotations.js, where the read sat behind a lazy dynamic
// import of the Supabase client and made a "pure domain" module perform I/O.
// The resolution helpers that stay behind in the domain take already-loaded
// rows; this module is the only thing that fetches them.

/**
 * @typedef {{ section?: string, index?: number, chord?: string }} AnnotationAnchor
 * @typedef {{ kind: 'note' | 'chord_substitution', anchor?: AnnotationAnchor, value: string }} Annotation
 */

// ponytail: lazy import — supabase.js reads import.meta.env at eval time,
// which is undefined in bare node (that is why this is not a top-level import).
/** @type {typeof import('../supabase.js').supabase | null} */
let supabaseClient = null
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('../supabase.js')).supabase
  return supabaseClient
}

/**
 * Read the author's personal annotations for a song (author-only, invisible
 * to others — RLS 0002 self policies). Returns [{ anchor, kind, value }];
 * never throws: offline or no rows → [].
 *
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

// Self-check: node -e "import('./src/data/repositories/annotations.js').then(m => m.demo())"
export async function demo() {
  /**
   * @param {unknown} actual
   * @param {unknown} expected
   * @param {string} label
   */
  const assert = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`annotations data demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  // Without Supabase reachable the read degrades to [], never throws. This is
  // the assertion that moved out of the domain demo with the read.
  assert((await listAnnotations('no-such-user', 'no-such-song')).length, 0, 'offline/no-row → []')

  console.log('annotations data demo OK: 1 assert (offline/no-row → [])')
}