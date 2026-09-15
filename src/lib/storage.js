// Cached-storage policy (D4, hito-2-remainder 2a): one versioned SW cache
// per category, activate-time cleanup, and the eviction-exemption guard.
// public/sw.js (classic worker, no imports) duplicates the tiny predicates
// inline; this module is the tested single source the storage screen and
// eviction (PR#2b) build on.

export const CACHE_PREFIX = 'cemurm-'
export const CACHE_CATEGORIES = ['shell', 'songs', 'pdf', 'exports', 'data']
// Auto-eviction order (D4): bulk derived first — PDF scans → exports →
// remaining derived by age (2b extends with cache-meta bytes/age).
// shell/songs/data are never auto-evicted (live-use + user-data contract).
export const EVICTION_ORDER = ['pdf', 'exports']

export function cacheName(category, version) {
  return `${CACHE_PREFIX}${category}-v${version}`
}

const NAME_RE = /^cemurm-([a-z]+)-v(\d+)$/

export function parseCacheName(name) {
  const m = NAME_RE.exec(name || '')
  return m ? { category: m[1], version: Number(m[2]) } : null
}

/**
 * Activate-time cleanup (D3, threat RED 2): delete everything that is not a
 * current-version cache of our own categories — foreign caches and stale
 * versions of ours. Old SW keeps serving current tabs (no clients.claim()).
 */
export function shouldDeleteOnActivate(name, version) {
  const parsed = parseCacheName(name)
  return !parsed || !CACHE_CATEGORIES.includes(parsed.category) || parsed.version !== version
}

export function isEvictableCategory(category) {
  return EVICTION_ORDER.includes(category)
}

/**
 * Eviction-exemption guard (D4): user-authored queue data is NEVER an
 * eviction candidate. outbox-store keys (`pending:<userId>`) and kv values
 * flagged pendingSync (optimistic offline writes, incl. gig records) are
 * exempt by construction — eviction only ever considers cache-storage
 * entries and non-pending kv read copies (2b).
 */
export function isUserAuthoredKvEntry(entry) {
  const key = String(entry?.key ?? '')
  if (key.startsWith('pending:')) return true
  return !!(entry?.value?.data?.pendingSync || entry?.value?.pendingSync)
}

/**
 * One-tap cleanup plan (2b.2, D4): bulk derived first — PDF scans → exports,
 * oldest first via cache-meta savedAt, then remaining derived (non-user-
 * authored kv read copies) by age. Only EVICTION_ORDER categories are cache
 * candidates; shell/songs/data caches and user-authored kv entries are never
 * evicted. Stops once targetBytes are freed (spec: warning clears once freed
 * space suffices).
 */
export function planEviction(cacheRecords, kvRecords, targetBytes) {
  const picked = []
  let freed = 0
  const order = (category) => {
    const i = EVICTION_ORDER.indexOf(category)
    return i === -1 ? EVICTION_ORDER.length : i
  }
  const caches = cacheRecords
    .filter((r) => EVICTION_ORDER.includes(r.category))
    .sort(
      (a, b) =>
        order(a.category) - order(b.category) ||
        (a.savedAt ?? 0) - (b.savedAt ?? 0) ||
        String(a.name).localeCompare(String(b.name)),
    )
  for (const rec of caches) {
    if (freed >= targetBytes) return picked
    picked.push({ type: 'cache', name: rec.name, bytes: rec.bytes })
    freed += rec.bytes
  }
  const kv = kvRecords
    .filter((r) => !isUserAuthoredKvEntry(r))
    .sort(
      (a, b) =>
        (a.savedAt ?? 0) - (b.savedAt ?? 0) ||
        String(a.key).localeCompare(String(b.key)),
    )
  for (const rec of kv) {
    if (freed >= targetBytes) return picked
    picked.push({ type: 'kv', key: rec.key, bytes: rec.bytes })
    freed += rec.bytes
  }
  return picked
}

export function demo() {
  const assertEq = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`storage demo failed: ${label} expected ${expected}, got ${actual}`)
    }
  }

  // Threat RED 2: activation deletes only foreign / stale caches, never
  // current-version caches of our categories.
  assertEq(shouldDeleteOnActivate('cemurm-shell-v2', 2), false, 'current shell kept on activate')
  assertEq(shouldDeleteOnActivate('cemurm-pdf-v2', 2), false, 'current pdf kept on activate')
  assertEq(shouldDeleteOnActivate('cemurm-shell-v1', 2), true, 'stale version deleted')
  assertEq(shouldDeleteOnActivate('cemurm-other-v2', 2), true, 'foreign category deleted')
  assertEq(shouldDeleteOnActivate('vite-precache-v1', 2), true, 'foreign cache deleted')
  assertEq(cacheName('shell', 2), 'cemurm-shell-v2', 'cache name contract')

  // D4: PDF scans/Exports evict first; songs/data never auto-evicted.
  assertEq(EVICTION_ORDER.join(','), 'pdf,exports', 'bulk derived evicted in order')
  assertEq(isEvictableCategory('shell'), false, 'shell never auto-evicted')
  assertEq(isEvictableCategory('songs'), false, 'songs never auto-evicted')
  assertEq(isEvictableCategory('data'), false, 'setlist/gig data never auto-evicted')

  // D4: outbox / pendingSync are never eviction candidates.
  assertEq(isUserAuthoredKvEntry({ key: 'pending:u1' }), true, 'outbox key exempt')
  assertEq(
    isUserAuthoredKvEntry({ key: 'gig:u1:g1', value: { data: { pendingSync: true } } }),
    true,
    'pending gig record exempt',
  )
  assertEq(isUserAuthoredKvEntry({ key: 'setlists:u1', value: { data: [] } }), false, 'plain read copy evictable')

  // 2b.2: planEviction — PDF → Exports by age, then kv read copies by age;
  // shell/songs/data caches + authored kv never picked; stops at target.
  const now = 1000
  const cache = (name, category, savedAt, bytes) => ({ name, category, savedAt, bytes })
  const plan = planEviction(
    [
      cache('cemurm-exports-v2', 'exports', now, 10),
      cache('cemurm-pdf-v2', 'pdf', now - 5, 10),
      cache('cemurm-shell-v2', 'shell', 0, 999),
      cache('cemurm-songs-v2', 'songs', 0, 999),
    ],
    [
      { key: 'setlists:u1', savedAt: now, bytes: 5 },
      { key: 'pending:u1', savedAt: 0, bytes: 999 },
      { key: 'song:u1:s1', value: { data: { pendingSync: true } }, savedAt: now, bytes: 3 },
    ],
    9999,
  )
  assertEq(plan[0].name, 'cemurm-pdf-v2', 'pdf evicted before exports regardless of age')
  assertEq(plan[1].name, 'cemurm-exports-v2', 'exports after pdf')
  assertEq(plan.length, 3, 'shell + songs caches and pending key never evicted')
  assertEq(plan[2].key, 'setlists:u1', 'kv read copy evicted after caches by age')
  assertEq(plan.some((p) => p.key === 'pending:u1'), false, 'outbox/pending key never evicted')
  assertEq(plan.some((p) => p.name === 'cemurm-shell-v2' || p.name === 'cemurm-songs-v2'), false, 'shell/songs caches never evicted')
  const partial = planEviction(
    [cache('cemurm-pdf-v2', 'pdf', now, 10), cache('cemurm-exports-v2', 'exports', now, 10)],
    [],
    15,
  )
  assertEq(partial.length, 2, 'plan stops once target bytes are freed')

  console.log('storage demo OK: 19 asserts (activate cleanup, eviction order + exemption, planEviction)')
}