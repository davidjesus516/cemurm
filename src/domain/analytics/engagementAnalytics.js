// @ts-check
// Pure engagement/offline counters for S3 (T8). Only the values with a real
// local source are computed here: the IDB outbox depth and the size of the
// library read through the offline cache. Session duration, daily-activity
// heatmap, export-history frequencies and audience scan counts have no backing
// table/key in this build; the page says "Not tracked yet" for those instead
// of manufacturing numbers.

/**
 * Normalize the two counters the app can honestly read into non-negative
 * integers, so a malformed cache payload can never render as a fake statistic.
 * @param {{ pendingWrites?: number, songsInLibrary?: number }} [input]
 * @returns {{ pendingWrites: number, songsInLibrary: number }}
 */
export function offlineSnapshot(input = {}) {
  /** @param {unknown} value */
  const count = (value) => Math.max(0, Math.floor(Number(value) || 0))
  return {
    pendingWrites: count(input.pendingWrites),
    songsInLibrary: count(input.songsInLibrary),
  }
}
