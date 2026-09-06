import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSongs } from '../hooks/useSongs.js'
import { parseChordPro } from '../lib/chordpro/parser.js'
import ChordProRenderer from '../components/notation/ChordProRenderer.jsx'

export default function SongDetail() {
  const { id } = useParams()
  const { getSong, updateSong } = useSongs()
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

  if (loading) return <p className="text-sm text-gray-500">Loading song…</p>

  if (error && !song) {
    return (
      <div>
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        <Link to="/songs" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Back to repertoire
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/songs" className="text-sm font-medium text-indigo-600 hover:underline">
        ← Back to repertoire
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{song.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {[song.key, song.bpm && `${song.bpm} BPM`].filter(Boolean).join(' · ') ||
              'No key or BPM set'}
          </p>
        </div>
        {!editing && song.body && (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit chart
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="mt-6 space-y-3">
          <label htmlFor="song-body" className="block text-sm font-medium text-gray-700">
            ChordPro text
          </label>
          <textarea
            id="song-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder={`{title: ${song.title}}\n[C]Lyric line with [G7]chords…`}
            className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save chart'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError('') }}
              disabled={saving}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
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
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <h2 className="text-base font-semibold text-gray-900">No chord chart yet</h2>
          <p className="mt-1 text-sm text-gray-500">
            Paste ChordPro text to see chords rendered above the lyrics.
          </p>
          <button
            type="button"
            onClick={startEditing}
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add ChordPro text
          </button>
        </div>
      )}
    </div>
  )
}