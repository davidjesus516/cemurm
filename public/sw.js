/* CEMURM app-shell service worker (hito-2-remainder 2a, D3/D4).
   Versioned per-category caches; activation on next load ONLY (no
   skipWaiting()/clients.claim() mid-session — the update prompt is the only
   skipWaiting path). Cache-first for same-origin GET, network-first for
   navigation. cache-meta recorded in IDB on put/delete (storage accounting,
   D5). The pure predicates here mirror src/lib/storage.js (tested source). */
const VERSION = '2' // bump when the SW pipeline behavior changes
const CATEGORIES = ['shell', 'songs', 'pdf', 'exports', 'data']
const SHELL = `cemurm-shell-v${VERSION}`
const IDB_NAME = 'cemurm-offline'
const META_STORE = 'cache-meta'

/** Category cache for a non-navigation request (D4). 'data' is IDB-side
    (read-through kv), so no URL routes to it. */
function cacheFor(url) {
  const { pathname } = new URL(url)
  if (pathname.endsWith('.pdf')) return `cemurm-pdf-v${VERSION}`
  if (pathname.startsWith('/exports/')) return `cemurm-exports-v${VERSION}`
  return `cemurm-songs-v${VERSION}`
}

// ── cache-meta (D5): per-cache {bytes, savedAt}, best-effort ────────────────
function openMeta() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    // Versionless open: never drifts against the client's lockstep v3, and a
    // fresh profile simply skips meta until the page's modules create stores.
    const req = indexedDB.open(IDB_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

async function metaAdd(name, bytes) {
  const db = await openMeta()
  if (!db || !db.objectStoreNames.contains(META_STORE)) return
  try {
    await new Promise((resolve) => {
      const tx = db.transaction(META_STORE, 'readwrite')
      const store = tx.objectStore(META_STORE)
      store.get(name).onsuccess = (e) => {
        const total = (e.target.result?.bytes ?? 0) + bytes
        store.put({ bytes: total, savedAt: Date.now() }, name)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // best-effort — meta failure must never break caching
  }
}

async function metaRemove(name) {
  const db = await openMeta()
  if (!db || !db.objectStoreNames.contains(META_STORE)) return
  try {
    await new Promise((resolve) => {
      const tx = db.transaction(META_STORE, 'readwrite')
      tx.objectStore(META_STORE).delete(name)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // best-effort
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(['/', '/index.html']))
      .then(() =>
        // Waiting SW — no skipWaiting() here: activation happens on the next
        // natural load or after user-initiated SKIP_WAITING (D3, threat RED 1).
        // The post is unconditional and says nothing about whether there IS an
        // update: on a first install it fires too, with no previous bundle. The
        // prompt side owns that judgement (src/offline/updateManager.js gates on
        // navigator.serviceWorker.controller at prompt time), because from in
        // here `install` runs before this worker has controlled anything, so the
        // two states are indistinguishable without reaching for the client.
        self.clients
          .matchAll({ includeUncontrolled: true })
          .then((clients) => clients.forEach((c) => c.postMessage({ type: 'UPDATE_READY' }))),
      ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => {
            const m = /^cemurm-([a-z]+)-v(\d+)$/.exec(name)
            return (
              !m || !CATEGORIES.includes(m[1]) || m[2] !== VERSION
            )
          })
          .map((name) => caches.delete(name).then(() => metaRemove(name))),
      ),
    ),
  )
  // No clients.claim(): the old SW keeps current tabs until the next load
  // or the user-chosen SKIP_WAITING + reload (D3 — never mid-session).
})

self.addEventListener('message', (event) => {
  // User chose "Update now" in the app prompt — the ONLY skipWaiting path.
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Network-first for HTML: hit network when online, fall back to cached
    // shell offline. Refreshes the shell copy + its meta on success.
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const blob = await response.clone().blob()
          const cache = await caches.open(SHELL)
          // Cache a CLONE. `cache.put` consumes the body stream it is handed, so
          // putting `response` itself returns a spent stream to the page and every
          // navigation this worker controls fails with ERR_FAILED. Measured in
          // Chromium: after `put(key, response)` the original reports bodyUsed
          // true and `text()` throws "body stream already read"; after
          // `put(key, response.clone())` it reports false and reads normally.
          await cache.put('/index.html', response.clone())
          await metaAdd(SHELL, blob.size)
          return response
        })
        .catch(async () => {
          const cached = await caches.match('/index.html')
          // respondWith(undefined) is itself a navigation failure, so an empty
          // cache has to produce a real Response rather than nothing.
          return cached || new Response('', { status: 503, statusText: 'Offline' })
        }),
    )
    return
  }

  event.respondWith(
    (async () => {
      const name = cacheFor(request.url)
      const cache = await caches.open(name)
      const cached = await cache.match(request)
      if (cached) return cached

      const response = await fetch(request)
      if (response.ok) {
        const blob = await response.clone().blob()
        // Same reason as the navigate branch: cache a clone, return the original.
        // Putting `response` itself spends its body and the page gets a dead
        // stream, which fails the asset load rather than serving it.
        await cache.put(request, response.clone())
        await metaAdd(name, blob.size)
      }
      return response
    })(),
  )
})