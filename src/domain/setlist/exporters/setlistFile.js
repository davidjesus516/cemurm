// One entry point for the setlist export formats the page offers, plus the
// browser download. Node-safe: `buildSetlistFile` returns
// `{ ok, filename, text, mimeType }` and never touches the DOM, so the unit
// tests assert the exact payload the browser would write.
//
// Requirement source:
//   features/export-and-sharing.feature:18-23 (ChordPro)
//   features/export-and-sharing.feature:32-36 (ABC)
//   features/export-and-sharing.feature:38-43 (plain text)
//
// PDF and MusicXML are refused by name. Their charts live in storage
// (`chart_files.object_key`, `content` NULL for both formats) and this build
// has no PDF writer, so a "file" for either one would be a placeholder wearing
// a real extension. The feature scenarios for them stay unimplemented on
// purpose; odd/tasks/hito6-n3-product-slice.md records the gap.

import { serializeAbc } from './abc.js'
import { serializeChordPro } from './chordpro.js'
import { onsongFileName, serializeOnSong } from './onsong.js'
import { serializePlainText } from './plaintext.js'
import { slugify } from './shared.js'

/**
 * The formats the export menu offers, in menu order.
 * `value` is the dispatcher key, never the file extension.
 */
export const EXPORT_FORMATS = [
  { value: 'onsong', label: 'OnSong (.cho)' },
  { value: 'chordpro', label: 'ChordPro' },
  { value: 'abc', label: 'ABC notation' },
  { value: 'txt', label: 'Plain text outline' },
]

/** @typedef {{ value: string, label: string }} ExportFormatOption */

/**
 * @typedef {{
 *   ok: true,
 *   filename: string,
 *   text: string,
 *   mimeType: string,
 * }} SetlistFile
 */

/**
 * Filename per format. ChordPro, ABC and plain text follow the scenarios
 * ("Sunday-Worship-setlist.chordpro"); OnSong keeps the lower-cased `.cho`
 * name it has always produced.
 * @param {import('./shared.js').ExportSetlist | null | undefined} setlist
 * @param {string} format
 * @returns {string}
 */
function fileNameFor(setlist, format) {
  if (format === 'onsong') return onsongFileName(setlist)
  return `${slugify(setlist?.name)}-setlist.${format}`
}

/**
 * Serialize one setlist in one format.
 * @param {import('./shared.js').ExportSetlist | null | undefined} setlist
 * @param {import('./shared.js').ExportSong[] | null | undefined} songs
 * @param {string} [format] one of EXPORT_FORMATS[].value
 * @returns {SetlistFile}
 */
export function buildSetlistFile(setlist, songs, format = 'txt') {
  const known = EXPORT_FORMATS.some((option) => option.value === format)
  if (!known) {
    const supported = EXPORT_FORMATS.map((option) => option.value).join(', ')
    throw new Error(
      `${format} export is not available: this build produces ${supported}.`,
    )
  }

  let text
  if (format === 'onsong') text = serializeOnSong(setlist, songs)
  else if (format === 'chordpro') text = serializeChordPro(setlist, songs)
  else if (format === 'abc') text = serializeAbc(setlist, songs)
  else text = serializePlainText(setlist, songs)

  return {
    ok: true,
    filename: fileNameFor(setlist, format),
    text,
    mimeType: 'text/plain',
  }
}

/**
 * Serialize and hand the file to the browser. Node returns the same shape
 * without touching the DOM (the unit tests and the demo run there).
 * @param {import('./shared.js').ExportSetlist | null | undefined} setlist
 * @param {import('./shared.js').ExportSong[] | null | undefined} songs
 * @param {string} [format]
 * @returns {SetlistFile}
 */
export function downloadSetlistFile(setlist, songs, format = 'txt') {
  const file = buildSetlistFile(setlist, songs, format)
  if (typeof document === 'undefined') return file

  const blob = new Blob([file.text], { type: file.mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return file
}
