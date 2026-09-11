import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import { RedirectIfAuthed, RequireAuth } from './components/auth/AuthGuards.jsx'
import { AuthProvider } from './hooks/useAuth.jsx'
import Home from './pages/Home.jsx'
import Songs from './pages/Songs.jsx'
import SongDetail from './pages/SongDetail.jsx'
import Setlists from './pages/Setlists.jsx'
import SetlistDetail from './pages/SetlistDetail.jsx'
import Auth from './pages/Auth.jsx'
import Practice from './pages/Practice.jsx'
import NotFound from './pages/NotFound.jsx'

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Home /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/songs', element: <Songs /> },
          { path: '/songs/:id', element: <SongDetail /> },
          { path: '/songs/:id/practice', element: <Practice /> },
          { path: '/setlists', element: <Setlists /> },
          { path: '/setlists/:id', element: <SetlistDetail /> },
        ],
      },
      {
        element: <RedirectIfAuthed />,
        children: [{ path: '/auth', element: <Auth /> }],
      },
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