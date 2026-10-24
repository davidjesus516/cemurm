import { Card } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import FullLogo from 'src/layouts/full/shared/logo/FullLogo'

const BoxedRegister = () => {
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
                htmlFor='name'
                className='text-sm font-normal text-cem-secondary-elevated'
              >
                Name*
              </Label>
              <Input
                id='name'
                type='text'
                placeholder='Enter your name'
                required
              />
            </div>
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
          </div>
          <Button size='lg' className='w-full rounded-lg'>
            Create account
          </Button>
        </form>

        <div className='flex items-center justify-center gap-2 text-sm font-medium'>
          <p className='text-cem-secondary-elevated'>
            Already have an Account?
          </p>
          <Link
            to='/dashboard/auth/auth2/login'
            className='text-sm font-medium text-cem-amber hover:underline'
          >
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  )
}

export default BoxedRegister
