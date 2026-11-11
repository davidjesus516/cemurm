// Audience performance timeline — features/export-and-sharing.feature:137,
// "I see song titles and performance times in order".
//
// Pure and node-safe: the page owns rendering, this module owns the arithmetic.
// The payload from `get_audience_setlist` (0048) carries one duration per song
// and no start time, because a start time is a function of the rows before it
// and storing it would let the two disagree after a setlist edit.

/**
 * A song row exactly as 0048 returns it inside `songs`.
 * @typedef {object} AudienceSong
 * @property {number} [position]
 * @property {string} [title]
 * @property {string} [artist]
 * @property {number | null} [durationSeconds]
 */

/**
 * One rendered row: the song plus the running start time it begins at.
 * @typedef {object} AudienceRow
 * @property {number} position
 * @property {string} title
 * @property {string} artist
 * @property {number | null} durationSeconds
 * @property {number} startSeconds
 * @property {boolean} exact
 */

/**
 * A duration the timeline can add up: a finite, positive number. Anything else
 * (missing, zero, negative, a numeric string from an older envelope) is
 * unknown, and unknown is rendered as unknown rather than as zero.
 * @param {unknown} value
 * @returns {number | null}
 */
function knownDuration(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value
}

/**
 * Build the timeline.
 *
 * A row whose own duration is unknown still has an exact start time — nothing
 * before it is missing. What becomes unknowable is the start of every row AFTER
 * it, so `exact` turns false from that point on and never turns back. Callers
 * that render a time must honour `exact`; showing an invented time for a row
 * after a gap is worse than showing none.
 * @param {AudienceSong[]} [songs]
 * @returns {{ rows: AudienceRow[], totalSeconds: number, exact: boolean }}
 */
export function buildAudienceTimeline(songs = []) {
  const rows = []
  let cursor = 0
  let exact = true

  for (const song of Array.isArray(songs) ? songs : []) {
    const duration = knownDuration(song?.durationSeconds)
    rows.push({
      position: Number(song?.position) || rows.length + 1,
      title: String(song?.title || ''),
      artist: String(song?.artist || ''),
      durationSeconds: duration,
      startSeconds: cursor,
      exact,
    })

    if (duration === null) exact = false
    else cursor += duration
  }

  return { rows, totalSeconds: cursor, exact }
}

/**
 * Render an offset as m:ss, or h:mm:ss once it passes an hour. A row after a
 * duration gap has no honest offset, so `null`/negative renders as a dash.
 * @param {number | null | undefined} seconds
 * @returns {string}
 */
export function formatOffset(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '—'

  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${minutes}:${String(secs).padStart(2, '0')}`
}
