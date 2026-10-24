import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from './AppLayout.jsx'
import {
  RedirectIfAuthed,
  RequireAuth,
  RequireGuardianConsent,
} from './providers/AuthGuards.jsx'
import { AuthProvider } from './providers/useAuth.jsx'
// L5 — every route element below is React.lazy. Section 7.1 makes this a
// PREREQUISITE for the landing, not an optimisation: before it, the whole app was
// one 295 kB gzip chunk, so `motion` (measured at 43 kB gzip) rode along to every
// signed-in session that will never scroll it — a violation of plan 7.3's
// "landing chunk only" and of visual-system hard rule 5.
//
// The landing's own reason to be here is the same file's import of `motion`:
// only the landing chunk pulls it, so an authenticated session at /songs does not
// fetch it at all. That is the whole point of the split, and it is measurable in
// section 10 of odd/tasks/landing-page.md.
//
// WHAT IS DELIBERATELY STILL EAGER, and why:
//   AppLayout, AuthGuards, AuthProvider — auth must resolve before any route
//   renders, and AuthGuards imports the minors repository, so the Supabase
//   client is reachable from the entry chunk regardless of what is lazy. That is
//   the honest reason the landing cannot reach 120 kB yet: making the client lazy
//   is B3 in the plan's team split, a behaviour contract change owned by
//   davidjesus516, because it moves WHEN a missing-env throw fires.
//
// ROUTE ORDER IS UNCHANGED. Every entry below sits exactly where it sat before,
// with its own comment intact. Nothing was reordered, merged or removed — the
// top-level /external-display and /overlay/:token entries, /guardian/confirm
// outside the auth guards, and the '*' catch-all all keep their positions and
// their reasons.
//
// The Suspense fallback is `null`, matching the guards' own existing behaviour:
// RequireAuth returns literal null while the session loads, so a blank frame
// during a chunk fetch is not a new visual state on this app. It adds no markup
// and no class, which is what "invisible in the browser" requires.
const defer = (element) => <Suspense fallback={null}>{element}</Suspense>

const Home = lazy(() => import('../features/shell/pages/Home.jsx'))
const Songs = lazy(() => import('../features/repertoire/pages/Songs.jsx'))
const SongDetail = lazy(() => import('../features/repertoire/pages/SongDetail.jsx'))
const Setlists = lazy(() => import('../features/setlists/pages/Setlists.jsx'))
const SetlistDetail = lazy(() => import('../features/setlists/pages/SetlistDetail.jsx'))
const Gigs = lazy(() => import('../features/gigs/pages/Gigs.jsx'))
const GigDetail = lazy(() => import('../features/gigs/pages/GigDetail.jsx'))
const Bandmates = lazy(() => import('../features/bandmates/pages/Bandmates.jsx'))
const Organizations = lazy(() => import('../features/orgs/pages/Organizations.jsx'))
const Services = lazy(() => import('../features/services/pages/Services.jsx'))
const ServiceDetail = lazy(() => import('../features/services/pages/ServiceDetail.jsx'))
const SubstitutionAssignment = lazy(() => import('../features/services/pages/SubstitutionAssignment.jsx'))
const Rehearsals = lazy(() => import('../features/rehearsals/pages/Rehearsals.jsx'))
const RehearsalDetail = lazy(() => import('../features/rehearsals/pages/RehearsalDetail.jsx'))
const Notifications = lazy(() => import('../features/notifications/pages/Notifications.jsx'))
const StageMode = lazy(() => import('../features/stage/pages/StageMode.jsx'))
const Overlay = lazy(() => import('../features/stage/pages/Overlay.jsx'))
const ExternalDisplay = lazy(() => import('../features/stage/pages/ExternalDisplay.jsx'))
const Projection = lazy(() => import('../features/projection/pages/Projection.jsx'))
const ProjectionDisplay = lazy(() => import('../features/projection/pages/ProjectionDisplay.jsx'))
const Auth = lazy(() => import('../features/auth/pages/Auth.jsx'))
const GuardianConfirm = lazy(() => import('../features/auth/pages/GuardianConfirm.jsx'))
const Practice = lazy(() => import('../features/repertoire/pages/Practice.jsx'))
const PublicLibrary = lazy(() => import('../features/library/pages/PublicLibrary.jsx'))
const Profile = lazy(() => import('../features/library/pages/Profile.jsx'))
const Moderation = lazy(() => import('../features/moderation/pages/Moderation.jsx'))
const Storage = lazy(() => import('../features/settings/pages/Storage.jsx'))
const Settings = lazy(() => import('../features/settings/pages/Settings.jsx'))
const NotFound = lazy(() => import('../features/shell/pages/NotFound.jsx'))
const Landing = lazy(() => import('../features/landing/pages/Landing.jsx'))
// Dashboard template subtree (U3/S3, odd/tasks/gerencial-template-import.md).
// Mounted at "dashboard" as a sibling of the app's own route subtrees: it
// carries its own layout chrome (FullLayout), so it must NOT nest inside
// AppLayout. It is gated by RequireAuth + RequireGuardianConsent +
// RequireOrgOwner (active org_owner only), so it is no longer a public
// template surface. The theme boundary is part of the subtree.
// LAZY: every dashboard page element inside the table is already deferred by
// the template's own Loadable(lazy()) factory (src/routes/Router.tsx), so the
// route table below imports only the table and the chunk factories, never
// the dashboard views themselves.
import { Router as AdminRoutes } from '../routes/Router'
import { RequireOrgOwner } from './providers/RequireOrgOwner.jsx'
import AdminThemeBoundary from './providers/AdminThemeBoundary.jsx'

const router = createBrowserRouter([
  // Dashboard template (shadcn-dashboard). Deliberately FIRST so its subtree
  // is unambiguous, and OUTSIDE AppLayout so the template's own
  // sidebar/header are the only chrome on a dashboard route. The guards are
  // top-level siblings of AppLayout too, so the dashboard does not inherit
  // the member nav; RequireAuth sends a signed-out visitor to /auth,
  // RequireGuardianConsent keeps the Hito 4 minor gate, and RequireOrgOwner
  // admits only an active org_owner.
  {
    element: defer(<RequireAuth />),
    children: [
      {
        element: defer(<RequireGuardianConsent />),
        children: [
          {
            element: <RequireOrgOwner />,
            children: [
              {
                path: 'dashboard',
                element: <AdminThemeBoundary />,
                children: AdminRoutes,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: defer(<Home />) },
      {
        element: defer(<RequireAuth />),
        children: [
// Hito 4: minors without an ACTIVE guardian consent never reach the
          // app routes — RequireGuardianConsent swaps them for the lock screen.
          {
            element: defer(<RequireGuardianConsent />),
            children: [
              { path: '/songs', element: defer(<Songs />) },
              { path: '/songs/:id', element: defer(<SongDetail />) },
              { path: '/songs/:id/practice', element: defer(<Practice />) },
              { path: '/library', element: defer(<PublicLibrary />) },
              { path: '/moderation', element: defer(<Moderation />) },
              { path: '/profile/:userId', element: defer(<Profile />) },
              { path: '/setlists', element: defer(<Setlists />) },
              { path: '/setlists/:id', element: defer(<SetlistDetail />) },
              { path: '/setlists/:id/stage', element: defer(<StageMode />) },
              { path: '/gigs', element: defer(<Gigs />) },
              { path: '/gigs/:id', element: defer(<GigDetail />) },
              { path: '/bandmates', element: defer(<Bandmates />) },
              { path: '/organizations', element: defer(<Organizations />) },
              { path: '/services', element: defer(<Services />) },
              { path: '/services/:id', element: defer(<ServiceDetail />) },
              { path: '/services/:id/projection', element: defer(<Projection />) },
              { path: '/assignment/:serviceId', element: defer(<SubstitutionAssignment />) },
              { path: '/rehearsals', element: defer(<Rehearsals />) },
              { path: '/rehearsals/:id', element: defer(<RehearsalDetail />) },
              { path: '/notifications', element: defer(<Notifications />) },
              { path: '/settings', element: defer(<Settings />) },
              { path: '/settings/storage', element: defer(<Storage />) },
            ],
          },
        ],
      },
      {
        element: defer(<RedirectIfAuthed />),
        children: [{ path: '/auth', element: defer(<Auth />) }],
      },
      // Second-window projection display. A sibling of the RequireAuth subtree
      // but still INSIDE AppLayout, so it keeps the nav chrome: it is a route a
      // signed-in operator opens, not a public embed like the overlay below. It
      // carries no JWT of its own — the projector window is driven by the
      // BroadcastChannel from the operator's device. Verified by loading the URL:
      // it renders "Projection ready — waiting for the operator" without
      // redirecting to /auth.
      { path: '/projection/display', element: defer(<ProjectionDisplay />) },
      // The guardian's confirm link (Hito 4, 0031). Deliberately OUTSIDE
      // RequireAuth and outside RequireGuardianConsent: a guardian has no
      // account and no session, so either guard would bounce them to /auth and
      // dead-end the emailed link exactly as it was dead before this page
      // existed. Inside AppLayout, beside /auth, because it is an ordinary
      // signed-out page that happens to carry a one-shot capability.
      { path: '/guardian/confirm', element: defer(<GuardianConfirm />) },
      { path: '*', element: defer(<NotFound />) },
    ],
  },
  // Login-less clean view for a second screen or projector (Hito 5 #65).
  // OUTSIDE AppLayout and the auth guards for the same reason as the overlay
  // below: the second display gets no nav chrome and no session.
  {
    path: '/external-display',
    element: defer(<ExternalDisplay />),
  },
  // Public overlay URL for the OBS Browser Source (Hito 5 #66). Deliberately
  // OUTSIDE AppLayout and the auth guards: the CEF source gets no nav chrome
  // and no JWT — access is gated by a dedicated `overlay_sessions.access_token`
  // capability column (0032) plus the active/inactive status, via the
  // anon-visible overlay_state RPC. The param is that token, NOT the row's
  // primary key: the id is an ordinary identifier and is not accepted by the RPC.
  {
    path: '/overlay/:token',
    element: defer(<Overlay />),
  },
  // Marketing landing. OUTSIDE AppLayout and outside both auth guards for the
  // same reason as the two entries above: a public marketing surface gets no
  // signed-in nav chrome and no session. Inside AppLayout it would inherit the
  // 13-link nav, the sign-in state and the app's own footer — the app's
  // furniture on a page whose job is to be read before anyone signs in.
  //
  // THE PATH IS DELIBERATELY NEUTRAL, not a decision. Plan section 6 leaves it
  // open whether this page replaces `/` or lives at its own path, and option A
  // changes signed-in navigation, so the final wiring is the owner's call. At
  // `/landing` the page is reviewable now and that decision stays a one-line
  // change to this object either way.
  {
    path: '/landing',
    element: defer(<Landing />),
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