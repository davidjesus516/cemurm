/* eslint-disable react/prop-types */
// swipeRow.jsx — ported from the reference source
// (react-bits `src/content/Micro/SwipeRow/SwipeRow.jsx` + `.css`).
//
// WHAT THE FIRST PORT GOT WRONG, and it was the physics rather than the look:
//   * It snapped to a fixed open/closed distance. The reference runs a POSITION
//     MAP — `map(ex)`/`inv(ex)` — a piecewise function with a rubber-band knee
//     below zero, a linear region up to the drawer width, and past that a
//     resistance knee that ends at the commit point. Because `inv` inverts it
//     exactly, the grab offset survives being re-mapped every frame, which is
//     what lets you grab a row that is already open without it jumping.
//   * It committed on distance alone. The reference commits on distance AND
//     velocity (`commitPoint`), and `fullSwipe` decides which.
//   * It had no momentum projection. The reference projects the release velocity
//     (`project(v) = (v/1000) * 0.998 / (1 - 0.998)`, Apple's form, not v²/2a)
//     and lands on whichever side of D/2 the PROJECTED point falls.
//   * It had no keyboard. Arrow keys open and close from the right side for the
//     gesture, Enter/Space toggle, Delete commits the primary action, Escape
//     closes, and a visually-hidden toggle button carries the accessible name.
//
// COLOUR: `actionColor` / `drawerColor` / `rowColor` / `textColor` keep their
// reference names. Values are TOKEN NAMES resolved at runtime — rule 01a of
// check-visual-contract.sh rejects hex in src/. `onColor(hex)` becomes
// `readableOn()` over the resolved channels, so the ink is still chosen by
// measured luminance instead of being hardcoded.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { readableOn, useTokenColors } from './colors.js'
import './reference.css'

const HYST = 10
const FLICK = 110
const DECEL = 0.998
const VMAX = 1500
const EASE_OUT = [0.23, 1, 0.32, 1]
const SPRING_UI = { type: 'spring', duration: 0.3, bounce: 0 }
const DEFAULT_ACTIONS = [{ id: 'delete', label: 'Delete' }]

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const rubber = (o, dim, c) => (o * dim * c) / (dim + c * Math.abs(o))
const unrubber = (y, dim, c) => (y * dim) / (c * Math.max(1, dim - Math.abs(y)))
const project = (v) => ((v / 1000) * DECEL) / (1 - DECEL)

const velocityOf = (hist) => {
  if (hist.length < 2) return 0
  const a = hist[0]
  const b = hist[hist.length - 1]
  return ((b[1] - a[1]) / Math.max(1, b[0] - a[0])) * 1000
}

/* A gesture can leave the element: track it on the window so the row keeps
   following the finger past its own edge, and release cleanly on cancel. */
const watchWindow = (live) => {
  const onMove = (e) => {
    if (e.isTrusted) live.current.move(e)
  }
  const onUp = (e) => {
    if (e.isTrusted) live.current.up(e)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  return () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }
}

export function SwipeRow({
  children,
  actions = DEFAULT_ACTIONS,
  actionColor = 'amber',
  drawerColor = 'elevated',
  rowColor = 'surface',
  textColor = 'text',
  height = 64,
  radius = 16,
  actionWidth = 80,
  direction = 'left',
  snapBounce = 0.2,
  resistance = 0.55,
  collapseMs = 200,
  commitAt = 0.6,
  fullSwipe = true,
  disabled = false,
  open: openProp,
  onOpenChange,
  onAction,
  onCommit,
  closeOnAction = true,
  haptic = true,
  label = 'List item',
  className = '',
  style,
}) {
  const uid = useId()
  const reduce = useReducedMotion()
  const s = direction === 'left' ? -1 : 1
  const A = actionWidth
  const n = actions.length
  const D = n * A
  const c = clamp(resistance, 0.05, 1)
  const primary = actions[0]
  const [openState, setOpenState] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [say, setSay] = useState('')
  const open = openProp ?? openState

  const root = useRef(null)
  const surface = useRef(null)
  const w = useRef(360)
  const grip = useRef(null)
  const unwatch = useRef(null)
  const live = useRef({})
  const foldTimer = useRef(undefined)
  const heading = useRef(null)

  const x = useMotionValue(0)
  const spread = useMotionValue(0)
  const landed = useMotionValue(0)

  const colors = useTokenColors({
    action: actionColor,
    drawer: drawerColor,
    row: rowColor,
    text: textColor,
    base: 'base',
    ink: 'text',
  })

  const commitPoint = () => Math.max(commitAt * w.current, D + A / 2)
  const canCommit = () => fullSwipe && n > 0 && commitPoint() <= w.current

  const exposed = useTransform(x, (v) => s * v)
  const surfaceXf = useTransform(x, (v) => `translateX(${v}px)`)
  const railXf = useTransform(exposed, (e) => `translateX(${-s * Math.max(0, D - e)}px)`)
  const shift = useTransform([exposed, spread], ([e, p]) => p * Math.max(0, e - A))
  const blockXf = useTransform(shift, (v) => `translateX(${s * v}px)`)
  const glyphXf = useTransform([shift, landed], ([v, l]) => `translateX(${-s * l * (v - (w.current - A) / 2)}px)`)

  // Finger position → exposed position. Three regions: rubber-band behind the
  // closed state, linear across the drawer, and a resisted run-out to the commit
  // point. `inv` is the exact inverse, which is what keeps a re-grab continuous.
  const map = (raw) => {
    const W = w.current
    if (raw < 0) return rubber(raw, W, c)
    if (raw <= D) return raw
    if (!canCommit()) return D + rubber(raw - D, W, c)
    const C = commitPoint()
    const knee = D + (C - D) / c
    return raw <= knee ? D + c * (raw - D) : C + rubber(raw - knee, W, c)
  }
  const inv = (ex) => {
    const W = w.current
    if (ex < 0) return unrubber(ex, W, c)
    if (ex <= D) return ex
    if (!canCommit()) return D + unrubber(ex - D, W, c)
    const C = commitPoint()
    const knee = D + (C - D) / c
    return ex <= C ? D + (ex - D) / c : knee + unrubber(ex - C, W, c)
  }

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return undefined
    w.current = el.offsetWidth || w.current
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) w.current = width
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(
    () => () => {
      clearTimeout(foldTimer.current)
      unwatch.current?.()
    },
    [],
  )

  const setOpen = (next) => {
    if (next === open) return
    setOpenState(next)
    onOpenChange?.(next)
  }

  const settle = (target, v = 0) => {
    heading.current = target
    if (reduce) {
      animate(x, s * target, { duration: 0.2, ease: EASE_OUT })
      return
    }
    // A flick earns overshoot; a slow drag does not get it.
    const flicked = Math.abs(v) >= FLICK
    animate(
      x,
      s * target,
      flicked
        ? { type: 'spring', duration: 0.4, bounce: snapBounce, velocity: s * clamp(v, -VMAX, VMAX) }
        : { ...SPRING_UI, velocity: s * v },
    )
  }

  const setSpread = (on) => {
    if ((spread.get() === 1) === on) return
    if (reduce) spread.set(on ? 1 : 0)
    else animate(spread, on ? 1 : 0, SPRING_UI)
    if (on && primary) {
      setSay(`Release to ${primary.label}`)
      if (haptic && grip.current?.touch) navigator.vibrate?.(8)
    }
  }

  const commit = (a, viaKey, v = 0) => {
    const leap = a === primary
    setPhase('committing')
    setSay(a.label)
    setOpen(false)
    const fold = () => {
      setPhase('collapsing')
      foldTimer.current = setTimeout(() => {
        onCommit?.(a)
        a.onSelect?.()
      }, collapseMs)
    }
    if (viaKey || reduce) {
      if (leap) {
        spread.set(1)
        landed.set(1)
      }
      if (viaKey) {
        x.set(s * w.current)
        fold()
      } else animate(x, s * w.current, { duration: 0.2, ease: EASE_OUT }).then(fold)
      return
    }
    if (leap) {
      if (spread.get() < 1) animate(spread, 1, SPRING_UI)
      animate(landed, 1, SPRING_UI)
    }
    animate(x, s * w.current, { ...SPRING_UI, velocity: s * v }).then(fold)
  }

  useEffect(() => {
    if (openProp === undefined || grip.current || phase !== 'idle') return
    const target = open ? D : 0
    if (heading.current === target) return
    if (Math.abs(exposed.get() - target) > 0.5) settle(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, D])

  const down = (e) => {
    if (disabled || n === 0 || phase !== 'idle' || grip.current || e.button !== 0) return
    x.stop()
    heading.current = null
    grip.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      grab: null,
      moved: false,
      hist: [],
      touch: e.pointerType === 'touch',
    }
    try {
      surface.current?.setPointerCapture(e.pointerId)
    } catch {
      // Without capture the window listener carries the gesture to the edge.
    }
    unwatch.current?.()
    unwatch.current = watchWindow(live)
  }

  const move = (e) => {
    const g = grip.current
    if (!g || g.id !== e.pointerId) return
    if (g.grab === null) {
      const dx = e.clientX - g.x0
      const dy = e.clientY - g.y0
      // Hysteresis before commitment, and a perpendicular drag is not a swipe.
      if (Math.abs(dx) < HYST || Math.abs(dx) < Math.abs(dy)) return
      g.grab = s * (g.x0 + Math.sign(dx) * HYST) - inv(exposed.get())
      g.moved = true
      root.current?.setAttribute('data-dragging', '')
    }
    const ex = map(s * e.clientX - g.grab)
    x.set(s * ex)
    g.hist.push([performance.now(), ex])
    if (g.hist.length > 4) g.hist.shift()
    setSpread(canCommit() && ex >= commitPoint())
  }

  const up = (e) => {
    const g = grip.current
    if (!g || g.id !== e.pointerId) return
    grip.current = null
    unwatch.current?.()
    unwatch.current = null
    root.current?.removeAttribute('data-dragging')
    try {
      surface.current?.releasePointerCapture(e.pointerId)
    } catch {
      // Nothing was captured, so there is nothing to release.
    }
    const ex = exposed.get()
    const v = velocityOf(g.hist)
    if (!g.moved) {
      if (open) {
        setOpen(false)
        settle(0)
      }
      return
    }
    if (primary && canCommit() && ex >= commitPoint()) {
      commit(primary, false, v)
      return
    }
    // Apple: decide from the PROJECTED resting point, not the release point.
    const target = Math.abs(v) >= FLICK ? (v > 0 ? D : 0) : ex + project(v) > D / 2 ? D : 0
    setSpread(false)
    setOpen(target === D)
    settle(target, v)
  }

  live.current = { move, up }

  const act = (a, e) => {
    if (phase !== 'idle') return
    onAction?.(a)
    if (a === primary || a.dismiss) {
      commit(a, e.detail === 0)
      return
    }
    a.onSelect?.()
    if (!closeOnAction) return
    setOpen(false)
    if (e.detail === 0) {
      heading.current = 0
      x.set(0)
    } else settle(0)
  }

  const openNow = () => {
    heading.current = D
    x.set(s * D)
    setOpen(true)
    setSay(`${n} actions revealed`)
  }

  const closeNow = () => {
    heading.current = 0
    x.set(0)
    setOpen(false)
  }

  const onToggleKey = (e) => {
    if (disabled || phase !== 'idle' || n === 0) return
    const openKey = s < 0 ? 'ArrowLeft' : 'ArrowRight'
    const closeKey = s < 0 ? 'ArrowRight' : 'ArrowLeft'
    const toggle = e.key === 'Enter' || e.key === ' '
    if (e.key === openKey || (toggle && !open)) {
      e.preventDefault()
      openNow()
    } else if (e.key === closeKey || e.key === 'Escape' || (toggle && open)) {
      e.preventDefault()
      closeNow()
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && open && primary && canCommit()) {
      e.preventDefault()
      commit(primary, true)
    }
  }

  const onToggleClick = (e) => {
    if (e.detail !== 0 || disabled || phase !== 'idle' || n === 0) return
    if (open) closeNow()
    else openNow()
  }

  const railId = `${uid}-rail`

  return (
    <div
      ref={root}
      role="group"
      aria-label={label}
      className={`swipe-row${className ? ` ${className}` : ''}`}
      data-direction={direction}
      data-open={open ? '' : undefined}
      data-phase={phase}
      data-disabled={disabled ? '' : undefined}
      style={{
        '--sr-h': `${height}px`,
        '--sr-r': `${radius}px`,
        '--sr-a': `${A}px`,
        '--sr-row': colors.row,
        '--sr-text': colors.text,
        '--sr-drawer': colors.drawer,
        '--sr-on-drawer': readableOn(colors.drawer, colors),
        '--sr-action': colors.action,
        '--sr-on-action': readableOn(colors.action, colors),
        '--sr-collapse': `${collapseMs}ms`,
        ...style,
      }}
    >
      <div className="swipe-row__clip">
        <motion.div
          id={railId}
          className="swipe-row__rail"
          style={{ transform: railXf }}
          // The reference writes `inert={!open}` (React 19). This tree is React
          // 18, where a boolean on an unknown attribute is a dev warning; the
          // string is the same DOM the browser wants and silences it.
          inert={!open ? 'true' : undefined}
          aria-hidden={!open}
        >
          {actions.slice(1).map((a, i) => (
            <button
              key={a.id}
              type="button"
              className="swipe-row__action"
              onClick={(e) => act(a, e)}
              style={
                s < 0
                  ? {
                      right: (i + 1) * A,
                      background: a.color ?? colors.drawer,
                      color: readableOn(a.color ?? colors.drawer, colors),
                    }
                  : {
                      left: (i + 1) * A,
                      background: a.color ?? colors.drawer,
                      color: readableOn(a.color ?? colors.drawer, colors),
                    }
              }
            >
              <span className="swipe-row__glyph">
                {a.icon ? <span className="swipe-row__icon">{a.icon}</span> : null}
                <span>{a.label}</span>
              </span>
            </button>
          ))}

          {primary ? (
            <motion.div className="swipe-row__block" style={{ transform: blockXf }}>
              <motion.button
                type="button"
                className="swipe-row__action swipe-row__action--commit"
                style={{ transform: glyphXf }}
                onClick={(e) => act(primary, e)}
              >
                <span className="swipe-row__glyph">
                  <span className="swipe-row__icon">
                    {primary.icon ?? <HugeiconsIcon icon={Delete02Icon} size={20} strokeWidth={2} />}
                  </span>
                  <span>{primary.label}</span>
                </span>
              </motion.button>
            </motion.div>
          ) : null}
        </motion.div>

        <motion.div ref={surface} className="swipe-row__surface" style={{ transform: surfaceXf }} onPointerDown={down}>
          {children}
          <button
            type="button"
            className="swipe-row__toggle"
            tabIndex={disabled ? -1 : 0}
            aria-expanded={open}
            aria-controls={railId}
            aria-keyshortcuts={s < 0 ? 'ArrowLeft' : 'ArrowRight'}
            onKeyDown={onToggleKey}
            onClick={onToggleClick}
          >
            {n} {n === 1 ? 'action' : 'actions'}
          </button>
        </motion.div>
      </div>

      <span className="swipe-row__sr" aria-live="polite">
        {say}
      </span>
    </div>
  )
}
