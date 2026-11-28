// Organization analytics (S3 / T7). Tier 2: no material, no decorative shadow.
// getOrgMembers / getMyOrganizations are the only org reads; both are RLS-scoped,
// so the page reports the rows this user can see and says so. Metrics that need
// an engagement or event-participation column (absent from the schema) are
// rendered as explicit "Not tracked yet" cards, never invented.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOrgAnalytics } from '../../../data/repositories/analytics.js'
import { useSongs } from '../../../hooks/shared/useSongs.js'
import {
  memberTenure,
  membersByBranch,
  repertoireByBranch,
} from '../../../domain/analytics/orgAnalytics.js'
import {
  hasUsableCreatedAt,
  songsInDateRange,
} from '../../../domain/analytics/repertoireInsights.js'
import AnalyticsNav from '../components/AnalyticsNav.jsx'
import { BarChart, Card, NotTracked, Stat } from '../components/ui.jsx'

export default function OrgAnalytics() {
  const { songs, loading: songsLoading } = useSongs()
  const [orgData, setOrgData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // songs[].createdAt is real data already loaded on this page. Filter it before
  // the per-branch breakdown; songs without a date are kept in the all-dates
  // default and reported honestly rather than silently dropped.
  const datedSongs = useMemo(
    () => songsInDateRange(songs, { from: fromDate, to: toDate }),
    [songs, fromDate, toDate],
  )
  const undatedCount = useMemo(
    () => songs.filter((s) => !hasUsableCreatedAt(s)).length,
    [songs],
  )

  useEffect(() => {
    let cancelled = false
    getOrgAnalytics()
      .then((data) => { if (!cancelled) setOrgData(data) })
      .catch(() => { if (!cancelled) setError('Could not load organization data right now.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading || songsLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-cem-text">Organization analytics</h1>
        <AnalyticsNav current="/analytics/organization" />
        <p className="mt-6 text-sm text-cem-secondary">Loading organization data…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-cem-text">Organization analytics</h1>
        <AnalyticsNav current="/analytics/organization" />
        <p className="mt-6 text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!orgData) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-cem-text">Organization analytics</h1>
        <AnalyticsNav current="/analytics/organization" />
        <Card title="No organization yet" subtitle="Org insights need an active organization membership">
          <p className="mt-3 text-xs text-cem-secondary">
            Join or create an organization to see member and repertoire breakdowns.
          </p>
        </Card>
      </div>
    )
  }

  const tenure = memberTenure(orgData.members)
  const membersPerBranch = membersByBranch(orgData.members, orgData.branches)
  const repertoire = repertoireByBranch(datedSongs, orgData.branches)
  const dateRangeLabel = fromDate || toDate
    ? `${fromDate || 'earliest'} → ${toDate || 'latest'}`
    : 'all dates'

  return (
    <div>
      <h1 className="text-2xl font-bold text-cem-text">Organization analytics</h1>
      <p className="mt-1 text-sm text-cem-secondary">
        {orgData.org.name} · visible scope only (members and songs this account can read)
      </p>
      <AnalyticsNav current="/analytics/organization" />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Members (visible)" value={tenure.total} />
        <Stat label="Joined this month" value={tenure.joinedThisMonth} />
        <Stat label="Avg tenure" value={`${tenure.averageTenureDays} d`} />
        <Stat label="Songs (visible)" value={repertoire.total} />
      </div>

      <Card title="Members by branch" subtitle="Includes branches with no members and an unassigned bucket">
        <BarChart
          ariaLabel="Visible members per branch"
          rows={membersPerBranch.map((b) => ({ label: b.name, value: b.count }))}
        />
      </Card>

      <Card
        title="Repertoire by branch"
        subtitle={`${repertoire.orgSpecific} org-specific additions · ${repertoire.systemSongs} system-level songs · ${dateRangeLabel}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-cem-text">
              From
              <input type="date" value={fromDate} max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label="Repertoire added from date"
                className="ml-1 rounded border border-cem-elevated bg-cem-base px-2 py-1 text-xs text-cem-text" />
            </label>
            <label className="text-xs text-cem-text">
              To
              <input type="date" value={toDate} min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
                aria-label="Repertoire added to date"
                className="ml-1 rounded border border-cem-elevated bg-cem-base px-2 py-1 text-xs text-cem-text" />
            </label>
            {(fromDate || toDate) && (
              <button type="button" onClick={() => { setFromDate(''); setToDate('') }}
                className="rounded-md border border-cem-elevated px-2 py-1 text-xs text-cem-text hover:bg-cem-elevated">
                All dates
              </button>
            )}
          </div>
        }
      >
        <BarChart
          ariaLabel="Visible songs per branch, by addition date range"
          rows={repertoire.byBranch.map((b) => ({ label: b.name, value: b.count }))}
        />
        {undatedCount > 0 && (
          <p className="mt-2 text-xs text-cem-secondary">
            {undatedCount} song{undatedCount === 1 ? '' : 's'} with no recorded add date
            {' '}{fromDate || toDate
              ? 'cannot be placed in this range and are excluded.'
              : 'are included in the all-dates total.'}
          </p>
        )}
      </Card>

      <NotTracked
        title="Member activity"
        detail="Active versus inactive members this month needs a last-engagement timestamp, which this schema does not record. Tenure and joins-this-month above come from joined_at."
      />
      <NotTracked
        title="Event participation"
        detail="Participants per event, cross-branch participation and popular instrument groups have no event-attendance data source in this build."
      />
      <NotTracked
        title="Low-activity warnings"
        detail="A 'days since last engagement' flag needs a tracked activity timestamp; none exists yet. Branch counts above can reveal an empty branch, but not inactivity over time."
      />

      <p className="mt-6 text-xs text-cem-secondary">
        For song-level genre, key and trend insight, open{' '}
        <Link to="/analytics/repertoire" className="text-cem-text underline">Repertoire insights</Link>.
      </p>
    </div>
  )
}
