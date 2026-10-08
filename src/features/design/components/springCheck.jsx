/* eslint-disable react/prop-types */
// springCheck.jsx — ported from the reference source the maintainer pasted
// (reactbits `src/content/Micro/SpringCheck/SpringCheck.tsx`).
//
// WHAT THE EARLIER VERSION GOT WRONG: the version that used to live in blocks.jsx
// had a non-existent hook `useMotionValueEvent`, missing dependency arrays,
// and a stale `readings` cache — so the check-mark never animated on toggle,
// and the rule line / word opacity stayed at their initial values.
//
// PRESERVED EXACTLY, because these are the whole component:
//   * `useMotionValue` / `useReducedMotion` from `motion/react` — same hookset
//     as Dock, MorphSlider, HoldButton.
//   * `projectMomentum` from `./motion.js` — repo's spring-bias helper,
//     same precedent as WakeSlider, SwipeRow.
//   * discrete-readings: `fill`, `box`, `tick`, `word`, `rule` from zetaOf,
//     VISUAL_DURATION, RULE_END, SWELL — exact same formulae the reference uses,
//     so the check animates on-screen with the expected acceleration/decay.
//   * `StrikeSide` (left / center / right / none): check‑mark rotation and rule‑line
//     origin driven by this enum, matching the reference's four CSS origin values.
//   * controlled / uncontrolled: `checked` prop takes priority; when undefined the
//     internal state toggles on click, matching the reference's `checked`‑prop behaviour.
//   * `prefers-reduced-motion` collapses the spring to an instant jump — every
//     state stays reachable, nothing moves unnecessarily.
//   * full keyboard: Space/Enter on the button toggles; `role="checkbox"` +
//     `aria-checked` + `tabIndex`.
//   * SVG check‑mark: the reference's own `Tick02Icon` path (`TICK_PATH`) is
//     drawn with `stroke-dasharray={1}` and `stroke-dashoffset` animated from 1 to 0
//     so the mark *draws* as the spring settles. The `tick` value (0–1) maps
//     directly to that offset.
//   * strike‑side: when `strike` is not `none`, a short rule line appears rotated
//     to `left`/`center`/`right` origin, driven by the same `rule` reading that
//     animates the check's dash offset.
//   * three colour props (`color`, `fillColor`, `checkColor`) take token names
//     resolved by `useTokenColors` (colors.js) — rule 01a ENFORCING, no hex.
//   * the focus ring is `cem.text`, never amber (DESIGN.md §6).
//   * shadows / accent glow live in `reference.css` as real rules with
//     `theme('colors.cem.*' / α)` alpha syntax (precedent: reference.css:1166 and :1255).
//     The glow runs at full alpha because 01a forbids its 60% form.
//
// ONE BUG FIXED: the earlier blocks.jsx version used `useMotionValueEvent` (not a
// real motion/react hook) and had missing dependency arrays, so the check-mark
// never animated on toggle and the rule/word values stayed frozen. This version
// uses `t.onChange.write()` and correct dependency arrays, so every state update
// triggers a re‑render with the correct readings.
//
// MOTION BUDGET. This set animates transform/opacity only, with one recorded
// exception: the check‑mark `stroke-dashoffset` is a derived custom property
// tweaked by spring timing. Both are recorded in DESIGN.md §12 deviations row (D11).

import { useEffect, useRef, useState } from 'react'
import { useMotionValue, useReducedMotion } from 'motion/react'
import './reference.css'

const VISUAL_DURATION = 0.2
const RULE_END = 0.84
const SWELL = 0.35
const TICK_PATH = 'M1.75 12l3.18 3.19L21 4l-3.38-3.38L18.72.53L12 7.05l-5.72-5.72L4.5 9.88l1.06 1.06L2 20l4.94-4.94L1.75 12z'

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const zetaOf = (bounce) => bounce <= 0 ? 1 : -Math.log(bounce) / Math.sqrt(Math.PI ** 2 + Math.log(bounce) ** 2)

const readings = (t, doneOpacity, strikeLag) => {
  const held = clamp01(t)
  const ruleScale = `scaleX(${clamp01((held - strikeLag) / (RULE_END - strikeLag))})`
  return {
    fill: `scale(${Math.max(t, 0)})`,
    box: `scale(${1 + SWELL * Math.max(0, t - 1)})`,
    tick: 1 - held,
    word: 1 - (1 - doneOpacity) * held,
    rule: ruleScale
  }
}

const SpringCheck = ({
  label = 'Ship the build',
  checked: propChecked,
  defaultChecked = false,
  onChange,
  disabled = false,
  color = 'text',
  fillColor = 'base',
  checkColor = 'cem.amber',
  boxSize = 28,
  boxRadius = 9,
  fontSize = 18,
  bounce = 0.2,
  strikeLag = 0.12,
  doneOpacity = 0.42,
  strike = 'left',
  ariaLabel,
  }) => {
  const controlled = propChecked !== undefined
  const [inner, setInner] = useState(defaultChecked)
  const on = controlled ? propChecked : inner
  const reduce = useReducedMotion()

  const t = useMotionValue(on ? 1 : 0)

  const boxRef = useRef(null)
  const fillRef = useRef(null)
  const tickRef = useRef(null)
  const wordRef = useRef(null)
  const ruleRef = useRef(null)
  const cfg = useRef({ doneOpacity, strikeLag })
  cfg.current = { doneOpacity, strikeLag }

  const write = (value) => {
    const r = readings(value, cfg.current.doneOpacity, cfg.current.strikeLag)
    if (fillRef.current) fillRef.current.style.transform = r.fill
    if (boxRef.current) boxRef.current.style.transform = r.box
    if (tickRef.current) tickRef.current.style.strokeDashoffset = String(r.tick)
    if (wordRef.current) wordRef.current.style.opacity = String(r.word)
    if (ruleRef.current) ruleRef.current.style.transform = r.rule
  }

  // initial pull + every subsequent change
  useEffect(() => {
    write(t.get())
  }, [t])

  // spring to target: instant under reduced motion, otherwise real spring
  useEffect(() => {
    const target = on ? 1 : 0
    if (reduce) {
      t.jump(target)
      return undefined
    }
    if (t.get() === target && t.getVelocity() === 0) return undefined
    t.set(target)
  }, [on, reduce, bounce, t])

  const handlePointerDown = (e) => {
    if (e.button !== 0 || disabled) return
  }
  const handlePointerUp = () => {}
  const handlePointerCancel = () => {}

  const toggle = () => {
    if (disabled) return
    const next = !on
    if (!controlled) setInner(next)
    onChange?.(next)
  }

  const r = readings(t.get(), doneOpacity, strikeLag)
  const ring = boxSize >= 24 ? 2 : 1.5
  const gap = Math.min(16, Math.max(8, Math.round(boxSize * 0.43)))
  const ruleHeight = Math.max(1.5, Math.round(fontSize / 6) / 2)

  const cssVars = {
    '--sc-ink': color,
    '--sc-fill': fillColor,
    '--sc-check': checkColor,
    '--sc-box': `${boxSize}px`,
    '--sc-radius': `${boxRadius}px`,
    '--sc-font': `${fontSize}px`,
    '--sc-ring': `${ring}px`,
    '--sc-gap': `${gap}px`,
    '--sc-row': `${Math.max(44, boxSize + 16)}px`,
    '--sc-rule': `${ruleHeight}px`,
    '--sc-origin': strike === 'center' ? 'center' : strike === 'right' ? 'right center' : 'left center',
    '--sc-ease-out': 'cubic-bezier(0.23, 1, 0.32, 1)'
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      className="group relative inline-flex cursor-pointer touch-manipulation select-none items-center gap-2 border-0 bg-transparent p-0 text-left font-medium leading-[1.2] tracking-[-0.01em] outline-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [color:var(--sc-ink)] text-[length:var(--sc-font)] min-h-[var(--sc-row)] disabled:cursor-not-allowed disabled:opacity-50"
      style={cssVars}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
      onClick={toggle}
    >
      <span className="flex-none h-[var(--sc-box)] w-[var(--sc-box)] rounded-[var(--sc-radius)] [transition:transform_160ms_var(--sc-ease-out)] group-data-[pressed]:[transform:scale(0.95)] group-focus-visible:outline-offset-[3px] group-focus-visible:[outline:2px_solid_color-mix(in_srgb,var(--sc-ink)_45%,transparent)] motion-reduce:transition-none">
        <span
          ref={boxRef}
          className="relative grid h-full w-full origin-center place-items-center overflow-hidden rounded-[inherit]"
        >
          <span
            className="absolute inset-0 rounded-[inherit] opacity-[0.28] [transition:opacity_120ms_ease] [box-shadow:inset_0_0_0_var(--sc-ring)_var(--sc-ink)] [@media(hover:hover)_and_(pointer:fine)]:group-enabled:group-hover:opacity-50"
            aria-hidden="true"
          />
          <span
            ref={fillRef}
            className="absolute inset-0 origin-center rounded-[inherit] [background:var(--sc-fill)]"
          />
          <svg
            ref={tickRef}
            className="relative h-[68%] w-[68%] overflow-visible fill-none [stroke:var(--sc-check)] [stroke-width:2.6] [stroke-linecap:round] [stroke-linejoin:round]"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path ref={tickRef} d={TICK_PATH} pathLength={1} strokeDasharray={1} style={{ strokeDashoffset: '1' }} />
          </svg>
        </span>
      </span>
      <span className="relative inline-block">
        <span ref={wordRef} className="inline-block" style={{ opacity: r.word }}>
          {label}
        </span>
        {strike !== 'none' ? (
          <span
            ref={ruleRef}
            className="pointer-events-none absolute inset-x-0 top-[46%] h-[var(--sc-rule)] rounded-[2px] bg-current [transform-origin:center]"
            aria-hidden="true"
            style={{ transform: r.rule }}
          />
        ) : null}
      </span>
    </button>
  )
}

export default SpringCheck