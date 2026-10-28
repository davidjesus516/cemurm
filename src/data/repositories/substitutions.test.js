import { beforeEach, describe, expect, it, vi } from 'vitest'

// Focused tests for the substitutions error-mapping seam that the 0045
// respond guard's rejection rides on: a responder in a frozen candidates array
// who is no longer an active member must surface the literal, not the generic
// message (odd/tasks/offboarding-cascade.md, finding 1).
//
// The falsifiable property this file pins is the allowlist entry: remove
// 'You are no longer an active member of this organization.' from USER_ERRORS
// and case 1 below goes red while the rest stay green.
//
// Mocking shape follows annotations.test.js: `supabase.js` reads
// import.meta.env at eval time and throws in bare node, so the module is
// mocked BEFORE the dynamic import. Vitest hoists the vi.mock call; the
// factory only runs when the module is imported, which is why `state`
// declared above it is safe to close over.

const state = { rpcResult: { data: null, error: null } }

vi.mock('../supabase.js', () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve(state.rpcResult)),
  },
}))

const { supabase } = await import('../supabase.js')
const { respondSubstitution } = await import('./substitutions.js')

/** @param {string} requestId @param {boolean} accept */
async function rejectionOf(requestId, accept) {
  try {
    await respondSubstitution(requestId, accept)
  } catch (e) {
    return /** @type {{ message?: string, code?: string }} */ (e)
  }
  throw new Error('expected respondSubstitution to reject, but it resolved')
}

beforeEach(() => {
  state.rpcResult = { data: null, error: null }
  supabase.rpc.mockClear()
})

describe('respondSubstitution error mapping', () => {
  it('re-throws the 0045 rejection verbatim', async () => {
    state.rpcResult = {
      data: null,
      error: { message: 'You are no longer an active member of this organization.', code: 'P0001' },
    }
    const err = await rejectionOf('11111111-1111-4111-8111-111111111111', true)
    expect(err.message).toBe('You are no longer an active member of this organization.')
    // The offline drain classifies on `.code`, so the ORIGINAL object must be
    // re-thrown — not a rebuilt Error that would drop it.
    expect(err.code).toBe('P0001')
  })

  it('still maps an unrecognised failure to the generic message', async () => {
    state.rpcResult = {
      data: null,
      error: { message: 'duplicate key value violates unique constraint "substitution_responses_pkey"' },
    }
    const err = await rejectionOf('11111111-1111-4111-8111-111111111111', false)
    expect(err.message).toBe('Something went wrong. Please try again.')
    expect(err.message).not.toBe('duplicate key value violates unique constraint "substitution_responses_pkey"')
  })

  it('the first-wins rejection still passes through', async () => {
    state.rpcResult = {
      data: null,
      error: { message: 'Position already covered.', code: 'P0001' },
    }
    const err = await rejectionOf('11111111-1111-4111-8111-111111111111', true)
    expect(err.message).toBe('Position already covered.')
  })

  it('a successful accept returns the substitute assignment id and the p_accept flag rides through', async () => {
    state.rpcResult = { data: '22222222-2222-4222-8222-222222222222', error: null }
    const id = await respondSubstitution('11111111-1111-4111-8111-111111111111', true)
    expect(id).toBe('22222222-2222-4222-8222-222222222222')
    expect(supabase.rpc).toHaveBeenCalledWith('respond_substitution', {
      p_request_id: '11111111-1111-4111-8111-111111111111',
      p_accept: true,
    })
  })
})
