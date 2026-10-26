// Settings > Import my data (feature:29, :75). Reads a CEMURM export ZIP in the
// browser, validates it, and hands the document to the 0044 RPC. Only the core
// working set is importable (ODD record D2) — the rest of the bundle stays
// read-only, and the copy below says so.
//
// State machine: idle → reading → importing → done | failed. `busy` is a ref,
// not state: two change events can land in the same React tick. The file input
// stays uncontrolled (its value is never rendered by React); it is cleared after
// each read so picking the same file again still fires.

import { useRef, useState } from 'react'
import { importAccountData } from '../../../data/repositories/accountImport.js'
import { parseImportBundle } from '../../../domain/account/importBundle.js'

const FALLBACK_ERROR = 'Could not import this export — please try again.'

const COUNT_LABELS = [
  ['songs', 'Songs'],
  ['versions', 'Versions'],
  ['charts', 'Charts'],
  ['tags', 'New tags'],
  ['reused_tags', 'Tags reused'],
  ['collections', 'Collections'],
  ['collection_songs', 'Collection entries'],
  ['setlists', 'Setlists'],
  ['setlist_items', 'Setlist items'],
  ['annotations', 'Annotations'],
  ['skipped_setlist_items', 'Skipped setlist items (song not in bundle)'],
  ['skipped_collection_songs', 'Skipped collection entries (song not in bundle)'],
  ['skipped_annotations', 'Skipped annotations (song not in bundle)'],
  ['skipped_versions', 'Skipped versions (song not in bundle)'],
  ['skipped_charts', 'Skipped charts (song not in bundle)'],
]

/**
 * @param {Record<string, unknown>} summary
 * @returns {[string, number][]}
 */
function countRows(summary) {
  return COUNT_LABELS
    .map(([key, label]) => [label, Number(summary[key]) || 0])
    .filter(([, count]) => count > 0)
}

export default function ImportDataCard() {
  const [status, setStatus] = useState('idle') // idle | reading | importing | done | failed
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const busy = useRef(false)

  async function handleFile(event) {
    const input = event.target
    const file = input.files && input.files[0]
    if (!file || busy.current) {
      // clear even when busy: the next attempt must be able to pick the same file
      input.value = ''
      return
    }

    busy.current = true
    setStatus('reading')
    setSummary(null)
    setError('')

    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const { document } = parseImportBundle(bytes)
      setStatus('importing')
      const result = await importAccountData(document)
      setSummary(result)
      setStatus('done')
    } catch (e) {
      setStatus('failed')
      setError(e instanceof Error && e.message ? e.message : FALLBACK_ERROR)
    } finally {
      input.value = ''
      busy.current = false
    }
  }

  const working = status === 'reading' || status === 'importing'
  const rows = summary ? countRows(summary) : []

  return (
    <div>
      <p className="mt-1 text-sm text-cem-secondary">
        Restore the core working set from a CEMURM export ZIP: songs, versions, charts,
        tags, collections, setlists and annotations, plus your preferences.
      </p>

      <label className="mt-3 block text-sm font-medium text-cem-text" htmlFor="import-bundle">
        Export bundle (.zip)
      </label>
      <input
        id="import-bundle"
        type="file"
        accept=".zip,application/zip"
        onChange={handleFile}
        disabled={working}
        className="mt-1 block w-full text-sm text-cem-secondary file:mr-3 file:rounded file:border file:border-cem-elevated file:bg-cem-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-cem-text hover:file:bg-cem-elevated disabled:opacity-60"
      />

      {working && (
        <p className="mt-2 text-xs text-cem-secondary" role="status">
          {status === 'reading' ? 'Reading the bundle…' : 'Importing…'}
        </p>
      )}

      {status === 'done' && (
        <div className="mt-3 rounded-lg border border-cem-elevated bg-cem-surface p-3">
          <p className="text-sm font-medium text-cem-text">Import finished.</p>
          {rows.length === 0 ? (
            <p className="mt-1 text-xs text-cem-secondary">
              This bundle had no importable records.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs text-cem-secondary">
              {rows.map(([label, count]) => (
                <li key={label} className="flex justify-between gap-3">
                  <span>{label}</span>
                  <span className="font-medium text-cem-text">{count}</span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setStatus('idle')
              setSummary(null)
            }}
            className="mt-3 rounded border border-cem-elevated bg-cem-surface px-3 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated"
          >
            Import another bundle
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-cem-amber" role="alert">{error}</p>
      )}

      <p className="mt-3 text-xs text-cem-secondary">
        Importing adds a second copy if you run the same bundle twice — nothing is
        deduplicated. PDF scans are not included in the bundle, so those charts keep their
        version history but no scan. Comments, practice history, gigs and notifications
        stay in the JSON as a read-only archive.
      </p>
    </div>
  )
}
