// Supabase data layer for setlists.
// Replaces the localStorage mock with hosted Supabase queries.
// Duration is computed on read (join with the songs store), never stored —
// keeps the store lazy and avoids stale totals when a song's duration changes.
// Reads are read-through cached in IndexedDB (offlineCache.js); writes
// invalidate the affected keys on success.

import { supabase } from './supabase.js'
import { listSongs } from './songs.js'
import { formatDuration } from './duration.js'
import { offlineGet, offlineSet, offlineRemove } from './offlineCache.js'
import { enqueueOp } from './offlineQueue.js'
import { guardVisibility, shareTargets, guardTransfer } from './setlistCollab.js'

// ponytail: known user-facing errors re-thrown as-is; network/PostgREST
// errors map to a safe generic message.
const USER_ERRORS = new Set([
  'Setlist not found.',
  'Setlist name is required.',
  'Visibility must be private, shared, or public.',
  'Only an accepted collaborator can take ownership.',
  'The new owner must accept the invitation first.',
  'Reordering a shared setlist requires an internet connection.',
])

function handleError(error) {
  if (USER_ERRORS.has(error?.message)) throw error
  throw new Error('Something went wrong. Please try again.')
}

async function withErrorMapping(fn) {
  try { return await fn() } catch (e) { handleError(e) }
}

// ponytail: best-effort connectivity heuristic — PostgREST network errors
// surface as fetch failures without a stable code; refine if a code appears.
function isConnectivityError(e) {
  const msg = String(e?.message || '')
  return typeof navigator !== 'undefined' && navigator.onLine === false
    || msg.includes('Failed to fetch')
    || msg.includes('fetch failed')
    || e?.code === '-1'
}

// ponytail: no freshness TTL — cache is overwritten on every successful
// network read, and served unconditionally when offline; staleness
// self-heals on the next successful fetch. Add a TTL only if a
// stale-then-offline read becomes a problem.
async function withReadThrough(key, fn) {
  try {
    const data = await fn()
    await offlineSet(key, data)
    return data
  } catch (e) {
    if (USER_ERRORS.has(e?.message)) throw e
    const cached = await offlineGet(key)
    if (cached?.data) return cached.data
    throw e
  }
}

function invalidateSetlists(userId, ids) {
  offlineRemove(`setlists:${userId}`)
  for (const id of ids) offlineRemove(`setlist:${userId}:${id}`)
}

/**
 * Flatten a raw Supabase setlist row (with embedded setlist_items) into the
 * shape the rest of the app expects: itemIds ordered by position, plus
 * versionIds { songId: versionId } for the 3.5 per-item picker (absent key =
 * picker default), and the collaboration surface (2.1): visibility, whether
 * the reader owns the setlist, whether they can edit it, and the collaborator
 * roster. Collaborator rows are RLS-capped per reader (0002 select_owner /
 * select_self): the owner sees every row, a collaborator only their own —
 * enough to derive `canEdit` without leaking the roster to members.
 */
function flattenSetlist(row, userId) {
  const items = (row.setlist_items || [])
    .sort((a, b) => a.position - b.position)
  const itemIds = items.map((i) => i.song_id)

  const versionIds = {}
  for (const item of items) {
    if (item.version_id) versionIds[item.song_id] = item.version_id
  }

  const collaborators = (row.setlist_collaborators || []).map((c) => ({
    userId: c.user_id,
    canEdit: c.can_edit,
    acceptedAt: c.accepted_at,
  }))
  const mine = collaborators.find((c) => c.userId === userId)
  const isOwner = row.owner_id === userId

  return {
    id: row.id,
    userId: row.owner_id,
    name: row.name,
    visibility: row.visibility,
    itemIds,
    versionIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOwner,
    canEdit: isOwner || mine?.canEdit === true,
    collaborators,
  }
}

/**
 * Fetch one setlist row with nested setlist_items and setlist_collaborators.
 * Member read (0002 setlists_select_member — owner or accepted collaborator;
 * the old owner_id filter would 403 collaborators on shared setlists).
 * Throws 'Setlist not found.' when missing.
 */
async function fetchSetlistById(userId, id) {
  const { data, error } = await supabase
    .from('setlists')
    .select('*, setlist_items(song_id, position, version_id), setlist_collaborators(user_id, can_edit, accepted_at)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Setlist not found.')
  return flattenSetlist(data, userId)
}

/**
 * Cached setlist for offline work, falling back to a network read. The
 * connectivity catch paths below use this so they can still validate against
 * a roster/visibility they already know.
 */
async function readBaseSetlist(userId, id) {
  const cached = await offlineGet(`setlist:${userId}:${id}`)
  if (cached?.data) return cached.data
  try {
    return await fetchSetlistById(userId, id)
  } catch {
    return null
  }
}

/**
 * Build the optimistic post-write setlist for an offline-queued mutation:
 * the currently cached/fetched setlist with the mutation applied, flagged
 * pendingSync, and written back to the read-through cache so an offline
 * reload shows the pending version. Validation already ran before the
 * connectivity catch fired, so falling back to a minimal stub is safe.
 */
async function buildOptimisticSetlist(userId, id, { name, mutateItemIds, mutateVersions }) {
  const base = await readBaseSetlist(userId, id)

  const fallback = {
    id,
    userId,
    name: name ?? 'Setlist',
    itemIds: [],
    versionIds: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const current = base ?? fallback
  const optimistic = {
    ...current,
    name: name !== undefined ? name : current.name,
    itemIds: mutateItemIds(current.itemIds),
    versionIds: mutateVersions
      ? mutateVersions(current.versionIds || {})
      : (current.versionIds || {}),
    updatedAt: new Date().toISOString(),
    pendingSync: true,
  }
  await offlineSet(`setlist:${userId}:${id}`, optimistic)
  return optimistic
}

/**
 * Optimistic setlist for an offline-queued COLLABORATION op (2.6, R5/R6):
 * the queued 2.1 mutations (visibility, share, permission, removal, transfer)
 * have no server-assigned id to wait for, so the cached setlist plus `patch`
 * is the whole optimistic state. `patch` is a field object or a function of
 * the base (roster edits need the current array). Persisted like item ops so
 * an offline reload shows the pending roster.
 */
async function buildOptimisticCollab(userId, id, patch) {
  const base = await readBaseSetlist(userId, id)
  const fallback = {
    id,
    userId,
    name: 'Setlist',
    visibility: 'private',
    itemIds: [],
    versionIds: {},
    createdAt: new Date().toISOString(),
    isOwner: true,
    canEdit: true,
    collaborators: [],
  }
  const current = base ?? fallback
  const optimistic = {
    ...current,
    ...(typeof patch === 'function' ? patch(current) : patch),
    updatedAt: new Date().toISOString(),
    pendingSync: true,
  }
  await offlineSet(`setlist:${userId}:${id}`, optimistic)
  return optimistic
}

/**
 * Fresh server read for the 2.6 drain-time reconcile (offlineSync.js). The
 * cached getSetlist path would serve the CACHE after a failed read, and a
 * stale copy is exactly what must not decide whether to drop a queued op.
 */
export function fetchServerSetlist(userId, id) {
  return withErrorMapping(() => fetchSetlistById(userId, id))
}

export function listSetlists(userId) {
  return withErrorMapping(() =>
    withReadThrough(`setlists:${userId}`, async () => {
      // Member read: shared setlists appear in the list for accepted
      // collaborators (0002 select_member); no owner_id filter.
      const { data, error } = await supabase
        .from('setlists')
        .select('*, setlist_items(song_id, position, version_id), setlist_collaborators(user_id, can_edit, accepted_at)')
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []).map((row) => flattenSetlist(row, userId))
    }))
}

export function getSetlist(userId, id) {
  return withErrorMapping(() =>
    withReadThrough(`setlist:${userId}:${id}`, () => fetchSetlistById(userId, id)))
}

export async function createSetlist(userId, { name }) {
  return withErrorMapping(async () => {
    const trimmed = name?.trim()
    if (!trimmed) throw new Error('Setlist name is required.')

    try {
      const { data, error } = await supabase
        .from('setlists')
        .insert({ owner_id: userId, name: trimmed })
        .select('*, setlist_items(song_id, position, version_id)')
        .single()
      if (error) throw error

      const setlist = flattenSetlist(data, userId)
      // New setlist changes the list; its own entry was just fetched fresh.
      invalidateSetlists(userId, [])
      return setlist
    } catch (e) {
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'createSetlist', args: [userId, { name: trimmed }] })
      const optimistic = {
        id: `local-${Date.now()}`,
        userId,
        name: trimmed,
        itemIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pendingSync: true,
      }
      await offlineSet(`setlist:${userId}:${optimistic.id}`, optimistic)
      return optimistic
    }
  })
}

export async function updateSetlist(userId, id, { name }) {
  return withErrorMapping(async () => {
    try {
      await fetchSetlistById(userId, id)

      if (name !== undefined) {
        const trimmed = name.trim()
        if (!trimmed) throw new Error('Setlist name is required.')

        const { error } = await supabase
          .from('setlists')
          .update({ name: trimmed, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('owner_id', userId)
        if (error) throw error
      }

      const setlist = await fetchSetlistById(userId, id)
      invalidateSetlists(userId, [id])
      return setlist
    } catch (e) {
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'updateSetlist', args: [userId, id, { name }] })
      return buildOptimisticSetlist(userId, id, {
        name: name !== undefined ? name.trim() : undefined,
        mutateItemIds: (itemIds) => itemIds,
      })
    }
  })
}

export async function deleteSetlist(userId, id) {
  return withErrorMapping(async () => {
    await fetchSetlistById(userId, id)

    const { error } = await supabase
      .from('setlists')
      .delete()
      .eq('id', id)
      .eq('owner_id', userId)
    if (error) throw error

    invalidateSetlists(userId, [id])
  })
}

/**
 * Copy a setlist under a new name. Same itemIds, same order.
 * Original is untouched (new id, new timestamps).
 */
export async function duplicateSetlist(userId, id, { name }) {
  return withErrorMapping(async () => {
    const trimmed = name?.trim()
    if (!trimmed) throw new Error('Setlist name is required.')

    const source = await fetchSetlistById(userId, id)

    // 1. Create new setlist
    const { data: copyRow, error: createErr } = await supabase
      .from('setlists')
      .insert({ owner_id: userId, name: trimmed })
      .select()
      .single()
    if (createErr) throw createErr

    // 2. Copy items
    if (source.itemIds.length > 0) {
      const items = source.itemIds.map((songId, i) => ({
        setlist_id: copyRow.id,
        song_id: songId,
        position: i,
      }))
      const { error: itemsErr } = await supabase
        .from('setlist_items')
        .insert(items)
      if (itemsErr) throw itemsErr
    }

    const setlist = await fetchSetlistById(userId, copyRow.id)
    invalidateSetlists(userId, [copyRow.id])
    return setlist
  })
}

export async function addSongToSetlist(userId, setlistId, songId) {
  return withErrorMapping(async () => {
    try {
      await fetchSetlistById(userId, setlistId)

      // Idempotent: no-op if song already in setlist
      const { data: existing } = await supabase
        .from('setlist_items')
        .select('id')
        .eq('setlist_id', setlistId)
        .eq('song_id', songId)
        .maybeSingle()
      if (existing) return fetchSetlistById(userId, setlistId)

      // Next position = max + 1
      const { data: maxRow } = await supabase
        .from('setlist_items')
        .select('position')
        .eq('setlist_id', setlistId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()
      const nextPosition = (maxRow?.position ?? -1) + 1

      const { error } = await supabase
        .from('setlist_items')
        .insert({ setlist_id: setlistId, song_id: songId, position: nextPosition })
      if (error) throw error

      const setlist = await fetchSetlistById(userId, setlistId)
      invalidateSetlists(userId, [setlistId])
      return setlist
    } catch (e) {
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'addSongToSetlist', args: [userId, setlistId, songId] })
      return buildOptimisticSetlist(userId, setlistId, {
        mutateItemIds: (itemIds) => (itemIds.includes(songId) ? itemIds : [...itemIds, songId]),
      })
    }
  })
}

/**
 * 3.5: choose the version for a setlist item (version scenarios: record the
 * chosen version, label visible to bandmates). null reverts to the picker
 * default. Mirrors addSongToSetlist: online update + refetch; offline
 * enqueueOp (WRITE_OPS, replay-safe — upsert by setlist+song) + optimistic
 * versionIds update in the read-through cache.
 */
export async function setSongVersion(userId, setlistId, songId, versionId) {
  return withErrorMapping(async () => {
    try {
      await fetchSetlistById(userId, setlistId)

      const { error } = await supabase
        .from('setlist_items')
        .update({ version_id: versionId || null })
        .eq('setlist_id', setlistId)
        .eq('song_id', songId)
      if (error) throw error

      const setlist = await fetchSetlistById(userId, setlistId)
      invalidateSetlists(userId, [setlistId])
      return setlist
    } catch (e) {
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'setSongVersion', args: [userId, setlistId, songId, versionId] })
      return buildOptimisticSetlist(userId, setlistId, {
        mutateItemIds: (itemIds) => itemIds,
        mutateVersions: (versionIds) => ({ ...versionIds, [songId]: versionId || undefined }),
      })
    }
  })
}

export async function removeSongFromSetlist(userId, setlistId, songId) {
  return withErrorMapping(async () => {
    try {
      await fetchSetlistById(userId, setlistId)

      const { error } = await supabase
        .from('setlist_items')
        .delete()
        .eq('setlist_id', setlistId)
        .eq('song_id', songId)
      if (error) throw error

      const setlist = await fetchSetlistById(userId, setlistId)
      invalidateSetlists(userId, [setlistId])
      return setlist
    } catch (e) {
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'removeSongFromSetlist', args: [userId, setlistId, songId] })
      return buildOptimisticSetlist(userId, setlistId, {
        mutateItemIds: (itemIds) => itemIds.filter((id) => id !== songId),
      })
    }
  })
}

/**
 * Move a song from one index to another (splice-out + insert).
 * Indices are clamped into range; out-of-range moves are no-ops.
 */
export async function moveSongInSetlist(userId, setlistId, fromIndex, toIndex) {
  return withErrorMapping(async () => {
    try {
      const setlist = await fetchSetlistById(userId, setlistId)
      const len = setlist.itemIds.length
      if (len <= 1) return setlist

      const from = Math.max(0, Math.min(fromIndex, len - 1))
      const to = Math.max(0, Math.min(toIndex, len - 1))
      if (from === to) return setlist

      const reordered = [...setlist.itemIds]
      const [moved] = reordered.splice(from, 1)
      reordered.splice(to, 0, moved)

      // Bump all to temporary positions first, then set finals.
      // ponytail: sequential updates, no transaction — the two-phase bump
      // avoids UNIQUE(setlist_id, position) collisions; add a Postgres RPC
      // when contention matters.
      for (let i = 0; i < reordered.length; i++) {
        const { error } = await supabase
          .from('setlist_items')
          .update({ position: 10000 + i })
          .eq('setlist_id', setlistId)
          .eq('song_id', reordered[i])
        if (error) throw error
      }
      for (let i = 0; i < reordered.length; i++) {
        const { error } = await supabase
          .from('setlist_items')
          .update({ position: i })
          .eq('setlist_id', setlistId)
          .eq('song_id', reordered[i])
        if (error) throw error
      }

      const freshSetlist = await fetchSetlistById(userId, setlistId)
      invalidateSetlists(userId, [setlistId])
      return freshSetlist
    } catch (e) {
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      // D7 (task constraint): a reorder replays against STALE indices, so it is
      // online-only once a setlist is shared — queuing it would silently
      // corrupt the order (the S8 merge policy defers to change 3). Queue only
      // when private visibility is PROVEN by the fresh read or the cache.
      const base = await readBaseSetlist(userId, setlistId)
      if (base?.visibility !== 'private') {
        throw new Error('Reordering a shared setlist requires an internet connection.')
      }
      await enqueueOp(userId, { name: 'moveSongInSetlist', args: [userId, setlistId, fromIndex, toIndex] })
      return buildOptimisticSetlist(userId, setlistId, {
        // Same clamp + splice semantics as the online path above.
        mutateItemIds: (itemIds) => {
          if (itemIds.length <= 1) return itemIds
          const from = Math.max(0, Math.min(fromIndex, itemIds.length - 1))
          const to = Math.max(0, Math.min(toIndex, itemIds.length - 1))
          if (from === to) return itemIds
          const reordered = [...itemIds]
          const [movedSong] = reordered.splice(from, 1)
          reordered.splice(to, 0, movedSong)
          return reordered
        },
      })
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.1 — shared-setlist collaboration ops (setlists R1/R8/R9/R10). All are
// owner-only surfaces enforced by 0002 owner-management RLS policies
// (setlist_collaborators insert/update/delete via private.session_owns_setlist,
// setlists UPDATE owner branch); the client guards in setlistCollab.js add
// friendlier errors before hitting the server.
// 2.6 (R5/R6): each op also queues on a connectivity failure and returns the
// optimistic setlist, so a bandmate edit made offline survives to the next
// drain. Enqueued args are already-validated values (e.g. share targets are
// filtered), which is what makes the replay idempotent — the op re-runs its
// own guards against the server roster at drain time.

export async function setVisibility(userId, id, visibility) {
  return withErrorMapping(async () => {
    const guard = guardVisibility(visibility)
    if (guard) throw new Error(guard)

    try {
      const { error } = await supabase
        .from('setlists')
        .update({ visibility })
        .eq('id', id)
        .eq('owner_id', userId)
      if (error) throw error

      const setlist = await fetchSetlistById(userId, id)
      invalidateSetlists(userId, [id])
      return setlist
    } catch (e) {
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'setVisibility', args: [userId, id, visibility] })
      return buildOptimisticCollab(userId, id, { visibility })
    }
  })
}

/** Invite bandmates onto the setlist (INSERT rows; can_edit defaults true). */
export async function shareWithBandmates(userId, id, bandmateIds) {
  return withErrorMapping(async () => {
    try {
      const setlist = await fetchSetlistById(userId, id)
      const targets = shareTargets(userId, bandmateIds, setlist.collaborators)
      if (targets.length === 0) return setlist

      const { error } = await supabase
        .from('setlist_collaborators')
        .insert(targets.map((targetId) => ({ setlist_id: id, user_id: targetId })))
      if (error) throw error

      const fresh = await fetchSetlistById(userId, id)
      invalidateSetlists(userId, [id])
      return fresh
    } catch (e) {
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      const base = await readBaseSetlist(userId, id)
      const targets = shareTargets(userId, bandmateIds, base?.collaborators)
      if (targets.length === 0) return base
      await enqueueOp(userId, { name: 'shareWithBandmates', args: [userId, id, targets] })
      return buildOptimisticCollab(userId, id, (current) => ({
        collaborators: [
          ...(current.collaborators || []),
          ...targets.map((targetId) => ({ userId: targetId, canEdit: true, acceptedAt: null })),
        ],
      }))
    }
  })
}

/** Owner flips a collaborator's can_edit (view-only vs edit, setlists R8). */
export async function setCollaboratorPermission(userId, setlistId, collaboratorId, canEdit) {
  return withErrorMapping(async () => {
    try {
      const { error } = await supabase
        .from('setlist_collaborators')
        .update({ can_edit: canEdit })
        .eq('setlist_id', setlistId)
        .eq('user_id', collaboratorId)
      if (error) throw error

      const fresh = await fetchSetlistById(userId, setlistId)
      invalidateSetlists(userId, [setlistId])
      return fresh
    } catch (e) {
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, {
        name: 'setCollaboratorPermission',
        args: [userId, setlistId, collaboratorId, canEdit],
      })
      return buildOptimisticCollab(userId, setlistId, (current) => ({
        collaborators: (current.collaborators || []).map((c) => (
          c.userId === collaboratorId ? { ...c, canEdit } : c
        )),
      }))
    }
  })
}

/** Owner removes a collaborator — 0002 delete_owner revokes their access. */
export async function removeCollaborator(userId, setlistId, collaboratorId) {
  return withErrorMapping(async () => {
    try {
      const { error } = await supabase
        .from('setlist_collaborators')
        .delete()
        .eq('setlist_id', setlistId)
        .eq('user_id', collaboratorId)
      if (error) throw error

      const fresh = await fetchSetlistById(userId, setlistId)
      invalidateSetlists(userId, [setlistId])
      return fresh
    } catch (e) {
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'removeCollaborator', args: [userId, setlistId, collaboratorId] })
      return buildOptimisticCollab(userId, setlistId, (current) => ({
        collaborators: (current.collaborators || []).filter((c) => c.userId !== collaboratorId),
      }))
    }
  })
}

/**
 * Transfer ownership to an accepted collaborator (setlists R9): the new
 * owner gains ownership controls, the former owner keeps edit access.
 * No transaction spans PostgREST calls, so the steps are ordered so the
 * session never loses its update right: (1) drop the new owner's collaborator
 * row, (2) add the former owner as an accepted can_edit collaborator, and
 * only then (3) flip setlists.owner_id. A mid-failure leaves the old owner
 * still owning — recoverable by re-running.
 */
export async function transferOwnership(userId, setlistId, newOwnerId) {
  return withErrorMapping(async () => {
    try {
      const current = await fetchSetlistById(userId, setlistId)
      // Replay-safe (2.6, R6): a retried transfer finds the flip already
      // applied — the caller no longer owns the setlist and newOwnerId does.
      // Return as-is; re-running the guard would now reject, because the
      // caller is a collaborator rather than the accepted candidate.
      if (current.userId === newOwnerId && !current.isOwner) return current

      // Roster check — owner reads every collaborator row (RLS select_owner).
      const { data: collabs, error: collabsError } = await supabase
        .from('setlist_collaborators')
        .select('user_id, accepted_at')
        .eq('setlist_id', setlistId)
      if (collabsError) throw collabsError
      const guard = guardTransfer(collabs || [], newOwnerId)
      if (guard) throw new Error(guard)

      const { error: removeErr } = await supabase
        .from('setlist_collaborators')
        .delete()
        .eq('setlist_id', setlistId)
        .eq('user_id', newOwnerId)
      if (removeErr) throw removeErr

      const { error: keepErr } = await supabase
        .from('setlist_collaborators')
        .insert({
          setlist_id: setlistId,
          user_id: userId,
          can_edit: true,
          accepted_at: new Date().toISOString(),
        })
      if (keepErr) throw keepErr

      const { error: flipErr } = await supabase
        .from('setlists')
        .update({ owner_id: newOwnerId })
        .eq('id', setlistId)
        .eq('owner_id', userId)
      if (flipErr) throw flipErr

      const fresh = await fetchSetlistById(userId, setlistId)
      invalidateSetlists(userId, [setlistId])
      return fresh
    } catch (e) {
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      const base = await readBaseSetlist(userId, setlistId)
      if (base?.userId === newOwnerId && !base.isOwner) return base
      await enqueueOp(userId, { name: 'transferOwnership', args: [userId, setlistId, newOwnerId] })
      return buildOptimisticCollab(userId, setlistId, (current) => ({
        userId: newOwnerId,
        isOwner: false,
        canEdit: true,
        collaborators: [
          ...(current.collaborators || []).filter((c) => c.userId !== newOwnerId && c.userId !== userId),
          { userId, canEdit: true, acceptedAt: new Date().toISOString() },
        ],
      }))
    }
  })
}

/**
 * Resolve the collaborator roster with display names (owner surface). No FK
 * from setlist_collaborators to profiles — second round trip, bandmates.js
 * precedent. Non-owners read only their own row under RLS select_self.
 */
export async function listCollaborators(userId, setlistId) {
  const { data, error } = await supabase
    .from('setlist_collaborators')
    .select('*')
    .eq('setlist_id', setlistId)
  if (error) throw error

  const rows = data || []
  const ids = [...new Set(rows.map((row) => row.user_id))]
  let byId = new Map()
  if (ids.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', ids)
    if (profilesError) throw profilesError
    byId = new Map((profiles || []).map((profile) => [profile.id, profile]))
  }

  return rows.map((row) => {
    const profile = byId.get(row.user_id)
    return {
      userId: row.user_id,
      canEdit: row.can_edit,
      pending: !row.accepted_at,
      acceptedAt: row.accepted_at,
      username: profile?.username || null,
      displayName: profile?.display_name || null,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.3 — activity feed (setlists R11, design D6): client-derived from Supabase
// Realtime broadcast events, no setlist_activity table. Payload carries
// { action, actor, ts } only. A one-shot sender channel is used per emission
// (subscribe → send → remove); Realtime does not deliver a broadcast back to
// its own sender, so the emitting client appends its own event locally.

const ACTIVITY_EVENT = 'setlist-activity'
const activityTopic = (setlistId) => `setlist-activity:${setlistId}`

/** Subscribe to a setlist's activity broadcasts. Returns an unsubscribe fn. */
export function subscribeActivity(setlistId, onActivity) {
  const channel = supabase
    .channel(activityTopic(setlistId))
    .on('broadcast', { event: ACTIVITY_EVENT }, ({ payload }) => onActivity(payload))
    .subscribe()
  return () => supabase.removeChannel(channel)
}

/**
 * Broadcast one activity event and return its payload so the caller can
 * prepend it locally (the sender's own channel never receives it back).
 */
export function broadcastActivity(setlistId, action, actorName) {
  const payload = { action, actor: actorName, ts: Date.now() }
  const channel = supabase.channel(activityTopic(setlistId))
  let sent = false
  channel.subscribe((status) => {
    if (sent || status !== 'SUBSCRIBED') return
    sent = true
    channel.send({ type: 'broadcast', event: ACTIVITY_EVENT, payload })
      .then(() => supabase.removeChannel(channel))
  })
  return payload
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.4 — realtime (setlists R2, design D6 data flow): subscribe to
// postgres_changes on the three tables published in 0006 (0.6) so any
// collaborator's write reaches members within 2 seconds. setlist_items
// carries the item edits (filter setlist_id=eq), setlist_collaborators the
// invite/accept/permission/removal and ownership-transfer roster changes,
// setlists the visibility/name/owner updates. The parent updated_at bump
// trigger makes an item edit ALSO fire a setlists event, so consumers
// coalesce bursts (useSharedSetlist debounces its refetch). Returns an
// unsubscribe fn that removes the channel — teardown on unmount.

/**
 * Subscribe to live changes of one setlist across the published tables.
 * `onChange` receives the raw postgres_changes payload ({table, eventType,
 * new, old}). RLS caps delivery: a non-member subscriber receives nothing.
 */
export function subscribeSetlistRealtime(setlistId, onChange) {
  const channel = supabase
    .channel(`setlist:${setlistId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'setlist_items', filter: `setlist_id=eq.${setlistId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'setlist_collaborators', filter: `setlist_id=eq.${setlistId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'setlists', filter: `id=eq.${setlistId}` },
      onChange,
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.5 — client advisory lock (R3, D4): broadcast {userId, songId} pairs over
// the setlist's lock channel. Realtime does not reliably echo a broadcast
// back to its sender (2.3 experience), so the holder also applies its own
// lock locally; receivers merge via applyLock (setlistCollab.js). ONE
// persistent channel per setlist preserves acquire→release ordering —
// per-event one-shot channels could reorder two sends and strand a lock.

const LOCK_EVENT = 'edit-lock'
const lockTopic = (setlistId) => `setlist-lock:${setlistId}`

/**
 * Open a setlist's lock channel for receive + send. Returns { send, close }:
 * send() queues until the channel joins, then pushes in order; close()
 * removes the channel (teardown on unmount).
 */
export function openLockChannel(setlistId, onLock) {
  const channel = supabase.channel(lockTopic(setlistId))
  let sendQueue = []
  channel
    .on('broadcast', { event: LOCK_EVENT }, ({ payload }) => onLock?.(payload))
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      for (const queued of sendQueue) {
        channel.send({ type: 'broadcast', event: LOCK_EVENT, payload: queued }).catch(() => {})
      }
      sendQueue = null
    })
  return {
    send(payload) {
      if (sendQueue) sendQueue.push(payload)
      else channel.send({ type: 'broadcast', event: LOCK_EVENT, payload }).catch(() => {})
    },
    close() {
      supabase.removeChannel(channel)
    },
  }
}

/**
 * Resolve setlist durations by joining with the songs store.
 * Returns { totalSeconds, formatted } (mm:ss, unknown durations omitted).
 */
export async function getSetlistDuration(userId, setlistId) {
  return withErrorMapping(async () => {
    const setlist = await getSetlist(userId, setlistId)
    const songs = await listSongs(userId)
    const totalSeconds = computeTotalSeconds(setlist.itemIds, songs)
    return { totalSeconds, formatted: formatDuration(totalSeconds) }
  })
}

/**
 * Pure join: sum known song durations for itemIds in order.
 * Unknown durations are skipped (only known ones count).
 */
export function computeTotalSeconds(itemIds, songs) {
  const byId = new Map(songs.map((s) => [s.id, s]))
  return itemIds.reduce((sum, id) => {
    const duration = byId.get(id)?.durationSeconds || null
    return sum + (duration || 0)
  }, 0)
}

export function demo() {
  const cases = [
    [formatDuration(765), '12:45', 'formatDuration(765)'],
    [formatDuration(210), '3:30', 'formatDuration(210)'],
    [formatDuration(0), '0:00', 'formatDuration(0)'],
    [
      computeTotalSeconds(['a', 'b', 'c'], [
        { id: 'a', durationSeconds: 210 },
        { id: 'b', durationSeconds: null }, // unknown — omitted
        { id: 'c', durationSeconds: 315 },
      ]),
      525,
      'unknown duration omitted',
    ],
  ]
  for (const [actual, expected, label] of cases) {
    if (actual !== expected) {
      throw new Error(`setlists demo failed: ${label} expected ${expected}, got ${actual}`)
    }
  }
  console.log(`setlists demo OK: 765s → ${formatDuration(765)} (scenario 4: 3:30+4:00+5:15=12:45)`)
}