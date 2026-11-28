// Account status view (F1 — Membership Admin). Tier 1 surface: settings.
//
// Read-only: shows the caller's own account status, email, and membership
// count. Export/erasure mutations live in /settings (ExportDataCard /
// DeleteAccountCard) and ship in Hito 6 — this page surfaces the state those
// actions target.

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import { getMyOrganizations } from '../../../data/repositories/orgRepertoire.js'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

export default function AccountSettings() {
  const { user, loading } = useAuth()
  const [membershipCount, setMembershipCount] = useState(0)
  const [loadingMemberships, setLoadingMemberships] = useState(false)
  const [error, setError] = useState('')

  const refreshMemberships = useCallback(async () => {
    if (!user?.id) return
    setLoadingMemberships(true)
    setError('')
    try {
      const rows = await getMyOrganizations()
      setMembershipCount(rows.filter((m) => m.status === 'active').length)
    } catch (e) {
      setError(/** @type {Error} */ (e).message)
    } finally {
      setLoadingMemberships(false)
    }
  }, [user?.id])

  useEffect(() => {
    refreshMemberships()
  }, [refreshMemberships])

  if (loading) {
    return <p className="mt-6 text-sm text-cem-secondary">Loading account…</p>
  }

  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-cem-text">Account</h1>
        <p className="mt-3 text-sm text-cem-secondary">Not signed in.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-cem-text">Account</h1>

      {error && (
        <p className="mt-3 rounded-md bg-cem-surface px-3 py-2 text-sm text-cem-text border border-cem-elevated">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-cem-elevated">
        <table className="w-full text-sm">
          <thead className="bg-cem-elevated text-left text-xs uppercase tracking-wide text-cem-secondary-elevated">
            <tr>
              <th className="px-4 py-2 font-medium">Field</th>
              <th className="px-4 py-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-cem-elevated">
              <td className="px-4 py-3 font-medium text-cem-text">Email</td>
              <td className="px-4 py-3 text-cem-text">{user.email ?? '—'}</td>
            </tr>
            {/* No Status row: the account lifecycle state (active/suspended/erased)
                is not modelled yet — there is no column and no enum for it, so any
                value rendered here would be invented. It comes back when S6 has a
                state to read. */}
            <tr className="border-t border-cem-elevated">
              <td className="px-4 py-3 font-medium text-cem-text">Member since</td>
              <td className="px-4 py-3 text-cem-text">{formatDate(user.created_at)}</td>
            </tr>
            <tr className="border-t border-cem-elevated">
              <td className="px-4 py-3 font-medium text-cem-text">Active memberships</td>
              <td className="px-4 py-3 text-cem-text">
                {loadingMemberships ? (
                  <span className="text-sm text-cem-secondary">Loading…</span>
                ) : (
                  membershipCount
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-cem-secondary">
        Export your data or request erasure from the <strong>Settings</strong> page
        (&rarr; Export my data / Delete my account). Those actions are handled
        in Hito 6; this page shows your current account state.
      </p>
    </div>
  )
}
