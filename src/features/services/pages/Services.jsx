/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listServices, createService, listBlockCounts } from '../../../data/repositories/services.js'
import { getMyOrganizations } from '../../../data/repositories/orgRepertoire.js'

export const SERVICE_STATUS_STYLES = {
  draft: 'bg-cem-elevated text-cem-secondary',
  published: 'bg-cem-emerald/10 text-cem-emerald',
  completed: 'bg-cem-sky/10 text-cem-sky',
}

export function ServiceStatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SERVICE_STATUS_STYLES[status] || SERVICE_STATUS_STYLES.draft}`}>
      {status}
    </span>
  )
}

export function formatServiceWhen(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const btn =
  'rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60'
const inputClass =
  'w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber'

const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function NewServiceForm({ organizations, onCreated }) {
  const [form, setForm] = useState({ name: '', orgId: organizations[0]?.orgId || '', startsAt: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!form.name.trim()) next.name = 'Service name is required.'
    if (!form.orgId) next.orgId = 'Organization is required.'
    if (Object.keys(next).length) { setErrors(next); return }
    setSubmitting(true)
    try {
      await createService({
        orgId: form.orgId,
        name: form.name.trim(),
        startsAt: form.startsAt ? new Date(form.startsAt) : null,
      })
      await onCreated()
    } catch (err) {
      setErrors({ form: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
      <div>
        <label htmlFor="service-name" className="block text-sm font-medium text-cem-text">Name *</label>
        <input id="service-name" name="name" value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          disabled={submitting} className={inputClass} />
        {errors.name && <p className="mt-1 text-xs text-cem-rose">{errors.name}</p>}
      </div>
      <div>
        <label htmlFor="service-org" className="block text-sm font-medium text-cem-text">Organization *</label>
        <select id="service-org" name="orgId" value={form.orgId}
          onChange={(e) => setForm((p) => ({ ...p, orgId: e.target.value }))}
          disabled={submitting || organizations.length === 0} className={inputClass}>
          {organizations.length === 0 && <option value="">No organization memberships found</option>}
          {organizations.map((membership) => (
            <option key={membership.id} value={membership.orgId}>
              {membership.org?.name || `Organization ${membership.orgId.slice(0, 8)}`}
            </option>
          ))}
        </select>
        {errors.orgId && <p className="mt-1 text-xs text-cem-rose">{errors.orgId}</p>}
      </div>
      <div>
        <label htmlFor="service-startsAt" className="block text-sm font-medium text-cem-text">Starts at (optional)</label>
        <input id="service-startsAt" name="startsAt" type="datetime-local" value={toLocalInput(form.startsAt)}
          onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
          disabled={submitting} className={inputClass} />
      </div>
      {errors.form && <p className="rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{errors.form}</p>}
      <button type="submit" disabled={submitting || organizations.length === 0} className={btn}>
        {submitting ? 'Creating…' : 'Create Service'}
      </button>
    </form>
  )
}

export default function Services() {
  const [services, setServices] = useState([])
  const [blockCounts, setBlockCounts] = useState({})
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([listServices(), getMyOrganizations(), listBlockCounts()])
      .then(([svcs, orgs, counts]) => {
        if (cancelled) return
        setServices(svcs)
        setOrganizations(orgs)
        setBlockCounts(counts)
      })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function refresh() {
    const [svcs, counts] = await Promise.all([listServices(), listBlockCounts()])
    setServices(svcs)
    setBlockCounts(counts)
  }

  async function handleCreated() {
    setShowForm(false)
    setError('')
    await refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cem-text">Services</h1>
        {!showForm && (
          <button type="button" onClick={() => { setShowForm(true); setError('') }} className={btn}>
            New Service
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-4">
          <NewServiceForm organizations={organizations} onCreated={handleCreated} />
        </div>
      )}

      {error && <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-cem-secondary">Loading services…</p>
      ) : services.length === 0 ? (
        <p className="mt-6 text-sm text-cem-secondary">No services yet. Create your first one above.</p>
      ) : (
        <ul className="mt-4 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
          {services.map((service) => (
            <li key={service.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link to={`/services/${service.id}`} className="text-sm font-medium text-cem-text hover:text-cem-amber">{service.name}</Link>
                  <ServiceStatusBadge status={service.status} />
                </div>
                <p className="mt-0.5 text-xs text-cem-secondary">
                  {formatServiceWhen(service.startsAt)}
                  {service.orgName ? ` · ${service.orgName}` : ''}
                  {service.branchName ? ` · ${service.branchName}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-xs text-cem-secondary">
                {blockCounts[service.id] ?? 0} block{blockCounts[service.id] === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}