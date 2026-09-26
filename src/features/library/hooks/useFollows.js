// Follows hook (Hito 4 S4.2.4).
// Owns the profile's follow state + aggregate counts and the follow/unfollow
// actions. Counts load for the profile's user (aggregate RPC, 0013); the
// follow state loads for the current user only (own-graph read via the
// participant RLS policy). Mutations invalidate the local caches, then
// refresh silently — same shape as usePublicLibrary.

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import * as follows from '../../../data/repositories/follows.js'

export function useFollows(userId) {
  const { user } = useAuth()
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!userId) return
    if (!silent) setLoading(true)
    try {
      const counts = await follows.getProfileFollowCounts(userId)
      setFollowers(counts.followers)
      setFollowing(counts.following)
      setError('')
      if (user) {
        setIsFollowing(await follows.getFollowState(user.id, userId))
      }
    } catch (e) {
      setError(e.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [userId, user])

  useEffect(() => {
    refresh()
  }, [refresh])

  /**
   * Shared follow/unfollow runner: one in-flight mutation at a time,
   * invalidate-then-silent-refresh after success, re-throws so the page can
   * surface errors (the hook records them too).
   */
  async function mutate(action) {
    if (!user || pending) return
    setPending(true)
    setError('')
    try {
      await action()
      await follows.invalidateFollowCaches(user.id, userId)
      await refresh({ silent: true })
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setPending(false)
    }
  }

  function follow() {
    return mutate(() => follows.followUser(userId))
  }

  function unfollow() {
    return mutate(() => follows.unfollowUser(userId))
  }

  return {
    isFollowing,
    followers,
    following,
    loading,
    error,
    pending,
    follow,
    unfollow,
    // Follow button visibility contract: a session exists and the profile
    // being viewed is not the viewer's own (own profile = "You", no button).
    canFollow: Boolean(user) && user.id !== userId,
  }
}