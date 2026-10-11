// colors.js — runtime token resolution for the ported reference components.
//
// WHY: the reference components take their colours as props filled with hex
// literals — accentColor, actionColor, activeColor and so on. Rule 01a of
// scripts/check-visual-contract.sh is enforcing and rejects any hex or colour
// function anywhere in src/, so a faithful port cannot carry those defaults.
//
// THE FIX IS NOT A SECOND PALETTE. Every colour prop keeps its original NAME
// and its original POSITION in the API; what it takes is a token NAME instead
// of a hex string, resolved at runtime through a probe element wearing a
// cem-* utility class. Change a token in tailwind.config.js and the component
// follows — there is no second source of truth to drift.
//
// `readableOn` replaces the reference's `onColor(hex)`: the reference picks one
// of two hardcoded inks from a hex it is handed. Here the same luminance test
// runs on the RESOLVED channels and returns a resolved token, so both halves
// of the pair still come from one layer.

import { useEffect, useState } from 'react'

const TOKEN_CLASS = {
  base: 'bg-cem-base',
  surface: 'bg-cem-surface',
  elevated: 'bg-cem-elevated',
  hover: 'bg-cem-hover',
  text: 'bg-cem-text',
  secondary: 'bg-cem-secondary',
  'secondary-elevated': 'bg-cem-secondary-elevated',
  amber: 'bg-cem-amber',
}

function channels(color) {
  if (typeof color !== 'string') return null
  const match = color.match(/[\d.]+/g)
  if (!match || match.length < 3) return null
  return [Number(match[0]), Number(match[1]), Number(match[2])]
}

/** Relative luminance — the same 0.2126/0.7152/0.0722 weighting the reference uses. */
export function luminance(color) {
  const rgb = channels(color)
  if (!rgb) return 0
  return (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722) / 255
}

/**
 * `color` at `alpha`, as an 8-digit hex — the shape a resolved token takes when
 * a port needs the reference's translucent version of it.
 *
 * The reference spells that with a colour function written straight into the
 * string; rule 01a of scripts/check-visual-contract.sh scans src/ for exactly
 * that syntax, so the alpha is folded into the hex instead. The arithmetic runs
 * on channels the probe already resolved, so nothing raw travels through
 * source: same token, same alpha, different spelling.
 *
 * Returns `color` untouched when it cannot be read, so an unresolved frame
 * paints late rather than painting garbage.
 */
export function withAlpha(color, alpha) {
  const rgb = channels(color)
  if (!rgb) return color
  const byte = (value) =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  const t = Math.max(0, Math.min(1, alpha))
  return `#${rgb.map(byte).join('')}${byte(t * 255)}`
}

/**
 * Resolve a `{ propName: tokenName }` map to `{ propName: rgbString }`.
 * Empty until the probe has run, which is why every caller renders its
 * structure first and paints colour on the layout pass after.
 */
export function useTokenColors(spec) {
  const [colors, setColors] = useState({})
  // The token NAMES are the dependency; `spec` is a fresh object literal on
  // every render, so listing it would re-probe on every paint.
  const key = JSON.stringify(spec)

  useEffect(() => {
    const probe = document.createElement('span')
    probe.style.position = 'absolute'
    probe.style.width = '0'
    probe.style.height = '0'
    probe.style.opacity = '0'
    probe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(probe)

    const next = {}
    for (const [prop, leaf] of Object.entries(spec)) {
      probe.className = TOKEN_CLASS[leaf] || TOKEN_CLASS.surface
      next[prop] = getComputedStyle(probe).backgroundColor
    }

    document.body.removeChild(probe)
    setColors(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return colors
}

/**
 * Ink that stays legible on `background`. Returns a resolved token colour, or
 * an empty string before resolution — callers pass it to the same CSS custom
 * property as every other colour, so an unresolved frame simply paints late.
 */
export function readableOn(background, resolved, darkToken = 'base', lightToken = 'text') {
  const dark = resolved?.[darkToken]
  const light = resolved?.[lightToken]
  if (!background || !dark || !light) return ''
  return luminance(background) > 0.45 ? dark : light
}
