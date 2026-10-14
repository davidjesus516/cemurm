import { beforeEach, describe, expect, it, vi } from 'vitest'

// Focused tests for the services error-mapping seam that makes
// features/offboarding-cascade.feature:48-51 reachable from the UI: assigning a
// former member must surface the BDD literal, not the generic message.
//
// The falsifiable property this file pins is the SUFFIX matcher: the 0038
// rejection is dynamic ('<display name> is no longer a member'), so a fixed
// literal cannot catch it. Remove `isFormerMemberError` from `handleError` and
// cases 1 and 2 below go red while the rest stay green — that is the mutation
// proof recorded in the work unit.
//
// Mocking shape follows annotations.test.js: `supabase.js` reads import.meta.env
// at eval time and throws in bare node, so the module is mocked BEFORE the
// dynamic import. Vitest hoists the vi.mock call; the factory only runs when the
// module is imported, which is why `state` declared above it is safe to close over.

const state = { rpcResult: { data: null, error: null } }

vi.mock('../supabase.js', () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve(state.rpcResult)),
  },
}))

const { supabase } = await import('../supabase.js')
const { assignMusician } = await import('./services.js')

const ASSIGN = {
  serviceId: '11111111-1111-4111-8111-111111111111',
  blockId: '22222222-2222-4222-8222-222222222222',
  userId: '33333333-3333-4333-8333-333333333333',
  part: 'bass',
}

/** @param {typeof ASSIGN} input */
async function rejectionOf(input) {
  try {
    await assignMusician(input)
  } catch (e) {
    return /** @type {{ message?: string, code?: string }} */ (e)
  }
  throw new Error('expected assignMusician to reject, but it resolved')
}

beforeEach(() => {
  state.rpcResult = { data: null, error: null }
  supabase.rpc.mockClear()
})

describe('assignMusician error mapping', () => {
  it('re-throws the 0038 rejection verbatim for a single-word name', async () => {
    state.rpcResult = {
      data: null,
      error: { message: 'Sofia is no longer a member', code: 'P0001' },
    }
    const err = await rejectionOf(ASSIGN)
    expect(err.message).toBe('Sofia is no longer a member')
    // The offline drain classifies on `.code`, so the ORIGINAL object must be
    // re-thrown — not a rebuilt Error that would drop it.
    expect(err.code).toBe('P0001')
  })

  it('matches the dynamic name by suffix, not a fixed string', async () => {
    state.rpcResult = {
      data: null,
      error: { message: 'Ana María Ochoa is no longer a member' },
    }
    const err = await rejectionOf(ASSIGN)
    expect(err.message).toBe('Ana María Ochoa is no longer a member')
  })

  it('still maps an unrecognised failure to the generic message', async () => {
    state.rpcResult = {
      data: null,
      error: { message: 'duplicate key value violates unique constraint "service_assignments_pkey"' },
    }
    const err = await rejectionOf(ASSIGN)
    expect(err.message).toBe('Something went wrong. Please try again.')
    expect(err.message).not.toBe('duplicate key value violates unique constraint "service_assignments_pkey"')
  })

  it('the pre-existing overlap rejection still passes through', async () => {
    state.rpcResult = {
      data: null,
      error: { message: 'Ana is already assigned to Block A — overlapping times' },
    }
    const err = await rejectionOf(ASSIGN)
    expect(err.message).toBe('Ana is already assigned to Block A — overlapping times')
  })

  it('the local part guard fires before the RPC', async () => {
    const err = await rejectionOf({ ...ASSIGN, part: '   ' })
    expect(err.message).toBe('Part is required.')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
