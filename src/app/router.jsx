import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from './AppLayout.jsx'
import {
  RedirectIfAuthed,
  RequireAuth,
  RequireGuardianConsent,
} from './providers/AuthGuards.jsx'
import { AuthProvider } from './providers/useAuth.jsx'
import Home from '../features/shell/pages/Home.jsx'
import Songs from '../features/repertoire/pages/Songs.jsx'
import SongDetail from '../features/repertoire/pages/SongDetail.jsx'
import Setlists from '../features/setlists/pages/Setlists.jsx'
import SetlistDetail from '../features/setlists/pages/SetlistDetail.jsx'
import Gigs from '../features/gigs/pages/Gigs.jsx'
import GigDetail from '../features/gigs/pages/GigDetail.jsx'
import Bandmates from '../features/bandmates/pages/Bandmates.jsx'
import Organizations from '../features/orgs/pages/Organizations.jsx'
import Services from '../features/services/pages/Services.jsx'
import ServiceDetail from '../features/services/pages/ServiceDetail.jsx'
import SubstitutionAssignment from '../features/services/pages/SubstitutionAssignment.jsx'
import Rehearsals from '../features/rehearsals/pages/Rehearsals.jsx'
import RehearsalDetail from '../features/rehearsals/pages/RehearsalDetail.jsx'
import Notifications from '../features/notifications/pages/Notifications.jsx'
import StageMode from '../features/stage/pages/StageMode.jsx'
import Overlay from '../features/stage/pages/Overlay.jsx'
import Auth from '../features/auth/pages/Auth.jsx'
import Practice from '../features/repertoire/pages/Practice.jsx'
import PublicLibrary from '../features/library/pages/PublicLibrary.jsx'
import Profile from '../features/library/pages/Profile.jsx'
import Moderation from '../features/moderation/pages/Moderation.jsx'
import Storage from '../features/settings/pages/Storage.jsx'
import Settings from '../features/settings/pages/Settings.jsx'
import NotFound from '../features/shell/pages/NotFound.jsx'

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
              { path: '/assignment/:serviceId', element: <SubstitutionAssignment /> },
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
      { path: '*', element: <NotFound /> },
    ],
  },
  // Public overlay URL for the OBS Browser Source (Hito 5 #66). Deliberately
  // OUTSIDE AppLayout and the auth guards: the CEF source gets no nav chrome
  // and no JWT — access is gated by the unguessable session uuid + the
  // active/inactive status via the anon-visible overlay_state RPC.
  {
    path: '/overlay/:sessionId',
    element: <Overlay />,
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