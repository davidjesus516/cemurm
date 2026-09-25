/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { metadataOnlyFromUrl } from '../../lib/importers/urlImport.js'

/**
 * T7 — URL import dialog (Hito 5 #78, S14/S15): METADATA-ONLY by design.
 * Paste a link → metadataOnlyFromUrl derives prefill title/artist from the
 * URL slug WITHOUT ever fetching the page (code-review point: there is no
 * fetch here at all — the only network that may happen is the optional
 * MusicBrainz artist completion inside urlImport.js, mock by default).
 *
 * - Chord-site URL → the EXACT S15 message
 *   ("We don't import content from chord sites — paste your own chart") +
 *   a metadata-only `Prefill new song` offer (title from the slug).
 * - Normal URL → prefilled title + best-effort artist shown; `Prefill new
 *   song` hands initial={{ title, artist }} back to Songs.jsx, which opens
 *   SongForm with it (SongForm already accepts `initial`).
 * - Invalid URL → inline error ('Enter a valid URL.').
 * - Offline → artist completion skipped (best-effort), title still prefills.
 */
export default function ImportUrlDialog({ onClose, onPrefill }) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle') // idle|working|done|error
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  async function handleImportUrl() {
    if (status === 'working') return
    setStatus('working')
    setErrorMessage('')
    setResult(null)
    try {
      const res = await metadataOnlyFromUrl(url)
      if (!res.ok) {
        setErrorMessage(res.error)
        setStatus('error')
        return
      }
      setResult(res)
      setStatus('done')
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  function handlePrefill() {
    onPrefill?.(result?.prefill || {})
    onClose?.()
  }

  return (
    <div className="mt-4 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-cem-text">Import from URL</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-cem-secondary hover:underline"
        >
          Close
        </button>
      </div>
      <p className="mt-1 text-xs text-cem-secondary">
        Paste a link to prefill the title and artist — metadata only, the page content is never
        downloaded.
      </p>

      <div className="mt-3 flex items-start gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setErrorMessage('')
            setResult(null)
            setStatus('idle')
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleImportUrl() }}
          placeholder="https://example.com/songs/my-song"
          disabled={status === 'working'}
          className="w-full max-w-md rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleImportUrl}
          disabled={status === 'working' || !url.trim()}
          className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
        >
          {status === 'working' ? 'Reading…' : 'Import from URL'}
        </button>
      </div>

      {errorMessage && (
        <p className="mt-2 text-xs text-cem-rose" role="alert">{errorMessage}</p>
      )}

      {status === 'done' && result?.chordSite && (
        <div className="mt-3 rounded-md bg-cem-amber/10 px-3 py-2">
          <p className="text-sm text-cem-amber">
            {"We don't import content from chord sites — paste your own chart"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {result.prefill.title && (
              <span className="text-xs text-cem-secondary">Title: {result.prefill.title}</span>
            )}
            <button
              type="button"
              onClick={handlePrefill}
              className="rounded-md bg-cem-amber px-3 py-1 text-xs font-medium text-cem-base hover:bg-cem-amber/90"
            >
              Prefill new song
            </button>
          </div>
        </div>
      )}

      {status === 'done' && result && !result.chordSite && (
        <div className="mt-3 rounded-md bg-cem-amber/10 px-3 py-2">
          <p className="text-sm text-cem-text">
            Title: <span className="font-medium">{result.prefill.title || '—'}</span>
            {result.prefill.artist && (
              <>
                {' '}· Artist: <span className="font-medium">{result.prefill.artist}</span>
              </>
            )}
          </p>
          {!online && !result.prefill.artist && (
            <p className="mt-1 text-xs text-cem-secondary">
              Offline — artist completion skipped (title still prefilled).
            </p>
          )}
          <button
            type="button"
            onClick={handlePrefill}
            className="mt-2 rounded-md bg-cem-amber px-3 py-1 text-xs font-medium text-cem-base hover:bg-cem-amber/90"
          >
            Prefill new song
          </button>
        </div>
      )}
    </div>
  )
}