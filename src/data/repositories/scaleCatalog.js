// @ts-check
// Scale catalog data layer — fetches from Supabase `scale_catalog` table,
// caches locally in module scope. Read-only reference data for music theory
// features (Hito 4). No writes — catalog is seeded via migration.

/**
 * One `scale_catalog` row, as the select in fetchScales projects it. Every
 * column is taken from the migration DDL, never inferred: 0001_init.sql
 * creates the table and no later migration touches it (0002 only adds the
 * read-only RLS policy + grants, 0014 seeds rows), and nothing could be
 * inferred here anyway — src/data/supabase.js is untyped on this branch, so
 * the lazy client is `any` and an unparameterized SupabaseClient makes every
 * query result `any`.
 *
 * - id              uuid PRIMARY KEY           — 0001_init.sql:550 → string
 * - name            text NOT NULL              — 0001_init.sql:551 → string
 * - aliases         text[] (no NOT NULL)       — 0001_init.sql:552 → string[] | null
 * - intervals       integer[] NOT NULL         — 0001_init.sql:553 → number[]
 * - parent_scale_id uuid, self-FK, nullable    — 0001_init.sql:554; the inline
 *   comment declares "NULL for root scales, populated for modes" → string | null
 * - rotation        integer (no NOT NULL)      — 0001_init.sql:555 → number | null
 * - cardinality     integer NOT NULL           — 0001_init.sql:556 → number
 *
 * `name` is deliberately an open `string`, not a union of scale names. There
 * is no CHECK constraint: the vocabulary is the inline comment on
 * 0001_init.sql:551 ('Major', 'Dorian', 'Melodic Minor') plus the 26 rows
 * 0014_seed_scale_catalog.sql:6-48 seeds, and the catalog is extensible data by
 * design — "addable by system director without code change"
 * (docs/database-schema-v2.md:98). A closed union here would be a lie the
 * next seed could break, and findScaleByName matches names case-insensitively
 * anyway.
 *
 * @typedef {object} Scale
 * @property {string} id
 * @property {string} name
 * @property {string[] | null} aliases
 * @property {number[]} intervals
 * @property {string | null} parent_scale_id
 * @property {number | null} rotation
 * @property {number} cardinality
 */

/** @type {Scale[] | null} */
let cache = null

/**
 * Lazy-imported Supabase client (same pattern as annotations.js).
 * ponytail: lazy import — supabase.js reads import.meta.env at eval time,
 * which is undefined in bare node (this module's demo runs there).
 * @type {typeof import('../supabase.js').supabase | null}
 */
let supabaseClient = null
/**
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('../supabase.js')).supabase
  return supabaseClient
}

/**
 * Fetch all scales from the catalog and cache in module scope.
 * Returns the cached array on subsequent calls. Never throws — returns []
 * on network/RLS failure so callers degrade gracefully.
 * @returns {Promise<Scale[]>}
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
 * @param {string} id
 * @returns {Promise<Scale | null>}
 */
export async function getScaleById(id) {
  const scales = await fetchScales()
  return scales.find((s) => s.id === id) || null
}

/**
 * Fuzzy-match a scale by name or alias (case-insensitive).
 * Exact name match first, then alias match, then substring.
 * Returns the scale object or null.
 * @param {string | null | undefined} name
 * @returns {Promise<Scale | null>}
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
 * @returns {void}
 */
export function resetScaleCache() {
  cache = null
}

// Self-check: node -e "import('./src/data/repositories/scaleCatalog.js').then(m => m.demo())"
export async function demo() {
  /**
   * @param {unknown} actual
   * @param {unknown} expected
   * @param {string} label
   */
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
