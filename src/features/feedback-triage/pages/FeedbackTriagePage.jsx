import { useState } from 'react'
import { useFeedbackTriage } from '../hooks/useFeedbackTriage'
import { FeedbackFilters } from '../components/FeedbackFilters'
import { FeedbackInboxTable } from '../components/FeedbackInboxTable'
import { FeedbackDetailPanel } from '../components/FeedbackDetailPanel'

export default function FeedbackTriagePage() {
  const [filters, setFilters] = useState({ kind: 'all', status: 'all' })
  const [selected, setSelected] = useState(null)
  const { items, loading, error, setStatus, promote } = useFeedbackTriage(filters)

  async function handleStatusChange(id, status) {
    await setStatus(id, status)
  }

  async function handlePromote(id) {
    await promote(id)
    setSelected(null)
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Feedback Triage</h1>
      <FeedbackFilters filters={filters} onChange={setFilters} />
      {loading && <div>Loading...</div>}
      {error && <div className="text-destructive">{error}</div>}
      {!loading && !error && <FeedbackInboxTable items={items} onSelect={setSelected} />}
      <FeedbackDetailPanel
        item={selected}
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
        onPromote={handlePromote}
      />
    </div>
  )
}
