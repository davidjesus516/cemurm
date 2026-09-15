/* eslint-disable react/prop-types */
import { findVenueByName } from '../../lib/gigs.js'

const inputClass =
  'w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber'

/**
 * Venue field with prior-venue suggestions (spec: type "Caf" → suggest
 * "Café La Luna" with stored details; selecting reuses the saved venue).
 * Only the name is edited here — id resolution happens on submit.
 */
export default function VenueAutocomplete({ venues, value, onChange, disabled }) {
  const match = findVenueByName(venues, value)
  return (
    <div>
      <input
        id="gig-venue"
        name="venueName"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list="gig-venue-options"
        placeholder="Venue name (prior venues suggested)"
        disabled={disabled}
        className={inputClass}
      />
      <datalist id="gig-venue-options">
        {venues.map((v) => <option key={v.id} value={v.name} />)}
      </datalist>
      {match && (
        <p className="mt-1 text-xs text-cem-emerald">
          Reuse saved venue: {[match.location, match.type].filter(Boolean).join(' · ') || 'saved details'}
        </p>
      )}
    </div>
  )
}