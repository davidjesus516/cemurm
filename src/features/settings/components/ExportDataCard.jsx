// Settings > Export my data (feature:10-14). Builds the bundle client-side from
// the 0042 RPC envelope and hands it to the browser as a download. The RPC
// always returns a well-formed envelope, so an empty account exports too.
//
// State machine: idle → building → done | failed. `busy` is a ref, not state,
// because two clicks can land in the same React tick before a re-render
// disables the button.

import { useRef, useState } from 'react'
import { exportAccountData } from '../../../data/repositories/accountExport.js'
import { buildExportZip } from '../../../domain/account/exportZip.js'

const FALLBACK_ERROR = 'Could not export your data right now — please try again.'

/**
 * @param {{ name: string, bytes: Uint8Array }} bundle
 */
function downloadBundle(bundle) {
  const url = URL.createObjectURL(new Blob([bundle.bytes], { type: 'application/zip' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = bundle.name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoking in the same tick can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function ExportDataCard() {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const busy = useRef(false)

  async function handleExport() {
    if (busy.current) return
    busy.current = true
    setStatus('building')
    setMessage('')
    setError('')

    try {
      const envelope = await exportAccountData()
      const bundle = buildExportZip(envelope)
      downloadBundle(bundle)
      setStatus('done')
      setMessage(`Downloaded ${bundle.name}.`)
    } catch (e) {
      setStatus('failed')
      setError(e instanceof Error && e.message ? e.message : FALLBACK_ERROR)
    } finally {
      busy.current = false
    }
  }

  const building = status === 'building'

  return (
    <div>
      <p className="mt-1 text-sm text-cem-secondary">
        Download a copy of your account as a ZIP with a JSON file and a readable summary.
      </p>

      <button
        type="button"
        onClick={handleExport}
        disabled={building}
        className="mt-3 rounded border border-cem-elevated bg-cem-surface px-3 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
      >
        {building ? 'Building export…' : status === 'done' ? 'Export again' : status === 'failed' ? 'Try again' : 'Export my data'}
      </button>

      {message && (
        <p className="mt-2 text-xs text-cem-secondary" role="status">{message}</p>
      )}
      {error && (
        <p className="mt-2 text-xs text-cem-amber" role="alert">{error}</p>
      )}
    </div>
  )
}
