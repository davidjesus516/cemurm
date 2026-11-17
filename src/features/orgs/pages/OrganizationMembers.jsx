// Organization members administration (F1). Tier 2 table; dialogs inside it are tier 1.
// Roster and mutations are server-authoritative through the 0021 RPCs.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import * as orgMembers from '../../../data/repositories/orgMembers.js'
import * as orgRepertoire from '../../../data/repositories/orgRepertoire.js'
import { searchProfiles } from '../../../data/repositories/profiles.js'

const ADMIN_ROLES = ['org_owner', 'org_admin']

const ASSIGNABLE_ROLES = [
  { value: 'instructor', label: 'Instructor' },
  { value: 'branch_admin', label: 'Branch admin' },
  { value: 'org_admin', label: 'Org admin' },
  { value: 'org_member', label: 'Member' },
  { value: 'performer', label: 'Performer' },
]

const ROLE_LABELS = {
  org_owner: 'Org owner',
  org_admin: 'Org admin',
  branch_admin: 'Branch admin',
  instructor: 'Instructor',
  org_member: 'Member',
  performer: 'Performer',
  substitute: 'Substitute',
  event_coordinator: 'Event coordinator',
  backstage_coordinator: 'Backstage coordinator',
}

const ghostBtn =
  'rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60'
const primaryBtn =
  'rounded-md bg-cem-amber px-3 py-1.5 text-xs font-semibold text-cem-surface hover:opacity-90 disabled:opacity-60'
const dangerBtn =
  'rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-secondary-elevated hover:bg-cem-elevated disabled:opacity-60'
const inputCls =
  'rounded-md border border-cem-elevated bg-cem-surface px-3 py-1.5 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none'

function roleLabel(role) {
  return ROLE_LABELS[role] || role
}

function memberName(member) {
  return member.displayName || member.username || member.userId.slice(0, 8)
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

export default function OrganizationMembers() {
  const { user } = useAuth()

  const [memberships, setMemberships] = useState([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingUserId, setPendingUserId] = useState('')

  // Add-member form
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState(null)
  const [newRole, setNewRole] = useState('instructor')
  const [adding, setAdding] = useState(false)

  const adminOrgs = useMemo(
    () =>
      memberships.filter(
        (m) => m.status === 'active' && ADMIN_ROLES.includes(m.role),
      ),
    [memberships],
  )
  const myRoleInSelectedOrg = useMemo(
    () => adminOrgs.find((m) => m.orgId === selectedOrgId)?.role ?? null,
    [adminOrgs, selectedOrgId],
  )
  const isOwner = myRoleInSelectedOrg === 'org_owner'

  const loadMemberships = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const rows = await orgRepertoire.getMyOrganizations()
      setMemberships(rows)
      const firstAdminOrg = rows.find(
        (m) => m.status === 'active' && ADMIN_ROLES.includes(m.role),
      )
      setSelectedOrgId((current) => current || firstAdminOrg?.orgId || '')
    } catch (e) {
      setError(/** @type {Error} */ (e).message)
    } finally {
      setLoading(false)
    }
  }, [user])

  const loadMembers = useCallback(async () => {
    if (!selectedOrgId) {
      setMembers([])
      return
    }
    setMembersLoading(true)
    setError('')
    try {
      const rows = await orgMembers.getOrgMembers(selectedOrgId)
      setMembers(rows)
    } catch (e) {
      setError(/** @type {Error} */ (e).message)
    } finally {
      setMembersLoading(false)
    }
  }, [selectedOrgId])

  useEffect(() => {
    loadMemberships()
  }, [loadMemberships])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  async function runMutation(userId, action, successMessage) {
    setActionError('')
    setNotice('')
    setPendingUserId(userId)
    try {
      await action()
      setNotice(successMessage)
      await loadMembers()
    } catch (e) {
      setActionError(/** @type {Error} */ (e).message)
    } finally {
      setPendingUserId('')
    }
  }

  function handleChangeRole(member) {
    const nextRole = window.prompt(
      `New role for ${memberName(member)}?\nOptions: ${ASSIGNABLE_ROLES.map((r) => r.value).join(', ')}`,
      member.role,
    )
    if (!nextRole || nextRole === member.role) return
    if (!ASSIGNABLE_ROLES.some((r) => r.value === nextRole)) {
      setActionError(`Unknown role "${nextRole}".`)
      return
    }
    return runMutation(
      member.userId,
      () => orgMembers.changeMemberRole(selectedOrgId, member.userId, nextRole),
      `${memberName(member)} is now ${roleLabel(nextRole)}.`,
    )
  }

  function handleRemove(member) {
    if (
      !window.confirm(
        `Remove ${memberName(member)} from this organization? Their history is preserved.`,
      )
    ) {
      return
    }
    return runMutation(
      member.userId,
      () => orgMembers.removeOrgMember(selectedOrgId, member.userId),
      `${memberName(member)} was removed.`,
    )
  }

  async function handleSearch(e) {
    e?.preventDefault?.()
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    setSearching(true)
    setActionError('')
    try {
      const found = await searchProfiles(q, { excludeUserId: user?.id })
      // searchProfiles may return nulls in the array shape; drop them before render.
      setResults((found || []).filter(Boolean))
    } catch (err) {
      setActionError(/** @type {Error} */ (err).message)
    } finally {
      setSearching(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!picked) {
      setActionError('Pick a user first.')
      return
    }
    setAdding(true)
    setActionError('')
    setNotice('')
    try {
      await orgMembers.addOrgMember(selectedOrgId, picked.id, newRole, null)
      setNotice(`${picked.displayName || picked.username} was added as ${roleLabel(newRole)}.`)
      setPicked(null)
      setQuery('')
      setResults([])
      await loadMembers()
    } catch (err) {
      setActionError(/** @type {Error} */ (err).message)
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-cem-secondary">Loading organizations…</p>
  }

  if (adminOrgs.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-cem-text">Members</h1>
        <p className="mt-3 text-sm text-cem-secondary">
          You need to be an org owner or org admin of an organization to manage its members.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-cem-text">Members</h1>

      {error && (
        <p className="mt-3 rounded-md bg-cem-surface px-3 py-2 text-sm text-cem-text border border-cem-elevated">{error}</p>
      )}
      {actionError && (
        <p className="mt-3 rounded-md bg-cem-surface px-3 py-2 text-sm text-cem-text border border-cem-elevated">
          {actionError}
        </p>
      )}
      {notice && (
        <p className="mt-3 rounded-md bg-cem-amber/10 px-3 py-2 text-sm text-cem-amber">{notice}</p>
      )}

      {adminOrgs.length > 1 && (
        <div className="mt-4">
          <label htmlFor="org-picker" className="text-xs font-medium text-cem-secondary">
            Organization
          </label>
          <select
            id="org-picker"
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className={`mt-1 block w-full max-w-sm ${inputCls}`}
          >
            {adminOrgs.map((m) => (
              <option key={m.orgId} value={m.orgId}>
                {m.org?.name ?? m.orgId}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Roster ── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-cem-text">Active members</h2>
        {membersLoading ? (
          <p className="mt-2 text-sm text-cem-secondary">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="mt-2 text-sm text-cem-secondary">This organization has no active members yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <span className="truncate text-sm font-medium text-cem-text">
                    {memberName(member)}
                  </span>
                  {member.username && (
                    <span className="ml-2 text-xs text-cem-secondary">@{member.username}</span>
                  )}
                  <p className="mt-0.5 text-xs text-cem-secondary">
                    {roleLabel(member.role)} · joined {formatDate(member.joinedAt)}
                  </p>
                </div>
                {member.role !== 'org_owner' && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handleChangeRole(member)}
                      disabled={Boolean(pendingUserId) || !isOwner}
                      title={isOwner ? undefined : 'Only the org owner can change roles'}
                      className={ghostBtn}
                    >
                      {pendingUserId === member.userId ? 'Saving…' : 'Change role'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(member)}
                      disabled={Boolean(pendingUserId) || !isOwner}
                      title={isOwner ? undefined : 'Only the org owner can remove members'}
                      className={dangerBtn}
                    >
                      {pendingUserId === member.userId ? 'Working…' : 'Remove'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Add member ── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-cem-text">Add a member</h2>
        <p className="mt-1 text-xs text-cem-secondary">
          Search by username, pick the person, choose a role.
        </p>

        <form onSubmit={handleSearch} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="member-search" className="text-xs font-medium text-cem-secondary">
              Username
            </label>
            <input
              id="member-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. pedro"
              className={`mt-1 block ${inputCls}`}
            />
          </div>
          <button type="submit" disabled={searching} className={ghostBtn}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results.length > 0 && (
          <ul className="mt-3 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface">
            {results.map((profile) => (
              <li key={profile.id} className="px-4 py-2">
                <button
                  type="button"
                  onClick={() => setPicked(profile)}
                  className="w-full text-left text-sm text-cem-text hover:text-cem-amber"
                >
                  {profile.displayName || profile.username || profile.id.slice(0, 8)}
                  {profile.username && (
                    <span className="ml-2 text-xs text-cem-secondary">@{profile.username}</span>
                  )}
                  {picked?.id === profile.id && (
                    <span className="ml-2 text-xs font-semibold text-cem-amber">selected</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="member-role" className="text-xs font-medium text-cem-secondary">
              Role
            </label>
            <select
              id="member-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className={`mt-1 block ${inputCls}`}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={adding || !picked} className={primaryBtn}>
            {adding ? 'Adding…' : 'Add member'}
          </button>
        </form>
      </section>
    </div>
  )
}
