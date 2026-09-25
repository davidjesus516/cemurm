import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import { isOnline } from '../lib/spotify.js'
import {
  disconnectPco,
  ensurePcoConnected,
  exportSetlistToPlan,
  getPcoConnection,
  importPlanToSetlist,
  listPlans,
} from '../lib/planningcenter.js'

/**
 * Planning Center state machine (Hito 5 #78).
 * States: idle | working | ready | error. API: connect(), revoke(),
 * loadPlans(), importPlan(plan), exportToPlan(planId, songs) plus the
 * connection row, plan list, lastImport/exportResult and the online flag.
 *
 * Flow:
 *   connect()  → ensurePcoConnected upserts the external_connections row
 *                (provider 'planningcenter', unique(user_id, provider)).
 *   revoke()   → disconnectPco flips status='revoked'; the row persists and
 *                imported setlists REMAIN (ordinary rows — nothing deleted).
 *   loadPlans()/importPlan()/exportToPlan() → the lib gates each on the
 *                connection ('revoked' → error 'integration revoked', S13).
 *   importPlan(plan) → creates `<name> (from Planning Center)` + links/creates
 *                songs; resolves { setlistId, linked, createdMissing } and
 *                fires onImported (the caller navigates to the new setlist).
 *
 * Gates (before any lib call): offline → 'offline'; revoked → the lib's own
 * gate (mirrored here so the UI can surface it without a round trip).
 */
export function usePlanningCenter({ onImported = null } = {}) {
  const { user } = useAuth()
  const [state, setState] = useState('idle') // idle|working|ready|error
  const [errorMessage, setErrorMessage] = useState('')
  const [connection, setConnection] = useState(null)
  const [plans, setPlans] = useState([])
  const [lastImport, setLastImport] = useState(null)
  const [exportResult, setExportResult] = useState(null)
  const [online, setOnline] = useState(() => isOnline())

  // Render-time ref mirrors (useSpotifyEnrichment pattern): the async
  // callbacks read the LATEST user/callback/state without recreating
  // themselves, so every handler is a stable identity with no stale closures.
  const userIdRef = useRef(user?.id || null)
  const stateRef = useRef(state)
  const connectionRef = useRef(connection)
  const onImportedRef = useRef(onImported)

  userIdRef.current = user?.id || null
  stateRef.current = state
  connectionRef.current = connection
  onImportedRef.current = onImported

  // Load the user's connection row on mount. The lib falls back to the
  // localStorage mirror when the DB read fails (offline), so the Settings
  // status and the Setlists import button render with zero network.
  useEffect(() => {
    let cancelled = false
    if (!user?.id) return undefined
    getPcoConnection(user.id)
      .then((row) => { if (!cancelled) setConnection(row) })
      .catch(() => { /* read failed — mirror fallback already handled in lib */ })
    return () => { cancelled = true }
  }, [user?.id])

  // Live online/offline — the import surface reacts immediately instead of
  // waiting for the next user action.
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

  const connect = useCallback(async () => {
    const userId = userIdRef.current
    if (!userId) return
    if (!isOnline()) {
      setState('error')
      setErrorMessage('offline')
      return
    }
    setState('working')
    setErrorMessage('')
    try {
      const row = await ensurePcoConnected(userId)
      setConnection(row)
      setState('ready')
    } catch {
      setState('error')
      setErrorMessage('unavailable')
    }
  }, [])

  const revoke = useCallback(async () => {
    const userId = userIdRef.current
    if (!userId) return
    if (!isOnline()) {
      setState('error')
      setErrorMessage('offline')
      return
    }
    setState('working')
    setErrorMessage('')
    try {
      const row = await disconnectPco(userId)
      // disconnectPco may yield no row when none existed — 'revoked' is
      // still the honest status for the mirror + UI.
      setConnection(row || { status: 'revoked' })
      setState('ready')
    } catch {
      setState('error')
      setErrorMessage('unavailable')
    }
  }, [])

  const loadPlans = useCallback(async () => {
    const userId = userIdRef.current
    if (!userId) return
    if (!isOnline()) {
      setState('error')
      setErrorMessage('offline')
      return
    }
    if (connectionRef.current?.status === 'revoked') {
      setState('error')
      setErrorMessage('integration revoked')
      return
    }
    setState('working')
    setErrorMessage('')
    try {
      const res = await listPlans(userId)
      if (!res.ok) {
        setState('error')
        setErrorMessage(res.error)
        return
      }
      setPlans(res.plans)
      setState('ready')
    } catch {
      setState('error')
      setErrorMessage('unavailable')
    }
  }, [])

  const importPlan = useCallback(async (plan) => {
    const userId = userIdRef.current
    if (!userId || !plan) return null
    if (!isOnline()) {
      setState('error')
      setErrorMessage('offline')
      return null
    }
    setState('working')
    setErrorMessage('')
    try {
      const res = await importPlanToSetlist(userId, plan)
      if (!res.ok) {
        setState('error')
        setErrorMessage(res.error)
        return null
      }
      setLastImport(res)
      setState('ready')
      onImportedRef.current?.(res)
      return res
    } catch {
      setState('error')
      setErrorMessage('unavailable')
      return null
    }
  }, [])

  const exportToPlan = useCallback(async (planId, songs) => {
    const userId = userIdRef.current
    if (!userId || !planId) return null
    if (!isOnline()) {
      setState('error')
      setErrorMessage('offline')
      return null
    }
    setState('working')
    setErrorMessage('')
    try {
      const res = await exportSetlistToPlan(userId, planId, songs)
      if (!res.ok) {
        setState('error')
        setErrorMessage(res.error)
        return null
      }
      setExportResult(res)
      setState('ready')
      return res
    } catch {
      setState('error')
      setErrorMessage('unavailable')
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setErrorMessage('')
  }, [])

  return {
    state,
    errorMessage,
    connection,
    plans,
    lastImport,
    exportResult,
    online,
    connect,
    revoke,
    loadPlans,
    importPlan,
    exportToPlan,
    reset,
  }
}