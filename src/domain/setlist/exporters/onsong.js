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
// PURE after ADR 0002 refactor 3: downloadOnSongFile touches `document` and
// now lives in integrations/download.js (the webMidi.js precedent for a
// browser-platform shim). The serializer below is the whole module, so the
// demo asserts the exact payload without a DB or DOM.

/**
 * Serialize a setlist into OnSong-compatible text, songs in SETLIST ORDER.
 * Pure — the demo asserts order, agreed keys and the S17 exclusion without a
 * DB or DOM.
 */
export function serializeOnSong(setlist, songs) {
  const itemIds = Array.isArray(setlist?.itemIds) ? setlist.itemIds : []
  const byId = new Map((songs || []).map((s) => [s.id, s]))
  const blocks = []

  for (const songId of itemIds) {
    const song = byId.get(songId)
    if (!song) continue // missing song — nothing to serialize

    // Agreed key: the item's pinned version wins; otherwise the song's
    // current version key (flattened song.key).
    let key = song.key || ''
    const versionId = setlist?.versionIds?.[songId]
    if (versionId && Array.isArray(song.versions)) {
      const selected = song.versions.find((v) => v.id === versionId)
      if (selected?.key) key = selected.key
    }

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
 * MOVED to integrations/download.js — this touches `document`, and domain/ is
 * pure (ADR 0002 rule 3, refactor 3). The serializer above is unchanged and
 * is what integrations/download.js calls.
 */

// Self-check: node -e "import('./src/domain/setlist/exporters/onsong.js').then(m => m.demo())"
export async function demo() {
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

  // 5. The download path (slug filename, DOM) is covered by
  //    integrations/download.js demo, which now owns it. Here we only pin that
  //    the serializer holds no hidden state.
  assert(serializeOnSong(setlist, songs) === text, 'serializeOnSong is pure (no hidden state)')

  console.log('onsong export demo OK')
}