import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { useSetlists } from '../hooks/useSetlists.js'
import { useSongs } from '../hooks/useSongs.js'
import { useBandmates } from '../hooks/useBandmates.js'
import * as setlistStore from '../lib/setlists.js'
import { describeActivity } from '../lib/setlistCollab.js'
import { getProfile } from '../lib/profiles.js'
import { formatDuration } from '../lib/duration.js'

export default function SetlistDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { setlists, loading, refresh, updateSetlist, addSong, removeSong, moveSong, setSongVersion } = useSetlists()
  const { songs: availableSongs, loading: songsLoading } = useSongs()
  const { active: bandmates } = useBandmates()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  // 2.2 collaboration surface (owner-only roster; RLS select_self caps
  // non-owners to their own row, which the UI never renders).
  const [collabs, setCollabs] = useState([])
  const [selected, setSelected] = useState([])
  const [transferTo, setTransferTo] = useState('')
  // 2.3 activity feed (R11): client-derived, newest first, broadcast-only.
  const [showActivity, setShowActivity] = useState(false)
  const [feed, setFeed] = useState([])
  const [myName, setMyName] = useState('Someone')

  useEffect(() => {
    if (!user) return
    getProfile(user.id)
      .then((profile) => setMyName(profile?.displayName || profile?.username || 'Someone'))
      .catch(() => {})
  }, [user])

  useEffect(() => {
    if (!showActivity || !id) return undefined
    return setlistStore.subscribeActivity(id, (payload) => {
      setFeed((prev) => [payload, ...prev])
    })
  }, [showActivity, id])

  const loadCollabs = useCallback(async () => {
    if (!user || !id) return
    try {
      setCollabs(await setlistStore.listCollaborators(user.id, id))
    } catch {
      // Non-owners fall back to their own RLS row; the manage UI is hidden.
    }
  }, [user, id])

  useEffect(() => {
    loadCollabs()
  }, [loadCollabs])

  // Derived: the hook already enriches each setlist with resolved songs + duration.
  const setlist = setlists.find((s) => s.id === id)

  if (loading || songsLoading) return <p className="text-sm text-cem-secondary">Loading setlist…</p>

  if (!setlist) {
    return (
      <div>
        <p className="rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">Setlist not found.</p>
        <Link to="/setlists" className="mt-4 inline-block text-sm font-medium text-cem-amber hover:underline">
          ← Back to setlists
        </Link>
      </div>
    )
  }

  const itemIds = setlist.itemIds
  const pickerSongs = availableSongs.filter((s) => !itemIds.includes(s.id))
  // Owner manage surface (2.2): bandmates not yet shared, and the accepted
  // subset eligible to take ownership (R9).
  const shareOptions = bandmates.filter((b) => !collabs.some((c) => c.userId === b.userId))
  const acceptedCollabs = collabs.filter((c) => !c.pending)

  // Emit a feed event and show it locally in the same step (Realtime never
  // echoes a broadcast back to its sender).
  function emitActivity(action) {
    setFeed((prev) => [setlistStore.broadcastActivity(setlist.id, action, myName), ...prev])
  }

  function handleMove(fromIndex, toIndex) {
    moveSong(setlist.id, fromIndex, toIndex)
      .then(() => emitActivity('reorder'))
      .catch((err) => setError(err.message))
  }

  function toggleTarget(bandmateId) {
    setSelected((prev) => (prev.includes(bandmateId)
      ? prev.filter((x) => x !== bandmateId)
      : [...prev, bandmateId]))
  }

  async function handleVisibility(visibility) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await setlistStore.setVisibility(user.id, setlist.id, visibility)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleShare() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await setlistStore.shareWithBandmates(user.id, setlist.id, selected)
      setSelected([])
      await refresh()
      await loadCollabs()
      emitActivity('share')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handlePermission(collab, canEdit) {
    setError('')
    setNotice('')
    try {
      await setlistStore.setCollaboratorPermission(user.id, setlist.id, collab.userId, canEdit)
      await loadCollabs()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemoveCollaborator(collab) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const remaining = collabs.filter((c) => c.userId !== collab.userId).length
      await setlistStore.removeCollaborator(user.id, setlist.id, collab.userId)
      await loadCollabs()
      await refresh()
      setNotice(`${remaining} collaborator${remaining === 1 ? '' : 's'} remaining`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleTransfer() {
    const target = collabs.find((c) => c.userId === transferTo)
    if (!target) return
    const label = target.displayName || target.username
    if (!window.confirm(`Transfer ownership of "${setlist.name}" to ${label}?`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await setlistStore.transferOwnership(user.id, setlist.id, target.userId)
      setTransferTo('')
      await refresh()
      await loadCollabs()
      emitActivity('transfer-ownership')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

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
      <Link to="/setlists" className="text-sm font-medium text-cem-amber hover:underline">
        ← Back to setlists
      </Link>

      {error && (
        <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>
      )}

      {notice && (
        <p className="mt-3 rounded-md bg-cem-amber/10 px-3 py-2 text-sm text-cem-amber">{notice}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-4">
        {editingName ? (
          <form onSubmit={saveName} className="flex items-start gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-cem-elevated bg-cem-surface px-3 py-1.5 text-lg font-bold text-cem-text focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber"
            />
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-md bg-cem-amber px-3 py-1.5 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              disabled={busy}
              className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
            >
              Cancel
            </button>
          </form>
        ) : (
          <h1 className="text-2xl font-bold text-cem-text">{setlist.name}</h1>
        )}
        {!editingName && setlist.isOwner && (
          <button
            type="button"
            onClick={() => { setName(setlist.name); setEditingName(true) }}
            className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-text hover:bg-cem-elevated"
          >
            Rename
          </button>
        )}
      </div>

      <p className="mt-2 text-sm text-cem-secondary">
        {setlist.durationLabel === '—'
          ? 'Unknown durations'
          : `Estimated duration: ${setlist.durationLabel}`}
        {' '}· {itemIds.length} song{itemIds.length === 1 ? '' : 's'}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {setlist.visibility === 'shared' && (
          <span className="rounded bg-cem-elevated px-1.5 py-0.5 text-xs font-medium text-cem-amber">
            Shared
          </span>
        )}
        {!setlist.isOwner && !setlist.canEdit && (
          <span className="rounded bg-cem-elevated px-1.5 py-0.5 text-xs font-medium text-cem-amber">
            View only
          </span>
        )}
        {setlist.isOwner && (
          <label className="flex items-center gap-2 text-sm text-cem-secondary">
            <span>Visibility</span>
            <select
              value={setlist.visibility}
              onChange={(e) => handleVisibility(e.target.value)}
              disabled={busy}
              className="rounded-md border border-cem-elevated bg-cem-surface px-2 py-1 text-sm text-cem-text focus:border-cem-amber focus:outline-none disabled:opacity-60"
            >
              <option value="private">Private</option>
              <option value="shared">Shared with band</option>
              <option value="public">Public</option>
            </select>
          </label>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          to={`/setlists/${setlist.id}/stage`}
          className="rounded-md border border-cem-amber px-4 py-2 text-sm font-medium text-cem-amber hover:bg-cem-amber/10"
        >
          ▶ Stage Mode
        </Link>
        {setlist.canEdit && (
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
          >
            {showPicker ? 'Hide picker' : 'Add Song'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowActivity((v) => !v)}
          className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated"
        >
          {showActivity ? 'Hide activity' : 'Activity'}
        </button>
      </div>

      {showActivity && (
        <div className="mt-4 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-cem-text">Activity</h2>
          {feed.length === 0 ? (
            <p className="mt-2 text-xs text-cem-secondary">No activity recorded yet.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {feed.map((event) => (
                <li
                  key={`${event.ts}-${event.action}-${event.actor}`}
                  className="flex items-baseline justify-between gap-3 text-sm text-cem-text"
                >
                  <span>{describeActivity(event)}</span>
                  <span className="shrink-0 text-xs text-cem-secondary">
                    {new Date(event.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {setlist.canEdit && showPicker && (
        <div className="mt-3 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-cem-text">Add from repertoire</h2>
          {pickerSongs.length === 0 ? (
            <p className="text-sm text-cem-secondary">No more songs in your repertoire.</p>
          ) : (
            <ul className="divide-y divide-cem-elevated">
              {pickerSongs.map((song) => (
                <li key={song.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-cem-text">{song.title}</span>
                    {song.key && <span className="ml-2 text-xs text-cem-secondary">{song.key}</span>}
                    {song.status === 'draft' && (
                      <span className="ml-2 text-xs text-cem-amber">(draft — chart incomplete)</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(song.id)}
                    disabled={busy}
                    className="rounded-md border border-cem-elevated px-3 py-1 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {setlist.isOwner && (
        <div className="mt-4 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-cem-text">Collaboration</h2>

          <div className="mt-2">
            <h3 className="text-xs font-medium text-cem-secondary">Share with bandmates</h3>
            {shareOptions.length === 0 ? (
              <p className="mt-1 text-xs text-cem-secondary">All bandmates are already collaborators.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {shareOptions.map((bandmate) => (
                  <li key={bandmate.userId}>
                    <label className="flex items-center gap-2 text-sm text-cem-text">
                      <input
                        type="checkbox"
                        checked={selected.includes(bandmate.userId)}
                        onChange={() => toggleTarget(bandmate.userId)}
                        disabled={busy}
                      />
                      {bandmate.profile?.displayName || bandmate.profile?.username || 'Bandmate'}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={handleShare}
              disabled={busy || selected.length === 0}
              className="mt-2 rounded-md bg-cem-amber px-3 py-1 text-xs font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
            >
              Share selected
            </button>
          </div>

          <div className="mt-3 border-t border-cem-elevated pt-2">
            <h3 className="text-xs font-medium text-cem-secondary">Collaborators</h3>
            {collabs.length === 0 ? (
              <p className="mt-1 text-xs text-cem-secondary">No collaborators yet.</p>
            ) : (
              <ul className="mt-1 divide-y divide-cem-elevated">
                {collabs.map((collab) => (
                  <li key={collab.userId} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-sm text-cem-text">
                      {collab.displayName || collab.username || 'Collaborator'}
                    </span>
                    {collab.pending ? (
                      <span className="text-xs text-cem-secondary">Invited</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={collab.canEdit ? 'edit' : 'view'}
                          onChange={(e) => handlePermission(collab, e.target.value === 'edit')}
                          className="rounded border border-cem-elevated bg-cem-surface px-1.5 py-0.5 text-xs text-cem-text focus:border-cem-amber focus:outline-none"
                        >
                          <option value="edit">Can edit</option>
                          <option value="view">View only</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveCollaborator(collab)}
                          disabled={busy}
                          className="text-xs font-medium text-cem-rose hover:underline disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3 border-t border-cem-elevated pt-2">
            <h3 className="text-xs font-medium text-cem-secondary">Transfer ownership</h3>
            {acceptedCollabs.length === 0 ? (
              <p className="mt-1 text-xs text-cem-secondary">No accepted collaborators to transfer to.</p>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  disabled={busy}
                  className="rounded border border-cem-elevated bg-cem-surface px-1.5 py-0.5 text-xs text-cem-text focus:border-cem-amber focus:outline-none disabled:opacity-60"
                >
                  <option value="">Choose…</option>
                  {acceptedCollabs.map((collab) => (
                    <option key={collab.userId} value={collab.userId}>
                      {collab.displayName || collab.username || 'Collaborator'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleTransfer}
                  disabled={busy || !transferTo}
                  className="rounded-md border border-cem-rose px-3 py-1 text-xs font-medium text-cem-rose hover:bg-cem-rose/10 disabled:opacity-60"
                >
                  Transfer ownership
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {itemIds.length === 0 ? (
        <p className="mt-6 text-sm text-cem-secondary">No songs in this setlist yet. Add one above.</p>
      ) : (
        <ol className="mt-4 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
          {itemIds.map((songId, index) => {
            const song = setlist.songs.find((s) => s.id === songId)
            return (
              <li key={songId} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-right text-xs text-cem-secondary">{index + 1}.</span>
                  <div>
                    <span className="text-sm font-medium text-cem-text">{song?.title || '(missing song)'}</span>
                    {song && (
                      <span className="ml-2 text-xs text-cem-secondary">
                        {[song.key, song.durationSeconds && formatDuration(song.durationSeconds)]
                          .filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {song && setlist.versionIds?.[songId] && (
                      <span className="ml-2 text-xs font-medium text-cem-amber">
                        {song.versions.find((v) => v.id === setlist.versionIds[songId])?.name || ''}
                      </span>
                    )}
                    {/* 3.5: record the chosen version on the setlist item ('' = picker default) */}
                    {song?.versions?.length > 1 && (
                      <select
                        value={setlist.versionIds?.[songId] || ''}
                        onChange={(e) =>
                          setSongVersion(setlist.id, songId, e.target.value || null)
                            .catch((err) => setError(err.message))
                        }
                        title="Version (Default = the picker default)"
                        className="mt-1 block rounded border border-cem-elevated bg-cem-surface px-1.5 py-0.5 text-xs text-cem-text focus:border-cem-amber focus:outline-none"
                      >
                        <option value="">Default (latest)</option>
                        {song.versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name || `Version ${v.number || ''}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                {setlist.canEdit && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleMove(index, 0)}
                      disabled={index === 0}
                      title="Move to top"
                      className="rounded border border-cem-elevated px-2 py-0.5 text-xs text-cem-secondary hover:bg-cem-elevated disabled:opacity-40"
                    >
                      ↑ top
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, index - 1)}
                      disabled={index === 0}
                      title="Move up"
                      className="rounded border border-cem-elevated px-2 py-0.5 text-xs text-cem-secondary hover:bg-cem-elevated disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, index + 1)}
                      disabled={index === itemIds.length - 1}
                      title="Move down"
                      className="rounded border border-cem-elevated px-2 py-0.5 text-xs text-cem-secondary hover:bg-cem-elevated disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(songId)}
                      className="ml-1 text-xs font-medium text-cem-rose hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}