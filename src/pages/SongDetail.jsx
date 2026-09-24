import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useSongs } from '../hooks/useSongs.js'
import { usePreferences } from '../hooks/usePreferences.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useComments } from '../hooks/useComments.js'
import { usePublicLibrary } from '../hooks/usePublicLibrary.js'
import { parseChordPro } from '../lib/chordpro/parser.js'
import { capoLabel, initialSemitones, transposeKey, transposeParsed } from '../lib/transpose.js'
import { listAnnotations } from '../lib/annotations.js'
import { resolveDegree } from '../lib/degreeResolver.js'
import { buildCommentTree, formatAnchor } from '../lib/comments.js'
import { computeReadiness } from '../lib/readiness.js'
import { approvePublicSharing, getConsentStatus } from '../lib/minors.js'
import ChordProRenderer, { sectionAnchorId } from '../components/notation/ChordProRenderer.jsx'
import PdfChartViewer from '../components/songs/PdfChartViewer.jsx'
import { useSpotifyEnrichment } from '../hooks/useSpotifyEnrichment.js'
import EnrichmentPanel from '../components/songs/EnrichmentPanel.jsx'
import { PDF_SIZE_MESSAGE, PDF_TYPE_MESSAGE, validatePdfFile } from '../lib/pdfCharts.js'

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
function CommentCard({ comment, userId, isRoot, onReply, onResolve, onDelete, onSaveEdit, onJump, highlightedCommentId }) {
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
              highlightedCommentId={highlightedCommentId}
            />
          ))}
        </ul>
      )}
    </>
  )

  // Resolved roots collapse by default; expanding shows the thread under it.
  if (isRoot && comment.resolved) {
    return (
      <li data-comment-id={comment.id}>
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
    <li
      data-comment-id={comment.id}
      className={`${isRoot ? 'rounded-md bg-cem-surface px-3 py-2' : 'px-2 py-1'}${highlightedCommentId === comment.id ? ' bg-cem-amber/10' : ''}`}
    >
      {inner}
    </li>
  )
}

export default function SongDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { prefs } = usePreferences()
  const { getSong, getPlayedAt, updateSong, retireSong, reactivateSong, replacePdfScan } = useSongs()
  const [song, setSong] = useState(null)
  const [playedAt, setPlayedAt] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  // Hito 5 #76: PDF scan replace state (version append + success note).
  const [replacing, setReplacing] = useState(false)
  const [replaceNote, setReplaceNote] = useState('')
  const [replaceError, setReplaceError] = useState('')
  const replaceInputRef = useRef(null)
  const [annotations, setAnnotations] = useState([])
  const [versionId, setVersionId] = useState('')
  const [semitones, setSemitones] = useState(0)
  const [degreeView, setDegreeView] = useState(false)
  const comments = useComments(id)
  // Hito 5 #69: Spotify enrichment state machine — gates on online + the
  // connection row; applied values refresh the local song via onSongUpdated.
  const enrichment = useSpotifyEnrichment({
    song,
    onSongUpdated: (updated) => setSong(updated),
  })
  // S4.2 T2: catalog state backs the contribution actions + published badge.
  const library = usePublicLibrary()
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishLicense, setPublishLicense] = useState('CC-BY-4.0')
  const [publishRights, setPublishRights] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [contributionError, setContributionError] = useState('')
  // Hito 4: minor publish pre-check — UX mirror of the server-side guard
  // (migration 0017). The route gate guarantees an ACTIVE consent; the only
  // open question is guardian approval of public sharing.
  const [consentStatus, setConsentStatus] = useState(null)
  const [approvingSharing, setApprovingSharing] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentAnchor, setCommentAnchor] = useState(null)
  const [replyingTo, setReplyingTo] = useState(null)
  const [commentError, setCommentError] = useState('')
  const [sending, setSending] = useState(false)
  const [highlightSection, setHighlightSection] = useState(null)
  const [highlightedCommentId, setHighlightedCommentId] = useState(null)
  const lastHandledDeepLink = useRef(null)
  const [searchParams] = useSearchParams()
  const anchorParam = searchParams.get('anchor')
  const cidParam = searchParams.get('cid')

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

  // Hito 4: minors re-check their consent ledger on mount so the publish
  // action reflects CURRENT guardian approval (revocation flips the gate
  // back on server-side; this keeps the button honest).
  const isMinor = user?.isMinor === true
  useEffect(() => {
    let cancelled = false
    if (!isMinor || !user?.id) return undefined
    getConsentStatus(user.id)
      .then((row) => { if (!cancelled) setConsentStatus(row) })
      .catch(() => { if (!cancelled) setConsentStatus(null) })
    return () => { cancelled = true }
  }, [isMinor, user?.id])

  const versions = useMemo(() => song?.versions || [], [song?.versions])

  // S4.2 T2: my live catalog entry for this song (the view hides withdrawn
  // entries, so the action flips back to Contribute after a withdraw).
  const myEntry = useMemo(
    () => library.entries.find((entry) => entry.song_id === id) || null,
    [library.entries, id],
  )

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
  // Hito 5 #76: the OPEN version's format decides the chart surface — PDF scans
  // render in PdfChartViewer, ChordPro renders (as before). isPdfSong = latest
  // version is a scan (song-level; drives header actions like Replace scan).
  const openIsPdf = openVersion?.format === 'pdf'
  const isPdfSong = song?.isPdf === true

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

  // Degree map: maps concrete chord strings → roman numeral strings.
  // Computed from the song's key context + scale catalog. Only populated
  // when degreeView is enabled to avoid unnecessary async work.
  const [degreeMap, setDegreeMap] = useState(null)

  useEffect(() => {
    if (!degreeView || !parsed?.key) {
      setDegreeMap(null)
      return undefined
    }

    let cancelled = false

    async function buildDegreeMap() {
      // Collect all unique chords from all sections.
      const allChords = new Set()
      for (const section of parsed.sections) {
        for (const line of section.lines) {
          for (const c of line.chords) {
            allChords.add(c.chord)
          }
        }
      }

      const map = {}
      for (const chord of allChords) {
        const numeral = await resolveDegree(parsed.key, chord)
        if (numeral) map[chord] = numeral
      }

      if (!cancelled) setDegreeMap(map)
    }

    buildDegreeMap()
    return () => { cancelled = true }
  }, [degreeView, parsed])

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

  // Hito 5 #76: replace the current scan — replacePdfScan validates + uploads a
  // NEW object and appends a new version (number = max + 1); the previous scan
  // stays in version history. Success note per the feature spec, and the picker
  // jumps to the corrected version so the user sees the result immediately.
  async function handleReplaceScan(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return

    const check = validatePdfFile(file)
    if (!check.ok) {
      setReplaceError(check.reason === 'size' ? PDF_SIZE_MESSAGE : PDF_TYPE_MESSAGE)
      return
    }

    setReplacing(true)
    setReplaceError('')
    setReplaceNote('')
    try {
      const updated = await replacePdfScan(id, file)
      const newNumber = updated.versions.reduce((m, v) => Math.max(m, v.number || 0), 0)
      const newVersion = updated.versions.find((v) => v.number === newNumber)
      setSong(updated)
      if (newVersion) setVersionId(newVersion.id)
      setReplaceNote(
        `Corrected scan saved as v${newNumber} — previous scan preserved in version history.`,
      )
    } catch (err) {
      setReplaceError(err.message)
    } finally {
      setReplacing(false)
    }
  }

  // ── S4.2 T2 contribution actions ─────────────────────────────────────────
  // The RPCs own the hard gates (license confirmation, ownership); this page
  // only drives the UI. Publish errors surface inside the modal; withdraw
  // errors inline under the action row.

  function openPublish() {
    setPublishLicense('CC-BY-4.0')
    setPublishRights(false)
    setPublishError('')
    setPublishOpen(true)
  }

  async function handlePublish(e) {
    e.preventDefault()
    if (!publishRights) return
    setPublishError('')
    try {
      await library.publishEntry(id, publishLicense)
      setPublishOpen(false)
    } catch (err) {
      setPublishError(err.message)
    }
  }

  async function handleWithdraw() {
    if (!myEntry) return
    if (!window.confirm(`Withdraw "${song.title}" from the public library? Copies others already added stay theirs.`)) return
    setContributionError('')
    try {
      await library.withdrawEntry(myEntry.id)
    } catch (err) {
      setContributionError(err.message)
    }
  }

  // Hito 4: guardian approval of public sharing — called from the inline
  // "Approve public sharing" action when the minor's ACTIVE consent hasn't
  // been approved yet. The RPC records the approval; we re-read the ledger
  // so the publish button unlocks immediately.
  async function handleApproveSharing() {
    if (!user) return
    if (!window.confirm('Approve public sharing of this contribution? Your guardian can revoke this later via the emailed link.')) return
    setApprovingSharing(true)
    setContributionError('')
    try {
      await approvePublicSharing(user.id)
      const row = await getConsentStatus(user.id)
      setConsentStatus(row)
    } catch (err) {
      setContributionError(err.message)
    } finally {
      setApprovingSharing(false)
    }
  }

  // Minor publish gate: disabled (helper text) unless an ACTIVE consent with
  // public-sharing approval exists. The server stays the authority — this is
  // UX so minors see the reason before the RPC rejects them.
  const minorCanPublish =
    !isMinor || (consentStatus?.status === 'active' && consentStatus?.publicSharingApproved)
  const sharingNeedsApproval =
    consentStatus?.status === 'active' && !consentStatus?.publicSharingApproved

  // ── 3.4 shared-comments panel ────────────────────────────────────────────

  /** Clicking a section's Comment chip anchors the post to {section, index 0}. */
  function anchorToSection(sectionName) {
    setCommentAnchor({ section: sectionName, index: 0 })
    setCommentError('')
    document.getElementById('comments-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  /** Jump to the anchored section (spec R2) with a brief highlight. */
  const jumpToComment = useCallback((anchor) => {
    if (!anchor?.section) return
    document.getElementById(sectionAnchorId(anchor.section))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightSection(anchor.section)
    window.setTimeout(() => {
      setHighlightSection((current) => (current === anchor.section ? null : current))
    }, 2500)
  }, [])

  // 5.2 deep-link target (Feed6, S11/S12): a comment/mention notification
  // lands here as /songs/:songId?anchor=<section>&cid=<comment_id>. Once the
  // chart and that comment's row are in the DOM: jump to the anchored section,
  // bring the comments panel into view, and flash a highlight on the comment
  // row (sectionAnchorId precedent). One-shot per {anchor, cid} so unrelated
  // re-renders don't re-trigger the scroll.
  useEffect(() => {
    if (!anchorParam || !cidParam || !parsed || !commentTree.length) return undefined
    const found = commentTree.some((root) => (
      root.id === cidParam || root.replies.some((reply) => reply.id === cidParam)
    ))
    if (!found) return undefined
    if (lastHandledDeepLink.current === `${anchorParam}:${cidParam}`) return undefined
    jumpToComment({ section: anchorParam, index: 0 })
    document.getElementById('comments-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    const rowEl = document.querySelector(`[data-comment-id="${cidParam}"]`)
    if (rowEl) rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedCommentId(cidParam)
    lastHandledDeepLink.current = `${anchorParam}:${cidParam}`
    const timer = window.setTimeout(() => {
      setHighlightedCommentId((current) => (current === cidParam ? null : current))
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [anchorParam, cidParam, parsed, commentTree, jumpToComment])

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
            {/* Hito 5 #69: BPM provenance badge — spotify means enrichment
                filled it (scenario 4); declared key stays untouched. */}
            {openVersion?.metadata?.provenance?.bpm?.source === 'spotify' && (
              <span
                className="ml-1.5 rounded bg-cem-emerald/10 px-1.5 py-0.5 align-middle text-[10px] font-medium text-cem-emerald"
                title="Auto-filled from Spotify via enrichment"
              >
                Auto-filled
              </span>
            )}
            {/* Hito 5 #76: PDF scans carry no chord data — transposing a scan
                means replacing it with a new scan (scenario 7 mirror). */}
            {openIsPdf && (
              <span
                className="ml-1.5 rounded bg-cem-elevated px-1.5 py-0.5 align-middle text-[10px] font-medium text-cem-secondary"
                title="PDF scans carry no chord data — change key with a new scan"
              >
                PDF scans need a new scan to change key
              </span>
            )}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={song.status} />
            {song.status === 'draft' && (
              <span className="text-xs text-cem-amber">{computeReadiness(song).reason}</span>
            )}
            {myEntry && (
              <span className="rounded-full bg-cem-amber/10 px-2 py-0.5 text-xs font-medium text-cem-amber">
                In public library · {myEntry.license}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!isRetired && !editing && !isPdfSong && song.body && (
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
          {!isRetired && !editing && (myEntry ? (
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={library.withdrawingEntryId === myEntry.id}
              className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-secondary hover:bg-cem-elevated disabled:opacity-50"
            >
              {library.withdrawingEntryId === myEntry.id ? 'Withdrawing…' : 'Withdraw from library'}
            </button>
          ) : (song.userId === user?.id && song.body && (
            isMinor && !minorCanPublish ? (
              <span className="flex flex-col items-end gap-1.5">
                <button
                  type="button"
                  disabled
                  className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-secondary opacity-60"
                >
                  Contribute to library
                </button>
                <span className="text-xs text-cem-secondary">
                  Guardian approval required for public sharing
                </span>
                {sharingNeedsApproval && (
                  <button
                    type="button"
                    onClick={handleApproveSharing}
                    disabled={approvingSharing}
                    className="rounded-md border border-cem-amber/40 px-3 py-1 text-xs font-medium text-cem-amber hover:bg-cem-amber/10 disabled:opacity-50"
                  >
                    {approvingSharing ? 'Approving…' : 'Approve public sharing'}
                  </button>
                )}
              </span>
            ) : (
              <button
                type="button"
                onClick={openPublish}
                className="rounded-md border border-cem-amber/40 px-3 py-1.5 text-sm font-medium text-cem-amber hover:bg-cem-amber/10"
              >
                Contribute to library
              </button>
            )
          )))}
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

      {contributionError && (
        <p className="mt-2 text-sm text-cem-rose" role="alert">{contributionError}</p>
      )}

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
                {/* Hito 5 #76: per-version format badge so PDF scans are
                    distinguishable from ChordPro in the history picker. */}
                {' · '}{v.format === 'pdf' ? 'PDF scan' : 'ChordPro'}
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

      {openIsPdf ? (
        <div className="mt-6">
          {/* Hito 5 #76: replace action — append-only version flow; the
              previous scan stays in version history (native iframe renderer,
              no pdf.js). */}
          {!isRetired && (
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-cem-secondary">
                PDF scans are not editable as text — replace to upload a corrected scan.
              </p>
              <button
                type="button"
                onClick={() => replaceInputRef.current?.click()}
                disabled={replacing}
                className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-50"
              >
                {replacing ? 'Replacing…' : 'Replace scan'}
              </button>
              <input
                ref={replaceInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleReplaceScan}
                className="hidden"
              />
            </div>
          )}
          {replaceError && <p className="mb-2 text-sm text-cem-rose" role="alert">{replaceError}</p>}
          {replaceNote && <p className="mb-2 text-sm text-cem-emerald">{replaceNote}</p>}
          <PdfChartViewer
            title={song.title}
            objectPath={openVersion?.objectKey || song?.objectKey || ''}
            sizeBytes={openVersion?.sizeBytes ?? song?.sizeBytes ?? 0}
          />
        </div>
      ) : editing ? (
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
          {parsed.key && (
            <button
              type="button"
              onClick={() => setDegreeView((v) => !v)}
              className={`mb-3 rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                degreeView
                  ? 'border-cem-amber bg-cem-amber/10 text-cem-amber'
                  : 'border-cem-elevated text-cem-secondary hover:bg-cem-elevated'
              }`}
            >
              {degreeView ? 'Showing: Roman numerals' : 'Show roman numerals'}
            </button>
          )}
          <ChordProRenderer
            parsed={transposed}
            annotations={annotations}
            semitones={semitones}
            baseKey={parsed?.key}
            onSectionComment={anchorToSection}
            highlightSection={highlightSection}
            degreeView={degreeView}
            degreeMap={degreeMap}
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

      {/* Hito 5 #69: Spotify enrichment — preview, apply/discard, provenance.
          Declared key for the conflict check = the OPEN version's base key;
          the panel itself never writes it. */}
      <EnrichmentPanel song={song} enrichment={enrichment} declaredKey={openVersion?.key || ''} />

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
                highlightedCommentId={highlightedCommentId}
              />
            ))}
          </ul>
        )}
      </div>

      {publishOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPublishOpen(false) }}
        >
          <form
            onSubmit={handlePublish}
            className="mt-8 w-full max-w-md rounded-lg border border-cem-elevated bg-cem-surface p-4 text-cem-text shadow-xl"
          >
            <h2 className="text-lg font-semibold text-cem-text">Contribute to public library</h2>
            <p className="mt-1 text-sm text-cem-secondary">
              This song becomes a public entry with the license you choose, attributed to you as the
              contributor.
            </p>

            <label htmlFor="publish-license" className="mt-4 block text-sm font-medium text-cem-text">
              License
            </label>
            <select
              id="publish-license"
              value={publishLicense}
              onChange={(e) => setPublishLicense(e.target.value)}
              className="mt-1 w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber"
            >
              <option value="public-domain">Public domain</option>
              <option value="CC-BY-4.0">CC BY 4.0</option>
              <option value="proprietary">Proprietary</option>
            </select>

            <label className="mt-4 flex items-start gap-2 text-sm text-cem-text">
              <input
                type="checkbox"
                checked={publishRights}
                onChange={(e) => setPublishRights(e.target.checked)}
                className="mt-0.5"
              />
              I confirm I hold the right to share this chart under the chosen license.
            </label>

            {publishError && (
              <p className="mt-3 text-sm text-cem-rose" role="alert">{publishError}</p>
            )}

            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                disabled={!publishRights || library.publishingSongId === id}
                className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
              >
                {library.publishingSongId === id ? 'Publishing…' : 'Publish'}
              </button>
              <button
                type="button"
                onClick={() => setPublishOpen(false)}
                className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
