// The minor-account lock screen (features/minors-and-guardian-consent.feature
// scenario 2): a minor whose guardian has NOT consented can't use any protected
// route. RequireGuardianConsent renders this page IN PLACE of the app routes.
//
// SINCE 0031 (WU4) the screen runs the real flow, in this order, and each step
// is a distinct state the minor can SEE:
//   1. name + address the guardian  → public.request_guardian_consent opens a
//      'pending' row. Nothing is unlocked. Before 0031 the row came out 'active'
//      and the account opened on the spot, with no guardian involved at all.
//   2. "Send the email"             → the Edge Function mails the guardian the
//      confirm/revoke links, with the consent text rendered FROM the row.
//   3. "I've already sent it" / "Check again" → re-reads the ledger, and the
//      gate releases the app the moment the guardian's click lands.
//
// The only path out of the locked state runs through a guardian, and that is a
// server invariant (0031's anon-granted confirm RPC), not a promise this page
// makes. What this page does promise is narrower and checkable: it never claims
// the account is unlocked unless the ledger actually says 'active'.

/* eslint-disable react/prop-types */

import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { EMAIL_RE } from '../lib/auth.js'
import { requestGuardianConsent, sendGuardianConsentEmail } from '../lib/minors.js'

// The exact consent text the guardian sees is stored verbatim with the record
// (scenario 3: "the record stores … the consent text they saw") and the email
// body is rendered from that stored value, so this constant is the single
// source of both. Bump CONSENT_VERSION only alongside a real copy change: the
// string on the row is the evidence of what the guardian agreed to.
const CONSENT_STATEMENT =
  "I consent to my child's participation in CEMURM activities under the academy's supervision. Public sharing of contributions requires separate guardian approval."
const CONSENT_VERSION = 'v1'

const inputClass =
  'w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber disabled:bg-cem-elevated'

const inputErrorClass = 'border-cem-rose/40'

const buttonClass =
  'w-full rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60'

const quietButtonClass =
  'w-full rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60'

export default function GuardianConsentRequired({ onSuccess }) {
  const { user } = useAuth()
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sending, setSending] = useState(false)
  // 'form' → collecting the guardian. 'requested' → a pending row exists; the
  // only remaining question is whether the email reached the right inbox. The
  // two are genuinely different states and the minor must be able to tell them
  // apart, because only the second one can be retried without a second request.
  const [step, setStep] = useState('form')
  const [sentTo, setSentTo] = useState('')
  const [sendError, setSendError] = useState('')

  async function handleRequest(event) {
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
      await requestGuardianConsent({
        userId: user.id,
        guardianName: guardianName.trim(),
        guardianEmail: guardianEmail.trim(),
        consentText: CONSENT_STATEMENT,
      })
      setSentTo(guardianEmail.trim())
      setStep('requested')
      // Re-read the ledger so the screen reflects the real row. This CANNOT
      // unlock the app — the row is 'pending' and only a guardian can move it.
      if (onSuccess) await onSuccess()
    } catch (error) {
      setFormError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSend() {
    setSending(true)
    setSendError('')
    try {
      const status = await sendGuardianConsentEmail()
      if (status === 'sent') {
        setSendError('')
        setStep('requested')
        return
      }
      // 'already_active' means the guardian got there first and the gate is
      // about to open. 'no_open_request' means the row was finalized
      // underneath us — a re-read settles which, without inventing an outcome.
      if (onSuccess) await onSuccess()
      setSendError('')
    } catch (error) {
      // The function's typed copy. Nothing here may say "sent" unless the
      // provider accepted the message.
      setSendError(error.message)
    } finally {
      setSending(false)
    }
  }

  async function handleCheckAgain() {
    setSendError('')
    if (onSuccess) await onSuccess()
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-cem-text">Guardian consent required</h1>
      <p className="mt-1 text-sm text-cem-secondary">
        This account belongs to a musician under 18. Until a parent or guardian approves
        the consent below, the account stays locked and no feature can be used.
      </p>

      <div className="mt-4 rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-text">
        &ldquo;{CONSENT_STATEMENT}&rdquo;
        <p className="mt-1 text-xs text-cem-secondary">
          This exact text is stored with the record, and it is the text your guardian
          reads in the email.
        </p>
      </div>

      {formError && (
        <p role="alert" className="mt-4 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">
          {formError}
        </p>
      )}

      {step === 'form' && (
        <form onSubmit={handleRequest} className="mt-6 space-y-4 rounded-lg bg-cem-surface p-6 shadow">
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

          <button type="submit" disabled={submitting} className={buttonClass}>
            {submitting ? 'Requesting consent…' : 'Request guardian consent'}
          </button>
        </form>
      )}

      {step === 'requested' && (
        <div className="mt-6 space-y-4 rounded-lg bg-cem-surface p-6 shadow">
          <div role="status" className="rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-text">
            <p className="font-medium">Waiting for your guardian.</p>
            <p className="mt-1 text-cem-secondary">
              The request is recorded{sentTo ? ` for ${sentTo}` : ''} and the account is
              still locked. Nothing happens until they open the link in their email —
              nobody else can approve this for them.
            </p>
          </div>

          {sendError && (
            <p role="alert" className="rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">
              {sendError}
            </p>
          )}

          <button type="button" onClick={handleSend} disabled={sending} className={buttonClass}>
            {sending ? 'Sending…' : "Send the email to my guardian"}
          </button>
          <button type="button" onClick={handleCheckAgain} disabled={sending} className={quietButtonClass}>
            I have already sent it — check again
          </button>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-cem-secondary">
        The email your guardian receives carries a one-time link to approve this consent
        and another to withdraw it later. Withdrawing never deletes the record.
      </p>
    </div>
  )
}
