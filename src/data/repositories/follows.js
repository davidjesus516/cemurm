// @ts-check
// Supabase data layer for community follows (Hito 4 S4.2.4).
// Follow/unfollow writes go through the S4.2 SECURITY DEFINER RPCs (0013);
// the own-graph read (is-following state) hits the `follows` table directly
// under the participant-only RLS select policy (0013) — the same surface the
// T5 discovery feed query uses. Profile counts come from the aggregate
// RPC (followers/following BIGINTs; no row/identity exposure). Reads are
// read-through cached in IndexedDB exactly like publicLibrary.js / songs.js.
// Public surface: getProfileFollowCounts, getFollowState, followUser,
// unfollowUser, getDiscoveryFeed, invalidateFollowCaches.
// Scenario coverage: features/public-library-community.feature
// (Follow another musician / Follow and unfollow are reversible —
// the T5 discovery feed query also lives here).

import { supabase } from '../supabase.js'
import { offlineGet, offlineRemove, offlineSet } from '../../offline/cache.js'

/**
 * Aggregate follow counts (0013 RPC get_profile_follow_counts): the
 * followers/following BIGINTs resolved to numbers — the RPC never returns
 * follow rows, so there is no identity/edge-list exposure here.
 * @typedef {object} FollowCounts
 * @property {number} followers
 * @property {number} following
 */

/**
 * Row of the public_library_entries view (0010) as the T5 feed reads it
 * (select '*'): the public_songs catalog columns joined with the song's
 * title/artist/genre and the contributor's display_name. The view filters
 * to live entries, so status is always 'live'.
 * @typedef {object} LibraryEntry
 * @property {string} id
 * @property {string} song_id
 * @property {string} contributor_id
 * @property {string} license
 * @property {boolean} license_confirmed
 * @property {string} status
 * @property {string} updated_at
 * @property {string} title
 * @property {string | null} artist
 * @property {string | null} genre
 * @property {string | null} contributor_name
 */

// ponytail: known user-facing errors re-thrown as-is; network/PostgREST
// errors map to a safe generic message (same contract as publicLibrary.js).
const USER_ERRORS = new Set([
  'Authentication required.',
  'Cannot follow yourself.',
])

/**
 * @param {Error} error
 * @returns {never}
 */
function handleError(error) {
  const msg = error?.message || ''
  if (USER_ERRORS.has(msg)) throw error
  throw new Error('Something went wrong. Please try again.')
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withErrorMapping(fn) {
  try { return await fn() } catch (e) { handleError(/** @type {Error} */ (e)) }
}

// Same read-through contract as publicLibrary.js: every successful network
// read overwrites the cache and offline reads serve it unconditionally, so
// staleness self-heals on the next successful fetch.
/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withReadThrough(key, fn) {
  try {
    const data = await fn()
    await offlineSet(key, data)
    return data
  } catch (e) {
    if (USER_ERRORS.has(/** @type {Error} */ (e)?.message)) throw e
    const cached = await offlineGet(key)
    if (cached?.data) return cached.data
    throw e
  }
}

/**
 * Drop the follow caches a follow/unfollow mutation invalidates: the
 * (follower → followed) state row, the target profile's counts, and the
 * follower's discovery feed (T5 — a new follow must surface that
 * contributor's entries, an unfollow must hide them, scenarios 11/12).
 * Invalidate-before-refresh shape matches
 * publishSongToLibrary's offlineRemove('publicLibrary:entries').
 */
/**
 * @param {string} followerId
 * @param {string} followedId
 * @returns {Promise<void>}
 */
export async function invalidateFollowCaches(followerId, followedId) {
  await offlineRemove(`follows:state:${followerId}:${followedId}`)
  await offlineRemove(`follows:counts:${followedId}`)
  await offlineRemove(`follows:feed:${followerId}`)
}

/**
 * Aggregate follow counts for a profile (0013 RPC). Resolves
 * { followers, following } as numbers. Aggregates only — the RPC never
 * returns follow rows, so no identity/edge-list exposure for arbitrary users.
 */
/**
 * @param {string} userId
 * @returns {Promise<FollowCounts>}
 */
export function getProfileFollowCounts(userId) {
  return withErrorMapping(() => withReadThrough(`follows:counts:${userId}`, async () => {
    const { data, error } = await supabase.rpc('get_profile_follow_counts', {
      p_user_id: userId,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return {
      followers: Number(row?.followers) || 0,
      following: Number(row?.following) || 0,
    }
  }))
}

/**
 * Does `followerId` currently follow `followedId`? Reads the own row via the
 * participant-only RLS select policy (0013) — the same query shape the T5
 * discovery feed runs for the full own-graph. RLS zero-returns rows where
 * the caller is not a participant, so callers must pass the session user as
 * `followerId` (the hook does).
 */
/**
 * @param {string} followerId
 * @param {string} followedId
 * @returns {Promise<boolean>}
 */
export function getFollowState(followerId, followedId) {
  return withErrorMapping(() => withReadThrough(`follows:state:${followerId}:${followedId}`, async () => {
    const { data, error } = await supabase
      .from('follows')
      .select('created_at')
      .eq('follower_id', followerId)
      .eq('followed_id', followedId)
      .maybeSingle()
    if (error) throw error
    return Boolean(data)
  }))
}

/**
 * Follow another musician (scenario 11). Idempotent server-side (0013:
 * ON CONFLICT DO NOTHING); the RPC rejects anonymous sessions and
 * self-follow. The hook invalidates local caches after success.
 */
/**
 * @param {string} followedId
 * @returns {Promise<void>}
 */
export async function followUser(followedId) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('follow_user', { p_followed_id: followedId })
    if (error) throw error
  })
}

/**
 * Unfollow another musician (scenario 12, reversible). Idempotent:
 * unfollowing someone already unfollowed is a no-op server-side.
 */
/**
 * @param {string} followedId
 * @returns {Promise<void>}
 */
export async function unfollowUser(followedId) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('unfollow_user', { p_followed_id: followedId })
    if (error) throw error
  })
}

/**
 * T5 discovery feed (scenarios 11/12): live public entries by the musicians
 * the caller follows, newest first. Two-hop resolution reuses ONLY existing
 * read surfaces — no new RPC/migration:
 *   1. own follow rows (0013 participant RLS select where follower_id =
 *      auth.uid()) → followed contributor ids
 *   2. the open `public_library_entries` view (0010, live + withdrawn
 *      filtering already in the view) filtered on contributor_id, ordered
 *      updated_at desc per the feed contract.
 * The caller must pass the session user as `userId` (the hook does); RLS
 * zero-returns another caller's graph. Follows nobody → [] without a second
 * round trip. Feed cache is dropped by invalidateFollowCaches on any
 * follow/unfollow mutation.
 */
/**
 * @param {string} userId
 * @returns {Promise<LibraryEntry[]>}
 */
export function getDiscoveryFeed(userId) {
  return withErrorMapping(() => withReadThrough(`follows:feed:${userId}`, async () => {
    const { data: followRows, error: followsError } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', userId)
    if (followsError) throw followsError

    const followedIds = (followRows || []).map((row) => row.followed_id)
    if (followedIds.length === 0) return []

    const { data, error } = await supabase
      .from('public_library_entries')
      .select('*')
      .in('contributor_id', followedIds)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data || []
  }))
}
