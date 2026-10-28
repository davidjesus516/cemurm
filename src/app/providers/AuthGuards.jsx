import { useCallback, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth.jsx'
import { getAgeStatus, getConsentStatus } from '../../data/repositories/minors.js'
import DateOfBirthRequired from '../../features/auth/pages/DateOfBirthRequired.jsx'
import GuardianConsentRequired from '../../features/auth/pages/GuardianConsentRequired.jsx'

// Redirects signed-out users to /auth, preserving the intended destination.
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  return <Outlet />
}

// Hito 4 + WU2: two server-owned gates in front of every protected route.
//   1. date of birth (scenario 1, D2): an account that has not declared a
//      date of birth is NOT an adult — it is UNKNOWN, and unknown is blocked.
//      This renders DateOfBirthRequired in place of the app routes.
//   2. guardian consent (scenario 2): a KNOWN minor without an ACTIVE consent
//      is locked behind GuardianConsentRequired, exactly as Hito 4 shipped it.
// Everything else reaches <Outlet />.
//
// The age facts come from public.my_age_status (0030) — the server is the only
// source that can answer them, because date_of_birth / is_minor have no client
// select grant. user.isMinor is deliberately NOT consulted: it comes from
// GoTrue user_metadata, which the account holder can edit through updateUser(),
// and treating it as authoritative is the bypass this gate exists to close.
export function RequireGuardianConsent() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  // null = not read yet; readFailed = the read itself failed. Both keep the
  // user behind the dob step — neither is evidence of adulthood.
  const [age, setAge] = useState(null)
  const [readFailed, setReadFailed] = useState(false)
  const [consent, setConsent] = useState(null)
  const [checkingConsent, setCheckingConsent] = useState(false)

  // Read the age status ONCE per user id and keep it for the component's
  // lifetime — the deps are [userId] only, so no re-render can trigger a
  // re-read and there is no loop. A reload re-runs it, which is the point.
  const refreshAge = useCallback(async () => {
    try {
      const status = await getAgeStatus()
      setAge(status)
      setReadFailed(false)
    } catch {
      // Fail-closed: an unreadable age status is not an adult. The step is
      // rendered with the read-failure notice and a "Check again" action.
      setAge(null)
      setReadFailed(true)
    }
  }, [])

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    setAge(null)
    setReadFailed(false)
    getAgeStatus()
      .then((status) => { if (!cancelled) setAge(status) })
      .catch(() => { if (!cancelled) { setAge(null); setReadFailed(true) } })
    return () => { cancelled = true }
  }, [userId])

  const isMinor = age?.isMinor === true

  useEffect(() => {
    if (!userId || !isMinor) return undefined
    let cancelled = false
    setCheckingConsent(true)
    getConsentStatus(userId)
      .then((row) => { if (!cancelled) setConsent(row) })
      .catch(() => { if (!cancelled) setConsent(null) })
      .finally(() => { if (!cancelled) setCheckingConsent(false) })
    return () => { cancelled = true }
  }, [userId, isMinor])

  // Still deciding. Renders nothing usable rather than guessing.
  if (age === null && !readFailed) {
    return <p className="text-sm text-cem-secondary">Checking age requirements…</p>
  }

  // Gate 1: unknown date of birth — OR an age status we could not read. The
  // fallback case matters as much as the first: falling through to <Outlet />
  // on a failed read would hand the app to exactly the accounts this change
  // exists to hold back.
  if (readFailed || age.dobKnown !== true) {
    return (
      <DateOfBirthRequired
        readFailed={readFailed}
        onSuccess={refreshAge}
        onRetry={refreshAge}
      />
    )
  }

  // Declared adult: the app, no questions asked.
  if (!isMinor) return <Outlet />

  // Gate 2: a known minor.
  if (checkingConsent) {
    return <p className="text-sm text-cem-secondary">Checking guardian consent…</p>
  }

  if (consent?.status === 'active') return <Outlet />

  // No ACTIVE consent (locked account) → the consent screen, NOT the app routes.
  return (
    <GuardianConsentRequired
      onSuccess={async () => {
        try {
          const row = await getConsentStatus(userId)
          setConsent(row)
        } catch {
          // Transient read failure — the next navigation re-checks.
        }
      }}
    />
  )
}

// Redirects signed-in users away from /auth to the intended destination or home.
export function RedirectIfAuthed() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (user) {
    return <Navigate to={location.state?.from?.pathname || '/'} replace />
  }

  return <Outlet />
}