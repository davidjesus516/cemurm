import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import { isOnline } from '../lib/spotify.js'
import { fetchLrclibLyrics } from '../lib/lrclib.js'
import { getSong } from '../lib/songs.js'
import {
  applySuggestions,
  discardSuggestions,
  saveLyrics,
  suggestEnrichment,
} from '../lib/enrichments.js'

/**
 * LRCLIB lyrics enrichment state machine (Hito 5 #78, S11).
 * States: idle | looking | suggested | applying | applied | discarded |
 * noMatch | offline | error. API: lookup(), apply(), discard(), reset().
 *
 * Flow (mirror of useSpotifyEnrichment):
 *   lookup()  → offline gate → fetchLrclibLyrics(title, artist). A match
 *   persists a 'suggested' lyrics row (source 'lrclib'). LRCLIB is a PUBLIC
 *   API — no external_connections row, so there is no revoke gate and no
 *   Settings section.
 *   apply()   → saveLyrics(versionId, metadata, { text }) FIRST (the version
 *   metadata carries the lyrics text), then flips the row to 'applied', then
 *   refreshes the caller's song (values first, rows second — #69 ordering).
 *   discard() → row 'discarded'; the version is untouched.
 */
export function useLyricsEnrichment({ song = null, versionId = '', metadata = null, onSongUpdated = null } = {}) {
  const { user } = useAuth()
  const [state, setState] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [rows, setRows] = useState([])
  const [online, setOnline] = useState(() => isOnline())

  // Render-time ref mirrors: the async callbacks always read the LATEST
  // song/version/user/callback without recreating themselves (useMidi pattern).
  const songRef = useRef(song)
  const versionIdRef = useRef(versionId)
  const metadataRef = useRef(metadata)
  const onSongUpdatedRef = useRef(onSongUpdated)
  const userIdRef = useRef(user?.id || null)
  const stateRef = useRef(state)
  const rowsRef = useRef(rows)

  songRef.current = song
  versionIdRef.current = versionId
  metadataRef.current = metadata
  onSongUpdatedRef.current = onSongUpdated
  userIdRef.current = user?.id || null
  stateRef.current = state
  rowsRef.current = rows

  // Live online/offline — the fetch button state reacts immediately.
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const lookup = useCallback(async () => {
    const current = songRef.current
    const userId = userIdRef.current
    if (!current?.title || !userId) return
    const prev = stateRef.current
    if (prev === 'looking' || prev === 'suggested' || prev === 'applying') return

    // A re-search discards any UNRESOLVED suggestion first (never orphans rows).
    if (rowsRef.current.length && prev !== 'applied' && prev !== 'discarded') {
      try {
        await discardSuggestions(userId, rowsRef.current.map((r) => r.id))
      } catch {
        // Best-effort cleanup — RLS keeps the rows creator-visible either way.
      }
    }

    if (!isOnline()) {
      setState('offline')
      setErrorMessage('')
      return
    }

    setState('looking')
    setRows([])
    try {
      const result = await fetchLrclibLyrics({
        title: current.title,
        artist: current.artist || '',
      })
      if (result.ok && result.match) {
        const created = await suggestEnrichment(userId, current.id, result.match, 'lrclib')
        setRows(created)
        setState(created.length ? 'suggested' : 'noMatch')
        return
      }
      if (result.ok) {
        setState('noMatch')
        return
      }
      setState(result.error === 'offline' ? 'offline' : 'error')
      setErrorMessage(result.error === 'offline' ? 'offline' : 'unavailable')
    } catch {
      setState('error')
      setErrorMessage('unavailable')
    }
  }, [])

  const apply = useCallback(async () => {
    const current = songRef.current
    const userId = userIdRef.current
    const versionId = versionIdRef.current
    if (!current || !userId) return
    if (!versionId) {
      // No open version to attach lyrics to — nothing to write, surface the
      // failure instead of silently dropping the text.
      setState('error')
      setErrorMessage('unavailable')
      return
    }
    if (stateRef.current !== 'suggested' || !rowsRef.current.length) return
    setState('applying')

    const lyricsRow = rowsRef.current.find((r) => r.field === 'lyrics')
    const text = lyricsRow?.value?.lyrics || ''
    if (!text) {
      setState('error')
      setErrorMessage('unavailable')
      return
    }

    let applied = []
    try {
      // 1. The lyrics text lands in the OPEN version's metadata FIRST — a
      // failed flip leaves the row 'suggested' so Apply can be retried.
      await saveLyrics(versionId, metadataRef.current || {}, { text })
      // 2. Provenance row → applied.
      applied = await applySuggestions(userId, current.id, rowsRef.current)
    } catch {
      setState('error')
      setErrorMessage('unavailable')
      return
    }

    setRows(applied)
    setState('applied')

    // 3. Refresh the caller's song so the lyrics block renders (best-effort).
    try {
      const fresh = await getSong(userId, current.id)
      onSongUpdatedRef.current?.(fresh)
    } catch {
      // Local song stays as-is; the next full read self-heals.
    }
  }, [])

  const discard = useCallback(async () => {
    const userId = userIdRef.current
    if (!userId) return
    if (stateRef.current !== 'suggested' || !rowsRef.current.length) return
    try {
      await discardSuggestions(userId, rowsRef.current.map((r) => r.id))
    } catch {
      setState('error')
      setErrorMessage('unavailable')
      return
    }
    setRows([])
    setState('discarded')
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setRows([])
    setErrorMessage('')
  }, [])

  return {
    state,
    errorMessage,
    rows,
    online,
    lookup,
    apply,
    discard,
    reset,
  }
}