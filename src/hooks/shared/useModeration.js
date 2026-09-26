// Community moderation hook (Hito 4 — community-moderation).
// Wraps the moderation data layer with React state management.
// Provides queue loading, report filing, decision actions, and appeal flow.

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../app/providers/useAuth.jsx'
import * as moderation from '../../data/repositories/moderation.js'

export function useModeration() {
  const { user } = useAuth()
  const [isMod, setIsMod] = useState(false)
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reporting, setReporting] = useState(null)
  const [deciding, setDeciding] = useState(null)
  const [appealing, setAppealing] = useState(null)

  // Check moderator status on mount
  useEffect(() => {
    if (!user) {
      setIsMod(false)
      setLoading(false)
      return
    }
    moderation.isModerator(user.id).then((result) => {
      setIsMod(result)
      setLoading(false)
    }).catch(() => {
      setIsMod(false)
      setLoading(false)
    })
  }, [user])

  /** Fetch the moderation queue (moderators only). */
  const fetchQueue = useCallback(async () => {
    if (!user || !isMod) return
    setLoading(true)
    setError('')
    try {
      const data = await moderation.getModerationQueue()
      setQueue(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user, isMod])

  useEffect(() => {
    if (isMod) fetchQueue()
  }, [isMod, fetchQueue])

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

  /** Decide a moderation case. */
  const decideCase = useCallback(async (caseId, decision, notes) => {
    if (!user || !isMod) return null
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
  }, [user, isMod, fetchQueue])

  /** File an appeal against a decided case. */
  const appealCase = useCallback(async (caseId, reason) => {
    if (!user) return null
    setAppealing(caseId)
    setError('')
    try {
      await moderation.fileAppeal(caseId, reason)
      return true
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setAppealing(null)
    }
  }, [user])

  /** Check if user has already reported an entry for a specific reason. */
  const checkReported = useCallback(async (publicSongId, reason) => {
    if (!user) return false
    return moderation.hasReported(publicSongId, reason)
  }, [user])

  /** Refresh the queue. */
  const refresh = useCallback(() => {
    if (isMod) fetchQueue()
  }, [isMod, fetchQueue])

  return {
    isMod,
    queue,
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
