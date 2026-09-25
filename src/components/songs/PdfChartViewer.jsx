/* eslint-disable react/prop-types */
// PDF scan viewer (Hito 5 #76): native iframe rendering (NO pdf.js — inline
// browser PDF viewer), CSS scale zoom/pan, download/new-tab fallback, and an
// offline-in-cache blobUrl path used by StageMode. House components may use
// eslint-disable react/prop-types (repo convention — no prop-types dep).

import { useEffect, useState } from 'react'
import { signedPdfUrl } from '../../lib/pdfCharts.js'

// Zoom presets (scenario 4). Buttons [−, 75%, 100%, 150%, 200%, +] map here;
// −/+ step between presets and continue beyond the ends (×0.75 / ×1.33).
const ZOOM_PRESETS = [0.75, 1, 1.5, 2]
const BASE_W = 800 // fixed iframe layout size — CSS scale does the zooming
const BASE_H = 1100 // ~A4 aspect; scroll bounds = BASE × zoom (overflow-auto)

/** Inline render capability: most Chromium/Firefox/Safari ship a built-in PDF
 *  viewer. Unknown (undefined) is treated as capable — the iframe error
 *  handler then falls back. */
function canRenderPdfInline() {
  return typeof navigator !== 'undefined' && navigator.pdfViewerEnabled !== false
}

function formatBytes(n) {
  if (!n) return ''
  const units = ['B', 'KB', 'MB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

export default function PdfChartViewer({ title, objectPath, sizeBytes, blobUrl }) {
  const [state, setState] = useState(blobUrl ? 'ready' : 'signing') // signing|ready|fallback|error
  const [signedUrl, setSignedUrl] = useState(blobUrl || '')
  const [iframeFailed, setIframeFailed] = useState(false)
  const [zoom, setZoom] = useState(1)

  // Sign the object path (or use the offline blobUrl directly — no network).
  useEffect(() => {
    let cancelled = false
    if (blobUrl) {
      setSignedUrl(blobUrl)
      setState('ready')
      return undefined
    }
    setState('signing')
    setIframeFailed(false)
    signedPdfUrl(objectPath)
      .then(({ signedUrl }) => {
        if (cancelled) return
        setSignedUrl(signedUrl)
        setState('ready')
      })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [blobUrl, objectPath])

  function retry() {
    setState('signing')
    setIframeFailed(false)
    signedPdfUrl(objectPath)
      .then(({ signedUrl }) => { setSignedUrl(signedUrl); setState('ready') })
      .catch(() => setState('error'))
  }

  function zoomOut() {
    const i = ZOOM_PRESETS.lastIndexOf(zoom)
    setZoom(i > 0 ? ZOOM_PRESETS[i - 1] : Math.max(0.5, zoom * 0.75))
  }

  function zoomIn() {
    const i = ZOOM_PRESETS.lastIndexOf(zoom)
    setZoom(i >= 0 && i < ZOOM_PRESETS.length - 1 ? ZOOM_PRESETS[i + 1] : Math.min(4, zoom * 1.33))
  }

  const showInline = state === 'ready' && canRenderPdfInline() && !iframeFailed
  const linkUrl = signedUrl || ''
  const offlineCopy = Boolean(blobUrl)

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-cem-elevated bg-cem-surface">
      {/* Toolbar — zoom (chord charts) + size + open/download (always present:
          graceful degrade when inline rendering is unavailable) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-cem-elevated px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={!showInline}
            className="rounded border border-cem-elevated px-2 py-0.5 text-sm font-bold text-cem-text hover:bg-cem-elevated disabled:opacity-40"
            aria-label="Zoom out"
          >
            −
          </button>
          {ZOOM_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setZoom(p)}
              disabled={!showInline}
              className={`rounded border px-2 py-0.5 text-xs font-medium disabled:opacity-40 ${
                zoom === p ? 'border-cem-amber bg-cem-amber/10 text-cem-amber' : 'border-cem-elevated text-cem-secondary hover:bg-cem-elevated'
              }`}
            >
              {Math.round(p * 100)}%
            </button>
          ))}
          <button
            type="button"
            onClick={zoomIn}
            disabled={!showInline}
            className="rounded border border-cem-elevated px-2 py-0.5 text-sm font-bold text-cem-text hover:bg-cem-elevated disabled:opacity-40"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>

        <span className="ml-auto text-xs text-cem-secondary">
          {sizeBytes ? `${formatBytes(sizeBytes)} · ` : ''}
          {title}
          {offlineCopy ? ' · offline copy' : ''}
        </span>

        {linkUrl && (
          <div className="flex gap-1">
            <a
              href={linkUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-cem-elevated px-2 py-0.5 text-xs font-medium text-cem-amber hover:bg-cem-elevated"
            >
              Open in new tab
            </a>
            <a
              href={linkUrl}
              download={`${title || 'scan'}.pdf`}
              className="rounded border border-cem-elevated px-2 py-0.5 text-xs font-medium text-cem-text hover:bg-cem-elevated"
            >
              Download
            </a>
          </div>
        )}
      </div>

      {/* Chart area */}
      <div className="h-[65vh] w-full overflow-auto bg-cem-base/60 p-2">
        {state === 'signing' && (
          <p className="flex h-full items-center justify-center text-sm text-cem-secondary">
            Preparing PDF scan…
          </p>
        )}

        {state === 'error' && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-cem-rose">Could not load the PDF scan</p>
            <button
              type="button"
              onClick={retry}
              className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-text hover:bg-cem-elevated"
            >
              Try again
            </button>
          </div>
        )}

        {state === 'ready' && !showInline && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-cem-text">
              Your browser cannot show PDFs inline{linkUrl || offlineCopy ? ' — open or download it instead.' : '.'}
            </p>
            {linkUrl && (
              <div className="flex gap-2">
                <a
                  href={linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
                >
                  Open in new tab
                </a>
                <a
                  href={linkUrl}
                  download={`${title || 'scan'}.pdf`}
                  className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated"
                >
                  Download
                </a>
              </div>
            )}
          </div>
        )}

        {showInline && (
          <div style={{ width: BASE_W * zoom, height: BASE_H * zoom }}>
            <iframe
              title={title || 'PDF scan'}
              src={linkUrl}
              onError={() => setIframeFailed(true)}
              className="h-full w-full border-0"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}