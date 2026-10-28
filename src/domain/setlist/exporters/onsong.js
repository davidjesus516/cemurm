// @ts-check
// OnSong exporter (Hito 5 #78, S17): setlist → OnSong-compatible ChordPro
// text. Each song serializes ONLY title / artist / key / body — never
// projections, annotations, comments, MIDI programs or any other per-item
// state (S17: "exports order + agreed keys, no projections/annotations").
// The chart body passes through VERBATIM so ChordPro sections survive.
//
// Agreed key resolution: the setlist item's SELECTED version base_key when
// the item pins one (3.5 version picker), else the song's current version
// key (the flattened song.key). Songs missing from the library contribute
// nothing (the setlist UI already shows them as '(missing song)').
//
// Node-safe: downloadOnSongFile guards the DOM, so the demo can assert the
// exact payload without a browser.

/**
 * The setlist surface the serializer reads: order (itemIds), the per-item
 * pinned version (versionIds) and the name (slug source) — all real Setlist
 * fields (setlists.js), so a flattened setlist satisfies it as-is.
 *
 * WIDER than the flattened Setlist on purpose, and the index signature is
 * load-bearing: the exporter is a defensive boundary that coerces instead of
 * throwing, and the characterization test (onsong.test.js) pins that with a
 * null setlist, a non-array `itemIds` and extra keys this exporter must never
 * reach. The index signature is the ignored remainder — which is exactly why
 * the setlist item `agreed_key` can never leak into the file.
 * @typedef {{
 *   itemIds?: string[] | string | null,
 *   versionIds?: Record<string, string>,
 *   agreedKeys?: Record<string, string>,
 *   name?: string,
 *   [key: string]: unknown,
 * }} ExportSetlist
 */

/**
 * A song version as the agreed-key lookup reads it: id + base key. Nothing
 * else of the version is exported.
 * @typedef {object} ExportSongVersion
 * @property {string} id
 * @property {string | null} [key]
 */

/**
 * The song surface the serializer reads — id (the itemIds join), title/artist
 * (the OnSong headers), key (the agreed key) and body (verbatim chart).
 * Projections, annotations, comments and MIDI programs are deliberately
 * absent from this shape: S17 keeps them out of the export.
 *
 * The nullable fields are real, not defensive noise: `String(song.body || '')`
 * and the falsy-header guards are what let a null body or null key through,
 * and the characterization test pins both. `versions` admits a non-array
 * because the Array.isArray guard falls back to the song key (the test passes
 * the string 'nope' to prove it).
 * @typedef {object} ExportSong
 * @property {string} id
 * @property {string | null} [title]
 * @property {string | null} [artist]
 * @property {string | null} [key]
 * @property {string | null} [body]
 * @property {ExportSongVersion[] | string | null} [versions]
 */

/**
 * The download verdict — the node-safe branch returns it instead of touching
 * the DOM, and the browser branch returns the identical shape.
 * @typedef {object} OnSongDownload
 * @property {boolean} ok
 * @property {string} filename
 * @property {string} text
 */

/**
 * Serialize a setlist into OnSong-compatible text, songs in SETLIST ORDER.
 * Pure — the demo asserts order, agreed keys and the S17 exclusion without a
 * DB or DOM.
 * @param {ExportSetlist | null | undefined} setlist
 * @param {ExportSong[] | null | undefined} songs
 * @returns {string}
 */
export function serializeOnSong(setlist, songs) {
  const itemIds = Array.isArray(setlist?.itemIds) ? setlist.itemIds : []
  const byId = new Map((songs || []).map((s) => [s.id, s]))
  const blocks = []

  for (const songId of itemIds) {
    const song = byId.get(songId)
    if (!song) continue // missing song — nothing to serialize

    // Agreed key: the band's settled key for this item wins, because
    // external-integrations.feature requires the export to carry "agreed keys"
    // and the agreed key is the one that differs from the chart's own. Falling
    // back to the pinned version and then the song key keeps a setlist where
    // nobody agreed anything still exporting correctly.
    const agreed = setlist?.agreedKeys?.[songId]
    let key = agreed || song.key || ''
    if (!agreed) {
      const versionId = setlist?.versionIds?.[songId]
      if (versionId && Array.isArray(song.versions)) {
        const selected = song.versions.find((v) => v.id === versionId)
        if (selected?.key) key = selected.key
      }
    }

    /** @type {string[]} */
    const lines = []
    if (song.title) lines.push(`{title: ${song.title}}`)
    if (song.artist) lines.push(`{artist: ${song.artist}}`)
    if (key) lines.push(`{key: ${key}}`)
    const body = String(song.body || '').trim()
    if (body) lines.push(body)
    blocks.push(lines.join('\n'))
  }

  return blocks.join('\n\n')
}

/**
 * Download the serialized setlist as `<setlist-name>.cho` (Blob + object URL
 * + anchor click). Node guard: returns { ok, filename, text } instead of
 * touching the DOM so the demo can assert the exact payload.
 * @param {ExportSetlist | null | undefined} setlist
 * @param {ExportSong[] | null | undefined} songs
 * @returns {OnSongDownload}
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

// Self-check: node -e "import('./src/domain/setlist/exporters/onsong.js').then(m => m.demo())"
export async function demo() {
  /**
   * @param {unknown} cond
   * @param {string} msg
   */
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`onsong export demo FAILED: ${msg}`)
  }

  const setlist = {
    name: 'Sunday Service',
    itemIds: ['s1', 's2', 's3'],
    versionIds: { s2: 'v2b' },
  }
  const songs = [
    { id: 's1', title: 'Way Maker', artist: 'Sinach', key: 'G major', body: '{title: Way Maker}\n[Verse]\nG  D  Em  C' },
    {
      id: 's2',
      title: 'Oceans (Where Feet May Fail)',
      artist: 'Hillsong UNITED',
      key: 'F major',
      versions: [
        { id: 'v2a', key: 'F major' },
        { id: 'v2b', key: 'E major' },
      ],
      body: '{title: Oceans}\n[Chorus]\nD  A  Bm  G',
      projection: 'vocals-who-leads',
      annotations: 'private rehearsal notes',
    },
    { id: 's3', title: 'Kingdom', artist: 'Maverick City Music', key: '', body: '' },
  ]
  const text = serializeOnSong(setlist, songs)

  // 1. SETLIST ORDER: title directives appear in itemIds order.
  /**
   * @param {string} t
   * @returns {number}
   */
  const titleIndex = (t) => text.indexOf(`{title: ${t}}`)
  assert(titleIndex('Way Maker') !== -1, 'song 1 present')
  assert(titleIndex('Oceans (Where Feet May Fail)') !== -1, 'song 2 present')
  assert(titleIndex('Kingdom') !== -1, 'song 3 present')
  assert(
    titleIndex('Way Maker') < titleIndex('Oceans (Where Feet May Fail)')
      && titleIndex('Oceans (Where Feet May Fail)') < titleIndex('Kingdom'),
    'setlist order preserved',
  )

  // 2. Agreed keys: s2 pins version v2b → E major (NOT the current F major).
  assert(text.includes('{key: E major}'), 'agreed key from the selected version')
  assert(!text.includes('{key: F major}'), 'non-selected version key excluded')
  assert(text.includes('{key: G major}'), 'song key serialized when no version pinned')
  assert(!text.includes('{key: }'), 'no empty key directive')

  // 3. S17: projections/annotations living on the song objects never leak.
  assert(!text.includes('vocals-who-leads'), 'projection excluded')
  assert(!text.includes('private rehearsal notes'), 'annotation excluded')

  // 4. Body verbatim — ChordPro sections preserved.
  assert(text.includes('[Verse]') && text.includes('[Chorus]'), 'chord sections pass through verbatim')

  // 5. Node download path returns the identical payload + slug filename.
  const dl = downloadOnSongFile(setlist, songs)
  assert(dl.ok === true && dl.filename === 'sunday-service.cho', 'node path returns slug filename')
  assert(dl.text === text, 'node path returns identical text')

  console.log('onsong export demo OK')
}