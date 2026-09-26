// Moderation queue view: grouped reports by entry with reason counts
// and decision buttons (keep/remove/escalate). Online-only — decisions
// require an active connection.

/* eslint-disable react/prop-types */

import { useState } from 'react'
import CaseDetail from './CaseDetail.jsx'

const REASON_LABELS = {
  copyright_violation: 'Copyright',
  offensive_content: 'Offensive',
  spam_duplicate: 'Spam',
  wrong_metadata: 'Wrong metadata',
}

export default function ModerationQueue({ queue, loading, error, onDecide, deciding }) {
  const [selectedCase, setSelectedCase] = useState(null)

  if (loading) {
    return <p className="text-sm text-cem-secondary">Loading moderation queue…</p>
  }

  if (error) {
    return (
      <p className="rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>
    )
  }

  if (queue.length === 0) {
    return (
      <p className="text-sm text-cem-secondary">
        No pending reports. The public library is clean.
      </p>
    )
  }

  if (selectedCase) {
    const caseData = queue.find((c) => c.id === selectedCase)
    if (caseData) {
      return (
        <CaseDetail
          caseData={caseData}
          onDecide={onDecide}
          deciding={deciding}
          onBack={() => setSelectedCase(null)}
        />
      )
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-cem-secondary">
        {queue.length} pending {queue.length === 1 ? 'case' : 'cases'}
      </p>

      <ul className="divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
        {queue.map((item) => {
          const entry = item.entry
          const totalReports = item.reports?.length || 0

          return (
            <li
              key={item.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-cem-text">
                    {entry?.title || 'Unknown entry'}
                  </span>
                  <span className="rounded-full bg-cem-rose/10 px-2 py-0.5 text-xs font-medium text-cem-rose">
                    {totalReports} {totalReports === 1 ? 'report' : 'reports'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-cem-secondary">
                  {entry?.contributor_name && `by ${entry.contributor_name}`}
                  {entry?.artist && ` · ${entry.artist}`}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(item.reason_counts || {}).map(([reason, count]) => (
                    <span
                      key={reason}
                      className="rounded bg-cem-elevated px-1.5 py-0.5 text-[10px] font-medium text-cem-secondary"
                    >
                      {REASON_LABELS[reason] || reason}: {count}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCase(item.id)}
                className="ml-4 shrink-0 rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-text hover:bg-cem-elevated"
              >
                Review
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
