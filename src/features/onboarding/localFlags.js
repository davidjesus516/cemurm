// Pre-authentication UI flags. A visitor has no user id and therefore no
// preferences row yet, so the walkthrough / feature-tooltip "seen once" state
// lives in localStorage until signup; the four tracked progress steps live in
// user_preferences.onboarding (see useOnboarding).

const WALKTHROUGH_KEY = 'cem.onboarding.walkthroughDone'
const PERFORMANCE_TOOLTIP_KEY = 'cem.onboarding.performanceTooltipSeen'
const PENDING_INVITE_KEY = 'cem.onboarding.pendingInviteCode'

function readValue(key) {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  } catch {
    return null
  }
}

function writeValue(key, value) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
  } catch {
    // Private mode / disabled storage: the UI still works, it just repeats.
  }
}

function read(key) {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

function write(key) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, 'true')
  } catch {
    // Private mode / disabled storage: the UI still works, it just repeats.
  }
}

export const walkthroughDone = () => read(WALKTHROUGH_KEY)
export const markWalkthroughDone = () => write(WALKTHROUGH_KEY)
// Returns the raw stored value (a version string, or the legacy 'true') so the
// pure version gate can decide; this module never makes that decision itself.
export const performanceTooltipSeenVersion = () => readValue(PERFORMANCE_TOOLTIP_KEY)
export const markPerformanceTooltipSeenVersion = (version) =>
  writeValue(PERFORMANCE_TOOLTIP_KEY, version)

export function getPendingInviteCode() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(PENDING_INVITE_KEY) || '' : ''
  } catch {
    return ''
  }
}

export function setPendingInviteCode(code) {
  try {
    if (typeof localStorage === 'undefined') return
    if (code) localStorage.setItem(PENDING_INVITE_KEY, code)
    else localStorage.removeItem(PENDING_INVITE_KEY)
  } catch {
    // Storage disabled: registration still succeeds; the code can be re-entered.
  }
}
