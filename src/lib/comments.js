// Shared song comments data layer (Hito 3 PR#3, tasks 3.1–3.2): reads/writes
// shared_comments (0001 shape — song_id, version_id, anchor, parent_id,
// author_id, body, resolved, deleted, created_at, updated_at; 0006 scoped
// SELECT/INSERT RLS over song → setlist_items → setlists → collaborators,
// author_id pinned to the session). Anchors reuse the personal_annotations
// {section, index} convention (annotations.js: index = 0-based lyric line
// within the {section} block). Pure helpers are bare-node testable; network
// ops use the lazy supabase import (annotations.js precedent) so demo() runs
// under node.
//
// ⚠ 0006 RLS note (frozen migration): authenticated users are granted
// SELECT+INSERT only — edit/resolve/soft-delete are UPDATE-class writes that
// need an author-scoped UPDATE policy no migration ships yet. The ops below
// are implemented per spec; until that policy lands (follow-up 0007), they
// surface the same 42501 as a no-access insert, mapped to 'No access.' per
// tasks.md 3.1 ("RLS 42501 → No access"). Notifications/@mention defer to
// change 2 (tasks.md deferred table).

import { enqueueOp } from './offlineQueue.js'

// ponytail: lazy import — supabase.js reads import.meta.env at eval time,
// which is undefined in bare node (this module's demo runs there).
let supabaseClient = null
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('./supabase.js')).supabase
  return supabaseClient
}

// ponytail: known user-facing errors re-thrown as-is; network/PostgREST
// errors map to a safe generic message (setlists.js precedent).
const USER_ERRORS = new Set([
  'No access.',
  'Comment body is required.',
])

function handleError(error) {
  if (USER_ERRORS.has(error?.message)) throw error
  throw new Error('Something went wrong. Please try again.')
}

async function withErrorMapping(fn) {
  try { return await fn() } catch (e) { handleError(e) }
}

// Either RLS denied the write outright (no policy/grant — the frozen-0006
// UPDATE-class gap) or the scoped with-check rejected the row (no-access
// insert). PostgREST surfaces both as PostgreSQL 42501; tasks.md maps it to
// 'No access.'
function isRlsDenied(error) {
  return error?.code === '42501'
}

// ponytail: best-effort connectivity heuristic — PostgREST network errors
// surface as fetch failures without a stable code; refine if a code appears.
function isConnectivityError(e) {
  const msg = String(e?.message || '')
  return typeof navigator !== 'undefined' && navigator.onLine === false
    || msg.includes('Failed to fetch')
    || msg.includes('fetch failed')
    || e?.code === '-1'
}

/**
 * Version isolation (comments spec R3): a version-pinned comment (version_id
 * set) appears only on that version; a song-level comment (version_id NULL)
 * appears on every version. No version open → show everything.
 */
export function matchesVersion(row, versionId) {
  return !versionId || !row?.versionId || row.versionId === versionId
}

/**
 * Thread tree from flat rows: roots are parent_id-NULL rows, replies attach
 * under their parent (parent_id), both sorted oldest-first so the thread
 * reads in order (spec R4). Soft-deleted rows (deleted=true) are filtered
 * before shaping — a deleted comment, and any reply under it, disappears
 * from the thread (spec R6); replies whose parent row is missing drop too.
 * When a version is open, version-pinned rows for OTHER versions are also
 * filtered (spec R3).
 */
export function buildCommentTree(rows, versionId) {
  const visible = (rows || []).filter((r) => !r.deleted && matchesVersion(r, versionId))
  const byId = new Map(visible.map((row) => [row.id, { ...row, replies: [] }]))
  const roots = []
  for (const row of visible) {
    const node = byId.get(row.id)
    if (!row.parentId) {
      roots.push(node)
    } else {
      const parent = byId.get(row.parentId)
      // Parent deleted or filtered for this version → the reply vanishes
      // with it (R6: deletion removes the comment from the thread).
      if (parent) parent.replies.push(node)
    }
  }
  const byTime = (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  roots.sort(byTime)
  for (const node of byId.values()) node.replies.sort(byTime)
  return roots
}

/** Human label for a {section, index} anchor (empty when unanchored). */
export function formatAnchor(anchor) {
  if (!anchor?.section) return ''
  return anchor.index ? `${anchor.section} · line ${anchor.index + 1}` : anchor.section
}

/**
 * Raw shared_comments row → app shape (flattenSetlist precedent): camelCase
 * keys plus the author's display name (resolution happens in listComments —
 * shared_comments has no FK to profiles, so names need a second round trip,
 * bandmates.js precedent) and the offline pendingSync flag.
 */
function normalizeRow(row, profile) {
  return {
    id: row.id,
    songId: row.song_id,
    versionId: row.version_id,
    anchor: row.anchor,
    parentId: row.parent_id,
    authorId: row.author_id,
    authorName: profile ? profile.display_name || profile.username : null,
    body: row.body,
    resolved: row.resolved,
    deleted: row.deleted,
    pendingSync: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function withAuthorNames(rows) {
  const ids = [...new Set(rows.map((row) => row.author_id))]
  let byId = new Map()
  if (ids.length) {
    const { data: profiles, error } = await (await supabase())
      .from('profiles')
      .select('id, username, display_name')
      .in('id', ids)
    if (!error) byId = new Map((profiles || []).map((profile) => [profile.id, profile]))
  }
  return rows.map((row) => normalizeRow(row, byId.get(row.author_id)))
}

/**
 * Read the band-visible comments for a song (0006 scoped SELECT — RLS returns
 * only rows whose song sits in a setlist the reader owns or collaborates on;
 * rows for other arrangements are invisible). Author names come from profiles
 * (second round trip). Never throws: offline or no rows → [] (annotations.js
 * precedent); the hook keeps pendingSync rows across failed refreshes.
 */
export async function listComments(_userId, songId) {
  try {
    const { data, error } = await (await supabase())
      .from('shared_comments')
      .select('id, song_id, version_id, anchor, parent_id, author_id, body, resolved, deleted, created_at, updated_at')
      .eq('song_id', songId)
      .eq('deleted', false)
    if (error) throw error
    return await withAuthorNames(data || [])
  } catch {
    return []
  }
}

function optimisticPost(userId, payload) {
  const now = new Date().toISOString()
  return {
    id: `local-${Date.now()}`,
    songId: payload.songId,
    versionId: payload.versionId || null,
    anchor: payload.anchor || null,
    parentId: payload.parentId || null,
    authorId: userId,
    authorName: null,
    body: payload.body,
    resolved: false,
    deleted: false,
    pendingSync: true,
    createdAt: now,
    updatedAt: null,
  }
}

/**
 * Post a comment (or a reply — parentId set) on a song. SCOPE is enforced by
 * the 0006 insert policy (song must sit in a setlist the reader owns or is an
 * accepted collaborator on); an out-of-scope insert is denied server-side,
 * so this surfaces the spec's 'No access.' notice. Offline: queued (R11) with
 * an optimistic pendingSync row returned so the thread renders immediately.
 */
export function postComment(userId, payload) {
  return withErrorMapping(async () => {
    const body = String(payload?.body || '').trim()
    if (!body) throw new Error('Comment body is required.')
    try {
      const { data, error } = await (await supabase())
        .from('shared_comments')
        .insert({
          song_id: payload.songId,
          version_id: payload.versionId || null,
          anchor: payload.anchor || null,
          parent_id: payload.parentId || null,
          author_id: userId,
          body,
        })
        .select('*')
        .single()
      if (error) throw error
      return normalizeRow(data, null)
    } catch (e) {
      if (isRlsDenied(e)) throw new Error('No access.')
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'postComment', args: [userId, { ...payload, body }] })
      return optimisticPost(userId, { ...payload, body })
    }
  })
}

/**
 * Author-only edit (spec R5): UPDATE body + updated_at scoped to the author's
 * own row. The 0006 gap means the server rejects every update until an
 * author-scoped UPDATE policy ships (→ 'No access.'); the call shape matches
 * the spec contract so a follow-up migration unblocks it without client
 * changes. Offline: queued, optimistic patch returned.
 */
export function editComment(userId, commentId, body) {
  return withErrorMapping(async () => {
    const trimmed = String(body || '').trim()
    if (!trimmed) throw new Error('Comment body is required.')
    try {
      const { error } = await (await supabase())
        .from('shared_comments')
        .update({ body: trimmed, updated_at: new Date().toISOString() })
        .eq('id', commentId)
        .eq('author_id', userId)
      if (error) throw error
      return { id: commentId, body: trimmed, updatedAt: new Date().toISOString(), pendingSync: false }
    } catch (e) {
      if (isRlsDenied(e)) throw new Error('No access.')
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'editComment', args: [userId, commentId, trimmed] })
      return { id: commentId, body: trimmed, updatedAt: new Date().toISOString(), pendingSync: true }
    }
  })
}

/**
 * Mark a comment resolved (spec R7): any scoped member may resolve (schema-v2
 * RLS column: "resolve by anyone in scope"); UPDATE is scoped by id only.
 * Same frozen-0006 UPDATE gap as editComment.
 */
export function resolveComment(userId, commentId) {
  return withErrorMapping(async () => {
    try {
      const { error } = await (await supabase())
        .from('shared_comments')
        .update({ resolved: true, updated_at: new Date().toISOString() })
        .eq('id', commentId)
      if (error) throw error
      return { id: commentId, resolved: true, updatedAt: new Date().toISOString(), pendingSync: false }
    } catch (e) {
      if (isRlsDenied(e)) throw new Error('No access.')
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'resolveComment', args: [userId, commentId] })
      return { id: commentId, resolved: true, updatedAt: new Date().toISOString(), pendingSync: true }
    }
  })
}

/**
 * Soft-delete the author's own comment (spec R8): UPDATE deleted=true scoped
 * to the author's row — the row stays in the table (history kept, 0001) but
 * buildCommentTree drops it from the thread. Same frozen-0006 UPDATE gap.
 */
export function deleteComment(userId, commentId) {
  return withErrorMapping(async () => {
    try {
      const { error } = await (await supabase())
        .from('shared_comments')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('id', commentId)
        .eq('author_id', userId)
      if (error) throw error
      return { id: commentId, deleted: true, pendingSync: false }
    } catch (e) {
      if (isRlsDenied(e)) throw new Error('No access.')
      if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
      await enqueueOp(userId, { name: 'deleteComment', args: [userId, commentId] })
      return { id: commentId, deleted: true, pendingSync: true }
    }
  })
}

// Self-check: node -e "import('./src/lib/comments.js').then(m => m.demo())"
export function demo() {
  const assert = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`comments demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  // version isolation (R3): pinned rows only on their version, song-level rows everywhere
  const songLevel = { id: 'c1', versionId: null, deleted: false, createdAt: '2026-01-01T00:00:00Z' }
  const v1Only = { id: 'c2', versionId: 'v1', deleted: false, createdAt: '2026-01-02T00:00:00Z' }
  const v2Only = { id: 'c3', versionId: 'v2', deleted: false, createdAt: '2026-01-03T00:00:00Z' }
  assert(matchesVersion(songLevel, 'v1'), true, 'song-level comment shows on any version')
  assert(matchesVersion(v1Only, 'v1'), true, 'v1-pinned comment shows on v1')
  assert(matchesVersion(v1Only, 'v2'), false, 'v1-pinned comment is hidden on v2')
  assert(matchesVersion(v2Only, null), true, 'no version open → everything shows')

  // thread tree (R4): roots + replies oldest-first, deleted rows vanish (R6), replies to a missing parent drop
  const rows = [
    { id: 'a', parentId: null, deleted: false, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', parentId: 'a', deleted: false, createdAt: '2026-01-03T00:00:00Z' },
    { id: 'c', parentId: null, deleted: false, createdAt: '2026-01-02T00:00:00Z' },
    { id: 'd', parentId: 'b', deleted: false, createdAt: '2026-01-04T00:00:00Z' },
    { id: 'gone', parentId: null, deleted: true, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'orphan', parentId: 'missing', deleted: false, createdAt: '2026-01-05T00:00:00Z' },
  ]
  const tree = buildCommentTree(rows, null)
  assert(tree.map((root) => root.id).join(','), 'a,c', 'roots sorted oldest-first, deleted root dropped')
  assert(tree[0].replies.map((r) => r.id).join(','), 'b', 'reply attaches under its parent')
  assert(tree[0].replies[0].replies.map((r) => r.id).join(','), 'd', 'nested reply attaches depth-generically')
  assert(tree.some((root) => root.id === 'orphan'), false, 'reply to a missing parent is dropped')
  assert(buildCommentTree(rows.concat([v2Only]), 'v1').some((r) => r.id === 'v2Only'), false, 'other-version rows filtered from the tree')

  // anchors (R2): {section, index} convention labels
  assert(formatAnchor({ section: 'Chorus', index: 0 }), 'Chorus', 'section anchor label')
  assert(formatAnchor({ section: 'Bridge', index: 2 }), 'Bridge · line 3', '1-based line label')
  assert(formatAnchor(null), '', 'unanchored comment has no label')

  console.log('comments demo OK: 12 asserts (version isolation, thread tree, anchors)')
}