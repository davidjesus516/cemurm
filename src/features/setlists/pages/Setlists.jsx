import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSetlists } from '../../../hooks/shared/useSetlists.js'
import { usePlanningCenter } from '../../../hooks/shared/usePlanningCenter.js'
import { buildSetlistFile, EXPORT_FORMATS } from '../../../domain/setlist/exporters/setlistFile.js'
import { buildEventSetlistsZip } from '../../../domain/setlist/exporters/eventZip.js'
import { saveFile } from '../../../domain/setlist/exporters/saveFile.js'

export default function Setlists() {
  const { setlists, loading, createSetlist, deleteSetlist, duplicateSetlist } = useSetlists()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // T3 batch export (features/export-and-sharing.feature:181-186): one ZIP for
  // an event. The selection is explicit because "all my setlists" is not the
  // same list as "the five for this event", and an archive nobody asked for is
  // worse than one more checkbox.
  const [showBatch, setShowBatch] = useState(false)
  const [eventName, setEventName] = useState('')
  const [batchFormat, setBatchFormat] = useState('chordpro')
  const [batchSelected, setBatchSelected] = useState([])
  const [batchError, setBatchError] = useState('')
  const [batchNotice, setBatchNotice] = useState('')

  // Hito 5 #78: Planning Center plan import. onImported navigates straight to
  // the new `<name> (from Planning Center)` setlist; the detail page's fresh
  // read shows the order + the missing-chart flags (S12).
  const pco = usePlanningCenter({
    onImported: (res) => navigate(`/setlists/${res.setlistId}`),
  })
  const [showPcoPicker, setShowPcoPicker] = useState(false)
  const [pcoImportError, setPcoImportError] = useState('')
  const [importingPlanId, setImportingPlanId] = useState('')

  const pcoConnected = pco.connection?.status === 'connected'
  const pcoRevoked = pco.connection?.status === 'revoked'

  function togglePcoPicker() {
    const next = !showPcoPicker
    setShowPcoPicker(next)
    setPcoImportError('')
    // Lazy plan fetch on first open (never on mount — keep the page light).
    if (next && pco.plans.length === 0 && pco.state !== 'working') {
      pco.loadPlans()
    }
  }

  async function handleImportPlan(plan) {
    setImportingPlanId(plan.id)
    setPcoImportError('')
    try {
      const res = await pco.importPlan(plan)
      if (!res?.ok) setPcoImportError(res?.error || 'Could not import the plan.')
      // Success navigates via onImported (above).
    } catch (err) {
      setPcoImportError(err.message)
    } finally {
      setImportingPlanId('')
    }
  }

  function toggleBatch() {
    const next = !showBatch
    setShowBatch(next)
    setBatchError('')
    setBatchNotice('')
    // Open with everything selected: the common case is "these are my event's
    // setlists", and unchecking two is cheaper than checking five.
    if (next) setBatchSelected(setlists.map((setlist) => setlist.id))
  }

  function toggleBatchSelection(id) {
    setBatchSelected((prev) =>
      prev.includes(id) ? prev.filter((candidate) => candidate !== id) : [...prev, id],
    )
  }

  async function handleExportBatch() {
    setBatchError('')
    setBatchNotice('')
    try {
      const chosen = setlists.filter((setlist) => batchSelected.includes(setlist.id))
      const files = chosen.map((setlist) => buildSetlistFile(setlist, setlist.songs, batchFormat))
      const zip = buildEventSetlistsZip(eventName, files)
      saveFile({ filename: zip.name, mimeType: 'application/zip', body: zip.bytes })
      setBatchNotice(
        `Downloaded ${zip.name} with ${files.length} setlist${files.length === 1 ? '' : 's'}`,
      )
    } catch (err) {
      setBatchError(err.message)
    }
  }

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
        <h1 className="text-2xl font-bold text-cem-text">Setlists</h1>
        <div className="flex items-center gap-2">
          <Link to="/exports" className="text-sm font-medium text-cem-amber hover:underline">
            Export history
          </Link>
          {setlists.length > 0 && !showForm && (
            <button
              type="button"
              onClick={toggleBatch}
              className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated"
            >
              {showBatch ? 'Hide batch export' : 'Export for event'}
            </button>
          )}
          {pcoConnected && !showForm && (
            <button
              type="button"
              onClick={togglePcoPicker}
              className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated"
            >
              Import from Planning Center
            </button>
          )}
          {!showForm && (
            <button
              type="button"
              onClick={() => { setShowForm(true); setError('') }}
              className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
            >
              New Setlist
            </button>
          )}
        </div>
      </div>

      {/* S13: a revoked integration hides the import surface and says why —
          the reconnect path lives in Settings. */}
      {pcoRevoked && (
        <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">
          integration revoked — reconnect in Settings
        </p>
      )}

      {showPcoPicker && (
        <div className="mt-4 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-xs">
          <h2 className="mb-2 text-sm font-semibold text-cem-text">Import from Planning Center</h2>
          {pco.state === 'working' ? (
            <p className="text-sm text-cem-secondary">Loading plans…</p>
          ) : pco.plans.length === 0 ? (
            <p className="text-sm text-cem-secondary">No plans to import.</p>
          ) : (
            <ul className="divide-y divide-cem-elevated">
              {pco.plans.map((plan) => (
                <li key={plan.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-cem-text">{plan.name}</span>
                    <span className="ml-2 text-xs text-cem-secondary">
                      {plan.songs.length} song{plan.songs.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleImportPlan(plan)}
                    disabled={importingPlanId === plan.id}
                    className="rounded-md bg-cem-amber px-3 py-1 text-xs font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
                  >
                    {importingPlanId === plan.id ? 'Importing…' : 'Import'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pcoImportError && (
            <p className="mt-2 text-xs text-cem-rose" role="alert">{pcoImportError}</p>
          )}
          <button
            type="button"
            onClick={() => setShowPcoPicker(false)}
            className="mt-3 text-xs font-medium text-cem-secondary hover:underline"
          >
            Close
          </button>
        </div>
      )}

      {showBatch && (
        <div className="mt-4 rounded-lg border border-cem-elevated bg-cem-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-cem-text">Export for event</h2>
          <p className="mb-3 text-xs text-cem-secondary">
            One ZIP holding every selected setlist. The archive is named after the event.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-cem-secondary">
              Event name
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Weekend Festival 2025"
                className="w-56 rounded-md border border-cem-elevated bg-cem-surface px-3 py-1.5 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-hidden"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-cem-secondary">
              Format
              <select
                value={batchFormat}
                onChange={(e) => setBatchFormat(e.target.value)}
                className="rounded-md border border-cem-elevated bg-cem-surface px-2 py-1.5 text-sm text-cem-text focus:border-cem-amber focus:outline-hidden"
              >
                {EXPORT_FORMATS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleExportBatch}
              disabled={batchSelected.length === 0}
              className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
            >
              Export All for Event
            </button>
          </div>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            {setlists.map((setlist) => (
              <li key={setlist.id} className="flex items-center gap-2">
                <input
                  id={`batch-${setlist.id}`}
                  type="checkbox"
                  checked={batchSelected.includes(setlist.id)}
                  onChange={() => toggleBatchSelection(setlist.id)}
                  className="size-4 accent-cem-amber"
                />
                <label htmlFor={`batch-${setlist.id}`} className="truncate text-sm text-cem-text">
                  {setlist.name}
                </label>
              </li>
            ))}
          </ul>
          {batchError && <p className="mt-2 text-xs text-cem-text" role="alert">{batchError}</p>}
          {batchNotice && <p className="mt-2 text-xs text-cem-amber">{batchNotice}</p>}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 flex items-start gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Setlist name (e.g. Friday Gig)"
            className="w-full max-w-sm rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-hidden focus:ring-2 focus:ring-cem-amber focus:ring-offset-2 focus:ring-offset-transparent"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            disabled={busy}
            className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
          >
            Cancel
          </button>
        </form>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-cem-secondary">Loading setlists…</p>
      ) : setlists.length === 0 ? (
        <p className="mt-6 text-sm text-cem-secondary">No setlists yet. Create your first one above.</p>
      ) : (
        <ul className="mt-4 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-xs">
          {setlists.map((setlist) => (
            <li key={setlist.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/setlists/${setlist.id}`}
                    className="text-sm font-medium text-cem-text hover:text-cem-amber"
                  >
                    {setlist.name}
                  </Link>
                  <span className="text-xs text-cem-secondary">
                    {setlist.itemIds.length} song{setlist.itemIds.length === 1 ? '' : 's'} · {setlist.durationLabel}
                  </span>
                  {setlist.visibility === 'shared' && (
                    <span className="rounded bg-cem-elevated px-1.5 py-0.5 text-xs font-medium text-cem-amber">
                      Shared
                    </span>
                  )}
                </div>
                {setlist.songs.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-cem-secondary">
                    {setlist.songs.map((s) => s.title).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={() => handleDuplicate(setlist)}
                  className="text-xs font-medium text-cem-amber hover:underline"
                >
                  Duplicate
                </button>
                {setlist.isOwner && (
                  <button
                    type="button"
                    onClick={() => handleDelete(setlist)}
                    className="text-xs font-medium text-cem-rose hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}