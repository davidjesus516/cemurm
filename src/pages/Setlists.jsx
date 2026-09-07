import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSetlists } from '../hooks/useSetlists.js'

export default function Setlists() {
  const { setlists, loading, createSetlist, deleteSetlist, duplicateSetlist } = useSetlists()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createSetlist(name)
      setName('')
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDuplicate(setlist) {
    const target = window.prompt('Duplicate as:', `${setlist.name} - Copy`)
    if (target === null) return
    try {
      await duplicateSetlist(setlist.id, target)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(setlist) {
    if (!window.confirm(`Delete setlist "${setlist.name}"?`)) return
    await deleteSetlist(setlist.id)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Setlists</h1>
        {!showForm && (
          <button
            type="button"
            onClick={() => { setShowForm(true); setError('') }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            New Setlist
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 flex items-start gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Setlist name (e.g. Friday Gig)"
            className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            disabled={busy}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </form>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading setlists…</p>
      ) : setlists.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No setlists yet. Create your first one above.</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-200 rounded-lg border bg-white shadow-sm">
          {setlists.map((setlist) => (
            <li key={setlist.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/setlists/${setlist.id}`}
                    className="text-sm font-medium text-gray-900 hover:text-indigo-600"
                  >
                    {setlist.name}
                  </Link>
                  <span className="text-xs text-gray-500">
                    {setlist.itemIds.length} song{setlist.itemIds.length === 1 ? '' : 's'} · {setlist.durationLabel}
                  </span>
                </div>
                {setlist.songs.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {setlist.songs.map((s) => s.title).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={() => handleDuplicate(setlist)}
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(setlist)}
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