import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSongs } from '../hooks/useSongs.js'
import { parseChordPro } from '../lib/chordpro/parser.js'
import { transposeParsed, transposeKey } from '../lib/transpose.js'
import ChordProRenderer from '../components/notation/ChordProRenderer.jsx'

export default function Practice() {
  const { id } = useParams()
  const { getSong } = useSongs()
  const [song, setSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [semitones, setSemitones] = useState(0)
  const [tempoOffset, setTempoOffset] = useState(0)

  useEffect(() => {
    let cancelled = false
    getSong(id)
      .then((data) => { if (!cancelled) setSong(data) })
      .catch(() => { if (!cancelled) setError('Song not found.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const parsed = useMemo(() => {
    if (!song?.body) return null
    return parseChordPro(song.body)
  }, [song?.body])

  const displayKey = useMemo(() => {
    if (!parsed) return ''
    return semitones ? transposeKey(parsed.key, semitones) : parsed.key
  }, [parsed, semitones])

  const displayBpm = useMemo(() => {
    if (!song?.bpm) return null
    return Math.max(20, song.bpm + tempoOffset)
  }, [song?.bpm, tempoOffset])

  const transposed = useMemo(() => {
    if (!parsed) return null
    return transposeParsed(parsed, semitones)
  }, [parsed, semitones])

  if (loading) return <p className="text-sm text-cem-secondary">Loading…</p>

  if (error || !song) {
    return (
      <div>
        <p className="rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error || 'Song not found.'}</p>
        <Link to="/songs" className="mt-4 inline-block text-sm font-medium text-cem-amber hover:underline">
          ← Back to repertoire
        </Link>
      </div>
    )
  }

  if (!song.body) {
    return (
      <div>
        <p className="text-sm text-cem-secondary">This song has no chord chart yet.</p>
        <Link to={`/songs/${id}`} className="mt-4 inline-block text-sm font-medium text-cem-amber hover:underline">
          ← Edit song
        </Link>
      </div>
    )
  }

  function transposeUp() { setSemitones((s) => s + 1) }
  function transposeDown() { setSemitones((s) => s - 1) }
  function resetKey() { setSemitones(0) }
  function tempoUp() { setTempoOffset((o) => o + 5) }
  function tempoDown() { setTempoOffset((o) => o - 5) }
  function resetTempo() { setTempoOffset(0) }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/songs/${id}`} className="text-sm font-medium text-cem-amber hover:underline">
        ← Back to song
      </Link>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-cem-elevated bg-cem-surface px-4 py-3">
        {/* Key control */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-cem-secondary">Key</span>
          <button
            type="button"
            onClick={transposeDown}
            className="rounded border border-cem-elevated px-2 py-1 text-sm font-medium text-cem-text hover:bg-cem-elevated"
            aria-label="Transpose down"
          >
            −
          </button>
          <span className="min-w-[3rem] text-center text-sm font-bold text-cem-amber">
            {displayKey || parsed?.key || '—'}
          </span>
          <button
            type="button"
            onClick={transposeUp}
            className="rounded border border-cem-elevated px-2 py-1 text-sm font-medium text-cem-text hover:bg-cem-elevated"
            aria-label="Transpose up"
          >
            +
          </button>
          {semitones !== 0 && (
            <button
              type="button"
              onClick={resetKey}
              className="text-xs text-cem-secondary hover:text-cem-text"
            >
              reset
            </button>
          )}
        </div>

        {/* Tempo control */}
        {song.bpm && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-cem-secondary">BPM</span>
            <button
              type="button"
              onClick={tempoDown}
              className="rounded border border-cem-elevated px-2 py-1 text-sm font-medium text-cem-text hover:bg-cem-elevated"
              aria-label="Slower"
            >
              −
            </button>
            <span className="min-w-[3rem] text-center text-sm font-bold text-cem-amber">
              {displayBpm}
            </span>
            <button
              type="button"
              onClick={tempoUp}
              className="rounded border border-cem-elevated px-2 py-1 text-sm font-medium text-cem-text hover:bg-cem-elevated"
              aria-label="Faster"
            >
              +
            </button>
            {tempoOffset !== 0 && (
              <button
                type="button"
                onClick={resetTempo}
                className="text-xs text-cem-secondary hover:text-cem-text"
              >
                reset
              </button>
            )}
          </div>
        )}

        {semitones !== 0 && (
          <span className="ml-auto text-xs text-cem-secondary">
            {semitones > 0 ? `+${semitones}` : semitones} semitones from original
          </span>
        )}
      </div>

      {/* Song rendered */}
      <div className="mt-4">
        <ChordProRenderer parsed={transposed} />
      </div>
    </div>
  )
}
