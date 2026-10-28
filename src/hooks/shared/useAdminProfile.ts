// Real identity data for the gerencial user-profile page.
//
// The template page was a fake editable form (local state, no persistence).
// This hook reads the two real sources the screen needs: the signed-in
// profile and the caller's organisation memberships. Writes are deliberately
// not offered here: CEMURM has no profile-edit surface yet, and the template's
// "Save Changes" only mutated local state.
import { useEffect, useState } from 'react'
import { useAuth } from '@/app/providers/useAuth.jsx'
import { getProfile } from '@/data/repositories/profiles.js'
import { getMyOrganizations } from '@/data/repositories/orgRepertoire.js'

export interface AdminMembership {
  id: string
  orgName: string
  branchName: string
  role: string
  status: string
  joinedAt: string
}

export interface AdminProfile {
  loading: boolean
  displayName: string
  username: string
  email: string
  avatarUrl: string
  memberships: AdminMembership[]
  role: string
  orgName: string
  joinedAt: string
}

interface ProfileRow {
  displayName?: string | null
  username?: string | null
  avatarUrl?: string | null
}

interface MembershipRow {
  id?: string
  role?: string
  status?: string
  joinedAt?: string | null
  org?: { name?: string | null } | null
  branch?: { name?: string | null } | null
}

interface AuthUser {
  id: string
  email?: string | null
}

interface AuthContextValue {
  user: AuthUser | null
}

function toMembership(row: MembershipRow, index: number): AdminMembership {
  return {
    id: row.id ?? `membership-${index}`,
    orgName: row.org?.name?.trim() || 'Unnamed organization',
    branchName: row.branch?.name?.trim() || '',
    role: row.role ?? '',
    status: row.status ?? '',
    joinedAt: row.joinedAt ?? '',
  }
}

export function useAdminProfile(): AdminProfile {
  // useAuth.jsx is plain JS and its `createContext(null)` makes TS infer the
  // context value as null; the cast restores the provider's actual shape.
  const { user } = useAuth() as unknown as AuthContextValue
  const userId = user?.id ?? null
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [memberships, setMemberships] = useState<MembershipRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setMemberships([])
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    Promise.all([
      getProfile(userId).catch(() => null),
      getMyOrganizations().catch(() => []),
    ]).then(([profileRow, membershipRows]) => {
      if (cancelled) return
      setProfile(profileRow as unknown as ProfileRow | null)
      setMemberships(
        (membershipRows as unknown as MembershipRow[] | null) ?? [],
      )
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [userId])

  const active = memberships.filter((row) => row.status === 'active')
  const primary = active[0] ?? memberships[0] ?? null

  const ordered = [
    ...memberships.filter((row) => row.status === 'active'),
    ...memberships.filter((row) => row.status !== 'active'),
  ]

  return {
    loading,
    displayName: profile?.displayName?.trim() || '',
    username: profile?.username?.trim() || '',
    email: user?.email ?? '',
    avatarUrl: profile?.avatarUrl?.trim() || '',
    memberships: ordered.map(toMembership),
    role: primary?.role ?? '',
    orgName: primary?.org?.name?.trim() || '',
    joinedAt: primary?.joinedAt ?? '',
  }
}
