// Drains the IDB outbox after reconnecting. Client-only: ops are replayed
// in order against the server; no server-side outbox sync yet.
// ponytail: client-only FIFO — no server outbox drain yet and no conflict
// merge; replayed in order, last write wins; upgrade when
// offline-edit-conflict-policy lands.

import * as setlists from './setlists.js'
import * as gigs from './gigs.js'
import { pendingOps, removeOps } from './offlineQueue.js'

// op.name whitelist — setlist + gig writes are queued (see setlists.js /
// gigs.js 2a.6). Unknown op names warn + drop at drain (D6).
const WRITE_OPS = {
  createSetlist: setlists.createSetlist,
  updateSetlist: setlists.updateSetlist,
  addSongToSetlist: setlists.addSongToSetlist,
  removeSongFromSetlist: setlists.removeSongFromSetlist,
  moveSongInSetlist: setlists.moveSongInSetlist,
  createGig: gigs.createGig,
  updateGig: gigs.updateGig,
  completeGig: gigs.completeGig,
}

// Last userId explicitly passed to drainPending. The 'online' listener
// receives a raw Event object, so the user identity must come from here.
let knownUserId = null

let draining = false

export function startOfflineSync() {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', drainPending)
  }
  return drainPending
}

export async function drainPending(userId) {
  if (typeof userId === 'string' && userId) knownUserId = userId
  const target = knownUserId
  if (!target) return
  if (draining) return
  draining = true
  try {
    const ops = await pendingOps(target)
    for (const op of ops) {
      const fn = WRITE_OPS[op.name]
      if (!fn) {
        console.warn(`offline sync: dropping unknown queued op "${op.name}"`)
        await removeOps(target, new Set([op.seq]))
        continue
      }
      try {
        await fn(...op.args)
        await removeOps(target, new Set([op.seq]))
      } catch (e) {
        // Still offline or server rejected — stop and keep the rest in order.
        console.warn(`offline sync: op ${op.name} failed, retrying on next reconnect`, e?.message || e)
        break
      }
    }
  } finally {
    draining = false
  }
}
