import { beforeEach, describe, expect, it, vi } from 'vitest'

// Characterization tests for the personal-annotations read. This is the first
// test file under src/data/repositories/** — the layer had none, and it is the
// half that actually talks to the network.
//
// These record what the code does TODAY. They do not assert what it ought to do.
// If one fails after a change, the source is what changed.

const state = { result: { data: [], error: null }, throwOnFrom: false }

// Chainable AND thenable: the read is
//   await supabase().from(t).select(cols).eq(a).eq(b)
// so every link returns the same object and the final one is awaited.
const fakeQuery = {
  select: vi.fn(() => fakeQuery),
  eq: vi.fn(() => fakeQuery),
  then: (resolve) => resolve(state.result),
}

vi.mock('../supabase.js', () => ({
  supabase: {
    from: vi.fn(() => {
      if (state.throwOnFrom) throw new Error('network down')
      return fakeQuery
    }),
  },
}))

const { supabase } = await import('../supabase.js')
const { listAnnotations } = await import('./annotations.js')

beforeEach(() => {
  state.result = { data: [], error: null }
  state.throwOnFrom = false
  fakeQuery.select.mockClear()
  fakeQuery.eq.mockClear()
  supabase.from.mockClear()
})

describe('listAnnotations', () => {
  it('returns the rows the query produced', async () => {
    state.result = {
      data: [{ anchor: { section: 'Chorus', index: 2 }, kind: 'note', value: 'breath here' }],
      error: null,
    }
    await expect(listAnnotations('user-1', 'song-1')).resolves.toHaveLength(1)
  })

  it('projects only the three columns the renderer needs', async () => {
    await listAnnotations('user-1', 'song-1')
    expect(fakeQuery.select).toHaveBeenCalledWith('anchor, kind, value')
  })

  it('scopes the read to the author AND the song', async () => {
    await listAnnotations('user-1', 'song-1')
    expect(supabase.from).toHaveBeenCalledWith('personal_annotations')
    expect(fakeQuery.eq.mock.calls).toEqual([
      ['user_id', 'user-1'],
      ['song_id', 'song-1'],
    ])
  })

  it('degrades to [] on a query error instead of throwing', async () => {
    state.result = { data: null, error: { message: 'RLS denied' } }
    await expect(listAnnotations('user-1', 'song-1')).resolves.toEqual([])
  })

  it('degrades to [] when the client itself throws', async () => {
    state.throwOnFrom = true
    await expect(listAnnotations('user-1', 'song-1')).resolves.toEqual([])
  })

  it('degrades to [] when the rows come back null', async () => {
    state.result = { data: null, error: null }
    await expect(listAnnotations('user-1', 'song-1')).resolves.toEqual([])
  })
})