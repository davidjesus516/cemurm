import React from 'react'
import ReactDOM from 'react-dom/client'
// L6 — fonts (plan 7.4). These four imports used to be the SUBSET-LESS
// `@fontsource/inter/{400,500,600,700}.css`, and each of those pulls four subsets
// (latin, latin-ext, cyrillic, greek, vietnamese) in BOTH woff2 and woff.
// Measured in `dist/assets` before this change: 28 woff2 + 28 woff, 386,820 +
// 506,108 bytes, of which a Spanish page uses only the latin subset.
//
// The `latin-*.css` entrypoints ship the same @font-face rules with exactly one
// `src`, so this is a subset change and NOT a weight change: the four weights, the
// family name and the generated CSS are otherwise identical.
//
// `font-display: swap` is NOT added here because @fontsource already emits it in
// each entrypoint — verified by reading
// node_modules/@fontsource/inter/latin-400.css. The metric-fallback face that
// keeps the swap from shifting layout is declared in public/fonts.css and linked
// from index.html; see that file for why it lives there.
//
// NOT DONE, and it needs a surfaces this slice does not have: plan 7.4 asks for
// `@fontsource-variable/inter` (one file, all weights, ~45 kB). That package is
// not installed, not in pnpm-lock.yaml, and installing it means editing
// package.json and the lockfile — neither is an allowed surface here. The four
// latin files measure 96,744 bytes against the variable font's ~45 kB, so the
// remaining saving is roughly 51 kB for a decision that belongs to a slice which
// may also spend package.json.
//
// RESOLVED. Inter is now one variable face covering all four weights, declared
// in public/fonts.css beside the metric-compatible fallback and preloaded from
// index.html: 48,256 bytes for 400/500/600/700, against the four static latin
// files' 96,744. The metrics were measured, not assumed — fontTools 4.66 on the
// variable and the static file reports the same upm, ascent, descent, lineGap
// and xAvgCharWidth, so the fallback's `size-adjust: 105.31%` still holds.
//
// Nothing imports a font from this module any more. `@fontsource/inter` is no
// longer used at runtime; the woff2 is copied into public/fonts/ so it is
// resolvable before the CSS bundle parses.
import App from './router.jsx'
import './index.css'
import { startOfflineSync } from '../offline/drainer.js'
import { getSession } from '../data/repositories/auth.js'
import { registerUpdateManager } from '../offline/updateManager.js'

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
