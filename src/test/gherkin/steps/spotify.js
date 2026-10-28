import { defineSteps } from '../steps/index.js'
import { expect } from 'vitest'
import { canonicalKeyLabel, spotifyKeyToLabel } from '../../../integrations/spotify.js'

export function defineSpotifySteps() {
  defineSteps('spotify', [
    // Given
    {
      type: 'given',
      pattern: /^the scale catalog is available$/,
      handler: (ctx) => {
        // Mark that we should use mock - the actual mock is set up in the test file
        ctx.useMockScales = true
      }
    },

    // When
    {
      type: 'when',
      pattern: /^I canonicalize key label (?<label>.+)$/,
      handler: async (ctx, { label }) => {
        // canonicalKeyLabel uses fetchScales internally which is mocked at test file level
        ctx.canonicalResult = await canonicalKeyLabel(label.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'when',
      pattern: /^I convert Spotify key (?<keyIndex>.+) with mode (?<mode>.+)$/,
      handler: (ctx, { keyIndex, mode }) => {
        const idx = keyIndex.replace(/^"|"$/g, '')
        const m = mode.replace(/^"|"$/g, '')
        ctx.keyLabelResult = spotifyKeyToLabel(idx === 'null' ? null : idx, m === 'null' ? null : m)
      }
    },

    // Then
    {
      type: 'then',
      pattern: /^the canonical form is (?<canonical>.+)$/,
      handler: (ctx, { canonical }) => {
        expect(ctx.canonicalResult.canonical).toBe(canonical.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'then',
      pattern: /^the original label is preserved$/,
      handler: (ctx) => {
        expect(ctx.canonicalResult.label).toBeDefined()
      }
    },
    {
      type: 'then',
      pattern: /^the key label is (?<label>.+)$/,
      handler: (ctx, { label }) => {
        expect(ctx.keyLabelResult).toBe(label.replace(/^"|"$/g, ''))
      }
    }
  ])
}