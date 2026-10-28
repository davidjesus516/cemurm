import { describe, it } from 'vitest'
import { createRunner } from './steps/index.js'
import { defineSearchSteps } from './steps/search.js'
import {
  filterSongs,
  filterPublicEntries,
  parseTempoRange,
  songMatchesKey,
  songMatchesTempo,
  matchedChords
} from '../../domain/library/search.js'

// Load step definitions
defineSearchSteps()

// Runner with domain functions bound
const runner = createRunner({
  filterSongs,
  filterPublicEntries,
  parseTempoRange,
  songMatchesKey,
  songMatchesTempo,
  matchedChords
})

describe('search-and-discovery: BASIC SEARCH', () => {
  it('Search songs by free-text query', async () => {
    await runner.runScenario('search', [
      'Given I have songs titled "Amazing Grace", "Grace of My Mind", and "Amazing Day"',
      'When I search for "Amazing"',
      'Then I see both "Amazing Grace" and "Amazing Day" in the results',
      'And "Grace of My Mind" is excluded'
    ])
  })

  it('Search songs by chord name', async () => {
    await runner.runScenario('search', [
      'Given I have songs titled "Amazing Grace", "Grace of My Mind", and "Amazing Day"',
      'When I search for "G major"',
      'Then I see both "Amazing Grace" and "Amazing Day" in the results',
      'And the results are tagged with chord "G"'
    ])
  })

  it('Filter songs by key signature', async () => {
    await runner.runScenario('search', [
      'Given I have songs titled "Amazing Grace", "Grace of My Mind", and "Amazing Day"',
      'When I filter by key "G major"',
      'Then I see both "Amazing Grace" and "Amazing Day" in the results',
      'And the results have key "G major"'
    ])
  })

  it('Filter songs by tempo range', async () => {
    await runner.runScenario('search', [
      'Given I have songs titled "Amazing Grace", "Grace of My Mind", and "Amazing Day"',
      'When I filter by tempo "70-100"',
      'Then I see both "Amazing Grace" and "Grace of My Mind" in the results',
      'And the results are within tempo "70-100"'
    ])
  })
})

describe('public-library-community: CATALOG SEARCH + LICENSE FILTER', () => {
  it('Search public catalog by free-text query', async () => {
    await runner.runScenario('search', [
      'Given the catalog has entries "Amazing Grace", "Scarborough Fair", and "Down to the River"',
      'When I search the catalog for "amazing"',
      'Then I see "Amazing Grace" in the results',
      'And I see 1 songs in the results'
    ])
  })

  it('Search public catalog matches artist name', async () => {
    await runner.runScenario('search', [
      'Given the catalog has entries "Amazing Grace", "Scarborough Fair", and "Down to the River"',
      'When I search the catalog for "traditional"',
      'Then I see both "Scarborough Fair" and "Down to the River" in the results',
      'And I see 3 songs in the results'
    ])
  })

  it('Filter public catalog by license', async () => {
    await runner.runScenario('search', [
      'Given the catalog has entries "Amazing Grace", "Scarborough Fair", and "Down to the River"',
      'When I filter the catalog by license "public-domain"',
      'Then I see both "Amazing Grace" and "Scarborough Fair" in the results',
      'And I see 3 songs in the results'
    ])
  })
})

describe('repertoire-mgmt: TITLE MATCH', () => {
  it('Title match is case-insensitive', async () => {
    await runner.runScenario('search', [
      'Given I have songs titled "Amazing Grace", "Grace of My Mind", and "Amazing Day"',
      'When I search for "amazing"',
      'Then I see both "Amazing Grace" and "Amazing Day" in the results',
      'And "Grace of My Mind" is excluded'
    ])
  })
})

describe('search-and-discovery: CHORD NAME SEARCH', () => {
  it('Chord query "G" matches G and G7 chords', async () => {
    await runner.runScenario('search', [
      'Given I have songs titled "Song One", "Song Two", and "Song Three"',
      'When I search for "G"',
      'Then I see both "Song One" and "Song Two" in the results',
      'And the results are tagged with chord "G"'
    ])
  })
})