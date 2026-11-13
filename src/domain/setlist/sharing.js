// Share payloads for a setlist or a song: the deep link, the summary text that
// travels with it, and the per-channel URL the browser opens.
//
// Requirement source:
//   features/export-and-sharing.feature:53-60  (link with bandmates)
//   features/export-and-sharing.feature:67-71  (individual songs via link)
//   features/export-and-sharing.feature:106-125 (WhatsApp / Telegram / email)
//
// Pure and Node-safe: the origin is passed in rather than read from
// `window.location`, so the tests assert the exact URL the browser opens.
//
// Not implemented here, on purpose:
//   · the 7-day expiring token (`:58`) and the view-only audience link —
//     `public.audience_views` exists (0001) but 0002 revokes every grant on it
//     and no RPC or route reads it, so a "read-only link" today would be a
//     URL that grants nothing. That is the audience view, T3.
//   · the PDF attachment the email scenario defaults to (`:123`) — there is no
//     PDF writer in this build (see exporters/setlistFile.js).
//   · the QR, embed and proximity codes (`:73-101`) and the chord-chart PNG
//     (`:127-131`) — no QR encoder and no rasterizer in this build.

import { formatDuration } from '../library/duration.js'
import { orderedSongs, resolveKey } from './exporters/shared.js'

/** The channels the share menu offers, in menu order. */
export const SHARE_CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: 'Email' },
]

/**
 * Absolute URL for an in-app path.
 * @param {string} path
 * @param {string} origin
 * @returns {string}
 */
function absolute(path, origin) {
  const base = String(origin || '').replace(/\/+$/, '')
  return `${base}${path}`
}

/**
 * The setlist deep link a bandmate opens.
 * @param {string} setlistId
 * @param {string} origin
 * @returns {string}
 */
export function setlistLink(setlistId, origin) {
  return absolute(`/setlists/${encodeURIComponent(String(setlistId))}`, origin)
}

/**
 * The song deep link — opens the song detail page, chart and lyrics included.
 * @param {string} songId
 * @param {string} origin
 * @returns {string}
 */
export function songLink(songId, origin) {
  return absolute(`/songs/${encodeURIComponent(String(songId))}`, origin)
}

/**
 * Total duration of the songs present in the setlist, in seconds.
 * @param {import('./exporters/shared.js').ExportSong[] | null | undefined} songs
 * @returns {number}
 */
function totalSeconds(songs) {
  return (songs || []).reduce(
    (sum, song) => sum + (Number(song?.durationSeconds) || 0),
    0,
  )
}

/**
 * The summary that travels with a setlist link: name, count and duration, then
 * the running order with the key each item performs in. No lyrics and no
 * chords — the recipient opens the link for those.
 * @param {import('./exporters/shared.js').ExportSetlist | null | undefined} setlist
 * @param {import('./exporters/shared.js').ExportSong[] | null | undefined} songs
 * @returns {string}
 */
export function setlistShareText(setlist, songs) {
  const rows = orderedSongs(setlist, songs)
  const name = String(setlist?.name || 'Setlist')
  const seconds = totalSeconds(rows.map(({ song }) => song))
  const count = `${rows.length} song${rows.length === 1 ? '' : 's'}`
  const header = seconds > 0 ? `${name} — ${count} · ${formatDuration(seconds)}` : `${name} — ${count}`

  const lines = rows.map(({ song }, index) => {
    const key = resolveKey(setlist, song)
    return `${index + 1}. ${song.title || 'Untitled'}${key ? ` (${key})` : ''}`
  })

  return [header, '', ...lines].join('\n').trimEnd()
}

/**
 * One-line summary for a shared song.
 * @param {{ title?: string | null, artist?: string | null } | null | undefined} song
 * @param {string | null | undefined} [key] the key the song currently plays in
 * @returns {string}
 */
export function songShareText(song, key) {
  const title = String(song?.title || 'Song')
  const artist = String(song?.artist || '').trim()
  const parts = [artist ? `"${title}" by ${artist}` : `"${title}"`]
  if (key) parts.push(`key ${key}`)
  return parts.join(' · ')
}

/**
 * Subject line for a shared setlist — the email scenario spells it out
 * (`features/export-and-sharing.feature:124`).
 * @param {import('./exporters/shared.js').ExportSetlist | null | undefined} setlist
 * @returns {string}
 */
export function setlistEmailSubject(setlist) {
  return `Rehearsal Setlist — ${String(setlist?.name || 'Setlist')}`
}

/**
 * The URL a share channel opens, given the link and the text beside it.
 * @param {string} channel one of SHARE_CHANNELS[].value
 * @param {{ url: string, text?: string, subject?: string }} payload
 * @returns {string}
 */
export function shareUrl(channel, { url, text = '', subject = '' }) {
  if (channel === 'whatsapp') {
    // wa.me takes one pre-filled message; the link rides with the summary.
    return `https://wa.me/?text=${encodeURIComponent([text, url].filter(Boolean).join('\n\n'))}`
  }
  if (channel === 'telegram') {
    return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  }
  if (channel === 'email') {
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent([text, url].filter(Boolean).join('\n\n'))}`
  }
  const known = SHARE_CHANNELS.map((option) => option.value).join(', ')
  throw new Error(`Unknown share channel: ${channel}. This build shares to ${known}.`)
}
