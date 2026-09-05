import { NavLink, Outlet } from 'react-router-dom'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/songs', label: 'Repertoire' },
  { to: '/setlists', label: 'Setlists' },
  { to: '/auth', label: 'Sign In' },
]

function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <NavLink to="/" className="text-xl font-bold text-gray-900">
            CEMURM
          </NavLink>
          <nav className="flex gap-4">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `text-sm font-medium ${
                    isActive
                      ? 'text-indigo-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <Outlet />
      </main>

      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          CEMURM &mdash; Community-Centered Musical Repertories Manager
        </div>
      </footer>
    </div>
  )
}

export default AppLayout
