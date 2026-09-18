/* eslint-disable react/prop-types */

import { useMemo } from 'react'
import { applySubstitution, buildSubstitutionMap, noteForLine } from '../../lib/annotations.js'

// Build render segments from a parsed lyric line: each chord anchors the text
// that follows it (up to the next chord), so the chord renders above its lyric.
function toSegments({ text, chords }) {
  const sorted = [...chords].sort((a, b) => a.position - b.position)
  if (!sorted.length) return text ? [{ chord: null, text }] : []

  const segments = []
  if (sorted[0].position > 0) {
    segments.push({ chord: null, text: text.slice(0, sorted[0].position) })
  }
  for (let i = 0; i < sorted.length; i++) {
    const end = sorted[i + 1]?.position ?? text.length
    segments.push({ chord: sorted[i].chord, text: text.slice(sorted[i].position, end) })
  }
  return segments
}

function LyricLine({ line, substitutions, semitones, baseKey }) {
  const segments = toSegments(line)
  if (!segments.length) return <div className="h-3" />

  return (
    <div className="flex flex-wrap items-baseline whitespace-pre-wrap">
      {segments.map((segment, i) => (
        <span key={i} className="inline-flex flex-col items-start">
          {segment.chord && (
            <span className="mb-0.5 text-sm font-bold text-cem-amber">
              {applySubstitution(segment.chord, semitones, substitutions, baseKey)}
            </span>
          )}
          {segment.text && <span className="text-cem-text">{segment.text}</span>}
        </span>
      ))}
    </div>
  )
}

// DOM id for a rendered section block — the scroll target of "jump to the
// anchored section" (shared comments 3.4). Depends on the section name only:
// transposeParsed keeps section blocks 1:1, so the id survives transposition.
export function sectionAnchorId(sectionName) {
  return `section-${encodeURIComponent(sectionName || '')}`
}

// 3.4: personal annotations overlay (author view only). Tracks the current
// {section} header name and each lyric line's 0-based index within it, so
// notes anchor {section, index} resolve per the 0001 schema comment.
// `onSectionComment` wires the optional per-section comment composer (shared
// comments 3.4) — absent for callers that render annotations only.
export default function ChordProRenderer({
  parsed,
  annotations = [],
  semitones = 0,
  baseKey = '',
  onSectionComment,
  highlightSection,
}) {
  const { title, artist, key, sections = [] } = parsed

  const substitutions = useMemo(() => buildSubstitutionMap(annotations), [annotations])

  let sectionName = ''
  let lineInSection = 0

  return (
    <div className="rounded-lg border border-cem-elevated bg-cem-surface p-6 shadow-sm">
      {title && <h2 className="text-xl font-bold text-cem-text">{title}</h2>}
      {(artist || key) && (
        <p className="mt-1 text-sm text-cem-secondary">
          {[artist, key && `Key: ${key}`].filter(Boolean).join(' · ')}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {sections.map((section, i) => {
          if (section.type === 'section') {
            sectionName = section.lines[0]?.text || ''
            lineInSection = 0
          }
          const isSection = section.type === 'section'
          return (
            <div key={i}>
              {isSection && (
                <h3
                  id={sectionAnchorId(sectionName)}
                  className={`mb-1 text-xs font-bold uppercase tracking-wider ${highlightSection === sectionName ? 'text-cem-amber' : 'text-cem-secondary'}`}
                >
                  {sectionName}
                  {onSectionComment && (
                    <button
                      type="button"
                      onClick={() => onSectionComment(sectionName)}
                      className="ml-2 rounded border border-cem-elevated px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-cem-secondary hover:bg-cem-elevated"
                    >
                      Comment
                    </button>
                  )}
                </h3>
              )}
              {section.type === 'comment' && (
                <p className="italic text-cem-secondary">{section.lines.map((line) => line.text).join(' ')}</p>
              )}
              {section.type === 'lyrics' && (
                <div className="space-y-0.5">
                  {section.lines.map((line, j) => {
                    const note = noteForLine(annotations, sectionName, lineInSection)
                    lineInSection += 1
                    return (
                      <div key={j}>
                        <LyricLine
                          line={line}
                          substitutions={substitutions}
                          semitones={semitones}
                          baseKey={baseKey}
                        />
                        {note && <p className="text-xs italic text-cem-secondary">— {note}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}