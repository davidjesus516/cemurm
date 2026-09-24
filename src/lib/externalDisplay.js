// External Display data layer (Hito 5 — features/external-display.feature).
// Client-only: a popup window on the second screen mirrors Performance Mode
// over a BroadcastChannel. The popup renders the Shared clean view via
// ExternalDisplayView; when only the primary display exists the same view is
// shown as a labeled in-app preview. Settings/active/last state persist in
// localStorage per setlist so the display survives app restarts and can be
// re-launched with one tap.

export const CHANNEL_NAME = 'cemurm:external-display'
export const DISPLAY_URL = '/external-display'

const SETTINGS_KEY = (setlistId) => `cemurm:ed:settings:${setlistId}`
const ACTIVE_KEY = (setlistId) => `cemurm:ed:active:${setlistId}`
const LAST_STATE_KEY = (setlistId) => `cemurm:ed:last:${setlistId}`

export const DEFAULT_SETTINGS = Object.freeze({ mode: 'lyrics' })

/** True when the browser reports more than one connected display. */
export function hasSecondScreen() {
  return typeof window !== 'undefined' && typeof window.screen?.isExtended === 'boolean'
    ? window.screen.isExtended
    : true // no multi-monitor API → assume popup can still target a second screen
}

export function loadSettings(setlistId) {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY(setlistId))
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function persistSettings(setlistId, settings) {
  try {
    localStorage.setItem(SETTINGS_KEY(setlistId), JSON.stringify(settings))
  } catch {
    // storage full/unavailable — settings simply won't persist
  }
}

export function markActive(setlistId) {
  try {
    localStorage.setItem(ACTIVE_KEY(setlistId), '1')
  } catch {
    // non-fatal
  }
}

export function clearActive(setlistId) {
  try {
    localStorage.removeItem(ACTIVE_KEY(setlistId))
  } catch {
    // non-fatal
  }
}

export function wasActive(setlistId) {
  try {
    return localStorage.getItem(ACTIVE_KEY(setlistId)) === '1'
  } catch {
    return false
  }
}

export function saveLastState(setlistId, state) {
  try {
    localStorage.setItem(LAST_STATE_KEY(setlistId), JSON.stringify(state))
  } catch {
    // state too large / storage full — popup will wait for the next sync
  }
}

export function loadLastState(setlistId) {
  try {
    const raw = localStorage.getItem(LAST_STATE_KEY(setlistId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function createChannel() {
  return typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null
}

export function postState(channel, payload) {
  channel?.postMessage({ kind: 'state', ...payload })
}

export function postHeartbeat(channel) {
  channel?.postMessage({ kind: 'heartbeat', ts: Date.now() })
}

export function postClose(channel) {
  channel?.postMessage({ kind: 'close' })
}