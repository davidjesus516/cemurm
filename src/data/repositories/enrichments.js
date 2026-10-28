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
 * Local mirror of src/integrations/spotify.js's spotifyKeyToLabel. Deliberately
 * NOT imported as a type: that module is untyped on this branch (it is
 * annotated in the sibling integrations slice, PR #251), so an imported
 * typedef would silently degrade to `any` and the call below would be checked
 * against nothing. Same reason importQueue.js (S05) mirrors the OnSong parser
 * instead of importing it. What the code actually does:
 * - keyIndex is deliberately tolerant: `Number(keyIndex)` means the numeric
 *   string '4' labels 'E major', while NaN ('abc', 4.7, NaN) misses the table
 *   and the `if (!note) return ''` guard swallows it (spotify.js:180-181).
 * - mode is compared ONLY against the exact string 'minor' (spotify.js:182), so
 *   'Minor', 1, 0, '', null and true all render as major — hence `unknown`.
 * Pinned by the characterization test in src/integrations/spotify.test.js.
 * @typedef {(keyIndex: number | string | null | undefined, mode: unknown) => string} SpotifyKeyToLabel
 */

/**
 * The user's external_connections row (0026:29-36), as the three selects below
 * project it. provider/status are plain text columns whose declared vocabulary
 * is the inline comment on 0026:32-33; this module only ever writes 'spotify'.
 * @typedef {object} ConnectionRow
 * @property {string} id
 * @property {string} user_id
 * @property {'spotify'} provider
 * @property {'connected' | 'revoked'} status
 * @property {string} created_at
 */

/**
 * What this module actually hands around as a connection: the fresh row when
 * the DB read wins, or the offline mirror (and the inline revoke fallback
 * disconnectSpotify builds when the UPDATE matched nothing) which carries no
 * server-owned id/created_at. Settings.jsx widens it the same way
 * (`row || { status: 'revoked' }`).
 * @typedef {Partial<ConnectionRow> & { user_id: string, provider: 'spotify', status: 'connected' | 'revoked' }} ConnectionSnapshot
 */

/**
 * external_enrichments.source — the 0001:146 vocabulary, kept verbatim by 0028
 * (which only widened the INSERT whitelist, 0028:116-124, no DDL).
 * @typedef {'spotify' | 'musicbrainz' | 'lrclib'} EnrichmentSource
 */

/**
 * external_enrichments.field — the 0001:147 vocabulary. Title/artist are NOT
 * here: they live in UI state only.
 * @typedef {'bpm' | 'key' | 'album_art' | 'lyrics' | 'genre' | 'year'} EnrichmentField
 */

/**
 * The jsonb payload (external_enrichments.value, 0001:148 NOT NULL) each field
 * carries — one key, the persistable value of that field.
 * @typedef {{ bpm: number } | { key: string } | { album_art: { url: string, trackId: string | null } } | { year: number } | { genre: string } | { lyrics: string }} EnrichmentValue
 */

/**
 * A staged insert: the four declared columns plus the two the 0026 insert
 * policy demands (applied_by = auth.uid(), state = 'suggested', 0026:78-86).
 * @typedef {object} EnrichmentInsert
 * @property {string} song_id
 * @property {EnrichmentSource} source
 * @property {EnrichmentField} field
 * @property {EnrichmentValue} value
 * @property {'suggested'} state
 * @property {string} applied_by
 */

/**
 * A stored row, as listEnrichments projects it (the 0001:143-152 columns;
 * applied_by is a plain nullable reference — 0001:150 carries no NOT NULL).
 * @typedef {object} EnrichmentRow
 * @property {string} id
 * @property {string} song_id
 * @property {EnrichmentSource} source
 * @property {EnrichmentField} field
 * @property {EnrichmentValue} value
 * @property {'suggested' | 'applied' | 'discarded'} state
 * @property {string | null} applied_by
 * @property {string} created_at
 */

/**
 * The provider match handed to suggestEnrichment. Every field is optional
 * because the three providers carry different subsets: spotify supplies
 * bpm/keyIndex/mode/albumArtUrl/trackId, musicbrainz year/genre, lrclib lyrics
 * (Songs.jsx calls it with year/genre only). keyIndex is the raw Spotify index
 * (0 = C); the label is derived, never stored as written.
 * @typedef {object} EnrichmentMatch
 * @property {number | null} [bpm]
 * @property {number | null} [keyIndex]
 * @property {'major' | 'minor'} [mode]
 * @property {string | null} [albumArtUrl]
 * @property {string | null} [trackId]
 * @property {number | null} [year]
 * @property {string} [genre]
 * @property {string} [lyrics]
 */

/**
 * song_versions.metadata (0001:112, jsonb NOT NULL DEFAULT '{}') as the
 * enrichment helpers write it. The index signature is load-bearing: the same
 * column also carries the import pipeline's metadata.import / metadata.conflict
 * (0028) and whatever else a caller already stored — these helpers MERGE, they
 * never replace (songs.js owns the equivalent cast at updateSong).
 * @typedef {object} VersionMetadata
 * @property {{ url?: string, source: string, at: string, trackId?: string | null }} [album_art]
 * @property {{ text: string, source: string, at: string }} [lyrics]
 * @property {Record<string, ProvenanceEntry>} [provenance]
 * @property {unknown} [import]
 * @property {unknown} [conflict]
 */

/**
 * A provenance entry: which path wrote a declared value and when. The same
 * shape songs.js records for key/bpm/artist/genre/year.
 * @typedef {{ source: string, at: string }} ProvenanceEntry
 */

/**
 * markManualProvenance's return: provenance is assigned unconditionally before
 * the return, so the key is always present even when neither flag was passed.
 * @typedef {VersionMetadata & { provenance: Record<string, ProvenanceEntry> }} VersionMetadataWithProvenance
 */

const CONNECTION_PREFIX = 'cemurm:spotify:connection:'

// Lazy-imported Supabase client (same pattern as annotations.js/scaleCatalog:
// this module stays import-safe in node — every DB helper resolves it on use).
/** @type {typeof import('../supabase.js').supabase | null} */
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
 * @param {string | null} userId
 * @returns {ConnectionSnapshot | null}
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
 * @param {string | null} userId
 * @param {ConnectionSnapshot} row
 * @returns {void}
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
 * @returns {Promise<ConnectionSnapshot | null>}
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
 * @returns {Promise<ConnectionSnapshot>}
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
 * updated so the offline Settings page renders Revoked. Resolves null when no
 * row existed — Settings.jsx then falls back to { status: 'revoked' }.
 * @param {string} userId
 * @returns {Promise<ConnectionSnapshot | null>}
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
 * @param {ConnectionSnapshot | null | undefined} connection
 * @param {string | null} userId
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
 * @param {EnrichmentSource} source
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
  const keyLabel = /** @type {SpotifyKeyToLabel} */ (spotifyKeyToLabel)(match.keyIndex, match.mode)
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
 * @param {EnrichmentRow[] | null} enrichmentRows
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

/** Flip owned rows to 'discarded' — the song itself stays untouched. */
/**
 * @param {string} userId
 * @param {string[] | null} ids
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
 * @param {VersionMetadata | null} metadata
 * @param {{ url?: string, trackId?: string | null }} [art]
 * @returns {Promise<VersionMetadata>}
 */
export async function saveAlbumArt(versionId, metadata, { url, trackId = null } = {}) {
  /** @type {VersionMetadata & { album_art: { url?: string, source: string, at: string, trackId?: string | null } }} */
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
 * @param {VersionMetadata | null} metadata
 * @param {{ text?: string }} [lyric]
 * @returns {Promise<VersionMetadata>}
 */
export async function saveLyrics(versionId, metadata, { text } = {}) {
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
 * @param {VersionMetadata | null} metadata
 * @param {{ key?: boolean, bpm?: boolean }} [flags]
 * @returns {VersionMetadataWithProvenance}
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
  return /** @type {VersionMetadataWithProvenance} */ (next)
}

// Self-check: node -e "import('./src/data/repositories/enrichments.js').then(m => m.demo())"
export async function demo() {
  /**
   * @param {unknown} actual
   * @param {unknown} expected
   * @param {string} label
   * @returns {void}
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