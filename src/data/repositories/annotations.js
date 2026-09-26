// Personal annotations data layer (3.4, D7): the `personal_annotations` read.
// ADR 0002 refactor 3 (pure/impure split) — listAnnotations moved here out of
// domain/music/annotations.js, which is now pure and node-testable.
//
// Rows are author-only and invisible to others (RLS 0002 self policies), so
// this returns [{ anchor, kind, value }]. Never throws: offline or no rows →
// [] (author-only notes, not worth a cache; ponytail: no read-through, add it
// if annotations grow). The pure anchor/substitution helpers that consume
// these rows stay in domain/music/annotations.js.
//
// ponytail: lazy import — supabase.js reads import.meta.env at eval time,
// which is undefined in bare node (this module's demo runs there).
/** @type {typeof import('../supabase.js').supabase | null} */
let supabaseClient = null
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('../supabase.js')).supabase
  return supabaseClient
}

/**
 * @param {string} userId
 * @param {string} songId
 * @returns {Promise<Array<{ anchor?: unknown, kind: string, value: string }>>}
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
  const assert = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`annotations repository demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  assert((await listAnnotations('no-such-user', 'no-such-song')).length, 0, 'offline/no-row → []')

  console.log('annotations repository demo OK: 1 assert (offline degrades to [])')
}
