import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './providers/useAuth.jsx'
import { useNotifications } from '../hooks/shared/useNotifications.js'
import FeedbackForm from '../features/feedback/components/FeedbackForm.jsx'

const navLinks = [
  { to: '/', label: 'Home', testId: 'nav-home' },
  { to: '/songs', label: 'Repertoire', testId: 'nav-songs' },
  { to: '/library', label: 'Library', testId: 'nav-library' },
  { to: '/moderation', label: 'Moderation', testId: 'nav-moderation' },
  { to: '/setlists', label: 'Setlists', testId: 'nav-setlists' },
  { to: '/gigs', label: 'Gigs', testId: 'nav-gigs' },
  { to: '/bandmates', label: 'Bandmates', testId: 'nav-bandmates' },
  { to: '/organizations', label: 'Organizations', testId: 'nav-organizations' },
  { to: '/services', label: 'Services', testId: 'nav-services' },
  { to: '/rehearsals', label: 'Rehearsals', testId: 'nav-rehearsals' },
  { to: '/notifications', label: 'Notifications', testId: 'nav-notifications' },
  { to: '/settings', label: 'Settings', testId: 'nav-settings' },
  { to: '/settings/storage', label: 'Storage', testId: 'nav-storage' },
]

const linkClass = ({ isActive }) =>
  `text-sm font-medium ${isActive ? 'text-cem-amber' : 'text-cem-secondary hover:text-cem-text'}`

/**
 * Unread badge on the Notifications nav link (Feed7, task 2.5). Rendered
 * only when authed; hidden at 0; capped at "99+". Its useNotifications
 * instance converges with the feed page via the realtime echo of read_at
 * UPDATEs.
 */
function UnreadBadge() {
  const { unreadCount } = useNotifications()
  if (!unreadCount) return null
  return (
    <span className="rounded-full bg-cem-amber px-1.5 py-0.5 text-[10px] font-bold leading-none text-cem-base">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )
}

function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col bg-cem-base">
      <header className="bg-cem-surface shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <NavLink to="/" className="text-xl font-bold text-cem-text">
            CEMURM
          </NavLink>
          <div className="flex items-center gap-4">
            <nav className="flex gap-4">
              {navLinks.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.to === '/' || link.to === '/settings'} className={linkClass} data-testid={link.testId}>
                  <span className="flex items-center gap-1.5">
                    {link.label}
                    {link.to === '/notifications' && user && <UnreadBadge />}
                  </span>
                </NavLink>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              data-testid="feedback-button"
              className="text-sm font-medium text-cem-secondary hover:text-cem-text"
            >
              Feedback
            </button>
            {user ? (
              <div className="flex items-center gap-4 border-l border-cem-elevated pl-4">
                <span className="text-sm font-medium text-cem-text">{user.displayName}</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  data-testid="logout-button"
                  className="text-sm font-medium text-cem-secondary hover:text-cem-text"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <NavLink to="/auth" end className={linkClass} data-testid="login-button">
                Sign In
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <Outlet />
      </main>

      <footer className="bg-cem-surface border-t border-cem-elevated">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-cem-secondary">
          CEMURM &mdash; Community-Centered Musical Repertories Manager
        </div>
      </footer>

      {feedbackOpen && <FeedbackForm onClose={() => setFeedbackOpen(false)} />}
    </div>
  )
}

export default AppLayout