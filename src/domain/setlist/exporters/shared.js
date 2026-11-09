// Shared setlist-export helpers: setlist order and agreed-key resolution.
//
// Both rules already existed inside the OnSong exporter; they live here so the
// ChordPro, ABC and plain-text exporters cannot drift into a fourth spelling
// of "which key does this item actually play in".
//
// Agreed key precedence: the setlist item's agreed key (the key the band
// settled on, which is NOT the chart's own) → the pinned version's base key →
// the song's current key.

/**
 * @typedef {{
 *   itemIds?: unknown,
 *   versionIds?: Record<string, string>,
 *   agreedKeys?: Record<string, string>,
 *   itemNotes?: Record<string, string>,
 *   name?: unknown,
 *   [key: string]: unknown,
 * }} ExportSetlist
 */

/**
 * @typedef {{ id: string, key?: string | null }} ExportSongVersion
 */

/**
 * @typedef {{
 *   id: string,
 *   title?: string | null,
 *   artist?: string | null,
 *   key?: string | null,
 *   body?: string | null,
 *   format?: string | null,
 *   durationSeconds?: number | null,
 *   versions?: ExportSongVersion[] | unknown,
 *   [key: string]: unknown,
 * }} ExportSong
 */

/**
 * The setlist's songs in setlist order. A song missing from the library is
 * skipped — the setlist UI already renders it as "(missing song)".
 * @param {ExportSetlist | null | undefined} setlist
 * @param {ExportSong[] | null | undefined} songs
 * @returns {Array<{ song: ExportSong, songId: string }>}
 */
export function orderedSongs(setlist, songs) {
  const itemIds = Array.isArray(setlist?.itemIds) ? setlist.itemIds : []
  const byId = new Map((songs || []).map((song) => [song.id, song]))

  const rows = []
  for (const songId of itemIds) {
    const song = byId.get(songId)
    if (song) rows.push({ song, songId })
  }
  return rows
}

/**
 * The key this setlist item performs in.
 * @param {ExportSetlist | null | undefined} setlist
 * @param {ExportSong} song
 * @returns {string}
 */
export function resolveKey(setlist, song) {
  const agreed = setlist?.agreedKeys?.[song.id]
  if (agreed) return agreed

  const versionId = setlist?.versionIds?.[song.id]
  if (versionId && Array.isArray(song.versions)) {
    const selected = song.versions.find((version) => version.id === versionId)
    if (selected?.key) return String(selected.key)
  }

  return String(song.key || '')
}

/**
 * Filesystem-safe slug that keeps the author's casing, because the scenarios
 * name the artifact "Sunday-Worship-setlist.chordpro".
 * @param {unknown} value
 * @returns {string}
 */
export function slugify(value) {
  const clean = String(value ?? '')
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return clean || 'untitled'
}
