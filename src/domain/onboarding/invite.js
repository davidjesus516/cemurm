// @ts-check
// Pure invite-code rules shared by the UI and mirrored by the 0050 RPC.
// The SQL owns the authoritative check (it locks the row FOR UPDATE); this
// module exists so the client can validate shape before a round trip and so
// the "one generic error, never a code oracle" rule has a node-level test.

export const DEFAULT_INVITE_EXPIRY_DAYS = 7
export const ORG_INVITE_KIND = 'org_invite'

// Deliberately identical to the SQL RAISE EXCEPTION text: missing, expired,
// used and wrong-kind codes must be indistinguishable to the joiner.
export const INVITE_ERROR = 'This invite code is invalid or has expired.'

/**
 * @param {unknown} input
 * @returns {string}
 */
export function normalizeInviteCode(input) {
  return typeof input === 'string' ? input.trim().toUpperCase() : ''
}

/**
 * @param {number} [days]
 * @param {number} [nowMs]
 * @returns {string}
 */
export function inviteExpiryISO(days = DEFAULT_INVITE_EXPIRY_DAYS, nowMs = Date.now()) {
  const safeDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_INVITE_EXPIRY_DAYS
  return new Date(nowMs + safeDays * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * @typedef {object} InviteRow
 * @property {string} kind
 * @property {string | null} org_id
 * @property {string} role
 * @property {string | null} used_at
 * @property {string} expires_at
 */

/**
 * @param {InviteRow | null | undefined} row
 * @param {number} [nowMs]
 * @returns {{ ok: true, orgId: string, role: string } | { ok: false, error: string }}
 */
export function validateInviteState(row, nowMs = Date.now()) {
  const invalid = /** @type {{ ok: false, error: string }} */ ({ ok: false, error: INVITE_ERROR })
  if (!row || row.kind !== ORG_INVITE_KIND || !row.org_id) return invalid
  if (row.used_at) return invalid
  const expires = Date.parse(row.expires_at)
  if (!Number.isFinite(expires) || expires <= nowMs) return invalid
  return { ok: true, orgId: row.org_id, role: row.role }
}
