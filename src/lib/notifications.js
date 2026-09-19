// Notifications data layer (Hito 3 PR#2, task 2.2 — notifications Feed1–7,
// realtime delivery scenario). Reads are RLS-capped to the caller
// (0002 notifications_select_self); read-state is the 0002 column grant
// (update (read_at) only — PATCH title stays 42501). NO INSERT/DELETE calls:
// 0002 keeps `notifications` system-write-only, so the 42501 lock is
// preserved by construction. Realtime mirrors subscribeSetlistRealtime
// (setlists.js): one channel per user, postgres_changes on `notifications`
// filtered by the non-PK user_id (replica identity full from 0009 1.4).
//
// Lazy supabase import (bandmates.js precedent): demo() runs bare-node and
// never touches the network or the env-gated client (supabase.js throws
// without VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY). The read-through cache
// uses offlineCache.js kv keys `notifications:<userId>` and
// `notifications-unread:<userId>` — NEW keys only, no store/schema/DB_VERSION
// change (songs.js withReadThrough semantics: network first, cache on
// success, serve the kv copy on failure).

import { offlineGet, offlineSet } from './offlineCache.js'

let supabaseClient = null
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('./supabase.js')).supabase
  return supabaseClient
}

// Frozen category enum (0001): display order drives groupByCategory.
export const CATEGORY_ORDER = ['invitation', 'setlist', 'event', 'system']

const FEED_KEY = (userId) => `notifications:${userId}`
const UNREAD_KEY = (userId) => `notifications-unread:${userId}`

// ponytail: same read-through shape as songs.js — no freshness TTL; every
// successful network read overwrites the cache and offline reads serve it
// unconditionally, so staleness self-heals on the next successful fetch.
async function withReadThrough(key, fallbackValue, fn) {
  try {
    const data = await fn()
    await offlineSet(key, data)
    return data
  } catch (e) {
    const cached = await offlineGet(key)
    if (cached?.data !== undefined && cached?.data !== null) return cached.data
    if (fallbackValue !== undefined) return fallbackValue
    throw e
  }
}

/** Full feed for one user, newest first (idx_notifications_user order). */
export async function listNotifications(userId) {
  const data = await withReadThrough(FEED_KEY(userId), [], async () => {
    const { data: rows, error } = await (await supabase())
      .from('notifications')
      .select('id, category, title, body, payload, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (rows || []).map(normalizeNotification)
  })
  return data
}

/** Number of unread rows (read_at IS NULL), cached for the offline badge. */
export async function unreadCount(userId) {
  return withReadThrough(UNREAD_KEY(userId), 0, async () => {
    const { count, error } = await (await supabase())
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
    if (error) throw error
    return count ?? 0
  })
}

/**
 * Mark one notification read (0002 notifications_update_self + the
 * update (read_at) column grant). RLS caps the update to the caller's own
 * rows; touching any other column is 42501 by the column grant.
 */
export async function markRead(userId, id) {
  const { error } = await (await supabase())
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Mark every unread notification read (Feed3). */
export async function markAllRead(userId) {
  const { error } = await (await supabase())
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
}

/**
 * Live subscription to the caller's own rows (realtime delivery scenario:
 * the non-PK user_id filter + replica identity full deliver per subscriber,
 * and RLS caps the channel). Returns an unsubscribe fn — teardown on unmount.
 */
export async function subscribeNotifications(userId, onChange) {
  const client = await supabase()
  const channel = client
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe()
  return () => client.removeChannel(channel)
}

/** Deep-link map (design "Deep-link navigation"): payload.action → route. */
export function notificationTarget(payload) {
  const p = payload && typeof payload === 'object' ? payload : {}
  switch (p.action) {
    case 'invite':
    case 'bandmate-accepted':
    case 'bandmate-declined':
      return { route: '/bandmates', params: null }
    case 'shared':
    case 'permission':
      return p.setlist_id ? { route: `/setlists/${p.setlist_id}`, params: null } : null
    case 'song-added':
    case 'reorder':
      return p.setlist_id && p.song_id
        ? { route: `/setlists/${p.setlist_id}`, params: { song: p.song_id } }
        : null
    case 'comment':
    case 'mention':
      return p.song_id && p.comment_id
        ? {
            route: `/songs/${p.song_id}`,
            params: { anchor: p.section ? String(p.section) : null, cid: p.comment_id },
          }
        : null
    default:
      // 'removed' and any unknown action are informational rows — no target.
      return null
  }
}

/** Row → the shape the feed renders (payload.action/actor_id promoted). */
export function normalizeNotification(row) {
  const payload =
    row.payload && typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {}
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body ?? null,
    action: payload.action ?? null,
    target: notificationTarget(payload),
    read: row.read_at != null,
    createdAt: row.created_at,
    actorId: payload.actor_id ?? null,
  }
}

/**
 * Feed groups in CATEGORY_ORDER with per-group unread counts (Feed4). Only
 * categories that have rows are returned; input order (newest first) is
 * preserved inside each group.
 */
export function groupByCategory(rows) {
  return CATEGORY_ORDER
    .map((category) => rows.filter((row) => row.category === category))
    .filter((group) => group.length > 0)
    .map((group) => ({
      category: group[0].category,
      rows: group,
      unread: group.filter((row) => !row.read).length,
    }))
}

// Self-check: node -e "import('./src/lib/notifications.js').then(m => m.demo())"
export function demo() {
  const assertEq = (actual, expected, label) => {
    const got = JSON.stringify(actual)
    const want = JSON.stringify(expected)
    if (got !== want) {
      throw new Error(`notifications demo FAILED: ${label} — got ${got}, expected ${want}`)
    }
  }

  // notificationTarget: every deep-link row of the design map.
  assertEq(notificationTarget({ action: 'invite' }), { route: '/bandmates', params: null }, 'invite → /bandmates')
  assertEq(notificationTarget({ action: 'bandmate-accepted' }), { route: '/bandmates', params: null }, 'accepted → /bandmates')
  assertEq(notificationTarget({ action: 'bandmate-declined' }), { route: '/bandmates', params: null }, 'declined → /bandmates')
  assertEq(notificationTarget({ action: 'shared', setlist_id: 'sl1' }), { route: '/setlists/sl1', params: null }, 'shared → setlist')
  assertEq(notificationTarget({ action: 'permission', setlist_id: 'sl1' }), { route: '/setlists/sl1', params: null }, 'permission → setlist')
  assertEq(
    notificationTarget({ action: 'song-added', setlist_id: 'sl1', song_id: 'sg1' }),
    { route: '/setlists/sl1', params: { song: 'sg1' } },
    'song-added → setlist?song=',
  )
  assertEq(
    notificationTarget({ action: 'reorder', setlist_id: 'sl1', song_id: 'sg2' }),
    { route: '/setlists/sl1', params: { song: 'sg2' } },
    'reorder → setlist?song=',
  )
  assertEq(
    notificationTarget({ action: 'comment', song_id: 'sg1', setlist_id: 'sl1', section: 'Chorus', comment_id: 'c1' }),
    { route: '/songs/sg1', params: { anchor: 'Chorus', cid: 'c1' } },
    'comment → song anchor+cid',
  )
  assertEq(
    notificationTarget({ action: 'mention', song_id: 'sg1', section: 'Verse', comment_id: 'c2' }),
    { route: '/songs/sg1', params: { anchor: 'Verse', cid: 'c2' } },
    'mention → song anchor+cid',
  )
  assertEq(notificationTarget({ action: 'removed', setlist_id: 'sl1' }), null, 'removed → informational (no target)')
  assertEq(notificationTarget({ action: 'unknown' }), null, 'unknown action → no target')
  assertEq(notificationTarget({ action: 'song-added', setlist_id: 'sl1' }), null, 'song-added without song_id → no target')

  // normalizeNotification: shape + promoted payload fields; read from read_at.
  const row = normalizeNotification({
    id: 'n1',
    category: 'setlist',
    title: 'Julian added Song X to Friday Gig',
    body: 'Key: Am · 120 BPM',
    payload: { action: 'song-added', setlist_id: 'sl1', song_id: 'sg1', actor_id: 'u9' },
    read_at: null,
    created_at: '2026-09-18T10:00:00Z',
  })
  assertEq(row.id, 'n1', 'row id')
  assertEq(row.action, 'song-added', 'action promoted from payload')
  assertEq(row.read, false, 'read_at null → unread')
  assertEq(row.actorId, 'u9', 'actor_id promoted')
  assertEq(row.target.route, '/setlists/sl1', 'normalized row carries its target')
  assertEq(normalizeNotification({ id: 'n2', category: 'invitation', title: 't', payload: null, read_at: '2026-09-18T10:00:00Z', created_at: 'c' }).read, true, 'read_at set → read')
  assertEq(normalizeNotification({ id: 'n3', category: 'system', title: 't', payload: { actor_id: 'u1' }, read_at: null, created_at: 'c' }).actorId, 'u1', 'payload-only actor_id')

  // groupByCategory: fixed order, per-group unread counts, empty groups dropped.
  const base = { title: 't', body: null, created_at: 'c' }
  const grouped = groupByCategory([
    { ...base, id: 'a', category: 'setlist', read: false },
    { ...base, id: 'b', category: 'invitation', read: false },
    { ...base, id: 'c', category: 'invitation', read: true },
    { ...base, id: 'd', category: 'setlist', read: true },
  ])
  assertEq(grouped.map((g) => g.category), ['invitation', 'setlist'], 'groups in CATEGORY_ORDER')
  assertEq(grouped[0].unread, 1, 'invitation unread count')
  assertEq(grouped[1].unread, 1, 'setlist unread count')
  assertEq(grouped.length, 2, 'no rows → no group')
  assertEq(groupByCategory([]).length, 0, 'empty feed → no groups')

  console.log('notifications demo OK: 19 asserts (deep-link map, normalization, grouping)')
}