// Public overlay page (Hito 5 #66): /overlay/:sessionId — the OBS Browser
// Source URL. Polls the capability RPC overlay_state() every STATE_POLL_MS
// and renders the chrome-free OverlayView. NO auth guard: the anon-visible
// RPC serves an inactive row (zero song data) for unknown or inactive session
// ids — the unguessable uuid IS the authorization. Any fetch failure renders
// the inactive state; this page never crashes and never leaks song data.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import OverlayView from '../components/overlay/OverlayView.jsx'
import { supabase } from '../lib/supabase.js'
import { STATE_POLL_MS } from '../lib/overlay.js'

const INACTIVE_STATE = {
  active: false,
  title: '',
  key: '',
  body: '',
  song_index: 0,
  song_total: 0,
  mode: 'title',
}

export default function Overlay() {
  const { sessionId } = useParams()
  const [state, setState] = useState(INACTIVE_STATE)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const { data, error } = await supabase.rpc('overlay_state', {
          p_session_id: sessionId,
        })
        if (cancelled) return
        setState(error ? INACTIVE_STATE : data?.[0] ?? INACTIVE_STATE)
      } catch {
        if (!cancelled) setState(INACTIVE_STATE)
      }
    }

    poll()
    const timer = setInterval(poll, STATE_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [sessionId])

  return <OverlayView state={state} />
}