import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSetlists } from '../hooks/useSetlists.js'
import { useFootPedal } from '../hooks/useFootPedal.js'
import { useGigs } from '../hooks/useGigs.js'
import { useSongs } from '../hooks/useSongs.js'
import { usePreferences } from '../hooks/usePreferences.js'
import { parseChordPro } from '../lib/chordpro/parser.js'
import { initialSemitones, transposeParsed, transposeKey } from '../lib/transpose.js'
import ExternalDisplayView from '../components/external/ExternalDisplayView.jsx'
import {
  DISPLAY_URL,
  clearActive,
  createChannel,
  hasSecondScreen,
  loadSettings,
  markActive,
  persistSettings,
  postClose,
  postState,
  saveLastState,
  wasActive,
} from '../lib/externalDisplay.js'

const SWIPE_THRESHOLD = 48
const HEARTBEAT_STALE_MS = 8000
const DISPLAY_POLL_MS = 3000
const RECONNECT_POLL_MS = 5000

export default function StageMode() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { setlists, loading } = useSetlists()
  const { gigs: allGigs, completeGig } = useGigs()
  const { songs: repertoire } = useSongs()
  const { prefs } = usePreferences()

  const [index, setIndex] = useState(0)
  const [semitones, setSemitones] = useState(0)
  const touchStartRef = useRef(null)
  // Post-show completion (PR#1c): mark each setlist song played/skipped,
  // add encores (off_setlist), then completeGig writes the single
  // performance record the gig owns (spec post-show scenario).
  const [finishing, setFinishing] = useState(false)
  const [states, setStates] = useState({})
  const [encores, setEncores] = useState([])
  const [encoreId, setEncoreId] = useState('')
  const [gigId, setGigId] = useState('')
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState('')
  // External display (Hito 5 — features/external-display.feature)
  const [settings, setSettings] = useState(() => loadSettings(id))
  const [display, setDisplay] = useState('off') // off | popup | preview | disconnected
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false)
  const [reconnectOffer, setReconnectOffer] = useState(false)
  const [restartPrompt, setRestartPrompt] = useState(false)
  const popupRef = useRef(null)
  const channelRef = useRef(null)
  const lastHeartbeatRef = useRef(0)

  const setlist = setlists.find((s) => s.id === id)
  const songs = setlist?.songs ?? []
  // Only open gigs (planned/confirmed) can be completed from the stage;
  // a setlist may serve several, so the panel offers a picker when >1.
  const openGigs = allGigs.filter(
    (g) => g.setlistId === id && (g.status === 'planned' || g.status === 'confirmed'),
  )
  const encoreOptions = repertoire.filter(
    (s) => !songs.some((x) => x.id === s.id) && !encores.includes(s.id),
  )

  function startFinish() {
    setStates(Object.fromEntries(songs.map((s) => [s.id, 'played'])))
    setEncores([])
    setEncoreId('')
    setGigId(openGigs[0]?.id ?? '')
    setCompleteError('')
    setFinishing(true)
  }

  function addEncore() {
    if (!encoreId || encores.includes(encoreId)) return
    setEncores((prev) => [...prev, encoreId])
    setEncoreId('')
  }

  async function handleComplete(e) {
    e.preventDefault()
    if (!gigId) return
    setCompleting(true)
    setCompleteError('')
    try {
      const items = [
        ...songs.map((s, i) => ({ songId: s.id, state: states[s.id] || 'played', position: i + 1 })),
        ...encores.map((songId, i) => ({ songId, state: 'off_setlist', position: songs.length + i + 1 })),
      ]
      await completeGig(gigId, { performedAt: new Date(), items })
      navigate(`/gigs/${gigId}`)
    } catch (err) {
      setCompleteError(err.message)
    } finally {
      setCompleting(false)
    }
  }

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

  // Keyboard: arrows / PgUp / PgDn navigate, +/- transpose, Esc exits
  // (or closes the finish panel first).
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goTo(index + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(index - 1)
      else if (e.key === '+') setSemitones((s) => s + 1)
      else if (e.key === '-') setSemitones((s) => s - 1)
      else if (e.key === 'Escape') {
        if (finishing) setFinishing(false)
        else navigate(`/setlists/${id}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, index, id, navigate, finishing])

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

  // D7: initial semitones = global transpose offset + this song's override —
  // re-seeded when the current song (or its prefs) change; manual +/- stays put.
  const baseline = song ? initialSemitones(prefs.transpose, prefs.overrides[song.id]) : 0
  useEffect(() => {
    setSemitones(baseline)
  }, [baseline])

  const parsed = useMemo(() => (song?.body ? parseChordPro(song.body) : null), [song?.body])
  const transposed = useMemo(
    () => (parsed ? transposeParsed(parsed, semitones) : null),
    [parsed, semitones],
  )
  const displayKey = useMemo(() => {
    if (!parsed) return ''
    return semitones ? transposeKey(parsed.key, semitones) : parsed.key
  }, [parsed, semitones])

  // Clean state sent to the external display: the transposed chart only —
  // canonical chart on disk never mutates (scenario: personal transpose).
  const displayState = useMemo(
    () =>
      song
        ? {
            songId: song.id,
            title: song.title,
            sections: transposed?.sections ?? [],
            key: displayKey,
            mode: settings.mode,
          }
        : null,
    [song, transposed, displayKey, settings.mode],
  )

  // Channel lifecycle (single instance per StageMode mount).
  useEffect(() => {
    const channel = createChannel()
    channelRef.current = channel
    const onMessage = (event) => {
      const msg = event.data || {}
      if (msg.kind === 'heartbeat') lastHeartbeatRef.current = msg.ts
      else if (msg.kind === 'close') {
        lastHeartbeatRef.current = 0
        setDisplay((d) => (d === 'popup' ? 'disconnected' : d))
      }
    }
    channel?.addEventListener('message', onMessage)
    return () => {
      channel?.removeEventListener('message', onMessage)
      channel?.close()
      channelRef.current = null
    }
  }, [])

  // Push every song/transpose/mode change + persist for restart recovery.
  useEffect(() => {
    if (display !== 'popup' || !displayState) return
    postState(channelRef.current, displayState)
    saveLastState(id, displayState)
  }, [display, displayState, id])

  // Popup liveness: heartbeats stop → show disconnected, offer re-open.
  useEffect(() => {
    if (display !== 'popup') return
    const timer = window.setInterval(() => {
      if (Date.now() - lastHeartbeatRef.current > HEARTBEAT_STALE_MS) {
        setDisplay('disconnected')
        setReconnectOffer(hasSecondScreen())
      }
    }, DISPLAY_POLL_MS)
    return () => window.clearInterval(timer)
  }, [display])

  // Reconnect offer: poll screen.isExtended while disconnected.
  useEffect(() => {
    if (display !== 'disconnected') {
      setReconnectOffer(false)
      return
    }
    const timer = window.setInterval(() => {
      if (hasSecondScreen()) {
        setReconnectOffer(true)
        window.clearInterval(timer)
      }
    }, RECONNECT_POLL_MS)
    return () => window.clearInterval(timer)
  }, [display])

  // Restart recovery: a previous stage session had the display active.
  useEffect(() => {
    if (wasActive(id)) setRestartPrompt(true)
  }, [id])

  function doOpenDisplay() {
    if (!hasSecondScreen()) {
      setDisplay('preview')
      setDisplayMenuOpen(false)
      return
    }
    const popup = window.open(
      `${DISPLAY_URL}?setlist=${encodeURIComponent(id)}`,
      'cemurm-ed',
      'popup=yes,width=980,height=640',
    )
    popupRef.current = popup
    markActive(id)
    lastHeartbeatRef.current = Date.now()
    setDisplay('popup')
    setDisplayMenuOpen(false)
  }

  function doCloseDisplay() {
    postClose(channelRef.current)
    try {
      popupRef.current?.close()
    } catch {
      // popup may already be gone
    }
    popupRef.current = null
    clearActive(id)
    setDisplay('off')
    setReconnectOffer(false)
    setDisplayMenuOpen(false)
  }

  function doSetMode(mode) {
    setSettings({ mode })
    persistSettings(id, { mode })
  }

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/setlists/${id}`)}
            className="rounded border border-white/20 px-3 py-1 text-sm font-medium hover:bg-white/10"
            aria-label="Exit stage mode"
          >
            ✕ Exit
          </button>
          <button
            type="button"
            onClick={startFinish}
            disabled={!openGigs.length}
            className="rounded border border-cem-amber/40 px-3 py-1 text-sm font-medium text-cem-amber hover:bg-cem-amber/10 disabled:opacity-40"
            aria-label="Finish gig and record what was played"
          >
            ✓ Finish gig
          </button>
        </div>
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
          <div className="relative ml-2">
            <button
              type="button"
              onClick={() => setDisplayMenuOpen((v) => !v)}
              className={`rounded border px-3 py-1 text-sm font-medium hover:bg-white/10 ${
                display === 'popup' ? 'border-cem-amber/50 text-cem-amber' : 'border-white/20'
              }`}
              aria-label="Display output menu"
            >
              🖥 Display
            </button>
            {displayMenuOpen && (
              <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-lg border border-white/10 bg-cem-surface p-3 text-cem-text shadow-xl">
                <p className="text-sm font-semibold text-white">External display</p>
                <p className="mt-1 text-xs text-cem-secondary">
                  {display === 'popup' && 'Active on the second screen.'}
                  {display === 'preview' && 'External display preview — only one display detected.'}
                  {display === 'disconnected' &&
                    (reconnectOffer
                      ? 'Disconnected — second screen detected, you can re-open it.'
                      : 'Disconnected — will offer re-open when the second screen is detected.')}
                  {display === 'off' && 'Off. Mirror a clean view to a second screen or preview.'}
                </p>

                <div className="mt-3">
                  <p className="text-xs font-medium text-cem-secondary">Display mode</p>
                  <div className="mt-1 flex gap-1">
                    {['lyrics', 'chords'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => doSetMode(mode)}
                        className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${
                          settings.mode === mode
                            ? 'bg-cem-amber text-cem-base'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  {display === 'off' && (
                    <button
                      type="button"
                      onClick={doOpenDisplay}
                      className="flex-1 rounded bg-cem-amber px-3 py-1.5 text-sm font-semibold text-cem-base"
                    >
                      Open external display
                    </button>
                  )}
                  {display === 'popup' && (
                    <button
                      type="button"
                      onClick={doCloseDisplay}
                      className="flex-1 rounded border border-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/10"
                    >
                      Close external display
                    </button>
                  )}
                  {display === 'disconnected' && reconnectOffer && (
                    <button
                      type="button"
                      onClick={doOpenDisplay}
                      className="flex-1 rounded bg-cem-amber px-3 py-1.5 text-sm font-semibold text-cem-base"
                    >
                      Re-open external display
                    </button>
                  )}
                  {display === 'preview' && (
                    <button
                      type="button"
                      onClick={() => setDisplay('off')}
                      className="flex-1 rounded border border-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/10"
                    >
                      Close preview
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
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

      {/* Post-show completion: mark played/skipped, add encores, complete the gig */}
      {finishing && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setFinishing(false) }}
        >
          <form
            onSubmit={handleComplete}
            className="mt-8 w-full max-w-xl rounded-lg border border-white/10 bg-cem-surface p-4 text-cem-text shadow-xl"
          >
            <h2 className="text-lg font-semibold text-white">Finish gig</h2>
            <p className="mt-1 text-sm text-white/60">
              Mark what was actually played. Skipped songs are recorded separately and never
              tagged as played.
            </p>

            {openGigs.length > 1 && (
              <label className="mt-3 block text-sm text-white/70">
                Gig
                <select
                  value={gigId}
                  onChange={(e) => setGigId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-white/20 bg-black px-3 py-2 text-sm text-white"
                >
                  {openGigs.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} · {new Date(g.scheduledAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <ul className="mt-4 space-y-2">
              {songs.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-white/10 px-3 py-2"
                >
                  <span className="text-sm">{s.title || 'Untitled'}</span>
                  <div className="flex gap-1">
                    {['played', 'skipped'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStates((prev) => ({ ...prev, [s.id]: st }))}
                        className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${
                          states[s.id] === st
                            ? st === 'played'
                              ? 'bg-cem-emerald text-cem-base'
                              : 'bg-cem-rose text-cem-base'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4">
              <p className="text-sm font-medium text-white/70">Encores (played outside the setlist)</p>
              <div className="mt-1 flex gap-2">
                <select
                  value={encoreId}
                  onChange={(e) => setEncoreId(e.target.value)}
                  className="flex-1 rounded-md border border-white/20 bg-black px-3 py-2 text-sm text-white"
                  aria-label="Encore song"
                >
                  <option value="">Add a song…</option>
                  {encoreOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.title || 'Untitled'}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addEncore}
                  disabled={!encoreId}
                  className="rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
              {encores.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {encores.map((songId) => {
                    const title = repertoire.find((s) => s.id === songId)?.title || 'Song'
                    return (
                      <li
                        key={songId}
                        className="flex items-center justify-between rounded border border-cem-amber/30 px-3 py-1.5 text-sm"
                      >
                        <span>{title} <span className="text-xs text-cem-amber">(off setlist)</span></span>
                        <button
                          type="button"
                          onClick={() => setEncores((prev) => prev.filter((x) => x !== songId))}
                          className="text-white/50 hover:text-white"
                          aria-label={`Remove ${title}`}
                        >
                          ✕
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {completeError && (
              <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{completeError}</p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFinishing(false)}
                disabled={completing}
                className="rounded-md border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={completing || !gigId}
                className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-50"
              >
                {completing ? 'Completing…' : 'Complete gig'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* External display preview (no second screen connected) */}
      {display === 'preview' && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between border-b border-white/10 bg-cem-surface px-4 py-2">
            <span className="text-sm font-semibold text-cem-text">
              External display preview
            </span>
            <button
              type="button"
              onClick={() => setDisplay('off')}
              className="rounded border border-cem-elevated px-3 py-1 text-sm text-cem-text hover:bg-white/10"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ExternalDisplayView state={displayState} />
          </div>
        </div>
      )}

      {/* Restart recovery: re-launch the display on second screen with one tap */}
      {restartPrompt && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-white/10 bg-cem-surface px-4 py-3 text-cem-text shadow-xl">
          <p className="text-sm">External display was active — re-launch it?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setRestartPrompt(false)
                doOpenDisplay()
              }}
              className="rounded bg-cem-amber px-3 py-1 text-sm font-semibold text-cem-base"
            >
              Re-launch
            </button>
            <button
              type="button"
              onClick={() => setRestartPrompt(false)}
              className="rounded border border-cem-elevated px-3 py-1 text-sm text-cem-text hover:bg-white/10"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}