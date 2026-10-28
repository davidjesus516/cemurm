// @ts-check
// IDB-backed FIFO queue of pending offline writes, one key per user holding
// an ordered array of ops. Shares the cemurm-offline DB with offlineCache.js;
// version 2 added the outbox store, version 3 adds cache-meta (hito-2-remainder
// 2a.2, D5). Pure native API — no dependencies. The upgrade plan is imported
// from offlineCache.js, so both modules are lockstep by construction: drift
// between them would throw a VersionError and disable the cache.
// ponytail: plain IndexedDB, one read-modify-write per op — no transactional
// guarantee across the read+put pair and no multi-tab coordination; add a
// single-writer tab / lock if concurrent drains ever matter.

import { DB_VERSION, applyUpgrade } from './cache.js'

/**
 * One queued op as enqueueOp stores it. `name` keys the drain-time
 * WRITE_OPS whitelist, `args` is the positional argument list replayed into
 * that handler (heterogeneous by design — ids, comment payloads, booleans —
 * so it stays `unknown[]` here and is narrowed per op by the consumer),
 * `seq` is the FIFO position inside the user's array and `queuedAt` the
 * enqueue timestamp the reconcile compares server state against.
 * @typedef {object} QueuedOp
 * @property {string} name
 * @property {unknown[]} args
 * @property {number} seq
 * @property {number} queuedAt
 * @property {string} [opKey] Per-operation uuid minted at enqueue, the tie-break
 *   key the offline arbitration compares (0037 `winner_op_key`). Absent only on
 *   an op queued by a build that predates it — the replay paths mint one then
 *   rather than send null, which the RPC refuses.
 * @property {number} [attempts] Failed-replay count. Absent until the drainer
 *   sees an unclassifiable failure; bounds how often a doomed op is retried.
 * @property {number} [lastFailedAt]
 * @property {number} [quarantinedAt] Present only on a quarantined copy, never
 *   on a pending one — the op is moved, not copied, so this marks the record
 *   as the retained audit copy rather than a queued write.
 * @property {string} [quarantineReason]
 * @property {string} [quarantineDetail]
 */

/**
 * What a caller hands enqueueOp: the op name and its arguments. `seq` and
 * `queuedAt` are stamped by the queue, not the caller.
 * @typedef {object} QueuedOpInput
 * @property {string} name
 * @property {unknown[]} args
 */

const DB_NAME = 'cemurm-offline'
const STORE_NAME = 'outbox'

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
      // kv/cache-meta are created here too via the shared plan when this
      // module opens first (a fresh profile would otherwise hit a lower
      // version open and permanently disable the cache).
      //
      // UNSOUND CAST, deliberately kept: `oldVersion` is declared on
      // IDBVersionChangeEvent (the upgradeneeded event), not on
      // IDBOpenDBRequest — same quirk as cache.js getDb, mirrored here so the
      // two modules stay lockstep. Left verbatim because this is a typing
      // pass, not a behavior change.
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
 * @param {string} userId
 * @returns {string}
 */
function outboxKey(userId) {
  return `pending:${userId}`
}

/**
 * Mint one per-operation identity key (a uuid v4) for a queued op. This is the
 * value the server arbitration stores as `winner_op_key` and the client mirror
 * compares on a timestamp tie, so it must be a real uuid string.
 *
 * The `crypto.randomUUID` access is guarded because `crypto` is not guaranteed
 * (the same reason pdfCharts.js:59 guards it). The fallback there is an opaque
 * `${Date.now()}-${Math.random()}` string, which is fine for an object key but
 * NOT reusable here: this value is sent into the RPC's `p_op_key uuid`
 * parameter, and a non-uuid raises `invalid input syntax for type uuid`,
 * failing a replay the user cannot fix. So the fallback is a Math.random UUID
 * v4. Lowercase, matching `crypto.randomUUID()` and Postgres's canonical uuid
 * rendering, so the client string comparison and the SQL `::text` comparison
 * agree.
 * @returns {string}
 */
export function newOpKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Ops set aside by the drainer because the server rejects them and a retry can
// never change that. Same store, same per-user keying, same read-modify-write
// as the pending list — NOT a second store, so the DB version is unchanged and
// there is no upgrade to keep in lockstep. A quarantined op is moved, never
// deleted: the record (name, args, why, when) stays on the device so the write
// is auditable and recoverable. Nothing evicts this store (see
// lib/storage.js EVICTION_ORDER = pdf, exports), so it survives until a
// feature decides what to do with it.
/**
 * @param {string} userId
 * @returns {string}
 */
function quarantineKey(userId) {
  return `quarantine:${userId}`
}

/**
 * The user's queued ops, in enqueue order. Empty when the cache is
 * unavailable, nothing is queued, or the read threw.
 * @param {string} userId
 * @returns {Promise<QueuedOp[]>}
 */
export async function pendingOps(userId) {
  const db = await getDb()
  if (!db) return []
  try {
    const ops = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(outboxKey(userId))
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
    })
    return Array.isArray(ops) ? ops : []
  } catch {
    return []
  }
}

/**
 * Append one op to the user's queue, stamped with its FIFO `seq`, its
 * `queuedAt`, and the per-op `opKey` the 0037 tie-break arbitration compares.
 * Read-modify-write on the whole array (documented ponytail: no cross-request
 * transaction guarantee). Best-effort — a no-op when the cache is unavailable,
 * and every failure is swallowed.
 * @param {string} userId
 * @param {QueuedOpInput} op
 * @returns {Promise<void>}
 */
export async function enqueueOp(userId, op) {
  const db = await getDb()
  if (!db) return
  try {
    await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(outboxKey(userId))
      getReq.onsuccess = () => {
        const ops = Array.isArray(getReq.result) ? getReq.result : []
        const putReq = store.put(
          [...ops, { seq: ops.length, ...op, queuedAt: Date.now(), opKey: newOpKey() }],
          outboxKey(userId),
        )
        putReq.onsuccess = () => resolve(undefined)
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    }))
  } catch {
    // swallow — queue is best-effort
  }
}

/**
 * Drop the ops whose `seq` is in `seqSet` (drained or superseded). Ops with
 * any other seq keep their original order. Best-effort.
 * @param {string} userId
 * @param {Set<number>} seqSet
 * @returns {Promise<void>}
 */
export async function removeOps(userId, seqSet) {
  const db = await getDb()
  if (!db) return
  try {
    await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(outboxKey(userId))
      getReq.onsuccess = () => {
        const ops = getReq.result ?? []
        if (!Array.isArray(ops)) return resolve(undefined)
        const remaining = ops.filter((op) => !seqSet.has(op.seq))
        const putReq = store.put(remaining, outboxKey(userId))
        putReq.onsuccess = () => resolve(undefined)
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    }))
  } catch {
    // swallow — queue is best-effort
  }
}

/**
 * Merge a patch into the ops carrying the given seqs, leaving every other op
 * and the array order untouched. The drainer uses it to count a failed op's own
 * attempts, so a failure class that cannot be classified still stops being
 * retried after a bounded number of drains (R6) without ever touching an op
 * that has not failed.
 *
 * @param {string} userId
 * @param {Set<number>} seqSet
 * @param {Record<string, unknown>} patch
 * @returns {Promise<void>}
 */
export async function patchOps(userId, seqSet, patch) {
  const db = await getDb()
  if (!db) return
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(outboxKey(userId))
      getReq.onsuccess = () => {
        const ops = getReq.result ?? []
        if (!Array.isArray(ops)) return resolve(undefined)
        const patched = ops.map((op) => (seqSet.has(op.seq) ? { ...op, ...patch } : op))
        const putReq = store.put(patched, outboxKey(userId))
        putReq.onsuccess = () => resolve(undefined)
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    })
  } catch {
    // swallow — queue is best-effort
  }
}

/**
 * Move ops out of the pending queue and into the per-user quarantine, stamped
 * with why. Called by the drainer for an op the server rejects
 * deterministically, so it stops blocking every op queued behind it.
 *
 * The quarantine is written BEFORE the op is dropped from the pending list, so
 * a crash in between leaves the op in both places (a retry is idempotent, the
 * record is the audit trail) rather than in neither. The reverse order would be
 * a silent data-loss window — the one thing this must never be.
 *
 * @param {string} userId
 * @param {Set<number>} seqSet
 * @param {{ reason: string, detail?: string }} failure Classifier output.
 * @returns {Promise<void>}
 */
export async function quarantineOps(userId, seqSet, failure) {
  const db = await getDb()
  if (!db) return
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(outboxKey(userId))
      getReq.onsuccess = () => {
        const ops = getReq.result ?? []
        if (!Array.isArray(ops)) return resolve(undefined)
        const moved = ops.filter((op) => seqSet.has(op.seq))
        if (!moved.length) return resolve(undefined)
        const stamp = {
          quarantinedAt: Date.now(),
          quarantineReason: failure?.reason || 'unknown',
          quarantineDetail: failure?.detail || '',
        }
        const qReq = store.get(quarantineKey(userId))
        qReq.onsuccess = () => {
          const existing = Array.isArray(qReq.result) ? qReq.result : []
          const qPut = store.put(
            [...existing, ...moved.map((op) => ({ ...op, ...stamp }))],
            quarantineKey(userId),
          )
          qPut.onsuccess = () => {
            const remaining = ops.filter((op) => !seqSet.has(op.seq))
            const putReq = store.put(remaining, outboxKey(userId))
            putReq.onsuccess = () => resolve(undefined)
            putReq.onerror = () => reject(putReq.error)
          }
          qPut.onerror = () => reject(qPut.error)
        }
        qReq.onerror = () => reject(qReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    })
  } catch {
    // swallow — queue is best-effort
  }
}