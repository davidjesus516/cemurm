/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSetlists } from '../../../hooks/shared/useSetlists.js'
import * as rehearsalStore from '../../../data/repositories/rehearsals.js'

export const REHEARSAL_STATUS_STYLES = {
  planned: 'bg-cem-amber/10 text-cem-amber',
  published: 'bg-cem-sky/10 text-cem-sky',
  completed: 'bg-cem-elevated text-cem-secondary',
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${REHEARSAL_STATUS_STYLES[status] || REHEARSAL_STATUS_STYLES.planned}`}>
      {status}
    </span>
  )
}

export function formatWhen(iso) {
  if (!iso) return 'No date set'
  return new Date(iso).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const inputClass =
  'w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber'

function RehearsalCard({ rehearsal }) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link to={`/rehearsals/${rehearsal.id}`} className="text-sm font-medium text-cem-text hover:text-cem-amber">
            {rehearsal.name}
          </Link>
          <StatusBadge status={rehearsal.status} />
        </div>
        <p className="mt-0.5 text-xs text-cem-secondary">
          {formatWhen(rehearsal.plannedFor)}
          {' · '}{rehearsal.orgName || '—'}
          {' · '}{rehearsal.itemCount} song{rehearsal.itemCount === 1 ? '' : 's'}
        </p>
      </div>
    </li>
  )
}

export default function Rehearsals() {
  const { setlists } = useSetlists()
  const [rehearsals, setRehearsals] = useState([])
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    orgId: '',
    setlistId: '',
    timeboxMinutes: '60',
    plannedFor: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [list, sessionOrgs] = await Promise.all([
        rehearsalStore.listRehearsals(),
        rehearsalStore.getSessionOrgs(),
      ])
      setRehearsals(list)
      setOrgs(sessionOrgs)
      // Default the org select to the first session org once loaded.
      setForm((prev) => ({ ...prev, orgId: prev.orgId || (sessionOrgs[0]?.id || '') }))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await rehearsalStore.createRehearsal({
        orgId: form.orgId,
        name: form.name,
        setlistId: form.setlistId,
        timeboxMinutes: form.timeboxMinutes,
        plannedFor: form.plannedFor ? new Date(form.plannedFor) : null,
      })
      setShowForm(false)
      setForm((prev) => ({ ...prev, name: '', setlistId: '', plannedFor: '' }))
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cem-text">Rehearsals</h1>
        {!showForm && (
          <button
            type="button"
            onClick={() => { setShowForm(true); setError('') }}
            className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
          >
            New rehearsal
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
          <div>
            <label htmlFor="rehearsal-name" className="block text-sm font-medium text-cem-text">Name *</label>
            <input
              id="rehearsal-name" type="text" value={form.name} disabled={submitting}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="rehearsal-org" className="block text-sm font-medium text-cem-text">Organization *</label>
            <select
              id="rehearsal-org" value={form.orgId} disabled={submitting || orgs.length === 0}
              onChange={(e) => setForm((p) => ({ ...p, orgId: e.target.value }))}
              className={inputClass}
            >
              {orgs.length === 0 && <option value="">No organizations available</option>}
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>{org.name || org.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rehearsal-setlist" className="block text-sm font-medium text-cem-text">Setlist *</label>
            <select
              id="rehearsal-setlist" value={form.setlistId} disabled={submitting}
              onChange={(e) => setForm((p) => ({ ...p, setlistId: e.target.value }))}
              className={inputClass}
            >
              <option value="">Select a setlist…</option>
              {setlists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="rehearsal-timebox" className="block text-sm font-medium text-cem-text">Timebox (minutes)</label>
              <input
                id="rehearsal-timebox" type="number" min="1" step="5" value={form.timeboxMinutes}
                disabled={submitting}
                onChange={(e) => setForm((p) => ({ ...p, timeboxMinutes: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="rehearsal-plannedFor" className="block text-sm font-medium text-cem-text">Planned for</label>
              <input
                id="rehearsal-plannedFor" type="datetime-local" value={form.plannedFor}
                disabled={submitting}
                onChange={(e) => setForm((p) => ({ ...p, plannedFor: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit" disabled={submitting}
              className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create Rehearsal'}
            </button>
            <button
              type="button" onClick={() => setShowForm(false)} disabled={submitting}
              className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-cem-secondary">Loading rehearsals…</p>
      ) : rehearsals.length === 0 ? (
        <p className="mt-6 text-sm text-cem-secondary">No rehearsals yet. Plan your first one above.</p>
      ) : (
        <ul className="mt-4 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
          {rehearsals.map((rehearsal) => <RehearsalCard key={rehearsal.id} rehearsal={rehearsal} />)}
        </ul>
      )}
    </div>
  )
}