// Pure helpers for the account-erasure UI (WU4).
//
// The card owns React state; the decisions that can be made wrong without a
// render — which status a request row means, and how a scheduled timestamp is
// presented — live here so they are testable in the node Vitest environment.

/**
 * The UI status a live erasure-request row represents.
 *
 * A row that exists but is already cancelled or completed is not "scheduled":
 * the card treats it as no request at all, because nothing is pending.
 * @param {Record<string, unknown> | null | undefined} request
 * @returns {'scheduled' | 'idle'}
 */
export function erasureStatus(request) {
  if (!request) return 'idle'
  if (request.cancelled_at || request.completed_at) return 'idle'
  return 'scheduled'
}

/**
 * Format a scheduled-for timestamp for the settings surface.
 *
 * Falls back to the raw string when the value is missing or unparseable, so a
 * malformed server value is still shown rather than rendering "Invalid Date".
 * @param {unknown} value
 * @returns {string}
 */
export function formatScheduledFor(value) {
  if (!value) return ''
  const date = new Date(/** @type {string} */ (value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}
