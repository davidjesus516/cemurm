// Event batch export — features/export-and-sharing.feature:181-186.
//
// "A ZIP archive is generated containing all 5 setlists" and "the archive is
// named 'Weekend-Festival-2025-setlists.zip'". `zipSync` is synchronous and
// browser-independent, so this module is fully testable in the node Vitest
// environment (precedent: domain/account/exportZip.js).
//
// Documented deviation: the scenario says "each setlist is in PDF format".
// This build has no PDF writer — a setlist's PDF chart is a storage object
// (`chart_files.object_key`, content NULL) — so the archive carries whatever
// format the caller serialized. Producing a `.pdf` file that is not a PDF
// would be worse than an honest ChordPro archive.
//
// Two setlists can serialize to the same filename ("Friday-Gig-setlist" twice).
// A ZIP silently overwrites a duplicate entry name, so the second and later
// collisions are suffixed `-2`, `-3` before the extension.

import { strToU8, zipSync } from 'fflate'

import { slugify } from './shared.js'

/**
 * Make an entry name unique within the archive.
 * @param {string} filename
 * @param {Map<string, number>} used
 * @returns {string}
 */
function uniqueName(filename, used) {
  const count = (used.get(filename) ?? 0) + 1
  used.set(filename, count)
  if (count === 1) return filename

  const dot = filename.lastIndexOf('.')
  if (dot <= 0) return `${filename}-${count}`
  return `${filename.slice(0, dot)}-${count}${filename.slice(dot)}`
}

/**
 * Assemble the batch archive.
 * @param {unknown} eventName the event the setlists belong to
 * @param {Array<{ filename?: string, text?: string }>} [files] already-serialized setlists
 * @returns {{ name: string, bytes: Uint8Array }}
 */
export function buildEventSetlistsZip(eventName, files = []) {
  const list = (Array.isArray(files) ? files : []).filter(
    (file) => file && typeof file.text === 'string',
  )

  // An empty ZIP downloads as a valid file holding nothing, which looks like a
  // success and is not. Refuse instead.
  if (list.length === 0) throw new Error('Select at least one setlist to export.')

  const used = new Map()
  /** @type {Record<string, Uint8Array>} */
  const entries = {}
  for (const file of list) {
    const name = uniqueName(String(file.filename || 'setlist.txt'), used)
    entries[name] = strToU8(file.text)
  }

  return {
    name: `${slugify(eventName)}-setlists.zip`,
    bytes: zipSync(entries),
  }
}
