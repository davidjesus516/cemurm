/* eslint-disable react/prop-types */
import { useState } from 'react'

export function PromoteToIssueButton({ onClick }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      await onClick()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading ? 'Promoting...' : 'Promote to GitHub Issue'}
      </button>
      {error && (
        <div className="bg-cem-base mt-1 rounded px-2 py-1 text-xs text-destructive">{error}</div>
      )}
    </div>
  )
}
