/* eslint-disable react/prop-types */
import { Link } from 'react-router-dom'

export const GIG_STATUS_STYLES = {
  planned: 'bg-cem-amber/10 text-cem-amber',
  confirmed: 'bg-cem-emerald/10 text-cem-emerald',
  cancelled: 'bg-cem-elevated text-cem-secondary',
  completed: 'bg-cem-sky/10 text-cem-sky',
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${GIG_STATUS_STYLES[status] || GIG_STATUS_STYLES.planned}`}>
      {status}
    </span>
  )
}

export function formatWhen(iso) {
  return new Date(iso).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function GigCard({ gig, venueName }) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link to={`/gigs/${gig.id}`} className="text-sm font-medium text-cem-text hover:text-cem-amber">{gig.name}</Link>
          <StatusBadge status={gig.status} />
        </div>
        <p className="mt-0.5 text-xs text-cem-secondary">
          {formatWhen(gig.scheduledAt)}{venueName ? ` · ${venueName}` : ''}
        </p>
      </div>
    </li>
  )
}