// Settings (3.2, D7): read-only view of personal defaults — transpose offset,
// capo, default version — from user_preferences (D2). No edit controls in
// this slice; mutation UI lands later. Offline-safe: read-through kv only
// (preferences.getPreferences), zero network when a cached copy exists.

import { usePreferences } from '../hooks/usePreferences.js'

export default function Settings() {
  const { prefs, loading } = usePreferences()

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
    </div>
  )
}