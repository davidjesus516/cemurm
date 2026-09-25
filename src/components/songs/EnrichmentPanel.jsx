/* eslint-disable react/prop-types */
// Spotify enrichment surface (Hito 5 #69): trigger button, preview card with
// Apply/Discard, equal-spelling key-conflict note, and the applied provenance
// strip. Rendered in SongDetail below the edit/save area, above the comments.
//
// States come from useSpotifyEnrichment (idle | searching | suggested |
// applying | applied | discarded | noMatch | offline | error). Nothing is
// written on noMatch (scenario 2); Discard flips rows without touching the
// song (scenario 3); Apply persists BPM + album art with spotify provenance
// and keeps the suggested key a suggestion (scenarios 4–5).

import { useEffect, useState } from 'react'
import { canonicalKeyLabel } from '../../lib/spotify.js'

/** Album-art thumbnail with a placeholder fallback — mock/dev URLs never load
 * (onError → placeholder) and applied art lives on the version row, so this
 * renders offline with zero external fetches. */
function AlbumArt({ url, className = 'h-14 w-14' }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [url])
  if (!url || broken) {
    return (
      <div className={`${className} flex shrink-0 items-center justify-center rounded-md bg-cem-elevated text-base text-cem-secondary`} aria-hidden="true">
        ♪
      </div>
    )
  }
  return (
    <img
      src={url}
      alt="Album art"
      className={`${className} shrink-0 rounded-md object-cover`}
      onError={() => setBroken(true)}
    />
  )
}

function enrichmentLabel(row) {
  if (row.field === 'bpm') return `BPM ${row.value?.bpm ?? ''}`
  if (row.field === 'key') return `Key suggestion ${row.value?.key ?? ''}`
  if (row.field === 'album_art') return 'Album art'
  return row.field
}

export default function EnrichmentPanel({ song, enrichment, declaredKey }) {
  const {
    state,
    errorMessage,
    match,
    rows,
    connection,
    online,
    suggestionKey,
    lookup,
    apply,
    discard,
  } = enrichment

  const revoked = connection?.status === 'revoked'
  const missingArtist = !(song?.artist || '').trim()

  // Equal-spelling conflict check (scenario 6): compare the CANONICAL forms
  // ('E' ≡ 'E major', 'Em' ≡ 'E Natural Minor') and warn when the Spotify
  // suggestion differs from the chart's declared key — a suggestion never
  // overwrites base_key.
  const [keyConflict, setKeyConflict] = useState('')
  useEffect(() => {
    let cancelled = false
    if (!suggestionKey || !declaredKey) {
      setKeyConflict('')
      return undefined
    }
    Promise.all([canonicalKeyLabel(declaredKey), canonicalKeyLabel(suggestionKey)])
      .then(([declared, suggested]) => {
        if (cancelled) return
        if (declared.canonical && suggested.canonical && declared.canonical !== suggested.canonical) {
          setKeyConflict(
            `Suggestion differs from declared key — applied as suggestion only (Spotify suggests ${suggested.canonical}; chart declares ${declared.canonical}).`,
          )
        } else {
          setKeyConflict('')
        }
      })
      .catch(() => { if (!cancelled) setKeyConflict('') })
    return () => { cancelled = true }
  }, [suggestionKey, declaredKey])

  const triggerDisabled =
    missingArtist || !online || revoked || state === 'searching'
    || state === 'applying' || state === 'suggested'
  const triggerTitle = missingArtist
    ? 'Add an artist first'
    : !online
      ? 'Offline — saved metadata stays available; new suggestions need a connection'
      : revoked
        ? 'Spotify integration is revoked — reconnect in Settings'
        : ''

  return (
    <section className="mt-6 rounded-lg border border-cem-elevated bg-cem-surface p-4" aria-label="Spotify enrichment">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-cem-text">Spotify enrichment</h2>
        {state === 'applied' && (
          <span className="rounded bg-cem-emerald/10 px-2 py-0.5 text-xs font-medium text-cem-emerald">Applied</span>
        )}
        {state === 'discarded' && (
          <span className="rounded bg-cem-elevated px-2 py-0.5 text-xs font-medium text-cem-secondary">Discarded</span>
        )}
      </div>

      <div className="mt-3">
        {missingArtist ? (
          <p className="text-sm text-cem-secondary">
            Add an artist first — Spotify needs title + artist to find a match.
          </p>
        ) : (
          <button
            type="button"
            onClick={lookup}
            disabled={triggerDisabled}
            title={triggerTitle}
            className="rounded-md bg-cem-amber px-3 py-1.5 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
          >
            {state === 'searching' ? 'Looking up…' : 'Enrich from Spotify'}
          </button>
        )}
        {!online && !missingArtist && (
          <p className="mt-2 text-xs text-cem-secondary">
            Offline — saved metadata stays available; new suggestions need a connection.
          </p>
        )}
        {revoked && state !== 'suggested' && (
          <p className="mt-2 text-xs text-cem-rose">
            Spotify integration is revoked — reconnect in Settings to enrich again.
          </p>
        )}
      </div>

      {state === 'searching' && (
        <p className="mt-3 text-sm text-cem-secondary">Looking up on Spotify…</p>
      )}

      {state === 'noMatch' && (
        <div className="mt-3 rounded-md border border-cem-amber/30 bg-cem-amber/10 px-3 py-2" role="status">
          <p className="text-sm text-cem-amber">No confident match — refine title or artist.</p>
          <p className="mt-0.5 text-xs text-cem-secondary">Nothing was written to this song.</p>
        </div>
      )}

      {(state === 'suggested' || state === 'applying') && match && (
        <div className="mt-3 rounded-md border border-cem-amber/30 bg-cem-amber/10 p-3">
          <div className="flex items-start gap-3">
            <AlbumArt url={match.albumArtUrl} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-cem-text">{match.name}</p>
              <p className="text-xs text-cem-secondary">{match.artist}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {typeof match.bpm === 'number' && (
                  <span className="text-xs font-medium text-cem-text">BPM {match.bpm}</span>
                )}
                {suggestionKey && (
                  <span className="rounded bg-cem-elevated px-1.5 py-0.5 text-xs font-medium text-cem-text">
                    {suggestionKey}
                  </span>
                )}
              </div>
            </div>
          </div>
          {keyConflict && (
            <p className="mt-2 text-xs text-cem-amber">{keyConflict}</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={state === 'applying'}
              className="rounded-md bg-cem-amber px-3 py-1.5 text-xs font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
            >
              {state === 'applying' ? 'Applying…' : 'Apply'}
            </button>
            <button
              type="button"
              onClick={discard}
              disabled={state === 'applying'}
              className="rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {state === 'offline' && (
        <p className="mt-3 text-xs text-cem-secondary">
          Offline — enrichment needs a connection. Saved metadata stays available.
        </p>
      )}

      {state === 'error' && (
        <div className="mt-3 space-y-2">
          <p className="rounded-md bg-cem-elevated px-3 py-2 text-xs text-cem-secondary" role="alert">
            {errorMessage === 'integration revoked'
              ? 'Spotify integration is revoked — reconnect in Settings to enrich again.'
              : 'Spotify enrichment is unavailable right now. Try again later.'}
          </p>
          <button
            type="button"
            onClick={lookup}
            className="text-xs font-medium text-cem-amber hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {state === 'applied' && (
        <div className="mt-3 flex items-start gap-3">
          <AlbumArt url={song?.metadata?.album_art?.url} className="h-12 w-12" />
          <div className="min-w-0 space-y-1.5">
            {rows.map((row) => (
              <p key={row.id} className="text-xs text-cem-text">
                {enrichmentLabel(row)}
                {' · '}
                <span className="font-medium text-cem-emerald">Auto-filled from Spotify</span>
              </p>
            ))}
            {rows.some((row) => row.field === 'key') && (
              <p className="text-xs text-cem-secondary">
                Suggested key stays a suggestion — declared key unchanged.
              </p>
            )}
            <button
              type="button"
              onClick={lookup}
              className="mt-1 text-xs font-medium text-cem-amber hover:underline"
            >
              Enrich again
            </button>
          </div>
        </div>
      )}

      {state === 'discarded' && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-cem-secondary">Suggestion discarded — song untouched.</p>
          <button
            type="button"
            onClick={lookup}
            className="text-xs font-medium text-cem-amber hover:underline"
          >
            Enrich again
          </button>
        </div>
      )}
    </section>
  )
}