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

// ponytail: known user-facing errors re-thrown as-is; network/PostgREST
// errors map to a safe generic message.
const USER_ERRORS = new Set(['Setlist not found.', 'Setlist name is required.'])

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
 * Flatten a raw Supabase setlist row (with embedded setlist_items)
 * into the shape the rest of the app expects: itemIds ordered by position.
 */
function flattenSetlist(row) {
  const itemIds = (row.setlist_items || [])
    .sort((a, b) => a.position - b.position)
    .map((i) => i.song_id)

  return {
    id: row.id,
    userId: row.owner_id,
    name: row.name,
    itemIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Fetch one setlist row with nested setlist_items.
 * Throws 'Setlist not found.' when missing.
 */
async function fetchSetlistById(userId, id) {
  const { data, error } = await supabase
    .from('setlists')
    .select('*, setlist_items(song_id, position)')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Setlist not found.')
  return flattenSetlist(data)
}

/**
 * Build the optimistic post-write setlist for an offline-queued mutation:
 * the currently cached/fetched setlist with the mutation applied, flagged
 * pendingSync, and written back to the read-through cache so an offline
 * reload shows the pending version. Validation already ran before the
 * connectivity catch fired, so falling back to a minimal stub is safe.
 */
async function buildOptimisticSetlist(userId, id, { name, mutateItemIds }) {
  let base = null
  const cached = await offlineGet(`setlist:${userId}:${id}`)
  if (cached?.data) {
    base = cached.data
  } else {
    try {
      base = await fetchSetlistById(userId, id)
    } catch {
      base = null
    }
  }

  const fallback = {
    id,
    userId,
    name: name ?? 'Setlist',
    itemIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const current = base ?? fallback
  const optimistic = {
    ...current,
    name: name !== undefined ? name : current.name,
    itemIds: mutateItemIds(current.itemIds),
    updatedAt: new Date().toISOString(),
    pendingSync: true,
  }
  await offlineSet(`setlist:${userId}:${id}`, optimistic)
  return optimistic
}

export function listSetlists(userId) {
  return withErrorMapping(() =>
    withReadThrough(`setlists:${userId}`, async () => {
      const { data, error } = await supabase
        .from('setlists')
        .select('*, setlist_items(song_id, position)')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []).map(flattenSetlist)
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
        .select('*, setlist_items(song_id, position)')
        .single()
      if (error) throw error

      const setlist = flattenSetlist(data)
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