// @ts-check
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

/**
 * Browser-local MIDI settings: the selected output device, the program-change
 * channel, and the persisted Web MIDI permission flag (localStorage — a
 * per-browser/per-hardware fact, unlike account-scope user_preferences).
 * @typedef {object} MidiSettings
 * @property {string} outputDeviceId
 * @property {number} channel
 * @property {boolean} permissionGranted
 */

/**
 * The output-port surface these helpers actually read: `send`, `id`, `name`.
 *
 * Deliberately NOT the DOM `MIDIOutput`. A real port always has every field,
 * but these helpers are documented (and used) against partial fakes — demo()
 * passes `{}` and `{ name: 'MIDI 1' }`, and node passes a `{ send(bytes) }`
 * stub — so a port is structurally "whatever subset happens to be present".
 * Every field is therefore optional, which keeps a real `MIDIOutput` from
 * `MIDIAccess.outputs` assignable without a cast while still accepting the
 * fakes. Only the three members below are read; the rest of MIDIPort
 * (`state`, `connection`, `version`, …) is never touched, so it is not here.
 * @typedef {object} MidiOutputLike
 * @property {string} [id]
 * @property {string | null} [name]
 * @property {(data: Uint8Array) => void} [send]
 */

/**
 * One program change request. `program` stays loose on purpose: the caller's
 * raw value (form string, DB integer, null) is normalized before the bytes.
 * @typedef {object} ProgramChangeOptions
 * @property {string | number | null} [program]
 * @property {number} [channel]
 */

export const SETTINGS_KEY = 'cemurm:midi:settings'
/** @type {MidiSettings} */
export const DEFAULT_MIDI_SETTINGS = {
  outputDeviceId: '',
  channel: 0,
  permissionGranted: false,
}

/**
 * True when the runtime exposes Web MIDI (browser only; false in node).
 *
 * No cast is needed on the guard: `navigator.requestMIDIAccess` IS declared on
 * `Navigator` in this TypeScript's lib.dom.d.ts, so the `typeof` probe is
 * fully typed. The probe itself is the contract — it is what keeps node (no
 * `requestMIDIAccess`) from ever reaching the DOM — and it is left untouched.
 * @returns {boolean}
 */
export function isMidiSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'
}

/**
 * Form/DB normalization for a program change value.
 * Accepts ''/null/undefined/NaN and integers 0-127 (string or number).
 * Anything else — 128+, negatives, floats, prose — is invalid and maps to
 * null ("no patch"), so a malformed value never produces a bad MIDI message.
 * @param {string | number | null | undefined} value
 * @returns {number | null}
 */
export function normalizeProgram(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isInteger(n)) return null
  if (n < 0 || n > 127) return null
  return n
}

/**
 * A settings blob exactly as it comes back out of `JSON.parse` — UNVALIDATED
 * user-writable localStorage content. It is deliberately NOT typed as
 * `MidiSettings`: claiming the blob is already valid would hide the very
 * validation this function exists to perform. The members stay `any` so the
 * existing `typeof` / `Number.isInteger` guards below remain the sole deciders,
 * exactly as they are at runtime for `null`, a bare number, or an array.
 * @typedef {Record<string, any>} RawSettingsBlob
 */

/**
 * Re-validate a persisted settings blob field by field; anything unparseable
 * falls back to the defaults. `raw` is `null` when the key is absent.
 * @param {string | null} raw
 * @returns {MidiSettings}
 */
function safeParseSettings(raw) {
  if (!raw) return { ...DEFAULT_MIDI_SETTINGS }
  try {
    const parsed = /** @type {RawSettingsBlob} */ (JSON.parse(raw))
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

/**
 * Browser-local MIDI settings (output + channel + permission flag).
 * @returns {MidiSettings}
 */
export function loadMidiSettings() {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_MIDI_SETTINGS }
  return safeParseSettings(localStorage.getItem(SETTINGS_KEY))
}

/**
 * Merge a partial settings patch over the defaults, persist it, and return it.
 * Undefined when there is no localStorage to write to. Both real call sites
 * (useMidi.js) pass a partial — `{ permissionGranted, outputDeviceId }` and
 * `{ outputDeviceId }` — hence `Partial`, not the full shape.
 * @param {Partial<MidiSettings> | null | undefined} settings
 * @returns {MidiSettings | undefined}
 */
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
 * @param {number} channel
 * @param {number} program
 * @returns {Uint8Array}
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
 * @param {MidiOutputLike | null | undefined} output
 * @param {ProgramChangeOptions} [options]
 * @returns {Uint8Array | null}
 */
export function sendProgramChange(output, { program, channel = 0 } = {}) {
  if (!output || typeof output.send !== 'function') return null
  // The cast below is UNSOUND, and knowingly so. `normalizeProgram()` returns
  // `number | null`, so `?? program` has the runtime type `number | string`:
  // when the caller's program is invalid the RAW value is forwarded on purpose
  // so that programChangeBytes() throws rather than silently sending nothing
  // (see its docstring — that throw is the intended contract, not a bug, and
  // useMidi.js wraps this call in try/catch for exactly that reason). JSDoc
  // cannot spell "a number, or something that throws", and widening
  // programChangeBytes()'s public `program: number` to admit a string would
  // hide misuse by real callers, so the narrow assertion is kept and the
  // unsoundness is recorded here rather than papered over.
  const bytes = programChangeBytes(channel, /** @type {number} */ (normalizeProgram(program) ?? program))
  output.send(bytes)
  return bytes
}

/**
 * Does this output match the persisted selection? (restore on reconnect.)
 * @param {MidiOutputLike | null | undefined} output
 * @param {string} outputDeviceId
 * @returns {boolean}
 */
export function isCurrentOutput(output, outputDeviceId) {
  return !!output && typeof output.id === 'string' && output.id === outputDeviceId
}

/**
 * Display label for a device, falling back to its raw id. The `||` chain is
 * the real null guard: MIDIPort.name is `string | null` and both fields are
 * optional on a fake, so no field is dereferenced unchecked.
 * @param {MidiOutputLike | null | undefined} output
 * @returns {string}
 */
export function describeOutput(output) {
  if (!output) return ''
  return output.name || output.id || 'MIDI output'
}

/**
 * 'No patch' for an unmapped song, else `Program ${n}`.
 * @param {string | number | null | undefined} program
 * @returns {string}
 */
export function describeProgram(program) {
  const n = normalizeProgram(program)
  return n === null ? 'No patch' : `Program ${n}`
}

// ─────────────────────────────────────────────────────────────────────────
// Node demo (no DOM): the pure contract — support detection, normalization,
// message bytes, settings guard, labels.
// ─────────────────────────────────────────────────────────────────────────
export function demo() {
  /**
   * @param {unknown} actual
   * @param {unknown} expected
   * @param {string} label
   */
  const assert = (actual, expected, label) => {
    const a = actual instanceof Uint8Array ? Array.from(actual) : actual
    if (JSON.stringify(a) !== JSON.stringify(expected)) {
      throw new Error(`midi demo FAILED: ${label} — got ${JSON.stringify(a)}, expected ${JSON.stringify(expected)}`)
    }
  }
  /**
   * @param {() => void} fn
   * @param {string} label
   */
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
  /** @type {number[][]} */
  const sent = []
  // The stub's `send` receives the exact bytes this module produces, so the
  // param is annotated rather than asserting the stub is a real MIDIOutput.
  const fakeOutput = { send: (/** @type {Uint8Array} */ bytes) => sent.push(Array.from(bytes)) }
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