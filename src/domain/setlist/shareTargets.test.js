// Share targets for a setlist — features/export-and-sharing.feature:55-131.
//
// Pure and node-safe: the module builds the deep link, the summary and the
// target URLs. The page does the talking to the clipboard, the browser and
// the share sheet, so these are the parts a test can pin.

import { describe, expect, it } from 'vitest'

import {
  emailUrl,
  setlistDeepLink,
  shareMessage,
  shareSummary,
  telegramUrl,
  whatsappUrl,
} from './shareTargets.js'

const SONGS = [
  { id: 's1', title: 'Amazing Grace', artist: 'John Newton', key: 'G' },
  { id: 's2', title: 'Great Is Thy Faithfulness', artist: '', key: 'D' },
]

const SETLIST = { id: 'set-1', name: 'Weekly Rehearsal', itemIds: ['s1', 's2'] }

describe('setlistDeepLink', () => {
  it('points at the setlist route with the setlist id', () => {
    expect(setlistDeepLink(SETLIST, 'https://cemurm.app')).toBe(
      'https://cemurm.app/setlists/set-1',
    )
  })

  it('falls back to the path alone when there is no origin', () => {
    expect(setlistDeepLink(SETLIST, '')).toBe('/setlists/set-1')
  })

  it('survives a setlist with no id', () => {
    expect(setlistDeepLink({ name: 'No id' }, 'https://cemurm.app')).toBe(
      'https://cemurm.app/setlists/',
    )
  })
})

describe('shareSummary', () => {
  it('names the setlist and counts its songs', () => {
    const text = shareSummary(SETLIST, SONGS)

    expect(text).toContain('Weekly Rehearsal')
    expect(text).toContain('2 songs')
  })

  it('uses the singular for one song', () => {
    expect(shareSummary({ ...SETLIST, itemIds: ['s1'] }, SONGS)).toContain('1 song')
  })

  it('lists the song titles in setlist order', () => {
    const text = shareSummary(SETLIST, SONGS)

    expect(text.indexOf('Amazing Grace')).toBeLessThan(
      text.indexOf('Great Is Thy Faithfulness'),
    )
  })

  it('omits a song that is not in the library', () => {
    const text = shareSummary({ ...SETLIST, itemIds: ['s1', 'gone'] }, SONGS)

    expect(text).toContain('1 song')
    expect(text).not.toContain('gone')
  })
})

describe('shareMessage', () => {
  it('carries the summary and the deep link', () => {
    const message = shareMessage(SETLIST, SONGS, 'https://cemurm.app')

    expect(message).toContain('Weekly Rehearsal')
    expect(message).toContain('https://cemurm.app/setlists/set-1')
  })
})

describe('whatsappUrl', () => {
  it('encodes the message', () => {
    const url = whatsappUrl('Gig Tonight\nhttps://cemurm.app/setlists/set-1')

    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(url)).toContain('https://cemurm.app/setlists/set-1')
  })
})

describe('telegramUrl', () => {
  it('carries both the link and the message', () => {
    const url = telegramUrl('Rehearsal Tomorrow', 'https://cemurm.app/setlists/set-1')

    expect(url.startsWith('https://t.me/share/url?')).toBe(true)
    expect(decodeURIComponent(url)).toContain('url=https://cemurm.app/setlists/set-1')
    expect(decodeURIComponent(url)).toContain('text=Rehearsal Tomorrow')
  })
})

describe('emailUrl', () => {
  it('reads "Rehearsal Setlist — <name>" as the subject', () => {
    const url = emailUrl({ subject: 'Rehearsal Setlist — Weekly Rehearsal', body: 'hi' })

    expect(url.startsWith('mailto:?')).toBe(true)
    expect(decodeURIComponent(url)).toContain('subject=Rehearsal Setlist — Weekly Rehearsal')
  })

  it('carries the body', () => {
    const url = emailUrl({ subject: 'Rehearsal Setlist — Weekly Rehearsal', body: 'Gig tonight' })

    expect(decodeURIComponent(url)).toContain('body=Gig tonight')
  })
})
