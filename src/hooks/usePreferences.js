import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import { DEFAULT_PREFS, getPreferences } from '../lib/preferences.js'

/**
 * Personal preferences hook (3.1, D2): lazy read-through — loads on first
 * mount (no eager global fetch), serves the kv copy offline, and falls back
 * to defaults. Read-only surface this slice: consumers read prefs, the hook
 * exposes no mutation (edit UI lands later).
 */
export function usePreferences() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setPrefs(await getPreferences(user.id))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { prefs, loading, refresh }
}