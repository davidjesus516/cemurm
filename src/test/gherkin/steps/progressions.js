import { defineSteps } from './index.js'
import { expect } from 'vitest'
import { searchProgressions, getProgressionByName, listProgressions } from '../../../domain/music/progressions.js'

export function defineProgressionsSteps() {
  defineSteps('progressions', [
    // Given
    {
      type: 'given',
      pattern: /^the progression catalog is loaded$/,
      handler: () => {
        // Catalog is a module constant, no setup needed
      }
    },

    // When
    {
      type: 'when',
      pattern: /^I search for (?<query>.+)$/,
      handler: (ctx, { query }) => {
        ctx.result = searchProgressions(query.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'when',
      pattern: /^I look up progression (?<name>.+)$/,
      handler: (ctx, { name }) => {
        ctx.result = getProgressionByName(name.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'when',
      pattern: /^I list all progressions$/,
      handler: (ctx) => {
        ctx.result = listProgressions()
      }
    },

    // Then
    {
      type: 'then',
      pattern: /^I find (?<count>\d+) progressions$/,
      handler: (ctx, { count }) => {
        const arr = Array.isArray(ctx.result) ? ctx.result : (ctx.result ? [ctx.result] : [])
        expect(arr.length).toBe(parseInt(count, 10))
      }
    },
    {
      type: 'then',
      pattern: /^the progression (?<name>.+) has pattern (?<pattern>.+)$/,
      handler: (ctx, { name, pattern }) => {
        const progression = Array.isArray(ctx.result)
          ? ctx.result.find(p => p.name === name.replace(/^"|"$/g, ''))
          : ctx.result
        expect(progression).toBeDefined()
        expect(progression.pattern).toBe(pattern.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'then',
      pattern: /^the progression (?<name>.+) belongs to family (?<family>.+)$/,
      handler: (ctx, { name, family }) => {
        const progression = Array.isArray(ctx.result)
          ? ctx.result.find(p => p.name === name.replace(/^"|"$/g, ''))
          : ctx.result
        expect(progression).toBeDefined()
        expect(progression.family).toBe(family.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'then',
      pattern: /^no progression is found$/,
      handler: (ctx) => {
        expect(ctx.result).toBeNull()
      }
    }
  ])
}