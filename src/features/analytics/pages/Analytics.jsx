// Personal analytics + performance history (S3 / T6). Tier 2: no material, no
// decorative shadow. Every chart is fed by data the signed-in user can actually
// read; the one metric with no backing table (practice sessions) says so.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGigs } from '../../../hooks/shared/useGigs.js'
import { useSetlists } from '../../../hooks/shared/useSetlists.js'
import { useSongs } from '../../../hooks/shared/useSongs.js'
import { formatDuration } from '../../../domain/library/duration.js'
import { relativeTime } from '../../../domain/library/relativeTime.js'
import {
  durationTrend,
  mostUsedSongs,
  performanceTimeline,
  repertoireGrowth,
  songPopularity,
  untouchedSongs,
} from '../../../domain/analytics/personalAnalytics.js'
import AnalyticsNav from '../components/AnalyticsNav.jsx'
import { BarChart, Card, LineChart, NotTracked, Stat } from '../components/ui.jsx'

/**
 * Gig list rows embed only performance ids/dates; items live on the detail row.
 * Fetch details once per performed gig through the existing getGig read, keeping
 * the function in a ref so exhaustive-deps does not refetch on every render.
 */
function usePerformanceDetails(gigs, getGig) {
  const getGigRef = useRef(getGig)
  getGigRef.current = getGig
  const [details, setDetails] = useState(null)
  const key = useMemo(
    () => gigs.filter((g) => g?.performance).map((g) => g.id).join(','),
    [gigs],
  )

  useEffect(() => {
    let cancelled = false
    const ids = key ? key.split(',') : []
    if (ids.length === 0) {
      setDetails([])
      return undefined
    }
    Promise.all(ids.map((id) => getGigRef.current(id)))
      .then((rows) => { if (!cancelled) setDetails(rows) })
      .catch(() => { if (!cancelled) setDetails([]) })
    return () => { cancelled = true }
  }, [key])

  return details
}

export default function Analytics() {
  const { songs, loading: songsLoading } = useSongs()
  const { setlists, loading: setlistsLoading } = useSetlists()
  const { gigs, venues, loading: gigsLoading, getGig, completeGig } = useGigs()
  const details = usePerformanceDetails(gigs, getGig)

  const [genre, setGenre] = useState('')
  const [age, setAge] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [venueFilter, setVenueFilter] = useState('')
  const [venueTypeFilter, setVenueTypeFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [markError, setMarkError] = useState('')

  const bySongId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs])
  const venueById = useMemo(() => new Map(venues.map((v) => [v.id, v])), [venues])
  // Venue type lives on venues[].type, not on the gig row. Join it through the
  // venue id so the pure performanceTimeline filter can match on it. A venue
  // with no type yields '' — it stays visible in the all-types default and
  // simply matches no named type (never a silent drop).
  const venueTypes = useMemo(
    () => [...new Set(venues.map((v) => String(v.type || '').trim()).filter(Boolean))].sort(),
    [venues],
  )
  const currentMonth = new Date().toISOString().slice(0, 7)

  const used = useMemo(() => mostUsedSongs(setlists), [setlists])
  const growth = useMemo(() => repertoireGrowth(songs), [songs])
  const played = useMemo(() => songPopularity(details || []), [details])
  const performed = useMemo(() => performanceTimeline(details || []), [details])
  const months = useMemo(() => durationTrend(setlists), [setlists])
  const untouched = useMemo(
    () => untouchedSongs(songs, setlists, {
      genre: genre || undefined,
      olderThanMonths: age ? Number(age) : undefined,
    }),
    [songs, setlists, genre, age],
  )
  const timelineWithVenueType = useMemo(
    () => (details || []).map((gig) => ({
      ...gig,
      venueType: venueById.get(gig.venueId)?.type || '',
    })),
    [details, venueById],
  )
  const filteredTimeline = useMemo(
    () => performanceTimeline(timelineWithVenueType, {
      orgId: orgFilter || undefined,
      venueId: venueFilter || undefined,
      venueType: venueTypeFilter || undefined,
      month: monthFilter || undefined,
    }),
    [timelineWithVenueType, orgFilter, venueFilter, venueTypeFilter, monthFilter],
  )

  const peakIndex = growth.findIndex((w) => w.peak)
  const orgOptions = [...new Set(performed.map((g) => g.orgId).filter(Boolean))]

  async function handleMarkPlayed(gig) {
    const setlist = setlists.find((s) => s.id === gig.setlistId) || setlists[0]
    if (!setlist || setlist.itemIds.length === 0) {
      setMarkError('Link a setlist with songs to this gig before marking it as played.')
      return
    }
    try {
      await completeGig(gig.id, {
        performedAt: new Date().toISOString(),
        items: setlist.itemIds.map((songId, position) => ({ songId, state: 'played', position })),
      })
      setMarkError('')
    } catch (err) {
      setMarkError(err.message || 'Could not record this performance.')
    }
  }

  const loading = songsLoading || setlistsLoading || gigsLoading

  return (
    <div>
      <h1 className="text-2xl font-bold text-cem-text">Analytics</h1>
      <p className="mt-1 text-sm text-cem-secondary">
        Repertoire and performance insight from your own library — scoped to what you can read.
      </p>
      <AnalyticsNav current="/analytics" />

      {loading ? (
        <p className="mt-6 text-sm text-cem-secondary">Loading analytics…</p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Songs" value={songs.length} />
            <Stat label="Setlists" value={setlists.length} />
            <Stat label="Performances" value={performed.length} />
            <Stat
              label="This month"
              value={performed.filter((g) => g.performedAt.slice(0, 7) === currentMonth).length}
              hint="gigs performed"
            />
          </div>

          <Card title="Most-used songs" subtitle="Times a song appears across your setlists">
            <BarChart
              ariaLabel="Ranking of songs by the number of setlists that use them"
              rows={used.map((row, i) => ({
                label: `${i === 0 ? '★ ' : ''}${bySongId.get(row.songId)?.title || row.songId}`,
                value: row.count,
              }))}
            />
          </Card>

          <Card title="Repertoire growth" subtitle="Songs added per week; cumulative total with the peak week highlighted">
            <LineChart
              ariaLabel="Weekly cumulative song count"
              points={growth.map((w) => ({ label: w.weekStart.slice(5), value: w.cumulative }))}
              peakIndex={peakIndex}
            />
          </Card>

          <NotTracked
            title="Practice analytics"
            detail="Practice sessions are not recorded by this build, so hours per instrument and month-over-month trends have no data source yet."
          />

          <Card
            title="Untouched songs"
            subtitle="Songs that have never appeared on a setlist"
            action={
              <div className="flex flex-wrap gap-2">
                <label className="text-xs text-cem-text">
                  Genre
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="any"
                    className="ml-1 w-24 rounded border border-cem-elevated bg-cem-base px-2 py-1 text-xs text-cem-text"
                  />
                </label>
                <label className="text-xs text-cem-text">
                  Added
                  <select
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="ml-1 rounded border border-cem-elevated bg-cem-base px-2 py-1 text-xs text-cem-text"
                  >
                    <option value="">any time</option>
                    <option value="6">more than 6 months ago</option>
                  </select>
                </label>
              </div>
            }
          >
            {untouched.length === 0 ? (
              <p className="mt-3 text-xs text-cem-secondary">No songs match these filters.</p>
            ) : (
              <ul className="mt-3 divide-y divide-cem-elevated">
                {untouched.map((song) => (
                  <li key={song.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <span className="text-cem-text">{song.title}</span>
                    <span className="text-cem-secondary">
                      {song.genre || 'Uncategorized'} · added {relativeTime(song.createdAt) || 'unknown'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Mark a gig as played" subtitle="Records one performance and its played songs from the linked setlist">
            {gigs.filter((g) => !g.performance).length === 0 ? (
              <p className="mt-3 text-xs text-cem-secondary">No upcoming gigs to mark.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {gigs.filter((g) => !g.performance).map((gig) => (
                  <li key={gig.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-cem-elevated px-3 py-2 text-xs">
                    <span className="text-cem-text">
                      {gig.name}
                      <span className="text-cem-secondary"> · {setlists.find((s) => s.id === gig.setlistId)?.name || 'no setlist linked'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMarkPlayed(gig)}
                      className="rounded-md bg-cem-amber px-2 py-1 text-xs font-medium text-cem-base hover:bg-cem-amber/90"
                    >
                      Mark as played
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {markError && <p className="mt-2 text-xs text-destructive">{markError}</p>}
          </Card>

          <Card
            title="Performance history"
            subtitle="Performed gigs, newest first, with date, venue, setlist and song count"
            action={
              <div className="flex flex-wrap gap-2">
                <select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}
                  aria-label="Filter by organization"
                  className="rounded border border-cem-elevated bg-cem-base px-2 py-1 text-xs text-cem-text">
                  <option value="">all orgs</option>
                  {orgOptions.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
                <select value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)}
                  aria-label="Filter by venue"
                  className="rounded border border-cem-elevated bg-cem-base px-2 py-1 text-xs text-cem-text">
                  <option value="">all venues</option>
                  {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <select value={venueTypeFilter} onChange={(e) => setVenueTypeFilter(e.target.value)}
                  aria-label="Filter by venue type"
                  className="rounded border border-cem-elevated bg-cem-base px-2 py-1 text-xs text-cem-text">
                  <option value="">all venue types</option>
                  {venueTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
                  aria-label="Filter by month"
                  className="rounded border border-cem-elevated bg-cem-base px-2 py-1 text-xs text-cem-text" />
              </div>
            }
          >
            {details === null ? (
              <p className="mt-3 text-xs text-cem-secondary">Loading performance details…</p>
            ) : filteredTimeline.length === 0 ? (
              <p className="mt-3 text-xs text-cem-secondary">No performances match these filters.</p>
            ) : (
              <ol className="mt-3 divide-y divide-cem-elevated">
                {filteredTimeline.map((gig) => (
                  <li key={gig.id} className="py-2 text-xs">
                    <p className="font-medium text-cem-text">
                      {gig.performedAt.slice(0, 10)} · {gig.name}
                    </p>
                    <p className="mt-0.5 text-cem-secondary">
                      {venueById.get(gig.venueId)?.name || 'No venue'} ·{' '}
                      {setlists.find((s) => s.id === gig.setlistId)?.name || 'No setlist'} ·{' '}
                      {gig.songCount} song{gig.songCount === 1 ? '' : 's'}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Song popularity" subtitle="Times each song was actually played across your performances">
            <BarChart
              ariaLabel="Songs ranked by how many performances played them"
              rows={played.map((row) => ({
                label: bySongId.get(row.songId)?.title || row.songId,
                value: row.count,
              }))}
            />
          </Card>

          <Card title="Duration trends" subtitle="Average setlist duration per month (months with no known duration stay empty)">
            <LineChart
              ariaLabel="Average setlist duration by month"
              points={months.map((m) => ({ label: m.month.slice(5), value: m.averageSeconds }))}
              formatValue={formatDuration}
            />
          </Card>

          <p className="mt-6 text-xs text-cem-secondary">
            Looking for org-wide or repertoire insight?{' '}
            <Link to="/analytics/organization" className="text-cem-text underline">Organization analytics</Link>
            {' · '}
            <Link to="/analytics/repertoire" className="text-cem-text underline">Repertoire insights</Link>
          </p>
        </>
      )}
    </div>
  )
}
