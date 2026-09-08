// Mock song store.
// Mirrors the future Supabase query surface so chunk C8 can swap the
// implementation without touching the hook or UI.

import { computeReadiness } from './readiness.js'

const SONGS_KEY = 'cemurm.songs'
const MAX_SONGS = 500

const DEMO_SONGS = [
  {
    id: 'demo-song-1',
    userId: 'demo-user',
    title: 'Bohemian Rhapsody',
    key: 'Bb major',
    bpm: 144,
    hasChordChart: true,
    durationSeconds: 210,
    body: `{title: Bohemian Rhapsody}
{artist: Queen}
{key: Bb}

{section: Intro}
[C]Is this the real [G]life? [Am]Is this just fan[F]tasy?
[Am]Caught in a land[Bb]slide, [G]no escape from real[Am]ity

{section: Chorus}
[Gm]Mama, [F]just killed a man
[Cm]Put a gun against his head
[Gm]Pulled my trigger, now he's [F]dead
[Gm]Mama, [F]life had just be[Cm]gun`,
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
    durationSeconds: 240,
    body: `{title: Imagine}
{artist: John Lennon}
{key: C}

{section: Verse 1}
[C]Imagine there's no [Em]heaven
[Am]It's easy if you [F]try
[C]No hell be[Em]neath us
[Am]Above us, only [F]sky

{section: Chorus}
[C]You may say I'm a [F]dreamer
[Am]But I'm not the only [F]one
[C]I hope some[F]day you'll join us
[Am]And the world will be as [F]one`,
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
    durationSeconds: 315,
    body: '',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
    deletedAt: null,
  },
]

// Seed demo songs with computed status on first load.
function hydrateSeeds(songs) {
  return songs.map((s) => {
    if (s.status) return s // already hydrated
    const { status } = computeReadiness(s)
    return { ...s, status, transitionHistory: s.transitionHistory || [] }
  })
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readAll() {
  const raw = localStorage.getItem(SONGS_KEY)
  if (!raw) {
    const seeded = hydrateSeeds(DEMO_SONGS)
    localStorage.setItem(SONGS_KEY, JSON.stringify(seeded))
    return [...seeded]
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

/**
 * Record a state transition in the song's history.
 * ponytail: inline helper, one call site — no abstraction needed.
 */
function recordTransition(song, from, to, by = 'owner', reason = '') {
  song.transitionHistory = song.transitionHistory || []
  song.transitionHistory.push({ from, to, at: new Date().toISOString(), by, reason })
}

/**
 * List songs for a user. Supports optional filter for retired songs.
 * Backward-compatible: listSongs(userId) returns all active songs.
 * listSongs(userId, { retired: true }) returns only retired songs.
 * listSongs(userId, { retired: false }) or listSongs(userId, { status: 'draft' })
 *   returns active non-retired songs (same as default).
 */
export async function listSongs(userId, filter = {}) {
  await delay(200)
  const songs = userSongs(userId)
  if (filter.retired) return songs.filter((s) => s.status === 'retired')
  if (filter.status) return songs.filter((s) => s.status === filter.status)
  return songs.filter((s) => s.status !== 'retired')
}

/**
 * Add a new song. Computes initial status from content.
 */
export async function addSong(userId, { title, key, bpm, hasChordChart, body, durationSeconds }) {
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
    body: body || '',
    durationSeconds: durationSeconds ? Number(durationSeconds) : null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }

  // Compute initial status
  const { status } = computeReadiness(song)
  song.status = status
  song.transitionHistory = []

  writeAll([...songs, song])
  return song
}

export async function getSong(userId, id) {
  await delay(100)
  const songs = readAll()
  const song = songs.find(
    (s) => s.id === id && s.userId === userId && s.deletedAt === null,
  )
  if (!song) throw new Error('Song not found.')
  return song
}

/**
 * Update a song. After update, recompute readiness if not retired.
 * Record lineage transitions when status changes.
 */
export async function updateSong(userId, id, { title, key, bpm, body, durationSeconds }) {
  await delay(200)

  const songs = readAll()
  const idx = songs.findIndex(
    (s) => s.id === id && s.userId === userId && s.deletedAt === null,
  )
  if (idx === -1) throw new Error('Song not found.')

  const song = songs[idx]

  if (title !== undefined) {
    const trimmed = title.trim()
    if (!trimmed) throw new Error('Title is required.')
    song.title = trimmed
  }
  if (key !== undefined) song.key = key?.trim() || ''
  if (bpm !== undefined) song.bpm = bpm ? Number(bpm) : null
  if (durationSeconds !== undefined) song.durationSeconds = durationSeconds ? Number(durationSeconds) : null
  if (body !== undefined) song.body = body
  song.updatedAt = new Date().toISOString()

  // Recompute readiness unless retired
  if (song.status !== 'retired') {
    const prevStatus = song.status
    const { status: newStatus } = computeReadiness(song)
    song.status = newStatus
    if (prevStatus !== newStatus) {
      const reason = newStatus === 'ready'
        ? 'Chart completed'
        : `Chart incomplete: ${computeReadiness(song).reason}`
      recordTransition(song, prevStatus, newStatus, 'owner', reason)
    }
  }

  writeAll(songs)
  return song
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

/**
 * Retire a song → status becomes 'retired'. Leaves the active set.
 * Retire ≠ delete (delete uses deletedAt soft-delete).
 */
export async function retireSong(userId, id) {
  await delay(200)

  const songs = readAll()
  const idx = songs.findIndex(
    (s) => s.id === id && s.userId === userId && s.deletedAt === null,
  )
  if (idx === -1) throw new Error('Song not found.')

  const song = songs[idx]
  if (song.status === 'retired') return song // idempotent

  const prevStatus = song.status
  song.status = 'retired'
  song.updatedAt = new Date().toISOString()
  recordTransition(song, prevStatus, 'retired', 'owner', 'Retired')

  writeAll(songs)
  return song
}

/**
 * Reactivate a retired song → recompute readiness from content.
 * Returns the song with its new status (ready or draft).
 */
export async function reactivateSong(userId, id) {
  await delay(200)

  const songs = readAll()
  const idx = songs.findIndex(
    (s) => s.id === id && s.userId === userId && s.deletedAt === null,
  )
  if (idx === -1) throw new Error('Song not found.')

  const song = songs[idx]
  if (song.status !== 'retired') return song // idempotent

  const { status } = computeReadiness(song)
  song.status = status
  song.updatedAt = new Date().toISOString()
  recordTransition(song, 'retired', status, 'owner', 'Reactivated')

  writeAll(songs)
  return song
}
