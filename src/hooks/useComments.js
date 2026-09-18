import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import * as comments from '../lib/comments.js'

/**
 * Shared comments state for one song (useBandmates pattern): reads the
 * band-visible thread, keeps pendingSync rows across failed refreshes (an
 * offline post must stay on screen until the drain publishes it), and
 * exposes optimistic mutations. Version filtering is derived in the page via
 * buildCommentTree(rows, versionId) — switching versions refilters without a
 * refetch.
 */
export function useComments(songId) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  // Merge the server read with locally-pending rows: a failed refresh must
  // not hide queued comments, and a drained post must not leave a duplicate
  // 'local-' twin behind (same song + parent + body = the same comment).
  const merge = useCallback((prev, fetched) => {
    const fresh = fetched.map((row) => ({ ...row, pendingSync: false }))
    const stillPending = prev.filter((pending) => (
      pending.pendingSync
      && !fresh.some((row) => (
        row.songId === pending.songId
        && (row.parentId || null) === (pending.parentId || null)
        && row.body === pending.body
      ))
    ))
    return [...stillPending, ...fresh]
  }, [])

  const refresh = useCallback(async () => {
    if (!user || !songId) return
    setLoading(true)
    try {
      const fetched = await comments.listComments(user.id, songId)
      setRows((prev) => merge(prev, fetched))
    } finally {
      setLoading(false)
    }
  }, [user, songId, merge])

  // Read on mount, on reconnect, and after the offline drain publishes.
  useEffect(() => {
    refresh()
    if (typeof window === 'undefined') return undefined
    window.addEventListener('online', refresh)
    window.addEventListener('cemurm:sync-done', refresh)
    return () => {
      window.removeEventListener('online', refresh)
      window.removeEventListener('cemurm:sync-done', refresh)
    }
  }, [refresh])

  const upsert = useCallback((patch) => {
    setRows((prev) => (prev.some((row) => row.id === patch.id)
      ? prev.map((row) => (row.id === patch.id ? { ...row, ...patch } : row))
      : [...prev, patch]))
  }, [])

  const drop = useCallback((id) => {
    setRows((prev) => prev.filter((row) => row.id !== id))
  }, [])

  /**
   * Post a comment (or a reply when parentId is set). Returns the row; throws
   * 'No access.' / 'Comment body is required.' for the page to surface.
   */
  const post = useCallback(async (payload, parentId = null) => {
    const row = await comments.postComment(user.id, { ...payload, parentId })
    upsert(row)
    return row
  }, [user, upsert])

  const edit = useCallback(async (comment, body) => {
    const patch = await comments.editComment(user.id, comment.id, body)
    upsert(patch)
    return patch
  }, [user, upsert])

  const resolve = useCallback(async (comment) => {
    const patch = await comments.resolveComment(user.id, comment.id)
    upsert(patch)
    return patch
  }, [user, upsert])

  const remove = useCallback(async (comment) => {
    const patch = await comments.deleteComment(user.id, comment.id)
    // Soft-deleted rows vanish from the thread (and their subtree) — drop the
    // local copy now; a server read will confirm.
    drop(comment.id)
    return patch
  }, [user, drop])

  return useMemo(() => ({
    rows,
    loading,
    refresh,
    post,
    edit,
    resolve,
    remove,
    pendingCount: rows.filter((row) => row.pendingSync).length,
  }), [rows, loading, refresh, post, edit, resolve, remove])
}