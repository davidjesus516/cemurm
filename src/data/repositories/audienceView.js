// @ts-check
// Audience view data layer (Hito 6 N3, T3).
//
// Two callers share this module and nothing else:
//   · the OWNER issues and revokes capability tokens — `create_audience_view`
//     is SECURITY INVOKER, so the 0049 policies do the authorization;
//   · the AUDIENCE reads through `get_audience_setlist`, which is SECURITY
//     DEFINER and answers NULL for unknown, expired and revoked tokens alike.
//
// A NULL payload is NOT an error. It is the honest answer to "this link does
// not work", and the page renders a dead-link state for it. Turning it into a
// thrown error would make a revoked link look like a network failure.
//
// The read path is cached read-through (offline/cache.js), the same contract
// `setlists.js` uses: the feature requires the audience view to open offline
// after the link was opened once while online.

import { offlineGet, offlineSet } from '../../offline/cache.js'
import { supabase } from '../supabase.js'

const ISSUE_ERROR = 'Could not create an audience link right now — please try again.'
const REVOKE_ERROR = 'Could not revoke the audience link right now — please try again.'
const LIST_ERROR = 'Could not load the audience links right now.'
const READ_ERROR = 'Could not load the shared setlist right now.'

/**
 * The envelope 0049 returns. Deliberately narrow: these are the only fields the
 * function discloses, and nothing else may be read out of it.
 * @typedef {object} AudienceEnvelope
 * @property {string} id
 * @property {string} name
 * @property {Array<{ position: number, title: string, artist: string | null,
 *   durationSeconds: number | null }>} songs
 */

/**
 * Issue a capability token for a setlist. The caller must own it, or be an
 * accepted collaborator with `can_edit` — the server enforces that; this module
 * only turns the refusal into the server's own message.
 * @param {string} setlistId
 * @param {number} [days] 1..90, 7 by default
 * @returns {Promise<string>} the token
 */
export async function createAudienceView(setlistId, days = 7) {
  const { data, error } = await supabase.rpc('create_audience_view', {
    p_setlist_id: setlistId,
    p_days: days,
  })

  if (error) {
    // The RPC raises a specific sentence for the two refusals a musician can
    // actually hit (not an editor, bad expiry). Keep it; it is more useful than
    // a generic failure and it leaks nothing about setlists they cannot see.
    const message = String(error.message || '')
    if (message.includes('Only the owner or an editing collaborator')) {
      throw new Error('Only the setlist owner or an editor can share it with an audience.')
    }
    if (message.includes('Audience link expiry must be between')) {
      throw new Error('An audience link can last between 1 and 90 days.')
    }
    throw new Error(ISSUE_ERROR)
  }

  if (typeof data !== 'string' || data.length === 0) throw new Error(ISSUE_ERROR)
  return data
}

/**
 * The links issued for a setlist. 0049's select policy is scoped to the
 * SETLIST, not to `created_by`: the owner sees every link issued for their
 * setlist, including one an editor minted. That is what makes the revocation
 * control reachable — without this query the owner could not see, re-copy or
 * revoke a link after a reload, and an editor's link would be invisible.
 * @typedef {object} AudienceLink
 * @property {string} id
 * @property {string} token
 * @property {string} expiresAt ISO timestamp from the database
 * @property {string} createdBy the issuer's user id
 * @property {string | null} issuedBy the issuer's display name, when readable
 * @property {boolean} expired true when the link is already dead
 */

/**
 * @param {string} setlistId
 * @returns {Promise<AudienceLink[]>} soonest-expiring first
 */
export async function listAudienceViews(setlistId) {
  const { data, error } = await supabase
    .from('audience_views')
    .select('id, token, expires_at, created_by')
    .eq('setlist_id', setlistId)
    // No `created_at` column exists on this table (0001:539), so expiry is the
    // only honest ordering: the link that dies first is the one worth acting on.
    .order('expires_at', { ascending: true })

  if (error) throw new Error(LIST_ERROR)

  const rows = data || []
  const issuerIds = [...new Set(rows.map((row) => row.created_by))]
  let byId = new Map()
  if (issuerIds.length) {
    // Same two-step as listCollaborators: one extra query instead of an embed,
    // because `profiles` is readable per-row and an embed would drop the link
    // row when the profile is not visible.
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', issuerIds)
    if (profilesError) throw new Error(LIST_ERROR)
    byId = new Map((profiles || []).map((profile) => [profile.id, profile]))
  }

  const now = Date.now()
  return rows.map((row) => {
    const profile = byId.get(row.created_by)
    return {
      id: row.id,
      token: row.token,
      expiresAt: row.expires_at,
      createdBy: row.created_by,
      issuedBy: profile?.display_name || profile?.username || null,
      expired: new Date(row.expires_at).getTime() <= now,
    }
  })
}

/**
 * Revoke a token. The owner-scoped DELETE policy makes this a no-op for anyone
 * else, so the caller cannot revoke a link they do not own.
 * @param {string} token
 * @returns {Promise<void>}
 */
export async function revokeAudienceView(token) {
  // `.select()` makes PostgREST return the deleted rows. Without it a DELETE
  // that RLS filtered to zero rows still answers 204, and the page would report
  // "revoked" for a link that is still live — the exact failure this control
  // exists to prevent.
  const { data, error } = await supabase
    .from('audience_views')
    .delete()
    .eq('token', token)
    .select('id')

  if (error) throw new Error(REVOKE_ERROR)
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('That audience link is already gone, or you cannot revoke it.')
  }

  // A revoked link must stop working offline too, or the cache would outlive
  // the revocation it was meant to obey.
  await offlineSet(`audience:${token}`, null)
}

/**
 * Read the audience view for a token. Returns `null` for a link that does not
 * work — unknown, malformed, expired or revoked, all indistinguishable by
 * design (0049). Falls back to the cached envelope when the network is gone.
 * @param {string} token
 * @returns {Promise<AudienceEnvelope | null>}
 */
export async function getAudienceSetlist(token) {
  if (typeof token !== 'string' || token.length === 0) return null

  const key = `audience:${token}`
  const { data, error } = await supabase.rpc('get_audience_setlist', { p_token: token })

  if (!error) {
    // `null` is a legitimate answer and is cached as such: it means the token
    // was already dead when we last asked, so offline must not resurrect it.
    await offlineSet(key, data ?? null)
    return data ?? null
  }

  // A dead token is not a network failure: the RPC returns null rather than
  // raising, so reaching here means the call itself failed. Serve the cache.
  const cached = await offlineGet(key)
  if (cached && 'data' in cached) return cached.data ?? null

  throw new Error(READ_ERROR)
}
