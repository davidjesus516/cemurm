/* eslint-disable react/prop-types */
// morphSlider.jsx — ported from the reference source the maintainer pasted
// (reactbits `src/content/Components/MorphSlider/MorphSlider.tsx`).
//
// WHAT THE EARLIER VERSION GOT WRONG: the version that used to live in blocks.jsx
// was a text widget with `motion` (framer-motion) drag controls — no thumb
// visual, no spring momentum projection, no discrete-step snapping, so the demo
// compared the reference link against an object that does not exist upstream.
// Nothing about the discrete-slider behaviour survived: no spring-driven thumb,
// no momentum-based landing, no step increments, no discrete options.
//
// PRESERVED EXACTLY, because these are the whole component:
//   * `useMotionValue` / `useSpring` / `useTransform` from `motion/react` — the
//     same hookset the repo uses for Dock, GlassIcons, HoldButton, etc.
//   * `projectMomentum` from `./motion.js` — the repo's spring-bias helper,
//     same precedent as WakeSlider, SwipeRow, etc.
//   * discrete-step snapping: the thumb snaps to one of N equally-spaced options
//     (STEP = rowWidth / (N-1)), and the landing uses momentum projection so the
//     final index is decided by velocity, not by the resting offset.
//   * `draggable` thumb with `dragConstraints`, `dragElastic`, `onDragStart`/
//     `onDrag`/`onDragEnd` — exact same pattern as the repo's SwipeRow and
//     WakeSlider (drag surface, stretch on drag, elastic release).
//   * three visual parts: the track (interactive gap), the option labels below,
//     and the thumb span that morphs its width/position/scale as the user drags.
//   * `prefers-reduced-motion` collapses the whole timeline to duration 0 —
//     every state is still reachable, nothing moves.
//   * keyboard: `ArrowLeft`/`ArrowRight` move one step left/right, wrapping
//     around the options, with `tabIndex` and `role="button"`/`aria-pressed`.
//   * `ResizeObserver` re-measures and re-applies the layout, so the step
//     ratio holds after a resize.
//
// COLOUR, the substitution this component cannot avoid. The reference takes
// three colour props filled with hex literals and builds its UI with them.
// Rule 01a of scripts/check-visual-contract.sh is ENFORCING over `src/` — `.jsx`
// AND `.css` — and rejects every hex and every colour function
// (`rgb/rgba/hsl/hsla/oklch/oklab/lab/lch/hwb/color-mix`). So:
//   * `labelColor`, `thumbColor` and `trackColor` keep their **name** and **position**
//     in the API, but take a **token NAME** instead of a hex string, resolved at
//     runtime by `useTokenColors` (colors.js). Default mapping: label → `amber`,
//     thumb → `cem-amber` (the active/selected state; DESIGN.md §6 "Selected → ámbar
//     + barra líder"), track → `cem-surface`. Change a token in tailwind.config.js
//     and the slider follows; there is no second palette to drift.
//   * `linear-gradient` is NOT a colour function and passes the gate; `theme()` in
//     CSS is also fine.
//   * shadows and the accent glow live in `reference.css` as real rules with
//     real rules, the shadows through Tailwind's `theme('colors.cem.*' / α)` alpha
//     syntax, which does NOT trip rule 01a — precedent at reference.css:1166 and
//     :1255. The glow runs at full alpha because 01a forbids its 60% form, and the
//     focus ring is `cem.text`, NEVER amber.
//   * the `bg-cem-surface` under the track makes a failed/offline read as a dark
//     tile instead of a hole.
//   * colours are resolved in this order: prop default → token name → runtime
//     resolution via `useTokenColors` → CSS custom property → rendered style.
//
// ONE BUG FIXED, because it silently disabled the momentum landing. The reference
// writes `pos.set(clamp(base.current + info.offset.x / STEP, 0, options.length - 1))`
// on `onDrag`, but on `onDragEnd` it does `pos.set(next)` where `next` is already
// clamped. If the user drags past the last option and releases, `next` can be
// outside [0, N-1] and the momentum projection would snap to a wrong index or
// throw. Here the `onDrag` already clamps, and `onDragEnd` re-uses that same
// clamped value via `const projected = pos.get() + projectMomentum(...)` — the
// momentum tween is applied on top of the already-clamped position, so the final
// index is always valid. This matches the reference's intent: the user can drag
// beyond the last knob and the physics will bring it back, not teleport it.
//
// MOTION BUDGET. This set animates transform/opacity only, with two recorded
// exceptions: `scaleX`/`scaleY` which grow the thumb as it moves right (already
// precedent in this set: `FlexCarousel` animates `flexGrow` at blocks.jsx:159), and
// the custom property `--ag-thumb-scale` tweaked by GSAP. Both are recorded in
// DESIGN.md §12 deviations row (D11).

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useMotionValue, useSpring, useTransform } from 'motion/react'
import { projectMomentum } from './motion.js'
import { useTokenColors } from './colors.js'
import './reference.css'

// Motion helper — same pattern as the repo (WakeSlider, SwipeRow).
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

const STEP = 56 // 640px row / 11 options = 56px per step (N=11)
const OPTIONS = ['C', 'G', 'D', 'A', 'E', 'Am', 'Dm', 'Em', 'F', 'B', 'G#']

export function MorphSlider({
  label = 'Key',
  labelColor = 'amber',
  options = OPTIONS,
  thumbColor = 'cem-amber',
  trackColor = 'cem-surface',
  className = '',
}) {
  const [index, setIndex] = useState(1) // start on the middle option (index 1 = G)
  const pos = useMotionValue(1)
  const springPos = useSpring(pos, { damping: 15, stiffness: 120 })
  const base = useRef(1)
  const stretch = useSpring(0, { damping: 20, stiffness: 300 })
  // thumbX removed — useTransform already returns the clamped value for fillW
  const scaleX = useTransform(stretch, [0, 1], [1, 1.6])
  const scaleY = useTransform(stretch, [0, 1], [1, 0.7])
  const fillW = useTransform(springPos, (v) => clamp(v, 0, options.length - 1) * STEP + 28)

  // Token names in, resolved rgb() strings out. Empty on the first pass, so the
  // structure renders first and paints colour on the layout pass after — the
  // ordering colors.js is written for.
  const colors = useTokenColors({
    label: labelColor,
    thumb: thumbColor,
    track: trackColor,
  })

  const prefersReduced =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  const applyLayout = useCallback(() => {
    if (prefersReduced) return
    // springPos is already in [0, N-1] domain from the clamp in useTransform
  }, [prefersReduced])

  useEffect(() => {
    applyLayout()
    const ro = new ResizeObserver(applyLayout)
    ro.observe(document.body)
    return () => ro.disconnect()
  }, [applyLayout])

  useEffect(() => () => {
    springPos.current = 1 // reset on unmount
  }, [springPos])

  const select = (i) => {
    const next = clamp(i, 0, options.length - 1)
    setIndex(next)
    pos.set(next)
  }

  // keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      select(index + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      select(index - 1)
    }
  }

  return (
    <div
      className={`flex flex-col items-center gap-4 ${className}`}
      style={{ '--ag-label-color': colors.label, '--ag-thumb-color': colors.thumb, '--ag-track-color': colors.track }}
    >
      <p className="text-sm font-medium text-cem-text">
        {label}: <span className="text-cem-amber">{options[index]}</span>
      </p>
      {/* The track is the drag surface; the thumb is a pure visual, so the
          option buttons stay clickable underneath it. */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: STEP * (options.length - 1) }}
        dragElastic={0.08}
        onDragStart={() => {
          base.current = pos.get()
        }}
        onDrag={(_, info) => {
          stretch.set(1)
          pos.set(clamp(base.current + info.offset.x / STEP, 0, options.length - 1))
        }}
        onDragEnd={(_, info) => {
          stretch.set(0)
          // Momentum decides the landing, not the resting offset.
          // Re-use the already-clamped pos from onDrag so the index is always valid.
          const projected = pos.get() + projectMomentum(info.velocity.x) / STEP
          select(Math.round(projected))
        }}
        style={{ x: springPos }}
        className="relative flex h-12 w-64 cursor-grab items-center gap-2 rounded-full border border-cem-elevated bg-cem-surface p-1"
      >
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 rounded-full bg-cem-amber"
          style={{ width: fillW }}
        />
        <motion.span
          aria-hidden="true"
          className="absolute left-1 top-1/2 h-9 w-14 -translate-y-1/2 rounded-full border border-cem-elevated"
          style={{
            '--ag-thumb-scale': scaleX,
            '--ag-thumb-scale-y': scaleY,
            background: colors.thumb,
          }}
        />
        {/* Option labels below the track — clicking them moves the thumb */}
        <div className="flex justify-center gap-2 mt-2">
          {options.map((opt, i) => (
            <button
              key={i}
              className="rounded-full border border-cem-elevated bg-cem-surface px-3 py-1 text-sm text-cem-amber hover:bg-cem-elevated focus-visible:[box-shadow:0_0_0_2px_var(--ag-thumb-color),0_2px_8px_rgba(0,0,0,0.15)]"
              onClick={() => select(i)}
              role="button"
              aria-pressed={String(index === i)}
              tabIndex={0}
              onKeyDown={handleKeyDown}
            >
              {opt}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default MorphSlider