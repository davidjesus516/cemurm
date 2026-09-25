// Settings (3.2, D7): read-only view of personal defaults — transpose offset,
// capo, default version — from user_preferences (D2). No edit controls for the
// preferences themselves in this slice; mutation UI lands later. The MIDI
// output section below is the one interactive exception (Hito 5 #56): device
// selection is browser-local (localStorage) — MIDI ports are a per-browser
// hardware fact, not an account preference. Offline-safe: read-through kv only
// (preferences.getPreferences), zero network when a cached copy exists.

import { useEffect, useState } from 'react'
import { usePreferences } from '../hooks/usePreferences.js'
import { useMidi } from '../hooks/useMidi.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { describeOutput, loadMidiSettings } from '../lib/midi.js'
import {
  disconnectSpotify,
  ensureSpotifyConnected,
  getSpotifyConnection,
} from '../lib/enrichments.js'

export default function Settings() {
  const { prefs, loading } = usePreferences()
  const midi = useMidi({ autoConnect: loadMidiSettings().permissionGranted })
  const { user } = useAuth()

  // Hito 5 #69: Spotify integration status. Offline-safe — getSpotifyConnection
  // falls back to the localStorage mirror when the DB read fails, so the
  // status renders with zero network. Connect is implicit on first enrichment
  // (no OAuth in this feature); disconnect flips the row to 'revoked' and the
  // applied metadata stays on the songs.
  const [spotifyConnection, setSpotifyConnection] = useState(null)
  const [connLoading, setConnLoading] = useState(true)
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connError, setConnError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!user?.id) {
      setConnLoading(false)
      return undefined
    }
    getSpotifyConnection(user.id)
      .then((row) => { if (!cancelled) setSpotifyConnection(row) })
      .catch(() => { if (!cancelled) setSpotifyConnection(null) })
      .finally(() => { if (!cancelled) setConnLoading(false) })
    return () => { cancelled = true }
  }, [user?.id])

  const spotifyStatus = spotifyConnection
    ? (spotifyConnection.status === 'connected' ? 'connected' : 'revoked')
    : 'none'

  async function handleDisconnect() {
    if (!user?.id) return
    setDisconnecting(true)
    setConnError('')
    try {
      const row = await disconnectSpotify(user.id)
      // disconnectSpotify may yield no row when none existed — 'revoked' is
      // still the honest status for the mirror + UI.
      setSpotifyConnection(row || { status: 'revoked' })
      setConfirmingDisconnect(false)
    } catch {
      setConnError('Could not disconnect right now — try again.')
    } finally {
      setDisconnecting(false)
    }
  }

  // Reconnect flips the persisted row back to 'connected' (unique
  // user_id+provider upsert — the smoke-tested path). Applied metadata remains
  // throughout; enrichment just unlocks again.
  async function handleReconnect() {
    if (!user?.id) return
    setConnError('')
    try {
      const row = await ensureSpotifyConnected(user.id)
      setSpotifyConnection(row)
    } catch {
      setConnError('Could not connect right now — try again.')
    }
  }

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

      {/* Hito 5 #69: Spotify integration — status (green dot when connected),
          inline-confirm Disconnect, and Reconnect after a revoke. The applied
          metadata is never deleted: revocation only stops future enrichment
          suggestions (scenario 8). */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-cem-text">Integrations</h2>
        <p className="mt-1 text-sm text-cem-secondary">
          External services that enrich your songs — connected automatically the first time you
          enrich, no separate sign-in.
        </p>

        <div className="mt-3 rounded-lg border border-cem-elevated bg-cem-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-cem-text">Spotify</span>
              {connLoading ? (
                <span className="text-xs text-cem-secondary">Loading…</span>
              ) : spotifyStatus === 'connected' ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-cem-emerald">
                  <span className="h-2 w-2 rounded-full bg-cem-emerald" aria-hidden="true" />
                  Connected
                </span>
              ) : spotifyStatus === 'revoked' ? (
                <span className="text-xs font-medium text-cem-rose">Revoked</span>
              ) : (
                <span className="text-xs font-medium text-cem-secondary">Not connected</span>
              )}
            </div>

            {spotifyStatus === 'connected' && !confirmingDisconnect && (
              <button
                type="button"
                onClick={() => setConfirmingDisconnect(true)}
                className="rounded border border-cem-elevated px-2 py-1 text-xs font-medium text-cem-rose hover:bg-cem-rose/10"
              >
                Disconnect
              </button>
            )}

            {spotifyStatus === 'revoked' && (
              <button
                type="button"
                onClick={handleReconnect}
                className="rounded border border-cem-elevated px-2 py-1 text-xs font-medium text-cem-text hover:bg-cem-elevated"
              >
                Reconnect
              </button>
            )}
          </div>

          {connError && (
            <p className="mt-2 text-xs text-cem-rose" role="alert">{connError}</p>
          )}

          {spotifyStatus === 'connected' && confirmingDisconnect && (
            <div className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2">
              <p className="text-xs text-cem-rose">
                Disconnect stops future enrichments. Metadata already applied stays on your songs.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="rounded bg-cem-rose px-2 py-1 text-xs font-medium text-cem-base hover:bg-cem-rose/90 disabled:opacity-60"
                >
                  {disconnecting ? 'Disconnecting…' : 'Confirm disconnect'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDisconnect(false)}
                  disabled={disconnecting}
                  className="rounded border border-cem-elevated px-2 py-1 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <p className="mt-2 text-xs text-cem-secondary">
            {spotifyStatus === 'revoked'
              ? 'Disconnect stops future enrichments. Metadata already applied stays on your songs.'
              : 'Connections are created automatically when you enrich a song.'}
          </p>
        </div>
      </div>
    </div>
  )
}