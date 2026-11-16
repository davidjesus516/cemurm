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
//
// The suffix is searched against the names actually written, not against a
// per-filename counter: a suffix can collide with a filename a user really
// chose. Three setlists named "Friday", "Friday" and "Friday-2" would otherwise
// write `Friday-2` twice and lose one of them.

import { strToU8, zipSync } from 'fflate'

import { slugify } from './shared.js'

/**
 * Make an entry name unique within the archive.
 * @param {string} filename
 * @param {Set<string>} used names already taken by an earlier entry
 * @returns {string}
 */
function uniqueName(filename, used) {
  if (!used.has(filename)) {
    used.add(filename)
    return filename
  }

  const dot = filename.lastIndexOf('.')
  const stem = dot > 0 ? filename.slice(0, dot) : filename
  const extension = dot > 0 ? filename.slice(dot) : ''

  let candidate = ''
  let suffix = 2
  do {
    candidate = `${stem}-${suffix}${extension}`
    suffix += 1
  } while (used.has(candidate))

  used.add(candidate)
  return candidate
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

  const used = new Set()
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
