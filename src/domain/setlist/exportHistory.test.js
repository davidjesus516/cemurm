import { describe, expect, it } from 'vitest'

import {
  appendEntry,
  createEntry,
  EXPORT_HISTORY_LIMIT,
  formatLabel,
  historyKey,
  fileKey,
  isAvailableOffline,
  markUnavailable,
  sortByRecency,
} from './exportHistory.js'

// features/export-and-sharing.feature:158-172 — "I see a chronological list of
// all exports" and "each entry shows the format, date, and file size".
const FILE = {
  ok: true,
  filename: 'Friday-Gig-setlist.chordpro',
  text: '{title: Way Maker}\n',
  mimeType: 'text/plain',
}

describe('keys', () => {
  it('scopes the history and the cached bytes per user', () => {
    expect(historyKey('u1')).toBe('export-history:v1:u1')
    expect(fileKey('u1', 'e1')).toBe('export-file:v1:u1:e1')
    expect(historyKey('u1')).not.toBe(historyKey('u2'))
  })
})

describe('formatLabel', () => {
  it('maps a dispatcher key to the menu label', () => {
    expect(formatLabel('chordpro')).toBe('ChordPro')
    expect(formatLabel('txt')).toBe('Plain text outline')
  })

  it('falls back to the raw key for a format this build no longer offers', () => {
    expect(formatLabel('musicxml')).toBe('musicxml')
  })
})

describe('createEntry', () => {
  it('records the size of the text the browser actually writes', () => {
    const entry = createEntry({
      id: 'e1',
      setlistId: 's1',
      setlistName: 'Friday Gig',
      format: 'chordpro',
      file: FILE,
      savedAt: '2026-11-01T10:00:00.000Z',
    })

    expect(entry).toEqual({
      id: 'e1',
      setlistId: 's1',
      setlistName: 'Friday Gig',
      format: 'chordpro',
      filename: 'Friday-Gig-setlist.chordpro',
      mimeType: 'text/plain',
      savedAt: '2026-11-01T10:00:00.000Z',
      bytes: 19,
      availableOffline: true,
    })
  })

  it('counts UTF-8 bytes, not UTF-16 code units', () => {
    const entry = createEntry({
      id: 'e2',
      setlistId: 's1',
      setlistName: 'Café',
      format: 'txt',
      file: { ...FILE, text: 'café' },
      savedAt: '2026-11-01T10:00:00.000Z',
    })

    expect(entry.bytes).toBe(5)
  })

  it('survives a setlist with no name', () => {
    const entry = createEntry({
      id: 'e3',
      setlistId: 's1',
      setlistName: '',
      format: 'txt',
      file: FILE,
      savedAt: '2026-11-01T10:00:00.000Z',
    })

    expect(entry.setlistName).toBe('Untitled setlist')
  })
})

describe('sortByRecency', () => {
  it('puts the newest export first', () => {
    const older = { id: 'a', savedAt: '2026-11-01T10:00:00.000Z' }
    const newer = { id: 'b', savedAt: '2026-11-03T10:00:00.000Z' }
    const middle = { id: 'c', savedAt: '2026-11-02T10:00:00.000Z' }

    expect(sortByRecency([older, newer, middle]).map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate the input', () => {
    const entries = [{ id: 'a', savedAt: '2026-11-01T10:00:00.000Z' }]
    const sorted = sortByRecency(entries)

    expect(sorted).not.toBe(entries)
    expect(entries).toHaveLength(1)
  })

  it('tolerates an unreadable timestamp by keeping it last', () => {
    const bad = { id: 'bad', savedAt: 'not-a-date' }
    const good = { id: 'good', savedAt: '2026-11-01T10:00:00.000Z' }

    expect(sortByRecency([bad, good]).map((e) => e.id)).toEqual(['good', 'bad'])
  })
})

describe('appendEntry', () => {
  it('adds the new export at the front', () => {
    const older = { id: 'a', savedAt: '2026-11-01T10:00:00.000Z' }
    const newer = { id: 'b', savedAt: '2026-11-02T10:00:00.000Z' }

    expect(appendEntry([older], newer).map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('replaces an entry with the same id instead of duplicating it', () => {
    const first = { id: 'a', savedAt: '2026-11-01T10:00:00.000Z', bytes: 10 }
    const regenerated = { id: 'a', savedAt: '2026-11-02T10:00:00.000Z', bytes: 12 }

    const result = appendEntry([first], regenerated)

    expect(result).toHaveLength(1)
    expect(result[0].bytes).toBe(12)
  })

  it('caps the history and drops the oldest entry', () => {
    const entries = Array.from({ length: EXPORT_HISTORY_LIMIT }, (_, i) => ({
      id: `e${i}`,
      savedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    }))
    const newest = { id: 'newest', savedAt: '2027-01-01T00:00:00.000Z' }

    const result = appendEntry(entries, newest)

    expect(result).toHaveLength(EXPORT_HISTORY_LIMIT)
    expect(result[0].id).toBe('newest')
    expect(result.some((e) => e.id === 'e0')).toBe(false)
  })

  it('starts a history from an empty or unreadable store', () => {
    const entry = { id: 'a', savedAt: '2026-11-01T10:00:00.000Z' }

    expect(appendEntry([], entry)).toHaveLength(1)
    expect(appendEntry(null, entry)).toHaveLength(1)
  })
})

describe('markUnavailable', () => {
  it('marks one entry as no longer available offline and leaves the rest alone', () => {
    const entries = [
      { id: 'a', availableOffline: true },
      { id: 'b', availableOffline: true },
    ]

    const result = markUnavailable(entries, 'a')

    expect(result.find((e) => e.id === 'a').availableOffline).toBe(false)
    expect(result.find((e) => e.id === 'b').availableOffline).toBe(true)
  })

  it('keeps the entry: the history outlives the cached file', () => {
    const result = markUnavailable([{ id: 'a', availableOffline: true }], 'a')

    expect(result).toHaveLength(1)
    expect(isAvailableOffline(result[0])).toBe(false)
  })

  it('is a no-op for an unknown id', () => {
    const entries = [{ id: 'a', availableOffline: true }]

    expect(markUnavailable(entries, 'zzz')).toHaveLength(1)
    expect(markUnavailable(entries, 'zzz')[0].availableOffline).toBe(true)
  })
})

describe('isAvailableOffline', () => {
  it('treats a legacy entry without the flag as available', () => {
    expect(isAvailableOffline({ id: 'a' })).toBe(true)
    expect(isAvailableOffline({ id: 'a', availableOffline: true })).toBe(true)
    expect(isAvailableOffline({ id: 'a', availableOffline: false })).toBe(false)
  })
})
