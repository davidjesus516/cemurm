import { beforeEach, describe, expect, it, vi } from 'vitest'

// The list behind the revocation control (T3, review finding B3). The SQL half —
// which rows a caller may see — is pinned by scripts/smoke/0049-audience-view.sql
// (assertions 25 and 40). This pins the half the page renders: the issuer name,
// the expiry state, and the refusal to pretend a failed read was an empty list.
//
// Characterization of what the module does today; if one of these fails after a
// change, the source is what changed.

const state = {
  rows: [],
  profiles: [],
  listError: null,
  profilesError: null,
}

// Chainable AND thenable, like the annotations test: the read is
//   await supabase.from(t).select(cols).eq(a).order(b)
// so every link returns the same object and the last one is awaited.
function fakeQuery(table) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    then: (resolve) =>
      resolve(
        table === 'profiles'
          ? { data: state.profiles, error: state.profilesError }
          : { data: state.rows, error: state.listError },
      ),
  }
  return query
}

vi.mock('../supabase.js', () => ({
  supabase: { from: vi.fn((table) => fakeQuery(table)) },
}))

// audienceView.js imports the cache at module scope for the read path; the list
// does not touch it, and importing the real module needs IndexedDB.
vi.mock('../../offline/cache.js', () => ({
  offlineGet: vi.fn(async () => null),
  offlineSet: vi.fn(async () => {}),
}))

const { listAudienceViews } = await import('./audienceView.js')

beforeEach(() => {
  state.rows = []
  state.profiles = []
  state.listError = null
  state.profilesError = null
})

describe('listAudienceViews', () => {
  it('maps a link to the page shape and resolves the issuer name', async () => {
    state.rows = [
      {
        id: 'link-1',
        token: 'a'.repeat(32),
        expires_at: '2099-01-01T00:00:00Z',
        created_by: 'user-1',
      },
    ]
    state.profiles = [{ id: 'user-1', username: 'dana', display_name: 'Dana Ruiz' }]

    const [link] = await listAudienceViews('setlist-1')

    expect(link).toEqual({
      id: 'link-1',
      token: 'a'.repeat(32),
      expiresAt: '2099-01-01T00:00:00Z',
      createdBy: 'user-1',
      issuedBy: 'Dana Ruiz',
      expired: false,
    })
  })

  it('marks a link whose expiry already passed as expired', async () => {
    state.rows = [
      {
        id: 'link-1',
        token: 'b'.repeat(32),
        expires_at: '2020-01-01T00:00:00Z',
        created_by: 'user-1',
      },
    ]

    const [link] = await listAudienceViews('setlist-1')

    expect(link.expired).toBe(true)
  })

  it('falls back to the username, then to null, when the profile is not readable', async () => {
    state.rows = [
      { id: 'link-1', token: 'c'.repeat(32), expires_at: '2099-01-01T00:00:00Z', created_by: 'u1' },
      { id: 'link-2', token: 'd'.repeat(32), expires_at: '2099-01-01T00:00:00Z', created_by: 'u2' },
    ]
    // u2's profile is not visible to this caller: the link must still render.
    state.profiles = [{ id: 'u1', username: 'dana', display_name: null }]

    const links = await listAudienceViews('setlist-1')

    expect(links.map((link) => link.issuedBy)).toEqual(['dana', null])
  })

  it('refuses to report a failed read as an empty list', async () => {
    state.listError = { message: 'network down' }

    await expect(listAudienceViews('setlist-1')).rejects.toThrow(
      'Could not load the audience links right now.',
    )
  })
})
