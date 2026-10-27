import { Outlet, useLocation } from 'react-router-dom'
import ScrollToTop from 'src/components/shared/ScrollToTop'
import DemoNotice from 'src/components/shared/DemoNotice'

const BlankLayout = () => {
  const { pathname } = useLocation()
  // The template's auth screens live under /dashboard/auth/* and are visual demos:
  // they do not call Supabase Auth. The 404 and maintenance pages share this
  // layout but are real template pages, so they are excluded from the notice.
  const isAuthDemo =
    pathname.startsWith('/dashboard/auth/') &&
    pathname !== '/dashboard/auth/404' &&
    pathname !== '/dashboard/auth/maintenance'

  return (
    <ScrollToTop>
      <>
        {isAuthDemo && (
          <div className='bg-cem-hover px-4 py-3'>
            <DemoNotice className='mx-auto max-w-3xl'>
              Demo auth screen — this form does not sign in. The real CEMURM
              login lives at /auth.
            </DemoNotice>
          </div>
        )}
        <Outlet />
      </>
    </ScrollToTop>
  )
}

export default BlankLayout
