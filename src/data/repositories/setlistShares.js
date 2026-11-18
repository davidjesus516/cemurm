// Setlist share links data layer (0047).
//
// The SQL functions own the two rules that must not live in a client: the
// 7-day expiry and the grant. This module only adapts PostgREST rows into the
// camelCase shape the panel renders, and rethrows the server's own rejection
// message — "This share link is invalid or has expired." is deliberately one
// literal for unknown, revoked and expired, and rewriting it here would leak
// which case it was.

import { supabase } from '../supabase.js'

/**
 * @typedef {{
 *   id: string,
 *   token: string,
 *   permission: string,
 *   createdAt: string,
 *   expiresAt: string,
 *   revokedAt: string | null,
 * }} SetlistShareLink
 */

/** PostgREST returns a table function's rows as an array. */
function firstRow(data) {
  return Array.isArray(data) ? data[0] : data
}

/**
 * Owner only (the RPC re-checks it). The expiry is server-stamped.
 * @param {string} setlistId
 * @param {'view' | 'edit'} [permission]
 * @returns {Promise<{ token: string, permission: string, expiresAt: string }>}
 */
export async function createShareLink(setlistId, permission = 'view') {
  const { data, error } = await supabase.rpc('create_setlist_share_link', {
    p_setlist_id: setlistId,
    p_permission: permission,
  })
  if (error) throw error
  const row = firstRow(data)
  if (!row) throw new Error('Could not create the share link.')
  return {
    token: row.share_token,
    permission: row.share_permission,
    expiresAt: row.share_expires_at,
  }
}

/**
 * The owner's links for one setlist, newest first. RLS hides every other
 * caller's rows, so an empty list is also what a non-owner sees.
 * @param {string} setlistId
 * @returns {Promise<SetlistShareLink[]>}
 */
export async function listShareLinks(setlistId) {
  const { data, error } = await supabase
    .from('setlist_share_links')
    .select('id, token, permission, created_at, expires_at, revoked_at')
    .eq('setlist_id', setlistId)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data || []).map((row) => ({
    id: row.id,
    token: row.token,
    permission: row.permission,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  }))
}

/**
 * Revoke by deleting the capability row: the token stops resolving at once.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function revokeShareLink(id) {
  const { error } = await supabase.from('setlist_share_links').delete().eq('id', id)
  if (error) throw error
}

/**
 * Redeem a token as the signed-in user. The server inserts (or upgrades) the
 * collaborator row, so the caller only navigates to the setlist afterwards.
 * @param {string} token
 * @returns {Promise<{ setlistId: string, permission: string }>}
 */
export async function redeemShareLink(token) {
  const { data, error } = await supabase.rpc('redeem_setlist_share', { p_token: token })
  if (error) throw error
  const row = firstRow(data)
  if (!row) throw new Error('This share link is invalid or has expired.')
  return { setlistId: row.setlist_id, permission: row.permission }
}
