// Gate for the organization owner's dashboard at /dashboard.
//
// It sits inside RequireAuth and RequireGuardianConsent, so a signed-out
// visitor is already redirected to /auth and a minor without active guardian
// consent is held at the lock screen. This component answers the one extra
// question the dashboard needs: is this account an ACTIVE owner of an
// organization?
//
// Owner-only, not manager-wide: org_admin, branch_admin, instructor and the
// platform system_admin role do not pass. Fail-closed: a read error denies
// access rather than opening the console.
import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './useAuth.jsx'
import { getMyOrganizations } from '../../data/repositories/orgRepertoire.js'
import { isOrgOwner } from './orgOwner.js'

export function RequireOrgOwner() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [allowed, setAllowed] = useState(null)

  useEffect(() => {
    if (!userId) {
      setAllowed(false)
      return undefined
    }

    let cancelled = false
    getMyOrganizations()
      .then((memberships) => {
        if (!cancelled) setAllowed(isOrgOwner(memberships))
      })
      .catch(() => {
        // Fail-closed: an unreadable membership is not a licence.
        if (!cancelled) setAllowed(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  if (allowed === null) return null
  if (!allowed) return <Navigate to="/" replace />
  return <Outlet />
}
