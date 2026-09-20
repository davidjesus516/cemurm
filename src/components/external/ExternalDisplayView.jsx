/* eslint-disable react/prop-types */
// Shared clean audience-facing view for External Display (Hito 5 —
// features/external-display.feature). Rendered by BOTH the popup page
// (second screen) and the in-app preview when only one display exists.
// Deliberately chrome-free: title + lyrics (mode 'lyrics') or chords-only
// (mode 'chords'); no navigation, controls, or performer annotations.

export default function ExternalDisplayView({ state }) {
  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white/60">
        <p className="text-lg">Waiting for the primary device…</p>
      </div>
    )
  }

  const sections = state.sections || []
  const chordsOnly = state.mode === 'chords'

  return (
    <div className="min-h-screen bg-black px-10 py-8 text-white">
      <h1 className="mb-6 text-center text-5xl font-bold tracking-tight">
        {state.title || 'Untitled'}
      </h1>
      {state.key && (
        <p className="mb-6 text-center text-2xl text-white/70">Key {state.key}</p>
      )}

      {!sections.length ? (
        <p className="text-center text-2xl text-white/50">No chord chart for this song.</p>
      ) : (
        <div className="mx-auto max-w-4xl space-y-5 text-2xl leading-relaxed">
          {sections.map((section, i) => {
            if (section.type === 'section') {
              return (
                <h2
                  key={i}
                  className="pt-2 text-2xl font-bold uppercase tracking-widest text-white/70"
                >
                  {section.lines[0]?.text}
                </h2>
              )
            }
            if (section.type === 'comment') {
              return (
                <p key={i} className="italic text-white/60">
                  {section.lines.map((line) => line.text).join(' ')}
                </p>
              )
            }
            if (chordsOnly) {
              // Chords-only mode: one line per lyric line, only chord names.
              const chordNames = section.lines
                .map((line) =>
                  [...line.chords]
                    .sort((a, b) => a.position - b.position)
                    .map((ch) => ch.chord),
                )
                .filter((names) => names.length)
                .map((names) => names.join('  '))
              if (!chordNames.length) return null
              return (
                <p key={i} className="font-bold text-cem-amber">
                  {chordNames.join('\n')}
                </p>
              )
            }
            return (
              <div key={i} className="space-y-1">
                {section.lines.map((line, j) => {
                  const segments = [...line.chords].sort((a, b) => a.position - b.position)
                  return (
                    <div key={j} className="flex flex-wrap items-baseline whitespace-pre-wrap">
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
                                <span className="mb-0.5 text-2xl font-bold text-cem-amber">
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
        </div>
      )}
    </div>
  )
}