// @ts-check
// Supabase data layer for songs.
// Replaces the localStorage mock with hosted Supabase queries.
// Public surface: listSongs, addSong, getSong, updateSong, deleteSong,
// searchSongs, retireSong, reactivateSong, replacePdfScan, maybeCachePdf —
// same signatures as before (+ #76 pdf scan flows).
// Reads are read-through cached in IndexedDB (offlineCache.js); writes
// invalidate the affected keys on success.

import { supabase } from './supabase.js'
import { computeReadiness } from './readiness.js'
import { filterSongs } from './search.js'
import { offlineGet, offlineSet, offlineRemove } from './offlineCache.js'
import {
  ensurePdfCached,
  PDF_SIZE_MESSAGE,
  PDF_TYPE_MESSAGE,
  uploadPdf,
  validatePdfFile,
} from './pdfCharts.js'

/**
 * @typedef {'ready' | 'draft' | 'retired'} SongStatus
 */

/**
 * Raw Supabase row shapes (select '*, chart_files(*), song_versions(*)').
 * @typedef {object} RawChartRow
 * @property {string} id
 * @property {string | null} content
 * @property {'chordpro' | 'musicxml' | 'abc' | 'pdf'} format
 * @property {string} object_key
 * @property {number} size_bytes
 * @property {boolean} soft_deleted
 * @property {string} created_at
 */

/**
 * @typedef {object} RawVersionRow
 * @property {string} id
 * @property {string} name
 * @property {number} number
 * @property {string} base_key
 * @property {number | null} base_tempo
 * @property {number | null} duration_seconds
 * @property {boolean} is_ready
 * @property {string | null} chart_file_id
 * @property {Record<string, unknown>} metadata
 * @property {string} created_at
 */

/**
 * @typedef {object} RawSongRow
 * @property {string} id
 * @property {string} created_by
 * @property {string} title
 * @property {string | null} artist
 * @property {string | null} genre
 * @property {string | null} source
 * @property {number | null} year
 * @property {'public-domain' | 'CC-BY-4.0' | 'proprietary'} license
 * @property {boolean} license_confirmed
 * @property {string} created_at
 * @property {string} updated_at
 * @property {boolean} is_deleted
 * @property {string | null} org_id
 * @property {string | null} branch_id
 * @property {string | null} source_org_id
 * @property {RawVersionRow[]} song_versions
 * @property {RawChartRow[]} chart_files
 */

/**
 * App-facing song shapes (flattened down from the raw embed).
 * @typedef {object} SongVersion
 * @property {string} id
 * @property {string} name
 * @property {number} number
 * @property {string} key
 * @property {number | null} bpm
 * @property {number | null} durationSeconds
 * @property {boolean} isReady
 * @property {string} body
 */

/**
 * @typedef {object} Song
 * @property {string} id
 * @property {string} userId
 * @property {string} title
 * @property {string} key
 * @property {number | null} bpm
 * @property {boolean} hasChordChart
 * @property {string} body
 * @property {Record<string, unknown>} metadata
 * @property {'chordpro' | 'musicxml' | 'abc' | 'pdf'} format
 * @property {string} objectKey
 * @property {number} sizeBytes
 * @property {boolean} isPdf
 * @property {number | null} durationSeconds
 * @property {SongStatus} status
 * @property {string} artist
 * @property {string} genre
 * @property {string} source
 * @property {number | null} year
 * @property {'public-domain' | 'CC-BY-4.0' | 'proprietary'} license
 * @property {boolean} licenseConfirmed
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string | null} deletedAt
 * @property {string | null} orgId
 * @property {string | null} branchId
 * @property {string | null} sourceOrgId
 * @property {string | null} versionId
 * @property {string | null} chartFileId
 * @property {SongVersion[]} versions
 */

/**
 * Import metadata for addSong (#78): declared fields land on the songs row
 * (artist/genre/year/source/license — license falls back to the column
 * default 'CC-BY-4.0' when omitted), version identity on the version row
 * (versionName → name, changeNote → change_note), and importMeta is persisted
 * as metadata.import on the version row. All optional — every existing call
 * site behaves identically when meta is omitted.
 * @typedef {object} SongMetaInput
 * @property {string | null | undefined} [artist]
 * @property {string | null | undefined} [genre]
 * @property {number | null | undefined} [year]
 * @property {string | null | undefined} [source]
 * @property {'public-domain' | 'CC-BY-4.0' | 'proprietary' | undefined} [license]
 * @property {boolean | undefined} [licenseConfirmed]
 * @property {string | undefined} [versionName]
 * @property {string | undefined} [changeNote]
 * @property {Record<string, unknown> | undefined} [importMeta]
 */

/**
 * Mutation payload — every field optional, only provided fields change.
 * @typedef {object} SongInput
 * @property {string | undefined} [title]
 * @property {string | undefined} [key]
 * @property {number | string | undefined} [bpm]
 * @property {boolean | undefined} [hasChordChart]
 * @property {string | undefined} [body]
 * @property {number | undefined} [durationSeconds]
 * @property {string | null | undefined} [artist]
 * @property {string | null | undefined} [genre]
 * @property {number | null | undefined} [year]
 * @property {File | undefined} [pdfFile]
 * @property {SongMetaInput | undefined} [meta]
 */

// ponytail: known user-facing errors re-thrown as-is; network/PostgREST
// errors map to a safe generic message.
const USER_ERRORS = new Set([
  'Title is required.',
  'Song not found.',
  PDF_SIZE_MESSAGE,
  PDF_TYPE_MESSAGE,
])

/**
 * Re-throws known user-facing errors; maps everything else to a generic
 * message so callers never see PostgREST internals. Never returns.
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

// ponytail: no freshness TTL — every successful network read overwrites
// the cache and offline reads serve it unconditionally, so staleness
// self-heals on the next successful fetch. Add a TTL only if
// stale-then-offline reads become a problem.
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
export function invalidateSongs(userId, ids) {
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
/**
 * @param {RawSongRow} row
 * @returns {Song}
 */
function flattenSong(row) {
  const versionRows = (row.song_versions || [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const latest = versionRows[0] || null

  const charts = (row.chart_files || [])
    .filter((c) => !c.soft_deleted)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const chart = (latest?.chart_file_id)
    ? charts.find((c) => c.id === latest.chart_file_id) || charts[0]
    : charts[0]

  const body = chart?.content || ''
const isPdf = chart?.format === 'pdf'
  const { status } = /** @type {{ status: SongStatus, reason: string | null }} */ (
    row.is_deleted
      ? { status: 'retired' }
      : computeReadiness({
          key: latest?.base_key || '',
          body,
          hasPdfChart: isPdf,
          sizeBytes: chart?.size_bytes ?? 0,
        })
  )

  // 3.5: expose every version for the picker — no extra network (song_versions
  // + chart_files are already embedded). Body = the version's own chart, ''
  // when it has none (picker default stays the latest chart). #76: each
  // version resolves its own chart's format/object_key so the picker can
  // render ChordPro vs PDF per version.
  const versions = versionRows.map((v) => {
    const vChart = v.chart_file_id ? charts.find((c) => c.id === v.chart_file_id) : null
    return {
      id: v.id,
      name: v.name,
      number: v.number,
      key: v.base_key || '',
      bpm: v.base_tempo ?? null,
      durationSeconds: v.duration_seconds ?? null,
      isReady: v.is_ready,
      // #69: version metadata flows through (album-art/provenance jsonb home).
      metadata: v.metadata || {},
      body: vChart?.content || '',
      // #76: per-version chart identity (pdf scan vs chordpro text).
      format: vChart?.format || 'chordpro',
      objectKey: vChart?.object_key || '',
      sizeBytes: vChart?.size_bytes ?? 0,
    }
  })

  return {
    id: row.id,
    userId: row.created_by,
    title: row.title,
    key: latest?.base_key || '',
    bpm: latest?.base_tempo ?? null,
    // #69: album-art/provenance of the latest version (external enrichment).
    metadata: latest?.metadata || {},
    hasChordChart: !!chart?.content,
    body,
    // #76: pdf chart surface — format/objectKey/sizeBytes/isPdf (scan = chart).
    format: chart?.format || 'chordpro',
    objectKey: chart?.object_key || '',
    sizeBytes: chart?.size_bytes ?? 0,
    isPdf,
    durationSeconds: latest?.duration_seconds ?? null,
    status,
    artist: row.artist || '',
    genre: row.genre || '',
    // #78 import contract (0028): declared metadata / import lineage surface.
    source: row.source || '',
    year: row.year ?? null,
    license: row.license || 'CC-BY-4.0',
    licenseConfirmed: Boolean(row.license_confirmed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.is_deleted ? row.updated_at : null,
    // Organizational repertoire (0016): scope fields — null at system level;
    // sourceOrgId keeps provenance for promoted songs. Additive, only used by
    // the org repertoire surface today.
    orgId: row.org_id || null,
    branchId: row.branch_id || null,
    sourceOrgId: row.source_org_id || null,
    // Internal fields — used by mutations to locate the version/chart rows
    versionId: latest?.id || null,
    chartFileId: chart?.id || null,
    versions,
  }
}

/**
 * Fetch one song row with nested chart_files + song_versions,
 * flattened into the app shape. Throws 'Song not found.' when missing.
 */
/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<Song>}
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

  const song = flattenSong(data)
  // #76: best-effort offline pdf cache after a successful read — fire and
  // forget, never blocks or throws (ensurePdfCached is fully guarded). Runs
  // for every fetch (get/add/replace), so a previously-cached scan renders
  // offline in stage mode.
  maybeCachePdf(song)
  return song
}

/**
 * #76: fire-and-forget offline cache of a PDF scan's blob (scenario 5).
 * No-op for chordpro songs; silent failure when offline/caching unavailable.
 * @param {Song} song
 */
export function maybeCachePdf(song) {
  if (!song?.isPdf || !song.objectKey) return
  void ensurePdfCached(song.objectKey)
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
/**
 * @param {string} userId
 * @param {{ retired?: boolean, status?: string }} [filter]
 * @returns {Promise<Song[]>}
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
    /** @type {Song[]} */
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
 *
 * #76 (PDF scans): pass `pdfFile` to create the song with a PDF scan as its
 * chart — validate BEFORE anything is written (acceptance #8: oversized
 * rejected, nothing else changes), upload to the private charts bucket, then
 * chart_files (format pdf, content NULL, object_key = storage path) + version
 * number 1. Stepless: the ChordPro path below is unchanged.
 *
 * #78 (import pipeline): pass `meta` to land the IMPORT contract on insert —
 *   meta.artist/genre/year/source/license/licenseConfirmed → set on the songs
 *   row (license falls back to the column default 'CC-BY-4.0' when omitted);
 *   meta.versionName/changeNote/importMeta → version row name/change_note and
 *   metadata.import. ALL existing call sites behave identically when meta is
 *   omitted.
 */
/**
 * @param {string} userId
 * @param {SongInput} input
 * @returns {Promise<Song>}
 */
// eslint-disable-next-line no-unused-vars -- hasChordChart kept for signature parity; chart presence is derived from body
export async function addSong(userId, { title, key, bpm, hasChordChart, body, durationSeconds, pdfFile, meta }) {
  return withErrorMapping(async () => {
    const trimmed = title?.trim()
    if (!trimmed) throw new Error('Title is required.')

    const songBody = body || ''
    const songKey = key?.trim() || ''
    const songBpm = bpm ? Number(bpm) : null
    const songDuration = durationSeconds ? Number(durationSeconds) : null

    // #76: PDF branch — validate + upload FIRST; nothing is written on
    // rejection and an upload failure leaves the existing song untouched.
    let pdfPath = null
    let pdfSize = 0
    if (pdfFile) {
      const check = validatePdfFile(pdfFile)
      if (!check.ok) {
        throw new Error(check.reason === 'size' ? PDF_SIZE_MESSAGE : PDF_TYPE_MESSAGE)
      }
      const uploaded = await uploadPdf(userId, pdfFile)
      pdfPath = uploaded.path
      pdfSize = check.sizeBytes ?? 0
    }

    const readiness = pdfPath
      ? computeReadiness({ key: songKey, body: '', hasPdfChart: true, sizeBytes: pdfSize })
      : computeReadiness({ key: songKey, body: songBody })

    // 1. Insert songs row (#78: import metadata lands here when meta present)
    const songPatch = /** @type {{
      created_by: string,
      title: string,
      artist?: string | null,
      genre?: string | null,
      year?: number | null,
      source?: string | null,
      license?: 'public-domain' | 'CC-BY-4.0' | 'proprietary',
      license_confirmed?: boolean,
    }} */ ({ created_by: userId, title: trimmed })
    if (meta) {
      if (meta.artist !== undefined) songPatch.artist = meta.artist
      if (meta.genre !== undefined) songPatch.genre = meta.genre
      if (meta.year !== undefined) songPatch.year = meta.year
      if (meta.source !== undefined) songPatch.source = meta.source
      if (meta.license !== undefined) songPatch.license = meta.license
      if (meta.licenseConfirmed !== undefined) songPatch.license_confirmed = meta.licenseConfirmed
    }
    const { data: songRow, error: songErr } = await supabase
      .from('songs')
      .insert(songPatch)
      .select()
      .single()
    if (songErr) throw songErr

    // 2. Insert chart_files row (inline ChordPro text, or pdf object row)
    const { data: chartRow, error: chartErr } = await supabase
      .from('chart_files')
      .insert(pdfPath
        ? {
            song_id: songRow.id,
            format: 'pdf',
            object_key: pdfPath,
            content: null,
            size_bytes: pdfSize,
          }
        : {
            song_id: songRow.id,
            format: 'chordpro',
            object_key: crypto.randomUUID(), // ponytail: not null constraint, content is inline
            content: songBody,
            size_bytes: songBody.length,
          })
      .select()
      .single()
    if (chartErr) throw chartErr

    // 3. Insert song_versions row (#78: import lineage — name/change_note/
    // metadata.import ride the version row when meta provides them)
    const verPatch = /** @type {{
      song_id: string,
      name: string,
      number: number,
      chart_file_id: string,
      base_key: string,
      base_tempo: number | null,
      duration_seconds: number | null,
      is_ready: boolean,
      owner_id: string,
      created_by: string,
      change_note?: string,
      metadata?: Record<string, unknown>,
    }} */ ({
      song_id: songRow.id,
      name: meta?.versionName || 'Original', // ponytail: not null constraint
      number: 1,
      chart_file_id: chartRow.id,
      base_key: songKey,
      base_tempo: songBpm,
      duration_seconds: songDuration,
      is_ready: readiness.status === 'ready',
      owner_id: userId,
      created_by: userId,
    })
    if (meta) {
      if (meta.changeNote !== undefined) verPatch.change_note = meta.changeNote
      if (meta.importMeta) verPatch.metadata = { import: meta.importMeta }
    }
    const { error: verErr } = await supabase
      .from('song_versions')
      .insert(verPatch)
    if (verErr) throw verErr

    const song = await fetchSongById(userId, songRow.id)
    // New song changes the list; the song's own entry was just written fresh.
    invalidateSongs(userId, [])
    return song
  })
}

/**
/**
 * #76: replace a PDF scan — append-only version flow (scenario 3).
 * Validates + uploads a NEW object, inserts a NEW chart_files row and a NEW
 * song_versions row with number = max(existing)+1, copying base_key/base_tempo
 * from the current latest version. The PREVIOUS chart row and version are NOT
 * touched (previous scan preserved in version history — the picker still shows
 * v1 with its chart). Returns the refetched song.
 * @param {string} userId
 * @param {string} songId
 * @param {File} file
 * @returns {Promise<Song>}
 */
export async function replacePdfScan(userId, songId, file) {
  return withErrorMapping(async () => {
    const current = await fetchSongById(userId, songId)
    if (!current.isPdf) {
      throw new Error('Only PDF scans can be replaced this way.')
    }

    const check = validatePdfFile(file)
    if (!check.ok) {
      throw new Error(check.reason === 'size' ? PDF_SIZE_MESSAGE : PDF_TYPE_MESSAGE)
    }
    const { path } = await uploadPdf(userId, file)

    // 1. New chart_files row for the corrected scan (old row untouched).
    const { data: chartRow, error: chartErr } = await supabase
      .from('chart_files')
      .insert({
        song_id: songId,
        format: 'pdf',
        object_key: path,
        content: null,
        size_bytes: check.sizeBytes,
      })
      .select()
      .single()
    if (chartErr) throw chartErr

    // 2. New song_versions row — number = max existing + 1, key/tempo copied
    // from the current latest version, readiness recomputed per version.
    const latestNumber = current.versions.reduce((m, v) => Math.max(m, v.number || 0), 0)
    const newReadiness = computeReadiness({
      key: current.key,
      body: '',
      hasPdfChart: true,
      sizeBytes: check.sizeBytes,
    })
    const { error: verErr } = await supabase
      .from('song_versions')
      .insert({
        song_id: songId,
        name: 'Corrected scan',
        number: latestNumber + 1,
        chart_file_id: chartRow.id,
        base_key: current.key || null,
        base_tempo: current.bpm,
        duration_seconds: current.durationSeconds,
        is_ready: newReadiness.status === 'ready',
        owner_id: userId,
        created_by: userId,
      })
    if (verErr) throw verErr

    invalidateSongs(userId, [songId])
    // fetchSongById re-caches the new scan blob (maybeCachePdf inside).
    return fetchSongById(userId, songId)
  })
}

/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<Song>}
 */
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
/**
 * @typedef {{ gig_id: string, performed_at: string, gigs: { name?: string } | null }} PlayedAtRow
 * @typedef {{ gigId: string, gigName: string, performedAt: string }} PlayedAt
 */

/**
 * @param {string} userId
 * @param {string} songId
 * @returns {Promise<PlayedAt[]>}
 */
export function listPlayedAt(userId, songId) {
  return withErrorMapping(async () => {
    const { data, error } = await supabase
      .from('performance_items')
      .select('performances(gig_id, performed_at, gigs(name))')
      .eq('song_id', songId)
      .in('state', ['played', 'off_setlist'])

    if (error) throw error
    // The untyped Supabase client types the performances embed as an array,
    // but PostgREST returns the to-one row as an object — correct it here.
    const played = (data || [])
      .map((row) => {
        const p = /** @type {PlayedAtRow | null | undefined} */ (
          /** @type {unknown} */ (row.performances)
        )
        return p
          ? { gigId: p.gig_id, gigName: p.gigs?.name || 'Gig', performedAt: p.performed_at }
          : null
      })
      .filter(Boolean)
    return /** @type {PlayedAt[]} */ (played)
      .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())
  })
}

/**
 * Update a song. Partial payload — only provided fields change.
 * After update, recompute readiness unless retired.
 *
 * Provenance (external-autotagging #69): `provenanceSource` defaults to
 * 'manual' — when key or bpm is edited here (the USER edit form), the version
 * metadata records provenance.<field> = { source:'manual', at } merged
 * alongside any auto-filled entries (scenario 9). The enrichment apply path
 * calls with 'spotify' so the SAME updateSong writes source:'spotify'
 * provenance for the applied BPM; album art is merged separately
 * (enrichments.saveAlbumArt), and the key never lands in base_key.
 *
 * #78 (import pipeline): artist/genre/year are additive — when provided they
 * land on the songs row and record provenance.artist/genre/year = { source,
 * at } in the version metadata exactly like key/bpm (the conflict-resolution
 * path calls with 'import' so the chosen value keeps its provenance).
 */
/**
 * @param {string} userId
 * @param {string} id
 * @param {SongInput} input
 * @param {'manual' | 'spotify' | 'musicbrainz' | 'import'} provenanceSource
 * @returns {Promise<Song>}
 */
export async function updateSong(userId, id, { title, key, bpm, body, durationSeconds, artist, genre, year }, provenanceSource = 'manual') {
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

    // Recompute readiness (skip for retired songs). #76: pass the pdf shape
    // so a PDF song's readiness recomputes via the scan branch (key + scan),
    // never the chordpro branch (its body is '').
    const isRetired = current.status === 'retired'
    const newStatus = isRetired
      ? current.status
      : computeReadiness({
          key: newKey,
          body: newBody,
          hasPdfChart: current.isPdf,
          sizeBytes: current.sizeBytes,
        }).status

    // 1. Update songs row (title / import metadata #78: artist, genre, year)
    const songFields = {}
    if (title !== undefined) songFields.title = title.trim()
    if (artist !== undefined) songFields.artist = artist
    if (genre !== undefined) songFields.genre = genre
    if (year !== undefined) songFields.year = year
    if (Object.keys(songFields).length > 0) {
      const { error } = await supabase
        .from('songs')
        .update({ ...songFields, updated_at: new Date().toISOString() })
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
      const verPatch = /** @type {{
        base_key: string,
        base_tempo: number | null,
        duration_seconds: number | null,
        is_ready?: boolean,
        metadata?: Record<string, unknown>,
      }} */ ({
        base_key: newKey,
        base_tempo: newBpm,
        duration_seconds: newDuration,
        // ponytail: only recompute is_ready when not retired
        ...(isRetired ? {} : { is_ready: newStatus === 'ready' }),
      })
      // #69/#78 provenance: key/bpm/artist/genre/year edits through this path
      // record their source (manual by default; enrichment apply passes
      // 'spotify'; import conflict resolution passes 'import') on the version
      // metadata, merged alongside existing entries (album art, lyrics, flags).
      if (key !== undefined || bpm !== undefined || artist !== undefined
          || genre !== undefined || year !== undefined) {
        /** @type {{ provenance?: Record<string, { source: string, at: string }>, [key: string]: unknown }} */
        const metadata = { ...(current.metadata || {}) }
        const provenance = { ...(metadata.provenance || {}) }
        const at = new Date().toISOString()
        if (key !== undefined) provenance.key = { source: provenanceSource, at }
        if (bpm !== undefined) provenance.bpm = { source: provenanceSource, at }
        if (artist !== undefined) provenance.artist = { source: provenanceSource, at }
        if (genre !== undefined) provenance.genre = { source: provenanceSource, at }
        if (year !== undefined) provenance.year = { source: provenanceSource, at }
        metadata.provenance = provenance
        verPatch.metadata = metadata
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
/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<void>}
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

/**
 * @param {string} userId
 * @param {string} query
 * @returns {Promise<Song[]>}
 */
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
/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<Song>}
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
/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<Song>}
 */
export async function reactivateSong(userId, id) {
  return withErrorMapping(async () => {
    const current = await fetchSongById(userId, id)
    if (current.status !== 'retired') return current

    const readiness = computeReadiness({
      key: current.key,
      body: current.body,
      hasPdfChart: current.isPdf,
      sizeBytes: current.sizeBytes,
    })

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