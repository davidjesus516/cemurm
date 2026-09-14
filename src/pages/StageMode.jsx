import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSetlists } from '../hooks/useSetlists.js'
import { useFootPedal } from '../hooks/useFootPedal.js'
import { parseChordPro } from '../lib/chordpro/parser.js'
import { transposeParsed, transposeKey } from '../lib/transpose.js'

const SWIPE_THRESHOLD = 48

export default function StageMode() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { setlists, loading } = useSetlists()

  const [index, setIndex] = useState(0)
  const [semitones, setSemitones] = useState(0)
  const touchStartRef = useRef(null)

  const setlist = setlists.find((s) => s.id === id)
  const songs = setlist?.songs ?? []

  const goTo = useCallback(
    (next) => {
      if (!songs.length) return
      setIndex(((next % songs.length) + songs.length) % songs.length)
    },
    [songs.length],
  )

  // Foot pedal: additional input, never a replacement for keys/swipe/buttons.
  // Hook is mounted only while Stage Mode is open — pedal never fires in the background.
  const { supported, connected, pairing, pair, error } = useFootPedal({
    onPrev: () => goTo(index - 1),
    onNext: () => goTo(index + 1),
  })

  // Keyboard: arrows / PgUp / PgDn navigate, +/- transpose, Esc exits.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goTo(index + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(index - 1)
      else if (e.key === '+') setSemitones((s) => s + 1)
      else if (e.key === '-') setSemitones((s) => s - 1)
      else if (e.key === 'Escape') navigate(`/setlists/${id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, index, id, navigate])

  // Touch: swipe left/right changes song.
  function onTouchStart(e) {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchEnd(e) {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return
    goTo(index + (dx < 0 ? 1 : -1))
  }

  const song = songs[index]

  const parsed = useMemo(() => (song?.body ? parseChordPro(song.body) : null), [song?.body])
  const transposed = useMemo(
    () => (parsed ? transposeParsed(parsed, semitones) : null),
    [parsed, semitones],
  )
  const displayKey = useMemo(() => {
    if (!parsed) return ''
    return semitones ? transposeKey(parsed.key, semitones) : parsed.key
  }, [parsed, semitones])

  if (loading) return <p className="text-sm text-cem-secondary">Loading setlist…</p>

  if (!setlist || !song) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cem-base">
        <div className="text-center">
          <p className="text-lg text-cem-text">No songs in this setlist.</p>
          <button
            type="button"
            onClick={() => navigate(`/setlists/${id}`)}
            className="mt-4 rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
          >
            ← Back to setlist
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-y-auto bg-black text-white"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header — song progress + exit */}
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(`/setlists/${id}`)}
          className="rounded border border-white/20 px-3 py-1 text-sm font-medium hover:bg-white/10"
          aria-label="Exit stage mode"
        >
          ✕ Exit
        </button>
        <div className="text-center">
          <p className="text-sm font-bold">{song.title || 'Untitled'}</p>
          <p className="text-xs text-white/60">
            {index + 1} / {songs.length}
            {displayKey && ` · Key ${displayKey}`}
            {semitones !== 0 && ` (${semitones > 0 ? '+' : ''}${semitones})`}
          </p>
        </div>
        {/* Chord/lyric size is fixed large; transpose controls live here */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSemitones((s) => s - 1)}
            className="rounded border border-white/20 px-3 py-1 text-lg font-bold hover:bg-white/10"
            aria-label="Transpose down"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setSemitones((s) => s + 1)}
            className="rounded border border-white/20 px-3 py-1 text-lg font-bold hover:bg-white/10"
            aria-label="Transpose up"
          >
            +
          </button>
        </div>
      </header>

      {/* Song — high contrast, large text */}
      {song?.body && transposed ? (
        <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-6">
          <div className="space-y-3 text-xl leading-relaxed md:text-2xl">
            {transposed.sections.map((section, i) => (
              <div key={i}>
                {section.type === 'section' && (
                  <h2 className="mb-1 text-lg font-bold uppercase tracking-wider text-white/70">
                    {section.lines[0]?.text}
                  </h2>
                )}
                {section.type === 'comment' && (
                  <p className="italic text-white/60">{section.lines.map((line) => line.text).join(' ')}</p>
                )}
                {section.type === 'lyrics' && (
                  <div className="space-y-1">
                    {section.lines.map((line, j) => {
                      const segments = [...line.chords]
                        .sort((a, b) => a.position - b.position)
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
                                    <span className="mb-0.5 text-lg font-bold text-cem-amber md:text-xl">
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
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-white/60">No chord chart for this song.</p>
        </div>
      )}

      {/* Footer — navigation buttons (touch-friendly) */}
      <footer className="flex items-center justify-between border-t border-white/10 px-4 py-4">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={songs.length <= 1}
          className="rounded-lg border border-white/20 px-6 py-3 text-lg font-medium hover:bg-white/10 disabled:opacity-40"
        >
          ← Prev
        </button>
        <div className="flex flex-col items-center gap-1">
          {!supported ? (
            <span className="text-xs text-white/40">No foot pedal (browser lacks HID)</span>
          ) : connected ? (
            <span className="text-sm text-white/50">🎛 Foot pedal</span>
          ) : (
            <>
              <button
                type="button"
                onClick={pair}
                disabled={pairing}
                className="rounded border border-white/20 px-3 py-1 text-sm hover:bg-white/10 disabled:opacity-50"
              >
                {pairing ? 'Pairing…' : '🎛 Pair foot pedal'}
              </button>
              {error && <span className="text-xs text-red-400">{error}</span>}
            </>
          )}
          <span className="text-sm text-white/60">Swipe or use ← → / PgUp PgDn</span>
        </div>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={songs.length <= 1}
          className="rounded-lg border border-white/20 px-6 py-3 text-lg font-medium hover:bg-white/10 disabled:opacity-40"
        >
          Next →
        </button>
      </footer>
    </div>
  )
}