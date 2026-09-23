// Community moderation hook (Hito 4 — community-moderation).
// Wraps the moderation data layer with React state management.
// Provides queue loading, report filing, decision actions, and appeal flow.

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import * as moderation from '../lib/moderation.js'

export function useModeration() {
  const { user } = useAuth()
  const [isMod, setIsMod] = useState(false)
  const [isSystemAdmin, setIsSystemAdmin] = useState(false)
  const [queue, setQueue] = useState([])
  const [myCases, setMyCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reporting, setReporting] = useState(null)
  const [deciding, setDeciding] = useState(null)
  const [appealing, setAppealing] = useState(null)

  // Reviewer status on mount: community_moderator (decides open cases) and/
  // or system_admin (the ONLY role that decides escalated cases, 0020).
  // Stale-response guard (repo pattern): on rapid identity change the slow
  // response from the previous user must not set flags for the new one.
  // `loading` is deliberately NOT cleared here — the queue/my-cases fetches
  // below own it, so the page never flashes an empty state mid-swap.
  useEffect(() => {
    if (!user) {
      setIsMod(false)
      setIsSystemAdmin(false)
      setLoading(false)
      return undefined
    }
    let cancelled = false
    Promise.all([moderation.isModerator(user.id), moderation.isSystemAdmin(user.id)])
      .then(([mod, admin]) => {
        if (cancelled) return
        setIsMod(mod)
        setIsSystemAdmin(admin)
      })
      .catch(() => {
        if (cancelled) return
        setIsMod(false)
        setIsSystemAdmin(false)
      })
    return () => { cancelled = true }
  }, [user])

  /** Fetch the moderation queue (reviewers only — mod and/or system admin). */
  const fetchQueue = useCallback(async () => {
    if (!user || (!isMod && !isSystemAdmin)) return
    setLoading(true)
    setError('')
    try {
      // Moderators: every open case (incl. open appeals) + escalated rows when
      // they can actually decide them. A pure system_admin gets the escalated
      // slice only — never dead decision buttons on moderator-gated cases.
      const data = await moderation.getModerationQueue(
        isMod ? { includeEscalated: isSystemAdmin } : { escalatedOnly: true },
      )
      setQueue(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user, isMod, isSystemAdmin])

  /** Fetch the contributor's OWN cases (signed-in non-reviewers). */
  const fetchMyCases = useCallback(async () => {
    if (!user || isMod || isSystemAdmin) return
    setLoading(true)
    setError('')
    try {
      const data = await moderation.getMyModerationCases()
      setMyCases(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user, isMod, isSystemAdmin])

  useEffect(() => {
    if (isMod || isSystemAdmin) fetchQueue()
  }, [isMod, isSystemAdmin, fetchQueue])

  useEffect(() => {
    if (user && !isMod && !isSystemAdmin) fetchMyCases()
  }, [user, isMod, isSystemAdmin, fetchMyCases])

  /** File a report on a public entry. */
  const reportEntry = useCallback(async (publicSongId, reason) => {
    if (!user) return null
    setReporting(publicSongId)
    setError('')
    try {
      await moderation.reportPublicSong(publicSongId, reason)
      return true
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setReporting(null)
    }
  }, [user])

  /** Decide a moderation case (moderator on open cases; system_admin on escalated — server enforces). */
  const decideCase = useCallback(async (caseId, decision, notes) => {
    if (!user || (!isMod && !isSystemAdmin)) return null
    setDeciding(caseId)
    setError('')
    try {
      await moderation.decideCase(caseId, decision, notes)
      // Refresh the queue after decision
      await fetchQueue()
      return true
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setDeciding(null)
    }
  }, [user, isMod, isSystemAdmin, fetchQueue])

  /** File an appeal against a decided case (contributor path — own cases). */
  const appealCase = useCallback(async (caseId, reason) => {
    if (!user) return null
    setAppealing(caseId)
    setError('')
    try {
      await moderation.fileAppeal(caseId, reason)
      // The new appeal row belongs to the contributor too — refetch so the
      // list shows it and the original case swaps to "already filed".
      if (!isMod && !isSystemAdmin) await fetchMyCases()
      return true
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setAppealing(null)
    }
  }, [user, isMod, isSystemAdmin, fetchMyCases])

  /** Check if user has already reported an entry for a specific reason. */
  const checkReported = useCallback(async (publicSongId, reason) => {
    if (!user) return false
    return moderation.hasReported(publicSongId, reason)
  }, [user])

  /** Refresh the current view (queue for reviewers, own cases otherwise). */
  const refresh = useCallback(() => {
    if (isMod || isSystemAdmin) fetchQueue()
    else fetchMyCases()
  }, [isMod, isSystemAdmin, fetchQueue, fetchMyCases])

  return {
    isMod,
    isSystemAdmin,
    queue,
    myCases,
    loading,
    error,
    reporting,
    deciding,
    appealing,
    reportEntry,
    decideCase,
    appealCase,
    checkReported,
    refresh,
    REPORT_REASONS: moderation.REPORT_REASONS || [
      'copyright_violation',
      'offensive_content',
      'spam_duplicate',
      'wrong_metadata',
    ],
  }
}
