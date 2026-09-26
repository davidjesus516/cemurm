// MIDI integration data layer (Hito 5 #56): pure Web MIDI helpers plus the
// browser-local performance setting (selected output device). The Web MIDI
// surface is DOM-only (navigator.requestMIDIAccess, output.send) — everything
// testable in node stays in pure functions; DOM access is guarded so this
// module never explodes at import time (bandmates.js pattern).
//
// Design notes:
// - The PROGRAM MAPPING per song lives in the database (setlist_items.
//   midi_program, migration 0024) so it travels with the setlist and survives
//   duplication. This module only handles the DEVICE side + message bytes.
// - Output device selection is browser-local (localStorage): MIDI ports are a
//   per-browser, per-hardware fact, unlike user_preferences which are
//   account-scope. The projection deck surface uses the same localStorage
//   precedent. permissionGranted is persisted so Stage Mode can auto-connect
//   WITHOUT re-prompting mid-performance.
// - MIDI 1.0 Program Change: status byte 0xC0 | channel (0-15), one data byte
//   0-127. Channel is fixed at 0 (channel 1) for this slice — the spec never
//   names channels; the constant is exported for a future setting.

export const SETTINGS_KEY = 'cemurm:midi:settings'
export const DEFAULT_MIDI_SETTINGS = {
  outputDeviceId: '',
  channel: 0,
  permissionGranted: false,
}

/** True when the runtime exposes Web MIDI (browser only; false in node). */
export function isMidiSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'
}

/**
 * Form/DB normalization for a program change value.
 * Accepts ''/null/undefined/NaN and integers 0-127 (string or number).
 * Anything else — 128+, negatives, floats, prose — is invalid and maps to
 * null ("no patch"), so a malformed value never produces a bad MIDI message.
 */
export function normalizeProgram(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isInteger(n)) return null
  if (n < 0 || n > 127) return null
  return n
}

function safeParseSettings(raw) {
  if (!raw) return { ...DEFAULT_MIDI_SETTINGS }
  try {
    const parsed = JSON.parse(raw)
    return {
      outputDeviceId: typeof parsed.outputDeviceId === 'string' ? parsed.outputDeviceId : '',
      channel:
        Number.isInteger(parsed.channel) && parsed.channel >= 0 && parsed.channel <= 15
          ? parsed.channel
          : DEFAULT_MIDI_SETTINGS.channel,
      permissionGranted: parsed.permissionGranted === true,
    }
  } catch {
    return { ...DEFAULT_MIDI_SETTINGS }
  }
}

/** Browser-local MIDI settings (output + channel + permission flag). */
export function loadMidiSettings() {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_MIDI_SETTINGS }
  return safeParseSettings(localStorage.getItem(SETTINGS_KEY))
}

export function saveMidiSettings(settings) {
  if (typeof localStorage === 'undefined') return
  const next = { ...DEFAULT_MIDI_SETTINGS, ...safeParseSettings(JSON.stringify(settings || {})) }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  return next
}

/**
 * MIDI 1.0 Program Change message: [0xC0 | channel, program].
 * Throws on invalid input — callers normalizeProgram() first; this is the
 * bytes constructor and must never silently emit a malformed message.
 */
export function programChangeBytes(channel, program) {
  if (!Number.isInteger(channel) || channel < 0 || channel > 15) {
    throw new Error('MIDI channel must be an integer 0-15.')
  }
  if (!Number.isInteger(program) || program < 0 || program > 127) {
    throw new Error('MIDI program must be an integer 0-127.')
  }
  return new Uint8Array([0xc0 | channel, program])
}

/**
 * Send one Program Change on the given output (DOM). Returns the bytes sent
 * (null when there is no output — a silent no-op so offline/absent devices
 * never break performance mode). Pure enough for node: with a fake output
 * { send(bytes) } it accepts and returns bytes.
 */
export function sendProgramChange(output, { program, channel = 0 } = {}) {
  if (!output || typeof output.send !== 'function') return null
  const bytes = programChangeBytes(channel, normalizeProgram(program) ?? program)
  output.send(bytes)
  return bytes
}

/** Does this output match the persisted selection? (restore on reconnect.) */
export function isCurrentOutput(output, outputDeviceId) {
  return !!output && typeof output.id === 'string' && output.id === outputDeviceId
}

/** Display label for a device, falling back to its raw id. */
export function describeOutput(output) {
  if (!output) return ''
  return output.name || output.id || 'MIDI output'
}

/** 'No patch' for an unmapped song, else `Program ${n}`. */
export function describeProgram(program) {
  const n = normalizeProgram(program)
  return n === null ? 'No patch' : `Program ${n}`
}

// ─────────────────────────────────────────────────────────────────────────
// Node demo (no DOM): the pure contract — support detection, normalization,
// message bytes, settings guard, labels.
// ─────────────────────────────────────────────────────────────────────────
export function demo() {
  const assert = (actual, expected, label) => {
    const a = actual instanceof Uint8Array ? Array.from(actual) : actual
    if (JSON.stringify(a) !== JSON.stringify(expected)) {
      throw new Error(`midi demo FAILED: ${label} — got ${JSON.stringify(a)}, expected ${JSON.stringify(expected)}`)
    }
  }
  const throws = (fn, label) => {
    let threw = false
    try {
      fn()
    } catch {
      threw = true
    }
    if (!threw) throw new Error(`midi demo FAILED: ${label} — expected throw`)
  }

  // Support detection is false in node (no navigator).
  assert(isMidiSupported(), false, 'no Web MIDI in node')

  // Normalization: empty/invalid → null; valid integers 0-127 pass through.
  assert(normalizeProgram(''), null, 'empty → null')
  assert(normalizeProgram(null), null, 'null → null')
  assert(normalizeProgram(undefined), null, 'undefined → null')
  assert(normalizeProgram('  '), null, 'whitespace → null')
  assert(normalizeProgram('45'), 45, 'string 45 → 45')
  assert(normalizeProgram(45), 45, 'number 45 → 45')
  assert(normalizeProgram(0), 0, 'program 0 is valid')
  assert(normalizeProgram(127), 127, 'program 127 is valid')
  assert(normalizeProgram('128'), null, '128 → null')
  assert(normalizeProgram(-1), null, '-1 → null')
  assert(normalizeProgram('12.5'), null, 'float → null')
  assert(normalizeProgram('abc'), null, 'prose → null')

  // Message bytes: status 0xC0|channel, data program, Uint8Array.
  assert(programChangeBytes(0, 45), [0xc0, 45], 'channel 1 program 45')
  assert(programChangeBytes(9, 0), [0xc9, 0], 'channel 10 program 0')
  assert(programChangeBytes(15, 127), [0xcf, 127], 'channel 16 program 127')
  throws(() => programChangeBytes(16, 0), 'channel 16 rejected')
  throws(() => programChangeBytes(0, 128), 'program 128 rejected')
  throws(() => programChangeBytes(0, -1), 'negative program rejected')

  // Settings: node (no localStorage) falls back to defaults.
  assert(loadMidiSettings(), { ...DEFAULT_MIDI_SETTINGS }, 'node settings default')

  // Send: null output → silent null (offline/absent never throws); fake output
  // → returns the exact bytes.
  assert(sendProgramChange(null, { program: 45 }), null, 'no output → null no-op')
  const sent = []
  const fakeOutput = { send: (bytes) => sent.push(Array.from(bytes)) }
  const returned = sendProgramChange(fakeOutput, { program: 45, channel: 0 })
  assert(returned, [0xc0, 45], 'send returns bytes')
  assert(sent, [[0xc0, 45]], 'fake output received bytes')

  // Labels.
  assert(describeProgram(null), 'No patch', 'null label')
  assert(describeProgram(5), 'Program 5', 'program label')
  assert(describeOutput({ name: 'MIDI 1' }), 'MIDI 1', 'output label')
  assert(describeOutput({}), 'MIDI output', 'unnamed output falls back to label')

  console.log('midi demo: all asserts passed')
}