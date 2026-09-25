// Substitute assignment view (Hito 5 #81, scenario 11/14/16): the member's
// personal rendering of a service's assignment blocks — their own parts, the
// parts they substitute (covered_by) and pending-candidate blocks — each song
// transposed to their instrument's written pitch + personal key/override
// (renderSemitones), with personal chord substitutions applied by the shared
// renderer. The stored plan/chart never changes. Cross-org event setlists
// render when the request is event-scoped; the page never shows org
// repertoire it is not part of (the RPC guarantees that).
/* eslint-disable react/prop-types */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { usePreferences } from '../hooks/usePreferences.js'
import { parseChordPro } from '../lib/chordpro/parser.js'
import { transposeParsed } from '../lib/transpose.js'
import { listAnnotations } from '../lib/annotations.js'
import { getSubstitutionContext, instrumentPitchLabel, renderSemitones } from '../lib/substitutions.js'
import ChordProRenderer from '../components/notation/ChordProRenderer.jsx'

const ROLE_LABEL = {
  original: 'Your part',
  substitute: 'You are substituting',
  candidate: 'On the shortlist for this part',
}

const ROLE_STYLE = {
  original: 'border-cem-elevated bg-cem-surface text-cem-secondary',
  substitute: 'border-cem-amber/40 bg-cem-amber/10 text-cem-amber',
  candidate: 'border-cem-elevated bg-cem-elevated text-cem-secondary',
}

function SongChart({ song, instrument, annotations }) {
  const { prefs } = usePreferences()
  const semitones = renderSemitones(prefs, song.song_id, instrument)
  const parsed = useMemo(() => parseChordPro(song.chart || ''), [song.chart])
  const transposed = useMemo(() => (parsed && semitones ? transposeParsed(parsed, semitones) : parsed), [parsed, semitones])

  if (!song.chart) {
    return <p className="text-sm text-cem-secondary">This song has no chord chart yet.</p>
  }
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h4 className="text-sm font-semibold text-cem-text">{song.title}</h4>
        <span className="text-xs text-cem-secondary">
          {[song.artist, song.version_name && `Version: ${song.version_name}`].filter(Boolean).join(' · ')}
        </span>
        {semitones !== 0 && (
          <span className="text-[10px] text-cem-secondary">
            {semitones > 0 ? '+' : ''}{semitones} semitones
          </span>
        )}
      </div>
      <ChordProRenderer
        parsed={transposed}
        annotations={annotations}
        semitones={semitones}
        baseKey={parsed?.key}
      />
    </div>
  )
}

export default function SubstitutionAssignment() {
  const { serviceId } = useParams()
  const { user } = useAuth()
  const [context, setContext] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [annotationsBySong, setAnnotationsBySong] = useState({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getSubstitutionContext(serviceId)
      .then((data) => { if (!cancelled) setContext(data) })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [serviceId])

  // Personal chord substitutions for every chart shown (self-scoped, D7).
  useEffect(() => {
    if (!user?.id || !context?.blocks?.length) return undefined
    let cancelled = false
    const songIds = [...new Set(context.blocks.flatMap((b) => (b.songs || []).map((s) => s.song_id)))]
    Promise.all(songIds.map((songId) => listAnnotations(user.id, songId)))
      .then((lists) => {
        if (cancelled) return
        const map = {}
        songIds.forEach((songId, i) => { map[songId] = lists[i] || [] })
        setAnnotationsBySong(map)
      })
    return () => { cancelled = true }
  }, [user?.id, context])

  if (loading) return <p className="text-sm text-cem-secondary">Loading your assignment…</p>

  if (error || !context) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error || 'Assignment not available.'}</p>
        <Link to="/services" className="mt-4 inline-block text-sm font-medium text-cem-amber hover:underline">
          ← Back to services
        </Link>
      </div>
    )
  }

  const pitchLabel = context.instrument ? `Written for ${instrumentPitchLabel(context.instrument)} (${context.instrument})` : 'Concert pitch'

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/services" className="text-sm font-medium text-cem-amber hover:underline">
        ← Back to services
      </Link>

      {/* Header */}
      <div className="mt-3 rounded-lg border border-cem-elevated bg-cem-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-cem-text">{context.service?.name}</h1>
          <span className="text-xs font-medium text-cem-secondary">{pitchLabel}</span>
        </div>
        {context.event && (
          <p className="mt-1 text-xs font-medium text-cem-amber">
            Cross-org event: {context.event.event_name} — event setlist material below
          </p>
        )}
      </div>

      {/* Assignment blocks */}
      <div className="mt-4 space-y-6">
        {context.blocks.map((block) => (
          <section key={block.id} className="rounded-lg border border-cem-elevated bg-cem-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-cem-text">{block.name}</h3>
              <span className="rounded border border-cem-elevated px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cem-secondary">
                {block.part}
              </span>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${ROLE_STYLE[block.role] || ROLE_STYLE.candidate}`}>
                {ROLE_LABEL[block.role] || ROLE_LABEL.candidate}
              </span>
            </div>
            <div className="mt-3 space-y-4">
              {(block.songs || []).map((song) => (
                <SongChart
                  key={song.song_id || song.version_id}
                  song={song}
                  instrument={context.instrument}
                  annotations={annotationsBySong[song.song_id] || []}
                />
              ))}
              {!block.songs?.length && (
                <p className="text-sm text-cem-secondary">No songs assigned to this block.</p>
              )}
            </div>
          </section>
        ))}

        {!context.blocks.length && (
          <p className="text-sm text-cem-secondary">You have no assignment blocks in this service.</p>
        )}

        {/* Event setlist material (cross-org substitution scope) */}
        {context.event && (
          <section className="rounded-lg border border-cem-amber/40 bg-cem-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-cem-text">{context.event.event_name} — event setlist</h3>
              <span className="rounded border border-cem-amber/40 px-1.5 py-0.5 text-[10px] font-medium text-cem-amber">event</span>
            </div>
            <div className="mt-3 space-y-4">
              {(context.event.songs || []).map((song) => (
                <SongChart
                  key={song.song_id || song.version_id}
                  song={song}
                  instrument={context.instrument}
                  annotations={annotationsBySong[song.song_id] || []}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}