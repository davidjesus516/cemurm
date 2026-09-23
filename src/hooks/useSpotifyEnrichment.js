import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import { isOnline, searchSpotifyMatch, spotifyKeyToLabel } from '../lib/spotify.js'
import { getSong, updateSong } from '../lib/songs.js'
import {
  applySuggestions,
  discardSuggestions,
  ensureSpotifyConnected,
  getSpotifyConnection,
  saveAlbumArt,
  suggestEnrichment,
} from '../lib/enrichments.js'

/**
 * Spotify enrichment state machine (Hito 5 #69).
 * States: idle | searching | suggested | applying | applied | discarded |
 * noMatch | offline | error. API: lookup(), apply(), discard(), reset() plus
 * connection / match / rows / suggestionKey.
 *
 * Flow:
 *   lookup() → gates → searchSpotifyMatch(title, artist). A confident match
 *   upserts the connection row (implicit connect — no OAuth in this feature)
 *   and writes three 'suggested' rows (bpm/key/album_art, applied_by = user):
 *   RLS inserts suggestions only, so the preview is backed by real rows and
 *   Apply/Discard flip states.
 *   apply()  → persists the applied values FIRST (BPM via the updateSong
 *   provenance path; album art merged into version metadata; the key NEVER
 *   writes base_key), then flips the rows to 'applied'. A failed write leaves
 *   the rows 'suggested' so Apply can be retried.
 *   discard() → rows 'discarded'; the song itself is untouched.
 *
 * Gates (both before any provider call): offline → 'offline' — no new Spotify
 * call while offline, applied values keep riding the song cache (scenario 7);
 * revoked connection → 'error' 'integration revoked' — the client gate; the
 * backend also has no enrich path once revoked (RLS is owner-only and the
 * connection row is gone as 'connected').
 */
export function useSpotifyEnrichment({ song = null, onSongUpdated = null } = {}) {
  const { user } = useAuth()
  const [state, setState] = useState('idle') // idle|searching|suggested|applying|applied|discarded|noMatch|offline|error
  const [errorMessage, setErrorMessage] = useState('')
  const [match, setMatch] = useState(null)
  const [rows, setRows] = useState([])
  const [connection, setConnection] = useState(null)
  const [online, setOnline] = useState(() => isOnline())

  // Render-time ref mirrors: the async callbacks read the LATEST song/user/
  // callback/state without recreating themselves (useMidi pattern), so lookup/
  // apply/discard are stable identities with no stale closures.
  const songRef = useRef(song)
  const onSongUpdatedRef = useRef(onSongUpdated)
  const userIdRef = useRef(user?.id || null)
  const stateRef = useRef(state)
  const matchRef = useRef(match)
  const rowsRef = useRef(rows)
  const connectionRef = useRef(connection)

  songRef.current = song
  onSongUpdatedRef.current = onSongUpdated
  userIdRef.current = user?.id || null
  stateRef.current = state
  matchRef.current = match
  rowsRef.current = rows
  connectionRef.current = connection

  // Load the user's connection row on mount. The lib falls back to the
  // localStorage mirror when the DB read fails (offline), so Settings and the
  // panel render Connected/Revoked with zero network.
  useEffect(() => {
    let cancelled = false
    if (!user?.id) return undefined
    getSpotifyConnection(user.id)
      .then((row) => { if (!cancelled) setConnection(row) })
      .catch(() => { /* read failed — mirror fallback already handled in lib */ })
    return () => { cancelled = true }
  }, [user?.id])

  // Live online/offline — the panel tooltip and the lookup gate react
  // immediately instead of waiting for the next user action.
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
    if (prev === 'searching' || prev === 'suggested' || prev === 'applying') return

    // A re-search discards any earlier UNRESOLVED suggestions so pending rows
    // never orphan (already applied/discarded rows stay for provenance).
    if (rowsRef.current.length && prev !== 'applied' && prev !== 'discarded') {
      try {
        await discardSuggestions(userId, rowsRef.current.map((r) => r.id))
      } catch {
        // Best-effort cleanup — RLS keeps them creator-visible either way.
      }
    }

    // Gate: no provider call while offline / after revoke.
    if (!isOnline()) {
      setState('offline')
      setErrorMessage('')
      return
    }
    if (connectionRef.current?.status === 'revoked') {
      setState('error')
      setErrorMessage('integration revoked')
      return
    }

    setState('searching')
    setMatch(null)
    setRows([])
    try {
      const result = await searchSpotifyMatch({ title: current.title, artist: current.artist })
      if (result.ok && result.match) {
        // Implicit connect before the first suggestion insert (data-layer
        // contract): enrichment creates the connection, not OAuth (#78).
        await ensureSpotifyConnected(userId)
        const created = await suggestEnrichment(userId, current.id, result.match)
        setMatch(result.match)
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
    if (!current || !userId) return
    if (stateRef.current !== 'suggested' || !matchRef.current) return
    setState('applying')

    let applied = []
    let wroteValues = false
    try {
      // 1. Persist the applied values FIRST — a failure leaves the rows
      // 'suggested' so Apply can be retried. BPM rides the updateSong
      // provenance path ('spotify'); album art merges into version metadata;
      // the key stays a SUGGESTION only and never touches base_key (scenario 5).
      const bpmRow = rowsRef.current.find((r) => r.field === 'bpm')
      if (bpmRow && typeof bpmRow.value?.bpm === 'number') {
        const updated = await updateSong(userId, current.id, { bpm: bpmRow.value.bpm }, 'spotify')
        wroteValues = Boolean(updated)
      }
      const artRow = rowsRef.current.find((r) => r.field === 'album_art')
      if (artRow && current.versionId && artRow.value?.album_art?.url) {
        await saveAlbumArt(current.versionId, current.metadata || {}, {
          url: artRow.value.album_art.url,
          trackId: artRow.value.album_art.trackId || null,
        })
        wroteValues = true
      }
      // 2. Flip the suggestion rows — applied provenance is now durable.
      applied = await applySuggestions(userId, current.id, rowsRef.current)
    } catch {
      setState('error')
      setErrorMessage('unavailable')
      return
    }

    setRows(applied)
    setState('applied')

    // 3. Refresh the caller's local song (best-effort) so the new BPM, album
    // art and provenance badge appear without a reload. If this fails, the
    // applied values survive via the read-through cache + next full read.
    if (wroteValues) {
      try {
        const fresh = await getSong(userId, current.id)
        onSongUpdatedRef.current?.(fresh)
      } catch {
        // Local song stays as-is; the next read self-heals.
      }
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
    setMatch(null)
    setRows([])
    setState('discarded')
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setMatch(null)
    setRows([])
    setErrorMessage('')
  }, [])

  // Spotify's keyIndex+mode → app label ('E major'), used for the preview
  // badge and the declared-key conflict check.
  const suggestionKey = match ? spotifyKeyToLabel(match.keyIndex, match.mode) : ''

  return {
    state,
    errorMessage,
    match,
    rows,
    connection,
    online,
    suggestionKey,
    lookup,
    apply,
    discard,
    reset,
  }
}