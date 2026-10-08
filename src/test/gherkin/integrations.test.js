import { describe, it } from 'vitest'
import { createRunner } from './steps/index.js'
import { defineIntegrationsSteps } from './steps/integrations.js'
import { searchMusicBrainzMetadata } from '../../integrations/musicbrainz.js'
import { fetchLrclibLyrics } from '../../integrations/lrclib.js'
import { metadataOnlyFromUrl } from '../../integrations/urlImport.js'
import { parseSongFile } from '../../domain/chart/importers/onsong.js'

// Load step definitions
defineIntegrationsSteps()

// Runner with domain functions bound
const runner = createRunner({
  searchMusicBrainzMetadata,
  fetchLrclibLyrics,
  metadataOnlyFromUrl,
  parseSongFile
})

describe('external-integrations: MUSICBRAINZ METADATA LOOKUP', () => {
  it('MusicBrainz returns a confident match with year', async () => {
    await runner.runScenario('integrations', [
      'Given I have a title "Way Maker" and artist "Sinach"',
      'When I look up MusicBrainz metadata',
      'Then MusicBrainz returns a match with year between 1970 and 2020'
    ])
  })

  it('MusicBrainz returns no confident match for unconfident title', async () => {
    await runner.runScenario('integrations', [
      'Given I have a title "Something unconfident" and artist "X"',
      'When I look up MusicBrainz metadata',
      'Then MusicBrainz returns no confident match'
    ])
  })
})

describe('external-integrations: LRCLIB LYRICS LOOKUP', () => {
  it('LRCLIB returns lyrics for a known song', async () => {
    await runner.runScenario('integrations', [
      'Given I have a title "Way Maker" and artist "Sinach"',
      'When I look up LRCLIB lyrics',
      'Then LRCLIB returns lyrics containing "Way Maker"'
    ])
  })

  it('LRCLIB returns no confident match for unconfident title', async () => {
    await runner.runScenario('integrations', [
      'Given I have a title "Song unconfident" and artist "X"',
      'When I look up LRCLIB lyrics',
      'Then LRCLIB returns no confident match'
    ])
  })
})

describe('external-integrations: URL METADATA PREFILL', () => {
  it('Chord-site URL returns exact S15 message', async () => {
    await runner.runScenario('integrations', [
      'Given I have a title "Way Maker" and artist "Sinach"',
      'When I import metadata from URL "https://tabs.ultimate-guitar.com/tab/way-maker-chords-4819203"',
      'Then the URL import returns the chord-site message',
      'And the URL import chord-site prefill title is "Way Maker"'
    ])
  })
})

describe('external-integrations: ONS_FILE IMPORT', () => {
  it('Valid OnSong file parses with title and sections', async () => {
    await runner.runScenario('integrations', [
      'Given I have a title "Way Maker" and artist "Sinach"',
      'When I parse an OnSong file with title "Way Maker" and artist "Sinach"',
      'Then the OnSong parse succeeds with title "Way Maker" and sections "Verse 1"'
    ])
  })

  it('Malformed OnSong file returns exact S5 error', async () => {
    await runner.runScenario('integrations', [
      'Given I have a title "" and artist ""',
      'When I parse an OnSong file with title "" and artist ""',
      'Then the OnSong parse fails with exact error "Could not parse this file"'
    ])
  })
})