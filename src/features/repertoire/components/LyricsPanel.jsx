/* eslint-disable react/prop-types */
// LRCLIB lyrics surface (Hito 5 #78, S11): fetch button → suggested block
// (preview + Apply/Discard) → applied lyrics block with "Lyrics · LRCLIB"
// credit + provenance badge. States come from useLyricsEnrichment (idle |
// looking | suggested | applying | applied | discarded | noMatch | offline |
// error). Apply writes the text into the OPEN version's metadata first, then
// flips the provenance row (hook ordering — mirror of the #69 Spotify flow).
// No connection row exists for LRCLIB: it is a public API.

function LyricsBlock({ text, credit }) {
  return (
    <div className="mt-3 rounded-md bg-cem-elevated p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-cem-amber">{credit}</p>
        <span className="rounded bg-cem-emerald/10 px-1.5 py-0.5 text-[10px] font-medium text-cem-emerald">
          Auto-filled from LRCLIB
        </span>
      </div>
      <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-cem-text">{text}</pre>
    </div>
  )
}

export default function LyricsPanel({ song, version, enrichment }) {
  const {
    state,
    errorMessage,
    rows,
    online,
    lookup,
    apply,
    discard,
  } = enrichment

  const appliedText = version?.metadata?.lyrics?.text || ''
  const suggested = rows.find((r) => r.field === 'lyrics')?.value?.lyrics || ''
  const looking = state === 'looking'

  return (
    <div className="mt-6 rounded-lg border border-cem-elevated bg-cem-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-cem-text">Lyrics</h2>
        {state === 'suggested' && (
          <span className="text-xs text-cem-secondary">Suggested by LRCLIB — not saved yet</span>
        )}
      </div>

      {appliedText ? (
        <LyricsBlock text={appliedText} credit="Lyrics · LRCLIB" />
      ) : state === 'suggested' || state === 'applying' ? (
        <div className="mt-3">
          <LyricsBlock text={suggested} credit="Suggested · LRCLIB" />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={state === 'applying'}
              className="rounded-md bg-cem-emerald px-3 py-1.5 text-xs font-medium text-cem-base hover:bg-cem-emerald/90 disabled:opacity-60"
            >
              {state === 'applying' ? 'Applying…' : 'Apply to this version'}
            </button>
            <button
              type="button"
              onClick={discard}
              disabled={state === 'applying'}
              className="rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-secondary hover:bg-cem-elevated disabled:opacity-60"
            >
              Discard
            </button>
          </div>
        </div>
      ) : state === 'looking' ? (
        <p className="mt-2 text-sm text-cem-secondary">Looking up lyrics…</p>
      ) : state === 'noMatch' ? (
        <div className="mt-2">
          <p className="text-sm text-cem-secondary">No lyrics found on LRCLIB for this song.</p>
          <button
            type="button"
            onClick={lookup}
            className="mt-1 text-xs font-medium text-cem-amber hover:underline"
          >
            Try again
          </button>
        </div>
      ) : state === 'offline' ? (
        <p className="mt-2 text-sm text-cem-amber">Offline — lyrics lookup needs a connection.</p>
      ) : state === 'error' ? (
        <div className="mt-2">
          <p className="text-sm text-cem-rose" role="alert">
            {errorMessage === 'unavailable' ? 'Lyrics lookup failed. Try again later.' : 'Lyrics are unavailable right now.'}
          </p>
          <button
            type="button"
            onClick={lookup}
            className="mt-1 text-xs font-medium text-cem-amber hover:underline"
          >
            Try again
          </button>
        </div>
      ) : state === 'discarded' ? (
        <div className="mt-2">
          <p className="text-sm text-cem-secondary">Lyrics suggestion discarded — the version keeps its current lyrics.</p>
          <button
            type="button"
            onClick={lookup}
            className="mt-1 text-xs font-medium text-cem-amber hover:underline"
          >
            Fetch again
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <button
            type="button"
            onClick={lookup}
            disabled={looking || !song?.title || !online}
            title={!online ? 'Offline — lyrics lookup needs a connection' : ''}
            className="rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-50"
          >
            Fetch lyrics (LRCLIB)
          </button>
          {!song?.title && <p className="mt-1 text-xs text-cem-secondary">A song title is needed for the lookup.</p>}
        </div>
      )}
    </div>
  )
}