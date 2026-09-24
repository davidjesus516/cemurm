/* eslint-disable react/prop-types */
import { useRef } from 'react'
import { conflictsForTarget, validateEntryForApproval } from '../../lib/importers/queue.js'

/**
 * Import review queue (Hito 5 #78, S4/S5/S7/S8/S9). PURELY presentational —
 * all entry state lives in useSongImports; every row is one file awaiting a
 * review decision. Approve is gated by queue.validateEntryForApproval and the
 * blocking message is always visible (malformed / license / duplicate /
 * conflict). State-owned handlers: onDecision, onConflictChange,
 * onLicenseChange, onConfirmLicense; writes happen ONLY in onApprove.
 */

const LICENSE_OPTIONS = [
  { value: 'CC-BY-4.0', label: 'CC-BY-4.0 (default)' },
  { value: 'proprietary', label: 'Proprietary (private only)' },
  { value: 'public-domain', label: 'Public domain' },
]

const ACCEPT = '.chordpro,.cho,.onsong,.txt,.crd'

function RowCheck({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-cem-text">
      <input
        type="radio"
        checked={checked}
        onChange={() => onChange()}
        className="h-4 w-4 accent-cem-amber"
      />
      {label}
    </label>
  )
}

function ConflictChooser({ entry, onConflictChange }) {
  const conflicts = conflictsForTarget(entry)
  if (!conflicts.length) return null
  return (
    <div className="mt-2 space-y-2 rounded-md bg-cem-amber/5 p-2">
      <p className="text-xs font-medium text-cem-amber">Conflicting metadata — choose which value wins</p>
      {conflicts.map((c) => (
        <div key={c.field} className="flex flex-wrap items-center gap-3 text-xs text-cem-text">
          <span className="w-14 capitalize">{c.field}</span>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`conflict-${entry.id}-${c.field}`}
              checked={c.chosen === c.existing}
              onChange={() => onConflictChange(entry.id, c.field, c.existing)}
              className="h-3.5 w-3.5 accent-cem-amber"
            />
            Existing: {c.existing}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`conflict-${entry.id}-${c.field}`}
              checked={c.chosen === c.proposed}
              onChange={() => onConflictChange(entry.id, c.field, c.proposed)}
              className="h-3.5 w-3.5 accent-cem-amber"
            />
            Proposed: {c.proposed}
          </label>
        </div>
      ))}
    </div>
  )
}

function ReviewRow({ entry, onApprove, onDiscard, onDecision, onConflictChange, onLicenseChange, onConfirmLicense }) {
  const gate = validateEntryForApproval(entry)
  const isDone = entry.status === 'approved' || entry.status === 'discarded'

  if (isDone) {
    return (
      <li className="px-4 py-3">
        <p className="text-sm text-cem-secondary">
          <span className="font-medium text-cem-text">{entry.fileName}</span>
          {' '}
          {entry.status === 'approved' ? 'approved — added to your library' : 'discarded'}
        </p>
      </li>
    )
  }

  const dup = entry.duplicate || { candidates: [], decision: null, targetSongId: null }
  const hasDupes = dup.candidates.length > 0

  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-cem-text">{entry.fileName}</p>
          {entry.parsed ? (
            <p className="mt-0.5 text-xs text-cem-secondary">
              {entry.parsed.title}
              {entry.parsed.artist ? ` — ${entry.parsed.artist}` : ''}
              {entry.parsed.sections?.length ? ` · ${entry.parsed.sections.join(' / ')}` : ''}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-cem-rose">{entry.error || 'Could not parse this file'}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={!gate.ok}
            onClick={() => onApprove(entry)}
            className="rounded-md bg-cem-emerald px-3 py-1.5 text-xs font-medium text-cem-base hover:bg-cem-emerald/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onDiscard(entry.id)}
            className="rounded-md bg-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-secondary hover:bg-cem-elevated/80"
          >
            Discard
          </button>
        </div>
      </div>

      {hasDupes && (
        <div className="mt-2 rounded-md bg-cem-amber/10 p-2">
          <p className="text-xs font-medium text-cem-amber">
            ⚠ Possible duplicate: {dup.candidates.map((c) => c.title).join(', ')}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-4">
            <RowCheck
              label="Merge into existing"
              checked={dup.decision === 'merge'}
              onChange={() => onDecision(entry.id, 'merge')}
            />
            <RowCheck
              label="Keep separate"
              checked={dup.decision === 'separate'}
              onChange={() => onDecision(entry.id, 'separate')}
            />
          </div>
        </div>
      )}

      {dup.decision === 'merge' && (
        <ConflictChooser entry={entry} onConflictChange={onConflictChange} />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <select
          value={entry.license}
          onChange={(e) => onLicenseChange(entry.id, e.target.value)}
          className="rounded-md border border-cem-elevated bg-cem-surface px-2 py-1.5 text-xs text-cem-text focus:border-cem-amber focus:outline-none"
        >
          {LICENSE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-cem-text">
          <input
            type="checkbox"
            checked={entry.licenseConfirmed}
            onChange={() => onConfirmLicense(entry.id)}
            className="h-3.5 w-3.5 accent-cem-amber"
          />
          I confirm the license
        </label>
      </div>

      {!gate.ok && (
        <p className="mt-1.5 text-xs text-cem-rose">{gate.error}</p>
      )}
    </li>
  )
}

export default function ImportQueue({
  entries,
  onApprove,
  onDiscard,
  onDecision,
  onConflictChange,
  onLicenseChange,
  onConfirmLicense,
  onAddFiles,
}) {
  const fileRef = useRef(null)
  const pending = entries.filter((e) => e.status === 'pending' || e.status === 'error')
  const summary = { created: entries.filter((e) => e.status === 'approved').length, discarded: entries.filter((e) => e.status === 'discarded').length }

  if (!entries.length) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-cem-elevated bg-cem-surface p-6 text-center">
        <p className="text-sm text-cem-secondary">No files yet — add chart files to start a review queue.</p>
        <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { onAddFiles(e.target.files); e.target.value = '' }} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-3 rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
        >
          Add files
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-cem-text">Import review queue</h2>
        <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { onAddFiles(e.target.files); e.target.value = '' }} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-sm font-medium text-cem-amber hover:underline"
        >
          Add more files…
        </button>
      </div>
      {(summary.created > 0 || summary.discarded > 0) && (
        <p className="mt-1 text-xs text-cem-secondary">
          Imported {summary.created} song{summary.created === 1 ? '' : 's'}, discarded {summary.discarded}.
        </p>
      )}
      {pending.length > 0 && (
        <p className="mt-1 text-xs text-cem-secondary">
          {pending.length} file{pending.length === 1 ? '' : 's'} awaiting review — nothing lands until you approve it.
        </p>
      )}
      <ul className="mt-2 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
        {entries.map((entry) => (
          <ReviewRow
            key={entry.id}
            entry={entry}
            onApprove={onApprove}
            onDiscard={onDiscard}
            onDecision={onDecision}
            onConflictChange={onConflictChange}
            onLicenseChange={onLicenseChange}
            onConfirmLicense={onConfirmLicense}
          />
        ))}
      </ul>
    </div>
  )
}