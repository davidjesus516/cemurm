/* eslint-disable react/prop-types */
// Chrome-free audience view for the OBS overlay (Hito 5 #66). Rendered by the
// public /overlay/:token page as it polls overlay_state(). This is a
// STREAMING surface, not the stage: big title, small key, compact N / M
// position chip and (on operator override) the chord chart. NEVER renders
// performer annotations — sections of type 'comment' are skipped entirely
// (the OBS spec: personal annotations never leak to the stream, unlike the
// external display which italicizes them).

import { useMemo } from 'react'
import { parseChordPro } from '../../../domain/chart/parser.js'

export default function OverlayView({ state }) {
  // Hooks first (rules-of-hooks): re-parse only when the chart body actually
  // changes (polls every 2 s); null-safe for the first/inactive render.
  const parsed = useMemo(() => (state?.body ? parseChordPro(state.body) : null), [state?.body])

  // Not active (or unknown session / transient fetch failure): dark screen,
  // subtle note, ZERO song data — nothing to leak mid-stream.
  if (!state || state.active !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cem-stage-bg">
        <p className="text-cem-stage-lyric/50">Overlay inactive</p>
      </div>
    )
  }

  const chordsMode = state.mode === 'chords'
  const sections = parsed?.sections ?? []
  const songTotal = Number(state.song_total)

  return (
    <div className="flex min-h-screen flex-col bg-cem-stage-bg px-10 py-10 text-cem-stage-lyric" data-testid="overlay-container">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-5xl font-bold tracking-tight" data-testid="overlay-title">{state.title || 'Untitled'}</h1>
        {state.key && <p className="text-2xl text-cem-stage-lyric/70" data-testid="overlay-key">Key {state.key}</p>}
        {songTotal > 0 && (
          <span className="rounded-full border border-cem-stage-lyric/20 bg-cem-stage-lyric/10 px-3 py-1 text-base font-semibold text-cem-stage-lyric/80" data-testid="overlay-song-progress">
            {Number(state.song_index) + 1} / {state.song_total}
          </span>
        )}
      </header>

      {chordsMode &&
        (!sections.length ? (
          <p className="mt-10 text-center text-2xl text-cem-stage-lyric/60">No chord chart for this song.</p>
        ) : (
          <main className="mx-auto mt-10 w-full max-w-4xl flex-1 space-y-5 pb-10 text-3xl leading-relaxed" data-testid="overlay-chords">
            {sections.map((section, i) => {
              if (section.type === 'section') {
                return (
                  <h2
                    key={i}
                    className="pt-2 text-2xl font-bold uppercase tracking-widest text-cem-stage-lyric/70"
                    data-testid="overlay-section-header"
                  >
                    {section.lines[0]?.text}
                  </h2>
                )
              }
              if (section.type === 'comment') {
                // Performer annotations never reach the stream.
                return null
              }
              return (
                <div key={i} className="space-y-1">
                  {section.lines.map((line, j) => {
                    const segments = [...line.chords].sort((a, b) => a.position - b.position)
                    return (
                      <div key={j} className="flex flex-wrap items-baseline whitespace-pre-wrap" data-testid="overlay-lyric-line">
                        {!segments.length && line.text && <span>{line.text}</span>}
                        {segments.length > 0 && (
                          <>
                            {segments[0].position > 0 && (
                              <span>{line.text.slice(0, segments[0].position)}</span>
                            )}
                            {segments.map((ch, k) => {
                              const end = segments[k + 1]?.position ?? line.text.length
                              return (
                                <span key={k} className="inline-flex flex-col items-start">
                                  <span className="mb-0.5 text-3xl font-bold text-cem-amber" data-testid="overlay-chord-span">
                                    {ch.chord}
                                  </span>
                                  <span>{line.text.slice(ch.position, end)}</span>
                                </span>
                              )
                            })}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </main>
        ))}
    </div>
  )
}