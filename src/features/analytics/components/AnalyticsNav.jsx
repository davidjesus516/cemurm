/* eslint-disable react/prop-types */
// Shared section navigation for analytics (S3). Tier 2: plain links, no chrome.
import { Link } from 'react-router-dom'

const SECTIONS = [
  { to: '/analytics', label: 'Personal' },
  { to: '/analytics/organization', label: 'Organization' },
  { to: '/analytics/repertoire', label: 'Repertoire' },
  { to: '/analytics/engagement', label: 'Export & engagement' },
]

/** @param {{ current: string }} props */
export default function AnalyticsNav({ current }) {
  return (
    <nav aria-label="Analytics sections" className="mt-4 flex flex-wrap gap-2">
      {SECTIONS.map((section) => {
        const active = section.to === current
        return (
          <Link
            key={section.to}
            to={section.to}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              active
                ? 'border-cem-amber bg-cem-amber/10 text-cem-text'
                : 'border-cem-elevated text-cem-text hover:bg-cem-elevated'
            }`}
          >
            {section.label}
          </Link>
        )
      })}
    </nav>
  )
}
