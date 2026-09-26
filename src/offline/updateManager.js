// SW update pipeline (hito-2-remainder 2a.5, D3): background install →
// waiting SW → once-per-session "Update now" prompt → SKIP_WAITING + reload,
// or the next natural load activates. Never prompts mid-session, never
// interrupts Stage/Practice, silent offline (browser retries next load).

const PROMPT_KEY = 'cemurm:update-dismissed'
// Live-use deferral (spec): Stage (Live Performance) and Practice are
// read-only routes for the update pipeline — suppress the prompt there.
const DEFERRED_ROUTES = [/^\/setlists\/[^/]+\/stage$/, /^\/songs\/[^/]+\/practice$/]

export function isUpdateDeferred() {
  return DEFERRED_ROUTES.some((re) => re.test(window.location.pathname))
}

export function registerUpdateManager() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

  window.addEventListener('load', () => {
    // Silent on failure (offline / blocked): the browser retries the update
    // check on the next natural app start; the current version keeps working.
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'UPDATE_READY') promptForUpdate(registration)
        })
        // Recovery: a waiting SW already in place (message missed on a slow
        // boot) still deserves the once-per-session prompt.
        if (registration.waiting) promptForUpdate(registration)
      })
      .catch(() => {})
  })
}

function promptForUpdate(registration) {
  try {
    if (sessionStorage.getItem(PROMPT_KEY)) return // once per session
    if (isUpdateDeferred()) return // never interrupt Stage/Practice
  } catch {
    return // storage unavailable — stay silent
  }

  // ponytail: confirm() is the lazy prompt; a styled banner can replace it
  // when the storage-screen work lands (2b).
  if (!window.confirm('A new version is ready. Update now?')) {
    sessionStorage.setItem(PROMPT_KEY, '1') // "Later" — next natural start
    return
  }
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
  window.location.reload()
}