import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.jsx'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/songs', label: 'Repertoire' },
  { to: '/setlists', label: 'Setlists' },
]

const linkClass = ({ isActive }) =>
  `text-sm font-medium ${isActive ? 'text-cem-amber' : 'text-cem-secondary hover:text-cem-text'}`

function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

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
                <NavLink key={link.to} to={link.to} end={link.to === '/'} className={linkClass}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
            {user ? (
              <div className="flex items-center gap-4 border-l border-cem-elevated pl-4">
                <span className="text-sm font-medium text-cem-text">{user.displayName}</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-sm font-medium text-cem-secondary hover:text-cem-text"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <NavLink to="/auth" end className={linkClass}>
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
    </div>
  )
}

export default AppLayout