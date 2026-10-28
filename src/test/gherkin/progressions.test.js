import { describe, it } from 'vitest'
import { createRunner } from './steps/index.js'
import { defineProgressionsSteps } from './steps/progressions.js'
import { searchProgressions, getProgressionByName, listProgressions } from '../../domain/music/progressions.js'

// Load step definitions
defineProgressionsSteps()

// Runner with domain functions bound
const runner = createRunner({
  searchProgressions,
  getProgressionByName,
  listProgressions
})

describe('music-theory: PROGRESSION SEARCH BY NAME', () => {
  it('Search progressions by name finds matching entries', async () => {
    await runner.runScenario('progressions', [
      'Given the progression catalog is loaded',
      'When I search for "Andalusian"',
      'Then I find 1 progressions',
      'And the progression "Andalusian cadence" has pattern "i - bVII - bVI - V"',
      'And the progression "Andalusian cadence" belongs to family "Flamenco"'
    ])
  })
})

describe('music-theory: PROGRESSION SEARCH BY PATTERN', () => {
  it('Search progressions by pattern finds matching entries', async () => {
    await runner.runScenario('progressions', [
      'Given the progression catalog is loaded',
      'When I search for "ii-V-I"',
      'Then I find 2 progressions',
      'And the progression "ii-V-I (major)" has pattern "ii - V - I"',
      'And the progression "ii-V-I (major)" belongs to family "Jazz"'
    ])
  })
})

describe('music-theory: PROGRESSION LOOKUP BY EXACT NAME', () => {
  it('Exact name lookup returns the progression', async () => {
    await runner.runScenario('progressions', [
      'Given the progression catalog is loaded',
      'When I look up progression "I-IV-V"',
      'Then the progression "I-IV-V" has pattern "I - IV - V"',
      'And the progression "I-IV-V" belongs to family "Blues/Rock"'
    ])
  })

  it('Non-existent progression returns null', async () => {
    await runner.runScenario('progressions', [
      'Given the progression catalog is loaded',
      'When I look up progression "nonexistent"',
      'Then no progression is found'
    ])
  })
})

describe('music-theory: PROGRESSION LIST ALL', () => {
  it('List all returns all progressions', async () => {
    await runner.runScenario('progressions', [
      'Given the progression catalog is loaded',
      'When I list all progressions',
      'Then I find 19 progressions'
    ])
  })
})