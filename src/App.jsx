import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import {
  RedirectIfAuthed,
  RequireAuth,
  RequireGuardianConsent,
} from './components/auth/AuthGuards.jsx'
import { AuthProvider } from './hooks/useAuth.jsx'
import Home from './pages/Home.jsx'
import Songs from './pages/Songs.jsx'
import SongDetail from './pages/SongDetail.jsx'
import Setlists from './pages/Setlists.jsx'
import SetlistDetail from './pages/SetlistDetail.jsx'
import Gigs from './pages/Gigs.jsx'
import GigDetail from './pages/GigDetail.jsx'
import Bandmates from './pages/Bandmates.jsx'
import Organizations from './pages/Organizations.jsx'
import Services from './pages/Services.jsx'
import ServiceDetail from './pages/ServiceDetail.jsx'
import Rehearsals from './pages/Rehearsals.jsx'
import RehearsalDetail from './pages/RehearsalDetail.jsx'
import Notifications from './pages/Notifications.jsx'
import StageMode from './pages/StageMode.jsx'
import Auth from './pages/Auth.jsx'
import Practice from './pages/Practice.jsx'
import PublicLibrary from './pages/PublicLibrary.jsx'
import Profile from './pages/Profile.jsx'
import Moderation from './pages/Moderation.jsx'
import Storage from './pages/Storage.jsx'
import Settings from './pages/Settings.jsx'
import Projection from './pages/Projection.jsx'
import ProjectionDisplay from './pages/ProjectionDisplay.jsx'
import NotFound from './pages/NotFound.jsx'

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Home /> },
      {
        element: <RequireAuth />,
        children: [
// Hito 4: minors without an ACTIVE guardian consent never reach the
          // app routes — RequireGuardianConsent swaps them for the lock screen.
          {
            element: <RequireGuardianConsent />,
            children: [
              { path: '/songs', element: <Songs /> },
              { path: '/songs/:id', element: <SongDetail /> },
              { path: '/songs/:id/practice', element: <Practice /> },
              { path: '/library', element: <PublicLibrary /> },
              { path: '/moderation', element: <Moderation /> },
              { path: '/profile/:userId', element: <Profile /> },
              { path: '/setlists', element: <Setlists /> },
              { path: '/setlists/:id', element: <SetlistDetail /> },
              { path: '/setlists/:id/stage', element: <StageMode /> },
              { path: '/gigs', element: <Gigs /> },
              { path: '/gigs/:id', element: <GigDetail /> },
              { path: '/bandmates', element: <Bandmates /> },
              { path: '/organizations', element: <Organizations /> },
              { path: '/services', element: <Services /> },
              { path: '/services/:id', element: <ServiceDetail /> },
              { path: '/services/:id/projection', element: <Projection /> },
              { path: '/rehearsals', element: <Rehearsals /> },
              { path: '/rehearsals/:id', element: <RehearsalDetail /> },
              { path: '/notifications', element: <Notifications /> },
              { path: '/settings', element: <Settings /> },
              { path: '/settings/storage', element: <Storage /> },
            ],
          },
        ],
      },
      {
        element: <RedirectIfAuthed />,
        children: [{ path: '/auth', element: <Auth /> }],
      },
      { path: '/projection/display', element: <ProjectionDisplay /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App