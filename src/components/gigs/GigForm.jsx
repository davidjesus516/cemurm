/* eslint-disable react/prop-types */
import { useState } from 'react'
import { findVenueByName } from '../../lib/gigs.js'
import VenueAutocomplete from './VenueAutocomplete.jsx'

const inputClass =
  'w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber'

const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-cem-text">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-cem-rose">{error}</p>}
    </div>
  )
}

/** Shared create/edit form; submits raw fields + resolved venueId + setlistId. */
export default function GigForm({ venues, setlists, createVenue, initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    scheduledAt: toLocalInput(initial?.scheduledAt),
    venueName: initial?.venueName || '',
    setlistId: initial?.setlistId || '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!form.name.trim()) next.name = 'Gig name is required.'
    if (!form.scheduledAt) next.scheduledAt = 'Date and time are required.'
    if (Object.keys(next).length) { setErrors(next); return }
    setSubmitting(true)
    try {
      const matched = findVenueByName(venues, form.venueName)
      let venueId = matched?.id ?? null
      if (form.venueName.trim() && !matched) {
        const created = await createVenue({ name: form.venueName.trim() })
        venueId = created.id
      }
      await onSubmit({ name: form.name.trim(), scheduledAt: new Date(form.scheduledAt), venueId, setlistId: form.setlistId || null })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
      <Field id="gig-name" label="Name *" error={errors.name}>
        <input id="gig-name" name="name" value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          disabled={submitting} className={`${inputClass} ${errors.name ? 'border-cem-rose/40' : ''}`} />
      </Field>
      <Field id="gig-scheduledAt" label="Date and time *" error={errors.scheduledAt}>
        <input id="gig-scheduledAt" name="scheduledAt" type="datetime-local" value={form.scheduledAt}
          onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
          disabled={submitting} className={`${inputClass} ${errors.scheduledAt ? 'border-cem-rose/40' : ''}`} />
      </Field>
      <Field id="gig-venue" label="Venue">
        <VenueAutocomplete venues={venues} value={form.venueName}
          onChange={(venueName) => setForm((p) => ({ ...p, venueName }))} disabled={submitting} />
      </Field>
      <Field id="gig-setlist" label="Setlist">
        <select id="gig-setlist" name="setlistId" value={form.setlistId}
          onChange={(e) => setForm((p) => ({ ...p, setlistId: e.target.value }))} disabled={submitting} className={inputClass}>
          <option value="">No setlist</option>
          {setlists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60">
          {submitting ? 'Saving…' : submitLabel || 'Save'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={submitting}
            className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}