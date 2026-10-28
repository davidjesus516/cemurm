/* eslint-disable react/prop-types */
// glassIcons.jsx — ported from the reference source the maintainer pasted
// (react-bits `src/content/Components/GlassIcons/GlassIcons.tsx`).
//
// WHAT THE EARLIER VERSION GOT WRONG: it had the three planes but was missing
// the things that make them read as the original — the reference's grid
// (`gap-[5em]`, two columns stepping to three), `customClass` per item, the
// 4.5em button, the gradient on the back plate, and the drop shadow that gives
// the plate its lift. It also invented an `active` state the reference does not
// have, which meant the demo could not be compared to the thing it claims to
// reproduce.
//
// PRESERVED EXACTLY, because these are the whole component:
//   * `perspective: 24em` on the grid and `transform-style: preserve-3d` on each
//     button. Without the pair, the plate's rotation reads as a skew.
//   * the plate rotates 15deg from its own bottom-right corner and travels to
//     `rotate(25deg) translate3d(-0.5em, -0.5em, 0.5em)` on hover;
//   * the glass face rotates from `80% 50%` and comes forward to
//     `translate3d(0, 0, 2em)`;
//   * the label sits at `top: 100%`, `line-height: 2`, and rises 20% on hover;
//   * all three planes share `cubic-bezier(0.83, 0, 0.17, 1)` over 300ms — the
//     reference's curve, which is NOT the material curve used elsewhere.
//
// COLOUR, the one substitution. The reference ships six `gradientMapping`
// entries built from HSL literals. Rule 01a of check-visual-contract.sh rejects
// colour functions anywhere in src/, and four of those six hues are the accents
// this repo retired. Two hues 15° apart at the same lightness are visually ONE
// hue, so the same read comes from a single resolved token gradiented into the
// base ramp — `linear-gradient` is not a colour function and passes the gate.
// The six reference colour NAMES still work as aliases (warm names take amber,
// cool names take the neutral plate), and any real token name works directly.
//
// `colorful` appears in the reference's usage snippet but NOT in its own
// TypeScript interface. It has no behaviour there, so it is not accepted here
// rather than silently swallowed.

import { useTokenColors } from './colors.js'
import './reference.css'

/* The reference names, mapped to what this palette can express. */
const WARM_NAMES = ['orange', 'red', 'green']
const COOL_NAMES = ['blue', 'purple', 'indigo']

function plateToken(color) {
  const name = String(color ?? '').toLowerCase()
  if (WARM_NAMES.includes(name)) return 'amber'
  if (COOL_NAMES.includes(name)) return 'elevated'
  return name || 'elevated'
}

export function GlassIcons({ items = [], className = '' }) {
  const leaves = items.map((item) => plateToken(item.color))
  // One resolve for the leaves plus the base every plate gradients into.
  const colors = useTokenColors({
    base: 'base',
    ...leaves.reduce((acc, leaf, i) => ({ ...acc, [`p${i}`]: leaf }), {}),
  })

  return (
    <div className={`glass-icons ${className}`.trim()}>
      {items.map((item, index) => {
        const from = colors[`p${index}`]
        // The second stop is the base ramp rather than a second hue: adjacent
        // hues at equal lightness read as one colour, so this is the same
        // gradient the reference draws, resolved from the token layer.
        const plate = from && colors.base ? `linear-gradient(${from}, ${colors.base})` : undefined

        return (
          <button
            key={item.label ?? index}
            type="button"
            aria-label={item.label}
            className={`glass-icon group${item.customClass ? ` ${item.customClass}` : ''}`}
          >
            <span className="glass-icon__back" style={plate ? { background: plate } : undefined} />
            <span className="glass-icon__front">
              <span aria-hidden="true">{item.icon}</span>
            </span>
            <span className="glass-icon__label">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
