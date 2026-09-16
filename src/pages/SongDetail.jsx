import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSongs } from '../hooks/useSongs.js'
import { usePreferences } from '../hooks/usePreferences.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { parseChordPro } from '../lib/chordpro/parser.js'
import { capoLabel, initialSemitones, transposeKey, transposeParsed } from '../lib/transpose.js'
import { listAnnotations } from '../lib/annotations.js'
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
  const { user } = useAuth()
  const { prefs } = usePreferences()
  const { getSong, getPlayedAt, updateSong, retireSong, reactivateSong } = useSongs()
  const [song, setSong] = useState(null)
  const [playedAt, setPlayedAt] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [annotations, setAnnotations] = useState([])
  const [semitones, setSemitones] = useState(0)

  useEffect(() => {
    let cancelled = false
    getSong(id)
      .then((data) => { if (!cancelled) setSong(data) })
      .catch(() => { if (!cancelled) setError('Song not found.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    let cancelled = false
    getPlayedAt(id)
      .then((data) => { if (!cancelled) setPlayedAt(data) })
      .catch(() => { if (!cancelled) setPlayedAt([]) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 3.4: render the author's personal annotations (self-scoped) on this view.
  useEffect(() => {
    let cancelled = false
    if (!user?.id || !id) return undefined
    listAnnotations(user.id, id).then((rows) => { if (!cancelled) setAnnotations(rows) })
    return () => { cancelled = true }
  }, [user?.id, id])

  const parsed = useMemo(() => (song?.body ? parseChordPro(song.body) : null), [song?.body])

  const displayKey = useMemo(() => {
    if (!parsed) return ''
    return semitones ? transposeKey(parsed.key, semitones) : parsed.key
  }, [parsed, semitones])

  // 3b renderer boundary: chart surfaces seed the global offset + override.
  const baseline = song ? initialSemitones(prefs.transpose, prefs.overrides[song.id]) : 0
  useEffect(() => {
    setSemitones(baseline)
  }, [baseline])

  const transposed = useMemo(() => {
    if (!parsed) return null
    return transposeParsed(parsed, semitones)
  }, [parsed, semitones])

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

      {playedAt.length > 0 && (
        <div className="mt-4 rounded-md bg-cem-elevated px-3 py-2">
          <p className="mb-1 text-xs font-medium text-cem-secondary">
            Played at · demand {playedAt.length}
          </p>
          <ul className="space-y-0.5">
            {playedAt.map((p, i) => (
              <li key={i} className="text-xs text-cem-text">
                played at{' '}
                <Link to={`/gigs/${p.gigId}`} className="font-medium text-cem-amber hover:underline">
                  {p.gigName}
                </Link>{' '}
                · {new Date(p.performedAt).toLocaleDateString()}
              </li>
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
      ) : parsed ? (
        <div className="mt-6">
          {(semitones !== 0 || prefs.capo > 0) && (
            <p className="mb-2 text-xs text-cem-secondary">
              {semitones !== 0 && `${displayKey} · ${semitones > 0 ? '+' : ''}${semitones} semitones`}
              {semitones !== 0 && prefs.capo > 0 ? ' · ' : ''}
              {prefs.capo > 0 ? capoLabel(displayKey, prefs.capo) : ''}
            </p>
          )}
          <ChordProRenderer
            parsed={transposed}
            annotations={annotations}
            semitones={semitones}
            baseKey={parsed?.key}
          />
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
