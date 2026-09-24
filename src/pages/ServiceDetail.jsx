/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { searchProfiles } from '../lib/profiles.js'
import { listSetlists } from '../lib/setlists.js'
import { listSongs } from '../lib/songs.js'
import {
  getService,
  updateServiceStatus,
  publishPlan,
  getPublishedPlan,
  listPlanVersions,
  validateServicePlan,
  assignMusician,
  unassignMusician,
  reorderBlocks,
  swapBlockSong,
  checkIn,
  createBlock,
  updateBlock,
  deleteBlock,
} from '../lib/services.js'
import { ServiceStatusBadge, formatServiceWhen } from './Services.jsx'

const btn = 'rounded-md px-3 py-1.5 text-sm font-medium'
const primaryShort = `${btn} bg-cem-amber text-cem-base hover:bg-cem-amber/90 disabled:opacity-60`
const outlinedBtn = `${btn} border border-cem-elevated text-cem-text hover:bg-cem-elevated disabled:opacity-60`
const miniBtnClass =
  'rounded-md border border-cem-elevated px-2 py-1 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60'
const arrowBtn =
  'rounded border border-cem-elevated px-1.5 py-0.5 text-xs text-cem-secondary hover:bg-cem-elevated disabled:opacity-40'
const dangerBtn =
  'rounded-md border border-cem-elevated px-2 py-1 text-xs font-medium text-cem-rose hover:bg-cem-elevated'
const miniInputClass =
  'w-full rounded-md border border-cem-elevated bg-cem-surface px-2 py-1.5 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber'
const keyBadge = 'rounded bg-cem-elevated px-1.5 py-0.5 text-xs text-cem-secondary'

// Warning kind → dot color (validate_service_plan kinds: overrun, uncovered,
// overlap, needs_work — messages render verbatim).
const WARNING_DOT = {
  overrun: 'bg-cem-amber',
  overlap: 'bg-cem-rose',
  uncovered: 'bg-cem-amber',
  needs_work: 'bg-cem-sky',
}

/** Block start = service start + start_offset_minutes (null when no service time). */
function blockStartAt(service, block) {
  if (!service?.startsAt) return null
  return new Date(new Date(service.startsAt).getTime() + (block.startOffsetMinutes || 0) * 60000)
}

/** Call time = block start − call_lead_minutes. */
function callTimeAt(service, block, assignment) {
  const start = blockStartAt(service, block)
  if (!start) return null
  return new Date(start.getTime() - (assignment.callLeadMinutes ?? 15) * 60000)
}

// ── Published-plan snapshot helpers (0021 plan freeze) ────────────────────
// The published snapshot is a frozen jsonb (private.build_plan_snapshot shape).
// These helpers (a) render it through the SAME card shape the live plan uses,
// and (b) compute per-block "changed after publish" flags by canonical
// comparison — never hand-maintained view state.

/** Snapshot block → canonical compare key (songs by song_id + agreed key). */
function snapshotBlockCompareKey(b) {
  return JSON.stringify({
    name: b.name,
    timeBudget: b.time_budget,
    startOffsetMinutes: b.start_offset_minutes,
    songs: (b.songs || []).map((s) => [s.song_id, s.agreed_key]),
  })
}

/** Live block → canonical compare key (same fields as the snapshot side). */
function blockCompareKey(block) {
  return JSON.stringify({
    name: block.name,
    timeBudget: block.timeBudget,
    startOffsetMinutes: block.startOffsetMinutes,
    songs: (block.setlist?.items || []).map((s) => [s.id, s.agreedKey]),
  })
}

/** Snapshot assignments → canonical compare key (user + part + substitute). */
function snapshotAssignCompareKey(b) {
  return JSON.stringify(
    (b.assignments || []).map((a) => [a.user_id, a.part, !!a.is_substitute]).sort(),
  )
}

/** Live assignments → canonical compare key (same fields as the snapshot side). */
function assignCompareKey(assignments) {
  return JSON.stringify(
    (assignments || []).map((a) => [a.userId, a.part, !!a.isSubstitute]).sort(),
  )
}

/**
 * Block ids whose live content differs from the published snapshot (leader's
 * "Changed after publish" flags). Structural compare on name/time/songs/keys
 * and assignments; added AND removed blocks are both flagged.
 */
function changedBlockIds(published, blocks, assignmentsByBlock) {
  const ids = new Set()
  if (!published?.published) return ids
  const snapByBlock = new Map((published.snapshot?.blocks || []).map((b) => [b.block_id, b]))
  for (const block of blocks) {
    const snap = snapByBlock.get(block.id)
    if (!snap) { ids.add(block.id); continue }
    if (snapshotBlockCompareKey(snap) !== blockCompareKey(block)) { ids.add(block.id); continue }
    if (snapshotAssignCompareKey(snap) !== assignCompareKey(assignmentsByBlock[block.id])) {
      ids.add(block.id)
    }
  }
  // Snapshot blocks removed after publish → still flagged (they changed).
  for (const b of published.snapshot?.blocks || []) {
    if (!blocks.some((bl) => bl.id === b.block_id)) ids.add(b.block_id)
  }
  return ids
}

/** Published snapshot → BlockCard-compatible blocks (setlist items from songs). */
function snapshotToBlocks(snapshot) {
  return (snapshot?.blocks || []).map((b) => ({
    id: b.block_id,
    name: b.name,
    timeBudget: b.time_budget,
    startOffsetMinutes: b.start_offset_minutes,
    position: b.position,
    setlistId: null,
    setlist: b.songs && b.songs.length > 0
      ? { id: `snap-${b.block_id}`, items: b.songs.map((s) => ({ id: s.song_id, title: s.title, agreedKey: s.agreed_key })) }
      : null,
  }))
}

/** Snapshot assignments → per-block assignment rows (names resolved locally). */
function snapshotAssignmentsByBlock(snapshot, membersById) {
  const map = {}
  for (const b of snapshot?.blocks || []) {
    map[b.block_id] = (b.assignments || []).map((a) => ({
      id: `snap-${a.user_id}-${b.block_id}`,
      blockId: b.block_id,
      userId: a.user_id,
      memberName: membersById.get(a.user_id)?.name || null,
      part: a.part,
      isSubstitute: !!a.is_substitute,
      checkinAt: null,
    }))
  }
  return map
}

/** Leader swap picker per song — listSongs picker + confirm → swap_block_song. */
function SwapSongForm({ serviceId, blockId, song, songs, onDone }) {
  const [newSongId, setNewSongId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSwap(e) {
    e.preventDefault()
    if (!newSongId) return
    const next = songs.find((s) => s.id === newSongId)
    if (!window.confirm(
      `Replace "${song.title || 'this song'}" with "${next?.title || 'the selected song'}"?`,
    )) return
    setBusy(true)
    try {
      await swapBlockSong({ serviceId, blockId, oldSongId: song.songId, newSongId })
      setError('')
      setNewSongId('')
      onDone()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={handleSwap} className="flex flex-wrap items-center gap-2">
      <select value={newSongId} onChange={(e) => setNewSongId(e.target.value)} disabled={busy}
        className={`${miniInputClass} w-auto`}>
        <option value="">Swap song…</option>
        {songs.filter((s) => s.id !== song.songId).map((s) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>
      <button type="submit" disabled={busy || !newSongId} className={miniBtnClass}>Swap</button>
      {error && <span className="text-xs text-cem-rose">{error}</span>}
    </form>
  )
}

/** Leader assignment form: pick a member (search or known members) + part. */
function AssignForm({ serviceId, blockId, members, onDone }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [part, setPart] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    if (!query.trim()) return
    setSearching(true)
    try {
      setResults(await searchProfiles(query.trim()))
    } catch (err) { setError(err.message) } finally { setSearching(false) }
  }

  async function handleAssign() {
    if (!selected || !part.trim()) return
    setBusy(true)
    try {
      await assignMusician({ serviceId, blockId, userId: selected.id, part })
      setSelected(null)
      setPart('')
      setQuery('')
      setResults([])
      setError('')
      onDone()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const known = members.filter((m) => m.name && m.id !== selected?.id)

  return (
    <div className="mt-3 space-y-2 rounded-md border border-cem-elevated bg-cem-base p-3">
      <p className="text-xs font-medium text-cem-secondary">Assign a musician</p>
      <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Find member by username" className={`${miniInputClass} w-auto`} />
        <button type="submit" disabled={searching || !query.trim()} className={miniBtnClass}>
          {searching ? 'Searching…' : 'Find'}
        </button>
      </form>
      {results.length > 0 && (
        <div className="rounded-md border border-cem-elevated bg-cem-surface p-1">
          {results.map((profile) => (
            <button key={profile.id} type="button"
              onClick={() => { setSelected(profile); setResults([]) }}
              className={`block w-full rounded px-2 py-1.5 text-left text-xs ${selected?.id === profile.id ? 'bg-cem-amber/20 text-cem-amber' : 'text-cem-text hover:bg-cem-elevated'}`}>
              {profile.displayName} <span className="text-cem-secondary">@{profile.username}</span>
            </button>
          ))}
        </div>
      )}
      {known.length > 0 && (
        <select value={selected?.id || ''}
          onChange={(e) => { const m = known.find((x) => x.id === e.target.value); if (m) setSelected(m) }}
          className={miniInputClass}>
          <option value="">Known members…</option>
          {known.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}
      <input value={part} onChange={(e) => setPart(e.target.value)}
        placeholder="Part (e.g. guitar)" className={miniInputClass} />
      {selected && (
        <p className="text-xs text-cem-secondary">
          Assigning: {selected.displayName || selected.username}
        </p>
      )}
      <button type="button" onClick={handleAssign}
        disabled={busy || !selected || !part.trim()} className={miniBtnClass}>
        {busy ? 'Assigning…' : 'Assign'}
      </button>
      {error && <p className="text-xs text-cem-rose">{error}</p>}
    </div>
  )
}

/** One service block: meta, setlist + songs, assignments, leader controls. */
function BlockCard({ block, service, assignments, members, setlists, songs, isLeader, completed, busy, index, total, onMove, onChanged, changedPublish }) {
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', timeBudget: '', startOffsetMinutes: '', setlistId: '' })
  const [error, setError] = useState('')

  function openEdit() {
    setDraft({
      name: block.name,
      timeBudget: block.timeBudget ?? '',
      startOffsetMinutes: block.startOffsetMinutes ?? 0,
      setlistId: block.setlistId || '',
    })
    setError('')
    setEditOpen(true)
  }

  async function handleEditSave(e) {
    e.preventDefault()
    try {
      await updateBlock(block.id, {
        name: draft.name,
        timeBudget: draft.timeBudget === '' ? null : Number(draft.timeBudget),
        startOffsetMinutes: draft.startOffsetMinutes === '' ? 0 : Number(draft.startOffsetMinutes),
        setlistId: draft.setlistId,
      })
      setEditOpen(false)
      onChanged()
    } catch (err) { setError(err.message) }
  }

  async function handleSetlistChange(e) {
    try {
      setError('')
      await updateBlock(block.id, { setlistId: e.target.value || null })
      onChanged()
    } catch (err) { setError(err.message) }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete block "${block.name}"?`)) return
    try {
      await deleteBlock(block.id)
      onChanged()
    } catch (err) { setError(err.message) }
  }

  async function handleUnassign(assignment) {
    if (!window.confirm(`Remove ${assignment.memberName || 'this member'} from "${block.name}"?`)) return
    try {
      setError('')
      await unassignMusician(assignment.id)
      onChanged()
    } catch (err) { setError(err.message) }
  }

  const start = blockStartAt(service, block)
  const leaderEditable = isLeader && !completed

  return (
    <li className="rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-cem-text">
            {block.name}
            {changedPublish && (
              <span className="ml-2 inline-block rounded bg-cem-amber/10 px-1.5 py-0.5 text-xs font-medium text-cem-amber">
                changed after publish
              </span>
            )}
          </h3>
          <p className="mt-1 text-xs text-cem-secondary">
            {block.timeBudget ? `${block.timeBudget} min budget` : 'No time budget'}
            {' · '}starts {block.startOffsetMinutes > 0 ? `+${block.startOffsetMinutes} min` : 'on time'}
            {start ? ` · ${formatServiceWhen(start)}` : ''}
          </p>
        </div>
        {leaderEditable && (
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" disabled={busy || index === 0} onClick={() => onMove(-1)} className={arrowBtn} aria-label="Move block up">↑</button>
            <button type="button" disabled={busy || index === total - 1} onClick={() => onMove(1)} className={arrowBtn} aria-label="Move block down">↓</button>
            <button type="button" onClick={editOpen ? () => setEditOpen(false) : openEdit} className={miniBtnClass}>
              {editOpen ? 'Cancel' : 'Edit'}
            </button>
            <button type="button" onClick={handleDelete} className={dangerBtn}>Delete</button>
          </div>
        )}
      </div>

      {editOpen && leaderEditable && (
        <form onSubmit={handleEditSave} className="mt-3 space-y-2 rounded-md border border-cem-elevated bg-cem-base p-3">
          <input value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            placeholder="Block name *" className={miniInputClass} />
          <div className="flex flex-wrap gap-2">
            <input type="number" min="0" value={draft.timeBudget}
              onChange={(e) => setDraft((p) => ({ ...p, timeBudget: e.target.value }))}
              placeholder="Time budget (min)" className={`${miniInputClass} w-auto`} />
            <input type="number" min="0" value={draft.startOffsetMinutes}
              onChange={(e) => setDraft((p) => ({ ...p, startOffsetMinutes: e.target.value }))}
              placeholder="Start offset (min)" className={`${miniInputClass} w-auto`} />
            <select value={draft.setlistId}
              onChange={(e) => setDraft((p) => ({ ...p, setlistId: e.target.value }))}
              className={`${miniInputClass} w-auto`}>
              <option value="">No setlist</option>
              {setlists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={miniBtnClass}>Save</button>
          </div>
          {error && <p className="text-xs text-cem-rose">{error}</p>}
        </form>
      )}

      {leaderEditable && !editOpen && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-cem-secondary">Setlist</label>
          <select value={block.setlistId || ''} onChange={handleSetlistChange} className={`${miniInputClass} w-auto`}>
            <option value="">No setlist</option>
            {setlists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      <div className="mt-3">
        <h4 className="text-xs font-medium text-cem-secondary">Songs</h4>
        {block.setlist?.items?.length ? (
          <ul className="mt-1 space-y-2">
            {block.setlist.items.map((song, i) => (
              <li key={song.id} className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-cem-text">{i + 1}. {song.title || '(missing song)'}</span>
                <span className={keyBadge}>{song.agreedKey || '—'}</span>
                {leaderEditable && (
                  <SwapSongForm serviceId={service.id} blockId={block.id} song={song} songs={songs} onDone={onChanged} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-cem-secondary">
            {block.setlist ? 'Block setlist is empty.' : 'No setlist assigned to this block.'}
          </p>
        )}
      </div>

      <div className="mt-3">
        <h4 className="text-xs font-medium text-cem-secondary">Musicians</h4>
        {assignments.length === 0 ? (
          <p className="mt-1 text-xs text-cem-secondary">No musicians assigned.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {assignments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-cem-text">{a.memberName || '(unknown member)'}</span>
                <span className="rounded bg-cem-elevated px-1.5 py-0.5 text-xs text-cem-secondary">{a.part}</span>
                {a.isSubstitute && (
                  <span className="rounded bg-cem-amber/10 px-1.5 py-0.5 text-xs text-cem-amber">substitute</span>
                )}
                {a.checkinAt ? (
                  <span className="text-xs text-cem-emerald">Checked in {formatServiceWhen(a.checkinAt)}</span>
                ) : (
                  <span className="text-xs text-cem-secondary">Not checked in</span>
                )}
                {leaderEditable && (
                  <button type="button" onClick={() => handleUnassign(a)}
                    className="text-xs font-medium text-cem-rose hover:underline">Remove</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {leaderEditable && (
          <AssignForm serviceId={service.id} blockId={block.id} members={members} onDone={onChanged} />
        )}
      </div>

      {error && !editOpen && (
        <p className="mt-2 rounded-md bg-cem-rose/10 px-3 py-2 text-xs text-cem-rose">{error}</p>
      )}
    </li>
  )
}

export default function ServiceDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [topError, setTopError] = useState('')
  const [warnings, setWarnings] = useState([])
  const [warningsChecked, setWarningsChecked] = useState(false)
  const [validating, setValidating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reorderError, setReorderError] = useState('')
  const [showCallSheet, setShowCallSheet] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [checkingIn, setCheckingIn] = useState(null)
  const [sheetError, setSheetError] = useState('')
  const [addingBlock, setAddingBlock] = useState(false)
  const [addingBusy, setAddingBusy] = useState(false)
  const [addDraft, setAddDraft] = useState({ name: '', timeBudget: '', startOffsetMinutes: '' })
  const [addError, setAddError] = useState('')
  const [setlists, setSetlists] = useState([])
  const [songs, setSongs] = useState([])
  const [published, setPublished] = useState(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishReason, setPublishReason] = useState('')
  const [publishBusy, setPublishBusy] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])
  const [historyBusy, setHistoryBusy] = useState(false)
  const [historyError, setHistoryError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    return Promise.all([
      getService(id),
      getPublishedPlan(id).catch(() => null),
    ])
      .then(([result, publishedData]) => { setData(result); setPublished(publishedData); setTopError('') })
      .catch((err) => { setTopError(err.message) })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  // Picker pools (setlist picker + song swap); failures degrade the pickers
  // only — the service read above is the page's error surface.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([listSetlists(user.id), listSongs(user.id)])
      .then(([sl, sg]) => { if (!cancelled) { setSetlists(sl); setSongs(sg) } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user])

  async function runStatus(status, message) {
    if (!window.confirm(message)) return
    setTopError('')
    try {
      await updateServiceStatus(service.id, status)
      await load()
    } catch (err) { setTopError(err.message) }
  }

  /** Leader publishes/re-publishes the frozen snapshot with an optional reason. */
  async function handlePublish(e) {
    e.preventDefault()
    setPublishError('')
    setPublishBusy(true)
    try {
      await publishPlan(service.id, publishReason)
      setPublishOpen(false)
      setPublishReason('')
      await load()
    } catch (err) { setPublishError(err.message) } finally { setPublishBusy(false) }
  }

  /** Leader version-history toggle; loads the RPC list on first open. */
  async function handleShowHistory() {
    if (showHistory) { setShowHistory(false); return }
    setHistoryError('')
    setHistoryBusy(true)
    try {
      setHistory(await listPlanVersions(service.id))
      setShowHistory(true)
    } catch (err) { setHistoryError(err.message) } finally { setHistoryBusy(false) }
  }

  async function handleValidate() {
    setValidating(true)
    setWarningsChecked(true)
    setTopError('')
    try {
      setWarnings(await validateServicePlan(service.id))
    } catch (err) { setTopError(err.message) } finally { setValidating(false) }
  }

  async function moveBlock(index, direction) {
    setBusy(true)
    setReorderError('')
    const next = [...data.blocks]
    const [moved] = next.splice(index, 1)
    next.splice(index + direction, 0, moved)
    try {
      // reorder_service_blocks requires the EXACT block id set, in the new
      // visible order — pass the current order after the arrow move.
      await reorderBlocks(service.id, next.map((b) => b.id))
      await load()
    } catch (err) { setReorderError(err.message) } finally { setBusy(false) }
  }

  async function handleCheckIn(assignment) {
    setSheetError('')
    setCheckingIn(assignment.id)
    try {
      await checkIn(assignment.id)
      await load()
    } catch (err) { setSheetError(err.message) } finally { setCheckingIn(null) }
  }

  async function handleAddBlock(e) {
    e.preventDefault()
    setAddError('')
    setAddingBusy(true)
    try {
      await createBlock({
        serviceId: service.id,
        name: addDraft.name,
        timeBudget: addDraft.timeBudget === '' ? null : Number(addDraft.timeBudget),
        startOffsetMinutes: addDraft.startOffsetMinutes === '' ? 0 : Number(addDraft.startOffsetMinutes),
      })
      setAddingBlock(false)
      setAddDraft({ name: '', timeBudget: '', startOffsetMinutes: '' })
      await load()
    } catch (err) { setAddError(err.message) } finally { setAddingBusy(false) }
  }

  if (loading) return <p className="text-sm text-cem-secondary">Loading service…</p>

  if (!data) {
    return topError ? (
      <div>
        <p className="rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{topError}</p>
        <Link to="/services" className="mt-4 inline-block text-sm font-medium text-cem-amber hover:underline">← Back to services</Link>
      </div>
    ) : null
  }

  const { service, blocks, assignmentsByBlock, members, changeLog } = data
  const isLeader = user?.id === service.leaderId
  const completed = service.status === 'completed'
  const leaderEditable = isLeader && !completed
  const myAssignments = data.assignments.filter((a) => a.userId === user?.id)
  const unresolved = warnings.some((w) => w.kind === 'uncovered')

  // Published-freeze surfaces: members read the frozen snapshot (never the
  // draft); leaders keep the live editor plus changed-flags and versions.
  const membersById = new Map((members || []).map((m) => [m.id, m]))
  const versionedRead = !isLeader && !!published?.published
  const displayBlocks = versionedRead ? snapshotToBlocks(published.snapshot) : blocks
  const displayAssignmentsByBlock = versionedRead
    ? snapshotAssignmentsByBlock(published.snapshot, membersById)
    : assignmentsByBlock
  const changedIds = leaderEditable ? changedBlockIds(published, blocks, assignmentsByBlock) : new Set()
  // The call sheet only references PUBLISHED blocks for members: a block added
  // to the draft after publish has no published songs/keys and must not leak.
  const sheetAssignments = versionedRead
    ? myAssignments.filter((a) => displayBlocks.some((b) => b.id === a.blockId))
    : myAssignments
  const publishLabel = service.status === 'published' ? 'Re-publish' : 'Publish'

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/services" className="text-sm font-medium text-cem-amber hover:underline">← Back to services</Link>
      {topError && <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{topError}</p>}

      {completed && (
        <p className="mt-3 rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-secondary">
          Archived service (read-only)
        </p>
      )}

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cem-text">{service.name}</h1>
          <p className="mt-1 text-sm text-cem-secondary">
            {[service.orgName, service.branchName].filter(Boolean).join(' · ') || '—'}
            {service.startsAt ? ` · ${formatServiceWhen(service.startsAt)}` : ''}
          </p>
          <div className="mt-1"><ServiceStatusBadge status={service.status} /></div>
          {published?.published && (
            <p className="mt-1 text-sm text-cem-secondary">
              {completed ? 'Executed version' : 'Published version'} {published.version_number}
              {published.reason ? ` — "${published.reason}"` : ''}
              {' · '}{formatServiceWhen(published.published_at)}
            </p>
          )}
        </div>
        {leaderEditable && (
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button"
              onClick={() => { setPublishOpen((o) => !o); setPublishError(''); setPublishReason('') }}
              className={primaryShort}>
              {publishOpen ? 'Cancel' : publishLabel}
            </button>
            <button type="button"
              onClick={() => runStatus('completed', `Mark "${service.name}" as completed? The plan becomes read-only.`)}
              className={outlinedBtn}>Mark completed</button>
          </div>
        )}
      </div>

      {publishOpen && leaderEditable && (
        <form onSubmit={handlePublish} className="mt-3 space-y-2 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
          <p className="text-xs text-cem-secondary">
            Publishing freezes the current plan as version {(published?.version_number ?? 0) + 1} —
            members execute exactly this snapshot; previous versions stay in history.
          </p>
          <input value={publishReason} onChange={(e) => setPublishReason(e.target.value)}
            placeholder="Reason for this publish (optional)" className={miniInputClass} />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={publishBusy} className={miniBtnClass}>
              {publishBusy ? 'Publishing…' : (service.status === 'published' ? 'Re-publish plan' : 'Publish plan')}
            </button>
            {publishError && <p className="text-xs text-cem-rose">{publishError}</p>}
          </div>
        </form>
      )}

      {leaderEditable && published?.published && published.draft_changed && (
        <div className="mt-3 rounded-md border border-cem-amber/40 bg-cem-amber/10 px-3 py-2 text-sm text-cem-text">
          <span className="font-medium text-cem-amber">Changed after publish.</span>{' '}
          Members still execute version {published.version_number}. Re-publish to apply these edits.
        </div>
      )}

      {versionedRead && published?.draft_changed && (
        <p className="mt-3 rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-secondary">
          The plan was changed after the last publish — members still execute the published version.
        </p>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-cem-text">Plan warnings</h2>
          {leaderEditable && (
            <button type="button" onClick={handleValidate} disabled={validating} className={outlinedBtn}>
              {validating ? 'Validating…' : 'Validate plan'}
            </button>
          )}
        </div>
        {warnings.length === 0 ? (
          <p className="mt-2 text-sm text-cem-secondary">
            {warningsChecked ? 'No warnings — the plan looks good.' : 'Run the validator to check the plan.'}
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {warnings.map((w, i) => (
              <li key={`${w.kind}-${i}`} className="flex items-start gap-2 text-sm text-cem-text">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${WARNING_DOT[w.kind] || 'bg-cem-secondary'}`} />
                {w.message}
              </li>
            ))}
          </ul>
        )}
        {unresolved && (
          <p className="mt-2 text-sm text-cem-secondary">Use the substitution flow to cover uncovered blocks.</p>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setShowCallSheet((o) => !o)} className={outlinedBtn}>
          {showCallSheet ? 'Hide' : 'Show'} my call sheet
        </button>
        <button type="button" onClick={() => setShowLog((o) => !o)} className={outlinedBtn}>
          {showLog ? 'Hide' : 'Show'} change log ({changeLog.length})
        </button>
        {isLeader && (
          <button type="button" onClick={handleShowHistory} className={outlinedBtn}>
            {showHistory ? 'Hide' : 'Show'} version history ({history.length})
          </button>
        )}
      </div>

      {showCallSheet && (
        <section className="mt-3">
          <h2 className="text-lg font-semibold text-cem-text">My call sheet</h2>
          {sheetAssignments.length === 0 ? (
            <p className="mt-2 text-sm text-cem-secondary">You have no assignments in this service.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {sheetAssignments.map((a) => {
                const block = displayBlocks.find((b) => b.id === a.blockId)
                const start = blockStartAt(service, block)
                const call = callTimeAt(service, block, a)
                return (
                  <li key={a.id} className="rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-cem-text">
                          {block?.name || 'Block'} · <span className="text-cem-secondary">{a.part}</span>
                        </p>
                        <p className="mt-1 text-xs text-cem-secondary">
                          Block start {start ? formatServiceWhen(start) : '—'}
                          {' · '}Call time {call ? formatServiceWhen(call) : '—'}
                        </p>
                      </div>
                      {!a.checkinAt && !completed && (
                        <button type="button" onClick={() => handleCheckIn(a)}
                          disabled={checkingIn === a.id} className={miniBtnClass}>
                          {checkingIn === a.id ? 'Checking in…' : 'Check in'}
                        </button>
                      )}
                    </div>
                    {block?.setlist?.items?.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {block.setlist.items.map((song, i) => (
                          <li key={song.id} className="flex items-center gap-2 text-sm">
                            <span className="text-cem-text">{i + 1}. {song.title || '(missing song)'}</span>
                            <span className={keyBadge}>{song.agreedKey || '—'}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {sheetError && <p className="mt-2 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{sheetError}</p>}
        </section>
      )}

      {showLog && (
        <section className="mt-3">
          <h2 className="text-lg font-semibold text-cem-text">Change log</h2>
          {changeLog.length === 0 ? (
            <p className="mt-2 text-sm text-cem-secondary">No changes logged yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
              {changeLog.map((entry) => (
                <li key={entry.id} className="px-4 py-2.5">
                  <p className="text-sm text-cem-text">
                    <span className="font-medium capitalize">{entry.action.replace('_', ' ')}</span> · {entry.summary}
                  </p>
                  <p className="mt-0.5 text-xs text-cem-secondary">
                    {entry.actorName || 'Someone'} · {formatServiceWhen(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {showHistory && (
        <section className="mt-3">
          <h2 className="text-lg font-semibold text-cem-text">Version history</h2>
          {historyError && <p className="mt-2 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{historyError}</p>}
          {historyBusy ? (
            <p className="mt-2 text-sm text-cem-secondary">Loading…</p>
          ) : history.length === 0 ? (
            <p className="mt-2 text-sm text-cem-secondary">No versions published yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
              {history.map((row) => (
                <li key={`${row.version_number}`} className="px-4 py-2.5">
                  <p className="text-sm text-cem-text">
                    <span className="font-medium">Version {row.version_number}</span>
                    {' — '}
                    <span className={row.status === 'published' ? '' : 'text-cem-secondary'}>
                      {row.status === 'published' ? 'Current published version'
                        : row.status === 'executed' ? 'Executed at the service'
                          : 'Superseded — not executed'}
                    </span>
                    {row.reason ? ` — "${row.reason}"` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-cem-secondary">
                    {row.published_by_name || 'Someone'} · {formatServiceWhen(row.published_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-cem-text">Blocks</h2>
          {leaderEditable && (
            <button type="button" onClick={() => { setAddingBlock((o) => !o); setAddError('') }} className={primaryShort}>
              {addingBlock ? 'Cancel' : 'Add block'}
            </button>
          )}
        </div>
        {reorderError && <p className="mt-2 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{reorderError}</p>}
        {displayBlocks.length === 0 ? (
          <p className="mt-2 text-sm text-cem-secondary">
            {versionedRead ? 'No blocks in the published version.' : 'No blocks yet.'}
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {displayBlocks.map((block, index) => (
              <BlockCard
                key={block.id}
                block={block}
                service={service}
                assignments={displayAssignmentsByBlock[block.id] || []}
                members={members}
                setlists={setlists}
                songs={songs}
                isLeader={isLeader}
                completed={completed}
                busy={busy}
                index={index}
                total={displayBlocks.length}
                onMove={(direction) => moveBlock(index, direction)}
                onChanged={load}
                changedPublish={leaderEditable && changedIds.has(block.id)}
              />
            ))}
          </ul>
        )}

        {addingBlock && leaderEditable && (
          <form onSubmit={handleAddBlock} className="mt-3 space-y-2 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
            <input value={addDraft.name} onChange={(e) => setAddDraft((p) => ({ ...p, name: e.target.value }))}
              placeholder="Block name *" className={miniInputClass} />
            <div className="flex flex-wrap gap-2">
              <input type="number" min="0" value={addDraft.timeBudget}
                onChange={(e) => setAddDraft((p) => ({ ...p, timeBudget: e.target.value }))}
                placeholder="Time budget (min)" className={`${miniInputClass} w-auto`} />
              <input type="number" min="0" value={addDraft.startOffsetMinutes}
                onChange={(e) => setAddDraft((p) => ({ ...p, startOffsetMinutes: e.target.value }))}
                placeholder="Start offset (min)" className={`${miniInputClass} w-auto`} />
            </div>
            {addError && <p className="text-xs text-cem-rose">{addError}</p>}
            <button type="submit" disabled={addingBusy} className={miniBtnClass}>
              {addingBusy ? 'Adding…' : 'Add block'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}