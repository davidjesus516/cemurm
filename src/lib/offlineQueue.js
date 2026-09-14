// IDB-backed FIFO queue of pending offline writes, one key per user holding
// an ordered array of ops. Shares the cemurm-offline DB with offlineCache.js;
// version 2 adds the outbox store. Pure native API — no dependencies.
// ponytail: plain IndexedDB, one read-modify-write per op — no transactional
// guarantee across the read+put pair and no multi-tab coordination; add a
// single-writer tab / lock if concurrent drains ever matter.

const DB_NAME = 'cemurm-offline'
const STORE_NAME = 'outbox'

let dbPromise = null

function getDb() {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.resolve(null)
    return dbPromise
  }
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 2)
      req.onupgradeneeded = () => {
        // kv is normally created by offlineCache's version-1 open; creating it
        // here too keeps the shared DB consistent when this module opens first
        // (a fresh profile would otherwise hit offlineCache's v1 open against a
        // v2 DB, fail with VersionError, and permanently disable the cache).
        if (req.oldVersion < 1) req.result.createObjectStore('kv')
        if (req.oldVersion < 2) req.result.createObjectStore(STORE_NAME)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function opKey(userId) {
  return `pending:${userId}`
}

export async function pendingOps(userId) {
  const db = await getDb()
  if (!db) return []
  try {
    const ops = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(opKey(userId))
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
    })
    return Array.isArray(ops) ? ops : []
  } catch {
    return []
  }
}

export async function enqueueOp(userId, op) {
  const db = await getDb()
  if (!db) return
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(opKey(userId))
      getReq.onsuccess = () => {
        const ops = Array.isArray(getReq.result) ? getReq.result : []
        const putReq = store.put(
          [...ops, { seq: ops.length, ...op, queuedAt: Date.now() }],
          opKey(userId),
        )
        putReq.onsuccess = () => resolve()
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    })
  } catch {
    // swallow — queue is best-effort
  }
}

export async function removeOps(userId, seqSet) {
  const db = await getDb()
  if (!db) return
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(opKey(userId))
      getReq.onsuccess = () => {
        const ops = getReq.result ?? []
        if (!Array.isArray(ops)) return resolve()
        const remaining = ops.filter((op) => !seqSet.has(op.seq))
        const putReq = store.put(remaining, opKey(userId))
        putReq.onsuccess = () => resolve()
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    })
  } catch {
    // swallow — queue is best-effort
  }
}