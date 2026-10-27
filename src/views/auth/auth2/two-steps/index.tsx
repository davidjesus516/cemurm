import { Card } from '@/components/ui/card'
import FullLogo from 'src/layouts/full/shared/logo/FullLogo'
import { Field, FieldGroup } from '@/components/ui/field'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Button } from '@/components/ui/button'

const BoxedTwoStep = () => {
  return (
    <div className='flex min-h-screen items-center justify-center bg-cem-hover px-4 py-8'>
      <Card className='w-full max-w-md p-6 shadow-lg'>
        <div className='mx-auto w-fit'>
          <FullLogo />
        </div>

        <div className='flex flex-col gap-2 text-center'>
          <p className='text-sm font-normal text-cem-secondary-elevated'>
            We sent a verification code to your email. Enter the code below to
            verify your identity.
          </p>
          <p className='font-bold'>demo@cemurm.app</p>
        </div>

        <form
          className='w-full space-y-6'
          onSubmit={(event) => event.preventDefault()}
        >
          <FieldGroup className='gap-6'>
            <div className='flex flex-col gap-6 sm:gap-8'>
              <InputOTP
                maxLength={6}
                id='otp'
                aria-label='Verification code'
                required
              >
                <InputOTPGroup className='w-full gap-1 *:data-[slot=input-otp-slot]:size-9 *:data-[slot=input-otp-slot]:flex-1 *:data-[slot=input-otp-slot]:rounded-lg'>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>

              <Field className='gap-4'>
                <Button type='submit' size='lg' className='w-full rounded-lg'>
                  Verify Now
                </Button>
              </Field>
            </div>
          </FieldGroup>
        </form>

        <div className='flex items-center justify-center gap-2 text-sm font-medium'>
          <p className='text-cem-secondary-elevated'>
            Didn&apos;t get the code?
          </p>
          <button
            type='button'
            className='cursor-pointer text-sm font-medium text-cem-amber hover:underline underline-offset-4'
          >
            Resend
          </button>
        </div>
      </Card>
    </div>
  )
}

export default BoxedTwoStep
