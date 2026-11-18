// Setlist sharing — the deep link, the summary and the three integrated
// targets. These assert the exact strings a share sheet receives, which is the
// only half of the scenarios that is deterministic outside a browser:
//   "a link is copied to my clipboard"        (features/export-and-sharing.feature:55-60)
//   "a share sheet opens with the setlist summary" (:102-108, :109-113, :115-121)
//
// The token/expiry, QR, embed, proximity and PNG scenarios are unimplemented
// and deliberately have no assertion here — a test would pin behaviour that
// does not exist.

import { describe, expect, it } from 'vitest'

import {
  SHARE_TARGETS,
  setlistDeepLink,
  setlistShareSummary,
  shareSubject,
  shareTarget,
  shareTargets,
} from './share.js'

const SONGS = [
  { id: 's1', title: 'Amazing Grace', key: 'G', body: 'Amazing [G]grace' },
  { id: 's2', title: 'Great Is Thy Faithfulness', key: 'D', body: 'Great is thy [D]faithfulness' },
]

const SETLIST = {
  id: 'set-1',
  name: 'Rehearsal Set',
  itemIds: ['s1', 's2'],
  durationLabel: '8 min',
}

describe('setlistDeepLink', () => {
  it('builds an absolute link from the app origin', () => {
    expect(setlistDeepLink('set-1', 'https://app.cemurm.test')).toBe(
      'https://app.cemurm.test/setlists/set-1',
    )
  })

  it('trims a trailing slash and encodes the id', () => {
    expect(setlistDeepLink('a b', 'https://app.cemurm.test/')).toBe(
      'https://app.cemurm.test/setlists/a%20b',
    )
  })
})

describe('setlistShareSummary', () => {
  const link = 'https://app.cemurm.test/setlists/set-1'

  it('lists the songs in setlist order with the link last', () => {
    const summary = setlistShareSummary(SETLIST, SONGS, link)

    expect(summary.split('\n')).toEqual([
      'Rehearsal Set',
      '2 songs · 8 min',
      '',
      '1. Amazing Grace',
      '2. Great Is Thy Faithfulness',
      '',
      `Open in CEMURM: ${link}`,
    ])
  })

  it('carries no keys, chords or notes', () => {
    const summary = setlistShareSummary(SETLIST, SONGS, link)

    expect(summary).not.toContain('[G]')
    expect(summary).not.toContain('key')
  })

  it('reads as a single song and drops an unknown duration', () => {
    const summary = setlistShareSummary(
      { id: 'set-2', name: 'Solo', itemIds: ['s1'], durationLabel: '—' },
      SONGS,
      link,
    )

    expect(summary).toContain('1 song\n')
    expect(summary).not.toContain('—')
  })
})

describe('shareTarget', () => {
  const origin = 'https://app.cemurm.test'
  const link = 'https://app.cemurm.test/setlists/set-1'

  it('puts the whole summary in the WhatsApp text parameter', () => {
    const target = shareTarget(SETLIST, SONGS, 'whatsapp', origin)

    expect(target.href.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(target.href.split('text=')[1])).toContain(link)
    expect(decodeURIComponent(target.href.split('text=')[1])).toContain('1. Amazing Grace')
  })

  it('sends Telegram both the url and the text', () => {
    const target = shareTarget(SETLIST, SONGS, 'telegram', origin)
    const params = new URL(target.href).searchParams

    expect(target.href.startsWith('https://t.me/share/url?')).toBe(true)
    expect(params.get('url')).toBe(link)
    expect(params.get('text')).toContain('Rehearsal Set')
  })

  it('composes the email subject and body', () => {
    const target = shareTarget(SETLIST, SONGS, 'email', origin)
    const params = new URL(target.href).searchParams

    expect(target.subject).toBe('Rehearsal Set — Setlist')
    expect(shareSubject(SETLIST)).toBe(target.subject)
    expect(params.get('subject')).toBe('Rehearsal Set — Setlist')
    expect(params.get('body')).toContain(link)
  })

  it('refuses an unknown channel by name instead of linking nowhere', () => {
    expect(() => shareTarget(SETLIST, SONGS, 'carrier-pigeon', origin)).toThrow(
      /carrier-pigeon/,
    )
  })
})

describe('shareTargets', () => {
  it('returns every channel in menu order', () => {
    expect(shareTargets(SETLIST, SONGS, 'https://app.cemurm.test').map((t) => t.value)).toEqual(
      SHARE_TARGETS.map((t) => t.value),
    )
    expect(SHARE_TARGETS.map((t) => t.value)).toEqual(['whatsapp', 'telegram', 'email'])
  })
})
