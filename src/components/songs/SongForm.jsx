/* eslint-disable react/prop-types */
import { useState } from 'react'

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100'

export default function SongForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    key: initial?.key || '',
    bpm: initial?.bpm ?? '',
    hasChordChart: initial?.hasChordChart || false,
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
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="song-title" className="block text-sm font-medium text-gray-700">Title *</label>
        <input
          id="song-title"
          name="title"
          value={form.title}
          onChange={handleChange}
          disabled={submitting}
          className={`${inputClass} ${errors.title ? 'border-red-300' : ''}`}
        />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="song-key" className="block text-sm font-medium text-gray-700">Key</label>
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
          <label htmlFor="song-bpm" className="block text-sm font-medium text-gray-700">BPM</label>
          <input
            id="song-bpm"
            name="bpm"
            type="number"
            min="1"
            value={form.bpm}
            onChange={handleChange}
            placeholder="e.g. 120"
            disabled={submitting}
            className={`${inputClass} ${errors.bpm ? 'border-red-300' : ''}`}
          />
          {errors.bpm && <p className="mt-1 text-xs text-red-600">{errors.bpm}</p>}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="hasChordChart"
          checked={form.hasChordChart}
          onChange={handleChange}
          disabled={submitting}
          className="rounded border-gray-300"
        />
        Has chord chart
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : submitLabel || 'Save'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
