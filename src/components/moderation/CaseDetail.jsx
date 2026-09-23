// Case detail view: shows report history, decision actions (keep/remove/escalate),
// and appeal flow. Moderators can decide cases here; contributors can file appeals.

/* eslint-disable react/prop-types */

import { useState } from 'react'

const REASON_LABELS = {
  copyright_violation: 'Copyright violation',
  offensive_content: 'Offensive content',
  spam_duplicate: 'Spam or duplicate',
  wrong_metadata: 'Wrong metadata',
}

const DECISION_LABELS = {
  keep: 'Keep',
  remove: 'Remove',
  escalate: 'Escalate',
}

export default function CaseDetail({ caseData, onDecide, deciding, onBack, onAppeal, appealing, isMod, isSystemAdmin = false, appealExists = false }) {
  const [notes, setNotes] = useState('')
  const [appealReason, setAppealReason] = useState('')
  const [showAppealForm, setShowAppealForm] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const entry = caseData.entry
  const isDecided = caseData.decision !== null
  const isAppeal = caseData.appeal_of !== null
  const isEscalated = caseData.decision === 'escalate'
  // Who may decide RIGHT NOW (mirrors 0020 decide_moderation_case so no dead
  // buttons render): moderators on null-decision cases (incl. appeals);
  // ONLY a system_admin on escalated rows (and only forward: keep/remove).
  const canDecide = isEscalated ? isSystemAdmin : (isMod && !isDecided)

  async function handleDecide(decision) {
    if (!window.confirm(`Are you sure you want to "${DECISION_LABELS[decision]}" this entry?`)) return
    setActionError('')
    setActionSuccess('')
    try {
      await onDecide(caseData.id, decision, notes)
      setActionSuccess(`Decision recorded: ${DECISION_LABELS[decision]}`)
      setNotes('')
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleAppeal(e) {
    e.preventDefault()
    if (!appealReason.trim()) return
    setActionError('')
    setActionSuccess('')
    try {
      await onAppeal(caseData.id, appealReason)
      setActionSuccess('Appeal submitted. A different moderator will review it.')
      setAppealReason('')
      setShowAppealForm(false)
    } catch (err) {
      setActionError(err.message)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-cem-amber hover:underline"
      >
        ← Back
      </button>

      {/* Action feedback lives HERE (top level) so it stays visible in every
          mode — the decision section hides for contributors and swaps away
          after an appeal is filed. */}
      {actionError && (
        <p className="mt-3 text-sm text-cem-rose" role="alert">{actionError}</p>
      )}
      {actionSuccess && (
        <p className="mt-3 text-sm text-cem-emerald">{actionSuccess}</p>
      )}

      <div className="mt-3">
        <h2 className="text-lg font-semibold text-cem-text">
          {entry?.title || 'Entry no longer in the public library'}
        </h2>
        <p className="mt-1 text-sm text-cem-secondary">
          {entry?.contributor_name && `Contributed by ${entry.contributor_name}`}
          {entry?.artist && ` · ${entry.artist}`}
          {entry?.license && ` · ${entry.license}`}
        </p>
      </div>

      {/* Report history */}
      <div className="mt-4 rounded-lg border border-cem-elevated bg-cem-surface p-4">
        <h3 className="text-sm font-semibold text-cem-text">Reports</h3>
        {caseData.reports && caseData.reports.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {caseData.reports.map((report) => (
              <li key={report.id} className="text-sm text-cem-text">
                <span className="font-medium">{REASON_LABELS[report.reason] || report.reason}</span>
                <span className="ml-2 text-xs text-cem-secondary">
                  — reported by {report.reporter_id.slice(0, 8)}…
                  {new Date(report.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-cem-secondary">No individual reports visible.</p>
        )}

        {/* Reason counts summary */}
        <div className="mt-3 flex flex-wrap gap-1">
          {Object.entries(caseData.reason_counts || {}).map(([reason, count]) => (
            <span
              key={reason}
              className="rounded bg-cem-elevated px-2 py-0.5 text-xs font-medium text-cem-secondary"
            >
              {REASON_LABELS[reason] || reason}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Decision section — rendered only when the viewer can actually decide
          (moderators on open cases, system_admin on escalated cases) */}
      {canDecide && (
        <div className="mt-4 rounded-lg border border-cem-elevated bg-cem-surface p-4">
          <h3 className="text-sm font-semibold text-cem-text">Decision</h3>
          {isEscalated && (
            <p className="mt-1 text-xs text-cem-amber">
              This case was escalated — only a system admin can resolve it.
            </p>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes (optional) — reason for your decision…"
            className="mt-2 w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleDecide('keep')}
              disabled={Boolean(deciding)}
              className="rounded-md border border-cem-emerald/40 px-4 py-2 text-sm font-medium text-cem-emerald hover:bg-cem-emerald/10 disabled:opacity-60"
            >
              {deciding === caseData.id ? 'Deciding…' : 'Keep'}
            </button>
            <button
              type="button"
              onClick={() => handleDecide('remove')}
              disabled={Boolean(deciding)}
              className="rounded-md border border-cem-rose/40 px-4 py-2 text-sm font-medium text-cem-rose hover:bg-cem-rose/10 disabled:opacity-60"
            >
              {deciding === caseData.id ? 'Deciding…' : 'Remove'}
            </button>
            {/* Re-escalating an escalated case is closed server-side — never
                show that button there (dead button for everyone else anyway). */}
            {!isEscalated && (
              <button
                type="button"
                onClick={() => handleDecide('escalate')}
                disabled={Boolean(deciding)}
                className="rounded-md border border-cem-amber/40 px-4 py-2 text-sm font-medium text-cem-amber hover:bg-cem-amber/10 disabled:opacity-60"
              >
                {deciding === caseData.id ? 'Deciding…' : 'Escalate'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Decided case info */}
      {isDecided && (
        <div className="mt-4 rounded-lg border border-cem-elevated bg-cem-surface p-4">
          <h3 className="text-sm font-semibold text-cem-text">Decision</h3>
          <p className="mt-1 text-sm text-cem-text">
            <span className={`font-medium ${
              caseData.decision === 'keep' ? 'text-cem-emerald' :
              caseData.decision === 'remove' ? 'text-cem-rose' : 'text-cem-amber'
            }`}>
              {DECISION_LABELS[caseData.decision]}
            </span>
            {caseData.decided_at && (
              <span className="ml-2 text-xs text-cem-secondary">
                on {new Date(caseData.decided_at).toLocaleDateString()}
              </span>
            )}
          </p>
          {caseData.notes && (
            <p className="mt-1 text-sm text-cem-secondary">{caseData.notes}</p>
          )}
        </div>
      )}

      {/* Appeal section (contributors can appeal removed entries) */}
      {!isMod && isDecided && caseData.decision === 'remove' && !isAppeal && !appealExists && (
        <div className="mt-4 rounded-lg border border-cem-elevated bg-cem-surface p-4">
          <h3 className="text-sm font-semibold text-cem-text">Appeal</h3>
          <p className="mt-1 text-sm text-cem-secondary">
            You can appeal this removal. A different moderator will review your case.
          </p>

          {!showAppealForm ? (
            <button
              type="button"
              onClick={() => setShowAppealForm(true)}
              className="mt-2 rounded-md border border-cem-amber/40 px-4 py-2 text-sm font-medium text-cem-amber hover:bg-cem-amber/10"
            >
              File appeal
            </button>
          ) : (
            <form onSubmit={handleAppeal} className="mt-3 space-y-2">
              <textarea
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                rows={3}
                placeholder="Explain why you believe this removal was incorrect…"
                className="w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={Boolean(appealing) || !appealReason.trim()}
                  className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
                >
                  {appealing === caseData.id ? 'Submitting…' : 'Submit appeal'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAppealForm(false); setAppealReason('') }}
                  disabled={Boolean(appealing)}
                  className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Appeal already filed — derived from an ACTUAL appeal row on this
          case (the previous `notes` heuristic misfired on moderator decision
          notes and could not see a real appeal at all). */}
      {!isMod && isDecided && caseData.decision === 'remove' && !isAppeal && appealExists && (
        <div className="mt-4 rounded-lg border border-cem-elevated bg-cem-surface p-4">
          <h3 className="text-sm font-semibold text-cem-text">Appeal</h3>
          <p className="mt-1 text-sm text-cem-secondary">
            You have already filed an appeal for this case. A different
            moderator will review it — an unsuccessful appeal is final at the
            in-app level.
          </p>
        </div>
      )}

      {/* Appeal decision (moderators/system admin reviewing an appeal) */}
      {isMod && isAppeal && !isDecided && (
        <div className="mt-4 rounded-lg border border-cem-amber/20 bg-cem-amber/5 p-4">
          <h3 className="text-sm font-semibold text-cem-amber">Appeal review</h3>
          <p className="mt-1 text-sm text-cem-secondary">
            This is an appeal of a previous decision. The original decider cannot review this appeal.
          </p>
          {caseData.notes && (
            <p className="mt-2 text-sm text-cem-text">
              <span className="font-medium">Appeal reason:</span> {caseData.notes}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
