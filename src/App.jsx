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
import SubstitutionAssignment from './pages/SubstitutionAssignment.jsx'
import Rehearsals from './pages/Rehearsals.jsx'
import RehearsalDetail from './pages/RehearsalDetail.jsx'
import Notifications from './pages/Notifications.jsx'
import StageMode from './pages/StageMode.jsx'
import Overlay from './pages/Overlay.jsx'
import GuardianConfirm from './pages/GuardianConfirm.jsx'
import GuardianRevoke from './pages/GuardianRevoke.jsx'
import Auth from './pages/Auth.jsx'
import Practice from './pages/Practice.jsx'
import PublicLibrary from './pages/PublicLibrary.jsx'
import Profile from './pages/Profile.jsx'
import Moderation from './pages/Moderation.jsx'
import Storage from './pages/Storage.jsx'
import Settings from './pages/Settings.jsx'
import NotFound from './pages/NotFound.jsx'

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Home /> },
      {
        element: <RequireAuth />,
        children: [
// Hito 4, revised by 0031: a minor reaches the app routes only with an ACTIVE
          // consent. Since 0031 a submitted request is 'pending' and stays locked,
          // so this gate is no longer a formality a minor walks past in a form —
          // it is the only thing standing between a request and an open account.
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
  // The guardian's two links (WU4 / T4.4), same reasoning as /overlay above and
  // for a sharper reason: the primary reader of these pages is a parent with NO
  // CEMURM account, who cannot sign in and must not have to. Authorization is
  // the 128-bit revocation_token in the query string — the capability 0017
  // shipped and 0031's anon-granted confirm RPC checks one-shot.
  //
  // Putting them outside RequireAuth is not a relaxation: RequireGuardianConsent
  // gates the minor's own account, and these pages act on a ledger row through a
  // login-less RPC, so the guard has nothing to say about them. Both pages
  // require a real click (never auto-confirm on load) and strip the query string
  // the moment they read it — see src/lib/guardianLink.js.
  {
    path: '/guardian/confirm',
    element: <GuardianConfirm />,
  },
  {
    path: '/guardian/revoke',
    element: <GuardianRevoke />,
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