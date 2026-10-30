/* eslint-disable react/prop-types */
import { PromoteToIssueButton } from './PromoteToIssueButton'

export function FeedbackDetailPanel({ item, onClose, onStatusChange, onPromote }) {
  if (!item) return null

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-cem-elevated shadow-xl border-l p-4 overflow-y-auto">
      <div className="flex justify-between mb-4">
        <h2 className="text-lg font-semibold">Feedback Detail</h2>
        <button onClick={onClose}>Close</button>
      </div>

      <div className="space-y-2 text-sm">
        <div><b>Kind:</b> {item.kind}</div>
        <div><b>Status:</b> {item.status}</div>
        <div><b>Screen:</b> {item.screen || '-'}</div>
        <div><b>User:</b> {item.user_id}</div>
        <div><b>Created:</b> {new Date(item.created_at).toLocaleString()}</div>
        {item.updated_at && <div><b>Updated:</b> {new Date(item.updated_at).toLocaleString()}</div>}
        {item.github_issue_url && (
          <div>
            <b>GitHub:</b>{' '}
            <a href={item.github_issue_url} target="_blank" rel="noreferrer">
              #{item.github_issue_number}
            </a>
          </div>
        )}
        <div>
          <b>Message:</b>
          <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
        </div>
        {item.diagnostics && (
          <div>
            <b>Diagnostics:</b>
            <pre className="mt-1 bg-cem-surface p-2 overflow-x-auto text-xs">
              {JSON.stringify(item.diagnostics, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.status === 'new' && <button onClick={() => onStatusChange(item.id, 'triaged')}>Mark triaged</button>}
        {item.status === 'triaged' && <button onClick={() => onStatusChange(item.id, 'closed')}>Mark closed</button>}
        {item.status === 'closed' && <button onClick={() => onStatusChange(item.id, 'triaged')}>Reopen</button>}
        {!item.github_issue_number && <PromoteToIssueButton onClick={() => onPromote(item.id)} />}
      </div>
    </div>
  )
}
