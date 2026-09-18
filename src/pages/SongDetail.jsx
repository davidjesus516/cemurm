import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSongs } from '../hooks/useSongs.js'
import { usePreferences } from '../hooks/usePreferences.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useComments } from '../hooks/useComments.js'
import { parseChordPro } from '../lib/chordpro/parser.js'
import { capoLabel, initialSemitones, transposeKey, transposeParsed } from '../lib/transpose.js'
import { listAnnotations } from '../lib/annotations.js'
import { buildCommentTree, formatAnchor } from '../lib/comments.js'
import { computeReadiness } from '../lib/readiness.js'
import ChordProRenderer, { sectionAnchorId } from '../components/notation/ChordProRenderer.jsx'

/* eslint-disable react/prop-types */

const STATUS_STYLES = {
  ready: 'bg-cem-emerald/10 text-cem-emerald',
  draft: 'bg-cem-amber/10 text-cem-amber',
  retired: 'bg-cem-elevated text-cem-secondary',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {status}
    </span>
  )
}

function TransitionLine({ t }) {
  const date = new Date(t.at).toLocaleDateString()
  return (
    <li className="text-xs text-cem-secondary">
      {(t.to || '?').charAt(0).toUpperCase() + (t.to || '?').slice(1)} ← {(t.from || '?').charAt(0).toUpperCase() + (t.from || '?').slice(1)} · {date}
      {t.reason ? ` (${t.reason})` : ''}
    </li>
  )
}

// 3.4: one thread node — a root comment (or a reply under it). Roots render
// Reply/Resolve; the author gets Edit/Delete; resolved roots collapse by
// default (spec R7). Body/actions/mine are derived from the row; anchors jump
// to the section (spec R2). Personal annotations never appear here — the
// renderer overlays those separately, so the two surfaces stay apart.
function CommentCard({ comment, userId, isRoot, onReply, onResolve, onDelete, onSaveEdit, onJump }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const mine = comment.authorId === userId
  const author = comment.authorName || (mine ? 'You' : 'Band member')
  const edited = comment.updatedAt && comment.updatedAt !== comment.createdAt

  function startEdit() {
    setDraft(comment.body)
    setEditing(true)
  }

  async function saveEdit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const saved = await onSaveEdit(comment, draft)
      if (saved) setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const inner = (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm font-semibold text-cem-text">{author}</span>
        <span className="text-xs text-cem-secondary">
          {new Date(comment.createdAt).toLocaleString()}
          {edited ? ' · edited' : ''}
        </span>
        {comment.pendingSync && (
          <span className="rounded bg-cem-amber/10 px-1.5 py-0.5 text-[10px] font-medium text-cem-amber">pending sync</span>
        )}
        {comment.resolved && <span className="text-xs font-medium text-cem-emerald">Resolved</span>}
      </div>

      {comment.anchor?.section && (
        <button
          type="button"
          onClick={() => onJump(comment.anchor)}
          className="mt-1 text-xs font-medium text-cem-amber hover:underline"
        >
          {formatAnchor(comment.anchor)}
        </button>
      )}

      {editing ? (
        <form onSubmit={saveEdit} className="mt-2 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !draft.trim()}
              className="rounded-md bg-cem-amber px-3 py-1 text-xs font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-cem-elevated px-3 py-1 text-xs font-medium text-cem-text hover:bg-cem-elevated"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm text-cem-text">{comment.body}</p>
      )}

      {!editing && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
          {isRoot && !comment.resolved && (
            <button type="button" onClick={() => onReply(comment)} className="text-cem-amber hover:underline">
              Reply
            </button>
          )}
          {isRoot && !comment.resolved && (
            <button type="button" onClick={() => onResolve(comment)} className="text-cem-emerald hover:underline">
              Resolve
            </button>
          )}
          {mine && !comment.deleted && (
            <button type="button" onClick={startEdit} className="text-cem-secondary hover:underline">
              Edit
            </button>
          )}
          {mine && !comment.deleted && (
            <button type="button" onClick={() => onDelete(comment)} className="text-cem-rose hover:underline">
              Delete
            </button>
          )}
        </div>
      )}

      {isRoot && comment.replies.length > 0 && (
        <ul className="mt-2 space-y-2 border-l border-cem-elevated pl-3">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              userId={userId}
              isRoot={false}
              onReply={onReply}
              onResolve={onResolve}
              onDelete={onDelete}
              onSaveEdit={onSaveEdit}
              onJump={onJump}
            />
          ))}
        </ul>
      )}
    </>
  )

  // Resolved roots collapse by default; expanding shows the thread under it.
  if (isRoot && comment.resolved) {
    return (
      <li>
        <details className="rounded-md bg-cem-surface px-3 py-2" open={false}>
          <summary className="cursor-pointer text-xs font-medium text-cem-secondary">
            Resolved · {author}: {comment.body.slice(0, 80)}{comment.body.length > 80 ? '…' : ''}
          </summary>
          <div className="mt-2">{inner}</div>
        </details>
      </li>
    )
  }
  return (
    <li className={isRoot ? 'rounded-md bg-cem-surface px-3 py-2' : 'px-2 py-1'}>
      {inner}
    </li>
  )
}

export default function SongDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { prefs } = usePreferences()
  const { getSong, getPlayedAt, updateSong, retireSong, reactivateSong } = useSongs()
  const [song, setSong] = useState(null)
  const [playedAt, setPlayedAt] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [annotations, setAnnotations] = useState([])
  const [versionId, setVersionId] = useState('')
  const [semitones, setSemitones] = useState(0)
  const comments = useComments(id)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentAnchor, setCommentAnchor] = useState(null)
  const [replyingTo, setReplyingTo] = useState(null)
  const [commentError, setCommentError] = useState('')
  const [sending, setSending] = useState(false)
  const [highlightSection, setHighlightSection] = useState(null)

  useEffect(() => {
    let cancelled = false
    getSong(id)
      .then((data) => { if (!cancelled) setSong(data) })
      .catch(() => { if (!cancelled) setError('Song not found.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    let cancelled = false
    getPlayedAt(id)
      .then((data) => { if (!cancelled) setPlayedAt(data) })
      .catch(() => { if (!cancelled) setPlayedAt([]) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 3.4: render the author's personal annotations (self-scoped) on this view.
  useEffect(() => {
    let cancelled = false
    if (!user?.id || !id) return undefined
    listAnnotations(user.id, id).then((rows) => { if (!cancelled) setAnnotations(rows) })
    return () => { cancelled = true }
  }, [user?.id, id])

  const versions = useMemo(() => song?.versions || [], [song?.versions])

  // 3.4: the band-visible thread for the OPEN version — buildCommentTree
  // filters other-version pins (version_id isolation) and deleted rows, and
  // shapes roots + replies oldest-first.
  const commentTree = useMemo(
    () => buildCommentTree(comments.rows, versionId || null),
    [comments.rows, versionId],
  )

  // 3.5: the personal default version opens first; the picker offers the
  // others (spec: personal preference, repertoire still lists all versions).
  useEffect(() => {
    if (!versions.length) return undefined
    setVersionId((current) => (
      current && versions.some((v) => v.id === current)
        ? current
        : (prefs.defaultVersion && versions.some((v) => v.id === prefs.defaultVersion)
            ? prefs.defaultVersion
            : versions[0].id)
    ))
    return undefined
  }, [versions, prefs.defaultVersion])

  const openVersion = song ? versions.find((v) => v.id === versionId) || versions[0] : null
  const openBody = openVersion?.body || ''

  const parsed = useMemo(() => (openBody ? parseChordPro(openBody) : null), [openBody])

  const displayKey = useMemo(() => {
    if (!parsed) return ''
    return semitones ? transposeKey(parsed.key, semitones) : parsed.key
  }, [parsed, semitones])

  // 3b renderer boundary: chart surfaces seed the global offset + override.
  const baseline = song ? initialSemitones(prefs.transpose, prefs.overrides[song.id]) : 0
  useEffect(() => {
    setSemitones(baseline)
  }, [baseline])

  const transposed = useMemo(() => {
    if (!parsed) return null
    return transposeParsed(parsed, semitones)
  }, [parsed, semitones])

  function startEditing() {
    setBody(song?.body || '')
    setError('')
    setEditing(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateSong(id, { body })
      setSong(updated)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRetire() {
    if (!window.confirm(`Retire "${song.title}"? It won't appear in the active list.`)) return
    const retired = await retireSong(id)
    setSong(retired)
  }

  async function handleReactivate() {
    const reactivated = await reactivateSong(id)
    setSong(reactivated)
  }

  // ── 3.4 shared-comments panel ────────────────────────────────────────────

  /** Clicking a section's Comment chip anchors the post to {section, index 0}. */
  function anchorToSection(sectionName) {
    setCommentAnchor({ section: sectionName, index: 0 })
    setCommentError('')
    document.getElementById('comments-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  /** Jump to the anchored section (spec R2) with a brief highlight. */
  function jumpToComment(anchor) {
    if (!anchor?.section) return
    document.getElementById(sectionAnchorId(anchor.section))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightSection(anchor.section)
    window.setTimeout(() => {
      setHighlightSection((current) => (current === anchor.section ? null : current))
    }, 2500)
  }

  function startReply(comment) {
    setReplyingTo(comment)
    setCommentDraft('')
    setCommentError('')
    document.getElementById('comments-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  async function submitComment(e) {
    e.preventDefault()
    const body = commentDraft.trim()
    if (!body) return
    setSending(true)
    try {
      // version_id pins the post to the OPEN version (spec R3); null = song-level.
      await comments.post(
        { songId: id, versionId: openVersion?.id || null, anchor: commentAnchor, body },
        replyingTo?.id || null,
      )
      setCommentDraft('')
      setCommentAnchor(null)
      setReplyingTo(null)
      setCommentError('')
    } catch (err) {
      setCommentError(err.message)
    } finally {
      setSending(false)
    }
  }

  /** Edit save — returns true when applied so the card closes. */
  async function saveEdit(comment, body) {
    try {
      await comments.edit(comment, body)
      return true
    } catch (err) {
      setCommentError(err.message)
      return false
    }
  }

  /** Resolve a thread (any scoped member, spec R7). */
  async function handleResolve(comment) {
    try {
      await comments.resolve(comment)
    } catch (err) {
      setCommentError(err.message)
    }
  }

  /** Soft-delete the author's own comment (spec R8). */
  async function handleDelete(comment) {
    if (!window.confirm('Delete your comment? It will disappear for everyone.')) return
    try {
      await comments.remove(comment)
    } catch (err) {
      setCommentError(err.message)
    }
  }

  if (loading) return <p className="text-sm text-cem-secondary">Loading song…</p>

  if (error && !song) {
    return (
      <div>
        <p className="rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>
        <Link to="/songs" className="mt-4 inline-block text-sm font-medium text-cem-amber hover:underline">
          Back to repertoire
        </Link>
      </div>
    )
  }

  const transitions = song?.transitionHistory || []
  const isRetired = song?.status === 'retired'

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/songs" className="text-sm font-medium text-cem-amber hover:underline">
        ← Back to repertoire
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cem-text">{song.title}</h1>
          <p className="mt-1 text-sm text-cem-secondary">
            {[openVersion?.key || '', openVersion?.bpm && `${openVersion.bpm} BPM`]
              .filter(Boolean).join(' · ') || 'No key or BPM set'}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={song.status} />
            {song.status === 'draft' && (
              <span className="text-xs text-cem-amber">{computeReadiness(song).reason}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!isRetired && !editing && song.body && (
            <>
              <Link
                to={`/songs/${id}/practice`}
                className="rounded-md border border-cem-emerald/40 px-3 py-1.5 text-sm font-medium text-cem-emerald hover:bg-cem-emerald/10"
              >
                Practice
              </Link>
              <button
                type="button"
                onClick={startEditing}
                className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-text hover:bg-cem-elevated"
              >
                Edit chart
              </button>
            </>
          )}
          {isRetired ? (
            <button
              type="button"
              onClick={handleReactivate}
              className="rounded-md border border-cem-emerald/40 px-3 py-1.5 text-sm font-medium text-cem-emerald hover:bg-cem-emerald/10"
            >
              Reactivate
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRetire}
              className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-secondary hover:bg-cem-elevated"
            >
              Retire
            </button>
          )}
        </div>
      </div>

      {versions.length > 1 && (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="song-version" className="text-sm font-medium text-cem-text">Version</label>
          <select
            id="song-version"
            value={versionId || ''}
            onChange={(e) => setVersionId(e.target.value)}
            className="rounded-md border border-cem-elevated bg-cem-surface px-3 py-1.5 text-sm text-cem-text focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name || `Version ${v.number || ''}`}
                {prefs.defaultVersion === v.id ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {transitions.length > 0 && (
        <div className="mt-4 rounded-md bg-cem-elevated px-3 py-2">
          <p className="mb-1 text-xs font-medium text-cem-secondary">Transition history</p>
          <ul className="space-y-0.5">
            {[...transitions].reverse().map((t, i) => (
              <TransitionLine key={i} t={t} />
            ))}
          </ul>
        </div>
      )}

      {playedAt.length > 0 && (
        <div className="mt-4 rounded-md bg-cem-elevated px-3 py-2">
          <p className="mb-1 text-xs font-medium text-cem-secondary">
            Played at · demand {playedAt.length}
          </p>
          <ul className="space-y-0.5">
            {playedAt.map((p, i) => (
              <li key={i} className="text-xs text-cem-text">
                played at{' '}
                <Link to={`/gigs/${p.gigId}`} className="font-medium text-cem-amber hover:underline">
                  {p.gigName}
                </Link>{' '}
                · {new Date(p.performedAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing ? (
        <form onSubmit={handleSave} className="mt-6 space-y-3">
          <label htmlFor="song-body" className="block text-sm font-medium text-cem-text">
            ChordPro text
          </label>
          <textarea
            id="song-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder={`{title: ${song.title}}\n[C]Lyric line with [G7]chords…`}
            className="w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 font-mono text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber"
          />
          {error && <p className="text-sm text-cem-rose">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save chart'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError('') }}
              disabled={saving}
              className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : parsed ? (
        <div className="mt-6">
          {(semitones !== 0 || prefs.capo > 0) && (
            <p className="mb-2 text-xs text-cem-secondary">
              {semitones !== 0 && `${displayKey} · ${semitones > 0 ? '+' : ''}${semitones} semitones`}
              {semitones !== 0 && prefs.capo > 0 ? ' · ' : ''}
              {prefs.capo > 0 ? capoLabel(displayKey, prefs.capo) : ''}
            </p>
          )}
          <ChordProRenderer
            parsed={transposed}
            annotations={annotations}
            semitones={semitones}
            baseKey={parsed?.key}
            onSectionComment={anchorToSection}
            highlightSection={highlightSection}
          />
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-cem-elevated bg-cem-surface p-8 text-center">
          <h2 className="text-base font-semibold text-cem-text">No chord chart yet</h2>
          <p className="mt-1 text-sm text-cem-secondary">
            Paste ChordPro text to see chords rendered above the lyrics.
          </p>
          <button
            type="button"
            onClick={startEditing}
            className="mt-4 rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
          >
            Add ChordPro text
          </button>
        </div>
      )}

      <div id="comments-panel" className="mt-6 rounded-lg border border-cem-elevated bg-cem-surface p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-cem-text">Band comments</h2>
          {comments.pendingCount > 0 && (
            <span className="text-xs text-cem-amber">{comments.pendingCount} pending sync</span>
          )}
        </div>

        {commentError && (
          <p className="mt-2 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose" role="alert">
            {commentError}
          </p>
        )}

        <form onSubmit={submitComment} className="mt-3 space-y-2">
          {commentAnchor && (
            <p className="text-xs text-cem-secondary">
              Anchored to{' '}
              <button
                type="button"
                onClick={() => jumpToComment(commentAnchor)}
                className="font-medium text-cem-amber hover:underline"
              >
                {formatAnchor(commentAnchor)}
              </button>
              <button
                type="button"
                onClick={() => setCommentAnchor(null)}
                className="ml-2 text-cem-secondary hover:text-cem-text"
                aria-label="Clear anchor"
              >
                ✕
              </button>
            </p>
          )}
          {replyingTo && (
            <p className="text-xs text-cem-secondary">
              Replying to {replyingTo.authorName || 'you'}{' '}
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="font-medium text-cem-amber hover:underline"
              >
                cancel
              </button>
            </p>
          )}
          <textarea
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            rows={2}
            placeholder="Comment for the band — e.g. slow the intro in the chorus…"
            className="w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber"
          />
          <button
            type="submit"
            disabled={sending || !commentDraft.trim()}
            className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
          >
            {sending ? 'Posting…' : 'Post comment'}
          </button>
        </form>

        {comments.loading ? (
          <p className="mt-4 text-sm text-cem-secondary">Loading comments…</p>
        ) : commentTree.length === 0 ? (
          <p className="mt-4 text-sm text-cem-secondary">No comments yet — start the thread.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {commentTree.map((root) => (
              <CommentCard
                key={root.id}
                comment={root}
                userId={user?.id}
                isRoot
                onReply={startReply}
                onResolve={handleResolve}
                onDelete={handleDelete}
                onSaveEdit={saveEdit}
                onJump={jumpToComment}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
