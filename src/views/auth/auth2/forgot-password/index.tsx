import { Card } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import FullLogo from 'src/layouts/full/shared/logo/FullLogo'

const BoxedForgotpwd = () => {
  return (
    <div className='flex min-h-screen items-center justify-center bg-cem-hover px-4 py-8'>
      <Card className='w-full max-w-md p-6 shadow-lg'>
        <div className='mx-auto w-fit'>
          <FullLogo />
        </div>

        <p className='text-sm font-normal text-cem-secondary-elevated'>
          Enter the email address associated with your account and we will send
          you a link to reset your password.
        </p>

        <form
          className='w-full space-y-6'
          onSubmit={(event) => event.preventDefault()}
        >
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
              placeholder='you@yourband.com'
              required
            />
          </div>
          <Button className='w-full rounded-lg'>Forgot password</Button>
        </form>

        <Link
          to='/dashboard/auth/auth2/login'
          className={buttonVariants({ variant: 'outline', className: 'w-full' })}
        >
          Back to Login
        </Link>
      </Card>
    </div>
  )
}

export default BoxedForgotpwd
