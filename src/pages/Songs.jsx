import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSongs } from '../hooks/useSongs.js'
import { computeReadiness } from '../lib/readiness.js'
import { formatDuration } from '../lib/duration.js'
import { filterSongs, matchedChords, parseTempoRange, songMatchesKey } from '../lib/search.js'
import SongForm from '../components/songs/SongForm.jsx'

/* eslint-disable react/prop-types */

const STATUS_STYLES = {
  ready: 'bg-cem-emerald/10 text-cem-emerald',
  draft: 'bg-cem-amber/10 text-cem-amber',
  retired: 'bg-cem-elevated text-cem-secondary',
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
  const { songs, loading, addSong, updateSong, deleteSong, retireSong, reactivateSong } = useSongs({ retired: retiredView })
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [keyFilter, setKeyFilter] = useState('')
  const [tempo, setTempo] = useState('')
  const [tempoRange, setTempoRange] = useState(null)
  const [error, setError] = useState('')

  // ponytail: filter the full active list client-side with the pure helpers;
  // songs.searchSongs stays as the future Supabase surface. Fine under the
  // 500-song cap — server-side composition is chunk C8+ territory.
  const filtersActive = Boolean(search.trim() || keyFilter || tempoRange)
  const visible = filterSongs(songs, { query: search, key: keyFilter, tempo: tempoRange })
  const keys = [...new Set(songs.map((s) => s.key).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const keyCount = songs.filter((s) => songMatchesKey(s, keyFilter)).length

  function handleSearch(e) {
    setSearch(e.target.value)
  }

  function handleTempo(e) {
    const val = e.target.value
    setTempo(val)
    // Invalid input is ignored — keep the previous valid range (or none).
    const range = parseTempoRange(val)
    if (val.trim() === '' || range) setTempoRange(range)
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
        <h1 className="text-2xl font-bold text-cem-text">Repertoire</h1>
        {!showForm && !editing && (
          <button
            type="button"
            onClick={() => { setShowForm(true); setError('') }}
            className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
          >
            Add Song
          </button>
        )}
      </div>

      {/* Active / Retired toggle */}
      <div className="mt-4 flex gap-1 rounded-md border border-cem-elevated p-0.5" style={{ width: 'fit-content' }}>
        <button
          type="button"
          onClick={() => setRetiredView(false)}
          className={`rounded px-3 py-1 text-sm font-medium ${!retiredView ? 'bg-cem-amber text-cem-base' : 'text-cem-secondary hover:bg-cem-elevated'}`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setRetiredView(true)}
          className={`rounded px-3 py-1 text-sm font-medium ${retiredView ? 'bg-cem-amber text-cem-base' : 'text-cem-secondary hover:bg-cem-elevated'}`}
        >
          Retired
        </button>
      </div>

      {!retiredView && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search by title or chord…"
            className="w-full max-w-md rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber"
          />
          <select
            value={keyFilter}
            onChange={(e) => setKeyFilter(e.target.value)}
            className="rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber"
          >
            <option value="">All keys</option>
            {keys.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <input
            type="text"
            value={tempo}
            onChange={handleTempo}
            placeholder="Tempo range, e.g. 70-100"
            className="w-44 rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber"
          />
          {keyFilter && (
            <span className="rounded-md bg-cem-amber/10 px-2 py-1 text-xs font-medium text-cem-amber">
              {keyCount} songs in {keyFilter}
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>
      )}

      {showForm && (
        <div className="mt-4">
          <h2 className="mb-2 text-lg font-semibold text-cem-text">New Song</h2>
          <SongForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} submitLabel="Add Song" />
        </div>
      )}

      {editing && (
        <div className="mt-4">
          <h2 className="mb-2 text-lg font-semibold text-cem-text">Edit Song</h2>
          <SongForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} submitLabel="Save Changes" />
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-cem-secondary">Loading repertoire…</p>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-sm text-cem-secondary">
          {retiredView
            ? 'No retired songs.'
            : filtersActive ? 'No results — try adjusting your filters.' : 'No songs yet. Add your first song above.'}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
          {visible.map((song) => {
            const matched = matchedChords(song, search)
            return (
              <li key={song.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <Link
                    to={`/songs/${song.id}`}
                    className="text-sm font-medium text-cem-text hover:text-cem-amber"
                  >
                    {song.title}
                  </Link>
                  <StatusBadge status={song.status} />
                  {matched.length > 0 && (
                    <span className="ml-2 inline-block rounded-full bg-cem-amber/10 px-2 py-0.5 text-xs font-medium text-cem-amber">
                      matched chord: {matched.join(', ')}
                    </span>
                  )}
                  {song.key && <span className="ml-2 text-xs text-cem-secondary">{song.key}</span>}
                  {song.bpm && <span className="ml-2 text-xs text-cem-secondary">{song.bpm} BPM</span>}
                  {song.durationSeconds && <span className="ml-2 text-xs text-cem-secondary">{formatDuration(song.durationSeconds)}</span>}
                  {song.hasChordChart && <span className="ml-2 text-xs text-cem-amber">♫</span>}
                  {song.status === 'draft' && !retiredView && (
                    <p className="mt-0.5 text-xs text-cem-amber">{computeReadiness(song).reason}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {retiredView ? (
                    <button
                      type="button"
                      onClick={() => handleReactivate(song)}
                      className="text-xs font-medium text-cem-emerald hover:underline"
                    >
                      Reactivate
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(song)}
                        className="text-xs font-medium text-cem-amber hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRetire(song)}
                        className="text-xs font-medium text-cem-secondary hover:underline"
                      >
                        Retire
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(song)}
                    className="text-xs font-medium text-cem-rose hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
