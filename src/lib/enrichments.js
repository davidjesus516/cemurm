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
//   state='suggested', source spotify); the state machine
//   (suggested → applied|discarded) runs through update, creator-only.
// - Applying values is the CALLER's job (the hook/T3): BPM rides the existing
//   updateSong path (provenance source passed explicitly), album art is merged
//   into song_versions.metadata, and the key stays a SUGGESTION only — it
//   never writes base_key (scenario 5).

import { spotifyKeyToLabel } from './spotify.js'

const CONNECTION_PREFIX = 'cemurm:spotify:connection:'

// Lazy-imported Supabase client (same pattern as annotations.js/scaleCatalog:
// this module stays import-safe in node — every DB helper resolves it on use).
let supabaseClient = null
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('./supabase.js')).supabase
  return supabaseClient
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage mirror (guarded, best-effort — midi.js/overlay.js pattern)
// ─────────────────────────────────────────────────────────────────────────────

function loadConnectionMirror(userId) {
  if (typeof localStorage === 'undefined' || !userId) return null
  try {
    const raw = localStorage.getItem(`${CONNECTION_PREFIX}${userId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

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
 */
export function isSpotifyConnected(connection, userId) {
  if (connection?.status) return connection.status === 'connected'
  return loadConnectionMirror(userId)?.status === 'connected'
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrichment rows (external_enrichments)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert the three suggestion rows (bpm / key / album_art) for one match,
 * state='suggested', applied_by = the enriching user. Returns the created
 * rows (empty when the match carried no persistable fields).
 */
export async function suggestEnrichment(userId, songId, match) {
  const rows = []
  if (typeof match.bpm === 'number' && Number.isFinite(match.bpm)) {
    rows.push({
      song_id: songId,
      source: 'spotify',
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
      source: 'spotify',
      field: 'key',
      value: { key: keyLabel },
      state: 'suggested',
      applied_by: userId,
    })
  }
  if (match.albumArtUrl) {
    rows.push({
      song_id: songId,
      source: 'spotify',
      field: 'album_art',
      value: { album_art: { url: match.albumArtUrl, trackId: match.trackId || null } },
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
 */
export async function saveAlbumArt(versionId, metadata, { url, trackId = null } = {}) {
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
 * Mark manual provenance when the USER later edits key/bpm (scenario 9):
 * merges metadata.provenance = { key|bpm: { source:'manual', at } } alongside
 * existing auto-filled entries. Pure function — the caller persists it
 * through updateSong/version metadata (the songs.js editor path).
 */
export function markManualProvenance(metadata, { key, bpm } = {}) {
  const next = { ...(metadata || {}) }
  const provenance = { ...(next.provenance || {}) }
  const at = new Date().toISOString()
  if (key) provenance.key = { source: 'manual', at }
  if (bpm) provenance.bpm = { source: 'manual', at }
  next.provenance = provenance
  return next
}

// Self-check: node -e "import('./src/lib/enrichments.js').then(m => m.demo())"
export async function demo() {
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