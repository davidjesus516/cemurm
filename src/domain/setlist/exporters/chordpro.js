// ChordPro exporter — features/export-and-sharing.feature:18-23.
//
// Differs from the OnSong exporter on one point only: ChordPro carries several
// songs in one file by separating them with `{new_song}`, which is the
// directive the format defines for that. Chart bodies still pass through
// verbatim, headers still come from the agreed-key resolution.

import { orderedSongs, resolveKey } from './shared.js'

/**
 * @param {import('./shared.js').ExportSetlist | null | undefined} setlist
 * @param {import('./shared.js').ExportSong[] | null | undefined} songs
 * @returns {string}
 */
export function serializeChordPro(setlist, songs) {
  const blocks = []

  orderedSongs(setlist, songs).forEach(({ song }, index) => {
    /** @type {string[]} */
    const lines = []
    if (index > 0) lines.push('{new_song}')
    if (song.title) lines.push(`{title: ${song.title}}`)
    if (song.artist) lines.push(`{artist: ${song.artist}}`)
    const key = resolveKey(setlist, song)
    if (key) lines.push(`{key: ${key}}`)

    const body = String(song.body || '').trim()
    if (body) lines.push(body)

    blocks.push(lines.join('\n'))
  })

  return blocks.join('\n\n')
}
