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

let supabaseClient = null
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('./supabase.js')).supabase
  return supabaseClient
}

// Only columns granted to authenticated readers (0006 line 174).
const SEARCH_COLUMNS = 'id, username, display_name, avatar_url'

function normalizeProfile(row) {
  if (!row) return null
  return { id: row.id, username: row.username, displayName: row.display_name }
}

/**
 * Search profiles by username prefix contains-match (ILIKE).
 * `excludeUserId` drops the caller's own row (spec: "my result is excluded
 * from the list" — the page separately shows "You cannot add yourself").
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
export function getProfile(userId) {
  return resolveById(userId)
}