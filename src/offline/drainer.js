// @ts-check
// Drains the IDB outbox after reconnecting. Client-only: ops are replayed
// in order against the server; no server-side outbox sync yet.
// ponytail: client-only FIFO — no server outbox drain yet; 2.6 reconciles the
// item ops against the current server setlist before replay (R6/R7), the rest
// is last-write-wins. Upgrade when offline-edit-conflict-policy lands.

import * as setlists from '../data/repositories/setlists.js'
import * as gigs from '../data/repositories/gigs.js'
import * as bandmates from '../data/repositories/bandmates.js'
import * as comments from '../data/repositories/comments.js'
import * as substitutions from '../data/repositories/substitutions.js'
import * as feedback from '../data/repositories/feedback.js'
import { listSongs } from '../data/repositories/songs.js'
import { pendingOps, removeOps, patchOps, quarantineOps } from './queue.js'
import { offlineGet, offlineSet, offlineRemove } from './cache.js'
import { reconcileSetlistOp } from '../domain/setlist/collab.js'
import { decideDrainOutcome, DRAIN_ACTION, DRAIN_KIND, quarantineNotice } from '../domain/offline/drainFailure.js'

/**
 * A queued op row, aliased from queue.js (which owns the shape) so the
 * writer and this drainer cannot drift apart.
 * @typedef {import('./queue.js').QueuedOp} QueuedOp
 */

/**
 * Replay decision for one queued op: replay it, or drop it — plus the
 * user-facing notice when the drop lost data.
 * @typedef {object} ReplayDecision
 * @property {boolean} replay
 * @property {string} [notice]
 */

// op.name whitelist — setlist + gig writes are queued (see setlists.js /
// gigs.js 2a.6), plus the 2.6 collaboration ops (2b). Unknown op names warn +
// drop at drain (D6).
/** @type {Record<string, (...args: any[]) => Promise<unknown>>} */
const WRITE_OPS = {
  createSetlist: setlists.createSetlist,
  updateSetlist: setlists.updateSetlist,
  addSongToSetlist: setlists.addSongToSetlist,
  removeSongFromSetlist: setlists.removeSongFromSetlist,
  moveSongInSetlist: setlists.moveSongInSetlist,
  setSongVersion: setlists.setSongVersion,
  setMidiProgram: setlists.setMidiProgram,
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
  // Hito 5 #81 (substitutions, scenario 17): an offline-accepted
  // substitution. First-wins makes a replay that finds the position already
  // covered a SUPERSEDED outcome, not a drain-stopping failure — the drain
  // drops it with a notice below.
  respondSubstitution: substitutions.respondSubstitution,
  // Hito 5 feedback: the offline path replays the SAME self-scoped insert —
  // RLS still binds user_id to the session at replay time (0029).
  submitFeedback: feedback.submitFeedback,
}

// Ops whose replay rejection is a designed supersession (first-wins): when
// the server rejects with a matching message, the queued intent is stale —
// drop the op with a notice and keep draining, instead of stopping the queue.
// The two setlist item ops join on the RPC's own sentinel: apply_setlist_item_op
// returns {applied:false} when the pair is already decided, and the write path
// turns that into the message below. The RPC is the arbiter, so a refusal here
// is a designed supersession, not a drain-stopping failure.
/** @type {Record<string, RegExp>} */
const SUPERSEDED_ERRORS = {
  respondSubstitution: /Position already covered\./,
  addSongToSetlist: /Superseded by a later offline edit\./,
  removeSongFromSetlist: /Superseded by a later offline edit\./,
}

/**
 * The notice line for a designed supersession, per op. An item op is NOT a
 * substitution — reusing that wording would tell the musician an unrelated
 * thing happened — so it gets its own honest line: the edit reached the server
 * too late / lost the recorded tie-break and was not applied.
 * @param {string} opName
 * @returns {string}
 */
function supersededNotice(opName) {
  if (opName === 'respondSubstitution') {
    return 'A substitution you accepted was already covered before your sync.'
  }
  return 'A queued setlist edit was superseded by a later offline edit and was not applied.'
}

// 2.6 (R6/R7): an item add/remove carries no server state of its own, so it is
// reconciled against the CURRENT server setlist before replay — a superseded
// add drops with a user notice, an already-satisfied op drops silently.
const RECONCILE_OPS = new Set(['addSongToSetlist', 'removeSongFromSetlist'])

// Drain-time notices are one-shot strings the UI consumes ("removed before
// your sync"), keyed per user so two accounts on one device never mix.
/**
 * @param {string} userId
 * @returns {string}
 */
const noticesKey = (userId) => `sync-notices:${userId}`

/**
 * Pending drain notices for a user, oldest first.
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function syncNotices(userId) {
  return (await offlineGet(noticesKey(userId)))?.data || []
}

/**
 * Consume the pending notices (the UI shows each exactly once).
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function clearSyncNotices(userId) {
  await offlineRemove(noticesKey(userId))
}

// Last userId explicitly passed to drainPending. The 'online' listener
// receives a raw Event object, so the user identity must come from here.
/** @type {string | null} */
let knownUserId = null

/** Online check, guarded for node (no navigator ⇒ online). */
function isOnline() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

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
 * @param {string} userId
 * @param {QueuedOp} op
 * @returns {Promise<ReplayDecision>}
 */
async function decideReplay(userId, op) {
  let server = null
  try {
    // args is [userId, setlistId, songId] for the two reconciled ops.
    server = await setlists.fetchServerSetlist(userId, /** @type {string} */ (op.args?.[1]))
  } catch {
    return { replay: true }
  }
  // Unsound by construction, and deliberately labelled as such: the queue is
  // generic (`args: unknown[]`) but only the two reconciled setlist ops reach
  // this line, and their args are positional string ids. Narrowing happens at
  // the call site rather than by widening QueuedOp, which would un-honest the
  // rest of the queue. Mirrors the webMidi sendProgramChange precedent.
  // Structural, not an import(): QueuedSetlistOp is a module-local typedef in
  // collab.js and is deliberately not exported. `opKey` rides along for the
  // equal-timestamp tie-break mirror.
  const setlistOp = /** @type {{ name: string, args?: string[], queuedAt?: number, opKey?: string }} */ (op)
  const decision = reconcileSetlistOp(setlistOp, server)
  if (!decision.drop) return { replay: true }
  if (!decision.notice) return { replay: false }
  return { replay: false, notice: await buildNotice(userId, op, decision.reason, decision.rule) }
}

/**
 * The notice line (R7). The actor is unknowable — a postgres_changes payload
 * carries no user id (D5) — so the line names the song instead. The song lookup
 * is cosmetic: a failure falls back to the generic line rather than losing the
 * notice.
 *
 * `reason` decides the wording, and it matters more than the branch name. Only
 * a genuine supersession may claim someone else got there first; an operation
 * this client cannot identify must not blame a collaborator for a write the
 * client simply failed to replay. `rule === 'op-key'` narrows further: the drop
 * was a lost tie-break, not a later write, so it must not be worded as a
 * removal — the honest line says the edit lost the tie-break.
 *
 * @param {string} userId
 * @param {QueuedOp} op
 * @param {string} [reason]
 * @param {string} [rule]
 * @returns {Promise<string>}
 */
async function buildNotice(userId, op, reason, rule) {
  if (reason === 'malformed') {
    return 'A queued change to the setlist could not be read and was not applied. Please make the change again.'
  }
  if (reason === 'unknown-age') {
    return 'A queued change to the setlist lost its timestamp and was not applied. Please make the change again.'
  }
  if (rule === 'op-key') {
    return 'A queued setlist edit lost the tie-break with another device and was not applied.'
  }
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

/**
 * @param {string} userId
 * @param {string[]} lines
 * @returns {Promise<void>}
 */
async function appendNotices(userId, lines) {
  const existing = await syncNotices(userId)
  await offlineSet(noticesKey(userId), [...existing, ...lines])
}

/**
 * Replay the user's queued ops in order, then drop them. Unknown op names and
 * designed supersessions are dropped with a notice; any other rejection stops
 * the drain so the remaining ops keep their order. `userId` is optional and
 * may be absent: the 'online' listener registered by startOfflineSync passes
 * a raw Event, which the `typeof userId === 'string'` guard below rejects, so
 * the identity falls back to the last value a caller passed in.
 * @param {string | Event | null | undefined} [userId]
 * @returns {Promise<void>}
 */
export async function drainPending(userId) {
  if (typeof userId === 'string' && userId) knownUserId = userId
  const target = knownUserId
  if (!target) return
  if (draining) return
  draining = true
  let drained = 0
  let setAside = 0
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
        const isItemOp = RECONCILE_OPS.has(op.name)
        if (isItemOp) {
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
        if (isItemOp) {
          // Carry the op's ORIGINAL identity into the write so a replayed op
          // keeps its queued-at timestamp and tie-break key. Minting a fresh
          // Date.now() here would make an old offline op beat every later
          // write. A legacy op with no opKey sends undefined and the write
          // path mints one then (the RPC refuses a null key).
          await fn(...op.args, { opKey: op.opKey, queuedAt: op.queuedAt })
        } else {
          await fn(...op.args)
        }
        await removeOps(target, new Set([op.seq]))
        drained += 1
      } catch (e) {
        // A superseded first-wins accept is not an error for the queue: the
        // position was covered by someone else before the sync, so the queued
        // intent is moot. Drop it with a notice and keep draining. Every other
        // rejection is classified below.
        const superseded = SUPERSEDED_ERRORS[op.name]?.test(String(/** @type {Error} */ (e)?.message || ''))
        if (superseded) {
          notices.push(supersededNotice(op.name))
          await removeOps(target, new Set([op.seq]))
          drained += 1
          continue
        }
        // R6: classify the failure before reacting. The old code broke out on
        // every error, so one op the server rejects deterministically (an RLS
        // denial, a validation guard, a 409) stalled every later op forever —
        // app-wide, because the queue is shared by unrelated features. A bare
        // `continue` is the opposite trap: it retries a doomed op on every
        // drain, forever. So: retry only what might still succeed, set aside
        // what provably cannot, and keep draining either way.
        const outcome = decideDrainOutcome(e, { online: isOnline(), attempts: op.attempts || 0 })
        if (outcome.action === DRAIN_ACTION.RETRY) {
          // No verdict from the server (offline, gateway fault) or a failure we
          // could not classify. Keep the op and stop here: the ops behind it
          // may depend on this one, and they are replayed in seq order.
          // patchOps only records the attempt count for unclassified failures,
          // which is what bounds the retry of a permanently broken op.
          const attempts = (op.attempts || 0) + 1
          if (outcome.kind === DRAIN_KIND.UNKNOWN) {
            await patchOps(target, new Set([op.seq]), { attempts, lastFailedAt: Date.now() })
          }
          console.warn(
            `offline sync: op ${op.name} failed (${outcome.reason}), retrying on next reconnect`,
            outcome.detail || e,
          )
          break
        }
        // The server rejected this exact op and will reject it again. Move it
        // to the quarantine — kept on the device, not dropped — and keep
        // draining so the rest of the queue is not held hostage to it.
        console.warn(
          `offline sync: op ${op.name} rejected (${outcome.reason}), set aside`,
          outcome.detail || e,
        )
        await quarantineOps(target, new Set([op.seq]), outcome)
        setAside += 1
        drained += 1
      }
    }
    if (setAside > 0) notices.push(quarantineNotice(setAside))
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
