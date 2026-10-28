// @ts-check
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
 * A kv row exactly as offlineSet writes it: the caller-shaped payload under
 * `data` plus the write timestamp. `data` is deliberately `any` — the kv store
 * is schemaless and the payload shape belongs to the caller, and the
 * withReadThrough helpers (songs.js, setlists.js, follows.js,
 * notifications.js) return `cached.data` straight out of their own
 * `@template T` function, which any narrower type here would not satisfy.
 * @typedef {object} OfflineCacheEntry
 * @property {any} data
 * @property {number} savedAt
 */

/**
 * cache-meta row (storage screen, 2b.1 D5): the cache name this row describes
 * plus the byte count and timestamp recorded alongside it. `name` is the store
 * key; `bytes`/`savedAt` come from an IDB `getAll()` spread, whose row values
 * tsc cannot verify against this declaration.
 * @typedef {object} CacheMetaRow
 * @property {string} name
 * @property {number} bytes
 * @property {number} savedAt
 */

/**
 * The slice of IDBDatabase that applyUpgrade touches. Structural rather than
 * IDBDatabase so demo() can pass a plain mock that only records
 * createObjectStore calls.
 * @typedef {{ createObjectStore: (name: string) => unknown }} UpgradeTarget
 */

/**
 * Additive upgrade plan, shared with offlineQueue.js — single source of
 * truth, so the two modules are lockstep by construction (D5; drift would
 * surface as a VersionError and permanently disable the cache). Runs inside
 * onupgradeneeded; existing stores are always preserved.
 * @param {UpgradeTarget} db
 * @param {number} oldVersion
 * @returns {void}
 */
export function applyUpgrade(db, oldVersion) {
  if (oldVersion < 1) db.createObjectStore('kv')
  if (oldVersion < 2) db.createObjectStore('outbox')
  if (oldVersion < 3) db.createObjectStore(CACHE_META_STORE)
}

/** @type {Promise<IDBDatabase | null> | null} */
let dbPromise = null

/** @returns {Promise<IDBDatabase | null>} */
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
      // UNSOUND CAST, deliberately kept: `oldVersion` is declared on
      // IDBVersionChangeEvent (the upgradeneeded event), not on
      // IDBOpenDBRequest. TS 7.0.2 agrees — `req.oldVersion` is TS2339 without
      // help. The intersection records what the code reads without pretending
      // the request declares it. Left verbatim because this is a typing pass,
      // not a behavior change: if the read really is undefined at runtime then
      // every `oldVersion < N` in applyUpgrade is false and no store is ever
      // created, which would be a real bug. NOT VERIFIED — no browser, jsdom or
      // fake-indexeddb is available in this environment, so the runtime value
      // is unconfirmed. Reported upstream for a maintainer to check in a
      // browser before anyone acts on it.
      const req = /** @type {IDBOpenDBRequest & { oldVersion?: number }} */ (
        indexedDB.open(DB_NAME, DB_VERSION)
      )
      req.onupgradeneeded = () => applyUpgrade(req.result, /** @type {number} */ (req.oldVersion))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

/**
 * Read a kv row. Resolves null when the cache is unavailable (no
 * IndexedDB, open failed), the key is missing, or the read threw — a
 * read-through caller then falls through to the network.
 * @param {string} key
 * @returns {Promise<OfflineCacheEntry | null>}
 */
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

/**
 * Write a kv row, stamping savedAt. Best-effort: a no-op when the cache is
 * unavailable, and every failure is swallowed.
 * @param {string} key
 * @param {unknown} data
 * @returns {Promise<void>}
 */
export async function offlineSet(key, data) {
  const db = await getDb()
  if (!db) return
  try {
    // The explicit Promise<void> is load-bearing, not decoration: the executor
    // calls `resolve()` with no argument, which infers `unknown` and makes the
    // awaited expression unassignable in a void context.
    await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put({ data, savedAt: Date.now() }, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    }))
  } catch {
    // swallow — cache is best-effort
  }
}

/**
 * Drop a kv row. Best-effort; a missing key is not an error.
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function offlineRemove(key) {
  const db = await getDb()
  if (!db) return
  try {
    await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    }))
  } catch {
    // swallow
  }
}

// Storage screen (2b.1, D5): read every cache-meta row ({bytes, savedAt} per
// cache name) and drop a row when a category cache is cleared/evicted.
/**
 * @returns {Promise<CacheMetaRow[]>}
 */
export async function cacheMetaList() {
  const db = await getDb()
  if (!db) return []
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_META_STORE, 'readonly')
      const keysReq = tx.objectStore(CACHE_META_STORE).getAllKeys()
      const valsReq = tx.objectStore(CACHE_META_STORE).getAll()
      tx.oncomplete = () =>
        resolve(keysReq.result.map((name, i) => ({ name, ...valsReq.result[i] })))
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    return []
  }
}

/**
 * Drop one cache-meta row. Best-effort.
 * @param {string} name
 * @returns {Promise<void>}
 */
export async function cacheMetaRemove(name) {
  const db = await getDb()
  if (!db) return
  try {
    await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_META_STORE, 'readwrite')
      const req = tx.objectStore(CACHE_META_STORE).delete(name)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    }))
  } catch {
    // swallow — meta is best-effort
  }
}

/**
 * Every kv key starting with `prefix`, for the storage screen's per-category
 * eviction. kv keys are always the string keys offlineGet/offlineSet/
 * offlineRemove take, so the filtered result is string[].
 * @param {string} prefix
 * @returns {Promise<string[]>}
 */
export async function offlineKeysByPrefix(prefix) {
  const db = await getDb()
  if (!db) return []
  try {
    const keys = await /** @type {Promise<string[]>} */ (new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAllKeys()
      // IDB types keys as IDBValidKey; this store only ever holds the
      // string keys offlineGet/offlineSet/offlineRemove are called with.
      req.onsuccess = () => resolve(/** @type {string[]} */ (req.result ?? []))
      req.onerror = () => reject(req.error)
    }))
    return keys.filter((k) => typeof k === 'string' && k.startsWith(prefix))
  } catch {
    return []
  }
}

export function demo() {
  /**
   * @param {unknown} actual
   * @param {unknown} expected
   * @param {string} label
   */
  const assertEq = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`offlineCache demo failed: ${label} expected ${expected}, got ${actual}`)
    }
  }

  // Threat RED 3: the v3 upgrade path is strictly additive — kv/outbox rows
  // survive the bump; cache-meta is the only addition (never a rebuild).
  /** @type {string[]} */
  const created = []
  /** @type {UpgradeTarget} */
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