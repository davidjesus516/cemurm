import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSongs } from '../hooks/useSongs.js'
import { computeReadiness } from '../lib/readiness.js'
import { formatDuration } from '../lib/duration.js'
import SongForm from '../components/songs/SongForm.jsx'

/* eslint-disable react/prop-types */

const STATUS_STYLES = {
  ready: 'bg-green-100 text-green-800',
  draft: 'bg-amber-100 text-amber-800',
  retired: 'bg-gray-100 text-gray-500',
}

function StatusBadge({ status }) {
  return (
    <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {status}
    </span>
  )
}

export default function Songs() {
  const [retiredView, setRetiredView] = useState(false)
  const { songs, loading, addSong, updateSong, deleteSong, retireSong, reactivateSong, searchSongs } = useSongs({ retired: retiredView })
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  function handleSearch(e) {
    const q = e.target.value
    setSearch(q)
    searchSongs(q)
  }

  async function handleAdd(payload) {
    await addSong(payload)
    setShowForm(false)
  }

  function startEdit(song) {
    setEditing(song)
    setShowForm(false)
  }

  async function handleUpdate(payload) {
    await updateSong(editing.id, payload)
    setEditing(null)
  }

  async function handleDelete(song) {
    if (!window.confirm(`Delete "${song.title}"?`)) return
    await deleteSong(song.id)
  }

  async function handleRetire(song) {
    if (!window.confirm(`Retire "${song.title}"? It won't appear in the active list.`)) return
    await retireSong(song.id)
  }

  async function handleReactivate(song) {
    await reactivateSong(song.id)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Repertoire</h1>
        {!showForm && !editing && (
          <button
            type="button"
            onClick={() => { setShowForm(true); setError('') }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add Song
          </button>
        )}
      </div>

      {/* Active / Retired toggle */}
      <div className="mt-4 flex gap-1 rounded-md border border-gray-200 p-0.5" style={{ width: 'fit-content' }}>
        <button
          type="button"
          onClick={() => setRetiredView(false)}
          className={`rounded px-3 py-1 text-sm font-medium ${!retiredView ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setRetiredView(true)}
          className={`rounded px-3 py-1 text-sm font-medium ${retiredView ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Retired
        </button>
      </div>

      {!retiredView && (
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Search by title…"
          className="mt-3 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      )}

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {showForm && (
        <div className="mt-4">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">New Song</h2>
          <SongForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} submitLabel="Add Song" />
        </div>
      )}

      {editing && (
        <div className="mt-4">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">Edit Song</h2>
          <SongForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} submitLabel="Save Changes" />
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading repertoire…</p>
      ) : songs.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          {retiredView
            ? 'No retired songs.'
            : search ? 'No songs match your search.' : 'No songs yet. Add your first song above.'}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-200 rounded-lg border bg-white shadow-sm">
          {songs.map((song) => (
            <li key={song.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link
                  to={`/songs/${song.id}`}
                  className="text-sm font-medium text-gray-900 hover:text-indigo-600"
                >
                  {song.title}
                </Link>
                <StatusBadge status={song.status} />
                {song.key && <span className="ml-2 text-xs text-gray-500">{song.key}</span>}
                {song.bpm && <span className="ml-2 text-xs text-gray-500">{song.bpm} BPM</span>}
                {song.durationSeconds && <span className="ml-2 text-xs text-gray-500">{formatDuration(song.durationSeconds)}</span>}
                {song.hasChordChart && <span className="ml-2 text-xs text-indigo-500">♫</span>}
                {song.status === 'draft' && !retiredView && (
                  <p className="mt-0.5 text-xs text-amber-600">{computeReadiness(song).reason}</p>
                )}
              </div>
              <div className="flex gap-2">
                {retiredView ? (
                  <button
                    type="button"
                    onClick={() => handleReactivate(song)}
                    className="text-xs font-medium text-green-600 hover:underline"
                  >
                    Reactivate
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(song)}
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRetire(song)}
                      className="text-xs font-medium text-gray-500 hover:underline"
                    >
                      Retire
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(song)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
