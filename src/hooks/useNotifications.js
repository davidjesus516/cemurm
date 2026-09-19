// Notifications state hook (Hito 3 PR#2, task 2.3 — notifications
// realtime scenario + Off1/Off2 surfaces). One instance per consumer
// (AppLayout badge + /notifications page each hold one); convergence across
// instances is by the realtime echo of the other instance's read_at UPDATEs
// (postgres_changes echoes the user's own writes, unlike broadcast).
//
// Reads go through src/lib/notifications.js, which owns the IDB read-through
// (offlineCache.js kv keys `notifications:<userId>` / `notifications-unread:
// <userId>` — additive keys only, no store/schema/DB_VERSION change).
// Realtime refetches are debounced 150ms (useSharedSetlist precedent) so a
// postgres_changes burst coalesces into one fetch. Listeners mirror
// useComments (online + cemurm:sync-done) plus a focus refetch (design
// fallback for the non-PK realtime filter).
//
// Off2 delta-summary synthesis + consume land in 3.6 — the `summary` state
// slot and `consumeSummary` are part of the 2.3 return contract so the page
// surface is stable; today summary is always null.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import * as notifications from '../lib/notifications.js'

// One edit can arrive as several postgres_changes events (e.g. markAllRead
// touching N rows) — coalesce the burst into one refetch.
const REFETCH_DEBOUNCE_MS = 150

export function useNotifications() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [summary, setSummary] = useState(null)
  const rowsRef = useRef(rows)

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [fetchedRows, fetchedUnread] = await Promise.all([
        notifications.listNotifications(user.id),
        notifications.unreadCount(user.id),
      ])
      setRows(fetchedRows)
      setUnreadCount(fetchedUnread)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Read on mount, when connectivity returns, when an offline drain commits,
  // and when the tab regains focus (design focus-refetch fallback).
  useEffect(() => {
    if (!user) return undefined
    refresh()
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    const refetch = () => refresh()
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener('cemurm:sync-done', refetch)
    window.addEventListener('focus', refetch)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('cemurm:sync-done', refetch)
      window.removeEventListener('focus', refetch)
    }
  }, [user, refresh])

  // Live per-user channel (2.2): any row change for me refetches (debounced).
  // postgres_changes also echoes MY OWN read_at UPDATEs — that echo is what
  // converges a second useNotifications instance (the badge).
  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    let unsubscribe = null
    let timer = null
    const scheduleRefetch = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        refresh()
      }, REFETCH_DEBOUNCE_MS)
    }
    notifications.subscribeNotifications(user.id, scheduleRefetch).then((off) => {
      if (cancelled) {
        off()
        return
      }
      unsubscribe = off
    })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      unsubscribe?.()
    }
  }, [user, refresh])

  /** Mark one row read — optimistic local state; the echo converges peers. */
  const markRead = useCallback(async (id) => {
    if (!user) return
    const wasUnread = !rowsRef.current.find((row) => row.id === id)?.read
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, read: true } : row)))
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1))
    try {
      await notifications.markRead(user.id, id)
    } catch {
      refresh() // server read wins on failure — reverts the optimism
    }
  }, [user, refresh])

  /** Mark all read (Feed3) — same optimistic + echo-convergence contract. */
  const markAllRead = useCallback(async () => {
    if (!user) return
    setRows((prev) => prev.map((row) => ({ ...row, read: true })))
    setUnreadCount(0)
    try {
      await notifications.markAllRead(user.id)
    } catch {
      refresh()
    }
  }, [user, refresh])

  // 3.6 synthesizes the Off2 summary from the fetch delta and persists
  // lastSeenUnread; consumeSummary clears it. Stub until then.
  const consumeSummary = useCallback(() => setSummary(null), [])

  return useMemo(() => ({
    rows,
    unreadCount,
    loading,
    online,
    summary,
    consumeSummary,
    markRead,
    markAllRead,
    refresh,
  }), [rows, unreadCount, loading, online, summary, consumeSummary, markRead, markAllRead, refresh])
}