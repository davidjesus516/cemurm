// Share targets for a setlist — features/export-and-sharing.feature:55-131.
//
// Pure and node-safe: this module builds the deep link, the summary and the
// target URLs. The page owns the talking to the clipboard, the browser and
// the share sheet, so the parts worth pinning live here.
//
// The deep link is the setlist route (`/setlists/:id`), which is what the
// bandmate already receives access to: `setlist_collaborators` decides
// whether that viewer may read or edit, and the link carries no permission
// of its own. A link that grants access on its own — with a token and an
// expiry — is a different unit and needs its own table and policies; see the
// gap recorded in odd/tasks/hito6-n3-product-slice.md.

import { orderedSongs } from './exporters/shared.js'

/**
 * The absolute (or root-relative) link to a setlist.
 * @param {{ id?: unknown, name?: unknown } | null | undefined} setlist
 * @param {string} [origin]
 * @returns {string}
 */
export function setlistDeepLink(setlist, origin = '') {
  const base = String(origin || '').replace(/\/+$/, '')
  return `${base}/setlists/${String(setlist?.id ?? '')}`
}

/**
 * The text a musician sends to a bandmate: the setlist name, how many songs
 * it holds and the titles, in setlist order. Songs missing from the library
 * are skipped, the same way the export skips them.
 * @param {{ name?: unknown, itemIds?: unknown } | null | undefined} setlist
 * @param {Array<{ title?: unknown }> | null | undefined} songs
 * @returns {string}
 */
export function shareSummary(setlist, songs) {
  const rows = orderedSongs(setlist, songs)
  const name = String(setlist?.name || 'Untitled setlist')
  const count = `${rows.length} ${rows.length === 1 ? 'song' : 'songs'}`

  const lines = [name, count]
  for (const { song } of rows) {
    lines.push(`- ${String(song.title || 'Untitled')}`)
  }

  return lines.join('\n')
}

/**
 * The full message: the summary and the link to the setlist.
 * @param {{ id?: unknown, name?: unknown, itemIds?: unknown } | null | undefined} setlist
 * @param {Array<{ title?: unknown }> | null | undefined} songs
 * @param {string} [origin]
 * @returns {string}
 */
export function shareMessage(setlist, songs, origin = '') {
  return `${shareSummary(setlist, songs)}\n\n${setlistDeepLink(setlist, origin)}`
}

/**
 * WhatsApp share link with the message already written.
 * @param {string} message
 * @returns {string}
 */
export function whatsappUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(String(message ?? ''))}`
}

/**
 * Telegram share link: Telegram takes the link and the text separately.
 * @param {string} text
 * @param {string} url
 * @returns {string}
 */
export function telegramUrl(text, url) {
  const query = `url=${encodeURIComponent(String(url ?? ''))}&text=${encodeURIComponent(
    String(text ?? ''),
  )}`
  return `https://t.me/share/url?${query}`
}

/**
 * A mailto link. The subject line is the one the feature names:
 * "Rehearsal Setlist — <setlist name>".
 * @param {{ subject?: unknown, body?: unknown }} options
 * @returns {string}
 */
export function emailUrl({ subject, body } = {}) {
  const query = `subject=${encodeURIComponent(String(subject ?? ''))}&body=${encodeURIComponent(
    String(body ?? ''),
  )}`
  return `mailto:?${query}`
}
