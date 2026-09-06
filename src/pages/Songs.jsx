import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSongs } from '../hooks/useSongs.js'
import SongForm from '../components/songs/SongForm.jsx'

export default function Songs() {
  const { songs, loading, addSong, updateSong, deleteSong, searchSongs } = useSongs()
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

      <input
        type="text"
        value={search}
        onChange={handleSearch}
        placeholder="Search by title…"
        className="mt-4 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

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
          {search ? 'No songs match your search.' : 'No songs yet. Add your first song above.'}
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
                {song.key && <span className="ml-2 text-xs text-gray-500">{song.key}</span>}
                {song.bpm && <span className="ml-2 text-xs text-gray-500">{song.bpm} BPM</span>}
                {song.hasChordChart && <span className="ml-2 text-xs text-indigo-500">♫</span>}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(song)}
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  Edit
                </button>
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
