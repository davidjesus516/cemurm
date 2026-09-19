// Pure relative-time formatter for the notifications feed (Hito 3 PR#2,
// task 2.1 — notifications Feed1 "reverse-chronological relative time").
// No dependencies, no I/O: safe to run bare-node in demo() and to unit-assert
// at bucket boundaries (0s / 1m / 59m / 1h / 2h / 3d / older).
// Buckets: <1m "just now", <1h "Nm ago", <1d "Nh ago", <7d "Nd ago",
// else the ISO date (YYYY-MM-DD) — old rows stop pretending to be recent.

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS

/**
 * Format an ISO timestamp relative to now. Returns '' for unparseable input.
 */
export function relativeTime(iso) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)

  if (diff < MINUTE_MS) return 'just now'
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h ago`
  if (diff < WEEK_MS) return `${Math.floor(diff / DAY_MS)}d ago`
  return new Date(then).toISOString().slice(0, 10)
}

// Self-check: node -e "import('./src/utils/relativeTime.js').then(m => m.demo())"
export function demo() {
  const assert = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`relativeTime demo FAILED: ${label} — got "${actual}", expected "${expected}"`)
    }
  }
  const now = Date.now()
  const ago = (ms) => new Date(now - ms).toISOString()

  assert(relativeTime(ago(0)), 'just now', '0s bucket')
  assert(relativeTime(ago(1 * MINUTE_MS)), '1m ago', '1m boundary')
  assert(relativeTime(ago(59 * MINUTE_MS)), '59m ago', '59m boundary')
  assert(relativeTime(ago(1 * HOUR_MS)), '1h ago', '1h boundary')
  assert(relativeTime(ago(2 * HOUR_MS)), '2h ago', '2h bucket')
  assert(relativeTime(ago(3 * DAY_MS)), '3d ago', '3d bucket')
  assert(relativeTime(ago(8 * DAY_MS)), new Date(now - 8 * DAY_MS).toISOString().slice(0, 10), 'older → date')

  // Defensive edges: future timestamps clamp to "just now"; non-dates never throw.
  assert(relativeTime(new Date(now + 5000).toISOString()), 'just now', 'future clamps')
  assert(relativeTime('not-a-date'), '', 'unparseable → empty')

  console.log('relativeTime demo OK: 9 asserts (0s/1m/59m/1h/2h/3d/older buckets, edges)')
}