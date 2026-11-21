// @ts-check
// Pure personal-analytics aggregations for S3 (T6). No I/O, no imports from
// repositories: every caller passes already-read app shapes from the shared
// hooks (useSongs / useSetlists / useGigs), so these functions run bare-node in
// Vitest and never fetch. Each one returns only numbers/rows the caller can
// render; missing data yields an empty series, never a fabricated value.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Monday 00:00 UTC of the week containing `ms`. S3's growth chart is week-based
 * and must not depend on the viewer's timezone, so the bucket boundary is UTC.
 * @param {number} ms
 * @returns {number}
 */
function startOfWeekUTC(ms) {
  const d = new Date(ms)
  const sinceMonday = (d.getUTCDay() + 6) % 7
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday)
}

/**
 * "Times in Setlists" per song. A song appearing twice in one setlist counts
 * once for that setlist — the scenario asks how many setlists use it, not how
 * many slots it fills. Ties break by song id so charts are stable.
 * @param {{ id: string, itemIds: string[] }[]} setlists
 * @returns {{ songId: string, count: number }[]}
 */
export function mostUsedSongs(setlists) {
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const setlist of setlists || []) {
    for (const songId of new Set(setlist?.itemIds || [])) {
      if (!songId) continue
      counts.set(songId, (counts.get(songId) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([songId, count]) => ({ songId, count }))
    .sort((a, b) => b.count - a.count || a.songId.localeCompare(b.songId))
}

/**
 * Weekly song additions over the last `weeks` COMPLETE weeks (the current,
 * partial week is excluded), with a running cumulative count that includes
 * songs added before the window. The peak flag marks the single busiest week;
 * an all-empty window has no peak.
 * @param {{ createdAt: string }[]} songs
 * @param {string | Date} [now]
 * @param {number} [weeks]
 * @returns {{ weekStart: string, added: number, cumulative: number, peak: boolean }[]}
 */
export function repertoireGrowth(songs, now = new Date(), weeks = 8) {
  const currentWeek = startOfWeekUTC(new Date(now).getTime())
  const firstWeek = currentWeek - WEEK_MS * weeks
  /** @type {number[]} */
  const stamps = (songs || [])
    .map((s) => new Date(s?.createdAt).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)

  const existing = stamps.filter((t) => t < firstWeek).length
  const added = Array.from({ length: weeks }, (_, i) => {
    const start = firstWeek + i * WEEK_MS
    const end = start + WEEK_MS
    return stamps.filter((t) => t >= start && t < end).length
  })

  const max = Math.max(0, ...added)
  let running = existing
  return added.map((count, i) => {
    running += count
    return {
      weekStart: new Date(firstWeek + i * WEEK_MS).toISOString().slice(0, 10),
      added: count,
      cumulative: running,
      peak: max > 0 && count === max && added.indexOf(count) === i,
    }
  })
}

/**
 * Songs that never appeared on any setlist. Optional genre match is
 * case-insensitive; `olderThanMonths` keeps songs added before the cutoff.
 * Original song objects are preserved so callers can show title/date/genre.
 * @template {{ id: string, genre?: string | null, createdAt: string }} T
 * @param {T[]} songs
 * @param {{ itemIds: string[] }[]} setlists
 * @param {{ genre?: string, olderThanMonths?: number, now?: string | Date }} [filters]
 * @returns {T[]}
 */
export function untouchedSongs(songs, setlists, filters = {}) {
  const used = new Set((setlists || []).flatMap((s) => s?.itemIds || []))
  const genre = filters.genre?.trim().toLowerCase()
  const cutoff = filters.olderThanMonths
    ? new Date(filters.now ?? new Date()).getTime() - filters.olderThanMonths * 30 * 24 * 60 * 60 * 1000
    : null

  return (songs || []).filter((song) => {
    if (used.has(song.id)) return false
    if (genre && String(song.genre || '').toLowerCase() !== genre) return false
    if (cutoff !== null) {
      const created = new Date(song.createdAt).getTime()
      if (!Number.isFinite(created) || created >= cutoff) return false
    }
    return true
  })
}

/**
 * How many gigs actually PLAYED each song. Skipped / off-setlist items are
 * deliberately excluded — "demand" is a played song, not a planned one.
 * @param {{ items: { songId: string, state: string }[] }[]} performances
 * @returns {{ songId: string, count: number }[]}
 */
export function songPopularity(performances) {
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const performance of performances || []) {
    for (const item of performance?.items || []) {
      if (item?.state !== 'played' || !item.songId) continue
      counts.set(item.songId, (counts.get(item.songId) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([songId, count]) => ({ songId, count }))
    .sort((a, b) => b.count - a.count || a.songId.localeCompare(b.songId))
}

/**
 * Average SETLIST duration (seconds) per calendar month for the last `months`
 * months, including the current one. A setlist contributes only if at least one
 * of its songs has a known duration; empty months keep a zero point so the line
 * chart does not visually splice across a gap.
 * @param {{ createdAt: string, songs: { durationSeconds: number | null }[] }[]} setlists
 * @param {string | Date} [now]
 * @param {number} [months]
 * @returns {{ month: string, averageSeconds: number, sampleSize: number }[]}
 */
export function durationTrend(setlists, now = new Date(), months = 6) {
  const end = new Date(now)
  /** @type {Record<string, { total: number, count: number }>} */
  const byMonth = {}
  for (const setlist of setlists || []) {
    const created = new Date(setlist?.createdAt).getTime()
    if (!Number.isFinite(created)) continue
    const seconds = (setlist.songs || [])
      .map((s) => Number(s?.durationSeconds))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (seconds.length === 0) continue
    const month = new Date(created).toISOString().slice(0, 7)
    const bucket = byMonth[month] || (byMonth[month] = { total: 0, count: 0 })
    bucket.total += seconds.reduce((sum, n) => sum + n, 0)
    bucket.count += 1
  }

  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (months - 1 - i), 1))
    const month = d.toISOString().slice(0, 7)
    const bucket = byMonth[month]
    return {
      month,
      averageSeconds: bucket?.count ? Math.round(bucket.total / bucket.count) : 0,
      sampleSize: bucket?.count || 0,
    }
  })
}

/**
 * Performed gigs only (a `performance` is the record written by completeGig),
 * newest first, with the filters the timeline offers. Each row carries
 * `songCount` and `performedAt` for the card to render.
 * @template {{ id: string, orgId: string | null, venueId: string | null, venueType?: string | null, performance: { performedAt: string, items: unknown[] } | null }} G
 * @param {G[]} gigs
 * @param {{ orgId?: string, venueId?: string, venueType?: string, month?: string }} [filters]
 * @returns {(G & { performedAt: string, songCount: number })[]}
 */
export function performanceTimeline(gigs, filters = {}) {
  return (gigs || [])
    .filter((g) => g?.performance)
    .map((g) => ({
      ...g,
      performedAt: /** @type {NonNullable<G['performance']>} */ (g.performance).performedAt,
      songCount: /** @type {NonNullable<G['performance']>} */ (g.performance).items.length,
    }))
    .filter((g) => !filters.orgId || g.orgId === filters.orgId)
    .filter((g) => !filters.venueId || g.venueId === filters.venueId)
    // Venue type is joined from venues[].type by the caller, not stored on the
    // gig. An empty venueType means "this venue has no type": it stays in the
    // unfiltered timeline and matches no named type — never a silent drop.
    .filter((g) => !filters.venueType || g.venueType === filters.venueType)
    .filter((g) => !filters.month || g.performedAt.slice(0, 7) === filters.month)
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
}
