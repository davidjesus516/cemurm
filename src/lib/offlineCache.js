// Offline read-through cache backed by IndexedDB.
// Pure native API — no dependencies.
// TTL is caller-side: callers decide staleness; this store always
// serves cached data when the network is unavailable.
// v3 (hito-2-remainder 2a.2, D5): additive lockstep bump with
// offlineQueue.js — `<1 kv → <2 outbox → <3 cache-meta` ({bytes, savedAt}).
// The upgrade never drops stores: it only ever creates.
// ponytail: plain IndexedDB, no idb wrapper; add one when the
//   open-on-demand pattern becomes awkward.

const DB_NAME = 'cemurm-offline'
const STORE_NAME = 'kv'
const CACHE_META_STORE = 'cache-meta'

export const DB_VERSION = 3

/**
 * Additive upgrade plan, shared with offlineQueue.js — single source of
 * truth, so the two modules are lockstep by construction (D5; drift would
 * surface as a VersionError and permanently disable the cache). Runs inside
 * onupgradeneeded; existing stores are always preserved.
 */
export function applyUpgrade(db, oldVersion) {
  if (oldVersion < 1) db.createObjectStore('kv')
  if (oldVersion < 2) db.createObjectStore('outbox')
  if (oldVersion < 3) db.createObjectStore(CACHE_META_STORE)
}

let dbPromise = null

function getDb() {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.resolve(null)
    return dbPromise
  }
  dbPromise = new Promise((resolve) => {
    try {
      // Must match offlineQueue's schema: the shared DB is version DB_VERSION.
      // Opening with a lower version against a newer DB throws VersionError
      // and permanently disables the cache.
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => applyUpgrade(req.result, req.oldVersion)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

export async function offlineGet(key) {
  const db = await getDb()
  if (!db) return null
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function offlineSet(key, data) {
  const db = await getDb()
  if (!db) return
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put({ data, savedAt: Date.now() }, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // swallow — cache is best-effort
  }
}

export async function offlineRemove(key) {
  const db = await getDb()
  if (!db) return
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // swallow
  }
}

export async function offlineKeysByPrefix(prefix) {
  const db = await getDb()
  if (!db) return []
  try {
    const keys = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAllKeys()
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
    })
    return keys.filter((k) => typeof k === 'string' && k.startsWith(prefix))
  } catch {
    return []
  }
}

export function demo() {
  const assertEq = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`offlineCache demo failed: ${label} expected ${expected}, got ${actual}`)
    }
  }

  // Threat RED 3: the v3 upgrade path is strictly additive — kv/outbox rows
  // survive the bump; cache-meta is the only addition (never a rebuild).
  const created = []
  const mockDb = {
    createObjectStore: (name) => {
      created.push(name)
      return {}
    },
  }

  created.length = 0
  applyUpgrade(mockDb, 0)
  assertEq(created.join(','), 'kv,outbox,cache-meta', 'fresh profile builds all stores')

  created.length = 0
  applyUpgrade(mockDb, 1)
  assertEq(created.join(','), 'outbox,cache-meta', 'v1→v3 adds outbox + cache-meta, keeps kv')

  created.length = 0
  applyUpgrade(mockDb, 2)
  assertEq(created.join(','), 'cache-meta', 'v2→v3 adds cache-meta only')

  created.length = 0
  applyUpgrade(mockDb, 3)
  assertEq(created.length, 0, 'v3 open creates nothing — existing stores untouched')

  assertEq(DB_VERSION, 3, 'shared DB_VERSION is 3')
  assertEq(CACHE_META_STORE, 'cache-meta', 'cache-meta store name contract')

  console.log('offlineCache demo OK: 6 asserts (v3 additive upgrade, kv/outbox preserved)')
}