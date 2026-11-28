import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../app/providers/useAuth.jsx'
import {
  getOnboardingState,
  saveOnboardingState,
} from '../../data/repositories/onboardingInvites.js'
import { computeProgress, firstIncompleteStep } from '../../domain/onboarding/progress.js'

// The four tracked steps are derived from two sources: account creation is a
// fact of having a session; the other three are flags in the preferences kv.
export function useOnboarding() {
  const { user } = useAuth()
  const [flags, setFlags] = useState({})
  const [loading, setLoading] = useState(Boolean(user))

  useEffect(() => {
    let alive = true
    if (!user?.id) {
      setFlags({})
      setLoading(false)
      return () => {
        alive = false
      }
    }
    setLoading(true)
    getOnboardingState(user.id)
      .then((state) => {
        if (alive) setFlags(state)
      })
      .catch(() => {
        if (alive) setFlags({})
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [user?.id])

  const steps = useMemo(
    () => ({ ...flags, accountCreated: Boolean(user) }),
    [flags, user],
  )

  const update = useCallback(
    async (patch) => {
      if (!user?.id) return
      await saveOnboardingState(user.id, patch)
      setFlags((prev) => ({ ...prev, ...patch }))
    },
    [user?.id],
  )

  return {
    steps,
    loading,
    progress: computeProgress(steps),
    resumeStep: firstIncompleteStep(steps),
    update,
  }
}
