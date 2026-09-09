/* eslint-disable react/prop-types */

// Build render segments from a parsed lyric line: each chord anchors the text
// that follows it (up to the next chord), so the chord renders above its lyric.
function toSegments({ text, chords }) {
  const sorted = [...chords].sort((a, b) => a.position - b.position)
  if (!sorted.length) return text ? [{ chord: null, text }] : []

  const segments = []
  if (sorted[0].position > 0) {
    segments.push({ chord: null, text: text.slice(0, sorted[0].position) })
  }
  for (let i = 0; i < sorted.length; i++) {
    const end = sorted[i + 1]?.position ?? text.length
    segments.push({ chord: sorted[i].chord, text: text.slice(sorted[i].position, end) })
  }
  return segments
}

function LyricLine({ line }) {
  const segments = toSegments(line)
  if (!segments.length) return <div className="h-3" />

  return (
    <div className="flex flex-wrap items-baseline whitespace-pre-wrap">
      {segments.map((segment, i) => (
        <span key={i} className="inline-flex flex-col items-start">
          {segment.chord && (
            <span className="mb-0.5 text-sm font-bold text-cem-amber">{segment.chord}</span>
          )}
          {segment.text && <span className="text-cem-text">{segment.text}</span>}
        </span>
      ))}
    </div>
  )
}

export default function ChordProRenderer({ parsed }) {
  const { title, artist, key, sections = [] } = parsed

  return (
    <div className="rounded-lg border border-cem-elevated bg-cem-surface p-6 shadow-sm">
      {title && <h2 className="text-xl font-bold text-cem-text">{title}</h2>}
      {(artist || key) && (
        <p className="mt-1 text-sm text-cem-secondary">
          {[artist, key && `Key: ${key}`].filter(Boolean).join(' · ')}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {sections.map((section, i) => (
          <div key={i}>
            {section.type === 'section' && (
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-cem-secondary">
                {section.lines[0]?.text}
              </h3>
            )}
            {section.type === 'comment' && (
              <p className="italic text-cem-secondary">{section.lines.map((line) => line.text).join(' ')}</p>
            )}
            {section.type === 'lyrics' && (
              <div className="space-y-0.5">
                {section.lines.map((line, j) => <LyricLine key={j} line={line} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}