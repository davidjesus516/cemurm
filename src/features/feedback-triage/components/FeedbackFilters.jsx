/* eslint-disable react/prop-types */
export function FeedbackFilters({ filters, onChange }) {
  return (
    <div className="flex gap-3 mb-4">
      <select
        value={filters.kind}
        onChange={(e) => onChange({ ...filters, kind: e.target.value })}
        className="border rounded px-2 py-1"
      >
        <option value="all">All types</option>
        <option value="bug_report">Bug report</option>
        <option value="general_feedback">General feedback</option>
      </select>
      <select
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
        className="border rounded px-2 py-1"
      >
        <option value="all">All statuses</option>
        <option value="new">New</option>
        <option value="triaged">Triaged</option>
        <option value="closed">Closed</option>
      </select>
      <button
        onClick={() => onChange({ kind: 'all', status: 'all' })}
        className="px-2 py-1 border rounded"
      >
        Clear
      </button>
    </div>
  )
}
