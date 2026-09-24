// In-App Feedback data layer (Hito 5 — in-app-feedback).
// Submit-only client surface matching features/in-app-feedback.feature (8
// scenarios). Rows land via the 0020 feedback table (RLS insert-self); the
// offline path reuses the existing offlineQueue/offlineSync replay (op
// `submitFeedback`) — the same INSERT is retried on reconnect. Diagnostics
// (device info + recent console errors + optional screenshot) are attached
// ONLY when the user consents; without consent the payload omits them.

import { supabase } from './supabase.js'
import { enqueueOp } from './offlineQueue.js'

export const ISSUE_TRACKER_URL = 'https://github.com/davidjesus516/cemurm/issues'

// ---- console error ring (attached to diagnostics only with consent) ----
const CONSOLE_ERROR_LIMIT = 5
const consoleErrors = []
let captureInstalled = false

function installErrorCapture() {
  if (captureInstalled || typeof window === 'undefined') return
  captureInstalled = true
  window.addEventListener('error', (e) => {
    consoleErrors.push({ message: e.message, source: e.filename, line: e.lineno })
    if (consoleErrors.length > CONSOLE_ERROR_LIMIT) consoleErrors.shift()
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason
    consoleErrors.push({
      message: reason instanceof Error ? reason.message : String(reason),
    })
    if (consoleErrors.length > CONSOLE_ERROR_LIMIT) consoleErrors.shift()
  })
}
installErrorCapture()

/**
 * Build the diagnostics blob. Returns `null` (payload omits diagnostics)
 * unless the user explicitly consents. Screenshot must already be capped by
 * the caller; skipped silently when too large for the report.
 */
export function collectDiagnostics({ consent, screenshotDataUrl }) {
  if (!consent) return null
  const diagnostics = {
    device: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      online: navigator.onLine,
    },
    logs: consoleErrors.slice(),
    capturedAt: new Date().toISOString(),
  }
  if (screenshotDataUrl) diagnostics.screenshot = screenshotDataUrl
  return diagnostics
}

/**
 * Insert a feedback row. Signature is write-op compatible for offlineSync:
 * (userId, payload). Throws a typed error on server failure so the UI can
 * surface "Could not send, retry or copy your text" and keep the draft.
 * @returns {{ok: true}}
 */
export async function submitFeedback(userId, payload) {
  const { kind, message, screen, diagnostics } = payload
  const { error } = await supabase.from('feedback').insert([{ kind, message, screen, diagnostics }])
  if (error) {
    const err = new Error(error.message || 'Feedback failed to send.')
    err.code = error.code
    throw err
  }
  return { ok: true }
}

/** Queue the feedback insert for replay on reconnect (offline path). */
export async function queueFeedback(userId, payload) {
  await enqueueOp(userId, { name: 'submitFeedback', args: [payload] })
  return { queued: true }
}