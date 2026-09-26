// @ts-check
// Identity surface for bandmate search (Hito 3 PR#1a, bandmates R1/R2).
// Reads the col-limited profiles select from 0006 RLS 1.2 — authenticated
// readers are granted only id/username/display_name/avatar_url, so this lib
// never asks for instrument and the server enforces the cap. Pure reads, no
// branch/loop logic beyond query composition — no demo() here (ponytail:
// trivial mappings need no test; the guards/state machine demo lives in
// bandmates.js).
//
// Lazy supabase import (annotations.js pattern): supabase.js evaluates
// import.meta.env at module scope, which is undefined in bare node — the
// lazy import keeps bandmates.js's demo runnable there.

/**
 * Raw profiles row as the col-limited SEARCH_COLUMNS select returns it. All
 * four columns are always requested; display_name/username/avatar_url are
 * nullable in the 0006 schema.
 * @typedef {object} RawProfileRow
 * @property {string} id
 * @property {string | null} username
 * @property {string | null} display_name
 * @property {string | null} avatar_url
 */

/**
 * Flattened identity shape (normalizeProfile — flattenSetlist precedent):
 * display_name promoted out of the snake_case row.
 * @typedef {object} Profile
 * @property {string} id
 * @property {string | null} username
 * @property {string | null} displayName
 */

/**
 * searchProfiles filter bag — `excludeUserId` drops the caller's own row.
 * @typedef {object} ProfileSearchOptions
 * @property {string | null} [excludeUserId]
 */

// ponytail: lazy import — supabase.js reads import.meta.env at eval time,
// which is undefined in bare node (this module's demo runs there).
/** @type {typeof import('./supabase.js').supabase | null} */
let supabaseClient = null
/**
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('./supabase.js')).supabase
  return supabaseClient
}

// Only columns granted to authenticated readers (0006 line 174).
const SEARCH_COLUMNS = 'id, username, display_name, avatar_url'

/**
 * @param {RawProfileRow | null | undefined} row
 * @returns {Profile | null}
 */
function normalizeProfile(row) {
  if (!row) return null
  return { id: row.id, username: row.username, displayName: row.display_name }
}

/**
 * Search profiles by username prefix contains-match (ILIKE).
 * `excludeUserId` drops the caller's own row (spec: "my result is excluded
 * from the list" — the page separately shows "You cannot add yourself").
 * Every row in the result maps to a profile; the `| null` element is
 * normalizeProfile's maybeSingle-shaped return type reaching the mapper
 * (it never fires for a row that exists), kept as-is rather than cast.
 * @param {string | null | undefined} query
 * @param {ProfileSearchOptions} [options]
 * @returns {Promise<Array<Profile | null>>}
 */
export async function searchProfiles(query, { excludeUserId } = {}) {
  const q = query?.trim()
  if (!q) return []
  let chain = (await supabase())
    .from('profiles')
    .select(SEARCH_COLUMNS)
    .ilike('username', `%${q}%`)
    .order('username', { ascending: true })
    .limit(10)
  if (excludeUserId) chain = chain.neq('id', excludeUserId)
  const { data, error } = await chain
  if (error) throw error
  return (data || []).map(normalizeProfile)
}

/** Resolve any profile by unique user ID (add-by-ID surface). */
/**
 * @param {string} userId
 * @returns {Promise<Profile | null>} null when the row does not exist
 */
export async function resolveById(userId) {
  const { data, error } = await (await supabase())
    .from('profiles')
    .select(SEARCH_COLUMNS)
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return normalizeProfile(data)
}

/** The caller's own profile (username for the self-invite guard). */
/**
 * @param {string} userId
 * @returns {Promise<Profile | null>}
 */
export function getProfile(userId) {
  return resolveById(userId)
}