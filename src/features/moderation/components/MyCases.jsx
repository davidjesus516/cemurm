// Contributor view of their OWN moderation cases (Hito 4 — issue #151).
// RLS moderation_cases_select_contributor (0020 §6) lets a signed-in
// non-moderator read the case rows whose entry they own — originals AND
// appeal rows — so a removal is reachable and appealable end to end.
// Honest by construction: no report rows are fetched (reporter
// confidentiality) and a removed entry has no title to show (the catalog
// view exposes live entries only) — the absence is stated, never faked.

/* eslint-disable react/prop-types */

import { useState } from 'react'
import CaseDetail from './CaseDetail.jsx'

// The visual system is ONE accent (cem.amber) over a monochrome ramp, and the
// dead accents (coral/emerald/rose/sky) are ratcheted out by check rule 02 — so a
// hue cannot code three decisions. The label carries the meaning; amber is spent
// on the single state this view can act on, Removed, because that is what a
// contributor opens the page to find out.
const DECISION_META = {
  keep: { label: 'Kept', className: 'bg-cem-elevated text-cem-text' },
  remove: { label: 'Removed', className: 'bg-cem-amber/10 text-cem-amber' },
  escalate: {
    label: 'Escalated',
    className: 'bg-cem-elevated text-cem-secondary-elevated',
  },
}

function DecisionBadge({ decision }) {
  if (decision === null) {
    return (
      <span className="rounded-full bg-cem-elevated px-2 py-0.5 text-xs font-medium text-cem-secondary-elevated">
        Awaiting decision
      </span>
    )
  }
  const meta = DECISION_META[decision]
  if (!meta) return null
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

export default function MyCases({ cases, loading, error, onAppeal, appealing }) {
  const [selectedCase, setSelectedCase] = useState(null)

  if (loading) {
    return <p className="text-sm text-cem-secondary">Loading your moderation cases…</p>
  }

  if (error) {
    return (
      <p className="rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-text" role="alert">
        {error}
      </p>
    )
  }

  if (selectedCase) {
    const caseData = cases.find((c) => c.id === selectedCase)
    if (caseData) {
      // An existing APPEAL row for this original ends the road (one appeal
      // per case, server-enforced) — derived from rows RLS actually returns.
      const appealExists = cases.some((c) => c.appeal_of === caseData.id)
      return (
        <CaseDetail
          caseData={caseData}
          isMod={false}
          appealExists={appealExists}
          onAppeal={onAppeal}
          appealing={appealing}
          onBack={() => setSelectedCase(null)}
        />
      )
    }
  }

  if (cases.length === 0) {
    return (
      <p className="text-sm text-cem-secondary">
        None of your contributions to the public library has a moderation case.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-cem-secondary">
        {cases.length} {cases.length === 1 ? 'case' : 'cases'} on your contributions
      </p>

      <ul className="divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
        {cases.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-cem-text">
                  {item.entry?.title || 'Entry no longer in the public library'}
                </span>
                <DecisionBadge decision={item.decision} />
                {item.appeal_of && (
                  <span className="rounded-full bg-cem-elevated px-2 py-0.5 text-xs font-medium text-cem-secondary-elevated">
                    Appeal
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-cem-secondary">
                {new Date(item.created_at).toLocaleDateString()}
                {item.decided_at && ` · decided ${new Date(item.decided_at).toLocaleDateString()}`}
                {item.appeal_of && ' · appeal of a previous decision'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedCase(item.id)}
              className="ml-4 shrink-0 rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-text hover:bg-cem-elevated"
            >
              View
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
