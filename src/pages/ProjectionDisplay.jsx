// Congregation Projection display popup (Hito 5 — features/congregation-projection.feature).
// Rendered on the second screen via window.open(DISPLAY_URL?service=…). Listens
// to the BroadcastChannel, heartbeats so the operator can detect a disconnect,
// restores the last synced state on open, and announces a clean close. No app
// chrome — this window is the congregation-facing view.

import { useEffect, useRef, useState } from 'react'
import SlideView from '../components/projection/SlideView.jsx'
import {
  channelFor,
  loadLastState,
  postBeat,
  postClose,
} from '../lib/projection.js'

const HEARTBEAT_MS = 3000

export default function ProjectionDisplay() {
  const [state, setState] = useState(null)
  const channelRef = useRef(null)
  const serviceIdRef = useRef('')

  useEffect(() => {
    const serviceId = new URLSearchParams(window.location.search).get('service') || ''
    serviceIdRef.current = serviceId
    if (!serviceId) return

    const channel = channelFor(serviceId)
    channelRef.current = channel
    const onMessage = (event) => {
      const { kind } = event.data || {}
      if (kind === 'projection-state') setState(event.data)
      else if (kind === 'close') setState(null)
    }
    channel?.addEventListener('message', onMessage)

    // Restore the last synced state (app-restart recovery) and announce we are
    // alive so the operator switches to popup mode immediately.
    const last = loadLastState(serviceId)
    if (last) setState(last)
    postBeat(channel)

    const timer = window.setInterval(() => postBeat(channel), HEARTBEAT_MS)
    return () => {
      window.clearInterval(timer)
      postClose(channel)
      channel?.close()
    }
  }, [])

  const index = state?.index ?? 0
  const settings = state?.settings || {}
  const slide = state?.deck?.[index] || null

  return (
    <div className="min-h-screen bg-cem-base">
      <SlideView slide={slide} settings={settings} />
    </div>
  )
}