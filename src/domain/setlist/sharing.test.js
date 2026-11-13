// Share payloads — the deep links, the summary text and the channel URLs the
// sharing scenarios in features/export-and-sharing.feature name:
//   · a setlist link a bandmate opens          (`:53-60`)
//   · a song link that opens the detail page   (`:62-71`)
//   · WhatsApp / Telegram / email summaries    (`:106-125`), including the
//     subject line the email scenario spells out verbatim.

import { describe, expect, it } from 'vitest'

import {
  SHARE_CHANNELS,
  setlistEmailSubject,
  setlistLink,
  setlistShareText,
  shareUrl,
  songLink,
  songShareText,
} from './sharing.js'

const SONGS = [
  { id: 's1', title: 'Amazing Grace', key: 'G', durationSeconds: 210 },
  { id: 's2', title: 'Great Is Thy Faithfulness', key: 'D', durationSeconds: 180 },
]

const SETLIST = {
  id: 'sl1',
  name: 'Friday Gig',
  itemIds: ['s2', 's1'],
  agreedKeys: { s2: 'Eb' },
}

describe('share links', () => {
  it('builds absolute setlist and song links from the origin it is given', () => {
    expect(setlistLink('sl1', 'https://app.cemurm.app')).toBe(
      'https://app.cemurm.app/setlists/sl1',
    )
    expect(songLink('s1', 'https://app.cemurm.app/')).toBe(
      'https://app.cemurm.app/songs/s1',
    )
  })
})

describe('setlistShareText', () => {
  it('summarizes the setlist in running order with each item key', () => {
    const text = setlistShareText(SETLIST, SONGS)

    expect(text.split('\n')[0]).toBe('Friday Gig — 2 songs · 6:30')
    expect(text).toContain('1. Great Is Thy Faithfulness (Eb)')
    expect(text).toContain('2. Amazing Grace (G)')
  })

  it('carries no lyrics or chord sheets — only the outline', () => {
    const text = setlistShareText(SETLIST, SONGS)

    expect(text).not.toContain('[G]')
    expect(text).not.toContain('Amazing [')
  })

  it('skips songs that are no longer in the repertoire', () => {
    const text = setlistShareText({ ...SETLIST, itemIds: ['s1', 'gone'] }, SONGS)

    expect(text).toContain('1. Amazing Grace (G)')
    expect(text).not.toContain('gone')
    expect(text.split('\n')[0]).toBe('Friday Gig — 1 song · 3:30')
  })
})

describe('songShareText', () => {
  it('names the song, its artist and the key it plays in', () => {
    expect(songShareText({ title: 'Wonderwall', artist: 'Oasis' }, 'Em')).toBe(
      '"Wonderwall" by Oasis · key Em',
    )
  })

  it('drops the artist and key when the song has neither', () => {
    expect(songShareText({ title: 'Amazing Grace' })).toBe('"Amazing Grace"')
  })
})

describe('setlistEmailSubject', () => {
  it('uses the subject line the email scenario requires', () => {
    expect(setlistEmailSubject({ name: 'Weekly Rehearsal' })).toBe(
      'Rehearsal Setlist — Weekly Rehearsal',
    )
  })
})

describe('shareUrl', () => {
  const payload = {
    url: 'https://app.cemurm.app/setlists/sl1',
    text: 'Friday Gig — 2 songs',
    subject: 'Rehearsal Setlist — Friday Gig',
  }

  it('hands WhatsApp the summary and the deep link in one message', () => {
    expect(shareUrl('whatsapp', payload)).toBe(
      `https://wa.me/?text=${encodeURIComponent(
        'Friday Gig — 2 songs\n\nhttps://app.cemurm.app/setlists/sl1',
      )}`,
    )
  })

  it('hands Telegram the link and the summary separately', () => {
    expect(shareUrl('telegram', payload)).toBe(
      `https://t.me/share/url?url=${encodeURIComponent(
        'https://app.cemurm.app/setlists/sl1',
      )}&text=${encodeURIComponent('Friday Gig — 2 songs')}`,
    )
  })

  it('composes the email with the setlist subject in the body as well', () => {
    const url = shareUrl('email', payload)

    expect(url.startsWith('mailto:?subject=')).toBe(true)
    expect(decodeURIComponent(url)).toContain('Rehearsal Setlist — Friday Gig')
    expect(decodeURIComponent(url)).toContain('https://app.cemurm.app/setlists/sl1')
  })

  it('refuses a channel it does not implement instead of opening nothing', () => {
    expect(() => shareUrl('signal', payload)).toThrow(/signal/i)
    expect(SHARE_CHANNELS.map((c) => c.value)).toEqual(['whatsapp', 'telegram', 'email'])
  })
})
