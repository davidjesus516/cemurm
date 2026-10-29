// Real data for the gerencial dashboard home.
//
// The template shipped every card with hardcoded sales demo data. This hook
// replaces that with the signed-in manager's own CEMURM rows. Scope note: the
// repositories available today are user-scoped (songs.created_by,
// setlists.owner_id, gigs.owner_id), so these are the manager's numbers, not
// an organisation-wide rollup. An org-wide read would need new RLS-scoped
// queries; it is deliberately not invented here.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/app/providers/useAuth.jsx'
import { listSongs } from '@/data/repositories/songs.js'
import { listSetlists } from '@/data/repositories/setlists.js'
import { listGigs, listVenues } from '@/data/repositories/gigs.js'
import { listBandmates } from '@/data/repositories/bandmates.js'
import { listRehearsals } from '@/data/repositories/rehearsals.js'
import { getMyOrganizations } from '@/data/repositories/orgRepertoire.js'
import { getProfile } from '@/data/repositories/profiles.js'

export const PERIODS = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days'] as const
export type Period = (typeof PERIODS)[number]

export interface ChartPoint {
  date: string
  songs: number
  setlists: number
}

export interface PeriodStats {
  songs: number
  setlists: number
  songDelta: number | null
  setlistDelta: number | null
}

export interface AdminEvent {
  id: string
  name: string
  venue: string
  status: string
  setlist: string
  scheduledAt: string
}

export interface AdminCounts {
  songs: number
  setlists: number
  gigs: number
  rehearsals: number
  bandmates: number
  organizations: number
}

export interface AdminOverview {
  loading: boolean
  name: string
  counts: AdminCounts
  upcoming: AdminEvent[]
  events: AdminEvent[]
  upcomingRehearsals: number
  chart: Record<Period, ChartPoint[]>
  stats: Record<Period, PeriodStats>
  refresh: () => void
  exportCsv: () => void
}

interface DateRow {
  id: string
  createdAt?: string | null
}

interface SongRow extends DateRow {
  title?: string
  artist?: string
  key?: string
  bpm?: number | null
  status?: string
}

interface GigRow extends DateRow {
  name?: string
  scheduledAt?: string | null
  status?: string
  venueId?: string | null
  setlistId?: string | null
}

interface SetlistRow extends DateRow {
  name?: string
}

interface RehearsalRow {
  id: string
  plannedFor?: string | null
}

interface VenueRow {
  id: string
  name?: string
}

interface BandmateLink {
  userId?: string
  status?: string
}

interface MembershipRow {
  status?: string
}

interface ProfileRow {
  displayName?: string | null
  username?: string | null
}

interface AuthUser {
  id: string
  email?: string | null
}

interface AuthContextValue {
  user: AuthUser | null
}

interface Rows {
  songs: SongRow[]
  setlists: SetlistRow[]
  gigs: GigRow[]
  venues: VenueRow[]
  rehearsals: RehearsalRow[]
  bandmates: BandmateLink[]
  organizations: MembershipRow[]
  profile: ProfileRow | null
}

const EMPTY_ROWS: Rows = {
  songs: [],
  setlists: [],
  gigs: [],
  venues: [],
  rehearsals: [],
  bandmates: [],
  organizations: [],
  profile: null,
}

const DAY = 86_400_000
const PERIOD_DAYS: Record<Period, number> = {
  'Last 7 Days': 7,
  'Last 30 Days': 30,
  'Last 90 Days': 90,
}

interface Bucket {
  start: number
  end: number
  label: string
}

/**
 * Calendar buckets ending today. 7/30-day periods bucket by day; the 90-day
 * period buckets by week so the chart keeps a readable number of points.
 * `offset` moves the whole window back one period, for the delta comparison.
 */
function buckets(period: Period, offset = 0): Bucket[] {
  const days = PERIOD_DAYS[period]
  const step = period === 'Last 90 Days' ? 7 : 1
  const count = Math.ceil(days / step)
  const now = new Date()
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  ).getTime()

  const out: Bucket[] = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const end = endOfToday - (i + offset * count) * step * DAY
    const startDate = new Date(end - (step - 1) * DAY)
    startDate.setHours(0, 0, 0, 0)
    out.push({
      start: startDate.getTime(),
      end,
      label: new Date(end).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    })
  }
  return out
}

function countInRange(
  rows: DateRow[],
  start: number,
  end: number,
): number {
  let total = 0
  for (const row of rows) {
    const time = Date.parse(row.createdAt ?? '')
    if (Number.isFinite(time) && time >= start && time <= end) total += 1
  }
  return total
}

function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function useAdminOverview(): AdminOverview {
  // useAuth.jsx is plain JS and its `createContext(null)` makes TS infer the
  // context value as null, so the imported hook's return narrows to never.
  // The cast restores the shape the provider actually exposes.
  const { user } = useAuth() as unknown as AuthContextValue
  const userId = user?.id ?? null
  const [rows, setRows] = useState<Rows>(EMPTY_ROWS)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  const refresh = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    if (!userId) {
      setRows(EMPTY_ROWS)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    Promise.all([
      listSongs(userId).catch(() => []),
      listSetlists(userId).catch(() => []),
      listGigs(userId).catch(() => []),
      listVenues(userId).catch(() => []),
      listRehearsals().catch(() => []),
      listBandmates(userId).catch(() => []),
      getMyOrganizations().catch(() => []),
      getProfile(userId).catch(() => null),
    ]).then(
      ([
        songs,
        setlists,
        gigs,
        venues,
        rehearsals,
        bandmates,
        organizations,
        profile,
      ]) => {
        if (cancelled) return
        setRows({
          songs: songs as unknown as SongRow[],
          setlists: setlists as unknown as SetlistRow[],
          gigs: gigs as unknown as GigRow[],
          venues: venues as unknown as VenueRow[],
          rehearsals: rehearsals as unknown as RehearsalRow[],
          bandmates: bandmates as unknown as BandmateLink[],
          organizations: organizations as unknown as MembershipRow[],
          profile: profile as ProfileRow | null,
        })
        setLoading(false)
      },
    )

    return () => {
      cancelled = true
    }
  }, [userId, nonce])

  return useMemo(() => {
    const now = Date.now()

    const venueById = new Map(rows.venues.map((venue) => [venue.id, venue.name ?? '']))
    const setlistById = new Map(
      rows.setlists.map((setlist) => [setlist.id, setlist.name ?? '']),
    )

    const toEvent = (gig: GigRow): AdminEvent => ({
      id: gig.id,
      name: gig.name?.trim() || 'Untitled event',
      venue: (gig.venueId && venueById.get(gig.venueId)) || 'No venue',
      status: gig.status ?? 'planned',
      setlist: (gig.setlistId && setlistById.get(gig.setlistId)) || '—',
      scheduledAt: gig.scheduledAt ?? '',
    })

    const upcoming = rows.gigs
      .filter((gig) => {
        const time = Date.parse(gig.scheduledAt ?? '')
        return (
          Number.isFinite(time) &&
          time >= now &&
          (gig.status === 'planned' || gig.status === 'confirmed')
        )
      })
      .sort(
        (a, b) =>
          Date.parse(a.scheduledAt ?? '') - Date.parse(b.scheduledAt ?? ''),
      )
      .slice(0, 6)
      .map(toEvent)

    // The table is a general list (the template's Projects & Orders), not an
    // agenda: past events stay visible after the date passes.
    const events = rows.gigs
      .filter((gig) => Number.isFinite(Date.parse(gig.scheduledAt ?? '')))
      .sort(
        (a, b) =>
          Date.parse(b.scheduledAt ?? '') - Date.parse(a.scheduledAt ?? ''),
      )
      .slice(0, 8)
      .map(toEvent)

    const chart = {} as Record<Period, ChartPoint[]>
    const stats = {} as Record<Period, PeriodStats>

    for (const period of PERIODS) {
      const currentBuckets = buckets(period)
      chart[period] = currentBuckets.map((bucket) => ({
        date: bucket.label,
        songs: countInRange(rows.songs, bucket.start, bucket.end),
        setlists: countInRange(rows.setlists, bucket.start, bucket.end),
      }))

      const previousBuckets = buckets(period, 1)
      const previousSongs = previousBuckets.reduce(
        (total, bucket) => total + countInRange(rows.songs, bucket.start, bucket.end),
        0,
      )
      const previousSetlists = previousBuckets.reduce(
        (total, bucket) =>
          total + countInRange(rows.setlists, bucket.start, bucket.end),
        0,
      )

      const songsNow = chart[period].reduce((total, point) => total + point.songs, 0)
      const setlistsNow = chart[period].reduce(
        (total, point) => total + point.setlists,
        0,
      )

      stats[period] = {
        songs: songsNow,
        setlists: setlistsNow,
        songDelta: delta(songsNow, previousSongs),
        setlistDelta: delta(setlistsNow, previousSetlists),
      }
    }

    const bandmateIds = new Set(
      rows.bandmates
        .filter((link) => link.status === 'active' && link.userId)
        .map((link) => link.userId as string),
    )

    const upcomingRehearsals = rows.rehearsals.filter((rehearsal) => {
      const time = Date.parse(rehearsal.plannedFor ?? '')
      return Number.isFinite(time) && time >= now
    }).length

    const displayName =
      rows.profile?.displayName?.trim() ||
      rows.profile?.username?.trim() ||
      user?.email?.split('@')[0] ||
      'there'

    function exportCsv() {
      const lines = [
        ['Title', 'Artist', 'Key', 'BPM', 'Status'].map(csvCell).join(','),
        ...rows.songs.map((song) =>
          [song.title, song.artist, song.key, song.bpm, song.status]
            .map(csvCell)
            .join(','),
        ),
      ]
      const blob = new Blob([lines.join('\n')], {
        type: 'text/csv;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `cemurm-repertoire-${new Date().toISOString().slice(0, 10)}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    }

    return {
      loading,
      name: displayName,
      counts: {
        songs: rows.songs.length,
        setlists: rows.setlists.length,
        gigs: rows.gigs.length,
        rehearsals: rows.rehearsals.length,
        bandmates: bandmateIds.size,
        organizations: rows.organizations.filter((m) => m.status === 'active')
          .length,
      },
      upcoming,
      events,
      upcomingRehearsals,
      chart,
      stats,
      refresh,
      exportCsv,
    }
  }, [rows, loading, user?.email, refresh])
}
