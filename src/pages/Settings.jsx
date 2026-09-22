// Settings (3.2, D7): read-only view of personal defaults — transpose offset,
// capo, default version — from user_preferences (D2). No edit controls for the
// preferences themselves in this slice; mutation UI lands later. The MIDI
// output section below is the one interactive exception (Hito 5 #56): device
// selection is browser-local (localStorage) — MIDI ports are a per-browser
// hardware fact, not an account preference. Offline-safe: read-through kv only
// (preferences.getPreferences), zero network when a cached copy exists.

import { usePreferences } from '../hooks/usePreferences.js'
import { useMidi } from '../hooks/useMidi.js'
import { describeOutput, loadMidiSettings } from '../lib/midi.js'

export default function Settings() {
  const { prefs, loading } = usePreferences()
  const midi = useMidi({ autoConnect: loadMidiSettings().permissionGranted })

  const rows = [
    {
      label: 'Transpose',
      value: prefs.transpose
        ? `${prefs.transpose > 0 ? '+' : ''}${prefs.transpose} semitones`
        : 'None (0)',
    },
    { label: 'Capo', value: prefs.capo ? `Fret ${prefs.capo}` : 'None (0)' },
    { label: 'Default version', value: prefs.defaultVersion || 'None set' },
  ]

  if (loading) return <p className="text-sm text-cem-secondary">Loading preferences…</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-cem-text">Settings</h1>
      <p className="mt-1 text-sm text-cem-secondary">
        Your personal defaults — applied to every song unless a per-song override is set.
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-cem-elevated">
        <table className="w-full text-sm">
          <thead className="bg-cem-elevated text-left text-xs uppercase tracking-wide text-cem-secondary">
            <tr>
              <th className="px-4 py-2 font-medium">Preference</th>
              <th className="px-4 py-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-cem-elevated">
                <td className="px-4 py-3 font-medium text-cem-text">{row.label}</td>
                <td className="px-4 py-3 text-cem-text">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-cem-secondary">
        Preferences are read-only for now — editing them arrives in a later update.
      </p>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-cem-text">MIDI output</h2>
        <p className="mt-1 text-sm text-cem-secondary">
          Pick the output device that receives Program Changes when you switch songs in Stage Mode.
        </p>

        {!midi.supported ? (
          <p className="mt-3 rounded-lg border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text">
            MIDI is not supported in this browser
          </p>
        ) : midi.permission === 'denied' ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text">
            <span>MIDI permission denied — performance mode keeps working without MIDI.</span>
            <button
              type="button"
              onClick={midi.requestAccess}
              disabled={midi.requesting}
              className="rounded border border-cem-elevated px-2 py-1 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
            >
              Try again
            </button>
          </div>
        ) : midi.permission === 'granted' ? (
          <div className="mt-3 rounded-lg border border-cem-elevated bg-cem-surface p-3">
            {midi.outputs.length === 0 ? (
              <p className="text-sm text-cem-secondary">No MIDI output devices found.</p>
            ) : (
              <label className="flex flex-wrap items-center gap-2 text-sm text-cem-secondary">
                <span>Output device</span>
                <select
                  value={midi.selectedId}
                  onChange={(e) => midi.selectDevice(e.target.value)}
                  className="rounded border border-cem-elevated bg-cem-surface px-2 py-1 text-sm text-cem-text focus:border-cem-amber focus:outline-none"
                >
                  <option value="">Select an output…</option>
                  {midi.outputs.map((output) => (
                    <option key={output.id} value={output.id}>
                      {describeOutput(output)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {midi.selectedLabel && (
              <p className="mt-2 text-xs text-cem-secondary">Active output: {midi.selectedLabel}</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={midi.requestAccess}
            disabled={midi.requesting}
            className="mt-3 rounded border border-cem-elevated bg-cem-surface px-3 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
          >
            {midi.requesting ? 'Connecting…' : 'Connect MIDI devices'}
          </button>
        )}

        <p className="mt-3 text-xs text-cem-secondary">
          Program mappings per song are saved with each setlist. MIDI output selection is
          browser-local and stored on this device.
        </p>
      </div>
    </div>
  )
}