// Hito 4 — the minor-account lock screen (features/minors-and-guardian-consent.feature
// scenario 2): a minor whose guardian has NOT consented can't use any protected route.
// RequireGuardianConsent renders this page IN PLACE of the app routes; recording
// consent re-checks the ledger (onSuccess) and the gate unlocks the app.

/* eslint-disable react/prop-types */

import { useState } from 'react'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import { EMAIL_RE } from '../../../data/repositories/auth.js'
import { recordConsent } from '../../../data/repositories/minors.js'

// The exact consent text the guardian sees is stored verbatim with the record
// (scenario 3: "the record stores … the consent text they saw").
const CONSENT_STATEMENT =
  "I consent to my child's participation in CEMURM activities under the academy's supervision. Public sharing of contributions requires separate guardian approval."

const inputClass =
  'w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber disabled:bg-cem-elevated'

const inputErrorClass = 'border-cem-rose/40'

export default function GuardianConsentRequired({ onSuccess }) {
  const { user } = useAuth()
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!guardianName.trim()) nextErrors.guardianName = 'Guardian name is required.'
    if (!guardianEmail.trim()) {
      nextErrors.guardianEmail = 'Email is required.'
    } else if (!EMAIL_RE.test(guardianEmail.trim())) {
      nextErrors.guardianEmail = 'Enter a valid email address.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    setFormError('')
    setSubmitting(true)
    try {
      await recordConsent({
        userId: user.id,
        guardianName: guardianName.trim(),
        guardianEmail: guardianEmail.trim(),
        consentText: CONSENT_STATEMENT,
      })
      setDone(true)
      // Re-check the ledger so the gate unlocks the app immediately.
      if (onSuccess) await onSuccess()
    } catch (error) {
      setFormError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-cem-text">Guardian consent required</h1>
      <p className="mt-1 text-sm text-cem-secondary">
        This account belongs to a musician under 18. Until a parent or guardian records
        consent, the account stays locked and no feature can be used.
      </p>

      <div className="mt-4 rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-text">
        &ldquo;{CONSENT_STATEMENT}&rdquo;
      </div>

      {done && (
        <p
          role="status"
          className="mt-4 rounded-md bg-cem-emerald/10 px-3 py-2 text-sm text-cem-emerald"
        >
          Consent recorded — your account is now unlocked.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-lg bg-cem-surface p-6 shadow"
      >
        {formError && (
          <p role="alert" className="rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">
            {formError}
          </p>
        )}

        <div>
          <label htmlFor="guardian-name" className="block text-sm font-medium text-cem-text">
            Guardian name
          </label>
          <input
            id="guardian-name"
            name="guardianName"
            type="text"
            autoComplete="name"
            value={guardianName}
            onChange={(e) => {
              setGuardianName(e.target.value)
              if (errors.guardianName) setErrors((prev) => ({ ...prev, guardianName: '' }))
            }}
            disabled={submitting}
            aria-invalid={Boolean(errors.guardianName)}
            className={`${inputClass} ${errors.guardianName ? inputErrorClass : ''}`}
          />
          {errors.guardianName && (
            <p className="mt-1 text-xs text-cem-rose">{errors.guardianName}</p>
          )}
        </div>

        <div>
          <label htmlFor="guardian-email" className="block text-sm font-medium text-cem-text">
            Guardian email
          </label>
          <input
            id="guardian-email"
            name="guardianEmail"
            type="email"
            autoComplete="email"
            value={guardianEmail}
            onChange={(e) => {
              setGuardianEmail(e.target.value)
              if (errors.guardianEmail) setErrors((prev) => ({ ...prev, guardianEmail: '' }))
            }}
            disabled={submitting}
            aria-invalid={Boolean(errors.guardianEmail)}
            className={`${inputClass} ${errors.guardianEmail ? inputErrorClass : ''}`}
          />
          {errors.guardianEmail && (
            <p className="mt-1 text-xs text-cem-rose">{errors.guardianEmail}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
        >
          {submitting ? 'Recording consent…' : 'I give consent'}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-cem-secondary">
        A guardian can later revoke consent using the link emailed at signup.
      </p>
    </div>
  )
}