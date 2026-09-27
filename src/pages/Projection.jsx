// Congregation Projection operator console (Hito 5 — features/congregation-projection.feature).
// Operator owns the slide deck: Start projection builds it from the service plan
// (license-gated), the operator navigates slides, inserts scripture/announcement
// slides, fixes lyric typos live (new song version via 0022), and the
// congregation display follows over a BroadcastChannel popup. The deck, index
// and settings persist in localStorage per service for crash/restart recovery.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import SlideView from '../components/projection/SlideView.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { getSong, invalidateSongs } from '../lib/songs.js'
import {
  buildDeck,
  channelFor,
  clearDeck,
  DISPLAY_URL,
  fixTypo,
  insertSlide,
  loadDeck,
  loadLastState,
  loadSettings,
  logBlocked,
  lyricSlides,
  markActive,
  nextSlide,
  persistSettings,
  postClose,
  prevSlide,
  removeSlide,
  saveDeck,
  syncState,
  wasActive,
} from '../lib/projection.js'

const btn = 'rounded-md px-3 py-1.5 text-sm font-medium'
const primaryBtn = `${btn} bg-cem-amber text-cem-base hover:bg-cem-amber/90 disabled:opacity-60`
const outlinedBtn = `${btn} border border-cem-elevated text-cem-text hover:bg-cem-elevated disabled:opacity-60`
const miniBtn =
  'rounded-md border border-cem-elevated px-2 py-1 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60'
const inputClass =
  'w-full rounded-md border border-cem-elevated bg-cem-surface px-2 py-1.5 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-amber-500'

const HEARTBEAT_MS = 3000
const HEARTBEAT_STALE_MS = 9000
const DISPLAY_POLL_MS = 3000

export default function Projection() {
  const { id } = useParams()
  const { user } = useAuth()

  const [deck, setDeck] = useState(() => loadDeck(id))
  const [settings, setSettings] = useState(() => loadSettings(id))
  const [blocked, setBlocked] = useState([])
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState('')

  // Composer modals: scripture / announcement / typo fix.
  const [composer, setComposer] = useState(null) // { kind: 'scripture'|'announcement' }
  const [draft, setDraft] = useState({ reference: '', lines: '' })
  const [typo, setTypo] = useState(null) // { songId, title, body }
  const [saving, setSaving] = useState(false)

  const [displayMode, setDisplayMode] = useState('none') // none | preview | popup | disconnected
  const [detached, setDetached] = useState(false)
  const channelRef = useRef(null)
  const popupRef = useRef(null)
  const lastHeartbeatRef = useRef(Date.now())
  const deckRef = useRef(deck)
  deckRef.current = deck

  // Channel lifecycle: one BroadcastChannel per service for this tab.
  useEffect(() => {
    const channel = channelFor(id)
    channelRef.current = channel
    return () => {
      postClose(channel)
      channel?.close()
    }
  }, [id])

  // Sync every deck/position/settings change to the display.
  useEffect(() => {
    if (!deck) return
    syncState(id, channelRef.current, deck, settings)
    saveDeck(id, deck)
  }, [deck, id, settings])

  // Popup liveness: heartbeats stop → offer re-open.
  useEffect(() => {
    if (displayMode !== 'popup') return
    const timer = window.setInterval(() => {
      if (Date.now() - lastHeartbeatRef.current > HEARTBEAT_STALE_MS) {
        setDisplayMode('disconnected')
      }
    }, DISPLAY_POLL_MS)
    return () => window.clearInterval(timer)
  }, [displayMode])

  // Restart recovery: previous session was active → re-announce last state.
  useEffect(() => {
    if (wasActive(id)) {
      const last = loadLastState(id)
      if (last) {
        setDetached(true)
        setDisplayMode('popup')
        lastHeartbeatRef.current = Date.now()
      }
    }
  }, [id])

  // Keyboard navigation (Operator console always owns the deck).
  useEffect(() => {
    function onKey(event) {
      if (event.target?.tagName === 'TEXTAREA' || event.target?.tagName === 'INPUT') return
      if (composer || typo) return
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        step(true)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        step(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, composer, typo])

  const step = useCallback(
    (forward) => {
      if (!deck || !deck.slides.length) return
      setDeck((d) => {
        const copy = { ...d, slides: [...d.slides] }
        const moved = forward ? nextSlide(copy) : prevSlide(copy)
        return moved ? copy : d
      })
    },
    [deck],
  )

  async function startProjection() {
    setBuilding(true)
    setError('')
    try {
      const { deck: built, blocked: blockedSongs } = await buildDeck(id, user.id)
      setDeck(built)
      setBlocked(blockedSongs)
      markActive(id)
      for (const blockedSong of blockedSongs) {
        try {
          await logBlocked(id, blockedSong.songId, blockedSong.reason)
        } catch {
          // Block audit is best-effort; the operator still sees the reason.
        }
      }
    } catch (err) {
      setError(err.message || 'Could not build the projection deck.')
    } finally {
      setBuilding(false)
    }
  }

  function doOpenDisplay() {
    if (!deck) return
    const popup = window.open(
      `${DISPLAY_URL}?service=${encodeURIComponent(id)}`,
      'cemurm-projection',
      'popup=yes,width=1024,height=640',
    )
    popupRef.current = popup
    markActive(id)
    lastHeartbeatRef.current = Date.now()
    setDisplayMode('popup')
  }

  function doPreview() {
    setDisplayMode('preview')
    markActive(id)
  }

  function doCloseDisplay() {
    postClose(channelRef.current)
    try {
      popupRef.current?.close()
    } catch {
      // popup may already be gone
    }
    setDisplayMode('none')
  }

  function updateSetting(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    persistSettings(id, next)
  }

  function openComposer(kind) {
    setComposer({ kind })
    setDraft({ reference: '', lines: '' })
  }

  function confirmInsert() {
    if (!deck) return
    const lines = draft.lines.split('\n').map((s) => s.trimEnd()).filter(Boolean)
    if (!lines.length) return
    setDeck((d) => {
      const copy = { ...d, slides: [...d.slides] }
      insertSlide(copy, composer.kind, {
        label: composer.kind === 'scripture' ? draft.reference.trim() : '',
        lines,
      })
      return copy
    })
    setComposer(null)
  }

  async function openTypoEditor() {
    if (!deck) return
    const slide = deck.slides[deck.index]
    if (!slide?.songId) return
    try {
      const song = await getSong(user.id, slide.songId)
      setTypo({ songId: slide.songId, title: song.title, body: song.body })
    } catch (err) {
      setError(err.message || 'Could not load the chart to edit.')
    }
  }

  async function saveTypoFix() {
    if (!typo) return
    setSaving(true)
    setError('')
    try {
      const newBody = typo.body || ''
      await fixTypo(typo.songId, newBody)
      invalidateSongs(user.id, [typo.songId])
      // Rebuild ONLY this song's lyric slides in place (blocked/song-title
      // frames and operator-inserted slides stay put).
      setDeck((d) => {
        if (!d) return d
        const rebuilt = lyricSlides(typo.songId, typo.title, newBody)
        const copy = { ...d, slides: [...d.slides] }
        const isSongSlide = (s) => s.songId === typo.songId && (s.kind === 'lyrics' || s.kind === 'song-title')
        const firstIdx = copy.slides.findIndex(isSongSlide)
        if (firstIdx === -1) return copy
        const before = copy.slides.slice(0, firstIdx)
        const after = copy.slides.slice(firstIdx).filter((s) => !isSongSlide(s))
        const titleSlide = copy.slides[firstIdx].kind === 'song-title'
          ? [copy.slides[firstIdx]]
          : []
        copy.slides = [...before, ...titleSlide, ...rebuilt, ...after]
        if (copy.index >= copy.slides.length) copy.index = Math.max(0, copy.slides.length - 1)
        return copy
      })
      setTypo(null)
    } catch (err) {
      setError(err.message || 'Could not save the lyric fix.')
    } finally {
      setSaving(false)
    }
  }

  function finishProjection() {
    postClose(channelRef.current)
    try {
      popupRef.current?.close()
    } catch {
      // popup may already be gone
    }
    clearDeck(id)
    setDeck(null)
    setBlocked([])
    setDisplayMode('none')
  }

  const slide = deck?.slides[deck.index] || null
  const currentSongId = slide?.songId || null
  const pageIdx = deck ? `${deck.index + 1} / ${deck.slides.length}` : ''

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-cem-text">Congregation Projection</h1>
          <p className="text-sm text-cem-secondary">
            {deck ? `${deck.serviceName} · slide ${pageIdx}` : 'Build a slide deck from the service plan'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!deck && (
            <button className={primaryBtn} onClick={startProjection} disabled={building}>
              {building ? 'Building deck…' : 'Start projection'}
            </button>
          )}
          {deck && (
            <>
              <button className={outlinedBtn} onClick={() => updateSetting({ fontScale: Math.max(0.75, (settings.fontScale || 1) - 0.25) })}>
                A−
              </button>
              <button className={outlinedBtn} onClick={() => updateSetting({ fontScale: Math.min(2, (settings.fontScale || 1) + 0.25) })}>
                A+
              </button>
              <button
                className={`${miniBtn} ${settings.highContrast ? 'border-cem-amber text-cem-amber' : ''}`}
                onClick={() => updateSetting({ highContrast: !settings.highContrast })}
              >
                Contrast
              </button>
              {displayMode === 'none' && (
                <button className={outlinedBtn} onClick={doOpenDisplay}>Open display</button>
              )}
              {displayMode === 'none' && (
                <button className={miniBtn} onClick={doPreview}>Preview</button>
              )}
              {displayMode === 'preview' && (
                <button className={miniBtn} onClick={doCloseDisplay}>Close preview</button>
              )}
              {displayMode === 'popup' && (
                <button className={miniBtn} onClick={doOpenDisplay}>Re-open display</button>
              )}
              {displayMode === 'disconnected' && (
                <button className={miniBtn} onClick={doOpenDisplay}>Reconnect display</button>
              )}
              <button
                className={miniBtn}
                onClick={() => window.confirm('Close the projection session?') && finishProjection()}
              >
                Stop
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <p className="rounded-md border border-cem-rose/40 bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">
          {error}
        </p>
      )}

      {deck && blocked.length > 0 && (
        <div className="rounded-md border border-cem-amber/40 bg-cem-amber/10 px-3 py-2 text-sm text-cem-text">
          <span className="font-medium text-cem-amber">Blocked from projection:</span>{' '}
          {blocked.map((b) => b.title).join(', ')}
        </div>
      )}

      {!deck && !building && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-cem-elevated bg-cem-surface/40 p-8 text-center">
          <p className="text-cem-secondary">
            Build a slide deck from {`this service's`} plan — songs become title + lyric
            slides, license-blocked songs show a cover with the reason.
          </p>
        </div>
      )}

      {deck && (
        <main className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
          <div className="relative overflow-hidden rounded-xl border border-cem-elevated bg-cem-base">
            <SlideView slide={slide} settings={settings} />

            {slide?.kind === 'blocked' && slide?.songId === currentSongId && !typo && (
              <div className="absolute bottom-3 right-3">
                <button className={miniBtn} onClick={openTypoEditor}>Edit lyrics…</button>
              </div>
            )}

            <div className="absolute bottom-3 left-3 flex gap-2">
              <button
                className={`${primaryBtn} opacity-90`}
                onClick={() => step(false)}
                disabled={!deck.index}
              >
                ←
              </button>
              <button
                className={`${primaryBtn} opacity-90`}
                onClick={() => step(true)}
                disabled={deck.index >= deck.slides.length - 1}
              >
                →
              </button>
              <button className={miniBtn} onClick={() => removeSlide(deck, slide?.id)} disabled={!slide?.songId}>
                Remove current
              </button>
            </div>
          </div>

          <aside className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-widest text-cem-secondary">
              Insert slide
            </span>
            <button className={outlinedBtn} onClick={() => openComposer('scripture')}>
              Scripture
            </button>
            <button className={outlinedBtn} onClick={() => openComposer('announcement')}>
              Announcement
            </button>
            <span className="mt-3 text-xs font-medium uppercase tracking-widest text-cem-secondary">
              Current song
            </span>
            <button className={miniBtn} onClick={openTypoEditor} disabled={!currentSongId}>
              Fix lyrics…
            </button>
            <button className={miniBtn} onClick={() => window.confirm('Close the projection session?') && finishProjection()}>
              End session
            </button>
            {saving && <span className="text-xs text-cem-secondary">Saving…</span>}
          </aside>
        </main>
      )}

      {detached && displayMode !== 'none' && (
        <p className="text-xs text-cem-secondary">
          Recovered a previous projection session — the display follows the last position.
        </p>
      )}

      {composer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-cem-base/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-cem-elevated bg-cem-surface p-4">
            <h2 className="mb-3 text-lg font-semibold text-cem-text">
              {composer.kind === 'scripture' ? 'Insert scripture' : 'Insert announcement'}
            </h2>
            {composer.kind === 'scripture' && (
              <input
                className={`${inputClass} mb-2`}
                placeholder="Reference — e.g. John 3:16"
                value={draft.reference}
                onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
                autoFocus
              />
            )}
            <textarea
              className={`${inputClass} mb-3 min-h-28`}
              placeholder="One line per slide line…"
              value={draft.lines}
              onChange={(e) => setDraft({ ...draft, lines: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <button className={outlinedBtn} onClick={() => setComposer(null)}>Cancel</button>
              <button className={primaryBtn} onClick={confirmInsert} disabled={!draft.lines.trim()}>
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {typo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-cem-base/80 p-4">
          <div className="w-full max-w-lg rounded-xl border border-cem-elevated bg-cem-surface p-4">
            <h2 className="mb-1 text-lg font-semibold text-cem-text">Fix lyrics — {typo.title}</h2>
            <p className="mb-3 text-xs text-cem-secondary">
              Edits the chart and creates a NEW version (change note “Fixed lyric typo”).
            </p>
            <textarea
              className={`${inputClass} min-h-48 font-mono`}
              value={typo.body}
              onChange={(e) => setTypo({ ...typo, body: e.target.value })}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button className={outlinedBtn} onClick={() => setTypo(null)} disabled={saving}>Cancel</button>
              <button className={primaryBtn} onClick={saveTypoFix} disabled={saving || typo.body === ''}>
                {saving ? 'Saving…' : 'Save new version'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}