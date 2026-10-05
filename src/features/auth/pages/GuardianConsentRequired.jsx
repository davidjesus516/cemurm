// Hito 4 — the minor-account lock screen (features/minors-and-guardian-consent.feature
// scenario 2): a minor whose guardian has NOT consented can't use any protected route.
// RequireGuardianConsent renders this page IN PLACE of the app routes.
//
// ⚠ This page OPENS A REQUEST. It does not grant consent and it must never say
// it does. Since 0031 the row is created 'pending' and the account stays locked
// until the GUARDIAN opens the emailed one-shot link; the transition is the
// server's, not the minor's. An earlier version of this file called
// `record_guardian_consent` and then printed "your account is now unlocked",
// which was true before 0031 and a lie after it — the ledger re-check left the
// account locked, on this same screen, with no email ever sent.

/* eslint-disable react/prop-types */

import { useState } from 'react'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import { EMAIL_RE } from '../../../data/repositories/auth.js'
import { requestGuardianConsent, sendGuardianConsentEmail } from '../../../data/repositories/minors.js'

// The exact consent text the guardian sees is stored verbatim with the record
// (scenario 3: "the record stores … the consent text they saw").
const CONSENT_STATEMENT =
  "I consent to my child's participation in CEMURM activities under the academy's supervision. Public sharing of contributions requires separate guardian approval."

const inputClass =
  'w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-2 focus:ring-cem-amber focus:ring-offset-2 focus:ring-offset-transparent disabled:bg-cem-elevated'

const inputErrorClass = 'border-cem-elevated'

export default function GuardianConsentRequired({ onSuccess }) {
  const { user } = useAuth()
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // null        → showing the form
  // 'sent'      → request recorded, Resend accepted the guardian email
  // 'no_email'  → request recorded, but NO mail went out (see 0031's one-open
  //               rule: the form must not come back, only a resend may)
  // 'confirmed' → the guardian confirmed while this page was open
  const [phase, setPhase] = useState(null)
  const [resending, setResending] = useState(false)

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
      // Step 1 — OPEN the request. This creates a 'pending' row and nothing
      // else. It never unlocks the account, so the form must not imply it did.
      await requestGuardianConsent({
        userId: user.id,
        guardianName: guardianName.trim(),
        guardianEmail: guardianEmail.trim(),
        consentText: CONSENT_STATEMENT,
      })
    } catch (error) {
      // The request was never recorded, so the form is still honest: the minor
      // may fix the input and try again.
      setFormError(error.message)
      setSubmitting(false)
      return
    }

    // Step 2 — the app triggers the send. A pending row nobody was told about
    // reaches no guardian, so this is not optional and not deferred.
    setSubmitting(false)
    const status = await sendGuardianConsentEmail()
    if (status === 'already_active') {
      setPhase('confirmed')
      if (onSuccess) await onSuccess()
      return
    }
    // 'no_open_request' right after creating one means the page is stale, not
    // that the mail is fine. Both it and 'unavailable' mean NO MAIL WENT OUT,
    // and the UI has to say exactly that rather than imply a sent message.
    setPhase(status === 'sent' ? 'sent' : 'no_email')
  }

  // Re-send for the request already on file. 0031's guardian_consents_one_open
  // rule means there is exactly one open request, so this re-sends that row's
  // link — it does not create a second one.
  async function handleResend() {
    setResending(true)
    const status = await sendGuardianConsentEmail()
    setResending(false)
    if (status === 'already_active') {
      setPhase('confirmed')
      if (onSuccess) await onSuccess()
      return
    }
    setPhase(status === 'sent' ? 'sent' : 'no_email')
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

      {phase === 'sent' && (
        <div role="status" className="mt-4 rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-text">
          <p className="font-medium">Your request was sent to {guardianEmail.trim()}.</p>
          <p className="mt-1 text-cem-secondary">
            Your account stays locked until your guardian opens the link in that email. That
            step is theirs, not yours — nothing you do here can unlock it early.
          </p>
        </div>
      )}

      {phase === 'no_email' && (
        <div role="alert" className="mt-4 rounded-md bg-cem-elevated/60 px-3 py-2 text-sm text-cem-text">
          <p className="font-medium">Your request is recorded, but the email did not go out.</p>
          <p className="mt-1 text-cem-secondary">
            {guardianEmail.trim()} was not reached, so nobody can confirm yet. Retry the send below
            — this does not create a second request.
          </p>
        </div>
      )}

      {phase === 'confirmed' && (
        <div role="status" className="mt-4 rounded-md bg-cem-elevated/60 px-3 py-2 text-sm text-cem-text">
          Your guardian confirmed consent. Unlocking your account…
        </div>
      )}

      {phase !== null && phase !== 'confirmed' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
          >
            {resending ? 'Sending…' : 'Resend the email'}
          </button>
          <button
            type="button"
            onClick={() => onSuccess?.()}
            disabled={resending}
            className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
          >
            I&rsquo;ve confirmed — check again
          </button>
        </div>
      )}

      {/* The form is deliberately gone once a request exists: 0031 allows
          exactly one open consent per account, so re-submitting would be
          rejected. Resending the link is the only remaining action. */}
      {phase === null && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4 rounded-lg bg-cem-surface p-6 shadow"
        >
          {formError && (
            <p role="alert" className="rounded-md bg-cem-elevated/60 px-3 py-2 text-sm text-cem-text">
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
              <p className="mt-1 text-xs text-cem-text">{errors.guardianName}</p>
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
              <p className="mt-1 text-xs text-cem-text">{errors.guardianEmail}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
          >
            {submitting ? 'Sending the request…' : 'Ask my guardian to confirm'}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-xs text-cem-secondary">
        Your guardian can revoke consent at any time using the link in that same email. Revoking
        locks the account again — it never deletes the consent record.
      </p>
    </div>
  )
}