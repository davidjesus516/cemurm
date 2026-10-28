// Discovery feed hook (Hito 4 S4.2.5).
// Loads the live public entries contributed by the musicians I follow —
// getDiscoveryFeed() resolves my own follow rows (0013 participant RLS) and
// filters the 0010 public_library_entries view by those contributors, newest
// first. Read-through cached; follow/unfollow mutations drop the feed cache
// via invalidateFollowCaches so the tab reflects the graph immediately.
// Scenario coverage: features/public-library-community.feature
// (Follow another musician + Follow and unfollow are reversible).

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import * as follows from '../../../data/repositories/follows.js'

export function useDiscoveryFeed() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /**
   * Reload the feed. `silent` keeps the current view mounted (no loading
   * flash) — same shape as usePublicLibrary.refresh.
   */
  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!user) return
    if (!silent) setLoading(true)
    try {
      const data = await follows.getDiscoveryFeed(user.id)
      setEntries(data)
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { entries, loading, error, refresh }
}