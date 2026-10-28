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

// Tie-break fixtures — the op keys and the timestamp are IDENTICAL to
// scripts/smoke/0037-offline-tie-break.sql (op keys 30000…7f0/7f1/…7f2,
// timestamp 2026-10-13T10:00:00Z), the canonical arbiter's own fixture set: the
// SQL and this JS mirror must be the same rule, so both are pinned to the same
// literals. The PAIRS exercised differ — the smoke breaks a greater key on 7b3
// and a lesser one on 7b4, while these tests run greater, lesser and equal
// against one recorded winner — so this file is a superset, not a copy. Keep the
// literals in lockstep; drift here is drift between the arbiter and its mirror.
const TIE_AT = Date.parse('2026-10-13T10:00:00Z')
const OP_KEY_LOW = '30000000-0000-0000-0000-0000000007f0'
const OP_KEY_MID = '30000000-0000-0000-0000-0000000007f1'
const OP_KEY_HIGH = '30000000-0000-0000-0000-0000000007f2'
const TIE_SONG = '20000000-0000-0000-0000-0000000007b3'

// The recorded winner for TIE_SONG: OP_KEY_MID wrote at TIE_AT, so the server's
// `setlists.updated_at` is now NEWER than both ops' queuedAt — the shape
// production actually produces once one device has written. The tie is against
// the recorded write's own `queuedAt`, never against `updatedAt`; keying it on
// `updatedAt` would be unreachable in this shape and the arbiter would never see
// the op.
const TIE_SERVER = {
  itemIds: [],
  updatedAt: new Date(TIE_AT + 5000).toISOString(),
  conflictResolutions: {
    [TIE_SONG]: { opKey: OP_KEY_MID, queuedAt: new Date(TIE_AT).toISOString() },
  },
}

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
    // R7: the song was removed online after this op was queued. The reason is
    // now part of the outcome, so the drainer can word this as a real
    // supersession — the only one of the three that may blame a collaborator.
    expect(reconcileSetlistOp(op('addSongToSetlist', 'not-on-server', T - 1000), SERVER)).toEqual({
      drop: true,
      notice: true,
      reason: 'superseded',
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

  it('resolves an EQUAL timestamp by the recorded tie-break key, both directions', () => {
    // This INVERTS the assertion that pinned the bug here: an EQUAL timestamp
    // used to replay unconditionally, so both devices applied and drain order
    // picked the winner — the opposite of determinism.
    // features/offline-edit-conflict-policy.feature:47-51 requires a RECORDED
    // tie-break rule. TIE_SERVER carries the winning device's own resolution, so
    // these assertions exercise the shape the drain actually sees.
    // Greater key wins the tie → replay, rule 'op-key' (smoke T3).
    expect(
      reconcileSetlistOp(
        { name: 'addSongToSetlist', args: [OWNER, SETLIST, TIE_SONG], queuedAt: TIE_AT, opKey: OP_KEY_HIGH },
        TIE_SERVER,
      ),
    ).toEqual({ drop: false, rule: 'op-key' })
    // Lesser key loses the tie → superseded with the notice (smoke T4).
    expect(
      reconcileSetlistOp(
        { name: 'addSongToSetlist', args: [OWNER, SETLIST, TIE_SONG], queuedAt: TIE_AT, opKey: OP_KEY_LOW },
        TIE_SERVER,
      ),
    ).toEqual({ drop: true, notice: true, reason: 'superseded', rule: 'op-key' })
    // An EQUAL key also loses — the server keeps the first write.
    expect(
      reconcileSetlistOp(
        { name: 'addSongToSetlist', args: [OWNER, SETLIST, TIE_SONG], queuedAt: TIE_AT, opKey: OP_KEY_MID },
        TIE_SERVER,
      ),
    ).toEqual({ drop: true, notice: true, reason: 'superseded', rule: 'op-key' })
  })

  it('replays a keyless legacy op on an EQUAL timestamp, so the RPC can mint a key', () => {
    // A queue row from a build that predates the op key carries none. This
    // mirror must not decide that tie for it: the replay path mints a key and
    // the arbiter rules for real. Dropping it here would lose an edit the
    // arbiter might have applied — the lossy direction, and the one that cannot
    // be recovered.
    expect(
      reconcileSetlistOp(
        { name: 'addSongToSetlist', args: [OWNER, SETLIST, TIE_SONG], queuedAt: TIE_AT },
        TIE_SERVER,
      ),
    ).toEqual({ drop: false, rule: 'op-key' })
  })

  it('orders an add against the RECORDED write, not the setlist updatedAt', () => {
    // The arbiter's primary order, mirrored: an op queued after the recorded
    // write is applied even though the setlist's own updatedAt is newer still —
    // and one queued before it loses even with the greater key, because the key
    // only breaks an exact tie.
    expect(
      reconcileSetlistOp(
        { name: 'addSongToSetlist', args: [OWNER, SETLIST, TIE_SONG], queuedAt: TIE_AT + 1, opKey: OP_KEY_LOW },
        TIE_SERVER,
      ),
    ).toEqual({ drop: false, rule: 'later-timestamp' })
    expect(
      reconcileSetlistOp(
        { name: 'addSongToSetlist', args: [OWNER, SETLIST, TIE_SONG], queuedAt: TIE_AT - 1, opKey: OP_KEY_HIGH },
        TIE_SERVER,
      ),
    ).toEqual({ drop: true, notice: true, reason: 'superseded' })
  })

  it('replays an EQUAL timestamp when the song has NO recorded resolution', () => {
    // No recorded resolution for the song → the op is its first write, and with
    // nothing recorded there is no tie to break, so the legacy setlist-level
    // order stands: an exact tie there replays (the RPC's "not found" branch,
    // smoke T1).
    expect(
      reconcileSetlistOp(
        { name: 'addSongToSetlist', args: [OWNER, SETLIST, TIE_SONG], queuedAt: TIE_AT, opKey: OP_KEY_HIGH },
        { itemIds: [], updatedAt: new Date(TIE_AT).toISOString() },
      ),
    ).toEqual({ drop: false, rule: 'later-timestamp' })
  })

  it('drops an add with NO queuedAt as unknown-age, NOT as superseded', () => {
    // The assertion this replaces pinned `queuedAt || 0`, which made every
    // real server timestamp beat 0 and reported a lost-timestamp write as
    // "someone changed it before you". Unknown age is a different fact and now
    // carries its own reason, so the UI can say the client failed to replay it.
    expect(
      reconcileSetlistOp({ name: 'addSongToSetlist', args: [OWNER, SETLIST, 'not-on-server'] }, SERVER),
    ).toEqual({ drop: true, notice: true, reason: 'unknown-age' })
    // A queuedAt of 0 is a real timestamp, not a missing one: epoch is before
    // any server write, so the op is genuinely superseded and says so.
    expect(reconcileSetlistOp(op('addSongToSetlist', 'not-on-server', 0), SERVER)).toEqual({
      drop: true,
      notice: true,
      reason: 'superseded',
    })
  })

  it('replays an add when updatedAt is unparseable', () => {
    // FINDING: NaN > queuedAt is false, so a malformed server timestamp makes
    // the code optimistic and replays rather than dropping.
    expect(
      reconcileSetlistOp(op('addSongToSetlist', 'not-on-server', 1), { itemIds: [], updatedAt: 'garbage' }),
    ).toEqual({ drop: false })
  })

  it('DROPS a short-args add as malformed, and says which failure it was', () => {
    // The song id is read positionally as op.args[2]. A short arg list yields
    // undefined, which used to be "not present" and therefore took the
    // superseded branch — the user's add discarded, blamed on a collaborator.
    // It is now its own reason, distinct from unknown-age because the two need
    // different triage.
    expect(reconcileSetlistOp({ name: 'addSongToSetlist', args: [OWNER, SETLIST] }, SERVER)).toEqual({
      drop: true,
      notice: true,
      reason: 'malformed',
    })
    expect(reconcileSetlistOp({ name: 'addSongToSetlist' }, SERVER)).toEqual({
      drop: true,
      notice: true,
      reason: 'malformed',
    })
    // A short-args remove is equally unidentifiable, and was equally silent.
    expect(reconcileSetlistOp({ name: 'removeSongFromSetlist', args: [OWNER, SETLIST] }, SERVER)).toEqual({
      drop: true,
      notice: true,
      reason: 'malformed',
    })
  })

  it('replays a healthy add and a healthy remove', () => {
    // Neither shape had any scenario in offline-edit-conflict-policy.feature —
    // its ten all cover field-level chord edits, which is how the silent drop
    // survived. Pinned here so the success path is asserted, not assumed.
    const after = T + 10 ** 7
    expect(reconcileSetlistOp(op('addSongToSetlist', 'not-on-server', after), SERVER)).toEqual({ drop: false })
    expect(reconcileSetlistOp(op('removeSongFromSetlist', ITEM_SONG, after), SERVER)).toEqual({ drop: false })
  })

  it('still drops a genuine supersession as superseded', () => {
    // The fix must not weaken the path it sits next to: a real later server
    // write on the same field still loses, and still asks for the R7 notice.
    const older = { itemIds: [], updatedAt: new Date(T + 10 ** 6).toISOString() }
    expect(reconcileSetlistOp(op('addSongToSetlist', 'not-on-server', T), older)).toEqual({
      drop: true,
      notice: true,
      reason: 'superseded',
    })
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
      reason: 'superseded',
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
