// Drains the IDB outbox after reconnecting. Client-only: ops are replayed
// in order against the server; no server-side outbox sync yet.
// ponytail: client-only FIFO — no server outbox drain yet; 2.6 reconciles the
// item ops against the current server setlist before replay (R6/R7), the rest
// is last-write-wins. Upgrade when offline-edit-conflict-policy lands.

import * as setlists from './setlists.js'
import * as gigs from './gigs.js'
import * as bandmates from './bandmates.js'
import * as comments from './comments.js'
import * as feedback from './feedback.js'
import { listSongs } from './songs.js'
import { pendingOps, removeOps } from './offlineQueue.js'
import { offlineGet, offlineSet, offlineRemove } from './offlineCache.js'
import { reconcileSetlistOp } from './setlistCollab.js'

// op.name whitelist — setlist + gig writes are queued (see setlists.js /
// gigs.js 2a.6), plus the 2.6 collaboration ops (2b). Unknown op names warn +
// drop at drain (D6).
const WRITE_OPS = {
  createSetlist: setlists.createSetlist,
  updateSetlist: setlists.updateSetlist,
  addSongToSetlist: setlists.addSongToSetlist,
  removeSongFromSetlist: setlists.removeSongFromSetlist,
  moveSongInSetlist: setlists.moveSongInSetlist,
  setSongVersion: setlists.setSongVersion,
  // 2.6 (R5): collaboration ops are replay-safe because they re-run their own
  // guards against server state — share targets are filtered against the
  // current roster, permission/removal are idempotent, and transferOwnership
  // returns early once the flip is applied.
  setVisibility: setlists.setVisibility,
  shareWithBandmates: setlists.shareWithBandmates,
  setCollaboratorPermission: setlists.setCollaboratorPermission,
  removeCollaborator: setlists.removeCollaborator,
  transferOwnership: setlists.transferOwnership,
  createGig: gigs.createGig,
  updateGig: gigs.updateGig,
  completeGig: gigs.completeGig,
  // Hito 3 bandmates (1.3): respondInvite is idempotent — a revoked invite
  // drops silently on replay instead of erroring the drain (R6).
  inviteBandmate: bandmates.inviteBandmate,
  respondInvite: bandmates.respondInvite,
  // 3.2 (R11): comment ops are replay-safe — post re-runs the scoped RLS
  // insert (resolving to its server id), edit/delete re-run their author_id
  // filter and resolve its id filter, so an already-applied op no-ops at the
  // row level instead of erroring the drain.
  postComment: comments.postComment,
  editComment: comments.editComment,
  deleteComment: comments.deleteComment,
  resolveComment: comments.resolveComment,
  // Hito 5 feedback: the offline path replays the SAME self-scoped insert —
  // RLS still binds user_id to the session at replay time (0020).
  submitFeedback: feedback.submitFeedback,
}

// 2.6 (R6/R7): an item add/remove carries no server state of its own, so it is
// reconciled against the CURRENT server setlist before replay — a superseded
// add drops with a user notice, an already-satisfied op drops silently.
const RECONCILE_OPS = new Set(['addSongToSetlist', 'removeSongFromSetlist'])

// Drain-time notices are one-shot strings the UI consumes ("removed before
// your sync"), keyed per user so two accounts on one device never mix.
const noticesKey = (userId) => `sync-notices:${userId}`

/** Pending drain notices for a user, oldest first. */
export async function syncNotices(userId) {
  return (await offlineGet(noticesKey(userId)))?.data || []
}

/** Consume the pending notices (the UI shows each exactly once). */
export async function clearSyncNotices(userId) {
  await offlineRemove(noticesKey(userId))
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

/**
 * Replay decision for one queued item op. The state read is a real network
 * read (fetchServerSetlist) — the cached copy would hide the very online
 * change that decides the outcome. When the read fails the op is kept for the
 * next drain (the replay would fail on the same connection anyway).
 */
async function decideReplay(userId, op) {
  let server = null
  try {
    server = await setlists.fetchServerSetlist(userId, op.args?.[1])
  } catch {
    return { replay: true }
  }
  const decision = reconcileSetlistOp(op, server)
  if (!decision.drop) return { replay: true }
  if (!decision.notice) return { replay: false }
  return { replay: false, notice: await buildNotice(userId, op) }
}

/**
 * "removed before your sync" line (R7). The actor is unknowable — a
 * postgres_changes payload carries no user id (D5) — so the notice names the
 * song instead. The song lookup is cosmetic: a failure falls back to the
 * generic line rather than losing the notice.
 */
async function buildNotice(userId, op) {
  const songId = op.args?.[2]
  let title = null
  try {
    const songs = await listSongs(userId)
    title = songs.find((s) => s.id === songId)?.title || null
  } catch {
    // cosmetic — fall through to the generic notice
  }
  return title
    ? `"${title}" was removed from the setlist before your sync.`
    : 'A song was removed from the setlist before your sync.'
}

async function appendNotices(userId, lines) {
  const existing = await syncNotices(userId)
  await offlineSet(noticesKey(userId), [...existing, ...lines])
}

export async function drainPending(userId) {
  if (typeof userId === 'string' && userId) knownUserId = userId
  const target = knownUserId
  if (!target) return
  if (draining) return
  draining = true
  let drained = 0
  const notices = []
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
        if (RECONCILE_OPS.has(op.name)) {
          const { replay, notice } = await decideReplay(target, op)
          if (!replay) {
            // Superseded by an online change (R7) or already satisfied — the
            // op must NOT be replayed; tell the user when it lost data.
            if (notice) notices.push(notice)
            await removeOps(target, new Set([op.seq]))
            drained += 1
            continue
          }
        }
        await fn(...op.args)
        await removeOps(target, new Set([op.seq]))
        drained += 1
      } catch (e) {
        // Still offline or server rejected — stop and keep the rest in order.
        console.warn(`offline sync: op ${op.name} failed, retrying on next reconnect`, e?.message || e)
        break
      }
    }
    if (notices.length) await appendNotices(target, notices)
  } finally {
    draining = false
    // The UI refetches its pending state and reads the notices off this event
    // (SetlistDetail listens alongside 'online').
    if (drained > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cemurm:sync-done'))
    }
  }
}
