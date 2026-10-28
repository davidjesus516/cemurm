// Public overlay page (Hito 5 #66): /overlay/:token — the OBS Browser
// Source URL. Polls the capability RPC overlay_state() every STATE_POLL_MS
// and renders the chrome-free OverlayView. NO auth guard: the anon-visible
// RPC serves an inactive row (zero song data) for an unknown, rotated or
// inactive token — the dedicated access_token IS the authorization, and the
// row's primary key is not (0032). Any fetch failure renders the inactive
// state; this page never crashes and never leaks song data.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import OverlayView from '../components/OverlayView.jsx'
import { supabase } from '../../../data/supabase.js'
import { STATE_POLL_MS } from '../../../data/repositories/overlay.js'

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
  const { token } = useParams()
  const [state, setState] = useState(INACTIVE_STATE)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const { data, error } = await supabase.rpc('overlay_state', {
          p_access_token: token,
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
  }, [token])

  return <OverlayView state={state} />
}
