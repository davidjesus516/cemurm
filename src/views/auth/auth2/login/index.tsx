import { Card } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import FullLogo from 'src/layouts/full/shared/logo/FullLogo'

const BoxedLogin = () => {
  return (
    <div className='flex min-h-screen items-center justify-center bg-cem-hover px-4 py-8'>
      <Card className='w-full max-w-md p-6 shadow-lg'>
        <div className='mx-auto w-fit'>
          <FullLogo />
        </div>

        <form
          className='w-full space-y-6'
          onSubmit={(event) => event.preventDefault()}
        >
          <div className='space-y-4'>
            <div className='space-y-1.5'>
              <Label
                htmlFor='email'
                className='text-sm font-normal text-cem-secondary-elevated'
              >
                Email*
              </Label>
              <Input
                id='email'
                type='email'
                placeholder='Enter your email'
                required
              />
            </div>
            <div className='space-y-1.5'>
              <Label
                htmlFor='password'
                className='text-sm font-normal text-cem-secondary-elevated'
              >
                Password*
              </Label>
              <Input
                id='password'
                type='password'
                placeholder='Enter your password'
                required
              />
            </div>
            <div className='flex flex-wrap items-center justify-between gap-4 text-sm'>
              <div className='flex items-center space-x-3'>
                <Checkbox id='remember' className='cursor-pointer' />
                <Label
                  htmlFor='remember'
                  className='cursor-pointer font-normal text-cem-secondary-elevated'
                >
                  Remember this device
                </Label>
              </div>
              <Link
                to='/dashboard/auth/auth2/forgot-password'
                className='text-sm font-medium transition-all hover:underline underline-offset-4'
              >
                Forgot Password?
              </Link>
            </div>
          </div>
          <Button size='lg' className='w-full rounded-lg'>
            Sign in
          </Button>
        </form>

        <div className='flex items-center justify-center gap-2 text-sm font-medium'>
          <p className='text-cem-secondary-elevated'>New to CEMURM?</p>
          <Link
            to='/dashboard/auth/auth2/register'
            className='text-sm font-medium text-cem-amber hover:underline'
          >
            Create an account
          </Link>
        </div>
      </Card>
    </div>
  )
}

export default BoxedLogin
