// Storage screen (2b.1-2b.2, D4): total + 4 categories (Songs / PDF scans /
// Exports / Setlists and gigs), visible offline — reads cache-meta + IDB kv
// only, zero network. Per-category clear deletes only that cache prefix plus
// its non-user-authored kv read copies; one-tap cleanup evicts PDF → exports
// → derived by age (planEviction), never shell/active-setlist/user data.

import { useCallback, useEffect, useState } from 'react'
import {
  cacheMetaList,
  cacheMetaRemove,
  offlineGet,
  offlineKeysByPrefix,
  offlineRemove,
} from '../lib/offlineCache.js'
import { isUserAuthoredKvEntry, parseCacheName, planEviction } from '../lib/storage.js'

const WARN_RATIO = 0.9 // navigator.storage.estimate() usage/quota warning threshold
const CLEAR_RATIO = 0.75 // cleanup frees until usage drops below 75% of quota
const WARN_BYTES = 50 * 1024 * 1024 // offline fallback: tracked-bytes threshold

// D4: one SW cache per category + the IDB kv read-copy prefixes per category.
const CATEGORIES = [
  { id: 'songs', label: 'Songs', kvPrefixes: ['songs:', 'song:'] },
  { id: 'pdf', label: 'PDF scans', kvPrefixes: [] },
  { id: 'exports', label: 'Exports', kvPrefixes: [] },
  { id: 'data', label: 'Setlists and gigs', kvPrefixes: ['setlists:', 'setlist:', 'gig:'] },
]
const KV_PREFIXES = CATEGORIES.flatMap((cat) => cat.kvPrefixes)

function bytesOf(value) {
  const json = JSON.stringify(value ?? '')
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(json).length : json.length
}

function formatBytes(n) {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

async function estimateCacheBytes(name) {
  try {
    const cache = await caches.open(name)
    const keys = await cache.keys()
    let total = 0
    for (const req of keys) {
      const res = await cache.match(req)
      if (res) total += (await res.clone().blob()).size
    }
    return total
  } catch {
    return 0
  }
}

async function quotaInfo() {
  if (navigator?.storage?.estimate) {
    const { usage, quota } = await navigator.storage.estimate()
    if (usage != null && quota) return { usage, quota }
  }
  return null
}

export default function Storage() {
  const [cats, setCats] = useState([])
  const [total, setTotal] = useState(0)
  const [warning, setWarning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [cacheStats, setCacheStats] = useState([])
  const [kvRows, setKvRows] = useState([])

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const meta = await cacheMetaList()
      const byName = new Map(meta.map((m) => [m.name, m]))
      const cacheNames = typeof caches === 'undefined' ? [] : await caches.keys()
      const stats = []
      for (const name of cacheNames) {
        const m = byName.get(name)
        const parsed = parseCacheName(name)
        stats.push({
          name,
          category: parsed?.category ?? 'other',
          bytes: m?.bytes ?? (await estimateCacheBytes(name)),
          savedAt: m?.savedAt ?? 0,
        })
      }
      const kv = []
      for (const prefix of KV_PREFIXES) {
        for (const key of await offlineKeysByPrefix(prefix)) {
          const value = await offlineGet(key)
          kv.push({ key, value, bytes: bytesOf(value) })
        }
      }
      const computed = CATEGORIES.map((cat) => {
        const cacheBytes = stats
          .filter((s) => s.category === cat.id)
          .reduce((sum, s) => sum + s.bytes, 0)
        const kvBytes = kv
          .filter((r) => cat.kvPrefixes.some((p) => r.key.startsWith(p)))
          .reduce((sum, r) => sum + r.bytes, 0)
        return { ...cat, totalBytes: cacheBytes + kvBytes }
      })
      const tracked = computed.reduce((sum, c) => sum + c.totalBytes, 0)
      setCacheStats(stats)
      setKvRows(kv)
      setCats(computed)
      setTotal(tracked)
      setWarning(await nearQuota(tracked))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function nearQuota(trackedBytes) {
    const q = await quotaInfo()
    return q ? q.usage / q.quota > WARN_RATIO : trackedBytes > WARN_BYTES
  }

  async function deleteCache(name) {
    if (typeof caches === 'undefined') return
    await caches.delete(name)
    await cacheMetaRemove(name)
  }

  async function clearCategory(cat) {
    if (!window.confirm(`Clear the cached ${cat.label} copies? Underlying songs, setlists, and gigs stay saved.`)) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      for (const s of cacheStats) if (s.category === cat.id) await deleteCache(s.name)
      for (const r of kvRows) {
        if (!cat.kvPrefixes.some((p) => r.key.startsWith(p))) continue
        if (isUserAuthoredKvEntry({ key: r.key, value: r.value })) continue
        await offlineRemove(r.key)
      }
      await load()
      setMessage(`${cat.label} cache cleared.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCleanup() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const target = await cleanupTarget()
      if (target <= 0) {
        setMessage('Storage usage is already below the warning threshold.')
      } else {
        const plan = planEviction(
          cacheStats,
          kvRows.map((r) => ({
            key: r.key,
            value: r.value,
            savedAt: r.value?.savedAt ?? 0,
            bytes: r.bytes,
          })),
          target,
        )
        if (!plan.length) {
          setMessage('No derived cache to free — user data is never removed by cleanup.')
        } else {
          for (const item of plan) {
            if (item.type === 'cache') await deleteCache(item.name)
            else await offlineRemove(item.key)
          }
          setMessage(
            `Freed ${formatBytes(plan.reduce((sum, x) => sum + x.bytes, 0))} of the oldest PDF scans, exports, and other derived cache.`,
          )
        }
      }
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function cleanupTarget() {
    const q = await quotaInfo()
    if (q) return Math.max(0, q.usage - q.quota * CLEAR_RATIO)
    return Math.max(0, total - Math.floor(WARN_BYTES / 2))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-cem-text">Storage</h1>
      <p className="mt-1 text-sm text-cem-secondary">
        Cached copies used offline, by category. Clearing or cleaning never deletes your songs, setlists, or gigs.
      </p>

      {warning && (
        <div className="mt-4 flex items-center justify-between gap-4 border border-cem-amber bg-cem-amber/10 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-cem-text">Storage is nearly full</p>
            <p className="text-xs text-cem-secondary">
              Free space by clearing the oldest PDF scans, exports, and other derived cache.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCleanup}
            disabled={busy}
            className="shrink-0 rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
          >
            {busy ? 'Freeing…' : 'Free space'}
          </button>
        </div>
      )}

      {message && <p className="mt-2 text-sm text-cem-text">{message}</p>}
      {error && <p className="mt-2 text-sm text-cem-rose">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-lg border border-cem-elevated">
        <table className="w-full text-sm">
          <thead className="bg-cem-elevated text-left text-xs uppercase tracking-wide text-cem-secondary">
            <tr>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 text-right font-medium">Used</th>
              <th className="px-4 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((cat) => (
              <tr key={cat.id} className="border-t border-cem-elevated">
                <td className="px-4 py-3 font-medium text-cem-text">{cat.label}</td>
                <td className="px-4 py-3 text-right text-cem-text">{formatBytes(cat.totalBytes)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => clearCategory(cat)}
                    disabled={busy || cat.totalBytes === 0}
                    className="rounded-md border border-cem-elevated px-3 py-1 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
                  >
                    Clear
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-cem-elevated">
              <td className="px-4 py-3 font-semibold text-cem-text">Total</td>
              <td className="px-4 py-3 text-right font-semibold text-cem-text">{formatBytes(total)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}