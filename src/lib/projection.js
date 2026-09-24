// Congregation Projection data layer (Hito 5 — features/congregation-projection.feature).
// Client-only projection session: the OPERATOR device owns the slide deck and the
// congregation display follows over a BroadcastChannel popup (same pattern as
// External Display #62). The deck, index and settings persist in localStorage per
// service so the session survives app restarts, crashes and offline gaps; the
// display re-launches to the last broadcast state with one tap.
//
// The backend contract is deliberately tiny (0022): a per-song license gate
// (projection_licenses), a live lyric fix that creates a NEW version
// (record_typo_fix), and a block audit (log_projection_blocked). Everything else
// (slide building, navigation, scripture/announcement slides) is local state.

import { supabase } from './supabase.js'
import { getService } from './services.js'
import { getSong } from './songs.js'
import { parseChordPro } from './chordpro/parser.js'

/**
 * One slide in the projection deck.
 *  - song-title: cover of a song (title + artist + key)
 *  - lyrics:     one lyric section of a song (label + plain lyric lines)
 *  - scripture:  operator-inserted Bible passage (label + lines)
 *  - announcement: operator-inserted announcement (lines)
 *  - blocked:    projection-blocked song — cover with reason, no content
 * Only song-title/lyrics are derived from the chart; scripture/announcement
 * are operator-inserted and saved with the deck. Display NEVER renders chords,
 * keys, section keys or annotations (only the plain lyric lines).
 */
export const SLIDE_TYPES = ['song-title', 'lyrics', 'scripture', 'announcement', 'blocked']

export const CHANNEL_PREFIX = 'cemurm:projection:'
export const DISPLAY_URL = '/projection/display'

const DECK_KEY = (serviceId) => `cemurm:proj:deck:${serviceId}`
const SETTINGS_KEY = (serviceId) => `cemurm:proj:settings:${serviceId}`
const LAST_STATE_KEY = (serviceId) => `cemurm:proj:last:${serviceId}`
const ACTIVE_KEY = (serviceId) => `cemurm:proj:active:${serviceId}`

export const DEFAULT_SETTINGS = Object.freeze({ fontScale: 1, highContrast: false })

let slideSeq = 0
function newSlideId() {
  slideSeq += 1
  return `slide-${Date.now().toString(36)}-${slideSeq}`
}

/* ────────────────────────── deck construction ────────────────────────── */

/**
 * Build the projection deck for a service plan: every block's setlist item
 * becomes a song-title slide plus one slide per lyric section (parser order).
 * Songs are license-gated through projection_licenses in ONE batched RPC; a
 * blocked song gets a cover slide with the reason and no content.
 * Returns { deck, blocked: [{ songId, title, reason }] }.
 */
export async function buildDeck(serviceId, userId) {
  const { service, blocks } = await getService(serviceId)
  const items = (blocks || [])
    .flatMap((b) => b.setlist?.items || [])
    .filter((i) => i.songId)

  // Per-song chart (read-through cached) for title/artist/key/body.
  const songs = await Promise.all(
    items.map((item) => getSong(userId, item.songId).then((song) => ({ item, song }))),
  )

  const songIds = songs.map(({ item }) => item.songId)
  const { data: licenses, error: licenseError } = await supabase
    .rpc('projection_licenses', { p_song_ids: songIds })
  if (licenseError) throw licenseError

  const licenseById = new Map((licenses || []).map((l) => [l.song_id, l]))
  const blocked = []
  const slides = []

  for (const { item, song } of songs) {
    const license = licenseById.get(item.songId)
    const projectable = license?.projectable !== false
    const reason = license?.reason || ''
    if (!projectable) {
      blocked.push({ songId: item.songId, title: song.title, reason })
      slides.push({
        id: newSlideId(),
        kind: 'blocked',
        songId: item.songId,
        title: song.title,
        reason,
      })
      continue
    }

    slides.push({
      id: newSlideId(),
      kind: 'song-title',
      songId: item.songId,
      title: song.title,
      artist: song.artist || '',
      key: item.agreedKey || song.key || '',
    })
    slides.push(...lyricSlides(item.songId, song.title, song.body))
  }

  const deck = {
    serviceId,
    serviceName: service.name,
    startedAt: null,
    slides,
    index: 0,
  }
  return { deck, blocked }
}

/** Sheet-free lyric slides from a ChordPro body (one per section, parser order). */
export function lyricSlides(songId, title, body) {
  const parsed = body ? parseChordPro(body) : { key: '', sections: [] }
  const slides = []
  let label = ''
  for (const section of parsed.sections) {
    if (section.type === 'comment') continue // rehearsal notes never reach display
    if (section.type === 'section') {
      label = section.lines.map((l) => l.text).join(' ').trim()
      continue
    }
    if (section.type !== 'lyrics') continue
    const lines = section.lines.map((l) => l.text).filter((t) => t.trim())
    if (!lines.length) continue
    slides.push({
      id: newSlideId(),
      kind: 'lyrics',
      songId,
      title,
      label,
      lines,
    })
    label = ''
  }
  return slides
}

/* ────────────────────────── persistence ────────────────────────── */

export function loadDeck(serviceId) {
  try {
    const raw = localStorage.getItem(DECK_KEY(serviceId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveDeck(serviceId, deck) {
  try {
    localStorage.setItem(DECK_KEY(serviceId), JSON.stringify(deck))
  } catch {
    // storage full/unavailable — session simply won't persist
  }
}

export function clearDeck(serviceId) {
  try {
    localStorage.removeItem(DECK_KEY(serviceId))
    localStorage.removeItem(LAST_STATE_KEY(serviceId))
    localStorage.removeItem(ACTIVE_KEY(serviceId))
  } catch {
    // non-fatal
  }
}

export function loadSettings(serviceId) {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY(serviceId))
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function persistSettings(serviceId, settings) {
  try {
    localStorage.setItem(SETTINGS_KEY(serviceId), JSON.stringify(settings))
  } catch {
    // non-fatal
  }
}

export function markActive(serviceId) {
  try {
    localStorage.setItem(ACTIVE_KEY(serviceId), '1')
  } catch {
    // non-fatal
  }
}

export function wasActive(serviceId) {
  try {
    return localStorage.getItem(ACTIVE_KEY(serviceId)) === '1'
  } catch {
    return false
  }
}

/* ────────────────────────── broadcast channel ────────────────────────── */

export function channelFor(serviceId) {
  return typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(`${CHANNEL_PREFIX}${serviceId}`)
    : null
}

export function postState(channel, payload) {
  channel?.postMessage({ kind: 'projection-state', ...payload })
}

export function postBeat(channel) {
  channel?.postMessage({ kind: 'heartbeat', ts: Date.now() })
}

export function postClose(channel) {
  channel?.postMessage({ kind: 'close' })
}

/** Broadcast current deck position + settings; also persists the last state for re-launch. */
export function syncState(serviceId, channel, deck, settings) {
  const state = {
    ts: Date.now(),
    serviceId,
    deck: deck.slides,
    name: deck.serviceName,
    index: deck.index,
    settings,
  }
  try {
    localStorage.setItem(LAST_STATE_KEY(serviceId), JSON.stringify(state))
  } catch {
    // non-fatal
  }
  postState(channel, state)
}

export function loadLastState(serviceId) {
  try {
    const raw = localStorage.getItem(LAST_STATE_KEY(serviceId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/* ────────────────────────── navigation / insertion ────────────────────────── */

export function goTo(deck, index) {
  deck.index = Math.max(0, Math.min(index, deck.slides.length - 1))
}

export function nextSlide(deck) {
  if (deck.index < deck.slides.length - 1) {
    deck.index += 1
    return true
  }
  return false
}

export function prevSlide(deck) {
  if (deck.index > 0) {
    deck.index -= 1
    return true
  }
  return false
}

/** Insert an operator slide (scripture/announcement) after the current one. */
export function insertSlide(deck, kind, content) {
  const slide = { id: newSlideId(), kind, ...content }
  deck.slides.splice(deck.index + 1, 0, slide)
  deck.index += 1
  return slide
}

export function removeSlide(deck, slideId) {
  const idx = deck.slides.findIndex((s) => s.id === slideId)
  if (idx === -1) return false
  deck.slides.splice(idx, 1)
  if (deck.index >= deck.slides.length) deck.index = deck.slides.length - 1
  return true
}

/* ────────────────────────── backing RPCs (0022) ────────────────────────── */

/**
 * Live lyric fix from the operator console: updates the latest chart and
 * creates a NEW version (change_note 'Fixed lyric typo'). After the RPC the
 * caller should rebuild the song's lyric slides from the new body.
 * Returns the new version number.
 */
export async function fixTypo(songId, body) {
  const { data, error } = await supabase
    .rpc('record_typo_fix', { p_song_id: songId, p_body: body })
  if (error) throw error
  return data
}

/** Audit a projection block (license etc.) into the service change log. */
export async function logBlocked(serviceId, songId, reason) {
  const { error } = await supabase
    .rpc('log_projection_blocked', { p_service_id: serviceId, p_song_id: songId, p_reason: reason })
  if (error) throw error
}