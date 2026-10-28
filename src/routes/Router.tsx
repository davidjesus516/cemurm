// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import Loadable from '../layouts/full/shared/loadable/Loadable';
//
// U3/S3 (odd/tasks/gerencial-template-import.md): the original template file
// created its own `createBrowserRouter(Router)` and exported the router. In
// CEMURM the array is mounted under the existing app router (src/app/router
// .jsx) as a subtree at path "dashboard", so the createBrowserRouter call is
// dropped here and the array is exported instead.
//
// MECHANICAL RELATIVE-IZATION, verbatim otherwise: the table was authored
// for a browser router whose root paths were absolute ("/", "/apps/blog
// /post", ...). Absolute paths in nested children escape their parent prefix
// in react-router v7, so every leading "/" is stripped. The 404 redirect is
// the exception: a relative target inside a catch-all resolves against the
// current path, so an unknown path would append "auth/404" forever. They stay
// absolute ("/dashboard/auth/404"). The demo screens now live under
// /dashboard/... (e.g. /dashboard → dashboard, /dashboard/auth/404 → error
// screen).
/* ***Layouts**** */
const FullLayout = Loadable(lazy(() => import('../layouts/full/FullLayout')));
const BlankLayout = Loadable(lazy(() => import('../layouts/blank/BlankLayout')));

// The demo ticket store is mounted once around the admin layout so a ticket
// created on /dashboard/apps/tickets/create exists when the list route renders
// (the template relied on a global SWR cache for that; local state needs a
// shared provider).
import { TicketProvider } from '../context/ticket-context';


// dashboards

const ModernDashboard = Loadable(lazy(() => import('../views/dashboards/modern')));

const Error = Loadable(lazy(() => import('../views/auth/error')));

//apps
const Blog = Loadable(lazy(() => import('../views/apps/blog/post')));
const BlogDetail = Loadable(lazy(() => import('../views/apps/blog/detail')));
const BlogAdd = Loadable(lazy(() => import('../views/apps/blog/create')));
const BlogEdit = Loadable(lazy(() => import('../views/apps/blog/edit')));
const BlogTable = Loadable(lazy(() => import('../views/apps/blog/manage-blog')));

const Notes = Loadable(lazy(() => import('../views/apps/notes')));

const Tickets = Loadable(lazy(() => import('../views/apps/tickets')));
const TicketCreate = Loadable(lazy(() => import('../views/apps/tickets/create')));

// pages
const TablesPage = Loadable(lazy(() => import('../views/pages/tables')));
const FormPage = Loadable(lazy(() => import('../views/pages/form')));
const UserProfilePage = Loadable(lazy(() => import('../views/pages/user-profile')));

//icons
const SolarIcon = Loadable(lazy(() => import('../views/icons/iconify')));

// authentication

const Login2 = Loadable(lazy(() => import('../views/auth/auth2/login')));

const Register2 = Loadable(lazy(() => import('../views/auth/auth2/register')));

const ForgotPassword2 = Loadable(lazy(() => import('../views/auth/auth2/forgot-password')));

const TwoSteps2 = Loadable(lazy(() => import('../views/auth/auth2/two-steps')));

const Maintainance = Loadable(lazy(() => import('../views/auth/maintenance')));

const Router = [
  {
    path: '',
    element: (
      <TicketProvider>
        <FullLayout />
      </TicketProvider>
    ),
    children: [
      { path: '', element: <ModernDashboard /> },

      { path: 'dashboards/modern', element: <ModernDashboard /> },

      { path: 'apps/blog/post', element: <Blog /> },
      { path: 'apps/blog/detail/:id', element: <BlogDetail /> },
      { path: 'apps/blog/create', element: <BlogAdd /> },
      { path: 'apps/blog/edit', element: <BlogEdit /> },
      { path: 'apps/blog/manage-blog', element: <BlogTable /> },

      { path: 'apps/notes', element: <Notes /> },

      { path: 'apps/tickets', element: <Tickets /> },
      { path: 'apps/tickets/create', element: <TicketCreate /> },

      { path: 'pages/tables', element: <TablesPage /> },
      { path: 'pages/form', element: <FormPage /> },
      { path: 'pages/user-profile', element: <UserProfilePage /> },

      { path: 'icons/iconify', element: <SolarIcon /> },


      { path: '*', element: <Navigate to="/dashboard/auth/404" /> },
    ],
  },
  {
    path: '',
    element: <BlankLayout />,
    children: [
      { path: 'auth/auth2/login', element: <Login2 /> },

      { path: 'auth/auth2/register', element: <Register2 /> },

      { path: 'auth/auth2/forgot-password', element: <ForgotPassword2 /> },

      { path: 'auth/auth2/two-steps', element: <TwoSteps2 /> },
      { path: 'auth/maintenance', element: <Maintainance /> },
      { path: '404', element: <Error /> },
      { path: 'auth/404', element: <Error /> },
      { path: '*', element: <Navigate to="/dashboard/auth/404" /> },
    ],
  },
];

export { Router };
