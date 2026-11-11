// Public audience view (Hito 6 N3, T3): /audience/:token
//
// features/export-and-sharing.feature:133-152. NO auth guard: the link is a
// capability and the token IS the authorization (0048). `get_audience_setlist`
// is SECURITY DEFINER and returns exactly position/title/artist/durationSeconds
// — the chord body, the agreed key, the item notes and the collaborators are
// not in the payload at all, so "no chord charts, rehearsal notes or editor
// controls" is a property of the data, not of this component's markup.
//
// Tier 2 (visual system): a list read at arm's length on a phone, no material,
// no decorative shadow, tighter radius.
//
// A NULL payload is the honest dead-link state: unknown, malformed, expired and
// revoked tokens are indistinguishable by design, so the copy must not guess.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { buildAudienceTimeline, formatOffset } from '../../../domain/setlist/audienceTimeline.js'
import { getAudienceSetlist } from '../../../data/repositories/audienceView.js'

export default function AudienceView() {
  const { token } = useParams()
  const [status, setStatus] = useState('loading')
  const [setlist, setSetlist] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await getAudienceSetlist(token)
        if (cancelled) return
        setSetlist(data)
        setStatus(data ? 'ready' : 'dead')
      } catch {
        if (!cancelled) setStatus('unreachable')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [token])

  if (status === 'loading') {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <p className="text-sm text-cem-secondary">Loading the setlist…</p>
      </main>
    )
  }

  if (status === 'dead' || status === 'unreachable') {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold text-cem-text">This link is not available</h1>
        <p className="mt-2 text-sm text-cem-secondary">
          {status === 'dead'
            ? 'The link may have expired, or the organizer may have turned it off. Ask them for a new one.'
            : 'You appear to be offline and this setlist is not saved on this device yet. Open the link once while online.'}
        </p>
      </main>
    )
  }

  const { rows, totalSeconds, exact } = buildAudienceTimeline(setlist?.songs)
  const name = String(setlist?.name || 'Setlist')

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold text-cem-text">{name}</h1>
        <p className="mt-1 text-sm text-cem-secondary">
          {rows.length === 0
            ? 'No songs in this setlist.'
            : `${rows.length} ${rows.length === 1 ? 'song' : 'songs'}${exact ? ` · about ${formatOffset(totalSeconds)}` : ''}`}
        </p>
      </header>

      {rows.length > 0 && (
        <ol className="mt-6 divide-y divide-cem-elevated overflow-hidden rounded-lg border border-cem-elevated bg-cem-surface">
          {rows.map((row, index) => (
            <li key={`${row.position}-${index}`} className="flex items-baseline gap-3 px-4 py-3">
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-cem-secondary">
                {row.position}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-cem-text">
                  {row.title || 'Untitled song'}
                </span>
                {row.artist && (
                  <span className="block truncate text-xs text-cem-secondary">{row.artist}</span>
                )}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-cem-secondary">
                {row.exact ? formatOffset(row.startSeconds) : '—'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
