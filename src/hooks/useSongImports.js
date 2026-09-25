import { useCallback, useRef, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import { approveEntry, buildImportEntries } from '../lib/importers/queue.js'

/**
 * Import queue state (Hito 5 #78, S4/S5/S7/S8/S9). Owns the review entries and
 * the ONLY mutations of the import UI:
 *
 * - addFiles(FileList)      → reads each file's text (guarded: an unreadable
 *                             file becomes a parse-error entry, the batch
 *                             continues — S5) and builds the review queue via
 *                             queue.buildImportEntries (per-file parse errors,
 *                             duplicate flags, year/genre conflicts).
 * - approve(entry)          → queue.approveEntry — the only song-level write
 *                             (merge into the flagged target, or a new song);
 *                             the queue enforces ALL gates before writing:
 *                             malformed / license (S9) / duplicate decision
 *                             (S7) / conflict resolution (S8).
 * - discard(entryId)        → marks the row discarded (no write).
 * - setDecision / setConflict / setLicense / confirmLicense → patch the
 *   review entry's state (purely client-side until approve).
 *
 * Summary counters (created/discarded) feed the success line. Errors surface
 * on the panel and never corrupt an entry mid-review.
 */
export function useSongImports({ onImported = null } = {}) {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [summary, setSummary] = useState({ created: 0, discarded: 0 })
  const [error, setError] = useState('')

  // Render-time ref mirrors: stable callbacks read the LATEST user/callback
  // without recreating themselves (useMidi pattern).
  const userIdRef = useRef(user?.id || null)
  const onImportedRef = useRef(onImported)
  userIdRef.current = user?.id || null
  onImportedRef.current = onImported

  const addFiles = useCallback(async (files) => {
    const userId = userIdRef.current
    const list = Array.from(files || [])
    if (!userId || !list.length) return
    setError('')
    try {
      const read = []
      for (const file of list) {
        try {
          read.push({ name: file.name, text: await file.text() })
        } catch {
          read.push({ name: file.name, text: '' }) // unreadable → parse-error entry; batch continues (S5)
        }
      }
      const built = await buildImportEntries(read, userId)
      setEntries((prev) => [...prev, ...built])
    } catch (e) {
      setError(e?.message || 'Could not read the selected files.')
    }
  }, [])

  const patchEntry = useCallback((entryId, patch) => {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, ...patch } : e)))
  }, [])

  const setDecision = useCallback((entryId, decision) => {
    setEntries((prev) => prev.map((e) => {
      if (e.id !== entryId) return e
      const dup = e.duplicate || { candidates: [], decision: null, targetSongId: null }
      return {
        ...e,
        duplicate: {
          ...dup,
          decision,
          // Merge targets the first flagged candidate by default — the review
          // gate requires a concrete target before any write (S7).
          targetSongId: decision === 'merge' ? (dup.targetSongId || dup.candidates[0]?.id || null) : null,
        },
      }
    }))
  }, [])

  const setConflict = useCallback((entryId, field, chosen) => {
    setEntries((prev) => prev.map((e) => {
      if (e.id !== entryId) return e
      return {
        ...e,
        conflicts: (e.conflicts || []).map((c) => (c.field === field ? { ...c, chosen } : c)),
      }
    }))
  }, [])

  const setLicense = useCallback((entryId, license) => {
    patchEntry(entryId, { license })
  }, [patchEntry])

  const confirmLicense = useCallback((entryId) => {
    patchEntry(entryId, { licenseConfirmed: true })
  }, [patchEntry])

  const approve = useCallback(async (entry) => {
    const userId = userIdRef.current
    if (!userId) return
    setError('')
    try {
      const result = await approveEntry(userId, entry)
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: 'approved', appliedSongId: result.songId } : e)))
      setSummary((s) => ({ ...s, created: s.created + 1 }))
      onImportedRef.current?.()
    } catch (e) {
      setError(e?.message || 'Could not approve this import.')
    }
  }, [])

  const discard = useCallback((entryId) => {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status: 'discarded' } : e)))
    setSummary((s) => ({ ...s, discarded: s.discarded + 1 }))
  }, [])

  const reset = useCallback(() => {
    setEntries([])
    setSummary({ created: 0, discarded: 0 })
    setError('')
  }, [])

  return {
    entries,
    summary,
    error,
    addFiles,
    setDecision,
    setConflict,
    setLicense,
    confirmLicense,
    approve,
    discard,
    reset,
  }
}