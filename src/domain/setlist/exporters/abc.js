// ABC notation exporter — features/export-and-sharing.feature:32-36.
//
// Inline ABC bodies are printed verbatim: an ABC tune already carries its own
// X:/T:/K: headers, so renumbering or re-heading it would corrupt the author's
// notation. A song with no ABC chart still gets a metadata stanza, so the
// export keeps the setlist order instead of silently dropping the song.

import { orderedSongs, resolveKey } from './shared.js'

/**
 * @param {import('./shared.js').ExportSetlist | null | undefined} setlist
 * @param {import('./shared.js').ExportSong[] | null | undefined} songs
 * @returns {string}
 */
export function serializeAbc(setlist, songs) {
  const name = String(setlist?.name || 'Untitled')
  const lines = [`% ${name}`]

  orderedSongs(setlist, songs).forEach(({ song }, index) => {
    const notation = song.format === 'abc' ? String(song.body || '').trim() : ''

    lines.push('')
    if (notation) {
      lines.push(notation)
      return
    }

    lines.push(
      `X:${index + 1}`,
      `T:${String(song.title || 'Untitled')}`,
      `C:${String(song.artist || '')}`,
      `K:${resolveKey(setlist, song) || 'C'}`,
    )
  })

  return lines.join('\n')
}
