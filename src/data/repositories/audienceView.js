// @ts-check
// Audience view data layer (Hito 6 N3, T3).
//
// Two callers share this module and nothing else:
//   · the OWNER issues and revokes capability tokens — `create_audience_view`
//     is SECURITY INVOKER, so the 0048 policies do the authorization;
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
const READ_ERROR = 'Could not load the shared setlist right now.'

/**
 * The envelope 0048 returns. Deliberately narrow: these are the only fields the
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
 * Revoke a token. The owner-scoped DELETE policy makes this a no-op for anyone
 * else, so the caller cannot revoke a link they do not own.
 * @param {string} token
 * @returns {Promise<void>}
 */
export async function revokeAudienceView(token) {
  const { error } = await supabase.from('audience_views').delete().eq('token', token)
  if (error) throw new Error(REVOKE_ERROR)

  // A revoked link must stop working offline too, or the cache would outlive
  // the revocation it was meant to obey.
  await offlineSet(`audience:${token}`, null)
}

/**
 * Read the audience view for a token. Returns `null` for a link that does not
 * work — unknown, malformed, expired or revoked, all indistinguishable by
 * design (0048). Falls back to the cached envelope when the network is gone.
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
