/* eslint-disable react/prop-types */
// textAnimations.jsx — the 4 text animations from the React Bits set.
//
// The hard part here was restraint. Three of the four originals animate text
// forever or in response to raw scroll velocity. Apple is explicit on both:
// "Make motion optional… avoid using it as the only way to communicate", and
// avoid oscillation near 0.2Hz because people are sensitive to it. So:
//
//   text-loop          loops ONLY after the user presses Play, and freezes under
//                      prefers-reduced-motion (the first phrase is the static one).
//   scroll-velocity    clamps the skew, decays it to zero when scrolling stops,
//                      and returns to zero under reduced motion.
//   variable-proximity writes transforms straight to the DOM from a rAF loop —
//                      no React state, so a 24-letter paragraph costs zero
//                      re-renders per second.
//   count-up           counts once per press.

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { SPRING_SOFT, SPRING_UI, clamp, usePrefersReducedMotion } from './motion.js'

/* ------------------------------------------------------------- 28. TextLoop */
export function TextLoop({ phrases = ['Setlist ready', 'Rehearsal logged', 'Chart exported'] }) {
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(0)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (!playing || reduced) return undefined
    // 2.4s is a deliberate reading pace: Apple flags oscillation near 0.2Hz
    // (one cycle per 5s) as a comfort problem, so this stays well clear.
    const id = setInterval(() => setIndex((i) => (i + 1) % phrases.length), 2400)
    return () => clearInterval(id)
  }, [phrases.length, playing, reduced])

  return (
    <div className="space-y-3">
      <div className="flex h-10 items-center overflow-hidden">
        <motion.span
          key={phrases[index]}
          initial={reduced ? { opacity: 0 } : { y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: -12, opacity: 0 }}
          transition={reduced ? { duration: 0.15 } : SPRING_SOFT}
          className="text-base font-semibold tracking-tight text-cem-text"
        >
          {phrases[index]}
        </motion.span>
      </div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={SPRING_UI}
        onClick={() => setPlaying((v) => !v)}
        className={`min-h-11 rounded-lg px-4 text-sm font-medium ${
          playing
            ? 'border border-cem-elevated bg-cem-surface text-cem-text hover:bg-cem-elevated'
            : 'bg-cem-amber text-cem-base'
        }`}
      >
        {playing ? 'Pause' : 'Play'}
      </motion.button>
      <p className="text-xs text-cem-secondary">
        Opt-in, never auto-playing, frozen under reduced motion — Apple asks that
        motion be optional and never the only channel. Enter and exit share one
        curve; the phrase never animates while you are reading it.
      </p>
    </div>
  )
}

/* ------------------------------------------------------- 29. ScrollVelocity */
export function ScrollVelocity({ lines }) {
  const skew = useMotionValue(0)
  const springSkew = useSpring(skew, { ...SPRING_SOFT, damping: 26 })
  const reduced = usePrefersReducedMotion()
  const last = useRef(0)
  const prevTop = useRef(0)
  const raf = useRef(0)

  const onScroll = useCallback(
    (event) => {
      if (reduced) return
      const now = performance.now()
      const delta = now - last.current
      last.current = now
      if (delta < 16) return
      const top = event.currentTarget.scrollTop
      const velocity = clamp(top - prevTop.current, -120, 120)
      prevTop.current = top
      // Clamp: raw scroll delta makes text unreadable at speed.
      skew.set(clamp(velocity / 6, -10, 10))
      cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(() => skew.set(0))
    },
    [reduced, skew],
  )

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return (
    <div className="space-y-3">
      <div
        onScroll={onScroll}
        className="h-32 w-80 overflow-y-auto rounded-xl border border-cem-elevated bg-cem-surface p-4"
      >
        <motion.p
          style={{ skewY: springSkew, transformOrigin: 'top left' }}
          className="space-y-3 text-sm leading-6 text-cem-text"
        >
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="block">
              {lines} — {i + 1}
            </span>
          ))}
        </motion.p>
      </div>
      <p className="text-xs text-cem-secondary">
        Scroll inside the box: the paragraph skews with velocity and springs back
        to zero when the scroll stops. Clamped to 10° (the original is unbounded
        and briefly unreadable), and it stays flat under reduced motion.
      </p>
    </div>
  )
}

/* --------------------------------------------------- 30. VariableProximity */
export function VariableProximity({ text = 'CEMURM repertoire' }) {
  const baseRefs = useRef([])
  const glowRefs = useRef([])
  const pointer = useRef({ x: -9999, y: -9999 })
  const reduced = usePrefersReducedMotion()

  const letters = text.split('')

  // Per-frame work, not per-frame renders: the loop writes transforms and
  // opacity straight to the DOM nodes. A 19-letter paragraph therefore costs
  // zero React work per second.
  //
  // Two layers per letter — a base in the secondary tone and an amber layer
  // whose opacity tracks proximity. Colour interpolation in JS would need a
  // colour literal, which the visual contract forbids in src/; crossfading two
  // token layers is the same read with no literals.
  useEffect(() => {
    if (reduced) return undefined
    let frame = 0
    const tick = () => {
      for (let i = 0; i < baseRefs.current.length; i += 1) {
        const base = baseRefs.current[i]
        const glow = glowRefs.current[i]
        if (!base || !glow) continue
        const rect = base.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const d = Math.hypot(pointer.current.x - cx, pointer.current.y - cy)
        const near = clamp(1 - d / 90, 0, 1)
        const y = -near * 4
        const scale = 1 + near * 0.35
        base.style.transform = `translateY(${y.toFixed(2)}px) scale(${scale.toFixed(3)})`
        glow.style.transform = `translateY(${y.toFixed(2)}px) scale(${scale.toFixed(3)})`
        base.style.opacity = (1 - near * 0.35).toFixed(3)
        glow.style.opacity = near.toFixed(3)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [reduced, text])

  const register = (list, i) => (node) => {
    list.current[i] = node
  }

  return (
    <div className="space-y-3">
      <p
        onPointerMove={(event) => {
          pointer.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerLeave={() => {
          pointer.current = { x: -9999, y: -9999 }
        }}
        className="text-3xl font-semibold tracking-tight"
      >
        {letters.map((letter, i) => (
          <span key={`${letter}-${i}`} className="relative inline-block will-change-transform">
            <span
              ref={register(baseRefs, i)}
              className="inline-block text-cem-secondary"
              aria-hidden="true"
            >
              {letter === ' ' ? '\u00a0' : letter}
            </span>
            <span
              ref={register(glowRefs, i)}
              className="absolute inset-0 inline-block text-cem-amber"
              style={{ opacity: 0 }}
              aria-hidden="true"
            >
              {letter === ' ' ? '\u00a0' : letter}
            </span>
            <span className="sr-only">{letter}</span>
          </span>
        ))}
      </p>
      <p className="text-xs text-cem-secondary">
        Move the pointer across the letters: each one rises, grows, and hands over
        from secondary to amber by distance. Two token layers crossfade because a
        colour literal in JS is forbidden; transforms and opacities are written in
        a rAF loop with no state, and the effect is off under reduced motion.
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- 31. CountUp */
export function CountUp({ to = 47, label = 'Songs rehearsed this month' }) {
  const value = useMotionValue(0)
  const spring = useSpring(value, { ...SPRING_SOFT, damping: 32 })
  const rounded = useTransform(spring, (v) => Math.round(v))
  const reduced = usePrefersReducedMotion()

  return (
    <div className="space-y-3">
      <p className="text-4xl font-semibold tracking-tight text-cem-text">
        {reduced ? to : <motion.span>{rounded}</motion.span>}
      </p>
      <p className="text-sm text-cem-secondary">{label}</p>
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={SPRING_UI}
        onClick={() => value.set(to)}
        className="min-h-11 rounded-lg bg-cem-amber px-4 text-sm font-semibold text-cem-base"
      >
        Count to {to}
      </motion.button>
      <p className="text-xs text-cem-secondary">
        The number is a MotionValue driven into the text node — no re-render per
        frame. Under reduced motion the value is simply shown, which is the
        information the animation was carrying anyway.
      </p>
    </div>
  )
}