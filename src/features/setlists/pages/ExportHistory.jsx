// Export history (Hito 6 N3, T3): /exports
//
// features/export-and-sharing.feature:158-178. Three of the four
// export-management scenarios live on this page:
//
//   "View export history"        → the list below, newest first
//   "Regenerate a previously …"  → re-serializes the setlist as it is NOW
//   "Delete an exported file …"  → drops the cached bytes, keeps the row
//
// The fourth (batch ZIP for an event) lives on the setlists page, next to the
// selection it exports.
//
// Documented deviation, same as the exporters themselves: there is no PDF
// writer in this build and a setlist's PDF chart is a storage object, so a
// history row can never be a PDF. `Regenerate` re-runs the real serializer for
// the format that was actually exported.
//
// Tier 2 (visual system): a list read at arm's length. No material, no
// decorative shadow.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import { useSetlists } from '../../../hooks/shared/useSetlists.js'
import { buildSetlistFile } from '../../../domain/setlist/exporters/setlistFile.js'
import { saveFile } from '../../../domain/setlist/exporters/saveFile.js'
import {
  formatLabel,
  isAvailableOffline,
} from '../../../domain/setlist/exportHistory.js'
import { formatBytes } from '../../../domain/library/formatBytes.js'
import {
  deleteExportFile,
  listExports,
  loadExportFile,
  replaceExportFile,
} from '../../../data/repositories/exportHistory.js'

/**
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'unknown date'
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export default function ExportHistory() {
  const { user } = useAuth()
  const { setlists } = useSetlists()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const reload = useCallback(async () => {
    if (!user) return
    const rows = await listExports(user.id)
    setEntries(rows)
    setLoading(false)
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  async function handleRegenerate(entry) {
    const setlist = setlists.find((candidate) => candidate.id === entry.setlistId)
    if (!setlist) {
      setError('That setlist no longer exists, so it cannot be regenerated.')
      return
    }

    setBusyId(entry.id)
    setError('')
    setNotice('')
    try {
      // Serialized from the CURRENT setlist, which is the whole point of
      // regenerating: the new file reflects every edit since the last export.
      const file = buildSetlistFile(setlist, setlist.songs, entry.format)
      await replaceExportFile(user.id, entry.id, {
        setlistId: entry.setlistId,
        setlistName: setlist.name,
        format: entry.format,
        file,
      })
      saveFile({ filename: file.filename, mimeType: file.mimeType, body: file.text })
      await reload()
      setNotice(`Regenerated ${file.filename} from the current setlist.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  async function handleDownload(entry) {
    setBusyId(entry.id)
    setError('')
    setNotice('')
    try {
      const cached = await loadExportFile(user.id, entry.id)
      if (!cached) {
        setError('That file is no longer stored on this device. Regenerate it instead.')
        return
      }
      saveFile({ filename: cached.filename, mimeType: cached.mimeType, body: cached.text })
      setNotice(`Downloaded ${cached.filename}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  async function handleDelete(entry) {
    setBusyId(entry.id)
    setError('')
    setNotice('')
    try {
      const rows = await deleteExportFile(user.id, entry.id)
      setEntries(rows)
      setNotice(`Deleted ${entry.filename} from this device. The history entry stays.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cem-text">Export History</h1>
        <Link
          to="/setlists"
          className="text-sm font-medium text-cem-amber hover:underline"
        >
          ← Setlists
        </Link>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-text">{error}</p>
      )}

      {notice && (
        <p className="mt-3 rounded-md bg-cem-amber/10 px-3 py-2 text-sm text-cem-amber">{notice}</p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-cem-secondary">Loading exports…</p>
      ) : entries.length === 0 ? (
        <p className="mt-6 text-sm text-cem-secondary">
          No exports yet. Export a setlist from its page and it will appear here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface">
          {entries.map((entry) => {
            const available = isAvailableOffline(entry)
            const busy = busyId === entry.id
            return (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-cem-text">
                    {entry.setlistName}
                  </p>
                  <p className="mt-0.5 text-xs text-cem-secondary">
                    {formatLabel(entry.format)} · {formatDate(entry.savedAt)} ·{' '}
                    {formatBytes(entry.bytes)}
                    {!available && ' · no longer available offline'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleRegenerate(entry)}
                    disabled={busy}
                    className="text-xs font-medium text-cem-amber hover:underline disabled:opacity-60"
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(entry)}
                    disabled={busy || !available}
                    className="text-xs font-medium text-cem-amber hover:underline disabled:opacity-60"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry)}
                    disabled={busy || !available}
                    className="text-xs font-medium text-cem-secondary hover:underline disabled:opacity-60"
                  >
                    Delete export
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
