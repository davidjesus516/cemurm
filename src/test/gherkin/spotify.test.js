import { describe, it, vi } from 'vitest'
import { createRunner } from './steps/index.js'
import { defineSpotifySteps } from './steps/spotify.js'
import { canonicalKeyLabel, spotifyKeyToLabel } from '../../integrations/spotify.js'

// Mock scale catalog at top level (like degreeResolver.test.js)
const MOCK_SCALE_CATALOG = [
  { name: 'Major', aliases: ['major', 'maj', 'ionian'] },
  { name: 'Natural Minor', aliases: ['minor', 'min', 'aeolian'] },
  { name: 'Harmonic Minor', aliases: ['harmonic minor'] },
  { name: 'Dorian', aliases: ['dorian'] },
  { name: 'Phrygian', aliases: ['phrygian'] },
  { name: 'Lydian', aliases: ['lydian'] },
  { name: 'Mixolydian', aliases: ['mixolydian'] },
  { name: 'Locrian', aliases: ['locrian'] }
]

vi.mock('../../../data/repositories/scaleCatalog.js', () => ({
  fetchScales: async () => MOCK_SCALE_CATALOG
}))

// Load step definitions
defineSpotifySteps()

// Runner with domain functions bound
const runner = createRunner({
  canonicalKeyLabel,
  spotifyKeyToLabel
})

describe('external-autotagging: CANONICAL KEY LABEL', () => {
  it('Canonicalizes major key labels', async () => {
    await runner.runScenario('spotify', [
      'Given the scale catalog is available',
      'When I canonicalize key label "E major"',
      'Then the canonical form is "E Major"',
      'And the original label is preserved'
    ])
  }, 10000)

  it('Canonicalizes bare key (assumes major)', async () => {
    await runner.runScenario('spotify', [
      'Given the scale catalog is available',
      'When I canonicalize key label "E"',
      'Then the canonical form is "E Major"',
      'And the original label is preserved'
    ])
  }, 10000)

  it('Canonicalizes Ionian alias', async () => {
    await runner.runScenario('spotify', [
      'Given the scale catalog is available',
      'When I canonicalize key label "E Ionian"',
      'Then the canonical form is "E Major"',
      'And the original label is preserved'
    ])
  }, 10000)

  it('Canonicalizes minor key labels', async () => {
    await runner.runScenario('spotify', [
      'Given the scale catalog is available',
      'When I canonicalize key label "Em"',
      'Then the canonical form is "E Natural Minor"',
      'And the original label is preserved'
    ])
  }, 10000)

  it('Converts Spotify key index to label', async () => {
    await runner.runScenario('spotify', [
      'Given the scale catalog is available',
      'When I convert Spotify key "4" with mode "major"',
      'Then the key label is "E major"'
    ])
  }, 10000)

  it('Converts Spotify key index to minor label', async () => {
    await runner.runScenario('spotify', [
      'Given the scale catalog is available',
      'When I convert Spotify key "4" with mode "minor"',
      'Then the key label is "E minor"'
    ])
  }, 10000)
})