import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import { useSongs } from '../../../hooks/shared/useSongs.js'
import * as rehearsalStore from '../../../data/repositories/rehearsals.js'
import { StatusBadge, formatWhen } from './Rehearsals.jsx'

const btn = 'rounded-md px-3 py-1.5 text-sm font-medium'
const inputClass =
  'rounded-md border border-cem-elevated bg-cem-surface px-2 py-1 text-sm text-cem-text focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber'

const RSVP_STYLES = {
  confirmed: 'bg-cem-emerald/10 text-cem-emerald',
  declined: 'bg-cem-rose/10 text-cem-rose',
  invited: 'bg-cem-elevated text-cem-secondary',
  undecided: 'bg-cem-elevated text-cem-secondary',
}

const OUTCOME_LABELS = {
  polished: 'Polished',
  needs_work: 'Needs work',
  quick_review: 'Quick review',
}

export default function RehearsalDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { songs, loading: songsLoading } = useSongs()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [keyEditingId, setKeyEditingId] = useState(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [draftNotes, setDraftNotes] = useState({})
  const [savingNote, setSavingNote] = useState(null)
  const [timeboxEditing, setTimeboxEditing] = useState(false)
  const [timeboxDraft, setTimeboxDraft] = useState('')
  const [showLog, setShowLog] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    rehearsalStore.getRehearsal(id)
      .then((next) => { if (!cancelled) setData(next) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  async function reload() {
    try {
      const next = await rehearsalStore.getRehearsal(id)
      setData(next)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function runRpc(work, successText) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await work()
      await reload()
      if (successText) {
        setNotice(typeof successText === 'function' ? successText(result) : successText)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-sm text-cem-secondary">Loading rehearsal…</p>

  if (!data) {
    return (
      <div>
        {error && <p className="rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>}
        <Link to="/rehearsals" className="mt-4 inline-block text-sm font-medium text-cem-amber hover:underline">
          ← Back to rehearsals
        </Link>
      </div>
    )
  }

  const { rehearsal, items, rsvps, changeLog } = data
  const completed = rehearsal.status === 'completed'
  const isLeader = rehearsal.createdBy === user.id
  const estimateSeconds = rehearsalStore.estimateMinutes(items)
  const timeboxMinutes = rehearsal.timeboxMinutes
  const overrun = timeboxMinutes != null && estimateSeconds > timeboxMinutes * 60
  const overrunMinutes = Math.ceil(estimateSeconds / 60)
  const myRsvp = rsvps.find((r) => r.userId === user.id)
  const pickerSongs = songs.filter((s) => !items.some((i) => i.songId === s.id))
  const showAttendance = rehearsal.status === 'published' || (completed && rsvps.length > 0)

  async function handlePublish() {
    if (!window.confirm(`Publish "${rehearsal.name}"? Assigned members will be invited.`)) return
    await runRpc(() => rehearsalStore.publishRehearsal(id), (count) =>
      `Invitations sent to ${count} member${count === 1 ? '' : 's'}.`)
  }

  async function handleComplete() {
    if (!window.confirm('Mark this rehearsal as completed? The agenda becomes read-only.')) return
    await runRpc(() => rehearsalStore.completeRehearsal(id), 'Rehearsal archived — the agenda is now read-only.')
  }

  async function handleRun(item) {
    await runRpc(() => rehearsalStore.recordRun({ rehearsalId: id, itemId: item.id }))
  }

  async function handleOutcome(item, outcome) {
    if (!outcome) return
    await runRpc(() => rehearsalStore.markOutcome({ rehearsalId: id, itemId: item.id, outcome }))
  }

  async function handleSaveNote(item) {
    const note = (draftNotes[item.id] ?? item.notes) || ''
    setSavingNote(item.id)
    setError('')
    try {
      await rehearsalStore.updateNote({ rehearsalId: id, itemId: item.id, note })
      setDraftNotes((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingNote(null)
    }
  }

  async function handleAddSong(songId) {
    await runRpc(() => rehearsalStore.addRehearsalSong({ rehearsalId: id, songId }))
  }

  async function handleChangeKey(item) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await rehearsalStore.changeSetlistItemKey({
        setlistId: rehearsal.setlistId,
        itemId: item.setlistItemId,
        agreedKey: keyDraft,
      })
      setKeyEditingId(null)
      setKeyDraft('')
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveTimebox(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await rehearsalStore.updateTimebox(id, timeboxDraft)
      setTimeboxEditing(false)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRsvp(status) {
    await runRpc(() => rehearsalStore.rsvpRehearsal(id, status))
  }

  // Longest non-trimmed song — 'Trim songs' scrolls to it.
  const trimTarget = items
    .filter((i) => i.outcome !== 'quick_review' && (i.durationSeconds ?? i.latestVersionDurationSeconds ?? 0) > 0)
    .sort((a, b) => (b.durationSeconds ?? b.latestVersionDurationSeconds ?? 0) - (a.durationSeconds ?? a.latestVersionDurationSeconds ?? 0))[0]

  function handleTrimSongs() {
    if (!trimTarget) return
    document.querySelector(`[data-item-id="${trimTarget.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function describeLogEntry(entry) {
    if (entry.action === 'agreed_key_change') {
      const { old_key: oldKey, new_key: newKey } = entry.detail || {}
      return oldKey
        ? `Key changed ${oldKey} → ${newKey} by ${entry.actorName}`
        : `Key set to ${newKey} by ${entry.actorName}`
    }
    return `${entry.action} by ${entry.actorName}`
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/rehearsals" className="text-sm font-medium text-cem-amber hover:underline">← Back to rehearsals</Link>

      {error && <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>}
      {notice && <p className="mt-3 rounded-md bg-cem-amber/10 px-3 py-2 text-sm text-cem-amber">{notice}</p>}

      {completed && (
        <p className="mt-3 rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-secondary">
          Archived rehearsal (read-only)
        </p>
      )}

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cem-text">{rehearsal.name}</h1>
          <p className="mt-1 text-sm text-cem-secondary">
            {formatWhen(rehearsal.plannedFor)} · {rehearsal.orgName || '—'}
          </p>
          <div className="mt-1"><StatusBadge status={rehearsal.status} /></div>
        </div>
        {isLeader && !completed && (
          <div className="flex flex-wrap justify-end gap-2">
            {rehearsal.status === 'planned' && (
              <button
                type="button"
                onClick={handlePublish}
                disabled={busy}
                className={`${btn} bg-cem-emerald text-cem-base hover:bg-cem-emerald/90 disabled:opacity-60`}
              >
                Publish
              </button>
            )}
            <button
              type="button"
              onClick={handleComplete}
              disabled={busy}
              className={`${btn} border border-cem-elevated text-cem-secondary hover:bg-cem-elevated disabled:opacity-60`}
            >
              Mark completed
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-cem-text">Summary</h2>
        <p className="mt-2 text-sm text-cem-text">
          Estimated duration: <span className="font-medium">{rehearsalStore.formatDuration(estimateSeconds)}</span>
        </p>
        <p className="mt-1 text-sm text-cem-text">
          Timebox: <span className="font-medium">{timeboxMinutes != null ? `${timeboxMinutes} minutes` : '—'}</span>
          {' · '}<span className="text-cem-secondary">{items.length} song{items.length === 1 ? '' : 's'}</span>
        </p>
        {overrun && (
          <div className="mt-2 rounded-md bg-cem-rose/10 px-3 py-2">
            <p className="text-sm font-medium text-cem-rose">
              Estimated {overrunMinutes} minutes — exceeds your {timeboxMinutes}-minute timebox
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTrimSongs}
                disabled={!trimTarget}
                className="rounded-md border border-cem-rose px-3 py-1 text-xs font-medium text-cem-rose hover:bg-cem-rose/10 disabled:opacity-40"
              >
                Trim songs
              </button>
              {isLeader && !completed && !timeboxEditing && (
                <button
                  type="button"
                  onClick={() => { setTimeboxEditing(true); setTimeboxDraft(String(timeboxMinutes ?? '')); setError('') }}
                  className="rounded-md border border-cem-elevated px-3 py-1 text-xs font-medium text-cem-text hover:bg-cem-elevated"
                >
                  Extend timebox
                </button>
              )}
              {isLeader && !completed && timeboxEditing && (
                <form onSubmit={handleSaveTimebox} className="flex items-center gap-2">
                  <input
                    type="number" min="1" step="5" value={timeboxDraft} disabled={busy}
                    onChange={(e) => setTimeboxDraft(e.target.value)}
                    className={`${inputClass} w-24`}
                  />
                  <button type="submit" disabled={busy} className={`${btn} bg-cem-amber text-cem-base hover:bg-cem-amber/90 disabled:opacity-60`}>
                    Save
                  </button>
                  <button type="button" onClick={() => setTimeboxEditing(false)} disabled={busy} className={`${btn} border border-cem-elevated text-cem-text hover:bg-cem-elevated disabled:opacity-60`}>
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {isLeader && !completed && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
          >
            {showPicker ? 'Hide picker' : 'Add song to agenda'}
          </button>
        </div>
      )}

      {isLeader && !completed && showPicker && (
        <div className="mt-3 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-cem-text">Add from repertoire</h2>
          {songsLoading ? (
            <p className="text-sm text-cem-secondary">Loading songs…</p>
          ) : pickerSongs.length === 0 ? (
            <p className="text-sm text-cem-secondary">No more songs in your repertoire.</p>
          ) : (
            <ul className="divide-y divide-cem-elevated">
              {pickerSongs.map((song) => (
                <li key={song.id} className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-cem-text">{song.title}</span>
                  <button
                    type="button"
                    onClick={() => handleAddSong(song.id)}
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

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-cem-secondary">No songs in this agenda yet.</p>
      ) : (
        <ol className="mt-4 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
          {items.map((item, index) => {
            const carriedOver = Boolean(item.carryOverTo) || (Boolean(item.notes) && !item.outcome)
            const duration = item.durationSeconds ?? item.latestVersionDurationSeconds
            const declinedParts = item.parts.filter(
              (p) => p.userId && rsvps.some((r) => r.userId === p.userId && r.status === 'declined'),
            )
            return (
              <li key={item.id} data-item-id={item.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-5 text-right text-xs text-cem-secondary">{index + 1}.</span>
                  <span className="text-sm font-medium text-cem-text">
                    {item.title || '(missing song)'}{item.artist ? ` — ${item.artist}` : ''}
                  </span>
                  <span className="rounded bg-cem-elevated px-1.5 py-0.5 text-xs font-medium text-cem-text">
                    Key: {item.agreedKey || '—'}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${item.isReady ? 'bg-cem-emerald/10 text-cem-emerald' : 'bg-cem-amber/10 text-cem-amber'}`}>
                    {item.isReady ? 'Ready to play' : 'Needs chart work before rehearsal'}
                  </span>
                  {!item.inSetlist && (
                    <span className="rounded bg-cem-elevated px-1.5 py-0.5 text-xs font-medium text-cem-amber">Not in setlist</span>
                  )}
                  {carriedOver && (
                    <span className="rounded bg-cem-rose/10 px-1.5 py-0.5 text-xs font-medium text-cem-rose">Carried over: needs work</span>
                  )}
                </div>

                <p className="mt-1 text-xs text-cem-secondary">
                  {duration != null && (
                    <span className={item.outcome === 'quick_review' ? 'line-through' : ''}>
                      {rehearsalStore.formatDuration(duration)}
                    </span>
                  )}
                  {item.outcome === 'quick_review' && (
                    <span className="ml-2 font-medium text-cem-amber">Quick review — trimmed</span>
                  )}
                </p>

                {item.parts.length > 0 && (
                  <div className="mt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.parts.map((part) => {
                        const declined = part.userId && rsvps.some(
                          (r) => r.userId === part.userId && r.status === 'declined',
                        )
                        return declined ? (
                          <span
                            key={`${part.part}-${part.userId}`}
                            className="rounded-md bg-cem-rose/10 px-2 py-1 text-xs font-medium text-cem-rose"
                          >
                            {part.part} part uncovered — {part.name} absent
                          </span>
                        ) : (
                          <span
                            key={`${part.part}-${part.userId || 'open'}`}
                            className="rounded-md border border-cem-elevated bg-cem-elevated px-2 py-1 text-xs text-cem-text"
                          >
                            {part.part} — {part.name || 'Unassigned'}
                          </span>
                        )
                      })}
                    </div>
                    {declinedParts.length > 0 && (
                      <p className="mt-1 text-xs text-cem-secondary">
                        Use the substitution flow to cover this part
                      </p>
                    )}
                    <p className="mt-1 text-xs text-cem-secondary">Other members are optional on this song.</p>
                  </div>
                )}

                {isLeader && !completed && item.inSetlist && item.setlistItemId && (
                  keyEditingId === item.setlistItemId ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleChangeKey(item) }}
                      className="mt-2 flex items-center gap-2"
                    >
                      <input
                        autoFocus value={keyDraft} disabled={busy}
                        onChange={(e) => setKeyDraft(e.target.value)}
                        placeholder="Key"
                        className={`${inputClass} w-24`}
                      />
                      <button type="submit" disabled={busy} className={`${btn} bg-cem-amber text-cem-base hover:bg-cem-amber/90 disabled:opacity-60`}>
                        Save key
                      </button>
                      <button
                        type="button"
                        onClick={() => setKeyEditingId(null)}
                        disabled={busy}
                        className={`${btn} border border-cem-elevated text-cem-text hover:bg-cem-elevated disabled:opacity-60`}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setKeyEditingId(item.setlistItemId); setKeyDraft(item.agreedKey || '') }}
                      className="mt-2 text-xs font-medium text-cem-amber hover:underline"
                    >
                      Change agreed key
                    </button>
                  )
                )}

                {!completed && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-cem-elevated pt-3">
                    <button
                      type="button"
                      onClick={() => handleRun(item)}
                      disabled={busy}
                      title="Record a run-through"
                      className={`${btn} border border-cem-elevated text-cem-text hover:bg-cem-elevated disabled:opacity-60`}
                    >
                      Run ({item.runCount})
                    </button>
                    <select
                      value={item.outcome}
                      onChange={(e) => handleOutcome(item, e.target.value)}
                      disabled={busy}
                      className="rounded-md border border-cem-elevated bg-cem-surface px-2 py-1.5 text-sm text-cem-text focus:border-cem-amber focus:outline-none disabled:opacity-60"
                    >
                      <option value="">Outcome…</option>
                      {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {!completed ? (
                  <div className="mt-3 flex items-start gap-2">
                    <textarea
                      value={draftNotes[item.id] ?? item.notes}
                      onChange={(e) => setDraftNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      rows={2}
                      placeholder="Rehearsal notes…"
                      className="flex-1 rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveNote(item)}
                      disabled={savingNote === item.id}
                      className={`${btn} border border-cem-elevated text-cem-text hover:bg-cem-elevated disabled:opacity-60`}
                    >
                      {savingNote === item.id ? 'Saving…' : 'Save note'}
                    </button>
                  </div>
                ) : item.notes ? (
                  <p className="mt-2 text-xs text-cem-secondary">Notes: {item.notes}</p>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}

      {showAttendance && (
        <div className="mt-4 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-cem-text">Attendance</h2>
          {rehearsal.status === 'published' && myRsvp?.status === 'invited' && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleRsvp('confirmed')}
                disabled={busy}
                className={`${btn} bg-cem-emerald text-cem-base hover:bg-cem-emerald/90 disabled:opacity-60`}
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => handleRsvp('declined')}
                disabled={busy}
                className={`${btn} border border-cem-rose text-cem-rose hover:bg-cem-rose/10 disabled:opacity-60`}
              >
                Can&apos;t make it
              </button>
              <button
                type="button"
                onClick={() => handleRsvp('undecided')}
                disabled={busy}
                className={`${btn} border border-cem-elevated text-cem-text hover:bg-cem-elevated disabled:opacity-60`}
              >
                Undecided
              </button>
            </div>
          )}
          {rsvps.length === 0 ? (
            <p className="mt-2 text-xs text-cem-secondary">No invitations sent yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-cem-elevated">
              {rsvps.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-sm text-cem-text">{r.name}</span>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${RSVP_STYLES[r.status] || RSVP_STYLES.invited}`}
                    title={r.respondedAt ? `Responded ${formatWhen(r.respondedAt)}` : 'Invited — no response yet'}
                  >
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rehearsal.setlistId && changeLog.length > 0 && (
        <div className="mt-4 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            className="text-sm font-semibold text-cem-text hover:text-cem-amber"
          >
            {showLog ? 'Hide change log' : `Change log (${changeLog.length})`}
          </button>
          {showLog && (
            <ul className="mt-2 divide-y divide-cem-elevated">
              {changeLog.map((entry) => (
                <li key={entry.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-cem-text">
                  <span>{describeLogEntry(entry)}</span>
                  <span className="shrink-0 text-xs text-cem-secondary">
                    {new Date(entry.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}