import { useState } from 'react'
import { useGigs } from '../hooks/useGigs.js'
import { useSetlists } from '../hooks/useSetlists.js'
import GigCard from '../components/gigs/GigCard.jsx'
import GigForm from '../components/gigs/GigForm.jsx'

export default function Gigs() {
  const { gigs, venues, loading, createGig, createVenue } = useGigs()
  const { setlists } = useSetlists()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const venueById = new Map(venues.map((v) => [v.id, v]))

  async function handleCreate(payload) {
    try {
      await createGig(payload)
      setShowForm(false)
      setError('')
    } catch (err) { setError(err.message) }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cem-text">Gigs</h1>
        {!showForm && (
          <button type="button" onClick={() => { setShowForm(true); setError('') }}
            className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90">
            Add Gig
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-4">
          <GigForm venues={venues} setlists={setlists} createVenue={createVenue}
            onSubmit={handleCreate} onCancel={() => setShowForm(false)} submitLabel="Create Gig" />
        </div>
      )}

      {error && <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-cem-secondary">Loading gigs…</p>
      ) : gigs.length === 0 ? (
        <p className="mt-6 text-sm text-cem-secondary">No gigs yet. Plan your first one above.</p>
      ) : (
        <ul className="mt-4 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
          {gigs.map((gig) => <GigCard key={gig.id} gig={gig} venueName={venueById.get(gig.venueId)?.name || ''} />)}
        </ul>
      )}
    </div>
  )
}