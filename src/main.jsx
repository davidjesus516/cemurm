import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import App from './App.jsx'
import './index.css'
import { startOfflineSync } from './lib/offlineSync.js'
import { getSession } from './lib/auth.js'
import { registerUpdateManager } from './lib/updateManager.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Hito 2: offline write-queue drainer. Drains pending ops on 'online' events
// and once right after the persisted session is restored (drainPending needs
// a userId; the 'online' listener itself only fires with an Event object).
// Guarded so sync setup can never break app boot.
try {
  const drainPending = startOfflineSync()
  getSession()
    .then((session) => drainPending(session?.user?.id))
    .catch(() => {})
} catch {
  // never break boot on sync setup failure
}

// Register the service worker only in production builds (dev HMR is
// incompatible). Update pipeline (D3): background install, once-per-session
// prompt, activation on next load — never mid-session (updateManager.js).
registerUpdateManager()
