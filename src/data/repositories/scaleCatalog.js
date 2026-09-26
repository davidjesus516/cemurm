// Scale catalog data layer — fetches from Supabase `scale_catalog` table,
// caches locally in module scope. Read-only reference data for music theory
// features (Hito 4). No writes — catalog is seeded via migration.

let cache = null

/**
 * Lazy-imported Supabase client (same pattern as annotations.js).
 */
let supabaseClient = null
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('../supabase.js')).supabase
  return supabaseClient
}

/**
 * Fetch all scales from the catalog and cache in module scope.
 * Returns the cached array on subsequent calls. Never throws — returns []
 * on network/RLS failure so callers degrade gracefully.
 */
export async function fetchScales() {
  if (cache) return cache
  try {
    const { data, error } = await (await supabase())
      .from('scale_catalog')
      .select('id, name, aliases, intervals, parent_scale_id, rotation, cardinality')
      .order('cardinality')
    if (error) throw error
    cache = data || []
    return cache
  } catch {
    cache = []
    return cache
  }
}

/**
 * Lookup a scale by its UUID. Returns the scale object or null.
 */
export async function getScaleById(id) {
  const scales = await fetchScales()
  return scales.find((s) => s.id === id) || null
}

/**
 * Fuzzy-match a scale by name or alias (case-insensitive).
 * Exact name match first, then alias match, then substring.
 * Returns the scale object or null.
 */
export async function findScaleByName(name) {
  if (!name) return null
  const scales = await fetchScales()
  const normalized = name.trim().toLowerCase()

  // Exact name match
  const exact = scales.find((s) => s.name.toLowerCase() === normalized)
  if (exact) return exact

  // Alias match
  const alias = scales.find(
    (s) => s.aliases?.some((a) => a.toLowerCase() === normalized),
  )
  if (alias) return alias

  // Substring match (e.g. "phrygian dominant" matches "Phrygian Dominant")
  const sub = scales.find(
    (s) => s.name.toLowerCase().includes(normalized)
      || s.aliases?.some((a) => a.toLowerCase().includes(normalized)),
  )
  return sub || null
}

/**
 * Clear the module cache (for tests or hot-reload).
 */
export function resetScaleCache() {
  cache = null
}

// Self-check: node -e "import('./src/data/repositories/scaleCatalog.js').then(m => m.demo())"
export async function demo() {
  const assert = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`scaleCatalog demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  // Without Supabase, fetchScales returns [] gracefully.
  const scales = await fetchScales()
  assert(Array.isArray(scales), true, 'fetchScales returns array')

  const none = await getScaleById('no-such-id')
  assert(none, null, 'missing id returns null')

  const none2 = await findScaleByName('no-such-scale')
  assert(none2, null, 'missing name returns null')

  console.log('scaleCatalog demo OK: 3 asserts (cache, id lookup, name lookup)')
}
