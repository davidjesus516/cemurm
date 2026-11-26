// The one place that hands bytes to the browser as a download.
//
// Node-safe by design: the tests and the demo run in a node environment with no
// `document`, and there this is a no-op that returns the descriptor. Keeping the
// DOM touch in a single function means the setlist exporters, the export
// history's "regenerate" and the event batch ZIP cannot grow three spellings of
// `URL.createObjectURL` — and it is the only line that would need a mock to test.

/**
 * @typedef {object} SavedFile
 * @property {string} filename
 * @property {string} mimeType
 * @property {string | Uint8Array} body
 */

/**
 * @param {{ filename: string, mimeType?: string, body: string | Uint8Array }} file
 * @returns {SavedFile}
 */
export function saveFile({ filename, mimeType = 'text/plain', body }) {
  const file = { filename: String(filename), mimeType, body }
  if (typeof document === 'undefined') return file

  const blob = new Blob([body], { type: mimeType })
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
