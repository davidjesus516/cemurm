// Pure duration helpers — no localStorage, safe to import in Node.

/**
 * Format seconds as mm:ss. 765 → "12:45".
 */
export function formatDuration(totalSeconds) {
  const total = Math.max(0, Math.round(Number(totalSeconds) || 0))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Parse a duration input as mm:ss or plain seconds.
 * "3:30" → 210, "210" → 210, "" → null, garbage → null.
 */
export function parseDurationInput(value) {
  const input = String(value ?? '').trim()
  if (!input) return null
  const mmss = input.match(/^(\d{1,3}):([0-5]\d)$/)
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2])
  if (/^\d+$/.test(input)) return Number(input)
  return null
}