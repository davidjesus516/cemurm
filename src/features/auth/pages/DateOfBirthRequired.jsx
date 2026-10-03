// WU2 — the date-of-birth step (features/minors-and-guardian-consent.feature
// scenario 1). Until an account declares a date of birth, the server cannot
// prove it is an adult (migration 0029) and the app refuses to guess
// (D2: unknown ≠ adult). RequireGuardianConsent renders this page IN PLACE of
// the app routes; declaring a date re-checks the age status (onSuccess) and the
// gate either releases the app or hands a minor to GuardianConsentRequired.
//
// Privacy note: the date is written straight to the server through the
// set_date_of_birth RPC and is never read back. date_of_birth has no client
// select grant (0017), which is why the gate re-reads a boolean pair instead
// of trusting local component state.

/* eslint-disable react/prop-types */

import { useMemo, useState } from 'react'
import { setDateOfBirth } from '../../../data/repositories/minors.js'

// The same lower bound the RPC enforces (0030 rule 4), applied in the input so
// the browser refuses to offer an absurd date at all. The server repeats the
// check regardless — this is convenience, not enforcement.
const EARLIEST_DATE = '1900-01-01'

const inputClass =
  'w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber disabled:bg-cem-elevated'

const inputErrorClass = 'border-cem-rose/40'

/**
 * @param {() => Promise<void>} onSuccess  re-read the age status after a
 *   successful declaration so the gate swaps screens (adult → the app,
 *   minor → the guardian screen).
 * @param {() => Promise<void>} onRetry    re-read the age status when the
 *   initial read failed. Rendered only in that case.
 * @param {boolean} readFailed            the gate could not read the age
 *   status at all; the user is still held here, fail-closed.
 */
export default function DateOfBirthRequired({ onSuccess, onRetry, readFailed = false }) {
  const [date, setDate] = useState('')
  const [dateError, setDateError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [retrying, setRetrying] = useState(false)

  // Today, for the input's `max`. Memoised so the rendered attribute is stable
  // across re-renders instead of churning on every keystroke.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  async function handleSubmit(event) {
    event.preventDefault()
    // Same three rules the RPC enforces (0030 rules 2-4), same wording, so the
    // user is never told "it worked" and then contradicted by the server.
    if (!date) {
      setDateError('Enter your date of birth.')
      return
    }
    if (date > today) {
      setDateError('Date of birth cannot be in the future.')
      return
    }
    if (date < EARLIEST_DATE) {
      setDateError('Date of birth must be after 1900.')
      return
    }
    setDateError('')
    setFormError('')
    setSubmitting(true)
    try {
      await setDateOfBirth(date)
      setDone(true)
      // Re-read the age status so the gate unlocks (or escalates to the
      // guardian screen) immediately.
      if (onSuccess) await onSuccess()
    } catch (error) {
      setFormError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRetry() {
    setRetrying(true)
    setFormError('')
    try {
      if (onRetry) await onRetry()
    } catch (error) {
      setFormError(error.message)
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-cem-text">Date of birth required</h1>
      <p className="mt-1 text-sm text-cem-secondary">
        One more step before you can use CEMURM. We need your date of birth to
        know which features apply to you.
      </p>

      {/* Rule 06: prose, not a chip. cem.text (9.90:1) is the sentence token;
          cem.secondary on cem.elevated is 4.04:1, under the AA floor. */}
      <div className="mt-4 rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-text">
        Your date of birth is stored on the server and is never shown back to
        you or to anyone else. If you are under 18, the next screen asks a
        parent or guardian for consent.
      </div>

      {readFailed && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose"
        >
          We could not read your age status, so the app stays locked. You can
          still declare a date of birth below.
        </p>
      )}

      {done && (
        <p
          role="status"
          className="mt-4 rounded-md bg-cem-emerald/10 px-3 py-2 text-sm text-cem-emerald"
        >
          Date of birth saved.
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
          <label htmlFor="date-of-birth" className="block text-sm font-medium text-cem-text">
            Date of birth
          </label>
          <input
            id="date-of-birth"
            name="dateOfBirth"
            type="date"
            autoComplete="bday"
            min={EARLIEST_DATE}
            max={today}
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              if (dateError) setDateError('')
            }}
            disabled={submitting}
            aria-invalid={Boolean(dateError)}
            aria-describedby={dateError ? 'date-of-birth-error' : undefined}
            className={`${inputClass} ${dateError ? inputErrorClass : ''}`}
          />
          {dateError && (
            <p id="date-of-birth-error" className="mt-1 text-xs text-cem-rose">
              {dateError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Continue'}
        </button>

        {readFailed && onRetry && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="w-full rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
          >
            {retrying ? 'Retrying…' : 'Check again'}
          </button>
        )}
      </form>

      <p className="mt-4 text-center text-xs text-cem-secondary">
        A wrong date can be corrected here, but a minor account can never be
        changed into an adult one.
      </p>
    </div>
  )
}
