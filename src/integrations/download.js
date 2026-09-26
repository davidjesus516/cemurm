// Browser download shim (ADR 0002 refactor 3, pure/impure split).
// downloadOnSongFile moved here out of domain/setlist/exporters/onsong.js
// because it touches `document`, and domain/ is pure (rule 3). The webMidi.js
// precedent applies: a browser-platform concern lives in integrations/ so the
// domain module keeps only the payload logic.
//
// The payload itself is NOT duplicated — serializeOnSong stays the single
// source of truth in the exporter, and this module only adds the filename
// slug and the Blob + object-URL + anchor click.
//
// The node guard is preserved deliberately: with no `document` the function
// returns { ok, filename, text } without touching the DOM, so the demo below
// can assert the exact payload in bare node.

import { serializeOnSong } from '../domain/setlist/exporters/onsong.js'

/**
 * Download the serialized setlist as `<setlist-name>.cho` (Blob + object URL
 * + anchor click). Node guard: returns { ok, filename, text } instead of
 * touching the DOM so the demo can assert the exact payload.
 *
 * @param {{ name?: string, itemIds?: string[], versionIds?: Record<string, string> }} setlist
 * @param {Array<{ id: string, title?: string, artist?: string, key?: string, body?: string }>} songs
 * @returns {{ ok: boolean, filename: string, text: string }}
 */
export function downloadOnSongFile(setlist, songs) {
  const text = serializeOnSong(setlist, songs)
  const base = String(setlist?.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const filename = `${base || 'setlist'}.cho`

  if (typeof document === 'undefined') return { ok: true, filename, text }

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return { ok: true, filename, text }
}

// Self-check: node -e "import('./src/integrations/download.js').then(m => m.demo())"
export function demo() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`download demo FAILED: ${msg}`)
  }

  const setlist = { name: 'Sunday Service', itemIds: ['s1'], versionIds: {} }
  const songs = [{ id: 's1', title: 'Way Maker', artist: 'Sinach', key: 'G major', body: '[Verse]\nG  D  Em  C' }]

  // Node path returns the identical payload + slug filename, no DOM touched.
  const dl = downloadOnSongFile(setlist, songs)
  assert(dl.ok === true && dl.filename === 'sunday-service.cho', 'node path returns slug filename')
  assert(dl.text === serializeOnSong(setlist, songs), 'node path returns identical text')

  // Unnamed setlist falls back to the 'setlist' stem.
  const anon = downloadOnSongFile({ itemIds: [] }, [])
  assert(anon.filename === 'setlist.cho', 'empty name → setlist.cho')

  console.log('download demo OK: 3 asserts (slug filename, payload parity, name fallback)')
}
