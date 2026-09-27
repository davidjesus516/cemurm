// Characterization tests — locks current behaviour before the PR 1b boundary refactor.
// Specified by: features/offline-edit-conflict-policy.feature
// PR 1b will split this module. These tests must pass with ZERO edits.

import { describe, it, expect } from 'vitest'

import { isLockStale, reconcileSetlistOp, LOCK_TTL_MS } from './collab.js'

// ── fixtures ────────────────────────────────────────────────────────────────
// The three seed identities (supabase/seed.sql) and the two Demo Setlist items.
const OWNER = '10000000-0000-0000-0000-000000000001'
const SETLIST = '30000000-0000-0000-0000-000000000001'
const ITEM_SONG = '20000000-0000-0000-0000-000000000001'
const ITEM_SONG_2 = '20000000-0000-0000-0000-000000000002'

/** A queued op as the offline write queue stores it: { name, args, queuedAt }. */
function op(name, songId, queuedAt) {
  return { name, args: [OWNER, SETLIST, songId], queuedAt }
}

// A fixed clock so every assertion below is deterministic.
const T = 2_000_000_000_000
const SERVER = { itemIds: [ITEM_SONG, ITEM_SONG_2], updatedAt: new Date(T).toISOString() }

// ── LOCK_TTL_MS ──────────────────────────────────────────────────────────────

describe('LOCK_TTL_MS', () => {
  it('is 30 seconds', () => {
    expect(LOCK_TTL_MS).toBe(30000)
  })
})

// ── isLockStale ──────────────────────────────────────────────────────────────

describe('isLockStale', () => {
  it('treats every falsy lock as stale', () => {
    // FINDING: the guard is `!lock`, so 0, '' and false are "no lock" too.
    expect(isLockStale(null, T)).toBe(true)
    expect(isLockStale(undefined, T)).toBe(true)
    expect(isLockStale(false, T)).toBe(true)
    expect(isLockStale(0, T)).toBe(true)
    expect(isLockStale('', T)).toBe(true)
  })

  it('treats a lock with no usable ts as stale', () => {
    // `lock.ts || 0` collapses a missing / null / undefined / 0 ts to epoch.
    expect(isLockStale({}, T)).toBe(true)
    expect(isLockStale({ ts: null }, T)).toBe(true)
    expect(isLockStale({ ts: undefined }, T)).toBe(true)
    expect(isLockStale({ ts: 0 }, T)).toBe(true)
    expect(isLockStale({ userId: OWNER, actor: 'Juan', ts: 0 }, T)).toBe(true)
  })

  it('is false for a lock at or inside the TTL window', () => {
    expect(isLockStale({ ts: T }, T)).toBe(false)
    expect(isLockStale({ ts: T - LOCK_TTL_MS }, T)).toBe(false)
    expect(isLockStale({ ts: T - LOCK_TTL_MS + 1 }, T)).toBe(false)
  })

  it('becomes stale exactly one millisecond past the TTL', () => {
    // The comparison is strict `>`, so the boundary instant itself is NOT stale.
    expect(isLockStale({ ts: T - LOCK_TTL_MS - 1 }, T)).toBe(true)
    expect(isLockStale({ ts: T - LOCK_TTL_MS }, T)).toBe(false)
  })

  it('is never stale for a future ts (clock skew holds the lock open)', () => {
    expect(isLockStale({ ts: T + 60_000 }, T)).toBe(false)
    expect(isLockStale({ ts: T + LOCK_TTL_MS * 10 }, T)).toBe(false)
  })

  it('coerces a string ts through the subtraction', () => {
    expect(isLockStale({ ts: String(T) }, T)).toBe(false)
    expect(isLockStale({ ts: String(T - LOCK_TTL_MS - 1) }, T)).toBe(true)
  })

  it('does not mutate the lock', () => {
    const lock = { userId: OWNER, actor: 'Juan', ts: T - LOCK_TTL_MS - 1 }
    const before = { ...lock }
    isLockStale(lock, T)
    expect(lock).toEqual(before)
  })

  it('defaults `now` to Date.now(), and a just-created lock reads fresh', () => {
    // Only a fresh lock is asserted here — the TTL boundary itself is covered
    // above with an explicit clock, so this cannot drift into flakiness.
    expect(isLockStale({ ts: Date.now() })).toBe(false)
    expect(isLockStale(null)).toBe(true)
    expect(isLockStale({ ts: Date.now() - LOCK_TTL_MS - 1000 })).toBe(true)
  })
})

// ── reconcileSetlistOp — addSongToSetlist ────────────────────────────────────

describe('reconcileSetlistOp — addSongToSetlist', () => {
  it('drops a no-op add of a song the server already has, with no notice', () => {
    expect(reconcileSetlistOp(op('addSongToSetlist', ITEM_SONG, T - 1000), SERVER)).toEqual({ drop: true })
    expect(reconcileSetlistOp(op('addSongToSetlist', ITEM_SONG, 0), SERVER).notice).toBeUndefined()
  })

  it('drops an add the server superseded, and asks for the removal notice', () => {
    // R7: the song was removed online after this op was queued.
    expect(reconcileSetlistOp(op('addSongToSetlist', 'not-on-server', T - 1000), SERVER)).toEqual({
      drop: true,
      notice: true,
    })
  })

  it('replays an add when the server has not moved since it was queued', () => {
    expect(reconcileSetlistOp(op('addSongToSetlist', 'not-on-server', T + 1), SERVER)).toEqual({ drop: false })
  })

  it('replays an add when there is no server read to compare against', () => {
    expect(reconcileSetlistOp(op('addSongToSetlist', 'not-on-server', 1), undefined)).toEqual({ drop: false })
    expect(reconcileSetlistOp(op('addSongToSetlist', 'not-on-server', 1), {})).toEqual({ drop: false })
    expect(reconcileSetlistOp(op('addSongToSetlist', 'not-on-server', 1), { itemIds: [], updatedAt: null })).toEqual({
      drop: false,
    })
  })

  it('replays an add on an EQUAL timestamp, not on a strictly-newer one', () => {
    // FINDING: features/offline-edit-conflict-policy.feature says "Equal
    // timestamps use the recorded tie-break rule … stored with the resolution
    // so every device reaches the same result". The code has no tie-break: the
    // test is `>`, so equality reads as "server not newer" and my write replays.
    expect(reconcileSetlistOp(op('addSongToSetlist', 'not-on-server', T), SERVER)).toEqual({ drop: false })
  })

  it('drops an add with NO queuedAt, because 0 makes every server look newer', () => {
    // FINDING: `queuedAt || 0` means a queue row that lost its timestamp is
    // always treated as superseded, so the write is discarded with a notice.
    expect(reconcileSetlistOp({ name: 'addSongToSetlist', args: [OWNER, SETLIST, 'not-on-server'] }, SERVER)).toEqual({
      drop: true,
      notice: true,
    })
    expect(reconcileSetlistOp(op('addSongToSetlist', 'not-on-server', 0), SERVER)).toEqual({ drop: true, notice: true })
  })

  it('replays an add when updatedAt is unparseable', () => {
    // FINDING: NaN > queuedAt is false, so a malformed server timestamp makes
    // the code optimistic and replays rather than dropping.
    expect(
      reconcileSetlistOp(op('addSongToSetlist', 'not-on-server', 1), { itemIds: [], updatedAt: 'garbage' }),
    ).toEqual({ drop: false })
  })

  it('DROPS WITH A NOTICE an add whose args are too short to carry a songId', () => {
    // FINDING: the song id is read positionally as op.args[2]. A short arg list
    // yields undefined, which is never "present", so the op takes the
    // superseded branch and the user's add is silently discarded.
    expect(reconcileSetlistOp({ name: 'addSongToSetlist', args: [OWNER, SETLIST] }, SERVER)).toEqual({
      drop: true,
      notice: true,
    })
    expect(reconcileSetlistOp({ name: 'addSongToSetlist' }, SERVER)).toEqual({ drop: true, notice: true })
  })
})

// ── reconcileSetlistOp — removeSongFromSetlist ────────────────────────────────

describe('reconcileSetlistOp — removeSongFromSetlist', () => {
  it('replays a remove of a song the server still has', () => {
    expect(reconcileSetlistOp(op('removeSongFromSetlist', ITEM_SONG, 0), SERVER)).toEqual({ drop: false })
  })

  it('drops a remove of a song that is already gone, silently', () => {
    expect(reconcileSetlistOp(op('removeSongFromSetlist', 'not-on-server', 0), SERVER)).toEqual({ drop: true })
    expect(reconcileSetlistOp(op('removeSongFromSetlist', 'not-on-server', 0), SERVER).notice).toBeUndefined()
  })

  it('never emits a `notice` key, whatever the server timestamp', () => {
    // FINDING: the remove branch returns the bare literal `{ drop }`, so a
    // removal superseded by an online change is dropped with no user message.
    expect(Object.keys(reconcileSetlistOp(op('removeSongFromSetlist', ITEM_SONG, 0), SERVER))).toEqual(['drop'])
    expect(Object.keys(reconcileSetlistOp(op('removeSongFromSetlist', 'x', 0), SERVER))).toEqual(['drop'])
  })

  it('ignores updatedAt entirely for removes', () => {
    const newer = { itemIds: [ITEM_SONG], updatedAt: new Date(T + 10 ** 7).toISOString() }
    expect(reconcileSetlistOp(op('removeSongFromSetlist', ITEM_SONG, 0), newer)).toEqual({ drop: false })
  })
})

// ── reconcileSetlistOp — everything else ─────────────────────────────────────

describe('reconcileSetlistOp — unreconciled ops', () => {
  it('replays any op it does not recognise, unconditionally', () => {
    // FINDING: reorder / version writes are never reconciled (D7 keeps reorder
    // online-only once a setlist is shared), so they always hit the server.
    expect(reconcileSetlistOp(op('reorderSetlistItems', 'x', 0), SERVER)).toEqual({ drop: false })
    expect(reconcileSetlistOp(op('updateSongVersion', 'x', 0), SERVER)).toEqual({ drop: false })
    expect(reconcileSetlistOp(op('changeSetlistItemKey', 'x', 0), SERVER)).toEqual({ drop: false })
  })

  it('replays an op with no name at all', () => {
    expect(reconcileSetlistOp({ args: [OWNER, SETLIST, 'x'] }, SERVER)).toEqual({ drop: false })
    expect(reconcileSetlistOp({}, SERVER)).toEqual({ drop: false })
  })

  it('emits only a `drop` key for a replay — never a notice', () => {
    expect(Object.keys(reconcileSetlistOp({}, SERVER))).toEqual(['drop'])
  })
})

// ── reconcileSetlistOp — server shape ────────────────────────────────────────

describe('reconcileSetlistOp — server read shape', () => {
  it('reads the flattened setlist { itemIds, updatedAt }', () => {
    // `server.updatedAt` is the flattened setlist's own updated_at column, so a
    // same-value write does not read as "server newer".
    const op1 = op('addSongToSetlist', 'new-song', T)
    expect(reconcileSetlistOp(op1, { itemIds: [ITEM_SONG], updatedAt: new Date(T - 1).toISOString() })).toEqual({
      drop: false,
    })
    expect(reconcileSetlistOp(op1, { itemIds: [ITEM_SONG], updatedAt: new Date(T + 1).toISOString() })).toEqual({
      drop: true,
      notice: true,
    })
  })

  it('treats a missing / null itemIds as an empty setlist', () => {
    expect(reconcileSetlistOp(op('removeSongFromSetlist', ITEM_SONG, 0), { itemIds: null })).toEqual({ drop: true })
    expect(reconcileSetlistOp(op('removeSongFromSetlist', ITEM_SONG, 0), {})).toEqual({ drop: true })
  })

  it('never mutates the op or the server read', () => {
    const queued = op('addSongToSetlist', ITEM_SONG, T)
    const server = { itemIds: [ITEM_SONG], updatedAt: new Date(T).toISOString() }
    const opBefore = JSON.stringify(queued)
    const serverBefore = JSON.stringify(server)
    reconcileSetlistOp(queued, server)
    expect(JSON.stringify(queued)).toBe(opBefore)
    expect(JSON.stringify(server)).toBe(serverBefore)
  })

  it('replays rather than throwing when the op is null or undefined', () => {
    // The assertion this replaces was named "throws a TypeError on a null/
    // undefined op" and asserted the throw. A crash is not a useful contract
    // for a caller holding no operation — and this one is not theoretical: a
    // malformed queue row takes down the whole drain loop, not just its own
    // entry. `op.args?.` guarded a missing `args` all along, which is what made
    // the asymmetry look deliberate.
    expect(reconcileSetlistOp(null, SERVER)).toEqual({ drop: false })
    expect(reconcileSetlistOp(undefined, SERVER)).toEqual({ drop: false })
    expect(reconcileSetlistOp(null, null)).toEqual({ drop: false })
    // An object with no args at all still travels the normal path.
    expect(reconcileSetlistOp({}, SERVER)).toEqual({ drop: false })
  })
})
