/* eslint-disable react/prop-types */
// Shared clean congregation-facing slide (Hito 5 — features/congregation-projection.feature).
// Rendered by BOTH the operator preview and the projection/display popup.
// Deliberately sheet-free: song covers, plain lyric lines, scripture and
// announcements. NEVER renders chords, keys, section keys, or annotations —
// the only song content on screen is the plain lyric text.

const coverLine = 'text-cem-text font-semibold'
const subLine = 'text-cem-secondary'

export default function SlideView({ slide, settings }) {
  const scale = settings?.fontScale ?? 1
  const contrast = settings?.highContrast ? 'bg-cem-base text-white' : ''

  if (!slide) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-8 ${contrast}`}>
        <p className="text-lg text-cem-secondary">Projection ready — waiting for the operator.</p>
      </div>
    )
  }

  if (slide.kind === 'blocked') {
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center gap-2 p-8 ${contrast}`}>
        <span className={coverLine}>🚫 {slide.title || 'This song'}</span>
        <span className="text-sm text-cem-rose">{slide.reason}</span>
      </div>
    )
  }

  if (slide.kind === 'song-title') {
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center gap-3 p-8 ${contrast}`}>
        <span className="text-5xl font-semibold text-cem-text">{slide.title}</span>
        {slide.artist ? <span className={subLine}>{slide.artist}</span> : null}
        {slide.key ? (
          <span className="rounded bg-cem-elevated px-2 py-0.5 text-sm text-cem-secondary">
            Key {slide.key}
          </span>
        ) : null}
      </div>
    )
  }

  if (slide.kind === 'lyrics' || slide.kind === 'scripture' || slide.kind === 'announcement') {
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center p-8 ${contrast}`}>
        {slide.label ? (
          <span className="mb-6 text-sm font-medium uppercase tracking-widest text-cem-secondary">
            {slide.label}
          </span>
        ) : null}
        <div
          className="max-w-4xl space-y-3 text-center text-cem-text"
          style={{ fontSize: `${2.25 * scale}rem`, lineHeight: 1.35 }}
        >
          {slide.lines?.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>
    )
  }

  return null
}