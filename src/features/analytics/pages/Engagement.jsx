// Export/share + offline engagement analytics (S3 / T8). Tier 2: no material,
// no decorative shadow. Export history, audience scan counts, daily activity
// and session duration have no backing table/key in this build; each is shown
// as an explicit absence card. Only the two locally readable counters are
// computed, through the tested offlineSnapshot helper.
import { useEffect, useState } from 'react'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import { getPendingWriteCount } from '../../../data/repositories/analytics.js'
import { useSongs } from '../../../hooks/shared/useSongs.js'
import { offlineSnapshot } from '../../../domain/analytics/engagementAnalytics.js'
import AnalyticsNav from '../components/AnalyticsNav.jsx'
import { Card, NotTracked, Stat } from '../components/ui.jsx'

export default function Engagement() {
  const { user } = useAuth()
  const { songs } = useSongs()
  const [pendingWrites, setPendingWrites] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!user?.id) {
      setPendingWrites(0)
      return undefined
    }
    getPendingWriteCount(user.id)
      .then((n) => { if (!cancelled) setPendingWrites(n) })
      .catch(() => { if (!cancelled) setPendingWrites(0) })
    return () => { cancelled = true }
  }, [user?.id])

  const offline = offlineSnapshot({
    pendingWrites: pendingWrites ?? 0,
    songsInLibrary: songs.length,
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-cem-text">Export & engagement</h1>
      <p className="mt-1 text-sm text-cem-secondary">
        Sharing, offline and usage insight — with gaps stated plainly.
      </p>
      <AnalyticsNav current="/analytics/engagement" />

      <NotTracked
        title="Export analytics"
        detail="Export format counts and most-exported setlists have no export-history record in this build, so PDF/ChordPro/ABC totals cannot be shown honestly."
      />
      <NotTracked
        title="Audience insights"
        detail="Audience links exist, but views are not counted and no geographic column exists. Total scans, top-scanned setlist and scan location are therefore unavailable."
      />

      <Card title="Offline usage" subtitle="Locally readable counters only">
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="Pending offline writes" value={offline.pendingWrites} />
          <Stat label="Songs in library" value={offline.songsInLibrary} hint="available offline after a first open" />
        </div>
        <p className="mt-3 text-xs text-cem-secondary">
          Offline session count and offline duration are not recorded, so the share of usage during gigs cannot be computed.
        </p>
      </Card>

      <NotTracked
        title="Daily usage pattern"
        detail="A daily activity heatmap needs per-day interaction timestamps, which this build does not collect."
      />
      <NotTracked
        title="Session duration trends"
        detail="Average session duration per day and week-over-week comparisons need a session-length record; none exists yet."
      />
    </div>
  )
}
