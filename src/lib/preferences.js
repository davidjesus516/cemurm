// Personal preferences data layer (3.1, D2): read-through `prefs:${userId}`
// kv cache, offline-safe (kv only). Typed hot-path columns (transpose_offset,
// capo) + `preferences` jsonb for evolving per-song overrides / default
// version / practice prefs (D2). Read-only this slice (3.2) — no mutation
// helpers; edit UI lands with a later slice.

import { offlineGet, offlineSet } from './offlineCache.js'

// ponytail: lazy import — supabase.js reads import.meta.env at eval time,
// which is undefined in bare node (this module's demo runs there).
let supabaseClient = null
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('./supabase.js')).supabase
  return supabaseClient
}

export const PREF_KEY = (userId) => `prefs:${userId}`

export const DEFAULT_PREFS = Object.freeze({
  transpose: 0,
  capo: 0,
  defaultVersion: null,
  overrides: {}, // { songId: semitones } — per-song beats the global offset (spec)
  practice: {}, // { songId: { key, tempo } } — 3.6 drives practice key/tempo from here
})

/**
 * Map a raw user_preferences row (typed columns + jsonb, D2) to the client
 * shape. A missing row (maybeSingle → null) maps to the defaults — a user
 * with no prefs row gets 0/0/none, matching the schema defaults.
 */
export function flattenPreferences(row) {
  const jsonb = row?.preferences ?? {}
  return {
    transpose: Number(row?.transpose_offset ?? DEFAULT_PREFS.transpose),
    capo: Number(row?.capo ?? DEFAULT_PREFS.capo),
    defaultVersion: jsonb.default_version ?? DEFAULT_PREFS.defaultVersion,
    overrides: jsonb.override ?? {},
    practice: jsonb.practice ?? {},
  }
}

async function fetchPreferences(userId) {
  const { data, error } = await (await supabase())
    .from('user_preferences')
    .select('transpose_offset, capo, preferences')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return flattenPreferences(data)
}

/**
 * Read-through (setlists.js semantics): network first, cache on success;
 * on failure serve the kv copy; with neither, fall back to defaults — so
 * reads never throw and are fully offline-safe. No user-facing error here:
 * a missing pref row IS the default state.
 */
export async function getPreferences(userId) {
  try {
    const data = await fetchPreferences(userId)
    await offlineSet(PREF_KEY(userId), data)
    return data
  } catch (e) {
    const cached = await offlineGet(PREF_KEY(userId))
    if (cached?.data) return cached.data
    return { ...DEFAULT_PREFS }
  }
}

// Self-check: node -e "import('./src/lib/preferences.js').then(m => m.demo())"
export async function demo() {
  const assert = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`preferences demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  assert(flattenPreferences(null).transpose, 0, 'no row → default transpose')
  assert(flattenPreferences(null).capo, 0, 'no row → default capo')
  assert(flattenPreferences(null).defaultVersion, null, 'no row → no default version')
  assert(DEFAULT_PREFS.transpose, 0, 'default transpose is 0')
  assert(DEFAULT_PREFS.capo, 0, 'default capo is 0')

  // D2 jsonb read shape: overrides / default version / practice per song.
  const row = {
    transpose_offset: 2,
    capo: 3,
    preferences: {
      default_version: 'v2',
      override: { songA: -1, songB: 4 },
      practice: { songA: { key: 'D', tempo: 70 } },
    },
  }
  const flat = flattenPreferences(row)
  assert(flat.transpose, 2, 'typed transpose_offset read')
  assert(flat.capo, 3, 'typed capo read')
  assert(flat.defaultVersion, 'v2', 'default version from jsonb')
  assert(flat.overrides.songA, -1, 'per-song override read')
  assert(flat.overrides.songB, 4, 'second override read')
  assert(flat.practice.songA.tempo, 70, 'practice jsonb read shape')

  // Offline-safe contract: any failure (no network, no kv, no row) → defaults.
  const fallback = await getPreferences('no-such-user')
  assert(fallback.transpose + fallback.capo, 0, 'offline/no-row fallback returns defaults')

  console.log(`preferences demo OK: ${12} asserts (defaults, D2 jsonb read shape, offline fallback)`)
}