/* eslint-disable react/prop-types -- the shape is { kind, color } and neither
   prop is required; the component defaults to amber and the project's colour set. */

import { memo } from 'react'

// One stroke weight for every icon in the set, so the glass-icons row reads as one
// material instead of six icons drawn by six people. 1.5 is the Apple default for UI
// iconography at this size and it is what the rest of the product already uses for its
// stage controls.
const STROKE = 1.5

// A small palette of product meanings, each with a 24x24 SVG path. Amber is the primary
// accent and the default; the other tiles are supporting glass, never a second accent on the
// page. The colour is a Tailwind class resolved from the token set, never a literal.
const ICONS = {
  chart: (      <svg viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18h18" />
      <path d="M5 14l4-4 4 4 4-4 4 4" />
      <path d="M3 18v-4M21 18v-4" />
    </svg>
  ),
  roles: (      <svg viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M14 21v-2a3 3 0 013-3h2a3 3 0 013 3v2" />
    </svg>
  ),
  coverage: (      <svg viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h4v4" />
      <path d="M4 12a8 8 0 018-8 7 7 0 016 3.5" />
      <path d="M20 16a8 8 0 01-8 8 7 7 0 01-6-3.5" />
      <path d="M4 12h12a4 4 0 004-4" />
    </svg>
  ),
  projection: (      <svg viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a2 2 0 002 2h2" />
      <path d="M14 1v6h6" />
      <path d="M20 13v8" />
      <path d="M4 13v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2H6a2 2 0 00-2 2z" />
      <path d="M8 15h8" />
    </svg>
  ),
  offline: (      <svg viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l3 3" />
    </svg>
  ),
  history: (      <svg viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1018 0 9 9 0 00-18 0z" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
}

// Colour tokens the glass tile can take. Amber is the primary accent; the rest are the
// project's declared system colours, used ONLY as supporting glass behind icons, never as
// a second page-level accent. Passed as a Tailwind class so the colour always resolves from
// the token layer.
//
// THESE FOUR NAMES ARE THE ENTIRE CONTRACT, AND `?? COLORS.amber` IS WHAT MAKES THAT
// MATTER. A caller passing anything else gets amber, silently and with no warning, which is
// exactly what the landing's call sites used to do: they passed names that are not declared
// here, one of which is not a token at all, and every tile on the page rendered amber while
// the source described a rotation. So the caller arrays must be built from THIS list. Gate
// rule 02 bans the four dead accents anywhere in src/, comments included, which leaves
// amber, amberLight, secondary and secondaryElevated as the whole rotation.
const COLORS = {
  amber: 'bg-cem-amber/20 border-cem-amber/40 text-cem-amber',
  amberLight: 'bg-cem-amber/10 border-cem-amber/20 text-cem-secondary',
  secondary: 'bg-cem-secondary/10 border-cem-secondary/20 text-cem-secondary',
  secondaryElevated: 'bg-cem-secondary-elevated/10 border-cem-secondary-elevated/20 text-cem-secondary-elevated',
}

export const GlassIcon = memo(function GlassIcon({ kind = 'chart', color = 'amber' }) {
  const icon = ICONS[kind] ?? ICONS.chart
  const colorClass = COLORS[color] ?? COLORS.amber

  return (
    <div
      className={`relative inline-flex h-12 w-12 items-center justify-center rounded-cem-md border ${colorClass} border-t border-cem-text/10`}
      aria-hidden="true"
    >
      {/* Inner highlight — the thinnest light edge on the top, the one Apple's glass
          uses to read as a material catching light rather than a flat tinted box. */}
      <div
        className="pointer-events-none absolute top-0.5 left-1/2 h-px w-3/4 -translate-x-1/2 bg-cem-text/20"
        aria-hidden="true"
      />
      {icon}
    </div>
  )
})

export default GlassIcon
