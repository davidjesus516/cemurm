import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useGigs } from '../hooks/useGigs.js'
import { useSetlists } from '../hooks/useSetlists.js'
import { useSongs } from '../hooks/useSongs.js'
import GigForm from '../components/gigs/GigForm.jsx'
import { StatusBadge, formatWhen } from '../components/gigs/GigCard.jsx'

const btn = 'rounded-md px-3 py-1.5 text-sm font-medium'
const outlined = `${btn} border border-cem-elevated text-cem-text hover:bg-cem-elevated`

export default function GigDetail() {
  const { id } = useParams()
  const { getGig, venues, updateGig, createVenue, confirmGig, cancelGig, reopenGig } = useGigs()
  const { setlists } = useSetlists()
  const { songs } = useSongs()
  const [gig, setGig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let cancelled = false
    getGig(id)
      .then((data) => { if (!cancelled) setGig(data) })
      .catch(() => { if (!cancelled) setError('Gig not found.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <p className="text-sm text-cem-secondary">Loading gig…</p>
  if (!gig) {
    return error ? (
      <div>
        <p className="rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>
        <Link to="/gigs" className="mt-4 inline-block text-sm font-medium text-cem-amber hover:underline">← Back to gigs</Link>
      </div>
    ) : null
  }

  const venue = venues.find((v) => v.id === gig.venueId)
  const setlist = setlists.find((s) => s.id === gig.setlistId)
  const songById = new Map(songs.map((s) => [s.id, s.title]))
  const venueDetail = [venue?.location, venue?.type].filter(Boolean).join(' · ')
  const venueLine = venue ? `${venue.name}${venueDetail ? ` — ${venueDetail}` : ''}` : '—'
  const showActions = gig.status !== 'completed' && !editing
  const perf = gig.performance

  async function runAction(fn) {
    try {
      setError('')
      setGig(await fn(gig.id))
    } catch (err) { setError(err.message) }
  }

  async function handleUpdate(payload) {
    try {
      setGig(await updateGig(id, payload))
      setEditing(false)
      setError('')
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/gigs" className="text-sm font-medium text-cem-amber hover:underline">← Back to gigs</Link>
      {error && <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>}

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cem-text">{gig.name}</h1>
          <p className="mt-1 text-sm text-cem-secondary">{formatWhen(gig.scheduledAt)}</p>
          <div className="mt-1"><StatusBadge status={gig.status} /></div>
        </div>
        {showActions && (
          <div className="flex flex-wrap justify-end gap-2">
            {gig.status === 'planned' && (
              <button type="button" onClick={() => runAction(confirmGig)} className={`${btn} bg-cem-emerald text-cem-base hover:bg-cem-emerald/90`}>Confirm</button>
            )}
            {gig.status === 'cancelled' && (
              <button type="button" onClick={() => runAction(reopenGig)} className={`${btn} border border-cem-emerald/40 text-cem-emerald hover:bg-cem-emerald/10`}>Reopen</button>
            )}
            {gig.status !== 'cancelled' && (
              <button type="button" onClick={() => runAction(cancelGig)} className={`${btn} border border-cem-elevated text-cem-secondary hover:bg-cem-elevated`}>Cancel</button>
            )}
            <button type="button" onClick={() => { setEditing(true); setError('') }} className={outlined}>Edit</button>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2 rounded-lg border border-cem-elevated bg-cem-surface p-4 text-sm shadow-sm">
        <p className="flex justify-between gap-4"><span className="text-cem-secondary">Venue</span><span className="text-right text-cem-text">{venueLine}</span></p>
        <p className="flex justify-between gap-4"><span className="text-cem-secondary">Setlist</span>
          <span className="text-right text-cem-text">{setlist ? <Link to={`/setlists/${setlist.id}`} className="font-medium text-cem-amber hover:underline">{setlist.name}</Link> : '—'}</span>
        </p>
      </div>

      {editing && (
        <div className="mt-4">
          <h2 className="mb-2 text-lg font-semibold text-cem-text">Edit Gig</h2>
          <GigForm venues={venues} setlists={setlists} createVenue={createVenue}
            initial={{ ...gig, venueName: venue?.name || '' }} onSubmit={handleUpdate}
            onCancel={() => setEditing(false)} submitLabel="Save Changes" />
        </div>
      )}

      {gig.status === 'completed' && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-cem-text">Performance</h2>
          {perf ? (
            <>
              <p className="mt-1 text-sm text-cem-secondary">{formatWhen(perf.performedAt)} · {perf.items.length} song{perf.items.length === 1 ? '' : 's'}</p>
              {['played', 'skipped', 'off_setlist'].map((state) => {
                const items = perf.items.filter((i) => i.state === state)
                return items.length ? (
                  <p key={state} className="mt-2 text-sm text-cem-text">
                    <span className="font-medium capitalize text-cem-secondary">{state.replace('_', ' ')}:</span>{' '}
                    {items.map((i) => songById.get(i.songId) || '(missing song)').join(', ')}
                  </p>
                ) : null
              })}
            </>
          ) : (
            <p className="mt-1 text-sm text-cem-secondary">No performance record.</p>
          )}
        </div>
      )}

      {gig.status === 'cancelled' && !editing && (
        <p className="mt-6 text-sm text-cem-secondary">Cancelled — no performance was recorded. Reopen to reschedule or complete.</p>
      )}
    </div>
  )
}