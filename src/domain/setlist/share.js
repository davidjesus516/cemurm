// Setlist sharing: the deep link, the summary that travels with it, and the
// integrated share targets (features/export-and-sharing.feature:55-132).
//
// Everything here is pure string assembly, so the node tier asserts the exact
// URL a share sheet receives. This module's links are the PLAIN deep link: they
// open the setlist for someone RLS already lets read it (owner or accepted
// collaborator) and grant nothing on their own. The token links — permission,
// 7-day expiry, revoke — live in 0047 and are assembled by shareLinks.js.
// Still unimplemented, for their own reasons: QR, embed and proximity codes
// (proximity needs an offline-verifiable one-time token the schema does not
// hold) and the PNG chord-chart target (no canvas renderer in this build).
//
// Requirement source:
//   :55-67  share a setlist link with bandmates (copy link, deep link)
//   :102-121 WhatsApp, Telegram and email targets

import { orderedSongs } from './exporters/shared.js'

/**
 * The share channels the panel offers, in menu order.
 * `value` is the channel key, never the vendor's own scheme name.
 */
export const SHARE_TARGETS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: 'Email' },
]

/**
 * @typedef {{
 *   value: string,
 *   label: string,
 *   href: string,
 *   subject?: string,
 * }} ShareTarget
 */

/**
 * Absolute deep link to a setlist. A recipient who is already a member lands
 * on the setlist page; anyone else is stopped by RLS, which is why the link
 * grants nothing on its own.
 * @param {unknown} setlistId
 * @param {string} [origin] absolute app origin, e.g. window.location.origin
 * @returns {string}
 */
export function setlistDeepLink(setlistId, origin = '') {
  const base = String(origin || '').replace(/\/+$/, '')
  return `${base}/setlists/${encodeURIComponent(String(setlistId ?? ''))}`
}

/**
 * Plain-text summary that accompanies the link: title, size, ordered song
 * titles. Titles only — no keys, chords or notes, so the same text can be
 * pasted into a channel the audience may read.
 * @param {import('./exporters/shared.js').ExportSetlist | null | undefined} setlist
 * @param {import('./exporters/shared.js').ExportSong[] | null | undefined} songs
 * @param {string} link
 * @returns {string}
 */
export function setlistShareSummary(setlist, songs, link) {
  const name = String(setlist?.name || 'Untitled setlist')
  const rows = orderedSongs(setlist, songs)
  const duration = setlist?.durationLabel
  const size = `${rows.length} song${rows.length === 1 ? '' : 's'}${
    duration && duration !== '—' ? ` · ${duration}` : ''
  }`

  const lines = [name, size]
  if (rows.length > 0) {
    lines.push('')
    rows.forEach(({ song }, index) => {
      lines.push(`${index + 1}. ${String(song.title || 'Untitled')}`)
    })
  }
  lines.push('', `Open in CEMURM: ${link}`)

  return lines.join('\n')
}

/**
 * Email subject. The scenario reads "Rehearsal Setlist — Weekly Rehearsal",
 * i.e. "<category> Setlist — <name>"; the setlist row has no category column,
 * so the name leads and the noun follows.
 * @param {import('./exporters/shared.js').ExportSetlist | null | undefined} setlist
 * @returns {string}
 */
export function shareSubject(setlist) {
  return `${String(setlist?.name || 'Untitled setlist')} — Setlist`
}

/**
 * One channel's share payload. `href` is what the browser opens: a wa.me,
 * t.me or mailto: URL carrying the summary and the deep link. Unknown
 * channels throw by name instead of silently producing a link to nowhere.
 * @param {import('./exporters/shared.js').ExportSetlist | null | undefined} setlist
 * @param {import('./exporters/shared.js').ExportSong[] | null | undefined} songs
 * @param {string} target one of SHARE_TARGETS[].value
 * @param {string} [origin]
 * @returns {ShareTarget}
 */
export function shareTarget(setlist, songs, target, origin = '') {
  const known = SHARE_TARGETS.find((option) => option.value === target)
  if (!known) {
    const supported = SHARE_TARGETS.map((option) => option.value).join(', ')
    throw new Error(`${target} sharing is not available: this build offers ${supported}.`)
  }

  const link = setlistDeepLink(setlist?.id, origin)
  const summary = setlistShareSummary(setlist, songs, link)
  const text = encodeURIComponent(summary)

  if (target === 'whatsapp') {
    return { ...known, href: `https://wa.me/?text=${text}` }
  }
  if (target === 'telegram') {
    const url = encodeURIComponent(link)
    return { ...known, href: `https://t.me/share/url?url=${url}&text=${text}` }
  }

  const subject = shareSubject(setlist)
  return {
    ...known,
    subject,
    href: `mailto:?subject=${encodeURIComponent(subject)}&body=${text}`,
  }
}

/**
 * Every channel's payload, in menu order.
 * @param {import('./exporters/shared.js').ExportSetlist | null | undefined} setlist
 * @param {import('./exporters/shared.js').ExportSong[] | null | undefined} songs
 * @param {string} [origin]
 * @returns {ShareTarget[]}
 */
export function shareTargets(setlist, songs, origin = '') {
  return SHARE_TARGETS.map((option) => shareTarget(setlist, songs, option.value, origin))
}
