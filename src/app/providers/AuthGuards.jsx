import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth.jsx'
import { getConsentStatus } from '../../data/repositories/minors.js'
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

// Hito 4: minors can't use any protected route until an ACTIVE guardian
// consent exists (features/minors-and-guardian-consent.feature scenario 2).
// Non-minors (or metadata-less users) pass straight through — zero behavior
// change for existing accounts. The server stays the authority (RLS + RPCs);
// this gate is the UX lock that swaps the app routes for the consent screen.
export function RequireGuardianConsent() {
  const { user } = useAuth()
  const isMinor = user?.isMinor === true
  const [consent, setConsent] = useState(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!isMinor || !user?.id) return undefined
    let cancelled = false
    setChecking(true)
    getConsentStatus(user.id)
      .then((row) => { if (!cancelled) setConsent(row) })
      .catch(() => { if (!cancelled) setConsent(null) })
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [user?.id, isMinor])

  if (!isMinor) return <Outlet />

  if (checking) {
    return <p className="text-sm text-cem-secondary">Checking guardian consent…</p>
  }

  if (consent?.status === 'active') return <Outlet />

  // No ACTIVE consent (locked account) → the consent screen, NOT the app routes.
  return (
    <GuardianConsentRequired
      onSuccess={async () => {
        try {
          const row = await getConsentStatus(user.id)
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