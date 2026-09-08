import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSetlists } from '../hooks/useSetlists.js'
import { useSongs } from '../hooks/useSongs.js'
import { formatDuration } from '../lib/duration.js'

export default function SetlistDetail() {
  const { id } = useParams()
  const { setlists, loading, updateSetlist, addSong, removeSong, moveSong } = useSetlists()
  const { songs: availableSongs, loading: songsLoading } = useSongs()
  const [error, setError] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [busy, setBusy] = useState(false)

  // Derived: the hook already enriches each setlist with resolved songs + duration.
  const setlist = setlists.find((s) => s.id === id)

  if (loading || songsLoading) return <p className="text-sm text-gray-500">Loading setlist…</p>

  if (!setlist) {
    return (
      <div>
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Setlist not found.</p>
        <Link to="/setlists" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          ← Back to setlists
        </Link>
      </div>
    )
  }

  const itemIds = setlist.itemIds
  const pickerSongs = availableSongs.filter((s) => !itemIds.includes(s.id))

  async function saveName(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await updateSetlist(setlist.id, { name })
      setEditingName(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(songId) {
    try {
      await removeSong(setlist.id, songId)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAdd(songId) {
    setBusy(true)
    setError('')
    try {
      await addSong(setlist.id, songId)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/setlists" className="text-sm font-medium text-indigo-600 hover:underline">
        ← Back to setlists
      </Link>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-4">
        {editingName ? (
          <form onSubmit={saveName} className="flex items-start gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-lg font-bold text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              disabled={busy}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </form>
        ) : (
          <h1 className="text-2xl font-bold text-gray-900">{setlist.name}</h1>
        )}
        {!editingName && (
          <button
            type="button"
            onClick={() => { setName(setlist.name); setEditingName(true) }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Rename
          </button>
        )}
      </div>

      <p className="mt-2 text-sm text-gray-600">
        {setlist.durationLabel === '—'
          ? 'Unknown durations'
          : `Estimated duration: ${setlist.durationLabel}`}
        {' '}· {itemIds.length} song{itemIds.length === 1 ? '' : 's'}
      </p>

      <button
        type="button"
        onClick={() => setShowPicker((v) => !v)}
        className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        {showPicker ? 'Hide picker' : 'Add Song'}
      </button>

      {showPicker && (
        <div className="mt-3 rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Add from repertoire</h2>
          {pickerSongs.length === 0 ? (
            <p className="text-sm text-gray-500">No more songs in your repertoire.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {pickerSongs.map((song) => (
                <li key={song.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{song.title}</span>
                    {song.key && <span className="ml-2 text-xs text-gray-500">{song.key}</span>}
                    {song.status === 'draft' && (
                      <span className="ml-2 text-xs text-amber-600">(draft — chart incomplete)</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(song.id)}
                    disabled={busy}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {itemIds.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No songs in this setlist yet. Add one above.</p>
      ) : (
        <ol className="mt-4 divide-y divide-gray-200 rounded-lg border bg-white shadow-sm">
          {itemIds.map((songId, index) => {
            const song = setlist.songs.find((s) => s.id === songId)
            return (
              <li key={songId} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-right text-xs text-gray-400">{index + 1}.</span>
                  <div>
                    <span className="text-sm font-medium text-gray-900">{song?.title || '(missing song)'}</span>
                    {song && (
                      <span className="ml-2 text-xs text-gray-500">
                        {[song.key, song.durationSeconds && formatDuration(song.durationSeconds)]
                          .filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveSong(setlist.id, index, 0).catch((err) => setError(err.message))}
                    disabled={index === 0}
                    title="Move to top"
                    className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    ↑ top
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSong(setlist.id, index, index - 1).catch((err) => setError(err.message))}
                    disabled={index === 0}
                    title="Move up"
                    className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSong(setlist.id, index, index + 1).catch((err) => setError(err.message))}
                    disabled={index === itemIds.length - 1}
                    title="Move down"
                    className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(songId)}
                    className="ml-1 text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}