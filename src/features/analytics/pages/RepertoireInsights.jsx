// Repertoire insights (S3 / T7). Tier 2: no material, no decorative shadow.
// Genre/key/trending/recent are aggregated from the signed-in user's visible
// songs; "trending across the org" is labelled with that scope rather than
// claiming coverage the RLS-scoped read cannot prove. Instrument coverage has
// no song-to-instrument mapping in this schema and says so.
import { useMemo } from 'react'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import { useSongs } from '../../../hooks/shared/useSongs.js'
import { relativeTime } from '../../../domain/library/relativeTime.js'
import {
  distributionBy,
  recentAdditions,
  trendingSongs,
} from '../../../domain/analytics/repertoireInsights.js'
import AnalyticsNav from '../components/AnalyticsNav.jsx'
import { BarChart, Card, DonutChart, NotTracked, Stat } from '../components/ui.jsx'

export default function RepertoireInsights() {
  const { songs, loading } = useSongs()
  const { user } = useAuth()

  const genre = useMemo(() => distributionBy(songs.map((s) => s.genre)), [songs])
  const keys = useMemo(() => distributionBy(songs.map((s) => s.key)), [songs])
  const recent = useMemo(() => recentAdditions(songs, 10), [songs])
  const trending = useMemo(() => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    return trendingSongs(songs, { since, limit: 10 })
  }, [songs])

  return (
    <div>
      <h1 className="text-2xl font-bold text-cem-text">Repertoire insights</h1>
      <p className="mt-1 text-sm text-cem-secondary">
        Patterns in the songs visible to this account.
      </p>
      <AnalyticsNav current="/analytics/repertoire" />

      {loading ? (
        <p className="mt-6 text-sm text-cem-secondary">Loading repertoire…</p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="Songs" value={songs.length} />
            <Stat label="Genres" value={genre.length} />
            <Stat label="Keys" value={keys.length} />
          </div>

          <Card title="Repertoire by genre" subtitle="Share of songs carrying each genre tag">
            <DonutChart ariaLabel="Genre distribution" rows={genre} />
          </Card>

          <Card title="Key distribution" subtitle="Most-used keys in the visible library">
            <BarChart
              ariaLabel="Song count by musical key"
              rows={keys.map((k) => ({ label: k.label, value: k.count }))}
              formatValue={(n) => String(n)}
            />
          </Card>

          <Card title="Trending songs" subtitle="Most-added titles in the last 30 days, with the branches that added them">
            {trending.length === 0 ? (
              <p className="mt-3 text-xs text-cem-secondary">No songs were added in the last 30 days.</p>
            ) : (
              <ul className="mt-3 divide-y divide-cem-elevated">
                {trending.map((row) => (
                  <li key={`${row.songId}-${row.title}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <span className="text-cem-text">{row.title}</span>
                    <span className="text-cem-secondary">
                      {row.count} added · {row.branches.join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <NotTracked
            title="Instrument coverage"
            detail="Songs are not tagged with an instrument, so a coverage chart and 'weakest instrument' suggestion have no data source. Your profile instrument is a person attribute, not repertoire metadata."
          />

          <Card title="Recent additions" subtitle="The 10 most recently added visible songs, newest first">
            {recent.length === 0 ? (
              <p className="mt-3 text-xs text-cem-secondary">No songs in the library yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-cem-elevated">
                {recent.map((song) => (
                  <li key={song.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <span className="text-cem-text">{song.title}</span>
                    <span className="text-cem-secondary">
                      {song.userId === user?.id ? 'Added by you' : 'Added by a bandmate'} ·{' '}
                      {relativeTime(song.createdAt) || 'unknown date'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
