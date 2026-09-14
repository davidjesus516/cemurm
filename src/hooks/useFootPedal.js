import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * USB HID foot pedal lifecycle for Stage Mode.
 *
 * Owns pairing, auto-restore on reconnect, per-device input listeners,
 * debounce, and persistence of the switch→action mapping in device_configs.
 * The pedal only acts while this hook is mounted (Stage Mode open) — all
 * listeners are detached on unmount, so nothing fires in the background.
 *
 * Hito 2 scope: single default mapping { left: 'previous_song',
 * right: 'next_song' }. No settings screen, no action registry.
 */

const DEFAULT_MAPPING = { left: 'previous_song', right: 'next_song' }
// Byte-0 bitmask layout: bit 0 = left switch, bit 1 = right switch.
// ponytail: tolerant 2-bit parser — exact HID report layouts vary per pedal;
// most 1-2 switch pedals expose switch state as this bitmask or a
// keyboard-style report where the relevant byte is the modifier/button mask.
// Upgrade path: a per-pedal report-parser table keyed by vendorId/productId.
const SWITCH_BITS = { left: 0x01, right: 0x02 }
const DEBOUNCE_MS = 250

async function getUserId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

/** Load saved pedal_switches mapping for a device; defaults when absent. */
async function loadMapping(deviceId) {
  try {
    const userId = await getUserId()
    if (!userId) return DEFAULT_MAPPING
    const { data, error } = await supabase
      .from('device_configs')
      .select('pedal_switches')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .maybeSingle()
    if (error) {
      console.warn('[useFootPedal] Could not load pedal mapping:', error.message)
      return DEFAULT_MAPPING
    }
    return data?.pedal_switches ?? DEFAULT_MAPPING
  } catch (error) {
    console.warn('[useFootPedal] Could not load pedal mapping:', error)
    return DEFAULT_MAPPING
  }
}

/**
 * Persist the mapping via upsert on the (user_id, device_id) unique key.
 * PostgREST resolves this to INSERT … ON CONFLICT DO UPDATE; both RLS
 * policies (insert_self / update_self) are user_id-scoped, so the upsert
 * passes without an admin bypass. Persistence failure never breaks the
 * pedal — the mapping just falls back to defaults next session.
 */
async function saveMapping(deviceId, mapping) {
  try {
    const userId = await getUserId()
    if (!userId) {
      console.warn('[useFootPedal] No session; pedal mapping not persisted.')
      return
    }
    const { error } = await supabase
      .from('device_configs')
      .upsert(
        { user_id: userId, device_id: deviceId, pedal_switches: mapping },
        { onConflict: 'user_id,device_id' },
      )
    if (error) {
      console.warn('[useFootPedal] Could not save pedal mapping:', error.message)
    }
  } catch (error) {
    console.warn('[useFootPedal] Could not save pedal mapping:', error)
  }
}

/**
 * @param {{ onPrev?: () => void, onNext?: () => void }} callbacks
 * @returns {{ supported: boolean, devices: HIDDevice[], connected: boolean,
 *   pairing: boolean, error: string | null, pair: () => Promise<void> }}
 */
export function useFootPedal({ onPrev, onNext }) {
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.hid)
  const [devices, setDevices] = useState([])
  const [pairing, setPairing] = useState(false)
  const [error, setError] = useState(null)

  // Latest callbacks so stable input listeners always dispatch fresh actions.
  const actionRefs = useRef({ onPrev, onNext })
  useEffect(() => {
    actionRefs.current = { onPrev, onNext }
  }, [onPrev, onNext])

  const devicesRef = useRef(new Set())
  const listenersRef = useRef(new Map()) // HIDDevice -> inputreport handler
  const mappingsRef = useRef(new Map()) // deviceId -> pedal_switches mapping
  const lastFireRef = useRef({ left: 0, right: 0 })

  const dispatchAction = useCallback((action) => {
    switch (action) {
      case 'previous_song':
        actionRefs.current.onPrev?.()
        break
      case 'next_song':
        actionRefs.current.onNext?.()
        break
      default:
        // Mapping holds arbitrary action strings; only navigation exists in
        // Hito 2. Unknown actions are ignored, not thrown.
        console.warn(`[useFootPedal] Unknown pedal action: ${action}`)
    }
  }, [])

  const handleInput = useCallback((deviceId, data) => {
    const byte = data.getUint8(0)
    const mapping = mappingsRef.current.get(deviceId) ?? DEFAULT_MAPPING
    const now = performance.now()
    for (const [sw, bit] of Object.entries(SWITCH_BITS)) {
      if (!(byte & bit)) continue
      // Debounce bouncy switches: same switch ignored within DEBOUNCE_MS.
      if (now - lastFireRef.current[sw] < DEBOUNCE_MS) continue
      lastFireRef.current[sw] = now
      dispatchAction(mapping[sw])
    }
  }, [dispatchAction])

  const unregisterDevice = useCallback((device) => {
    devicesRef.current.delete(device)
    setDevices([...devicesRef.current])
    const onInput = listenersRef.current.get(device)
    if (onInput) {
      device.removeEventListener('inputreport', onInput)
      listenersRef.current.delete(device)
    }
    mappingsRef.current.delete(device.deviceId)
  }, [])

  const registerDevice = useCallback((device) => {
    devicesRef.current.add(device)
    setDevices([...devicesRef.current])
    if (listenersRef.current.has(device)) return
    const onInput = (event) => handleInput(device.deviceId, event.data)
    listenersRef.current.set(device, onInput)
    device.addEventListener('inputreport', onInput)
    // Restore the saved mapping; loadMapping defaults when none exists.
    loadMapping(device.deviceId).then((mapping) => {
      mappingsRef.current.set(device.deviceId, mapping)
    })
  }, [handleInput])

  // Mount: restore previously granted (per-origin permission persists) or
  // hot-plugged devices, then track connect/disconnect for the session.
  useEffect(() => {
    if (!supported) return
    let cancelled = false
    // Snapshot the ref targets: .current is mutated (never reassigned) by
    // register/unregister, so the snapshots stay in sync with live state.
    const listeners = listenersRef.current
    const mappings = mappingsRef.current
    const deviceSet = devicesRef.current

    navigator.hid
      .getDevices()
      .then((granted) => {
        if (cancelled) return
        deviceSet.clear()
        granted.forEach((d) => deviceSet.add(d))
        if (granted.length) setDevices(granted)
        granted.forEach(registerDevice)
      })
      .catch(() => {
        // getDevices barely fails; nothing sensible to do but stay silent.
      })

    const onConnect = (event) => registerDevice(event.device)
    const onDisconnect = (event) => unregisterDevice(event.device)
    navigator.hid.addEventListener('connect', onConnect)
    navigator.hid.addEventListener('disconnect', onDisconnect)

    return () => {
      cancelled = true
      navigator.hid.removeEventListener('connect', onConnect)
      navigator.hid.removeEventListener('disconnect', onDisconnect)
      for (const [device, onInput] of listeners) {
        device.removeEventListener('inputreport', onInput)
      }
      listeners.clear()
      deviceSet.clear()
      mappings.clear()
    }
  }, [supported, registerDevice, unregisterDevice])

  const pair = useCallback(async () => {
    if (!supported) return
    setPairing(true)
    setError(null)
    try {
      const [device] = await navigator.hid.requestDevice({
        filters: [{ usagePage: 0x0001 }], // generic desktop page; chooser stays permissive
      })
      if (!device) return
      registerDevice(device)
      await saveMapping(device.deviceId, DEFAULT_MAPPING)
    } catch (err) {
      if (err?.name === 'NotFoundError') {
        setError(null) // user cancelled the chooser — normal, stay unpaired
      } else {
        setError('Could not pair the foot pedal.')
      }
    } finally {
      setPairing(false)
    }
  }, [supported, registerDevice])

  const connected = devices.length > 0

  return { supported, devices, connected, pairing, error, pair }
}