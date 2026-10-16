// @ts-check
// Pure guards + activity labels + lock/reconcile rules for shared-setlist
// collaboration (Hito 3 PR#2a tasks 2.1/2.3 and PR#2b tasks 2.5/2.6). Zero
// imports, so this module is bare-node safe and the demo runs under node
// directly (setlists.js is not: it statically imports songs.js → supabase.js,
// which evaluates import.meta.env at module scope — undefined in bare node).
// The network ops that wrap these guards live in setlists.js; the realtime /
// broadcast / lock helpers, feed panel, and drain loop are the 2.3–2.6
// surfaces.

/**
 * Collaborator surface shareTargets reads: the normalized SetlistCollaborator
 * ({userId, canEdit, acceptedAt}) this layer is handed from setlists.js.
 * @typedef {object} ShareTargetCollaborator
 * @property {string} userId
 */

/**
 * Collaborator surface guardTransfer reads — the guard accepts BOTH the raw
 * setlist_collaborators row ({user_id, accepted_at}) and the normalized one
 * ({userId, ...}), so every key it touches is optional.
 * @typedef {object} TransferCollaboratorRow
 * @property {string} [user_id]
 * @property {string | null} [accepted_at]
 * @property {string} [userId]
 */

/**
 * Feed row the activity panel emits ({actor, action, ts}); `action` is the
 * broadcast op name, free-form for unknown ops (describeActivity degrades to
 * "actor action").
 * @typedef {object} ActivityEvent
 * @property {string} actor
 * @property {string} action
 * @property {string} ts
 */

/**
 * One song's advisory lock (2.5): who holds it, their display name for the
 * "being edited by" notice, and the heartbeat timestamp staleness reads.
 * @typedef {object} SongLock
 * @property {string} userId
 * @property {string | null} actor
 * @property {number} ts
 */

/**
 * Staleness input: only the heartbeat timestamp decides, so the guard reads
 * the bare {ts} stamp — a lock whose holder is gone still ages out.
 * @typedef {object} LockStamp
 * @property {number} [ts]
 */

/**
 * Lock broadcast payload (2.5): the holder, the song, and whether this is an
 * acquire (locked) or a release. ts rides along for cross-tab comparison.
 * @typedef {object} LockPayload
 * @property {string} userId
 * @property {string} songId
 * @property {boolean} locked
 * @property {number} [ts]
 * @property {string | null} [actor]
 */

/**
 * Queued setlist-item op as offlineQueue stores it: {name, args, queuedAt,
 * opKey}. args are positional ids — [userId, setlistId, songId] for the
 * add/remove ops this module reconciles. `opKey` is the per-operation uuid
 * (queue.js newOpKey) the 0037 tie-break compares; absent only on an op queued
 * by a build that predates it (the write path mints one at replay then).
 * @typedef {object} QueuedSetlistOp
 * @property {string} name
 * @property {string[]} [args]
 * @property {number} [queuedAt]
 * @property {string} [opKey]
 */

/**
 * The latest applied resolution for one song, as the server records it
 * (0037 setlist_conflict_resolutions): the winning op's key and the timestamp
 * it was queued at. flattenSetlist reduces the append-only rows to the latest
 * per song.
 * @typedef {object} RecordedResolution
 * @property {string} [opKey] winner_op_key
 * @property {string} [queuedAt] winner_queued_at
 */

/**
 * Server setlist read fresh at drain time ({itemIds, updatedAt,
 * conflictResolutions}); null when the read failed (the caller then replays
 * unconditionally). `conflictResolutions` is the latest recorded resolution PER
 * SONG (0037), keyed by song id — the arbiter's own state, and what the add path
 * compares against FIRST. `updatedAt` is the setlist's own updated_at (server
 * clock, bumped by the item trigger); it is only the FALLBACK primary order, used
 * for a song with no usable recorded resolution.
 * @typedef {object} ReconcileServer
 * @property {string[]} [itemIds]
 * @property {string} [updatedAt]
 * @property {Record<string, RecordedResolution>} [conflictResolutions]
 */

/**
 * Replay decision for one queued op: drop it, and tell the user why when the
 * online change that beats it needs surfacing (R7).
 *
 * `reason` is present only alongside `notice`, and it says WHICH kind of drop
 * this is, because the wording differs and only one of them may blame someone
 * else: 'superseded' (the server is genuinely newer), 'malformed' (this client
 * cannot identify the op) and 'unknown-age' (the op lost its timestamp). The
 * last two are this client's blind spots, not a collaborator's win, and the
 * notice is worded to say exactly that.
 *
 * `rule` names the rule that decided, when one did: 'op-key' for an exact
 * timestamp tie broken by the op key (the 0037 recorded tie-break), or
 * 'later-timestamp' when the primary order decided. It is omitted on the plain
 * legacy branches, whose wording is already honest — emitting one there would
 * churn every pinned decision shape without changing the notice. This is the
 * field the drainer reads to word an item op's lost-tie-break notice honestly,
 * distinct from the "someone removed it first" notice.
 * @typedef {object} ReconcileDecision
 * @property {boolean} drop
 * @property {boolean} [notice]
 * @property {'superseded' | 'malformed' | 'unknown-age'} [reason]
 * @property {'later-timestamp' | 'op-key'} [rule]
 */

/**
 * Visibility values the spec allows: 'private' | 'shared' | 'public'
 * ('org'/'branch' are reserved for Hito 4). Returns an error message or
 * null when valid.
 */
/**
 * @param {string} value
 * @returns {string | null}
 */
export function guardVisibility(value) {
  return ['private', 'shared', 'public'].includes(value)
    ? null
    : 'Visibility must be private, shared, or public.'
}

/**
 * Bandmate ids eligible for a fresh share: excludes the owner (a setlist
 * owner is not a collaborator of their own setlist) and users who already
 * hold a collaborator row, then dedupes (setlist_collaborators is PK
 * (setlist_id, user_id) — a duplicate insert would 23505).
 */
/**
 * @param {string} ownerId
 * @param {string[] | null | undefined} bandmateIds
 * @param {ShareTargetCollaborator[] | null | undefined} collaborators
 * @returns {string[]}
 */
export function shareTargets(ownerId, bandmateIds, collaborators) {
  const existing = new Set((collaborators || []).map((c) => c.userId))
  return [...new Set(bandmateIds || [])].filter((id) => id !== ownerId && !existing.has(id))
}

/**
 * Transfer guard (setlists R9): the new owner must already be an ACCEPTED
 * collaborator — a pending invitee has no setlist access yet (0002
 * setlists_select_member requires accepted_at), so flipping owner_id would
 * hand the setlist to someone who cannot even open it. Accepts lib rows
 * ({user_id, accepted_at}) and normalized rows ({userId, ...}).
 */
/**
 * @param {TransferCollaboratorRow[] | null | undefined} collaborators
 * @param {string} candidateId
 * @returns {string | null}
 */
export function guardTransfer(collaborators, candidateId) {
  const row = (collaborators || []).find((c) => (c.user_id || c.userId) === candidateId)
  if (!row) return 'Only an accepted collaborator can take ownership.'
  if (!row.accepted_at) return 'The new owner must accept the invitation first.'
  return null
}

/** @type {Record<string, (actor: string) => string>} */
const ACTIVITY_LABELS = {
  share: (actor) => `${actor} shared with the band`,
  'reorder': (actor) => `${actor} reordered the setlist`,
  'transfer-ownership': (actor) => `Ownership transferred to ${actor}`,
}

/**
 * Feed row {actor, action, ts} → "who did what" line (S11/S12). Unknown
 * actions degrade gracefully to "actor action".
 */
/**
 * @param {ActivityEvent} event
 * @returns {string}
 */
export function describeActivity(event) {
  const label = ACTIVITY_LABELS[event.action]
  return label ? label(event.actor) : `${event.actor} ${event.action}`
}

// ── 2.5 client advisory lock (spec R3, design D4) ───────────────────────────
// Pure lock-state transitions for the broadcast advisory lock. Payloads
// carry {userId, songId, locked, ts} (+ actor for the "being edited by"
// notice). Locks are ephemeral — no DB row — and die when the holder
// releases (save/cancel/unmount) or when its heartbeat stops and it ages
// past LOCK_TTL_MS (a crashed tab must not block co-editors forever).

export const LOCK_TTL_MS = 30000

/** True when a lock is missing or stale enough to be overwritten/released. */
/**
 * @param {LockStamp | null | undefined} lock
 * @param {number} [now]
 * @returns {boolean}
 */
export function isLockStale(lock, now = Date.now()) {
  return !lock || now - (lock.ts || 0) > LOCK_TTL_MS
}

/**
 * Next lock record ({ [songId]: {userId, actor, ts} }) from a broadcast
 * payload. Releases only remove the holder's own lock (or a stale one) — a
 * late unlock from a previous holder must not clear the current holder's
 * lock. Acquisitions never steal an ACTIVE foreign lock.
 */
/**
 * @param {Record<string, SongLock> | null | undefined} locks
 * @param {LockPayload} payload
 * @returns {Record<string, SongLock>}
 */
export function applyLock(locks, payload) {
  const next = /** @type {Record<string, SongLock>} */ ({ ...(locks || {}) })
  const songId = payload.songId
  const now = Date.now()
  if (payload.locked === false) {
    const held = next[songId]
    if (held && (held.userId === payload.userId || isLockStale(held, now))) delete next[songId]
    return next
  }
  const held = next[songId]
  if (held && held.userId !== payload.userId && !isLockStale(held, now)) return next
  next[songId] = { userId: payload.userId, actor: payload.actor || null, ts: payload.ts || now }
  return next
}

// ── 2.6 offline reconcile (design D6, spec R6/R7) ───────────────────────────
// Pure decision for the drain loop (offlineSync.js): may a queued setlist-item
// op replay against the CURRENT server setlist, and what should the user be
// told when it must not? `server` is the flattened setlist ({itemIds,
// updatedAt}) read fresh at drain time — the cached copy would hide exactly
// the online change that decides this.
//  · add: song already present → the op would no-op → drop. Absent AND a
//    recorded resolution for the song exists → the 0037 arbiter's own rule
//    decides it (later queuedAt wins; on an EXACT tie the greater op key wins,
//    equal-or-lesser is superseded with a notice). Absent AND no recorded
//    resolution → the pre-0037 setlist-level heuristic: the server changed since
//    the op was queued → an online write superseded it → drop + notice (R7:
//    "removed before your sync"). Absent AND server untouched → my add is the
//    newest write → replay (R6 merge).
//  · remove: already absent → outcome achieved → drop silently. Still
//    present → replay (removal is by song_id, position-independent; unrelated
//    online adds merge).
// SCOPE ASYMMETRY, deliberate: only the ADD path mirrors the tie-break. The
// remove path has no timestamp rule today (it never compared updatedAt), and
// inventing one here would be a new rule, not a mirror of the RPC's. The RPC
// still arbitrates BOTH ops authoritatively; the client mirror exists so the
// pre-replay notice is honest, and a remove that loses the server's tie-break
// is caught by the RPC's sentinel and reported by the drainer.
// Reorder/version ops are not reconciled: reorder replays against stale
// indices (D7 keeps it online-only once a setlist is shared) and a version
// write targets one item, so neither has a merge to preserve.

/**
 * Decide replay vs drop for one queued op. Returns { drop, notice? }.
 * notice: true means the caller must surface the "removed before your sync"
 * message (the actor name is unknowable — postgres_changes carries none, D5).
 */
/**
 * @param {QueuedSetlistOp} op
 * @param {ReconcileServer | null | undefined} server
 * @returns {ReconcileDecision}
 */
export function reconcileSetlistOp(op, server) {
  // `op.args?.` guarded a missing `args` but not a missing `op`, so a null op
  // threw on the way in. That crash is finding 6 in this review and is fixed by
  // its own change (fix-unspecified-crashes), deliberately not inside this one:
  // two changes that must be reviewed apart. The guard below is that change's
  // work; the setlist-op check after it is this change's.
  if (!op) return { drop: false }
  const isSetlistOp = op.name === 'addSongToSetlist' || op.name === 'removeSongFromSetlist'
  if (!isSetlistOp) return { drop: false }

  const songId = /** @type {string} */ (op.args?.[2])
  const present = (server?.itemIds || []).includes(songId)

  // A song id the queue never recorded is not a conflict, and not a no-op
  // either — it is an operation this client cannot identify. Dropping it as
  // "superseded" would tell the user their edit lost to someone else when
  // nobody looked at it. Scoped to the two setlist ops: an unrecognised op has
  // no positional args to be short, and replays unconditionally.
  if (songId == null) return { drop: true, notice: true, reason: 'malformed' }

  if (op.name === 'addSongToSetlist') {
    if (present) return { drop: true }
    // A missing queuedAt is unknown age, NOT old. `|| 0` used to make every
    // server timestamp beat it, so a queue row that lost its timestamp was
    // reported as superseded.
    if (op.queuedAt == null) return { drop: true, notice: true, reason: 'unknown-age' }
    const queuedAt = Number(op.queuedAt)

    // 1. The 0037 arbiter's own state, when the server has recorded one, is the
    //    authority. My op is compared against the LAST RECORDED WRITE's
    //    timestamp (`winner_queued_at`), exactly as the SQL compares
    //    `p_queued_at` against the latest resolution for the pair — NOT against
    //    the setlist's own `updated_at`.
    //
    //    This ordering is what makes the equal-timestamp tie reachable at all.
    //    The device that loses reads the server AFTER the winner wrote, so the
    //    setlist's `updated_at` (a server clock, bumped by the item trigger) is
    //    NEWER than both ops' `queuedAt`, while the recorded resolution still
    //    carries the winner's own client `queuedAt`. Comparing the op against
    //    `updated_at` would therefore drop it as "superseded" before the tie was
    //    ever tested, the arbiter would never see it, and the recorded tie-break
    //    rule would never run — the exact determinism failure this closes.
    const recorded = server?.conflictResolutions?.[songId]
    if (recorded) {
      const recordedAt = new Date(/** @type {string} */ (recorded.queuedAt)).getTime()
      if (!Number.isNaN(recordedAt)) {
        // My write is later than the recorded one → the arbiter applies mine.
        if (queuedAt > recordedAt) return { drop: false, rule: 'later-timestamp' }
        if (queuedAt === recordedAt) {
          // Exact tie → the RECORDED tie-break rule, the same one the RPC
          // arbitrates (SQL `p_op_key::text > winner_op_key::text`): the greater
          // lowercased key string wins, equal-or-lesser is superseded. Fixtures
          // (op keys …7f0/7f1/…7f2, timestamp 2026-10-13T10:00:00Z) are shared
          // with scripts/smoke/0037-offline-tie-break.sql — this is the one
          // place the rule is expressed twice, so keep the two in lockstep.
          const mine = op.opKey ? String(op.opKey).toLowerCase() : ''
          // A legacy queue row carries no key. The replay path mints one and the
          // RPC then arbitrates for real, so this mirror must not decide that
          // tie: replaying is recoverable, dropping the op is not.
          if (!mine) return { drop: false, rule: 'op-key' }
          const winner = String(recorded.opKey || '').toLowerCase()
          if (mine > winner) return { drop: false, rule: 'op-key' }
          return { drop: true, notice: true, reason: 'superseded', rule: 'op-key' }
        }
        // My write is older than the recorded one → it lost.
        return { drop: true, notice: true, reason: 'superseded' }
      }
    }

    // 2. No usable recorded resolution for this song — the setlist's history
    //    predates 0037, or the change was not one of the item ops. Fall back to
    //    the pre-0037 setlist-level heuristic: the setlist's own `updated_at`
    //    against the op's `queuedAt`. A malformed/missing `updatedAt` yields NaN
    //    — no usable primary order, so the op replays optimistically (the
    //    pre-existing unparseable-timestamp behaviour, kept).
    const serverTime = server?.updatedAt ? new Date(server.updatedAt).getTime() : NaN
    if (!Number.isNaN(serverTime) && serverTime > queuedAt) {
      return { drop: true, notice: true, reason: 'superseded' }
    }
    // Exact tie on the legacy path: no recorded rule exists to break it, so the
    // op is the song's first write and wins on the primary order (the RPC's
    // "not found" branch).
    if (!Number.isNaN(serverTime) && serverTime === queuedAt) {
      return { drop: false, rule: 'later-timestamp' }
    }
    return { drop: false }
  }
  return { drop: !present }
}

// Self-check: node -e "import('./src/domain/setlist/collab.js').then(m => m.demo())"
export function demo() {
  /**
   * @param {unknown} actual
   * @param {unknown} expected
   * @param {string} label
   */
  const assert = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`setlistCollab demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  assert(guardVisibility('shared'), null, 'shared is a valid visibility')
  assert(guardVisibility('private'), null, 'private is a valid visibility')
  assert(guardVisibility('org'), 'Visibility must be private, shared, or public.', 'org reserved for Hito 4, rejected')

  assert(
    JSON.stringify(shareTargets('me', ['a', 'b', 'a', 'me'], [{ userId: 'b' }])),
    JSON.stringify(['a']),
    'share targets: dedupe, exclude owner and current collaborators',
  )

  const collabs = [
    { user_id: 'jul', accepted_at: '2026-01-01T00:00:00Z' },
    { userId: 'luc', acceptedAt: null },
  ]
  assert(guardTransfer(collabs, 'jul'), null, 'accepted collaborator may take ownership')
  assert(guardTransfer(collabs, 'luc'), 'The new owner must accept the invitation first.', 'pending invitee rejected')
  assert(guardTransfer(collabs, 'ann'), 'Only an accepted collaborator can take ownership.', 'non-collaborator rejected')

  assert(describeActivity({ actor: 'Julian', action: 'reorder', ts: 't' }), 'Julian reordered the setlist', 'reorder label (S11)')
  assert(describeActivity({ actor: 'Julian', action: 'transfer-ownership', ts: 't' }), 'Ownership transferred to Julian', 'transfer label (S12/R9)')
  assert(describeActivity({ actor: 'Julian', action: 'share', ts: 't' }), 'Julian shared with the band', 'share label')
  assert(describeActivity({ actor: 'X', action: 'mystery', ts: 't' }), 'X mystery', 'unknown action falls back to actor + action')

  // 2.5 advisory lock transitions (R3)
  const noLocks = {}
  const t0 = Date.now()
  const aLock = applyLock(noLocks, { userId: 'a', songId: 's1', locked: true, ts: t0 })
  assert(aLock.s1?.userId, 'a', 'acquire stores the holder')
  assert(isLockStale(null), true, 'missing lock is stale')
  assert(isLockStale({ ts: Date.now() }), false, 'fresh lock is not stale')
  assert(
    JSON.stringify(applyLock(aLock, { userId: 'b', songId: 's1', locked: true, ts: t0 + 1000 })),
    JSON.stringify(aLock),
    'active foreign lock is not stolen',
  )
  assert(
    JSON.stringify(applyLock(aLock, { userId: 'b', songId: 's1', locked: false, ts: t0 + 1000 })),
    JSON.stringify(aLock),
    'non-holder unlock is ignored',
  )
  assert(
    JSON.stringify(applyLock(aLock, { userId: 'a', songId: 's1', locked: false, ts: t0 + 1000 })),
    JSON.stringify(noLocks),
    'holder unlock clears the lock',
  )
  const staleLock = { s1: { userId: 'a', actor: null, ts: t0 - LOCK_TTL_MS - 5000 } }
  assert(
    applyLock(staleLock, { userId: 'b', songId: 's1', locked: true, ts: Date.now() }).s1.userId,
    'b',
    'stale lock is overwritable by a new holder',
  )

  // 2.6 offline reconcile (D6/R6/R7)
  const server = { itemIds: ['a', 'b'], updatedAt: new Date(Date.now() + 10000).toISOString() }
  const addQueuedBefore = { name: 'addSongToSetlist', args: ['u', 'sl', 'm'], queuedAt: Date.now() }
  const addQueuedAfter = { name: 'addSongToSetlist', args: ['u', 'sl', 'm'], queuedAt: Date.now() + 20000 }
  const addPresent = { name: 'addSongToSetlist', args: ['u', 'sl', 'a'], queuedAt: Date.now() }
  const removePresent = { name: 'removeSongFromSetlist', args: ['u', 'sl', 'a'], queuedAt: Date.now() }
  const removeAbsent = { name: 'removeSongFromSetlist', args: ['u', 'sl', 'm'], queuedAt: Date.now() }
  assert(reconcileSetlistOp(addQueuedBefore, server).drop, true, 'R7: add superseded by online change drops')
  assert(reconcileSetlistOp(addQueuedBefore, server).notice, true, 'R7: drop carries the removed notice')
  assert(reconcileSetlistOp(addQueuedAfter, server).drop, false, 'add with untouched server replays')
  assert(reconcileSetlistOp(addPresent, server).drop, true, 'add of a present song drops as no-op')
  assert(reconcileSetlistOp(addPresent, server).notice, undefined, 'no-op add needs no notice')
  assert(reconcileSetlistOp(removePresent, server).drop, false, 'remove of a present song replays')
  assert(reconcileSetlistOp(removeAbsent, server).drop, true, 'remove of an absent song drops silently')
  assert(reconcileSetlistOp(removeAbsent, server).notice, undefined, 'absent remove carries no notice')

  // 2.6/0037 tie-break mirror: on an EXACT timestamp tie the recorded op key
  // decides. Fixtures shared with scripts/smoke/0037-offline-tie-break.sql.
  // `updatedAt` is AFTER both ops' queuedAt — the shape production produces once
  // the winning device has written — so the tie can only be decided against the
  // recorded resolution. Where no resolution is recorded the legacy
  // setlist-level heuristic still applies.
  const tieAt = Date.parse('2026-10-13T10:00:00Z')
  const tieServer = {
    itemIds: [],
    updatedAt: new Date(tieAt + 5000).toISOString(),
    conflictResolutions: { m: { opKey: '30000000-0000-0000-0000-0000000007f1', queuedAt: new Date(tieAt).toISOString() } },
  }
  const tieOp = (/** @type {string} */ key) => ({ name: 'addSongToSetlist', args: ['u', 'sl', 'm'], queuedAt: tieAt, opKey: key })
  assert(reconcileSetlistOp(tieOp('30000000-0000-0000-0000-0000000007f2'), tieServer).drop, false, 'tie-break: greater key replays')
  assert(reconcileSetlistOp(tieOp('30000000-0000-0000-0000-0000000007f2'), tieServer).rule, 'op-key', 'tie-break: replay names the op-key rule')
  assert(reconcileSetlistOp(tieOp('30000000-0000-0000-0000-0000000007f0'), tieServer).drop, true, 'tie-break: lesser key is superseded')
  assert(reconcileSetlistOp(tieOp('30000000-0000-0000-0000-0000000007f1'), tieServer).drop, true, 'tie-break: equal key is superseded')
  // A legacy row with no key must not have its tie decided here: replay and let
  // the write path mint one, so the RPC arbitrates for real.
  const keylessOp = { name: 'addSongToSetlist', args: ['u', 'sl', 'm'], queuedAt: tieAt }
  assert(reconcileSetlistOp(keylessOp, tieServer).drop, false, 'tie-break: a keyless legacy op replays instead of dropping')
  assert(reconcileSetlistOp(tieOp('30000000-0000-0000-0000-0000000007f0'), { itemIds: [], updatedAt: new Date(tieAt).toISOString() }).drop, false, 'no recorded resolution: the legacy tie replays')

  console.log('setlistCollab demo OK: 32 asserts (visibility, share targets, transfer guard, feed labels, advisory locks, reconcile, tie-break)')
}
