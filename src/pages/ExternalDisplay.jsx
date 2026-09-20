// External Display popup page (Hito 5 — features/external-display.feature).
// Rendered on the second screen via window.open(..., DISPLAY_URL). Listens to
// the BroadcastChannel, heartbeats so the primary can detect a disconnect,
// restores the last synced state on open, and announces a clean close. No
// app chrome — this window is the audience-facing view.

import { useEffect, useRef, useState } from 'react'
import ExternalDisplayView from '../components/external/ExternalDisplayView.jsx'
import {
  CHANNEL_NAME,
  createChannel,
  loadLastState,
  postClose,
  postHeartbeat,
} from '../lib/externalDisplay.js'

const HEARTBEAT_MS = 3000

export default function ExternalDisplay() {
  const [state, setState] = useState(null)
  const channelRef = useRef(null)

  useEffect(() => {
    const channel = createChannel()
    channelRef.current = channel
    const onMessage = (event) => {
      const { kind } = event.data || {}
      if (kind === 'state') setState(event.data)
      else if (kind === 'close') setState(null)
    }
    channel?.addEventListener('message', onMessage)

    // Restore the last synced state (app-restart recovery) and announce we
    // are alive so the primary switches to popup mode immediately.
    const setlistId = new URLSearchParams(window.location.search).get('setlist')
    if (setlistId) {
      const last = loadLastState(setlistId)
      if (last) setState(last)
    }
    postHeartbeat(channel)

    const heartbeat = window.setInterval(() => postHeartbeat(channel), HEARTBEAT_MS)

    function announceClose() {
      postClose(channel)
    }
    window.addEventListener('beforeunload', announceClose)

    return () => {
      window.clearInterval(heartbeat)
      window.removeEventListener('beforeunload', announceClose)
      channel?.removeEventListener('message', onMessage)
      channel?.close()
    }
  }, [])

  return <ExternalDisplayView state={state} />
}