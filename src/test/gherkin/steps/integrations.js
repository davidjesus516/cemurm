import { defineSteps } from './index.js'
import { expect } from 'vitest'
import { searchMusicBrainzMetadata } from '../../../integrations/musicbrainz.js'
import { fetchLrclibLyrics } from '../../../integrations/lrclib.js'
import { metadataOnlyFromUrl } from '../../../integrations/urlImport.js'
import { parseSongFile } from '../../../domain/chart/importers/onsong.js'

export function defineIntegrationsSteps() {
  defineSteps('integrations', [
    // Given
    {
      type: 'given',
      pattern: /^I have a title (?<title>.+) and artist (?<artist>.+)$/,
      handler: (ctx, { title, artist }) => {
        ctx.query = {
          title: title.replace(/^"|"$/g, ''),
          artist: artist.replace(/^"|"$/g, '')
        }
      }
    },

    // When
    {
      type: 'when',
      pattern: /^I look up MusicBrainz metadata$/,
      handler: async (ctx) => {
        ctx.mbResult = await searchMusicBrainzMetadata(ctx.query)
      }
    },
    {
      type: 'when',
      pattern: /^I look up LRCLIB lyrics$/,
      handler: async (ctx) => {
        ctx.lrcResult = await fetchLrclibLyrics(ctx.query)
      }
    },
    {
      type: 'when',
      pattern: /^I import metadata from URL (?<url>.+)$/,
      handler: async (ctx, { url }) => {
        ctx.urlResult = await metadataOnlyFromUrl(url.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'when',
      pattern: /^I parse an OnSong file with title (?<title>.+) and artist (?<artist>.+)$/,
      handler: async (ctx, { title, artist }) => {
        const t = title.replace(/^"|"$/g, '')
        const a = artist.replace(/^"|"$/g, '')
        // If both title and artist are empty, create truly malformed content
        const onsongContent = (t === '' && a === '')
          ? '=!=-=?%%$§'  // Binary-ish noise from demo
          : `{title: ${t}}\n{artist: ${a}}\n{genre: worship}\n[S:Verse 1]\n[G]Amazing [C]grace`
        ctx.onsongResult = parseSongFile(onsongContent, 'test.onsong')
      }
    },

    // Then
    {
      type: 'then',
      pattern: /^MusicBrainz returns a match with year between (?<min>\d+) and (?<max>\d+)$/,
      handler: (ctx, { min, max }) => {
        expect(ctx.mbResult.ok).toBe(true)
        expect(ctx.mbResult.match).not.toBeNull()
        expect(ctx.mbResult.match.year).toBeGreaterThanOrEqual(parseInt(min, 10))
        expect(ctx.mbResult.match.year).toBeLessThanOrEqual(parseInt(max, 10))
      }
    },
    {
      type: 'then',
      pattern: /^MusicBrainz returns no confident match$/,
      handler: (ctx) => {
        expect(ctx.mbResult.ok).toBe(true)
        expect(ctx.mbResult.match).toBeNull()
      }
    },
    {
      type: 'then',
      pattern: /^LRCLIB returns lyrics containing (?<text>.+)$/,
      handler: (ctx, { text }) => {
        expect(ctx.lrcResult.ok).toBe(true)
        expect(ctx.lrcResult.match).not.toBeNull()
        expect(ctx.lrcResult.match.lyrics).toContain(text.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'then',
      pattern: /^LRCLIB returns no confident match$/,
      handler: (ctx) => {
        expect(ctx.lrcResult.ok).toBe(true)
        expect(ctx.lrcResult.match).toBeNull()
      }
    },
    {
      type: 'then',
      pattern: /^the URL import returns the chord-site message$/,
      handler: (ctx) => {
        expect(ctx.urlResult.ok).toBe(true)
        expect(ctx.urlResult.chordSite).toBe(true)
        expect(ctx.urlResult.message).toBe("We don't import content from chord sites — paste your own chart")
      }
    },
    {
      type: 'then',
      pattern: /^the URL import prefill title is (?<title>.+)$/,
      handler: (ctx, { title }) => {
        expect(ctx.urlResult.ok).toBe(true)
        expect(ctx.urlResult.chordSite).toBe(false)
        expect(ctx.urlResult.prefill.title).toBe(title.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'then',
      pattern: /^the URL import chord-site prefill title is (?<title>.+)$/,
      handler: (ctx, { title }) => {
        expect(ctx.urlResult.ok).toBe(true)
        expect(ctx.urlResult.chordSite).toBe(true)
        expect(ctx.urlResult.prefill.title).toBe(title.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'then',
      pattern: /^the OnSong parse succeeds with title (?<title>.+) and sections (?<sections>.+)$/,
      handler: (ctx, { title, sections }) => {
        expect(ctx.onsongResult.ok).toBe(true)
        expect(ctx.onsongResult.song.title).toBe(title.replace(/^"|"$/g, ''))
        const expectedSections = sections.replace(/^"|"$/g, '').split(',').map(s => s.trim())
        expect(ctx.onsongResult.song.sections).toEqual(expectedSections)
      }
    },
    {
      type: 'then',
      pattern: /^the OnSong parse fails with exact error (?<error>.+)$/,
      handler: (ctx, { error }) => {
        expect(ctx.onsongResult.ok).toBe(false)
        expect(ctx.onsongResult.error).toBe(error.replace(/^"|"$/g, ''))
      }
    }
  ])
}