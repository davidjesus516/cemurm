// Pure guards + activity labels + lock/reconcile rules for shared-setlist
// collaboration (Hito 3 PR#2a tasks 2.1/2.3 and PR#2b tasks 2.5/2.6). Zero
// imports, so this module is bare-node safe and the demo runs under node
// directly (setlists.js is not: it statically imports songs.js → supabase.js,
// which evaluates import.meta.env at module scope — undefined in bare node).
// The network ops that wrap these guards live in setlists.js; the realtime /
// broadcast / lock helpers, feed panel, and drain loop are the 2.3–2.6
// surfaces.

/**
 * Visibility values the spec allows: 'private' | 'shared' | 'public'
 * ('org'/'branch' are reserved for Hito 4). Returns an error message or
 * null when valid.
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
export function guardTransfer(collaborators, candidateId) {
  const row = (collaborators || []).find((c) => (c.user_id || c.userId) === candidateId)
  if (!row) return 'Only an accepted collaborator can take ownership.'
  if (!row.accepted_at) return 'The new owner must accept the invitation first.'
  return null
}

const ACTIVITY_LABELS = {
  share: (actor) => `${actor} shared with the band`,
  'reorder': (actor) => `${actor} reordered the setlist`,
  'transfer-ownership': (actor) => `Ownership transferred to ${actor}`,
}

/**
 * Feed row {actor, action, ts} → "who did what" line (S11/S12). Unknown
 * actions degrade gracefully to "actor action".
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
export function isLockStale(lock, now = Date.now()) {
  return !lock || now - (lock.ts || 0) > LOCK_TTL_MS
}

/**
 * Next lock record ({ [songId]: {userId, actor, ts} }) from a broadcast
 * payload. Releases only remove the holder's own lock (or a stale one) — a
 * late unlock from a previous holder must not clear the current holder's
 * lock. Acquisitions never steal an ACTIVE foreign lock.
 */
export function applyLock(locks, payload) {
  const next = { ...(locks || {}) }
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
//  · add: song already present → the op would no-op → drop. Absent AND the
//    server changed since the op was queued → an online write superseded it →
//    drop + notice (R7: "removed before your sync"). Absent AND server
//    untouched → my add is the newest write → replay (R6 merge).
//  · remove: already absent → outcome achieved → drop silently. Still
//    present → replay (removal is by song_id, position-independent; unrelated
//    online adds merge).
// Reorder/version ops are not reconciled: reorder replays against stale
// indices (D7 keeps it online-only once a setlist is shared) and a version
// write targets one item, so neither has a merge to preserve.

/**
 * Decide replay vs drop for one queued op. Returns { drop, notice? }.
 * notice: true means the caller must surface the "removed before your sync"
 * message (the actor name is unknowable — postgres_changes carries none, D5).
 */
export function reconcileSetlistOp(op, server) {
  const songId = op.args?.[2]
  const queuedAt = op.queuedAt || 0
  const present = (server?.itemIds || []).includes(songId)
  const serverNewer = !!server?.updatedAt && new Date(server.updatedAt).getTime() > queuedAt
  if (op.name === 'addSongToSetlist') {
    if (present) return { drop: true }
    if (serverNewer) return { drop: true, notice: true }
    return { drop: false }
  }
  if (op.name === 'removeSongFromSetlist') {
    return { drop: !present }
  }
  return { drop: false }
}

// Self-check: node -e "import('./src/lib/setlistCollab.js').then(m => m.demo())"
export function demo() {
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

  console.log('setlistCollab demo OK: 26 asserts (visibility, share targets, transfer guard, feed labels, advisory locks, reconcile)')
}
