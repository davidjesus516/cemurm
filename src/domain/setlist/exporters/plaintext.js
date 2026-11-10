// Plain-text setlist outline (features/export-and-sharing.feature:38-43).
//
// The outline is deliberately not a songbook: no chords, no lyrics, no chart
// bodies. Columns are the ones the export can actually fill — duration comes
// from the song's latest version, notes from the setlist item, key from the
// agreed-key resolution the OnSong exporter already uses.

import { formatDuration } from '../../library/duration.js'
import { orderedSongs, resolveKey } from './shared.js'

/**
 * Escape a value for a markdown table cell: a bare `|` would close the cell
 * early and break every following column.
 * @param {unknown} value
 * @returns {string}
 */
function cell(value) {
  return String(value).replace(/\|/g, '\\|')
}

/**
 * @param {import('./shared.js').ExportSetlist | null | undefined} setlist
 * @param {import('./shared.js').ExportSong[] | null | undefined} songs
 * @returns {string}
 */
export function serializePlainText(setlist, songs) {
  const name = String(setlist?.name || 'Untitled')
  const rows = orderedSongs(setlist, songs)

  const lines = [
    `# ${name}`,
    '',
    '| # | Title | Key | Duration | Notes |',
    '|---|-------|-----|----------|-------|',
  ]

  if (rows.length === 0) {
    lines.push('', '_No songs in this setlist._')
    return `${lines.join('\n')}\n`
  }

  rows.forEach(({ song, songId }, index) => {
    const key = resolveKey(setlist, song)
    const duration = song.durationSeconds ? formatDuration(song.durationSeconds) : ''
    const notes = String(setlist?.itemNotes?.[songId] || '')
    lines.push(
      `| ${index + 1} | ${cell(song.title || 'Untitled')} | ${key} | ${duration} | ${cell(notes)} |`,
    )
  })

  return `${lines.join('\n')}\n`
}
