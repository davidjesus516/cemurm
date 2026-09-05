import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { EMAIL_RE } from '../lib/auth.js'

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100'

const inputErrorClass = 'border-red-300'

function Auth() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    password: '',
    passwordConfirm: '',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isSignUp = mode === 'signup'

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev))
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setErrors({})
    setFormError('')
  }

  function validate() {
    const nextErrors = {}
    const email = form.email.trim()

    if (!email) {
      nextErrors.email = 'Email is required.'
    } else if (!EMAIL_RE.test(email)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (isSignUp) {
      if (!form.firstName.trim()) nextErrors.firstName = 'First name is required.'
      if (!form.lastName.trim()) nextErrors.lastName = 'Last name is required.'
      if (!form.displayName.trim()) nextErrors.displayName = 'Display name is required.'
      if (!form.password) {
        nextErrors.password = 'Password is required.'
      } else if (form.password.length < 8) {
        nextErrors.password = 'Password must be at least 8 characters.'
      }
      if (form.passwordConfirm !== form.password) {
        nextErrors.passwordConfirm = 'Passwords do not match.'
      }
    } else if (!form.password) {
      nextErrors.password = 'Password is required.'
    }

    return nextErrors
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    setFormError('')
    setIsSubmitting(true)
    try {
      if (isSignUp) {
        await signUp({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          displayName: form.displayName.trim(),
          email: form.email.trim(),
          password: form.password,
        })
      } else {
        await signIn({ email: form.email.trim(), password: form.password })
      }
      navigate(from, { replace: true })
    } catch (error) {
      setFormError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function renderField(name, label, options = {}) {
    const { type = 'text', autoComplete } = options
    const hasError = Boolean(errors[name])
    return (
      <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <input
          id={name}
          name={name}
          type={type}
          autoComplete={autoComplete}
          value={form[name]}
          onChange={handleChange}
          disabled={isSubmitting}
          aria-invalid={hasError}
          className={`${inputClass} ${hasError ? inputErrorClass : ''}`}
        />
        {hasError && <p className="mt-1 text-xs text-red-600">{errors[name]}</p>}
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">
        {isSignUp ? 'Create Account' : 'Sign In'}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {isSignUp
          ? 'Join CEMURM to manage your repertoire and setlists.'
          : 'Welcome back — sign in to continue.'}
      </p>

      <form
        noValidate
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-lg bg-white p-6 shadow"
      >
        {formError && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}

        {isSignUp && (
          <div className="grid grid-cols-2 gap-4">
            {renderField('firstName', 'First name', { autoComplete: 'given-name' })}
            {renderField('lastName', 'Last name', { autoComplete: 'family-name' })}
          </div>
        )}

        {isSignUp && renderField('displayName', 'Display name', { autoComplete: 'nickname' })}

        {renderField('email', 'Email', { type: 'email', autoComplete: 'email' })}
        {renderField('password', 'Password', {
          type: 'password',
          autoComplete: isSignUp ? 'new-password' : 'current-password',
        })}
        {isSignUp &&
          renderField('passwordConfirm', 'Confirm password', {
            type: 'password',
            autoComplete: 'new-password',
          })}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSubmitting
            ? isSignUp
              ? 'Creating account…'
              : 'Signing in…'
            : isSignUp
              ? 'Create Account'
              : 'Sign In'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        {isSignUp ? 'Already have an account? ' : 'New to CEMURM? '}
        <button
          type="button"
          onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
          className="font-medium text-indigo-600 hover:underline"
        >
          {isSignUp ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </div>
  )
}

export default Auth