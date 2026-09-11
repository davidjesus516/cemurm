import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSongs } from '../hooks/useSongs.js'
import { parseChordPro } from '../lib/chordpro/parser.js'
import { computeReadiness } from '../lib/readiness.js'
import ChordProRenderer from '../components/notation/ChordProRenderer.jsx'

/* eslint-disable react/prop-types */

const STATUS_STYLES = {
  ready: 'bg-cem-emerald/10 text-cem-emerald',
  draft: 'bg-cem-amber/10 text-cem-amber',
  retired: 'bg-cem-elevated text-cem-secondary',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {status}
    </span>
  )
}

function TransitionLine({ t }) {
  const date = new Date(t.at).toLocaleDateString()
  return (
    <li className="text-xs text-cem-secondary">
      {(t.to || '?').charAt(0).toUpperCase() + (t.to || '?').slice(1)} ← {(t.from || '?').charAt(0).toUpperCase() + (t.from || '?').slice(1)} · {date}
      {t.reason ? ` (${t.reason})` : ''}
    </li>
  )
}

export default function SongDetail() {
  const { id } = useParams()
  const { getSong, updateSong, retireSong, reactivateSong } = useSongs()
  const [song, setSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSong(id)
      .then((data) => { if (!cancelled) setSong(data) })
      .catch(() => { if (!cancelled) setError('Song not found.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function startEditing() {
    setBody(song?.body || '')
    setError('')
    setEditing(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateSong(id, { body })
      setSong(updated)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRetire() {
    if (!window.confirm(`Retire "${song.title}"? It won't appear in the active list.`)) return
    const retired = await retireSong(id)
    setSong(retired)
  }

  async function handleReactivate() {
    const reactivated = await reactivateSong(id)
    setSong(reactivated)
  }

  if (loading) return <p className="text-sm text-cem-secondary">Loading song…</p>

  if (error && !song) {
    return (
      <div>
        <p className="rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>
        <Link to="/songs" className="mt-4 inline-block text-sm font-medium text-cem-amber hover:underline">
          Back to repertoire
        </Link>
      </div>
    )
  }

  const transitions = song?.transitionHistory || []
  const isRetired = song?.status === 'retired'

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/songs" className="text-sm font-medium text-cem-amber hover:underline">
        ← Back to repertoire
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cem-text">{song.title}</h1>
          <p className="mt-1 text-sm text-cem-secondary">
            {[song.key, song.bpm && `${song.bpm} BPM`].filter(Boolean).join(' · ') ||
              'No key or BPM set'}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={song.status} />
            {song.status === 'draft' && (
              <span className="text-xs text-cem-amber">{computeReadiness(song).reason}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!isRetired && !editing && song.body && (
            <>
              <Link
                to={`/songs/${id}/practice`}
                className="rounded-md border border-cem-emerald/40 px-3 py-1.5 text-sm font-medium text-cem-emerald hover:bg-cem-emerald/10"
              >
                Practice
              </Link>
              <button
                type="button"
                onClick={startEditing}
                className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-text hover:bg-cem-elevated"
              >
                Edit chart
              </button>
            </>
          )}
          {isRetired ? (
            <button
              type="button"
              onClick={handleReactivate}
              className="rounded-md border border-cem-emerald/40 px-3 py-1.5 text-sm font-medium text-cem-emerald hover:bg-cem-emerald/10"
            >
              Reactivate
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRetire}
              className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-secondary hover:bg-cem-elevated"
            >
              Retire
            </button>
          )}
        </div>
      </div>

      {transitions.length > 0 && (
        <div className="mt-4 rounded-md bg-cem-elevated px-3 py-2">
          <p className="mb-1 text-xs font-medium text-cem-secondary">Transition history</p>
          <ul className="space-y-0.5">
            {[...transitions].reverse().map((t, i) => (
              <TransitionLine key={i} t={t} />
            ))}
          </ul>
        </div>
      )}

      {editing ? (
        <form onSubmit={handleSave} className="mt-6 space-y-3">
          <label htmlFor="song-body" className="block text-sm font-medium text-cem-text">
            ChordPro text
          </label>
          <textarea
            id="song-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder={`{title: ${song.title}}\n[C]Lyric line with [G7]chords…`}
            className="w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 font-mono text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber"
          />
          {error && <p className="text-sm text-cem-rose">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save chart'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError('') }}
              disabled={saving}
              className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : song.body ? (
        <div className="mt-6">
          <ChordProRenderer parsed={parseChordPro(song.body)} />
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-cem-elevated bg-cem-surface p-8 text-center">
          <h2 className="text-base font-semibold text-cem-text">No chord chart yet</h2>
          <p className="mt-1 text-sm text-cem-secondary">
            Paste ChordPro text to see chords rendered above the lyrics.
          </p>
          <button
            type="button"
            onClick={startEditing}
            className="mt-4 rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
          >
            Add ChordPro text
          </button>
        </div>
      )}
    </div>
  )
}
