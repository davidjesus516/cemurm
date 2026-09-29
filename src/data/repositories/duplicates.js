// @ts-check
// Duplicate detection + dedupe decision audit (Hito 5 #78): data layer over
// songs + song_duplicates (0028 opened the owner-scoped surface). Pure title
// normalization is Node-safe; DB helpers lazy-import supabase like the rest
// of the lib layer.
//
// Contract (S7 dedupe review):
// - findDuplicateCandidates: normalized equality OR mutual containment (both
//   normalized lengths ≥ 4) against the user's own ACTIVE songs — the queue
//   flags "Possible duplicate: <existing titles>" before approval.
// - recordDuplicateDecision: ONE song_duplicates row per review — merge
//   records canonical_id (+ merged_from), keep-separate leaves canonical NULL;
//   BOTH audit the review (decided_by/decided_at always set). No delete: the
//   trail persists (0028).
// - getDuplicateGroup: the group row for the SongDetail badge (merged vs
//   kept-separate state).

/**
 * Owned song identity the dedupe heuristic compares: id + title. The query
 * below selects exactly those two columns, and the queue injects the same
 * row set in tests/demo.
 * @typedef {object} OwnedSongTitle
 * @property {string} id
 * @property {string} title
 */

/**
 * song_duplicates row (0001:133, access opened by 0028) — one row per dedupe
 * review. getDuplicateGroup selects these columns; recordDuplicateDecision
 * inserts them. canonical_id set = merged, NULL = reviewed kept-separate.
 * @typedef {object} RawSongDuplicatesRow
 * @property {string} id
 * @property {string[]} song_ids
 * @property {string | null} canonical_id
 * @property {string | null} merged_from
 * @property {string | null} decided_by
 * @property {string | null} decided_at
 * @property {boolean} unmerge_ok
 */

/**
 * Dedupe review decision. A group of ONE is legal (an import merged into its
 * only flagged candidate still audits), so `songIds` is never empty at the
 * call site that reaches the insert.
 * @typedef {object} DuplicateDecision
 * @property {string[]} songIds
 * @property {string | null} [canonicalId]
 * @property {string | null} [mergedFrom]
 */

// Lazy supabase (house pattern): the module graph stays Node-safe so the pure
// demo runs without Vite env vars; DB helpers load the client on first use.
/** @type {typeof import('../supabase.js').supabase | null} */
let supabaseClient = null

/**
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
async function getSupabase() {
  if (!supabaseClient) supabaseClient = (await import('../supabase.js')).supabase
  return supabaseClient
}

/**
 * Normalize a title for comparison: lowercase, strip a trailing parenthetical
 * group, collapse to alphanumerics + spaces, trim.
 *   'Amazing Grace (traditional)' → 'amazing grace'
 *   'Imagine '                   → 'imagine'
 * `unknown` because the body String()-coerces whatever it is handed (callers
 * pass raw nullable row fields, never assume a string).
 * @param {unknown} t
 * @returns {string}
 */
export function normalizeTitle(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/\s*\([^)]*\)$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * The user's active song titles (id + title, created_by + not deleted) —
 * one query, consumed by the queue's per-entry detection.
 * @param {string} userId
 * @returns {Promise<OwnedSongTitle[]>}
 */
export async function listOwnedSongTitles(userId) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('songs')
    .select('id, title')
    .eq('created_by', userId)
    .eq('is_deleted', false)
  if (error) throw error
  return data || []
}

/**
 * Possible-duplicate candidates for a NEW/imported title: every owned ACTIVE
 * song whose normalized title is equal to OR mutually contains the query
 * (both normalized lengths ≥ 4 — 'Am' vs 'Amazing' must not flag). Returns
 * [{ id, title }]; empty when nothing matches. excludeSongId skips the song
 * itself (used when reviewing an existing song's group). `ownedTitles` is an
 * optional injected row set (tests/demo) — the production path performs the
 * single owned-titles query itself.
 * @param {string} userId
 * @param {string} title
 * @param {string | null} excludeSongId
 * @param {OwnedSongTitle[] | null} [ownedTitles]
 * @returns {Promise<OwnedSongTitle[]>}
 */
export async function findDuplicateCandidates(userId, title, excludeSongId, ownedTitles = null) {
  const query = String(title || '').trim()
  if (!query) return []
  const qNorm = normalizeTitle(query)
  if (!qNorm) return []
  const rows = ownedTitles === null ? await listOwnedSongTitles(userId) : ownedTitles
  return rows
    .filter((row) => row.id !== excludeSongId)
    .filter((row) => {
      const n = normalizeTitle(row.title)
      if (!n) return false
      if (n === qNorm) return true
      if (n.length >= 4 && qNorm.length >= 4) {
        return n.includes(qNorm) || qNorm.includes(n)
      }
      return false
    })
    .map((row) => ({ id: row.id, title: row.title }))
}

/**
 * Record a dedupe review decision. Merge: canonicalId (+ mergedFrom) set —
 * the target survives, the other song(s) merge into it. Keep-separate:
 * canonicalId null — the review still audits (S7 "both are flagged"). A group
 * of ONE is legal: an import merged into its only flagged candidate still
 * audits the merge. The insert is owner-scoped by 0028 RLS (the group must
 * contain ≥1 owned song).
 * @param {string} userId
 * @param {DuplicateDecision} decision
 * @returns {Promise<RawSongDuplicatesRow>}
 */
export async function recordDuplicateDecision(userId, { songIds, canonicalId = null, mergedFrom = null }) {
  if (!Array.isArray(songIds) || !songIds.length) {
    throw new Error('A duplicate group needs at least one song.')
  }
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('song_duplicates')
    .insert({
      song_ids: songIds,
      canonical_id: canonicalId,
      merged_from: mergedFrom,
      decided_by: userId,
      decided_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * The duplicate-group row a song participates in (as member or canonical) —
 * merged vs kept-separate state for the SongDetail badge. Returns the most
 * recent group or null.
 * @param {string} songId
 * @returns {Promise<RawSongDuplicatesRow | null>}
 */
export async function getDuplicateGroup(songId) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('song_duplicates')
    .select('id, song_ids, canonical_id, merged_from, decided_by, decided_at, unmerge_ok')
    .or(`song_ids.cs.{${songId}},canonical_id.eq.${songId}`)
    .order('decided_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data || null
}

// Self-check: node -e "import('./src/data/repositories/duplicates.js').then(m => m.demo())"
export async function demo() {
  /**
   * @param {unknown} cond
   * @param {string} msg
   */
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`duplicates demo FAILED: ${msg}`)
  }

  // normalizeTitle: case, trailing parenthetical, punctuation collapse.
  assert(normalizeTitle('Amazing Grace (traditional)') === 'amazing grace',
    'trailing parenthetical stripped')
  assert(normalizeTitle('  IMAGINE!?? ') === 'imagine', 'case + punctuation collapsed')
  assert(normalizeTitle('Oceans (Where Feet May Fail)') === 'oceans', 'inner parenthetical stripped')

  // findDuplicateCandidates: equality + mutual containment (≥4 norm length).
  const library = [
    { id: 'a1', title: 'Amazing Grace' },
    { id: 'a2', title: 'Amazing Grace (traditional)' },
    { id: 'b1', title: 'Imagine' },
    { id: 'b2', title: 'Hallelujah' },
  ]
  const grace = await findDuplicateCandidates('u1', 'Amazing Grace', null, library)
  assert(grace.some((c) => c.id === 'a2'), "'Amazing Grace' vs '(traditional)' → candidate")
  assert(grace.some((c) => c.id === 'a1'), 'exact normalized equality flags the plain title')
  assert(grace.length === 2, 'no false positives in the grace set')
  const imagine = await findDuplicateCandidates('u1', 'Imagine', null, library)
  assert(imagine.length === 1 && imagine[0].id === 'b1', "'Imagine' only flags itself")
  const none = await findDuplicateCandidates('u1', 'Hallelujah', null, library)
  assert(none.length === 1 && none[0].id === 'b2', 'near-miss titles do not flag')
  const short = await findDuplicateCandidates('u1', 'Am', null, library)
  assert(short.length === 0, 'sub-4-char containment never flags')
  const excluded = await findDuplicateCandidates('u1', 'Amazing Grace', 'a1', library)
  assert(!excluded.some((c) => c.id === 'a1'), 'excludeSongId skips the song itself')

  console.log('duplicates demo OK')
}