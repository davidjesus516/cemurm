// Mock song store.
// Mirrors the future Supabase query surface so chunk C8 can swap the
// implementation without touching the hook or UI.

const SONGS_KEY = 'cemurm.songs'
const MAX_SONGS = 500

const DEMO_SONGS = [
  {
    id: 'demo-song-1',
    userId: 'demo-user',
    title: 'Bohemian Rhapsody',
    key: 'Bb major',
    bpm: 144,
    hasChordChart: false,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'demo-song-2',
    userId: 'demo-user',
    title: 'Imagine',
    key: 'C major',
    bpm: 76,
    hasChordChart: true,
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-01-20T10:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'demo-song-3',
    userId: 'demo-user',
    title: 'Imagine Dragons',
    key: 'D minor',
    bpm: 120,
    hasChordChart: false,
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
    deletedAt: null,
  },
]

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readAll() {
  const raw = localStorage.getItem(SONGS_KEY)
  if (!raw) {
    localStorage.setItem(SONGS_KEY, JSON.stringify(DEMO_SONGS))
    return [...DEMO_SONGS]
  }
  return JSON.parse(raw)
}

function writeAll(songs) {
  localStorage.setItem(SONGS_KEY, JSON.stringify(songs))
}

function userSongs(userId) {
  return readAll().filter(
    (s) => s.userId === userId && s.deletedAt === null,
  )
}

export async function listSongs(userId) {
  await delay(200)
  return userSongs(userId)
}

export async function addSong(userId, { title, key, bpm, hasChordChart }) {
  await delay(200)

  const trimmed = title?.trim()
  if (!trimmed) throw new Error('Title is required.')

  const songs = readAll()
  const active = songs.filter(
    (s) => s.userId === userId && s.deletedAt === null,
  )
  if (active.length >= MAX_SONGS) {
    throw new Error(`Repertoire cap reached (${MAX_SONGS} songs). Remove a song before adding more.`)
  }

  const now = new Date().toISOString()
  const song = {
    id: crypto.randomUUID(),
    userId,
    title: trimmed,
    key: key?.trim() || '',
    bpm: bpm ? Number(bpm) : null,
    hasChordChart: Boolean(hasChordChart),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  writeAll([...songs, song])
  return song
}

export async function updateSong(userId, id, { title, key, bpm }) {
  await delay(200)

  const songs = readAll()
  const idx = songs.findIndex(
    (s) => s.id === id && s.userId === userId && s.deletedAt === null,
  )
  if (idx === -1) throw new Error('Song not found.')

  if (title !== undefined) {
    const trimmed = title.trim()
    if (!trimmed) throw new Error('Title is required.')
    songs[idx].title = trimmed
  }
  if (key !== undefined) songs[idx].key = key?.trim() || ''
  if (bpm !== undefined) songs[idx].bpm = bpm ? Number(bpm) : null
  songs[idx].updatedAt = new Date().toISOString()

  writeAll(songs)
  return songs[idx]
}

export async function deleteSong(userId, id) {
  await delay(200)

  const songs = readAll()
  const idx = songs.findIndex(
    (s) => s.id === id && s.userId === userId && s.deletedAt === null,
  )
  if (idx === -1) throw new Error('Song not found.')

  songs[idx].deletedAt = new Date().toISOString()
  writeAll(songs)
}

export async function searchSongs(userId, query) {
  await delay(200)

  const q = query.trim().toLowerCase()
  if (!q) return userSongs(userId)

  return userSongs(userId).filter((s) =>
    s.title.toLowerCase().includes(q),
  )
}
