import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { CemurmMark } from 'src/layouts/full/shared/logo/FullLogo'

const Maintenance = () => {
  return (
    <div className='flex min-h-screen items-center justify-center bg-cem-surface px-4 py-12'>
      <div className='max-w-md text-center'>
        <CemurmMark className='mx-auto size-10' />
        <h1 className='mt-6 text-2xl font-semibold text-cem-text'>
          Maintenance mode
        </h1>
        <p className='mt-2 text-sm text-cem-secondary'>
          CEMURM is under maintenance. Check back soon.
        </p>
        <Link to='/dashboard' className={buttonVariants({ className: 'mt-6' })}>
          Back to admin
        </Link>
      </div>
    </div>
  )
}

export default Maintenance
