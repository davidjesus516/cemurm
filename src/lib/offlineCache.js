// Offline read-through cache backed by IndexedDB.
// Pure native API — no dependencies.
// TTL is caller-side: callers decide staleness; this store always
// serves cached data when the network is unavailable.
// ponytail: plain IndexedDB, no idb wrapper; add one when the
//   open-on-demand pattern becomes awkward.

const DB_NAME = 'cemurm-offline'
const STORE_NAME = 'kv'

let dbPromise = null

function getDb() {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.resolve(null)
    return dbPromise
  }
  dbPromise = new Promise((resolve) => {
    try {
      // Must match offlineQueue's schema: the shared DB is version 2.
      // Opening with version 1 against a v2 DB throws VersionError and
      // permanently disables the cache. Both stores are created here too so
      // the upgrade schema does not depend on which module opens first.
      const req = indexedDB.open(DB_NAME, 2)
      req.onupgradeneeded = () => {
        if (req.oldVersion < 1) req.result.createObjectStore('kv')
        if (req.oldVersion < 2) req.result.createObjectStore('outbox')
      }
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