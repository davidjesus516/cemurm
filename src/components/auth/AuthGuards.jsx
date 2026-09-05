import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.jsx'

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