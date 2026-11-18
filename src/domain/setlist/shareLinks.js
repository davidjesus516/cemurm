// Share-link helpers shared by the panel and the redeem page.
//
// The server owns the two facts that matter — the 7-day expiry and the grant —
// and this module only reads them back: a state derived from the timestamps the
// row already carries, and the URL the copied string points at. Keeping it pure
// means the panel's labels are asserted in the node tier instead of being
// trusted because they rendered once.

/**
 * The lifetime the database stamps on every link
 * (supabase/migrations/0047_setlist_share_links.sql). Mirrored here for the
 * copy, never sent: the client does not get to choose expires_at.
 */
export const SHARE_LINK_TTL_DAYS = 7

/**
 * @typedef {{
 *   id?: string,
 *   token: string,
 *   permission?: string,
 *   expiresAt?: string | null,
 *   revokedAt?: string | null,
 * }} ShareLink
 */

/**
 * Absolute URL a recipient opens. `/share/setlists/:token` is the redeem route;
 * it grants nothing until the redeem call runs server-side.
 * @param {unknown} token
 * @param {string} [origin]
 * @returns {string}
 */
export function shareLinkUrl(token, origin = '') {
  const base = String(origin || '').replace(/\/+$/, '')
  return `${base}/share/setlists/${encodeURIComponent(String(token ?? ''))}`
}

/**
 * 'revoked' | 'expired' | 'active'. A revoked link wins over an expired one:
 * the owner's action is the reason it stopped working.
 * @param {{ expiresAt?: string | null, revokedAt?: string | null } | null | undefined} link
 * @param {number} [now] epoch milliseconds, injectable for the tests
 * @returns {'revoked' | 'expired' | 'active'}
 */
export function shareLinkState(link, now = Date.now()) {
  if (!link) return 'expired'
  if (link.revokedAt) return 'revoked'
  const expires = Date.parse(String(link.expiresAt || ''))
  if (Number.isNaN(expires)) return 'expired'
  return expires <= now ? 'expired' : 'active'
}

/**
 * Whole days left, rounded up, minimum 1 for a link that is still active
 * (so "expires in 0 days" never renders). Null when the link is not active.
 * @param {{ expiresAt?: string | null, revokedAt?: string | null } | null | undefined} link
 * @param {number} [now]
 * @returns {number | null}
 */
export function shareLinkDaysLeft(link, now = Date.now()) {
  if (shareLinkState(link, now) !== 'active') return null
  const ms = Date.parse(String(link.expiresAt || '')) - now
  return Math.max(1, Math.ceil(ms / 86400000))
}
