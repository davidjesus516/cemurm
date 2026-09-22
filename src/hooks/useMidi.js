import { useCallback, useEffect, useRef, useState } from 'react'
import {
  describeOutput,
  isCurrentOutput,
  isMidiSupported,
  loadMidiSettings,
  saveMidiSettings,
  sendProgramChange,
} from '../lib/midi.js'

/**
 * Web MIDI lifecycle hook (Hito 5 #56). Owns permission, the output device
 * list, the persisted output selection, and one-shot program-change sends.
 *
 * Mounts only where MIDI matters (Settings page, Stage Mode). Never prompts
 * unless the caller opts in: `autoConnect` fires requestMIDIAccess only when
 * permissionGranted was persisted in settings, so Stage Mode restores a
 * previously-chosen device WITHOUT a permission popup mid-performance
 * (scenario: denying permission leaves performance mode working; browsers
 * resolve an already-granted request without prompting).
 *
 * Failure policy: never throws to the caller. Absent support, denied
 * permission, missing output, or offline → silent no-ops and a readable
 * `error`/`permission` state; performance mode keeps working.
 */

export function useMidi({ autoConnect = false } = {}) {
  const [supported] = useState(() => isMidiSupported())
  const [permission, setPermission] = useState('idle') // idle | granted | denied | unsupported
  const [access, setAccess] = useState(null)
  const [outputs, setOutputs] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState('')

  const refreshOutputs = useCallback((midiAccess) => {
    if (!midiAccess) return
    const list = []
    midiAccess.outputs.forEach((output) => list.push(output))
    setOutputs(list)
  }, [])

  const requestAccess = useCallback(async () => {
    if (!supported) {
      setPermission('unsupported')
      setError('MIDI is not supported in this browser.')
      return
    }
    if (requesting) return
    setRequesting(true)
    setError('')
    try {
      const midiAccess = await navigator.requestMIDIAccess()
      setAccess(midiAccess)
      setPermission('granted')
      refreshOutputs(midiAccess)
      saveMidiSettings({ permissionGranted: true, outputDeviceId: loadMidiSettings().outputDeviceId })
    } catch (e) {
      setPermission('denied')
      setError('MIDI permission denied — performance mode keeps working.')
    } finally {
      setRequesting(false)
    }
  }, [supported, requesting, refreshOutputs])

  // Keep the latest requestAccess callable from the mount effect without
  // recreating the effect on every state change.
  const requestAccessRef = useRef(requestAccess)
  useEffect(() => {
    requestAccessRef.current = requestAccess
  }, [requestAccess])

  // Mount: restore the persisted output id; auto-connect only when the user
  // already granted permission for this browser (see hook comment).
  useEffect(() => {
    let cancelled = false
    const settings = loadMidiSettings()
    if (settings.outputDeviceId) setSelectedId(settings.outputDeviceId)
    if (autoConnect && settings.permissionGranted && supported) {
      const t = setTimeout(() => {
        if (!cancelled) void requestAccessRef.current?.()
      }, 0)
      return () => {
        cancelled = true
        clearTimeout(t)
      }
    }
    return () => {
      cancelled = true
    }
  }, [autoConnect, supported])

  const selectDevice = useCallback((id) => {
    setSelectedId(id)
    saveMidiSettings({ outputDeviceId: id })
  }, [])

  const selectedOutput = outputs.find((o) => isCurrentOutput(o, selectedId)) || null
  const selectedLabel = selectedOutput ? describeOutput(selectedOutput) : ''

  /**
   * Send one Program Change (0-127) on the selected output. Silent no-op when
   * unconfigured — the caller reads the mapping per song and calls only when
   * a mapping exists; an absent device/offline must never break the show.
   */
  const sendProgram = useCallback(
    (program) => {
      const settings = loadMidiSettings()
      const output = access?.outputs?.get(settings.outputDeviceId) || null
      try {
        return sendProgramChange(output, { program, channel: settings.channel })
      } catch {
        return null
      }
    },
    [access],
  )

  return {
    supported,
    permission,
    requesting,
    outputs,
    selectedId,
    selectedOutput,
    selectedLabel,
    error,
    requestAccess,
    selectDevice,
    sendProgram,
  }
}