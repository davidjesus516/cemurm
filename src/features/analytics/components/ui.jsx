/* eslint-disable react/prop-types */
// Shared analytics presentation primitives (S3). Tier 2 (partial macOS language):
// plain borders and surfaces, NO material, NO decorative shadow. Charts are
// plain SVG with token classes only — no chart library, no raw colour literal,
// no inline style. Differentiation inside a chart uses amber opacity steps on
// the neutral track, never a second accent (visual rule 02 is at its ceiling).

/**
 * @param {{ title: string, subtitle?: string, action?: React.ReactNode, children: React.ReactNode }} props
 */
export function Card({ title, subtitle, action, children }) {
  return (
    <section className="mt-5 rounded-lg border border-cem-elevated bg-cem-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-cem-text">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-cem-secondary">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * @param {{ label: string, value: string | number, hint?: string }} props
 */
export function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-cem-elevated px-3 py-2">
      <p className="text-xs text-cem-secondary">{label}</p>
      <p className="mt-1 text-xl font-semibold text-cem-text">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-cem-secondary">{hint}</p>}
    </div>
  )
}

/**
 * An honest absence state. Metrics with no backing table/key in this build say
 * so explicitly — the page never fabricates a number to fill a chart.
 * @param {{ title: string, detail: string }} props
 */
export function NotTracked({ title, detail }) {
  return (
    <section className="mt-5 rounded-lg border border-cem-elevated p-4">
      <h2 className="text-sm font-semibold text-cem-text">{title}</h2>
      <p className="mt-2 inline-block rounded border border-cem-elevated px-2 py-0.5 text-xs font-medium text-cem-text">
        Not tracked yet
      </p>
      <p className="mt-2 text-xs text-cem-secondary">{detail}</p>
    </section>
  )
}

/**
 * Horizontal bars from any {label, value} rows. Zero/empty renders the empty
 * line rather than a chart with a fake axis.
 * @param {{ rows: { label: string, value: number }[], formatValue?: (n: number) => string, ariaLabel: string }} props
 */
export function BarChart({ rows, formatValue = (n) => String(n), ariaLabel }) {
  if (!rows.length) return <p className="mt-3 text-xs text-cem-secondary">No data to chart yet.</p>
  const max = Math.max(...rows.map((r) => Math.max(0, r.value)), 1)

  return (
    <ul className="mt-3 space-y-2">
      {rows.map((row, i) => (
        <li key={`${row.label}-${i}`} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-xs">
          <span className="truncate text-cem-text" title={row.label}>{row.label}</span>
          <svg viewBox="0 0 100 8" className="h-2 w-full" role="img" aria-label={`${row.label}: ${formatValue(row.value)}`}>
            <rect x="0" y="0" width="100" height="8" className="fill-cem-elevated" />
            <rect x="0" y="0" width={(Math.max(0, row.value) / max) * 100} height="8" className="fill-cem-amber" />
          </svg>
          <span className="text-right text-cem-text">{formatValue(row.value)}</span>
        </li>
      ))}
      <span className="sr-only">{ariaLabel}</span>
    </ul>
  )
}

/**
 * Line chart with an optional highlighted peak point. Empty series render an
 * absence line, never a flat zero line that would imply measured zeros.
 * @param {{ points: { label: string, value: number }[], peakIndex?: number, formatValue?: (n: number) => string, ariaLabel: string }} props
 */
export function LineChart({ points, peakIndex = -1, formatValue = (n) => String(n), ariaLabel }) {
  if (!points.length) return <p className="mt-3 text-xs text-cem-secondary">No data to chart yet.</p>
  const max = Math.max(...points.map((p) => Math.max(0, p.value)), 1)
  const width = 320
  const height = 96
  const pad = 8
  const coords = points.map((p, i) => ({
    x: pad + (i * (width - 2 * pad)) / Math.max(1, points.length - 1),
    y: height - pad - (Math.max(0, p.value) / max) * (height - 2 * pad),
  }))
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ')

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" role="img" aria-label={ariaLabel}>
        <polyline points={polyline} className="fill-none stroke-cem-amber" strokeWidth="2" />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === peakIndex ? 4 : 2}
            className={i === peakIndex ? 'fill-cem-amber' : 'fill-cem-elevated'}
          />
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap justify-between gap-1 text-[10px] text-cem-secondary">
        {points.map((p, i) => <span key={i}>{p.label}</span>)}
      </div>
      {peakIndex >= 0 && points[peakIndex] && (
        <p className="mt-1 text-[11px] text-cem-text">
          Peak: {points[peakIndex].label} — {formatValue(points[peakIndex].value)}
        </p>
      )}
    </div>
  )
}

/**
 * Donut breakdown using one accent at descending opacity on a neutral ring.
 * @param {{ rows: { label: string, percent: number }[], ariaLabel: string }} props
 */
export function DonutChart({ rows, ariaLabel }) {
  if (!rows.length) return <p className="mt-3 text-xs text-cem-secondary">No data to chart yet.</p>
  const radius = 34
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="mt-3 flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 100 100" className="h-32 w-32" role="img" aria-label={ariaLabel}>
        <circle cx="50" cy="50" r={radius} className="fill-none stroke-cem-elevated" strokeWidth="14" />
        {rows.map((row, i) => {
          const length = (row.percent / 100) * circumference
          const dash = <circle
            key={row.label}
            cx="50"
            cy="50"
            r={radius}
            className="fill-none stroke-cem-amber"
            strokeWidth="14"
            strokeOpacity={Math.max(0.35, 1 - i * 0.18)}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
          />
          offset += length
          return dash
        })}
      </svg>
      <ul className="space-y-1 text-xs">
        {rows.map((row) => (
          <li key={row.label} className="text-cem-text">
            {row.label} — {row.percent}% <span className="text-cem-secondary">({row.count})</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
