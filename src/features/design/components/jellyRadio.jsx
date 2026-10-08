/* eslint-disable react/prop-types */
// jellyRadio.jsx — ported from the reference source
// (react-bits `src/content/Micro/JellyRadio/JellyRadio.jsx` + `.css`).
//
// WHAT THE FIRST PORT GOT WRONG: it faded a background colour behind the active
// chip. JellyRadio is not a fade — it is a LUMP. Every chip is displaced,
// scaled and released on its OWN spring, staggered by distance from the
// selection, with the x-stiffness falling off 12% per step and the scale pair
// (sx, sy) driven by separate springs so the chip squashes before it recovers.
// The neighbours are pushed aside by `(chipWidth * swell) / 2 + barge`, which is
// why they shove rather than slide.
//
// What is preserved here:
//   * per-chip motionValues, not React state — 15 animated values per chip
//     would otherwise re-render the group 60 times a second;
//   * `spring(k, m, bounce)` derives damping from stiffness and mass, which is
//     what makes the jelly consistent at any stiffness;
//   * the stagger only applies when nothing is already in flight, so a fast
//     re-selection does not queue delays behind the previous animation;
//   * a ResizeObserver re-measures so the barge follows the chip's real width,
//     and `document.fonts.ready` settles again once webfonts land.
//
// COLOUR: `chipColor` / `activeColor` / `textColor` / `activeTextColor` keep
// their reference names; the values are TOKEN NAMES resolved at runtime, because
// rule 01a of check-visual-contract.sh rejects hex in src/.

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { animate, motion, motionValue, useReducedMotion, useTransform } from 'motion/react'
import { useTokenColors } from './colors.js'
import './reference.css'

const DEFAULT_ITEMS = ['Off', 'Low', 'Medium', 'High', 'Max']
const SIZES = { sm: [28, 12, 12], md: [36, 13, 16], lg: [44, 14, 20] }

const spring = (k, m, bounce) => ({
  type: 'spring',
  stiffness: k,
  damping: 2 * Math.sqrt(k * m) * (1 - bounce),
  mass: m,
})

const Chip = forwardRef(function Chip({ mv, children, ...rest }, ref) {
  const transform = useTransform(() => `translateX(${mv.x.get()}px) scale(${mv.sx.get()}, ${mv.sy.get()})`)
  return (
    <motion.button ref={ref} style={{ transform }} {...rest}>
      {children}
    </motion.button>
  )
})

export function JellyRadio({
  items = DEFAULT_ITEMS,
  value,
  defaultValue,
  onChange,
  chipColor = 'elevated',
  activeColor = 'text',
  textColor = 'text',
  activeTextColor = 'base',
  size = 'md',
  gap = 8,
  radius = 18,
  swell = 0.2,
  barge = 6,
  shrink = 0.05,
  jelly = 1,
  bounce = 0.25,
  stagger = 22,
  stiffness = 580,
  disabled = false,
  ariaLabel = 'Options',
  className = '',
}) {
  const list = items.map((it) => (typeof it === 'string' ? { value: it, label: it } : it))
  const [inner, setInner] = useState(() => defaultValue ?? list[0]?.value)
  const current = value ?? inner
  const at = Math.max(
    0,
    list.findIndex((it) => it.value === current),
  )
  const reduce = useReducedMotion()
  const groupRef = useRef(null)
  const chipRefs = useRef([])
  const widths = useRef([])
  const mvs = useRef([])
  const applied = useRef(at)
  const cfg = useRef({})
  cfg.current = { swell, barge, shrink, jelly, bounce, stagger, stiffness, reduce, count: list.length }
  const [h, font, px] = SIZES[size] ?? SIZES.md
  const itemsKey = list.map((it) => it.value).join('|')

  const colors = useTokenColors({
    chip: chipColor,
    active: activeColor,
    text: textColor,
    activeText: activeTextColor,
  })

  const mvFor = (i) => {
    let mv = mvs.current[i]
    if (!mv) {
      mv = { x: motionValue(0), sx: motionValue(1), sy: motionValue(1) }
      mvs.current[i] = mv
    }
    return mv
  }

  const apply = (sel, instant) => {
    const C = cfg.current
    const group = groupRef.current
    const rtl = group ? getComputedStyle(group).direction === 'rtl' : false
    const push = ((widths.current[sel] ?? 0) * C.swell) / 2 + C.barge
    for (let i = 0; i < C.count; i += 1) {
      const mv = mvFor(i)
      const on = i === sel
      const far = Math.abs(i - sel)
      const dir = Math.sign(i - sel) * (rtl ? -1 : 1)
      const x = dir * push
      const s = on ? 1 + C.swell : 1 - C.shrink
      if (instant || C.reduce) {
        mv.x.jump(x)
        mv.sx.jump(s)
        mv.sy.jump(s)
        continue
      }
      // Distance from the selection softens the spring, and the delay staggers
      // the release — but only when nothing is already moving, so a rapid
      // re-selection never queues a second wave behind the first.
      const k = C.stiffness * (1 - 0.12 * Math.min(far, 3))
      const inFlight = mv.x.isAnimating() || mv.sx.isAnimating() || mv.sy.isAnimating()
      const delay = inFlight ? 0 : (far * C.stagger) / 1000
      animate(mv.x, x, { ...spring(k, 0.9, C.bounce), delay })
      const j = C.jelly
      animate(mv.sx, s, {
        ...spring(k * (1 + 0.24 * j), 0.9 - 0.1 * j, Math.min(0.85, C.bounce + 0.3 * j)),
        delay,
      })
      animate(mv.sy, s, { ...spring(k * (1 - 0.14 * j), 0.9 + 0.05 * j, C.bounce), delay: delay + 0.05 * j })
    }
  }

  const measure = () => {
    const group = groupRef.current
    if (!group) return
    widths.current = chipRefs.current.map((el) => el?.offsetWidth ?? 0)
    const chipH = chipRefs.current[0]?.offsetHeight ?? 0
    const maxW = Math.max(0, ...widths.current)
    // The padding is solved FROM the swell, which is what keeps the barge clear
    // of the group's own edges when a wide chip is selected.
    group.style.setProperty('--jr-pad-x', `${Math.ceil((maxW * swell * 1.3) / 2 + barge) + 2}px`)
    group.style.setProperty('--jr-pad-y', `${Math.ceil((chipH * swell) / 2) + 2}px`)
  }

  useLayoutEffect(() => {
    const settle = () => {
      measure()
      apply(applied.current, true)
    }
    settle()
    const observer = new ResizeObserver(settle)
    if (groupRef.current) observer.observe(groupRef.current)
    document.fonts?.ready.then(settle)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, size, gap, swell, barge, shrink])

  useEffect(() => {
    if (applied.current === at) return
    applied.current = at
    apply(at, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at])

  useEffect(
    () => () =>
      mvs.current.forEach((mv) => {
        mv.x.destroy()
        mv.sx.destroy()
        mv.sy.destroy()
      }),
    [],
  )

  const commit = (i, instant) => {
    if (disabled || i === at || !list[i] || list[i].disabled) return
    applied.current = i
    apply(i, instant)
    if (value === undefined) setInner(list[i].value)
    onChange?.(list[i].value, i)
  }

  const stepFrom = (i, dir) => {
    const n = list.length
    let j = i
    for (let tries = 0; tries < n; tries += 1) {
      j = (j + dir + n) % n
      if (!list[j].disabled) return j
    }
    return i
  }

  const onKeyDown = (e, i) => {
    let next = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = stepFrom(i, 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = stepFrom(i, -1)
    else if (e.key === 'Home') next = stepFrom(-1, 1)
    else if (e.key === 'End') next = stepFrom(list.length, -1)
    else if (e.key === ' ' || e.key === 'Enter') next = i
    if (next === null) return
    e.preventDefault()
    commit(next, true)
    chipRefs.current[next]?.focus()
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      data-disabled={disabled ? '' : undefined}
      className={`jelly-radio${className ? ` ${className}` : ''}`}
      style={{
        '--jr-chip': colors.chip,
        '--jr-active': colors.active,
        '--jr-text': colors.text,
        '--jr-active-text': colors.activeText,
        '--jr-gap': `${gap}px`,
        '--jr-radius': `${radius}px`,
        '--jr-h': `${h}px`,
        '--jr-font': `${font}px`,
        '--jr-px': `${px}px`,
      }}
    >
      {list.map((it, i) => (
        <Chip
          key={it.value}
          mv={mvFor(i)}
          ref={(el) => {
            chipRefs.current[i] = el
          }}
          type="button"
          role="radio"
          aria-checked={i === at}
          tabIndex={i === at ? 0 : -1}
          disabled={disabled || !!it.disabled}
          className="jelly-radio__chip"
          data-on={i === at ? 'true' : 'false'}
          onClick={(e) => commit(i, e.detail === 0)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          <span className="jelly-radio__skin">
            {it.icon ? <span className="jelly-radio__icon">{it.icon}</span> : null}
            <span className="jelly-radio__label">{it.label}</span>
          </span>
        </Chip>
      ))}
    </div>
  )
}
