import { beforeEach, describe, expect, it, vi } from 'vitest'

// Regression test for the realtime delivery scenario (Hito 3, task 2.2):
// supabase-js reuses RealtimeChannels by topic, so a second subscriber for
// the same userId that .on()s an already joined channel throws
//   cannot add `postgres_changes` callbacks ... after `subscribe()`
// subscribeNotifications therefore shares one channel per userId, raises a
// single postgres_changes listener before the first subscribe(), and fans
// out to every registered callback.

// supabase.js reads import.meta.env at eval time and throws in bare node,
// so it is mocked before the dynamic import (same shape as
// data/repositories/services.test.js). The client returns the same channel
// instance for the same topic, exactly like supabase-js does.
const channels = new Map()

const makeChannel = () => ({
  on: vi.fn(function on() {
    return this
  }),
  subscribe: vi.fn(async () => undefined),
})

vi.mock('../supabase.js', () => ({
  supabase: {
    channel: vi.fn((topic) => {
      if (!channels.has(topic)) channels.set(topic, makeChannel())
      return channels.get(topic)
    }),
    removeChannel: vi.fn(async () => undefined),
  },
}))

const { supabase } = await import('../supabase.js')
const { subscribeNotifications } = await import('./notifications.js')

const USER_1 = '10000000-0000-0000-0000-000000000001'
const USER_2 = '10000000-0000-0000-0000-000000000002'
const USER_3 = '10000000-0000-0000-0000-000000000003'
const USER_4 = '10000000-0000-0000-0000-000000000004'
const USER_5 = '10000000-0000-0000-0000-000000000005'

beforeEach(() => {
  channels.clear()
  supabase.channel.mockClear()
  supabase.removeChannel.mockClear()
})

describe('subscribeNotifications (shared channel per userId)', () => {
  it('two subscribers for the same user share one listener and never throw "after subscribe()"', async () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()

    await subscribeNotifications(USER_1, cb1)
    await subscribeNotifications(USER_1, cb2)

    expect(supabase.channel).toHaveBeenCalledWith(`notifications:${USER_1}`)

    const ch = supabase.channel.mock.results[0].value
    // One channel entry: one postgres_changes listener, one subscribe, and
    // the listener is raised before subscribe().
    expect(ch.on).toHaveBeenCalledTimes(1)
    expect(ch.on.mock.calls[0]).toEqual([
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${USER_1}` },
      expect.any(Function),
    ])
    expect(ch.subscribe).toHaveBeenCalledTimes(1)
    expect(ch.on.mock.invocationCallOrder[0]).toBeLessThan(ch.subscribe.mock.invocationCallOrder[0])

    // Fan out: a postgres_changes payload reaches both callbacks.
    const listener = ch.on.mock.calls[0][2]
    const payload = { table: 'notifications', eventType: 'INSERT', new: { id: 'n1' } }
    listener(payload)
    expect(cb1).toHaveBeenCalledWith(payload)
    expect(cb2).toHaveBeenCalledWith(payload)
  })

  it('unsubscribing one consumer keeps the others; the last one tears the channel down', async () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()

    const off1 = await subscribeNotifications(USER_2, cb1)
    const off2 = await subscribeNotifications(USER_2, cb2)

    const ch = supabase.channel.mock.results[0].value
    const listener = ch.on.mock.calls[0][2]
    listener({ table: 'notifications', eventType: 'INSERT', new: { id: 'n1' } })
    expect(cb1).toHaveBeenCalledTimes(1)
    expect(cb2).toHaveBeenCalledTimes(1)

    off1()
    listener({ table: 'notifications', eventType: 'UPDATE', new: { id: 'n2' } })
    expect(cb1).toHaveBeenCalledTimes(1) // detached consumer stops receiving
    expect(cb2).toHaveBeenCalledTimes(2) // remaining consumer keeps receiving
    expect(supabase.removeChannel).not.toHaveBeenCalled() // one consumer still subscribed

    off2()
    expect(supabase.removeChannel).toHaveBeenCalledTimes(1)
    expect(supabase.removeChannel).toHaveBeenCalledWith(ch)
  })

  it('a later subscriber for the same userId starts fresh after teardown', async () => {
    const cb1 = vi.fn()

    const off1 = await subscribeNotifications(USER_3, cb1)
    await subscribeNotifications(USER_3, cb1) // same consumer twice is harmless
    off1()
    off1() // last consumer leaves → channel removed

    const off2 = await subscribeNotifications(USER_3, cb1)
    const ch = supabase.channel.mock.results[0].value
    expect(ch.on).toHaveBeenCalledTimes(2) // new listener after teardown
    expect(ch.subscribe).toHaveBeenCalledTimes(2)
    expect(supabase.removeChannel).toHaveBeenCalledTimes(2)

    off2()
    expect(supabase.removeChannel).toHaveBeenCalledTimes(3)
  })

  it('different userIds get independent channels', async () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()

    await subscribeNotifications(USER_4, cb1)
    await subscribeNotifications(USER_5, cb2)

    expect(supabase.channel).toHaveBeenCalledWith(`notifications:${USER_4}`)
    expect(supabase.channel).toHaveBeenCalledWith(`notifications:${USER_5}`)

    const ch1 = supabase.channel.mock.results[0].value
    const ch2 = supabase.channel.mock.results[1].value
    expect(ch1).not.toBe(ch2)
    expect(ch1.on).toHaveBeenCalledTimes(1)
    expect(ch2.on).toHaveBeenCalledTimes(1)

    ch1.on.mock.calls[0][2]({ table: 'notifications', eventType: 'INSERT', new: { id: 'n1' } })
    expect(cb1).toHaveBeenCalledTimes(1)
    expect(cb2).not.toHaveBeenCalled()
  })
})
