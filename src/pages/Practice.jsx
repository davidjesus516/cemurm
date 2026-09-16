import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSongs } from '../hooks/useSongs.js'
import { usePreferences } from '../hooks/usePreferences.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { parseChordPro } from '../lib/chordpro/parser.js'
import { capoLabel, initialSemitones, semitonesBetween, transposeParsed, transposeKey } from '../lib/transpose.js'
import { listAnnotations } from '../lib/annotations.js'
import ChordProRenderer from '../components/notation/ChordProRenderer.jsx'

export default function Practice() {
  const { id } = useParams()
  const { user } = useAuth()
  const { getSong } = useSongs()
  const { prefs } = usePreferences()
  const [song, setSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [semitones, setSemitones] = useState(0)
  const [tempoOffset, setTempoOffset] = useState(0)
  const [annotations, setAnnotations] = useState([])

  useEffect(() => {
    let cancelled = false
    getSong(id)
      .then((data) => { if (!cancelled) setSong(data) })
      .catch(() => { if (!cancelled) setError('Song not found.') })
      .finally(() => { if (!cancelled) setLoading(false) })
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

  const parsed = useMemo(() => {
    if (!song?.body) return null
    return parseChordPro(song.body)
  }, [song?.body])

  const displayKey = useMemo(() => {
    if (!parsed) return ''
    return semitones ? transposeKey(parsed.key, semitones) : parsed.key
  }, [parsed, semitones])

  // 3.6: the practice-key/tempo pref drives the practice surface (metronome
  // and auto-scroll consume these values); the stage key is unchanged — 
  // StageMode never reads practice prefs (spec: Juan practices in D, stage G).
  const practicePref = useMemo(() => (song ? prefs.practice?.[song.id] : null), [song, prefs.practice])

  const displayBpm = useMemo(() => {
    const baseline = practicePref?.tempo ?? song?.bpm
    if (!baseline) return null
    return Math.max(20, Number(baseline) + tempoOffset)
  }, [practicePref?.tempo, song?.bpm, tempoOffset])

  // Reset the manual tempo offset when the baseline changes (pref or song).
  useEffect(() => {
    setTempoOffset(0)
  }, [practicePref?.tempo, song?.bpm])

  const transposed = useMemo(() => {
    if (!parsed) return null
    return transposeParsed(parsed, semitones)
  }, [parsed, semitones])

  // D7 + 3.6: baseline semitones = practice-key shift when set (G→D = −5),
  // else global offset + this song's override. Re-seeded when the song or
  // its prefs load; manual +/- adjustments stay put until then.
  const baseline = song
    ? (practicePref?.key
        ? semitonesBetween(parsed?.key, practicePref.key)
        : initialSemitones(prefs.transpose, prefs.overrides[song.id]))
    : 0
  useEffect(() => {
    setSemitones(baseline)
  }, [baseline])

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
  function resetKey() { setSemitones(baseline) }
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
          {semitones !== baseline && (
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

        {(semitones !== 0 || practicePref) && (
          <span className="ml-auto text-xs text-cem-secondary">
            {practicePref?.key ? `Practice ${practicePref.key} · ` : ''}
            {practicePref?.tempo ? `${practicePref.tempo} BPM · ` : ''}
            {semitones !== 0 && `${semitones > 0 ? '+' : ''}${semitones} semitones from original`}
          </span>
        )}
        {prefs.capo > 0 && displayKey && (
          <span className="text-xs text-cem-secondary">{capoLabel(displayKey, prefs.capo)}</span>
        )}
      </div>

      {/* Song rendered */}
      <div className="mt-4">
        <ChordProRenderer
          parsed={transposed}
          annotations={annotations}
          semitones={semitones}
          baseKey={parsed?.key}
        />
      </div>
    </div>
  )
}
