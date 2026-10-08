import { defineSteps } from './index.js'
import { expect } from 'vitest'
import {
  filterSongs,
  filterPublicEntries,
  parseTempoRange,
  songMatchesKey,
  songMatchesTempo,
  matchedChords
} from '../../../domain/library/search.js'

export function defineSearchSteps() {
  defineSteps('search', [
    // Given
    {
      type: 'given',
      pattern: /^I have songs titled (?<titles>.+)$/,
      handler: (ctx, { titles }) => {
        // Split by comma, handle "and" before the last item
        const cleaned = titles.replace(/,\s*and\s+/g, ', ').replace(/\s+and\s+/g, ', ')
        const titlesArray = cleaned.split(',').map(t => t.trim().replace(/^"|"$/g, ''))
        ctx.songs = titlesArray.map((title, i) => ({
          id: String(i + 1),
          title,
          key: 'G major',
          bpm: 80 + i * 15,
          body: `[G]${title} [C]body`
        }))
      }
    },
    {
      type: 'given',
      pattern: /^I have songs with keys and tempos:$/,
      handler: () => {
        // Multi-line fixture handled in test
      }
    },
    {
      type: 'given',
      pattern: /^the catalog has entries (?<entries>.+)$/,
      handler: (ctx, { entries }) => {
        const cleaned = entries.replace(/,\s*and\s+/g, ', ').replace(/\s+and\s+/g, ', ')
        const entriesArray = cleaned.split(',').map(e => e.trim().replace(/^"|"$/g, ''))
        ctx.catalog = entriesArray.map((title, i) => ({
          id: `c${i + 1}`,
          title,
          artist: 'Traditional',
          genre: 'hymn',
          license: 'public-domain'
        }))
      }
    },

    // When
    {
      type: 'when',
      pattern: /^I search for (?<query>.+)$/,
      handler: (ctx, { query }) => {
        const q = query.replace(/^"|"$/g, '')
        ctx.result = filterSongs(ctx.songs, { query: q })
      }
    },
    {
      type: 'when',
      pattern: /^I filter by key (?<key>.+)$/,
      handler: (ctx, { key }) => {
        const k = key.replace(/^"|"$/g, '')
        ctx.result = filterSongs(ctx.songs, { key: k })
      }
    },
    {
      type: 'when',
      pattern: /^I filter by tempo (?<tempo>.+)$/,
      handler: (ctx, { tempo }) => {
        const t = tempo.replace(/^"|"$/g, '')
        ctx.result = filterSongs(ctx.songs, { tempo: t })
      }
    },
    {
      type: 'when',
      pattern: /^I search the catalog for (?<query>.+)$/,
      handler: (ctx, { query }) => {
        const q = query.replace(/^"|"$/g, '')
        ctx.result = filterPublicEntries(ctx.catalog, { query: q })
      }
    },
    {
      type: 'when',
      pattern: /^I filter the catalog by license (?<license>.+)$/,
      handler: (ctx, { license }) => {
        const l = license.replace(/^"|"$/g, '')
        ctx.result = filterPublicEntries(ctx.catalog, { license: l })
      }
    },

    // Then
    {
      type: 'then',
      pattern: /^I see both (?<t1>.+?) and (?<t2>.+?) in the results$/,
      handler: (ctx, { t1, t2 }) => {
        const titles = ctx.result.map(s => s.title)
        const tt1 = t1.replace(/^"|"$/g, '')
        const tt2 = t2.replace(/^"|"$/g, '')
        expect(titles).toEqual(expect.arrayContaining([tt1, tt2]))
      }
    },
    {
      type: 'then',
      pattern: /^I see (?<count>\d+) songs in the results$/,
      handler: (ctx, { count }) => {
        expect(ctx.result.length).toBe(parseInt(count, 10))
      }
    },
    {
      type: 'then',
      pattern: /^I see (?<title>.+?) in the results$/,
      handler: (ctx, { title }) => {
        // This should NOT match "I see N songs in the results"
        if (title.match(/^\d+$/)) return
        const titles = ctx.result.map(s => s.title)
        const tt = title.replace(/^"|"$/g, '')
        expect(titles).toEqual(expect.arrayContaining([tt]))
      }
    },
    {
      type: 'then',
      pattern: /^(?<title>.+) is excluded$/,
      handler: (ctx, { title }) => {
        const t = title.replace(/^"|"$/g, '')
        const found = ctx.result.find(s => s.title === t)
        expect(found).toBeUndefined()
      }
    },
    {
      type: 'then',
      pattern: /^the results are tagged with chord (?<chord>.+)$/,
      handler: (ctx, { chord }) => {
        const c = chord.replace(/^"|"$/g, '')
        for (const song of ctx.result) {
          const chords = matchedChords(song, c)
          expect(chords.length).toBeGreaterThan(0)
        }
      }
    },
    {
      type: 'then',
      pattern: /^the results have key (?<key>.+)$/,
      handler: (ctx, { key }) => {
        const k = key.replace(/^"|"$/g, '')
        for (const song of ctx.result) {
          expect(songMatchesKey(song, k)).toBe(true)
        }
      }
    },
    {
      type: 'then',
      pattern: /^the results are within tempo (?<range>.+)$/,
      handler: (ctx, { range }) => {
        const r = range.replace(/^"|"$/g, '')
        const parsed = parseTempoRange(r)
        for (const song of ctx.result) {
          expect(songMatchesTempo(song, parsed)).toBe(true)
        }
      }
    }
  ])
}