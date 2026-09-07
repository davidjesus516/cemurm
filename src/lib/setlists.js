// Mock setlist store.
// Mirrors the future Supabase query surface so chunk C8 can swap the
// implementation without touching the hook or UI.
// Duration is computed on read (join with the songs store), never stored —
// keeps the store lazy and avoids stale totals when a song's duration changes.

import { listSongs } from './songs.js'
import { formatDuration } from './duration.js'

const SETLISTS_KEY = 'cemurm.setlists'
const MAX_SETLISTS = 100

const DEMO_SETLISTS = [
  {
    id: 'demo-setlist-1',
    userId: 'demo-user',
    name: 'Friday Gig',
    itemIds: ['demo-song-1', 'demo-song-2', 'demo-song-3'],
    createdAt: '2026-02-10T10:00:00.000Z',
    updatedAt: '2026-02-10T10:00:00.000Z',
    deletedAt: null,
  },
]

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readAll() {
  const raw = localStorage.getItem(SETLISTS_KEY)
  if (!raw) {
    const seeded = DEMO_SETLISTS.map((s) => ({ ...s, itemIds: [...s.itemIds] }))
    localStorage.setItem(SETLISTS_KEY, JSON.stringify(seeded))
    return seeded
  }
  return JSON.parse(raw)
}

function writeAll(setlists) {
  localStorage.setItem(SETLISTS_KEY, JSON.stringify(setlists))
}

function userSetlists(userId) {
  return readAll().filter(
    (s) => s.userId === userId && s.deletedAt === null,
  )
}

/**
 * Pure join: sum known song durations for itemIds in order.
 * Unknown durations are skipped (only known ones count).
 * Exported so the Node self-check can assert scenario-4 math without localStorage.
 */
export function computeTotalSeconds(itemIds, songs) {
  const byId = new Map(songs.map((s) => [s.id, s]))
  return itemIds.reduce((sum, id) => {
    const duration = byId.get(id)?.durationSeconds || null
    return sum + (duration || 0)
  }, 0)
}

export async function listSetlists(userId) {
  await delay(200)
  return userSetlists(userId)
}

export async function getSetlist(userId, id) {
  await delay(100)
  const setlist = readAll().find(
    (s) => s.id === id && s.userId === userId && s.deletedAt === null,
  )
  if (!setlist) throw new Error('Setlist not found.')
  return setlist
}

export async function createSetlist(userId, { name, itemIds = [] }) {
  await delay(200)

  const trimmed = name?.trim()
  if (!trimmed) throw new Error('Setlist name is required.')

  const setlists = readAll()
  const active = setlists.filter(
    (s) => s.userId === userId && s.deletedAt === null,
  )
  if (active.length >= MAX_SETLISTS) {
    throw new Error(`Setlist cap reached (${MAX_SETLISTS}). Delete one before creating another.`)
  }

  const now = new Date().toISOString()
  const setlist = {
    id: crypto.randomUUID(),
    userId,
    name: trimmed,
    itemIds: [...itemIds],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }

  writeAll([...setlists, setlist])
  return setlist
}

export async function updateSetlist(userId, id, { name, itemIds }) {
  await delay(200)

  const setlists = readAll()
  const idx = setlists.findIndex(
    (s) => s.id === id && s.userId === userId && s.deletedAt === null,
  )
  if (idx === -1) throw new Error('Setlist not found.')

  const setlist = setlists[idx]
  if (name !== undefined) {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Setlist name is required.')
    setlist.name = trimmed
  }
  if (itemIds !== undefined) setlist.itemIds = [...itemIds]
  setlist.updatedAt = new Date().toISOString()

  writeAll(setlists)
  return setlist
}

export async function deleteSetlist(userId, id) {
  await delay(200)

  const setlists = readAll()
  const idx = setlists.findIndex(
    (s) => s.id === id && s.userId === userId && s.deletedAt === null,
  )
  if (idx === -1) throw new Error('Setlist not found.')

  setlists[idx].deletedAt = new Date().toISOString()
  writeAll(setlists)
}

/**
 * Copy a setlist under a new name. Same itemIds, same order.
 * Original is untouched (new id, new timestamps).
 */
export async function duplicateSetlist(userId, id, { name }) {
  await delay(200)

  const trimmed = name?.trim()
  if (!trimmed) throw new Error('Setlist name is required.')

  const setlists = readAll()
  const source = setlists.find(
    (s) => s.id === id && s.userId === userId && s.deletedAt === null,
  )
  if (!source) throw new Error('Setlist not found.')

  const now = new Date().toISOString()
  const copy = {
    id: crypto.randomUUID(),
    userId,
    name: trimmed,
    itemIds: [...source.itemIds],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }

  writeAll([...setlists, copy])
  return copy
}

export async function addSongToSetlist(userId, setlistId, songId) {
  await delay(200)

  const setlists = readAll()
  const idx = setlists.findIndex(
    (s) => s.id === setlistId && s.userId === userId && s.deletedAt === null,
  )
  if (idx === -1) throw new Error('Setlist not found.')

  const setlist = setlists[idx]
  if (setlist.itemIds.includes(songId)) return setlist // idempotent: no-op

  setlist.itemIds.push(songId)
  setlist.updatedAt = new Date().toISOString()
  writeAll(setlists)
  return setlist
}

export async function removeSongFromSetlist(userId, setlistId, songId) {
  await delay(200)

  const setlists = readAll()
  const idx = setlists.findIndex(
    (s) => s.id === setlistId && s.userId === userId && s.deletedAt === null,
  )
  if (idx === -1) throw new Error('Setlist not found.')

  const setlist = setlists[idx]
  const removeAt = setlist.itemIds.indexOf(songId)
  if (removeAt !== -1) {
    setlist.itemIds.splice(removeAt, 1)
    setlist.updatedAt = new Date().toISOString()
    writeAll(setlists)
  }
  return setlist
}

/**
 * Move a song from one index to another (splice-out + insert).
 * Indices are clamped into range; out-of-range moves are no-ops.
 */
export async function moveSongInSetlist(userId, setlistId, fromIndex, toIndex) {
  await delay(200)

  const setlists = readAll()
  const idx = setlists.findIndex(
    (s) => s.id === setlistId && s.userId === userId && s.deletedAt === null,
  )
  if (idx === -1) throw new Error('Setlist not found.')

  const setlist = setlists[idx]
  const len = setlist.itemIds.length
  if (len <= 1) return setlist

  const from = Math.max(0, Math.min(fromIndex, len - 1))
  const to = Math.max(0, Math.min(toIndex, len - 1))
  if (from === to) return setlist

  const [moved] = setlist.itemIds.splice(from, 1)
  setlist.itemIds.splice(to, 0, moved)
  setlist.updatedAt = new Date().toISOString()
  writeAll(setlists)
  return setlist
}

/**
 * Resolve setlist durations by joining with the songs store.
 * Returns { totalSeconds, formatted } (mm:ss, unknown durations omitted).
 */
export async function getSetlistDuration(userId, setlistId) {
  await delay(100)
  const setlist = await getSetlist(userId, setlistId)
  const songs = await listSongs(userId)
  const totalSeconds = computeTotalSeconds(setlist.itemIds, songs)
  return { totalSeconds, formatted: formatDuration(totalSeconds) }
}

export function demo() {
  const cases = [
    [formatDuration(765), '12:45', 'formatDuration(765)'],
    [formatDuration(210), '3:30', 'formatDuration(210)'],
    [formatDuration(0), '0:00', 'formatDuration(0)'],
    [
      computeTotalSeconds(['a', 'b', 'c'], [
        { id: 'a', durationSeconds: 210 },
        { id: 'b', durationSeconds: null }, // unknown — omitted
        { id: 'c', durationSeconds: 315 },
      ]),
      525,
      'unknown duration omitted',
    ],
  ]
  for (const [actual, expected, label] of cases) {
    if (actual !== expected) {
      throw new Error(`setlists demo failed: ${label} expected ${expected}, got ${actual}`)
    }
  }
  console.log(`setlists demo OK: 765s → ${formatDuration(765)} (scenario 4: 3:30+4:00+5:15=12:45)`)
}