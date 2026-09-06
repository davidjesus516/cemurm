import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import * as songs from '../lib/songs.js'

export function useSongs({ retired = false } = {}) {
  const { user } = useAuth()
  const [songsList, setSongsList] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await songs.listSongs(user.id, retired ? { retired: true } : {})
      setSongsList(data)
    } finally {
      setLoading(false)
    }
  }, [user, retired])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function addSong(payload) {
    const created = await songs.addSong(user.id, payload)
    setSongsList((prev) => [...prev, created])
    return created
  }

  async function updateSong(id, payload) {
    const updated = await songs.updateSong(user.id, id, payload)
    setSongsList((prev) => prev.map((s) => (s.id === id ? updated : s)))
    return updated
  }

  async function deleteSong(id) {
    await songs.deleteSong(user.id, id)
    setSongsList((prev) => prev.filter((s) => s.id !== id))
  }

  async function retireSong(id) {
    const retired = await songs.retireSong(user.id, id)
    setSongsList((prev) => prev.map((s) => (s.id === id ? retired : s)))
    return retired
  }

  async function reactivateSong(id) {
    const reactivated = await songs.reactivateSong(user.id, id)
    setSongsList((prev) => prev.map((s) => (s.id === id ? reactivated : s)))
    return reactivated
  }

  async function getSong(id) {
    return songs.getSong(user.id, id)
  }

  async function searchSongs(query) {
    if (!query.trim()) return refresh()
    setLoading(true)
    try {
      const data = await songs.searchSongs(user.id, query)
      setSongsList(data)
    } finally {
      setLoading(false)
    }
  }

  return { songs: songsList, loading, refresh, addSong, updateSong, deleteSong, retireSong, reactivateSong, getSong, searchSongs }
}
