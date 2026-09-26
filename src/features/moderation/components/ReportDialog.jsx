// Report dialog for filing reports on public library entries.
// Modal overlay with reason category selector, confirmation checkbox,
// and submit button. Shows confirmation after successful submission.

/* eslint-disable react/prop-types */

import { useState } from 'react'

const REASON_LABELS = {
  copyright_violation: 'Copyright violation',
  offensive_content: 'Offensive content',
  spam_duplicate: 'Spam or duplicate',
  wrong_metadata: 'Wrong metadata',
}

const REASON_DESCRIPTIONS = {
  copyright_violation: 'The content infringes on someone else\'s copyright or intellectual property.',
  offensive_content: 'The content contains offensive, hateful, or inappropriate material.',
  spam_duplicate: 'This is spam or a duplicate of existing content.',
  wrong_metadata: 'The title, artist, or other metadata is incorrect.',
}

export default function ReportDialog({ entry, reasons, onSubmit, onClose, alreadyReported }) {
  const [selectedReason, setSelectedReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedReason || !confirmed) return
    setSubmitting(true)
    setError('')
    try {
      await onSubmit(entry.id, selectedReason)
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="mt-8 w-full max-w-md rounded-lg border border-cem-elevated bg-cem-surface p-4 text-cem-text shadow-xl">
          <h2 className="text-lg font-semibold text-cem-text">Report submitted</h2>
          <p className="mt-2 text-sm text-cem-secondary">
            Your report has been queued for moderation. Thank you for helping keep the library safe.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        onSubmit={handleSubmit}
        className="mt-8 w-full max-w-md rounded-lg border border-cem-elevated bg-cem-surface p-4 text-cem-text shadow-xl"
      >
        <h2 className="text-lg font-semibold text-cem-text">Report entry</h2>
        <p className="mt-1 text-sm text-cem-secondary">
          Report &ldquo;{entry.title}&rdquo; by {entry.contributor_name || 'Unknown'} for a policy
          violation.
        </p>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm font-medium text-cem-text">Reason</legend>
          {reasons.map((reason) => {
            const reported = alreadyReported?.[reason]
            return (
              <label
                key={reason}
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                  reported
                    ? 'cursor-not-allowed border-cem-elevated bg-cem-elevated/50 text-cem-secondary'
                    : selectedReason === reason
                      ? 'border-cem-amber bg-cem-amber/5 text-cem-text'
                      : 'border-cem-elevated text-cem-text hover:border-cem-amber/50'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={() => !reported && setSelectedReason(reason)}
                  disabled={reported}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-medium">{REASON_LABELS[reason]}</span>
                  <p className="mt-0.5 text-xs text-cem-secondary">
                    {REASON_DESCRIPTIONS[reason]}
                  </p>
                  {reported && (
                    <p className="mt-0.5 text-xs text-cem-amber">Already reported</p>
                  )}
                </div>
              </label>
            )
          })}
        </fieldset>

        <label className="mt-4 flex items-start gap-2 text-sm text-cem-text">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          I confirm this report is made in good faith and I believe the content violates our
          community guidelines.
        </label>

        {error && (
          <p className="mt-3 text-sm text-cem-rose" role="alert">{error}</p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={!selectedReason || !confirmed || submitting}
            className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit report'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
