import { describe, expect, it } from 'vitest'

import { offlineSnapshot } from './engagementAnalytics.js'

describe('offlineSnapshot', () => {
  it('reports the counters it can actually read', () => {
    expect(offlineSnapshot({ pendingWrites: 3, songsInLibrary: 40 })).toEqual({
      pendingWrites: 3,
      songsInLibrary: 40,
    })
  })

  it('coerces missing, negative and fractional counts to non-negative integers', () => {
    expect(offlineSnapshot({})).toEqual({ pendingWrites: 0, songsInLibrary: 0 })
    expect(offlineSnapshot({ pendingWrites: -4, songsInLibrary: 2.8 })).toEqual({
      pendingWrites: 0,
      songsInLibrary: 2,
    })
  })
})
