/* eslint-disable react/prop-types */

// Organizations overview (Hito 4, organizational-repertoire-model frontend):
// three sections — My organizations (membership cards), Repertoire scopes
// (the songs visible to this session grouped by level, with promote/demote
// for songs my org can act on), and Leave organization. RLS is the source of
// truth: reads render whatever comes back; the 0016 RPCs enforce the rules
// and their exact error strings are shown inline (never swallowed by the
// generic wrapper). Hole state: no memberships → repertoire + leave sections
// are hidden entirely.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import * as orgRepertoire from '../../../data/repositories/orgRepertoire.js'
import * as songs from '../../../data/repositories/songs.js'

const ELEVATED_ROLES = ['instructor', 'branch_admin', 'org_admin', 'org_owner']

const ROLE_LABELS = {
  instructor: 'Instructor',
  branch_admin: 'Branch admin',
  org_admin: 'Org admin',
  org_owner: 'Org owner',
  member: 'Member',
}

const STATUS_STYLES = {
  active: 'bg-cem-amber/10 text-cem-amber',
  former: 'bg-cem-elevated text-cem-secondary',
}

const ghostBtn =
  'rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60'
const dangerBtn =
  'rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-rose hover:bg-cem-elevated disabled:opacity-60'

function roleLabel(role) {
  return ROLE_LABELS[role] || role
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || STATUS_STYLES.former
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

function MembershipCard({ membership }) {
  const meta = [
    membership.org?.orgType,
    roleLabel(membership.role),
    membership.branch
      ? `${membership.branch.name}${membership.branch.city ? ` · ${membership.branch.city}` : ''}`
      : '',
    `Joined ${formatDate(membership.joinedAt)}`,
  ].filter(Boolean).join(' · ')

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-cem-text">{membership.org?.name}</span>
          <StatusBadge status={membership.status} />
        </div>
        <p className="mt-0.5 text-xs text-cem-secondary">{meta}</p>
      </div>
    </li>
  )
}

function ScopedSongRow({ song, canPromote, canDemote, pendingId, onPromote, onDemote }) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <span className="truncate text-sm font-medium text-cem-text">{song.title}</span>
        {song.artist && <span className="ml-2 text-xs text-cem-secondary">{song.artist}</span>}
      </div>
      <div className="flex shrink-0 gap-2">
        {canPromote && (
          <button
            type="button"
            onClick={() => onPromote(song.id)}
            disabled={Boolean(pendingId)}
            className={ghostBtn}
          >
            {pendingId === song.id ? 'Promoting…' : 'Promote to system'}
          </button>
        )}
        {canDemote && (
          <button
            type="button"
            onClick={() => onDemote(song.id)}
            disabled={Boolean(pendingId)}
            className={ghostBtn}
          >
            {pendingId === song.id ? 'Demoting…' : 'Demote to org'}
          </button>
        )}
      </div>
    </li>
  )
}

function ScopeGroup({ title, emptyText, songs: groupSongs, renderRow }) {
  return (
    <div>
      <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-cem-secondary">{title}</h3>
      {groupSongs.length === 0 ? (
        <p className="mt-1 text-sm text-cem-secondary">{emptyText}</p>
      ) : (
        <ul className="mt-1 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
          {groupSongs.map(renderRow)}
        </ul>
      )}
    </div>
  )
}

export default function Organizations() {
  const { user } = useAuth()
  const [memberships, setMemberships] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [visibleSongs, setVisibleSongs] = useState([])
  const [songsLoading, setSongsLoading] = useState(false)
  const [songsError, setSongsError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingSongId, setPendingSongId] = useState('')
  const [leavingOrgId, setLeavingOrgId] = useState('')

  const loadMemberships = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const rows = await orgRepertoire.getMyOrganizations()
      setMemberships(rows)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  const loadSongs = useCallback(async () => {
    if (!user) return
    setSongsLoading(true)
    setSongsError('')
    try {
      const list = await songs.listSongs(user.id)
      setVisibleSongs(list)
    } catch (e) {
      setSongsError(e.message)
    } finally {
      setSongsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadMemberships()
  }, [loadMemberships])

  const elevatedActive = useMemo(
    () => memberships.filter((m) => m.status === 'active' && ELEVATED_ROLES.includes(m.role)),
    [memberships],
  )
  const myElevatedOrgIds = useMemo(
    () => new Set(elevatedActive.map((m) => m.orgId)),
    [elevatedActive],
  )

  // Repertoire songs load only when there is an elevated active membership to
  // act on; the read is RLS-scoped (never filtered by org_id client-side).
  useEffect(() => {
    if (elevatedActive.length === 0) return
    loadSongs()
  }, [loadSongs, elevatedActive.length])

  const systemSongs = useMemo(() => visibleSongs.filter((s) => !s.orgId), [visibleSongs])
  const orgLevelSongs = useMemo(() => visibleSongs.filter((s) => s.orgId && !s.branchId), [visibleSongs])
  const branchLevelSongs = useMemo(() => visibleSongs.filter((s) => s.branchId), [visibleSongs])

  async function runAction(action, songId) {
    setActionError('')
    setPendingSongId(songId)
    try {
      await action(songId)
      await loadSongs()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setPendingSongId('')
    }
  }

  function handlePromote(songId) {
    return runAction(orgRepertoire.promoteSong, songId)
  }

  function handleDemote(songId) {
    return runAction(orgRepertoire.demoteSong, songId)
  }

  async function handleLeave(orgId) {
    if (!window.confirm('Are you sure you want to leave this organization?')) return
    setActionError('')
    setLeavingOrgId(orgId)
    try {
      await orgRepertoire.leaveOrganization(orgId)
      await loadMemberships()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setLeavingOrgId('')
    }
  }

  const renderSongRow = (song) => (
    <ScopedSongRow
      key={song.id}
      song={song}
      canPromote={Boolean(song.orgId && myElevatedOrgIds.has(song.orgId))}
      canDemote={Boolean(!song.orgId && song.sourceOrgId && myElevatedOrgIds.has(song.sourceOrgId))}
      pendingId={pendingSongId}
      onPromote={handlePromote}
      onDemote={handleDemote}
    />
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-cem-text">Organizations</h1>

      {error && (
        <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>
      )}

      {actionError && (
        <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{actionError}</p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-cem-secondary">Loading organizations…</p>
      ) : (
        <>
          <section>
            <h2 className="mt-8 text-lg font-semibold text-cem-text">My organizations</h2>
            {memberships.length === 0 ? (
              <p className="mt-2 text-sm text-cem-secondary">
                You are not part of any organization yet.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
                {memberships.map((membership) => (
                  <MembershipCard key={membership.id} membership={membership} />
                ))}
              </ul>
            )}
          </section>

          {memberships.length === 0 || elevatedActive.length === 0 ? null : (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-cem-text">Repertoire scopes</h2>
              <p className="mt-1 text-xs text-cem-secondary">
                Songs visible to you right now (RLS-scoped), grouped by level. Promote sends an
                org/branch song to the system catalog; demote returns a system song to its source org.
              </p>

              {songsError && (
                <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">
                  {songsError}
                </p>
              )}

              {songsLoading ? (
                <p className="mt-3 text-sm text-cem-secondary">Loading repertoire…</p>
              ) : (
                <>
                  <ScopeGroup
                    title="System"
                    emptyText="No system-level songs visible."
                    songs={systemSongs}
                    renderRow={renderSongRow}
                  />
                  <ScopeGroup
                    title="Org-level"
                    emptyText="No org-level songs visible."
                    songs={orgLevelSongs}
                    renderRow={renderSongRow}
                  />
                  <ScopeGroup
                    title="Branch-level"
                    emptyText="No branch-level songs visible."
                    songs={branchLevelSongs}
                    renderRow={renderSongRow}
                  />
                </>
              )}
            </section>
          )}

          {memberships.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-cem-text">Leave organization</h2>
              {memberships.some((m) => m.status === 'active') ? (
                <ul className="mt-2 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
                  {memberships
                    .filter((m) => m.status === 'active')
                    .map((membership) => (
                      <li key={membership.id} className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                          <span className="truncate text-sm font-medium text-cem-text">
                            {membership.org?.name}
                          </span>
                          <p className="mt-0.5 text-xs text-cem-secondary">
                            {roleLabel(membership.role)}
                            {membership.branch ? ` · ${membership.branch.name}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleLeave(membership.orgId)}
                          disabled={Boolean(leavingOrgId)}
                          className={dangerBtn}
                        >
                          {leavingOrgId === membership.orgId ? 'Leaving…' : 'Leave'}
                        </button>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-cem-secondary">You are not active in any organization.</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}