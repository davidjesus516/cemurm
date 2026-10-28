import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'

const Error = () => {
  return (
    <div className='flex min-h-screen items-center justify-center px-4 py-12'>
      <div className='max-w-md text-center'>
        <p className='text-7xl font-semibold tracking-tight text-cem-amber'>
          404
        </p>
        <h1 className='mt-4 text-2xl font-semibold text-cem-text'>
          Page not found
        </h1>
        <p className='mt-2 text-sm text-cem-secondary'>
          The page you are looking for does not exist or has moved.
        </p>
        <Link to='/dashboard' className={buttonVariants({ className: 'mt-6' })}>
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}

export default Error
