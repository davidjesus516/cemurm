// Public library hook (Hito 4 S4.1 + S4.2).
// Owns catalog state + the copy-to-repertoire (S4.1) and contribution
// publish/withdraw (S4.2) actions. Search and license filtering stay
// client-side on the full catalog (mirrors Songs.jsx ponytail); the lib
// layer keeps the future server-side surface.

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import * as publicLibrary from '../../../data/repositories/publicLibrary.js'

export function usePublicLibrary() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [licenseFilter, setLicenseFilter] = useState('')
  const [pendingId, setPendingId] = useState(null)
  const [publishingSongId, setPublishingSongId] = useState(null)
  const [withdrawingEntryId, setWithdrawingEntryId] = useState(null)

  /**
   * Reload the catalog. `silent` keeps the current view mounted (no loading
   * flash) — used after a successful mutation, where the lib already dropped
   * the stale cache (S4.2 publish/withdraw).
   */
  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!user) return
    if (!silent) setLoading(true)
    try {
      const data = await publicLibrary.listPublicEntries()
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

  /**
   * Copy a public entry into this user's repertoire. Resolves the new
   * songs.id. Re-throws on failure so the page can decide how to surface
   * it; the hook records the error message as well.
   */
  async function addToRepertoire(publicSongId) {
    if (!user || pendingId) return null
    setPendingId(publicSongId)
    setError('')
    try {
      const songId = await publicLibrary.copyPublicSongToRepertoire(user.id, publicSongId)
      return songId
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setPendingId(null)
    }
  }

  /**
   * Publish one of the caller's songs as a public entry (S4.2 T2). Resolves
   * the new public_songs.id; re-throws on failure so the modal can surface it.
   * The RPC owns the license gate + ownership check (0012).
   */
  async function publishEntry(songId, license) {
    if (!user || publishingSongId) return null
    setPublishingSongId(songId)
    setError('')
    try {
      const entryId = await publicLibrary.publishSongToLibrary(songId, license)
      await refresh({ silent: true })
      return entryId
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setPublishingSongId(null)
    }
  }

  /**
   * Withdraw one of the caller's public entries (S4.2 T2). Owner-only in the
   * RPC; the catalog reload hides it (status → 'withdrawn').
   */
  async function withdrawEntry(publicSongId) {
    if (!user || withdrawingEntryId) return
    setWithdrawingEntryId(publicSongId)
    setError('')
    try {
      await publicLibrary.withdrawPublicSong(publicSongId)
      await refresh({ silent: true })
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setWithdrawingEntryId(null)
    }
  }

  return {
    entries,
    loading,
    error,
    refresh,
    search,
    setSearch,
    licenseFilter,
    setLicenseFilter,
    pendingId,
    addToRepertoire,
    userId: user?.id || null,
    publishingSongId,
    withdrawingEntryId,
    publishEntry,
    withdrawEntry,
  }
}