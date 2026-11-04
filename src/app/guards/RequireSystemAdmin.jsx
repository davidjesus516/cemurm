// Gate for the feedback triage inbox at /feedback-triage.
//
// It is mounted as a React Router LAYOUT route, so it must render <Outlet />
// when the account may pass: `children` is always undefined for an element
// route and rendering it is what made the page blank for administrators.
//
// Non-admins get an explicit access-denied state instead of a redirect
// (features/feedback-triage.feature @access: "I see an access denied state").
// Fail-closed: a read error denies access rather than opening the console.
import { Link, Outlet } from 'react-router-dom'
import { useSystemAdmin } from '../../features/feedback-triage/hooks/useSystemAdmin'

export function RequireSystemAdmin() {
  const { isAdmin, loading } = useSystemAdmin()

  if (loading) {
    return null
  }

  if (!isAdmin) {
    return (
      <div role="alert" className="p-4">
        <h1 className="text-xl font-semibold text-cem-text mb-2">Access denied</h1>
        <p className="text-cem-secondary mb-4">
          This page is limited to system administrators.
        </p>
        <Link to="/" className="text-cem-text underline">
          Back to home
        </Link>
      </div>
    )
  }

  return <Outlet />
}
