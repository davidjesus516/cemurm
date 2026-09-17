// Realtime collaboration surface for one shared setlist (Hito 3 PR#2b).
// 2.4 (setlists R2, design D6 data flow): a member's write lands as a
// postgres_changes event → debounced refetch, so collaborators see the edit
// within 2 seconds. 2.5 adds the client advisory lock on top (below).
//
// The page passes its OWN setlists refresh (the silent variant) as
// `onRemoteChange`: a second useSetlists() instance would hold separate
// state and the page would never see this hook's refetch. Teardown on
// unmount removes every channel (presence-safe cleanup) and releases any
// lock this session still holds.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import * as setlistStore from '../lib/setlists.js'
import { applyLock, isLockStale } from '../lib/setlistCollab.js'

// An item edit also bumps setlists.updated_at (0006 0.6 trigger), so one edit
// arrives as two postgres_changes events — coalesce a burst into one refetch.
const REFETCH_DEBOUNCE_MS = 150

// Advisory locks are ephemeral broadcasts with no presence channel: the
// holder re-broadcasts its lock on this interval so a crashed tab expires by
// LOCK_TTL_MS (setlistCollab.js) instead of blocking co-editors forever.
const LOCK_HEARTBEAT_MS = 15000

export function useSharedSetlist(setlistId, { actorName, onRemoteChange } = {}) {
  const { user } = useAuth()
  const [locks, setLocks] = useState({})
  const [conflict, setConflict] = useState(null)
  const locksRef = useRef(locks)
  const refetchTimer = useRef(null)
  const lockChannelRef = useRef(null)

  useEffect(() => {
    locksRef.current = locks
  }, [locks])

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current)
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null
      onRemoteChange?.()
    }, REFETCH_DEBOUNCE_MS)
  }, [onRemoteChange])

  useEffect(() => {
    if (!user || !setlistId) return undefined

    const offRealtime = setlistStore.subscribeSetlistRealtime(setlistId, (payload) => {
      scheduleRefetch()
      // Conflict (2.5, R3): an item change touching the song I am currently
      // editing (my own lock) means someone wrote it concurrently. My own
      // save releases the lock before the server call, so my event arrives
      // with no lock held — no self-conflict.
      if (payload.table === 'setlist_items') {
        const songId = payload.new?.song_id ?? payload.old?.song_id
        if (songId && locksRef.current[songId]?.userId === user.id) {
          setConflict({ songId, ts: Date.now() })
        }
      }
    })

    const channel = setlistStore.openLockChannel(setlistId, (payload) => {
      setLocks((prev) => applyLock(prev, payload))
    })
    lockChannelRef.current = channel

    const heartbeat = setInterval(() => {
      for (const [songId, lock] of Object.entries(locksRef.current)) {
        if (lock.userId === user.id) {
          channel.send({ userId: user.id, songId, actor: lock.actor, locked: true, ts: Date.now() })
        }
      }
    }, LOCK_HEARTBEAT_MS)

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current)
      clearInterval(heartbeat)
      // Presence-safe release: a vanished tab must not leave co-editors
      // blocked ("until save/cancel" cannot cover a closed page).
      for (const [songId, lock] of Object.entries(locksRef.current)) {
        if (lock.userId === user.id) {
          channel.send({ userId: user.id, songId, locked: false })
        }
      }
      channel.close()
      lockChannelRef.current = null
      offRealtime()
    }
  }, [setlistId, user, scheduleRefetch])

  /**
   * Take the advisory lock on a song before editing it. Returns the blocking
   * lock ({userId, actor}) when another member holds it, null when held.
   */
  const acquireLock = useCallback((songId) => {
    if (!user || !setlistId) return null
    const held = locksRef.current[songId]
    if (held && held.userId !== user.id && !isLockStale(held)) return held
    const payload = { userId: user.id, songId, actor: actorName || null, locked: true, ts: Date.now() }
    setLocks((prev) => applyLock(prev, payload))
    lockChannelRef.current?.send(payload)
    return null
  }, [user, setlistId, actorName])

  /** Release a song lock on save/cancel. */
  const releaseLock = useCallback((songId) => {
    if (!user || !setlistId) return
    const payload = { userId: user.id, songId, locked: false, ts: Date.now() }
    setLocks((prev) => applyLock(prev, payload))
    lockChannelRef.current?.send(payload)
  }, [user, setlistId])

  /** Conflict toast — "Accept server version": drop my lock, pull the server. */
  const acceptServerVersion = useCallback(() => {
    if (!conflict) return
    releaseLock(conflict.songId)
    setConflict(null)
    onRemoteChange?.()
  }, [conflict, releaseLock, onRemoteChange])

  /** Conflict toast — "Keep my changes": keep the local state and continue. */
  const keepMyChanges = useCallback(() => setConflict(null), [])

  return { locks, conflict, acquireLock, releaseLock, acceptServerVersion, keepMyChanges }
}
