// @ts-check
// Pure repertoire-insight aggregations for S3 (T7). Callers pass songs already
// read through useSongs (RLS-scoped to the signed-in user); no network here.
// "Trending across the org" is necessarily limited to the rows this user can
// read — the UI labels that scope explicitly instead of claiming org-wide data.

/**
 * Count labels and turn them into percentages of the whole. Empty strings map
 * to "Unknown" so a song with no genre/key still appears in the breakdown.
 * Ties break alphabetically for a stable render order.
 * @param {(string | null | undefined)[]} values
 * @returns {{ label: string, count: number, percent: number }[]}
 */
export function distributionBy(values) {
  const list = (values || []).map((v) => String(v ?? '').trim() || 'Unknown')
  if (list.length === 0) return []

  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const label of list) counts.set(label, (counts.get(label) || 0) + 1)

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, percent: Math.round((count / list.length) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/**
 * The `limit` most recently added songs, newest first. Rows with an unparseable
 * date sort last and are still returned when the list is shorter than `limit`.
 * @template {{ id: string, createdAt: string }} T
 * @param {T[]} songs
 * @param {number} [limit]
 * @returns {T[]}
 */
export function recentAdditions(songs, limit = 10) {
  return (songs || [])
    .slice()
    .sort((a, b) => {
      const ta = new Date(a?.createdAt).getTime()
      const tb = new Date(b?.createdAt).getTime()
      const aValid = Number.isFinite(ta)
      const bValid = Number.isFinite(tb)
      if (!aValid || !bValid) return aValid === bValid ? 0 : (aValid ? -1 : 1)
      return tb - ta
    })
    .slice(0, limit)
}

/**
 * Most-added song titles since `since`, with the distinct branches that added
 * each one. Titles are grouped case-insensitively; the first row's id is kept
 * only so the UI can link somewhere meaningful, not as a canonical identity.
 * @template {{ id: string, title: string, branchId: string | null, createdAt: string }} T
 * @param {T[]} songs
 * @param {{ since: string, limit?: number }} options
 * @returns {{ songId: string, title: string, count: number, branches: string[] }[]}
 */
export function trendingSongs(songs, { since, limit = 10 }) {
  const cutoff = new Date(since).getTime()
  /** @type {Map<string, { songId: string, title: string, count: number, branches: Set<string> }>} */
  const byTitle = new Map()

  for (const song of songs || []) {
    const added = new Date(song?.createdAt).getTime()
    if (!Number.isFinite(cutoff) || !Number.isFinite(added) || added < cutoff) continue
    const key = String(song.title || '').trim().toLowerCase()
    if (!key) continue
    const branch = song.branchId || 'Unassigned'
    const entry = byTitle.get(key) || {
      songId: song.id,
      title: song.title,
      count: 0,
      branches: new Set(),
    }
    entry.count += 1
    entry.branches.add(branch)
    byTitle.set(key, entry)
  }

  return [...byTitle.values()]
    .map((e) => ({ songId: e.songId, title: e.title, count: e.count, branches: [...e.branches].sort() }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, limit)
}

/**
 * Whether a song carries a usable `createdAt` value. Songs without one can be
 * shown in an all-dates breakdown but cannot be placed in a named date range;
 * the UI uses this count to say so instead of silently dropping them.
 * @param {{ createdAt?: string | null }} song
 * @returns {boolean}
 */
export function hasUsableCreatedAt(song) {
  return typeof song?.createdAt === 'string' && song.createdAt.trim().length > 0
}

/**
 * Filter songs by an inclusive `from`/`to` day range on `createdAt`. Both bounds
 * are optional and compared on the YYYY-MM-DD portion of the ISO timestamp, so
 * a `to` of 2026-06-30 includes the whole of that day. With no bounds the full
 * list is returned unchanged — an undated song is kept, never silently dropped.
 * With a bound set, an undated song cannot be placed and is excluded honestly.
 * @template {{ createdAt?: string | null }} T
 * @param {T[]} songs
 * @param {{ from?: string, to?: string }} [range]
 * @returns {T[]}
 */
export function songsInDateRange(songs, range = {}) {
  const from = String(range?.from || '')
  const to = String(range?.to || '')
  if (!from && !to) return (songs || []).slice()

  return (songs || []).filter((song) => {
    if (!hasUsableCreatedAt(song)) return false
    const day = String(song.createdAt).slice(0, 10)
    if (from && day < from) return false
    if (to && day > to) return false
    return true
  })
}
