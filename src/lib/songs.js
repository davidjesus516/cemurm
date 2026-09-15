// Supabase data layer for songs.
// Replaces the localStorage mock with hosted Supabase queries.
// Public surface: listSongs, addSong, getSong, updateSong, deleteSong,
// searchSongs, retireSong, reactivateSong — same signatures as before.
// Reads are read-through cached in IndexedDB (offlineCache.js); writes
// invalidate the affected keys on success.

import { supabase } from './supabase.js'
import { computeReadiness } from './readiness.js'
import { filterSongs } from './search.js'
import { offlineGet, offlineSet, offlineRemove } from './offlineCache.js'

// ponytail: known user-facing errors re-thrown as-is; network/PostgREST
// errors map to a safe generic message.
const USER_ERRORS = new Set(['Title is required.', 'Song not found.'])

function handleError(error) {
  if (USER_ERRORS.has(error?.message)) throw error
  throw new Error('Something went wrong. Please try again.')
}

async function withErrorMapping(fn) {
  try { return await fn() } catch (e) { handleError(e) }
}

// ponytail: no freshness TTL — every successful network read overwrites
// the cache and offline reads serve it unconditionally, so staleness
// self-heals on the next successful fetch. Add a TTL only if
// stale-then-offline reads become a problem.
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

function invalidateSongs(userId, ids) {
  offlineRemove(`songs:${userId}`)
  for (const id of ids) offlineRemove(`song:${userId}:${id}`)
}

/**
 * Flatten a raw Supabase row (with embedded chart_files + song_versions)
 * into the shape the rest of the app expects.
 *
 * Selection: latest version by created_at desc → key/bpm/duration/is_ready.
 * Chart: prefer the version's chart_file_id, fallback to newest non-deleted.
 */
function flattenSong(row) {
  const versions = (row.song_versions || [])
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const latest = versions[0] || null

  const charts = (row.chart_files || [])
    .filter((c) => !c.soft_deleted)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const chart = (latest?.chart_file_id)
    ? charts.find((c) => c.id === latest.chart_file_id) || charts[0]
    : charts[0]

  const body = chart?.content || ''
  const { status } = row.is_deleted
    ? { status: 'retired' }
    : computeReadiness({ key: latest?.base_key || '', body })

  return {
    id: row.id,
    userId: row.created_by,
    title: row.title,
    key: latest?.base_key || '',
    bpm: latest?.base_tempo ?? null,
    hasChordChart: !!chart?.content,
    body,
    durationSeconds: latest?.duration_seconds ?? null,
    status,
    artist: row.artist || '',
    genre: row.genre || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.is_deleted ? row.updated_at : null,
    // Internal fields — used by mutations to locate the version/chart rows
    versionId: latest?.id || null,
    chartFileId: chart?.id || null,
  }
}

/**
 * Fetch one song row with nested chart_files + song_versions,
 * flattened into the app shape. Throws 'Song not found.' when missing.
 */
async function fetchSongById(userId, id) {
  const { data, error } = await supabase
    .from('songs')
    .select('*, chart_files(*), song_versions(*)')
    .eq('id', id)
    .eq('created_by', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Song not found.')
  return flattenSong(data)
}

/**
 * List songs for a user. Supports optional filter for retired songs.
 * Backward-compatible: listSongs(userId) returns all active songs.
 * listSongs(userId, { retired: true }) returns only retired songs.
 * listSongs(userId, { status: 'draft' }) returns active non-retired songs
 *   matching that status.
 * ponytail: single cache key per user — a filtered read overwrites the
 *   unfiltered cache; acceptable until offline filtered reads matter.
 */
export function listSongs(userId, filter = {}) {
  return withErrorMapping(() => withReadThrough(`songs:${userId}`, async () => {
    const retired = filter.retired === true || filter.status === 'retired'
    const { data, error } = await supabase
      .from('songs')
      .select('*, chart_files(*), song_versions(*)')
      .eq('is_deleted', retired)
      .order('created_at', { ascending: true })

    if (error) throw error
    let songs = (data || []).map(flattenSong)
    if (filter.status && filter.status !== 'retired') {
      songs = songs.filter((s) => s.status === filter.status)
    }
    return songs
  }))
}

/**
 * Add a new song. Inserts into songs + chart_files + song_versions.
 * Computes initial status from content.
 */
// eslint-disable-next-line no-unused-vars -- hasChordChart kept for signature parity; chart presence is derived from body
export async function addSong(userId, { title, key, bpm, hasChordChart, body, durationSeconds }) {
  return withErrorMapping(async () => {
    const trimmed = title?.trim()
    if (!trimmed) throw new Error('Title is required.')

    const songBody = body || ''
    const songKey = key?.trim() || ''
    const songBpm = bpm ? Number(bpm) : null
    const songDuration = durationSeconds ? Number(durationSeconds) : null

    const readiness = computeReadiness({ key: songKey, body: songBody })

    // 1. Insert songs row
    const { data: songRow, error: songErr } = await supabase
      .from('songs')
      .insert({ created_by: userId, title: trimmed })
      .select()
      .single()
    if (songErr) throw songErr

    // 2. Insert chart_files row (inline ChordPro text)
    const { data: chartRow, error: chartErr } = await supabase
      .from('chart_files')
      .insert({
        song_id: songRow.id,
        format: 'chordpro',
        object_key: crypto.randomUUID(), // ponytail: not null constraint, content is inline
        content: songBody,
        size_bytes: songBody.length,
      })
      .select()
      .single()
    if (chartErr) throw chartErr

    // 3. Insert song_versions row
    const { error: verErr } = await supabase
      .from('song_versions')
      .insert({
        song_id: songRow.id,
        name: 'Original', // ponytail: not null constraint
        number: 1,
        chart_file_id: chartRow.id,
        base_key: songKey,
        base_tempo: songBpm,
        duration_seconds: songDuration,
        is_ready: readiness.status === 'ready',
        owner_id: userId,
        created_by: userId,
      })
    if (verErr) throw verErr

    const song = await fetchSongById(userId, songRow.id)
    // New song changes the list; the song's own entry was just written fresh.
    invalidateSongs(userId, [])
    return song
  })
}

export function getSong(userId, id) {
  return withErrorMapping(() =>
    withReadThrough(`song:${userId}:${id}`, () => fetchSongById(userId, id)))
}

/**
 * Gigs where a song was actually played, newest first: [{ gigId, gigName,
 * performedAt }] per performance. States 'played' and 'off_setlist' (encore)
 * both mean performed; skipped items are excluded — never tagged (spec
 * "no tag for any skipped song"). Demand count = result length.
 * ponytail: deliberately NOT read-through cached — it is derived from gig
 * completions, so a fresh read avoids stale tags right after completing a
 * gig in the same session. IDB caching lands with the PR#2a write pipeline.
 */
export function listPlayedAt(userId, songId) {
  return withErrorMapping(async () => {
    const { data, error } = await supabase
      .from('performance_items')
      .select('performances(gig_id, performed_at, gigs(name))')
      .eq('song_id', songId)
      .in('state', ['played', 'off_setlist'])

    if (error) throw error
    return (data || [])
      .map((row) => {
        const p = row.performances
        return p
          ? { gigId: p.gig_id, gigName: p.gigs?.name || 'Gig', performedAt: p.performed_at }
          : null
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.performedAt) - new Date(a.performedAt))
  })
}

/**
 * Update a song. Partial payload — only provided fields change.
 * After update, recompute readiness unless retired.
 */
export async function updateSong(userId, id, { title, key, bpm, body, durationSeconds }) {
  return withErrorMapping(async () => {
    // Fetch current state (throws 'Song not found.' if missing)
    const current = await fetchSongById(userId, id)

    // Validate title
    if (title !== undefined) {
      const trimmed = title.trim()
      if (!trimmed) throw new Error('Title is required.')
    }

    const newKey = key !== undefined ? (key?.trim() || '') : current.key
    const newBpm = bpm !== undefined ? (bpm ? Number(bpm) : null) : current.bpm
    const newDuration = durationSeconds !== undefined
      ? (durationSeconds ? Number(durationSeconds) : null)
      : current.durationSeconds
    const newBody = body !== undefined ? body : current.body

    // Recompute readiness (skip for retired songs)
    const isRetired = current.status === 'retired'
    const newStatus = isRetired
      ? current.status
      : computeReadiness({ key: newKey, body: newBody }).status

    // 1. Update songs row (title)
    if (title !== undefined) {
      const { error } = await supabase
        .from('songs')
        .update({ title: title.trim(), updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('created_by', userId)
      if (error) throw error
    }

    // 2. Update chart_files row (in-place content update)
    if (body !== undefined && current.chartFileId) {
      const { error } = await supabase
        .from('chart_files')
        .update({ content: newBody, size_bytes: newBody.length })
        .eq('id', current.chartFileId)
      if (error) throw error
    }

    // 3. Update song_versions row
    if (current.versionId) {
      const verPatch = {
        base_key: newKey,
        base_tempo: newBpm,
        duration_seconds: newDuration,
        // ponytail: only recompute is_ready when not retired
        ...(isRetired ? {} : { is_ready: newStatus === 'ready' }),
      }
      const { error } = await supabase
        .from('song_versions')
        .update(verPatch)
        .eq('id', current.versionId)
      if (error) throw error
    }

    const song = await fetchSongById(userId, id)
    invalidateSongs(userId, [id])
    return song
  })
}

/**
 * Soft-delete a song via is_deleted.
 * ponytail: hard delete blocked by setlist_items FK RESTRICT;
 * both delete and retire map to is_deleted=true.
 */
export async function deleteSong(userId, id) {
  return withErrorMapping(async () => {
    await fetchSongById(userId, id)

    const { error } = await supabase
      .from('songs')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('created_by', userId)
    if (error) throw error

    invalidateSongs(userId, [id])
  })
}

export function searchSongs(userId, query) {
  return withErrorMapping(async () => {
    const songs = await listSongs(userId)
    if (!String(query ?? '').trim()) return songs
    return filterSongs(songs, { query })
  })
}

/**
 * Retire a song → is_deleted becomes true. Idempotent if already retired.
 */
export async function retireSong(userId, id) {
  return withErrorMapping(async () => {
    const current = await fetchSongById(userId, id)
    if (current.status === 'retired') return current

    const { error } = await supabase
      .from('songs')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('created_by', userId)
    if (error) throw error

    const song = await fetchSongById(userId, id)
    invalidateSongs(userId, [id])
    return song
  })
}

/**
 * Reactivate a retired song → clear is_deleted, recompute readiness.
 * Returns the song with its new status (ready or draft).
 */
export async function reactivateSong(userId, id) {
  return withErrorMapping(async () => {
    const current = await fetchSongById(userId, id)
    if (current.status !== 'retired') return current

    const readiness = computeReadiness({ key: current.key, body: current.body })

    const { error } = await supabase
      .from('songs')
      .update({ is_deleted: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('created_by', userId)
    if (error) throw error

    if (current.versionId) {
      const { error: verErr } = await supabase
        .from('song_versions')
        .update({ is_ready: readiness.status === 'ready' })
        .eq('id', current.versionId)
      if (verErr) throw verErr
    }

    const song = await fetchSongById(userId, id)
    invalidateSongs(userId, [id])
    return song
  })
}