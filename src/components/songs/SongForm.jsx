/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { formatDuration, parseDurationInput } from '../../lib/duration.js'
import { PDF_SIZE_MESSAGE, PDF_TYPE_MESSAGE, validatePdfFile } from '../../lib/pdfCharts.js'
import { searchMusicBrainzMetadata } from '../../lib/musicbrainz.js'

const inputClass =
  'w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber disabled:bg-cem-elevated'

export default function SongForm({ initial, onSubmit, onCancel, submitLabel }) {
  const isPdfSong = initial?.isPdf === true
  const [form, setForm] = useState({
    title: initial?.title || '',
    artist: initial?.artist || '',
    genre: initial?.genre || '',
    year: initial?.year ?? '',
    key: initial?.key || '',
    bpm: initial?.bpm ?? '',
    hasChordChart: initial?.hasChordChart || false,
    duration: initial?.durationSeconds ? formatDuration(initial.durationSeconds) : '',
  })
  // Hito 5 #76: chart source toggle — ChordPro text vs PDF scan. The form only
  // SELECTS the file (no upload until save; addSong handles the upload).
  const [source, setSource] = useState(isPdfSong ? 'pdf' : 'chordpro')
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfError, setPdfError] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Hito 5 #78 (S1): MusicBrainz declared-metadata lookup — suggestion chips
  // per field (title/artist/year/genre), each accepted or rejected on its own.
  // Suggestion values are UI state only; genre/year acceptances are persisted
  // as enrichments rows AFTER creation (Songs.jsx — rows need song_id).
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [mb, setMb] = useState({ status: 'idle', match: null, accepted: {}, rejected: {} })
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
    // A suggestion belongs to the title/artist it was looked up for — any
    // manual edit invalidates it (chips reappear after the next lookup).
    if (mb.status !== 'idle') setMb({ status: 'idle', match: null, accepted: {}, rejected: {} })
  }

  async function handleLookupMetadata() {
    const title = form.title.trim()
    if (title.length < 3 || mb.status === 'looking' || submitting || !online) return
    setMb({ status: 'looking', match: null, accepted: {}, rejected: {} })
    const result = await searchMusicBrainzMetadata({ title, artist: form.artist.trim() })
    if (result.ok && result.match) {
      setMb({ status: 'suggested', match: result.match, accepted: {}, rejected: {} })
    } else if (result.ok) {
      setMb({ status: 'noMatch', match: null, accepted: {}, rejected: {} })
    } else {
      setMb({
        status: result.error === 'offline' ? 'offline' : 'error',
        match: null,
        accepted: {},
        rejected: {},
      })
    }
  }

  /** Accept ONE suggested field: fills the input; the chip disappears. */
  function acceptField(field, value) {
    setMb((prev) => ({ ...prev, accepted: { ...prev.accepted, [field]: true } }))
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function rejectField(field) {
    setMb((prev) => ({ ...prev, rejected: { ...prev.rejected, [field]: true } }))
  }

  const suggestionFields = mb.status === 'suggested' && mb.match
    ? [
        { key: 'title', label: 'Title', value: mb.match.title },
        { key: 'artist', label: 'Artist', value: mb.match.artist },
        { key: 'year', label: 'Year', value: mb.match.year },
        { key: 'genre', label: 'Genre', value: mb.match.genre },
      ].filter((f) => f.value !== '' && f.value !== null && f.value !== undefined)
        .filter((f) => !mb.accepted[f.key] && !mb.rejected[f.key])
    : []

  function handleSourceChange(next) {
    setSource(next)
    setPdfFile(null)
    setPdfError('')
  }

  function handlePdfPick(e) {
    const file = e.target.files?.[0] || null
    e.target.value = '' // allow re-selecting the same file
    setPdfFile(file)
    if (!file) { setPdfError(''); return }
    const check = validatePdfFile(file)
    setPdfError(check.ok ? '' : (check.reason === 'size' ? PDF_SIZE_MESSAGE : PDF_TYPE_MESSAGE))
  }

  function validate() {
    const next = {}
    if (!form.title.trim()) next.title = 'Title is required.'
    if (form.bpm !== '' && (isNaN(Number(form.bpm)) || Number(form.bpm) <= 0)) {
      next.bpm = 'BPM must be a positive number.'
    }
    if (form.year !== '' && (isNaN(Number(form.year)) || Number(form.year) <= 0)) {
      next.year = 'Year must be a positive number.'
    }
    if (form.duration.trim() !== '' && parseDurationInput(form.duration) === null) {
      next.duration = 'Duration must be mm:ss or seconds (e.g. 3:30 or 210).'
    }
    // #76: a NEW pdf song needs a valid scan before save. Editing an existing
    // PDF song (isPdfSong) only touches key/bpm/title here — the scan itself
    // is replaced from the song page (replacePdfScan); file stays optional.
    if (source === 'pdf' && !isPdfSong) {
      if (!pdfFile) next.pdf = 'Choose a PDF scan file.'
      else if (pdfError) next.pdf = pdfError
    }
    return next
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const next = validate()
    if (Object.keys(next).length) { setErrors(next); return }

    setSubmitting(true)
    try {
      const payload = {
        title: form.title.trim(),
        artist: form.artist.trim(),
        genre: form.genre.trim(),
        year: form.year !== '' ? Number(form.year) : null,
        key: form.key.trim(),
        bpm: form.bpm !== '' ? Number(form.bpm) : null,
        hasChordChart: form.hasChordChart,
        durationSeconds: form.duration.trim() !== '' ? parseDurationInput(form.duration) : null,
        pdfFile: source === 'pdf' ? pdfFile : null,
      }
      // S1 provenance handoff: which genre/year values came FROM MusicBrainz —
      // Songs.jsx persists them as enrichments rows after the song exists.
      if (mb.accepted.genre || mb.accepted.year) {
        payload.musicBrainzAccepted = {
          genre: mb.accepted.genre ? payload.genre : null,
          year: mb.accepted.year ? payload.year : null,
        }
      }
      await onSubmit(payload)
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

      {/* Hito 5 #78 (S1): declared metadata + MusicBrainz lookup. Accepting a
          suggestion fills that input; genre/year acceptances also persist as
          enrichments rows after creation (Songs.jsx). */}
      <div>
        <label htmlFor="song-artist" className="block text-sm font-medium text-cem-text">Artist</label>
        <input
          id="song-artist"
          name="artist"
          value={form.artist}
          onChange={handleChange}
          placeholder="e.g. Hillsong United"
          disabled={submitting}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="song-genre" className="block text-sm font-medium text-cem-text">Genre</label>
          <input
            id="song-genre"
            name="genre"
            value={form.genre}
            onChange={handleChange}
            placeholder="e.g. Worship"
            disabled={submitting}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="song-year" className="block text-sm font-medium text-cem-text">Year</label>
          <input
            id="song-year"
            name="year"
            type="number"
            min="1"
            value={form.year}
            onChange={handleChange}
            placeholder="e.g. 1998"
            disabled={submitting}
            className={`${inputClass} ${errors.year ? 'border-cem-rose/40' : ''}`}
          />
          {errors.year && <p className="mt-1 text-xs text-cem-rose">{errors.year}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={handleLookupMetadata}
          disabled={!online || form.title.trim().length < 3 || mb.status === 'looking' || submitting}
          title={!online
            ? 'Offline — metadata lookup needs a connection'
            : form.title.trim().length < 3
              ? 'Type at least 3 title characters to look up metadata'
              : ''}
          className="rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mb.status === 'looking' ? 'Looking up metadata…' : 'Look up metadata'}
        </button>
        {mb.status === 'noMatch' && (
          <p className="text-xs text-cem-secondary">No MusicBrainz match — save with your own values.</p>
        )}
        {mb.status === 'offline' && (
          <p className="text-xs text-cem-amber">Offline — metadata lookup needs a connection.</p>
        )}
        {mb.status === 'error' && (
          <p className="text-xs text-cem-rose" role="alert">Metadata lookup failed. Try again later.</p>
        )}
        {suggestionFields.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestionFields.map((f) => (
              <span
                key={f.key}
                className="inline-flex items-center gap-1.5 rounded-md bg-cem-amber/10 px-2 py-1 text-xs text-cem-amber"
              >
                <span className="font-medium capitalize">{f.label}:</span> {f.value}
                <button
                  type="button"
                  onClick={() => acceptField(f.key, f.value)}
                  className="rounded bg-cem-amber px-1.5 text-[10px] font-bold text-cem-base hover:bg-cem-amber/90"
                >
                  Use
                </button>
                <button
                  type="button"
                  onClick={() => rejectField(f.key)}
                  className="rounded px-1 text-[10px] font-bold text-cem-amber hover:bg-cem-amber/20"
                  aria-label={`Reject ${f.label} suggestion`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
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

      {/* Hito 5 #76: chart source — ChordPro text (existing) vs PDF scan */}
      <div>
        <span className="block text-sm font-medium text-cem-text">Chart source</span>
        <div className="mt-1 flex w-fit gap-1 rounded-md border border-cem-elevated p-0.5">
          <button
            type="button"
            onClick={() => handleSourceChange('chordpro')}
            disabled={submitting}
            className={`rounded px-3 py-1 text-sm font-medium disabled:opacity-60 ${source === 'chordpro' ? 'bg-cem-amber text-cem-base' : 'text-cem-secondary hover:bg-cem-elevated'}`}
          >
            ChordPro text
          </button>
          <button
            type="button"
            onClick={() => handleSourceChange('pdf')}
            disabled={submitting}
            className={`rounded px-3 py-1 text-sm font-medium disabled:opacity-60 ${source === 'pdf' ? 'bg-cem-amber text-cem-base' : 'text-cem-secondary hover:bg-cem-elevated'}`}
          >
            PDF scan
          </button>
        </div>
      </div>

      {source === 'pdf' ? (
        <div>
          <label htmlFor="song-pdf" className="block text-sm font-medium text-cem-text">
            PDF scan {isPdfSong ? '' : '*'}
          </label>
          <input
            id="song-pdf"
            type="file"
            accept="application/pdf,.pdf"
            onChange={handlePdfPick}
            disabled={submitting || isPdfSong}
            className="mt-1 block w-full text-sm text-cem-secondary file:mr-3 file:rounded-md file:border-0 file:bg-cem-elevated file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-cem-text hover:file:bg-cem-elevated/80 disabled:opacity-60"
          />
          {isPdfSong
            ? (
              <p className="mt-1 text-xs text-cem-secondary">
                Current chart is a PDF scan — replace it from the song page (version history keeps the previous scan).
              </p>
            )
            : (
              <>
                {pdfFile && <p className="mt-1 text-xs text-cem-text">Chosen: {pdfFile.name}</p>}
                {(errors.pdf || pdfError) && <p className="mt-1 text-xs text-cem-rose">{errors.pdf || pdfError}</p>}
              </>
            )}
        </div>
      ) : (
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
      )}

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
