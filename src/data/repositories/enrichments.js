// @ts-check
// Spotify enrichment data layer (Hito 5 #69): provenance rows in
// external_enrichments (migration 0026) + the user's external_connections
// row. supabase.js pattern; the connection state is mirrored to localStorage
// (cemurm:spotify:connection:<userId>, overlay.js read-through pattern) so the
// Settings page and the SongDetail gate render offline with ZERO network.
//
// Design notes:
// - Connection is IMPLICIT on first enrichment (no OAuth in this feature):
//   ensureSpotifyConnected upserts status='connected' before the first
//   suggestion insert; disconnectSpotify flips status='revoked' and the row
//   PERSISTS (unique(user_id, provider) ⇒ reconnect upserts back to
//   'connected'). Applied enrichment metadata is NEVER deleted on revoke.
// - external_enrichments is suggestion-first (RLS inserts only
//   state='suggested', source whitelist spotify|musicbrainz|lrclib — 0026's
//   insert policy was widened by 0028 §3 for the import pipeline); the state
//   machine (suggested → applied|discarded) runs through update, creator-only.
// - Applying values is the CALLER's job (the hook/T3): BPM rides the existing
//   updateSong path (provenance source passed explicitly), album art is merged
//   into song_versions.metadata, and the key stays a SUGGESTION only — it
//   never writes base_key (scenario 5).

import { spotifyKeyToLabel } from '../../integrations/spotify.js'

/**
 * external_connections.status (0026: text default 'connected'; the only two
 * values the contract uses — 'revoked' means revoked, the row persists).
 * @typedef {'connected' | 'revoked'} ConnectionStatus
 */

/**
 * The Spotify connection row this module reads and writes (provider 'spotify',
 * unique(user_id, provider)) — and the seam isSpotifyConnected accepts: only
 * `status` is read, so the offline Settings path can pass the mirror alone.
 * @typedef {object} SpotifyConnection
 * @property {ConnectionStatus} status
 * @property {string} [id]
 * @property {string} [user_id]
 * @property {string} [provider]
 * @property {string} [created_at]
 */

/**
 * external_enrichments.source — the whitelist 0026's insert policy enforces,
 * widened to the import providers by 0028 §3.
 * @typedef {'spotify' | 'musicbrainz' | 'lrclib'} EnrichmentSource
 */

/**
 * external_enrichments.field (0001 DDL enum).
 * @typedef {'bpm' | 'key' | 'album_art' | 'lyrics' | 'genre' | 'year'} EnrichmentField
 */

/**
 * external_enrichments.state (0001 default 'suggested'; 0026's suggestion-first
 * state machine).
 * @typedef {'suggested' | 'applied' | 'discarded'} EnrichmentState
 */

/**
 * The provider match suggestEnrichment persists from — SOURCE-AGNOSTIC by
 * design (see the header): it carries whatever the provider resolved, and each
 * persistable field is present only when that provider produced it (a spotify
 * match has no year/genre/lyrics, a musicbrainz match no bpm/key).
 * @typedef {object} EnrichmentMatch
 * @property {number | null} [bpm]
 * @property {number | null} [keyIndex]
 * @property {string | null} [mode]
 * @property {string | null} [albumArtUrl]
 * @property {string | null} [trackId]
 * @property {number | null} [year]
 * @property {string | null} [genre]
 * @property {string | null} [lyrics]
 */

/**
 * One external_enrichments insert row (0001 + 0026): the suggestion this
 * module writes. `value` is the field's jsonb payload.
 * @typedef {object} EnrichmentInsert
 * @property {string} song_id
 * @property {EnrichmentSource} source
 * @property {EnrichmentField} field
 * @property {object} value
 * @property {EnrichmentState} state
 * @property {string} applied_by
 */

/**
 * One external_enrichments row (0001 + 0026) as the provenance display reads
 * it: `value` is the field payload ({ bpm } | { key } | { album_art: { url,
 * trackId } } | { year } | { genre } | { lyrics }) and `applied_by` is the row
 * creator (the enriching user), null only for a row written by nobody.
 * @typedef {object} EnrichmentRow
 * @property {string} id
 * @property {string} song_id
 * @property {EnrichmentSource} source
 * @property {EnrichmentField} field
 * @property {object} value
 * @property {EnrichmentState} state
 * @property {string | null} applied_by
 * @property {string} created_at
 */

/**
 * The album-art entry this module writes on a version's metadata:
 * `metadata.album_art = { url, source: 'spotify', at: ISO }` plus the provider
 * track id when there was one. `url` is `string | undefined` because the
 * options argument defaults to `{}` (callers gate on a present url first).
 * @typedef {object} AlbumArtEntry
 * @property {string | undefined} url
 * @property {'spotify'} source
 * @property {string} at
 * @property {string | null} [trackId]
 */

/**
 * The lyrics entry this module writes on a version's metadata:
 * `metadata.lyrics = { text, source: 'lrclib', at: ISO }`. `text` is always a
 * string (the options value is coerced), even though the options argument
 * defaults to `{}`.
 * @typedef {object} LyricsEntry
 * @property {string} text
 * @property {'lrclib'} source
 * @property {string} at
 */

/**
 * One manual-edit provenance flag: `metadata.provenance.<key|bpm> = { source,
 * at }`, merged alongside the auto-filled entries.
 * @typedef {object} ProvenanceEntry
 * @property {string} source
 * @property {string} at
 */

/**
 * The song_versions.metadata jsonb as this module extends it — the
 * enrichment-owned entries plus whatever else already lives on the version row
 * (import lineage, format flags), which every merge below spreads through
 * untouched.
 * @typedef {object} VersionMetadata
 * @property {AlbumArtEntry} [album_art]
 * @property {LyricsEntry} [lyrics]
 * @property {Record<string, ProvenanceEntry>} [provenance]
 */

/**
 * The saveAlbumArt options: `url` is optional because the destructured
 * argument defaults to `{}`; `trackId` rides the provider track id when the
 * caller has one.
 * @typedef {object} AlbumArtInput
 * @property {string} [url]
 * @property {string | null} [trackId]
 */

/**
 * The saveLyrics options — the lyric block itself, coerced to a string below.
 * @typedef {object} LyricsInput
 * @property {string} [text]
 */

/**
 * The markManualProvenance flags: which field the user just edited by hand.
 * @typedef {object} ManualProvenanceInput
 * @property {boolean} [key]
 * @property {boolean} [bpm]
 */

const CONNECTION_PREFIX = 'cemurm:spotify:connection:'

// Lazy-imported Supabase client (same pattern as annotations.js/scaleCatalog:
// this module stays import-safe in node — every DB helper resolves it on use).
/** @type {typeof import('./supabase.js').supabase | null} */
let supabaseClient = null
/**
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('../supabase.js')).supabase
  return supabaseClient
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage mirror (guarded, best-effort — midi.js/overlay.js pattern)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} userId
 * @returns {SpotifyConnection | null}
 */
function loadConnectionMirror(userId) {
  if (typeof localStorage === 'undefined' || !userId) return null
  try {
    const raw = localStorage.getItem(`${CONNECTION_PREFIX}${userId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * @param {string} userId
 * @param {SpotifyConnection} row
 */
function saveConnectionMirror(userId, row) {
  if (typeof localStorage === 'undefined' || !userId) return
  try {
    localStorage.setItem(`${CONNECTION_PREFIX}${userId}`, JSON.stringify(row))
  } catch {
    // Storage is a convenience mirror, never critical — stay silent.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The user's Spotify connection row, or null. Offline-safe: the DB read is
 * the source of truth; a mirror fill-in only happens when the read FAILS
 * (network down) — a successful read that finds no row wins over a stale
 * mirror so a revoked/absent connection never comes back to life.
 * @param {string} userId
 * @returns {Promise<SpotifyConnection | null>}
 */
export async function getSpotifyConnection(userId) {
  const mirrored = loadConnectionMirror(userId)
  try {
    const { data, error } = await (await supabase())
      .from('external_connections')
      .select('id, user_id, provider, status, created_at')
      .eq('user_id', userId)
      .eq('provider', 'spotify')
      .maybeSingle()
    if (error) throw error
    if (data) saveConnectionMirror(userId, data)
    return data
  } catch {
    return mirrored
  }
}

/**
 * Upsert the connection row to 'connected' — the implicit connect on first
 * enrichment. Mirrors the row; throws only on a hard write failure.
 * @param {string} userId
 * @returns {Promise<SpotifyConnection>}
 */
export async function ensureSpotifyConnected(userId) {
  const { data, error } = await (await supabase())
    .from('external_connections')
    .upsert(
      { user_id: userId, provider: 'spotify', status: 'connected' },
      { onConflict: 'user_id,provider' },
    )
    .select('id, user_id, provider, status, created_at')
    .single()
  if (error) throw error
  saveConnectionMirror(userId, data)
  return data
}

/**
 * Revoke: UPDATE status='revoked' — the row persists and applied enrichment
 * metadata REMAINS on the songs (no delete of rows anywhere). The mirror is
 * updated so the offline Settings page renders Revoked.
 * @param {string} userId
 * @returns {Promise<SpotifyConnection | null>}
 */
export async function disconnectSpotify(userId) {
  const { data, error } = await (await supabase())
    .from('external_connections')
    .update({ status: 'revoked' })
    .eq('user_id', userId)
    .eq('provider', 'spotify')
    .select('id, user_id, provider, status, created_at')
    .maybeSingle()
  if (error) throw error
  saveConnectionMirror(userId, data || { user_id: userId, provider: 'spotify', status: 'revoked' })
  return data
}

/**
 * Connected check. `connection` (a fresh row) wins; falls back to the
 * localStorage mirror so the offline gate still says Connected/Revoked.
 * @param {SpotifyConnection | null} connection
 * @param {string} userId
 * @returns {boolean}
 */
export function isSpotifyConnected(connection, userId) {
  if (connection?.status) return connection.status === 'connected'
  return loadConnectionMirror(userId)?.status === 'connected'
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrichment rows (external_enrichments)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert the suggestion rows for one provider match, state='suggested',
 * applied_by = the enriching user. Source-agnostic: the source is the
 * provider's identifier (default 'spotify' — #69 byte-compatible), and the
 * rows derive from whatever persistable fields the match carries:
 *   spotify:     bpm / key (keyIndex+mode) / album_art
 *   musicbrainz: year / genre
 *   lrclib:      lyrics
 * Title/artist are NEVER persisted (the 0001 field enum has no title/artist —
 * they live in UI state only). Returns the created rows (empty when the match
 * carried no persistable fields).
 * @param {string} userId
 * @param {string} songId
 * @param {EnrichmentMatch} match
 * @param {EnrichmentSource} [source]
 * @returns {Promise<EnrichmentRow[]>}
 */
export async function suggestEnrichment(userId, songId, match, source = 'spotify') {
  /** @type {EnrichmentInsert[]} */
  const rows = []
  if (typeof match.bpm === 'number' && Number.isFinite(match.bpm)) {
    rows.push({
      song_id: songId,
      source,
      field: 'bpm',
      value: { bpm: match.bpm },
      state: 'suggested',
      applied_by: userId,
    })
  }
  const keyLabel = spotifyKeyToLabel(match.keyIndex, match.mode)
  if (keyLabel) {
    rows.push({
      song_id: songId,
      source,
      field: 'key',
      value: { key: keyLabel },
      state: 'suggested',
      applied_by: userId,
    })
  }
  if (match.albumArtUrl) {
    rows.push({
      song_id: songId,
      source,
      field: 'album_art',
      value: { album_art: { url: match.albumArtUrl, trackId: match.trackId || null } },
      state: 'suggested',
      applied_by: userId,
    })
  }
  if (typeof match.year === 'number' && Number.isFinite(match.year)) {
    rows.push({
      song_id: songId,
      source,
      field: 'year',
      value: { year: match.year },
      state: 'suggested',
      applied_by: userId,
    })
  }
  if (typeof match.genre === 'string' && match.genre.trim()) {
    rows.push({
      song_id: songId,
      source,
      field: 'genre',
      value: { genre: match.genre.trim() },
      state: 'suggested',
      applied_by: userId,
    })
  }
  if (typeof match.lyrics === 'string' && match.lyrics.trim()) {
    rows.push({
      song_id: songId,
      source,
      field: 'lyrics',
      value: { lyrics: match.lyrics },
      state: 'suggested',
      applied_by: userId,
    })
  }
  if (!rows.length) return []
  const { data, error } = await (await supabase())
    .from('external_enrichments')
    .insert(rows)
    .select()
  if (error) throw error
  return data || []
}

/**
 * Flip owned suggested rows to 'applied'. The CALLER persists the applied
 * values (BPM via updateSong with provenanceSource 'spotify'; album art via
 * the song_versions.metadata merge below). Key never writes base_key.
 * @param {string} userId
 * @param {string} songId
 * @param {EnrichmentRow[] | null | undefined} enrichmentRows
 * @returns {Promise<EnrichmentRow[]>}
 */
export async function applySuggestions(userId, songId, enrichmentRows) {
  const ids = (enrichmentRows || []).map((r) => r.id).filter(Boolean)
  if (!ids.length) return []
  const { data, error } = await (await supabase())
    .from('external_enrichments')
    .update({ state: 'applied' })
    .eq('song_id', songId)
    .in('id', ids)
    .eq('state', 'suggested')
    .select()
  if (error) throw error
  return data || []
}

/**
 * Flip owned rows to 'discarded' — the song itself stays untouched.
 * @param {string} userId
 * @param {string[] | null | undefined} ids
 * @returns {Promise<EnrichmentRow[]>}
 */
export async function discardSuggestions(userId, ids) {
  const clean = (ids || []).filter(Boolean)
  if (!clean.length) return []
  const { data, error } = await (await supabase())
    .from('external_enrichments')
    .update({ state: 'discarded' })
    .in('id', clean)
    .select()
  if (error) throw error
  return data || []
}

/**
 * All enrichment rows for a song (field-ordered, oldest first) — drives the
 * provenance display ("Auto-filled from Spotify"). RLS filters to the rows
 * this user may see (own action rows + applied rows on owned songs).
 * @param {string} userId
 * @param {string} songId
 * @returns {Promise<EnrichmentRow[]>}
 */
export async function listEnrichments(userId, songId) {
  const { data, error } = await (await supabase())
    .from('external_enrichments')
    .select('id, song_id, source, field, value, state, applied_by, created_at')
    .eq('song_id', songId)
    .order('field', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// ─────────────────────────────────────────────────────────────────────────────
// Applied-value persistence helpers (caller = the T3 apply flow)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merge album art + its provenance into song_versions.metadata:
 *   metadata.album_art = { url, source: 'spotify', at: ISO }
 * Preserves whatever else lives on the version row (existing provenance,
 * manual flags). The version row is owned by the caller (owner_id policy).
 * @param {string} versionId
 * @param {VersionMetadata | null | undefined} metadata
 * @param {AlbumArtInput} [options]
 * @returns {Promise<VersionMetadata & { album_art: AlbumArtEntry }>}
 */
export async function saveAlbumArt(versionId, metadata, { url, trackId = null } = {}) {
  /** @type {VersionMetadata & { album_art: AlbumArtEntry }} */
  const next = { ...(metadata || {}), album_art: { url, source: 'spotify', at: new Date().toISOString() } }
  if (trackId) next.album_art.trackId = trackId
  const { error } = await (await supabase())
    .from('song_versions')
    .update({ metadata: next })
    .eq('id', versionId)
  if (error) throw error
  return next
}

/**
 * Merge lyrics + their provenance into song_versions.metadata:
 *   metadata.lyrics = { text, source: 'lrclib', at: ISO }
 * Mirrors saveAlbumArt — preserves whatever else lives on the version row
 * (existing provenance, album art). The version row is owned by the caller
 * (owner_id policy).
 * @param {string} versionId
 * @param {VersionMetadata | null | undefined} metadata
 * @param {LyricsInput} [options]
 * @returns {Promise<VersionMetadata & { lyrics: LyricsEntry }>}
 */
export async function saveLyrics(versionId, metadata, { text } = {}) {
  /** @type {VersionMetadata & { lyrics: LyricsEntry }} */
  const next = {
    ...(metadata || {}),
    lyrics: { text: String(text || ''), source: 'lrclib', at: new Date().toISOString() },
  }
  const { error } = await (await supabase())
    .from('song_versions')
    .update({ metadata: next })
    .eq('id', versionId)
  if (error) throw error
  return next
}

/**
 * Mark manual provenance when the USER later edits key/bpm (scenario 9):
 * merges metadata.provenance = { key|bpm: { source:'manual', at } } alongside
 * existing auto-filled entries. Pure function — the caller persists it
 * through updateSong/version metadata (the songs.js editor path).
 * @param {VersionMetadata | null | undefined} metadata
 * @param {ManualProvenanceInput} [flags]
 * @returns {VersionMetadata & { provenance: Record<string, ProvenanceEntry> }}
 */
export function markManualProvenance(metadata, { key, bpm } = {}) {
  /** @type {VersionMetadata} */
  const next = { ...(metadata || {}) }
  /** @type {Record<string, ProvenanceEntry>} */
  const provenance = { ...(next.provenance || {}) }
  const at = new Date().toISOString()
  if (key) provenance.key = { source: 'manual', at }
  if (bpm) provenance.bpm = { source: 'manual', at }
  next.provenance = provenance
  // The cast states the invariant the assignment above establishes: provenance
  // is always written before the merged metadata is returned.
  return /** @type {VersionMetadata & { provenance: Record<string, ProvenanceEntry> }} */ (next)
}

// Self-check: node -e "import('./src/data/repositories/enrichments.js').then(m => m.demo())"
export async function demo() {
  /**
   * @param {unknown} actual
   * @param {unknown} expected
   * @param {string} label
   */
  const assert = (actual, expected, label) => {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
      throw new Error(`enrichments demo FAILED: ${label} — got ${a}, expected ${e}`)
    }
  }

  // Pure helpers only in node (no localStorage/supabase): provenance merge.
  const meta = markManualProvenance(
    { provenance: { bpm: { source: 'spotify', at: '2026-01-01T00:00:00.000Z' } } },
    { bpm: true },
  )
  assert(meta.provenance.bpm.source, 'manual', 'manual edit overwrites spotify bpm provenance')
  assert(meta.provenance.key, undefined, 'no key flag → key provenance untouched')
  const merged = markManualProvenance(meta, { key: true })
  assert(merged.provenance.key.source, 'manual', 'key provenance added on demand')

  console.log('enrichments demo: all asserts passed')
}