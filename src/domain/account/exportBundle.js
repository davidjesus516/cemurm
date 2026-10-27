// Account export bundle: the portable document and its readable summary.
//
// Requirement source:
//   features/account-data-export-and-erasure.feature:10-14 — settings offers
//     "Export my data" and the bundle carries a JSON file plus "a readable
//     summary of the same data".
//   features/account-data-export-and-erasure.feature:25-28 — the JSON is
//     "standard" and self-describing when opened on another device.
//
// This module is pure: no I/O, no Supabase import, no browser globals. The
// envelope is the jsonb returned by public.export_account_data()
// (supabase/migrations/0042_account_export.sql). `buildExportDocument` never
// mutates its input, so callers can reuse the same envelope for both outputs.
//
// Ordering is canonical, not incidental: the envelope's top-level keys and the
// nested repertoire/activity/archive groups are emitted in a fixed order, and
// unknown keys follow sorted. Arrays keep the order the RPC produced — those
// orders are meaningful (created_at, position, joined_at).

const DOCUMENT_KEYS = [
  'schema_version',
  'exported_at',
  'user_id',
  'account',
  'preferences',
  'notification_preferences',
  'memberships',
  'repertoire',
  'collections',
  'setlists',
  'annotations',
  'comments',
  'practice_sessions',
  'gigs',
  'performances',
  'public_contributions',
  'activity',
  'archive',
]

const REPERTOIRE_KEYS = ['songs', 'versions', 'charts', 'tags']
const ACTIVITY_KEYS = ['follows', 'notifications', 'feedback']
const ARCHIVE_KEYS = ['audit', 'moderation']

const SCALAR_DEFAULTS = {
  schema_version: null,
  exported_at: null,
  user_id: null,
  account: {},
  preferences: {},
  notification_preferences: {},
}

const ARRAY_DEFAULTS = {
  memberships: [],
  collections: [],
  setlists: [],
  annotations: [],
  comments: [],
  practice_sessions: [],
  gigs: [],
  performances: [],
  public_contributions: [],
}

/**
 * Deep-copy JSON-safe data. Keeps the input untouched and drops nothing the
 * envelope can legitimately carry (it is already jsonb).
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneJson(value) {
  if (Array.isArray(value)) return value.map(cloneJson)
  if (value && typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {}
    for (const key of Object.keys(value)) {
      out[key] = cloneJson(/** @type {Record<string, unknown>} */ (value)[key])
    }
    return out
  }
  return value
}

/**
 * Copy `source` with the listed keys first (in that order) and any remaining
 * keys afterwards, sorted. Missing keys are omitted.
 * @param {Record<string, unknown>} source
 * @param {string[]} keys
 * @returns {Record<string, unknown>}
 */
function orderedObject(source, keys) {
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = cloneJson(source[key])
  }
  for (const key of Object.keys(source).sort()) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = cloneJson(source[key])
  }
  return out
}

/**
 * A nested group always exposes its canonical arrays, even when the envelope
 * omitted one (an empty account must still yield a well-formed document).
 * @param {unknown} value
 * @param {string[]} keys
 * @returns {Record<string, unknown>}
 */
function nestedGroup(value, keys) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {}
  /** @type {Record<string, unknown>} */
  const withDefaults = { ...source }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(withDefaults, key)) withDefaults[key] = []
  }
  return orderedObject(withDefaults, keys)
}

/**
 * Build the portable JSON document. The three envelope identity fields pass
 * through unchanged; known collections are always arrays, nested groups are
 * always objects with their canonical keys.
 * @param {Record<string, unknown>} [envelope]
 * @returns {Record<string, unknown>}
 */
export function buildExportDocument(envelope = {}) {
  const source = envelope && typeof envelope === 'object' ? envelope : {}
  /** @type {Record<string, unknown>} */
  const out = {}

  for (const key of DOCUMENT_KEYS) {
    if (key === 'repertoire') {
      out[key] = nestedGroup(source[key], REPERTOIRE_KEYS)
    } else if (key === 'activity') {
      out[key] = nestedGroup(source[key], ACTIVITY_KEYS)
    } else if (key === 'archive') {
      out[key] = nestedGroup(source[key], ARCHIVE_KEYS)
    } else if (Object.prototype.hasOwnProperty.call(source, key)) {
      out[key] = cloneJson(source[key])
    } else if (Object.prototype.hasOwnProperty.call(SCALAR_DEFAULTS, key)) {
      out[key] = cloneJson(SCALAR_DEFAULTS[key])
    } else {
      out[key] = []
    }
  }

  return out
}

/**
 * @param {unknown} value
 * @returns {unknown[]}
 */
function asArray(value) {
  return Array.isArray(value) ? value : []
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {}
}

/**
 * Single-line text: titles come from user input and must not break Markdown
 * structure.
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function datePart(value) {
  const raw = text(value)
  const match = /^\d{4}-\d{2}-\d{2}/.exec(raw)
  return match ? match[0] : raw || 'unknown date'
}

/**
 * @param {Record<string, unknown>} song
 * @returns {string}
 */
function songLine(song) {
  const title = text(song.title) || 'Untitled song'
  const artist = text(song.artist)
  const year = song.year ? ` (${text(song.year)})` : ''
  return `- ${title}${artist ? ` — ${artist}` : ''}${year}`
}

/**
 * @param {Record<string, unknown>} session
 * @param {Map<string, Record<string, unknown>>} songsById
 * @returns {string}
 */
function practiceLine(session, songsById) {
  const song = songsById.get(text(session.song_id))
  const title = song ? text(song.title) || 'Untitled song' : 'Song not in this export'
  const instrument = text(session.instrument)
  const started = text(session.started_at)
  const ended = text(session.ended_at)
  let duration = ''
  const startMs = Date.parse(started)
  const endMs = Date.parse(ended)
  if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
    const minutes = Math.max(1, Math.round((endMs - startMs) / 60000))
    duration = ` — ${minutes} min`
  }
  return `- ${datePart(started)} — ${title}${instrument ? ` (${instrument})` : ''}${duration}`
}

/**
 * Human-readable Markdown summary of the same envelope: a counts table per
 * collection plus the rows a person recognises (songs, setlists, recent
 * practice sessions).
 * @param {Record<string, unknown>} [envelope]
 * @returns {string}
 */
export function buildExportSummary(envelope = {}) {
  const source = envelope && typeof envelope === 'object' ? envelope : {}
  const repertoire = asObject(source.repertoire)
  const activity = asObject(source.activity)
  const archive = asObject(source.archive)

  const songs = asArray(repertoire.songs)
  const versions = asArray(repertoire.versions)
  const charts = asArray(repertoire.charts)
  const tags = asArray(repertoire.tags)
  const collections = asArray(source.collections)
  const setlists = asArray(source.setlists)
  const annotations = asArray(source.annotations)
  const comments = asArray(source.comments)
  const practiceSessions = asArray(source.practice_sessions)
  const gigs = asArray(source.gigs)
  const performances = asArray(source.performances)
  const contributions = asArray(source.public_contributions)
  const memberships = asArray(source.memberships)
  const follows = asArray(activity.follows)
  const notifications = asArray(activity.notifications)
  const feedback = asArray(activity.feedback)
  const audit = asArray(archive.audit)
  const moderation = asArray(archive.moderation)

  const collectionEntries = collections.reduce(
    (total, collection) => total + asArray(asObject(collection).songs).length,
    0,
  )
  const setlistItems = setlists.reduce(
    (total, setlist) => total + asArray(asObject(setlist).items).length,
    0,
  )

  /** @type {[string, number][]} */
  const counts = [
    ['Memberships', memberships.length],
    ['Songs', songs.length],
    ['Versions', versions.length],
    ['Charts', charts.length],
    ['Tags', tags.length],
    ['Collections', collections.length],
    ['Collection entries', collectionEntries],
    ['Setlists', setlists.length],
    ['Setlist items', setlistItems],
    ['Annotations', annotations.length],
    ['Comments', comments.length],
    ['Practice sessions', practiceSessions.length],
    ['Gigs', gigs.length],
    ['Performances', performances.length],
    ['Public contributions', contributions.length],
    ['Follows', follows.length],
    ['Notifications', notifications.length],
    ['Feedback', feedback.length],
    ['Audit events', audit.length],
    ['Moderation cases', moderation.length],
  ]

  const lines = [
    '# CEMURM account export',
    '',
    `- Exported at: ${text(source.exported_at) || 'unknown'}`,
    `- User ID: ${text(source.user_id) || 'unknown'}`,
    `- Schema version: ${text(source.schema_version) || 'unknown'}`,
    '',
    '## What is in the export',
    '',
    '| Collection | Count |',
    '|---|---|',
    ...counts.map(([label, count]) => `| ${label} | ${count} |`),
    '',
    '## Songs',
    '',
  ]

  if (songs.length === 0) {
    lines.push('_No songs in this export._')
  } else {
    for (const song of songs) lines.push(songLine(asObject(song)))
  }

  lines.push('', '## Setlists', '')
  if (setlists.length === 0) {
    lines.push('_No setlists in this export._')
  } else {
    for (const setlist of setlists) {
      const row = asObject(setlist)
      const name = text(row.name) || 'Untitled setlist'
      lines.push(`- ${name} — ${datePart(row.created_at)} (${asArray(row.items).length} items)`)
    }
  }

  // Newest first: "latest practice sessions" is the useful slice of a history
  // that can run to thousands of rows. Stable on started_at.
  const songsById = new Map(
    songs.map((song) => [text(asObject(song).id), asObject(song)]),
  )
  const latestSessions = [...practiceSessions]
    .map(asObject)
    .sort((a, b) => String(b.started_at ?? '').localeCompare(String(a.started_at ?? '')))
    .slice(0, 10)

  lines.push('', '## Latest practice sessions', '')
  if (latestSessions.length === 0) {
    lines.push('_No practice sessions in this export._')
  } else {
    for (const session of latestSessions) {
      lines.push(practiceLine(session, songsById))
    }
  }

  lines.push('')
  return lines.join('\n')
}

/**
 * File name derived from `exported_at` (its calendar date, UTC). Falls back to
 * today only when the envelope has no parseable timestamp.
 * @param {Record<string, unknown>} [envelope]
 * @returns {string}
 */
export function exportFileName(envelope = {}) {
  const source = envelope && typeof envelope === 'object' ? envelope : {}
  const raw = text(source.exported_at)
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw)
  const parsed = match ? Date.parse(raw) : Number.NaN
  const day = match && !Number.isNaN(parsed)
    ? match[1]
    : new Date().toISOString().slice(0, 10)
  return `cemurm-export-${day}.json`
}
