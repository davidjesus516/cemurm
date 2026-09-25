// @ts-check
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
import { normalizeProgram } from './midi.js'

/**
 * @typedef {'private' | 'shared' | 'public'} SetlistVisibility
 */

/**
 * Raw Supabase row shapes (select with embedded items + collaborators).
 * @typedef {object} RawSetlistItemRow
 * @property {string} song_id
 * @property {number} position
 * @property {string | null} version_id
 * @property {number | null} midi_program
 */

/**
 * @typedef {object} RawSetlistCollaboratorRow
 * @property {string} user_id
 * @property {boolean} can_edit
 * @property {string | null} accepted_at
 */

/**
 * @typedef {object} RawSetlistRow
 * @property {string} id
 * @property {string} owner_id
 * @property {string} name
 * @property {SetlistVisibility} visibility
 * @property {string} created_at
 * @property {string} updated_at
 * @property {RawSetlistItemRow[]} setlist_items
 * @property {RawSetlistCollaboratorRow[]} setlist_collaborators
 */

/**
 * Flattened app shape (flattenSetlist). Offline optimistic stubs reuse it
 * and may set pendingSync; the minimal stubs knowingly skip the collab
 * surface (canEdit/visibility/roster are unknown while offline).
 * @typedef {object} Setlist
 * @property {string} id
 * @property {string} userId
 * @property {string} name
 * @property {SetlistVisibility} visibility
 * @property {string[]} itemIds
 * @property {Record<string, string>} versionIds
 * @property {Record<string, number | null>} midiPrograms
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {boolean} isOwner
 * @property {boolean} canEdit
 * @property {SetlistCollaborator[]} collaborators
 * @property {boolean} [pendingSync]
 */

/**
 * @typedef {object} SetlistCollaborator
 * @property {string} userId
 * @property {boolean} canEdit
 * @property {string | null} acceptedAt
 */

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

/**
 * @param {Error} error
 * @returns {never}
 */
function handleError(error) {
  if (USER_ERRORS.has(error?.message)) throw error
  throw new Error('Something went wrong. Please try again.')
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withErrorMapping(fn) {
  try { return await fn() } catch (e) { handleError(/** @type {Error} */ (e)) }
}

// ponytail: best-effort connectivity heuristic — PostgREST network errors
// surface as fetch failures without a stable code; refine if a code appears.
/**
 * Best-effort connectivity heuristic — PostgREST network errors surface as
 * fetch failures without a stable code; refine if a code appears.
 * @param {unknown} e
 * @returns {boolean}
 */
function isConnectivityError(e) {
  const err = /** @type {{ message?: string, code?: string } | null | undefined} */ (e)
  const msg = String(err?.message || '')
  return typeof navigator !== 'undefined' && navigator.onLine === false
    || msg.includes('Failed to fetch')
    || msg.includes('fetch failed')
    || err?.code === '-1'
}

// ponytail: no freshness TTL — cache is overwritten on every successful
// network read, and served unconditionally when offline; staleness
// self-heals on the next successful fetch. Add a TTL only if a
// stale-then-offline read becomes a problem.
/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withReadThrough(key, fn) {
  try {
    const data = await fn()
    await offlineSet(key, data)
    return data
  } catch (e) {
    if (USER_ERRORS.has(/** @type {Error} */ (e)?.message)) throw e
    const cached = await offlineGet(key)
    if (cached?.data) return cached.data
    throw e
  }
}

/**
 * @param {string} userId
 * @param {string[]} ids
 */
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
/**
 * @param {RawSetlistRow} row
 * @param {string} userId
 * @returns {Setlist}
 */
function flattenSetlist(row, userId) {
  const items = (row.setlist_items || [])
    .sort((a, b) => a.position - b.position)
  const itemIds = items.map((i) => i.song_id)

  /** @type {Record<string, string>} */
  const versionIds = {}
  for (const item of items) {
    if (item.version_id) versionIds[item.song_id] = item.version_id
  }

  // MIDI program per song (Hito 5 #56): map omits null entries so an
  // unmapped song simply has no key (Stage Mode reads ─ absent key = no send).
  /** @type {Record<string, number>} */
  const midiPrograms = {}
  for (const item of items) {
    if (item.midi_program !== null && item.midi_program !== undefined) {
      midiPrograms[item.song_id] = item.midi_program
    }
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
    midiPrograms,
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
/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<Setlist>}
 */
async function fetchSetlistById(userId, id) {
  const { data, error } = await supabase
    .from('setlists')
    .select('*, setlist_items(song_id, position, version_id, midi_program), setlist_collaborators(user_id, can_edit, accepted_at)')
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
/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<Setlist | null>}
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
/**
 * @param {string} userId
 * @param {string} id
 * @param {{
 *   name?: string,
 *   mutateItemIds: (itemIds: string[]) => string[],
 *   mutateVersions?: (versionIds: Record<string, string>) => Record<string, string>,
 *   mutateMidi?: (midi: Record<string, number | null>) => Record<string, number | null>,
 * }} opts
 * @returns {Promise<Setlist>}
 */
async function buildOptimisticSetlist(userId, id, { name, mutateItemIds, mutateVersions, mutateMidi }) {
  const base = await readBaseSetlist(userId, id)

  // Offline stub — the collaboration surface (visibility, roster, canEdit)
  // cannot be known while the network is down; consumers treat it as absent.
  const fallback = /** @type {Setlist} */ (/** @type {unknown} */ ({
    id,
    userId,
    name: name ?? 'Setlist',
    itemIds: [],
    versionIds: {},
    midiPrograms: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
  const current = base ?? fallback
  const optimistic = {
    ...current,
    name: name !== undefined ? name : current.name,
    itemIds: mutateItemIds(current.itemIds),
    versionIds: mutateVersions
      ? mutateVersions(current.versionIds || {})
      : (current.versionIds || {}),
    midiPrograms: mutateMidi
      ? mutateMidi(current.midiPrograms || {})
      : (current.midiPrograms || {}),
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
/**
 * @param {string} userId
 * @param {string} id
 * @param {Partial<Setlist> | ((current: Setlist) => Partial<Setlist>)} patch
 * @returns {Promise<Setlist>}
 */
async function buildOptimisticCollab(userId, id, patch) {
  const base = await readBaseSetlist(userId, id)
  const fallback = /** @type {Setlist} */ (/** @type {unknown} */ ({
    id,
    userId,
    name: 'Setlist',
    visibility: 'private',
    itemIds: [],
    versionIds: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isOwner: true,
    canEdit: true,
    collaborators: [],
  }))
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
/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<Setlist>}
 */
export function fetchServerSetlist(userId, id) {
  return withErrorMapping(() => fetchSetlistById(userId, id))
}

/**
 * @param {string} userId
 * @returns {Promise<Setlist[]>}
 */
export function listSetlists(userId) {
  return withErrorMapping(() =>
    withReadThrough(`setlists:${userId}`, async () => {
      // Member read: shared setlists appear in the list for accepted
      // collaborators (0002 select_member); no owner_id filter.
      const { data, error } = await supabase
        .from('setlists')
        .select('*, setlist_items(song_id, position, version_id, midi_program), setlist_collaborators(user_id, can_edit, accepted_at)')
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []).map((row) => flattenSetlist(row, userId))
    }))
}

/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<Setlist>}
 */
export function getSetlist(userId, id) {
  return withErrorMapping(() =>
    withReadThrough(`setlist:${userId}:${id}`, () => fetchSetlistById(userId, id)))
}

/**
 * @param {string} userId
 * @param {{ name: string }} input
 * @returns {Promise<Setlist>}
 */
export async function createSetlist(userId, { name }) {
  return withErrorMapping(async () => {
    const trimmed = name?.trim()
    if (!trimmed) throw new Error('Setlist name is required.')

    try {
      const { data, error } = await supabase
        .from('setlists')
        .insert({ owner_id: userId, name: trimmed })
        .select('*, setlist_items(song_id, position, version_id, midi_program)')
        .single()
      if (error) throw error

      const setlist = flattenSetlist(data, userId)
      // New setlist changes the list; its own entry was just fetched fresh.
      invalidateSetlists(userId, [])
      return setlist
    } catch (e) {
      if (USER_ERRORS.has(/** @type {Error} */ (e)?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'createSetlist', args: [userId, { name: trimmed }] })
      // Offline stub — collab surface unknown while offline, same as
      // buildOptimisticSetlist's fallback.
      const optimistic = /** @type {Setlist} */ (/** @type {unknown} */ ({
        id: `local-${Date.now()}`,
        userId,
        name: trimmed,
        itemIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pendingSync: true,
      }))
      await offlineSet(`setlist:${userId}:${optimistic.id}`, optimistic)
      return optimistic
    }
  })
}

/**
 * @param {string} userId
 * @param {string} id
 * @param {{ name: string }} input
 * @returns {Promise<Setlist>}
 */
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
      if (USER_ERRORS.has(/** @type {Error} */ (e)?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'updateSetlist', args: [userId, id, { name }] })
      return buildOptimisticSetlist(userId, id, {
        name: name !== undefined ? name.trim() : undefined,
        mutateItemIds: (itemIds) => itemIds,
      })
    }
  })
}

/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<void>}
 */
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
/**
 * @param {string} userId
 * @param {string} id
 * @param {{ name: string }} input
 * @returns {Promise<Setlist>}
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

    // 2. Copy items (MIDI programs included — a duplicated setlist reuses
    // the same per-song program mapping on the new gig)
    if (source.itemIds.length > 0) {
      const items = source.itemIds.map((songId, i) => ({
        setlist_id: copyRow.id,
        song_id: songId,
        position: i,
        midi_program: source.midiPrograms?.[songId] ?? null,
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

/**
 * @param {string} userId
 * @param {string} setlistId
 * @param {string} songId
 * @returns {Promise<Setlist>}
 */
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
      if (USER_ERRORS.has(/** @type {Error} */ (e)?.message) || !isConnectivityError(e)) throw e
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
/**
 * @param {string} userId
 * @param {string} setlistId
 * @param {string} songId
 * @param {string | null} versionId
 * @returns {Promise<Setlist>}
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
      if (USER_ERRORS.has(/** @type {Error} */ (e)?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'setSongVersion', args: [userId, setlistId, songId, versionId] })
      return buildOptimisticSetlist(userId, setlistId, {
        mutateItemIds: (itemIds) => itemIds,
        // versionId null → undefined key, dropped on JSON serialization —
        // the optimistic cache then keeps only concrete version picks.
        mutateVersions: (versionIds) => /** @type {Record<string, string>} */ ({
          ...versionIds,
          [songId]: versionId || undefined,
        }),
      })
    }
  })
}

/**
 * Set (or clear) the MIDI program mapping for one setlist item (Hito 5 #56).
 * Same shape as setSongVersion: value is per (setlist_id, song_id), guarded
 * by the setlist read, invalidated after success, and enqueued offline (the
 * replay re-applies the same value — idempotent).
 * `program`: null/'' clears the mapping ("No patch"); else an integer 0-127
 * (normalized via midi.js; the 0024 CHECK constraint is the final guard).
 * @param {string} userId
 * @param {string} setlistId
 * @param {string} songId
 * @param {number | null | ''} program
 * @returns {Promise<Setlist>}
 */
export async function setMidiProgram(userId, setlistId, songId, program) {
  return withErrorMapping(async () => {
    try {
      const normalized = normalizeProgram(program)
      await fetchSetlistById(userId, setlistId)

      const { error } = await supabase
        .from('setlist_items')
        .update({ midi_program: normalized })
        .eq('setlist_id', setlistId)
        .eq('song_id', songId)
      if (error) throw error

      const setlist = await fetchSetlistById(userId, setlistId)
      invalidateSetlists(userId, [setlistId])
      return setlist
    } catch (e) {
      if (USER_ERRORS.has(/** @type {Error} */ (e)?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'setMidiProgram', args: [userId, setlistId, songId, program] })
      return buildOptimisticSetlist(userId, setlistId, {
        mutateItemIds: (itemIds) => itemIds,
        mutateMidi: (midiPrograms) => {
          const next = { ...midiPrograms }
          const n = normalizeProgram(program)
          if (n === null) delete next[songId]
          else next[songId] = n
          return next
        },
      })
    }
  })
}

/**
 * @param {string} userId
 * @param {string} setlistId
 * @param {string} songId
 * @returns {Promise<Setlist>}
 */
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
      if (USER_ERRORS.has(/** @type {Error} */ (e)?.message) || !isConnectivityError(e)) throw e
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
/**
 * @param {string} userId
 * @param {string} setlistId
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {Promise<Setlist>}
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

      // 4.1 (RPC swap, S15): the reorder now runs server-side in ONE
      // transaction — move_setlist_items (0009) does the two-phase bump
      // (positions 10000+i, REQUIRED by UNIQUE(setlist_id, position)) then a
      // single multi-row final pass, and sets the transaction-local GUC
      // cemurm.reorder_moved_song_id. The statement-level reorder trigger
      // fires exactly ONCE on that final pass — closing the interim-window
      // N-row emissions (one per-song UPDATE statement) — and names the moved
      // song from the GUC. Offline replay drains through this same RPC
      // (WRITE_OPS → moveSongInSetlist): idempotent, positions recomputed
      // from the ordered ids.
      const { error } = await supabase
        .rpc('move_setlist_items', {
          p_setlist_id: setlistId,
          p_ordered_song_ids: reordered,
          p_moved_song_id: moved,
        })
      if (error) throw error

      const freshSetlist = await fetchSetlistById(userId, setlistId)
      invalidateSetlists(userId, [setlistId])
      return freshSetlist
    } catch (e) {
      if (USER_ERRORS.has(/** @type {Error} */ (e)?.message) || !isConnectivityError(e)) throw e
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

/**
 * @param {string} userId
 * @param {string} id
 * @param {SetlistVisibility} visibility
 * @returns {Promise<Setlist>}
 */
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
      if (USER_ERRORS.has(/** @type {Error} */ (e)?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'setVisibility', args: [userId, id, visibility] })
      return buildOptimisticCollab(userId, id, { visibility })
    }
  })
}

/** Invite bandmates onto the setlist (INSERT rows; can_edit defaults true).
 * @param {string} userId
 * @param {string} id
 * @param {string[]} bandmateIds
 * @returns {Promise<Setlist>}
 */
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
      if (USER_ERRORS.has(/** @type {Error} */ (e)?.message) || !isConnectivityError(e)) throw e
      const base = await readBaseSetlist(userId, id)
      const targets = shareTargets(userId, bandmateIds, base?.collaborators)
      // Edge: offline with a cold cache and nothing to share returns the
      // (possibly null) base — pre-existing behavior, typed as Setlist.
      if (targets.length === 0) return /** @type {Setlist} */ (base)
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

/** Owner flips a collaborator's can_edit (view-only vs edit, setlists R8).
 * @param {string} userId
 * @param {string} setlistId
 * @param {string} collaboratorId
 * @param {boolean} canEdit
 * @returns {Promise<Setlist>}
 */
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
      if (USER_ERRORS.has(/** @type {Error} */ (e)?.message) || !isConnectivityError(e)) throw e
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

/** Owner removes a collaborator — 0002 delete_owner revokes their access.
 * @param {string} userId
 * @param {string} setlistId
 * @param {string} collaboratorId
 * @returns {Promise<Setlist>}
 */
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
      if (USER_ERRORS.has(/** @type {Error} */ (e)?.message) || !isConnectivityError(e)) throw e
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
 * The three ops (drop the new owner's collaborator row → re-insert the
 * former owner as an accepted can_edit collaborator → flip setlists.owner_id)
 * now run inside transfer_setlist_ownership (0008) as ONE transaction. The
 * DEFERRABLE removal trigger evaluates at commit — owner_id has already
 * flipped — so a transfer emits zero 'removed' rows. The RPC re-asserts
 * ownership + guardTransfer server-side with the same USER_ERRORS messages;
 * the client pre-flight guard below stays for UX.
 */
/**
 * @param {string} userId
 * @param {string} setlistId
 * @param {string} newOwnerId
 * @returns {Promise<Setlist>}
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

      // 4.2 (RPC swap): the three ops run server-side in one transaction.
      const { error } = await supabase.rpc('transfer_setlist_ownership', {
        p_setlist_id: setlistId,
        p_new_owner_id: newOwnerId,
      })
      if (error) throw error

      const fresh = await fetchSetlistById(userId, setlistId)
      invalidateSetlists(userId, [setlistId])
      return fresh
    } catch (e) {
      if (USER_ERRORS.has(/** @type {Error} */ (e)?.message) || !isConnectivityError(e)) throw e
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
/**
 * @param {string} userId
 * @param {string} setlistId
 * @returns {Promise<Array<{ userId: string, canEdit: boolean, pending: boolean, acceptedAt: string | null, username: string | null, displayName: string | null }>>}
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
/**
 * @param {string} setlistId
 * @returns {string}
 */
const activityTopic = (setlistId) => `setlist-activity:${setlistId}`

/** Subscribe to a setlist's activity broadcasts. Returns an unsubscribe fn.
 * @param {string} setlistId
 * @param {(payload: { action: string, actor: string, ts: number }) => void} onActivity
 * @returns {() => void}
 */
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
/**
 * @param {string} setlistId
 * @param {string} action
 * @param {string} actorName
 * @returns {{ action: string, actor: string, ts: number }}
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
/**
 * @param {string} setlistId
 * @param {(payload: unknown) => void} onChange
 * @returns {() => void}
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
/**
 * @param {string} setlistId
 * @returns {string}
 */
const lockTopic = (setlistId) => `setlist-lock:${setlistId}`

/**
 * @param {string} setlistId
 * @param {(payload: unknown) => void} onLock
 * @returns {{ send: (payload: unknown) => void, close: () => void }}
 */
export function openLockChannel(setlistId, onLock) {
  const channel = supabase.channel(lockTopic(setlistId))
  /** @type {unknown[] | null} */
  let sendQueue = []
  channel
    .on('broadcast', { event: LOCK_EVENT }, ({ payload }) => onLock?.(payload))
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      for (const queued of /** @type {unknown[]} */ (sendQueue)) {
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
/**
 * @param {string} userId
 * @param {string} setlistId
 * @returns {Promise<{ totalSeconds: number, formatted: string }>}
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
 * Unknown durations are skipped (only known ones count). Only reads
 * { id, durationSeconds } off each song.
 * @param {string[]} itemIds
 * @param {Array<{ id: string, durationSeconds: number | null }>} songs
 * @returns {number}
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