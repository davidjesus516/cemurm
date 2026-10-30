/* eslint-disable react/prop-types */
export function FeedbackInboxTable({ items, onSelect }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Type</th>
            <th className="py-2">Status</th>
            <th className="py-2">Message</th>
            <th className="py-2">Screen</th>
            <th className="py-2">GitHub</th>
            <th className="py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={() => onSelect(item)}
              className="border-b hover:bg-cem-hover cursor-pointer"
            >
              <td className="py-2">{item.kind === 'bug_report' ? 'Bug' : 'Feedback'}</td>
              <td className="py-2">{item.status}</td>
              <td className="py-2 max-w-md truncate">{item.message}</td>
              <td className="py-2">{item.screen || '-'}</td>
              <td className="py-2">
                {item.github_issue_url ? (
                  <a href={item.github_issue_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    #{item.github_issue_number}
                  </a>
                ) : (
                  '-'
                )}
              </td>
              <td className="py-2">{new Date(item.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
