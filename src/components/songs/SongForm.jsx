/* eslint-disable react/prop-types */
import { useState } from 'react'
import { formatDuration, parseDurationInput } from '../../lib/duration.js'

const inputClass =
  'w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber disabled:bg-cem-elevated'

export default function SongForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    key: initial?.key || '',
    bpm: initial?.bpm ?? '',
    hasChordChart: initial?.hasChordChart || false,
    duration: initial?.durationSeconds ? formatDuration(initial.durationSeconds) : '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  function validate() {
    const next = {}
    if (!form.title.trim()) next.title = 'Title is required.'
    if (form.bpm !== '' && (isNaN(Number(form.bpm)) || Number(form.bpm) <= 0)) {
      next.bpm = 'BPM must be a positive number.'
    }
    if (form.duration.trim() !== '' && parseDurationInput(form.duration) === null) {
      next.duration = 'Duration must be mm:ss or seconds (e.g. 3:30 or 210).'
    }
    return next
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const next = validate()
    if (Object.keys(next).length) { setErrors(next); return }

    setSubmitting(true)
    try {
      await onSubmit({
        title: form.title.trim(),
        key: form.key.trim(),
        bpm: form.bpm !== '' ? Number(form.bpm) : null,
        hasChordChart: form.hasChordChart,
        durationSeconds: form.duration.trim() !== '' ? parseDurationInput(form.duration) : null,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
      <div>
        <label htmlFor="song-title" className="block text-sm font-medium text-cem-text">Title *</label>
        <input
          id="song-title"
          name="title"
          value={form.title}
          onChange={handleChange}
          disabled={submitting}
          className={`${inputClass} ${errors.title ? 'border-cem-rose/40' : ''}`}
        />
        {errors.title && <p className="mt-1 text-xs text-cem-rose">{errors.title}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="song-key" className="block text-sm font-medium text-cem-text">Key</label>
          <input
            id="song-key"
            name="key"
            value={form.key}
            onChange={handleChange}
            placeholder="e.g. G major"
            disabled={submitting}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="song-bpm" className="block text-sm font-medium text-cem-text">BPM</label>
          <input
            id="song-bpm"
            name="bpm"
            type="number"
            min="1"
            value={form.bpm}
            onChange={handleChange}
            placeholder="e.g. 120"
            disabled={submitting}
            className={`${inputClass} ${errors.bpm ? 'border-cem-rose/40' : ''}`}
          />
          {errors.bpm && <p className="mt-1 text-xs text-cem-rose">{errors.bpm}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="song-duration" className="block text-sm font-medium text-cem-text">Duration</label>
        <input
          id="song-duration"
          name="duration"
          value={form.duration}
          onChange={handleChange}
          placeholder="e.g. 3:30 or 210"
          disabled={submitting}
          className={`${inputClass} ${errors.duration ? 'border-cem-rose/40' : ''}`}
        />
        {errors.duration && <p className="mt-1 text-xs text-cem-rose">{errors.duration}</p>}
      </div>

      <label className="flex items-center gap-2 text-sm text-cem-text">
        <input
          type="checkbox"
          name="hasChordChart"
          checked={form.hasChordChart}
          onChange={handleChange}
          disabled={submitting}
          className="rounded border-cem-elevated"
        />
        Has chord chart
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : submitLabel || 'Save'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
