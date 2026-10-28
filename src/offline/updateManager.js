// @ts-check
// SW update pipeline (hito-2-remainder 2a.5, D3): background install →
// waiting SW → once-per-session "Update now" prompt → SKIP_WAITING + reload,
// or the next natural load activates. Never prompts mid-session, never
// interrupts Stage/Practice or the marketing landing, never prompts on a first
// install (nothing to update), silent offline (browser retries next load).

const PROMPT_KEY = 'cemurm:update-dismissed'
// Live-use deferral (spec): Stage (Live Performance) and Practice are
// read-only routes for the update pipeline — suppress the prompt there.
// /landing is deferred for the opposite reason, and it is a marketing page, not
// a live one: Stage and Practice protect work in progress, while the landing has
// no in-progress state and exists to be read, so a blocking dialog that freezes
// paint there is the worst possible first impression. The optional trailing
// slash is because the router serves /landing/ as the same route (React Router
// appends an optional trailing slash to an `end` pattern), so pathname can carry
// one and a strict `$` would miss it. No router basename and no Vite `base`, so
// pathname stays root-anchored.
const DEFERRED_ROUTES = [
  /^\/landing\/?$/,
  /^\/setlists\/[^/]+\/stage$/,
  /^\/songs\/[^/]+\/practice$/,
]

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

/**
 * @param {ServiceWorkerRegistration} registration
 * @returns {void}
 */
function promptForUpdate(registration) {
  try {
    if (sessionStorage.getItem(PROMPT_KEY)) return // once per session
    if (isUpdateDeferred()) return // never interrupt Stage/Practice
  } catch {
    return // storage unavailable — stay silent
  }

  // A first install is not an update and must not prompt. sw.js's install handler
  // posts UPDATE_READY to every client and calls no skipWaiting(), so on a cold
  // first visit `waiting` is already set: a fresh worker installed, waiting to
  // take over a page it has never controlled. `controller` is the discriminator,
  // read HERE at the moment the prompt would fire and not captured at module
  // load, because it flips when a worker activates: it is null until some worker
  // has controlled the page (first install), and non-null on an update, where
  // the previous worker still controls the page while the new one waits.
  // Skipping the prompt leaves the documented design intact: the waiting worker
  // still activates on the next natural load (see sw.js install), so no
  // skipWaiting() is added and nothing is taken over mid-session.
  if (!navigator.serviceWorker.controller) return

  // ponytail: confirm() is the lazy prompt; a styled banner can replace it
  // when the storage-screen work lands (2b).
  if (!window.confirm('A new version is ready. Update now?')) {
    sessionStorage.setItem(PROMPT_KEY, '1') // "Later" — next natural start
    return
  }
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
  window.location.reload()
}