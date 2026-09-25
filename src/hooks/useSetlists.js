import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import * as setlistStore from '../lib/setlists.js'
import * as songs from '../lib/songs.js'
import { formatDuration } from '../lib/duration.js'

/**
 * Setlist state with enriched display data.
 * Each setlist gains `songs` (resolved song objects by itemIds order) and
 * `durationLabel` ("12:45" or "—" when no song duration is known).
 * Duration is joined client-side from the same songs list — no per-setlist
 * store round-trips, mirrors the future Supabase surface.
 */
export function useSetlists() {
  const { user } = useAuth()
  const [setlists, setSetlists] = useState([])
  const [allSongs, setAllSongs] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [data, songData] = await Promise.all([
        setlistStore.listSetlists(user.id),
        songs.listSongs(user.id),
      ])
      setAllSongs(songData)
      setSetlists(data)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Realtime refetch (2.4, R2): same reads as refresh() but without the
  // loading flip — a remote edit must appear in place, not flash the whole
  // detail page through its loading state. Failures keep the last good
  // state (the page is already showing data; a blip must not blank it).
  const refreshSilent = useCallback(async () => {
    if (!user) return
    try {
      const [data, songData] = await Promise.all([
        setlistStore.listSetlists(user.id),
        songs.listSongs(user.id),
      ])
      setAllSongs(songData)
      setSetlists(data)
    } catch {
      // keep the last good state; the next event or refresh() retries
    }
  }, [user])

  const enriched = useMemo(() => {
    const byId = new Map(allSongs.map((s) => [s.id, s]))
    return setlists.map((setlist) => {
      const songsInSetlist = setlist.itemIds
        .map((id) => byId.get(id))
        .filter(Boolean)
      const total = setlist.itemIds.reduce(
        (sum, id) => sum + (byId.get(id)?.durationSeconds || 0),
        0,
      )
      const hasKnownDuration = songsInSetlist.some((s) => s.durationSeconds)
      return {
        ...setlist,
        songs: songsInSetlist,
        durationLabel: hasKnownDuration ? formatDuration(total) : '—',
      }
    })
  }, [setlists, allSongs])

  async function createSetlist(name) {
    const created = await setlistStore.createSetlist(user.id, { name })
    setSetlists((prev) => [...prev, created])
    return created
  }

  async function deleteSetlist(id) {
    await setlistStore.deleteSetlist(user.id, id)
    setSetlists((prev) => prev.filter((s) => s.id !== id))
  }

  async function duplicateSetlist(id, name) {
    const copy = await setlistStore.duplicateSetlist(user.id, id, { name })
    setSetlists((prev) => [copy, ...prev])
    return copy
  }

  async function updateSetlist(id, payload) {
    const updated = await setlistStore.updateSetlist(user.id, id, payload)
    setSetlists((prev) => prev.map((s) => (s.id === id ? updated : s)))
    return updated
  }

  async function addSong(setlistId, songId) {
    const updated = await setlistStore.addSongToSetlist(user.id, setlistId, songId)
    setSetlists((prev) => prev.map((s) => (s.id === setlistId ? updated : s)))
    return updated
  }

  async function removeSong(setlistId, songId) {
    const updated = await setlistStore.removeSongFromSetlist(user.id, setlistId, songId)
    setSetlists((prev) => prev.map((s) => (s.id === setlistId ? updated : s)))
    return updated
  }

  async function moveSong(setlistId, fromIndex, toIndex) {
    const updated = await setlistStore.moveSongInSetlist(user.id, setlistId, fromIndex, toIndex)
    setSetlists((prev) => prev.map((s) => (s.id === setlistId ? updated : s)))
    return updated
  }

  async function setSongVersion(setlistId, songId, versionId) {
    const updated = await setlistStore.setSongVersion(user.id, setlistId, songId, versionId)
    setSetlists((prev) => prev.map((s) => (s.id === setlistId ? updated : s)))
    return updated
  }

  async function setMidiProgram(setlistId, songId, program) {
    const updated = await setlistStore.setMidiProgram(user.id, setlistId, songId, program)
    setSetlists((prev) => prev.map((s) => (s.id === setlistId ? updated : s)))
    return updated
  }

  async function getSetlist(id) {
    return setlistStore.getSetlist(user.id, id)
  }

  return {
    setlists: enriched,
    loading,
    refresh,
    refreshSilent,
    createSetlist,
    deleteSetlist,
    duplicateSetlist,
    updateSetlist,
    addSong,
    removeSong,
    moveSong,
    setSongVersion,
    setMidiProgram,
    getSetlist,
  }
}