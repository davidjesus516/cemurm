/* eslint-disable react/prop-types */
// animations.jsx — the 4 animation pieces from the React Bits set.
//
// Token-safe adaptations, each replacing an effect the visual contract forbids:
//   * gradual-blur uses a CSS mask with two blur radii around the viewport
//     centre. No gradient or colour literal is needed, and the same CSS on a
//     projector is jank, so it stays tier 1 and stays off under reduced
//     transparency.
//   * target-cursor replaces the system cursor ONLY when the pointer is fine
//     (mouse) and reduced motion is off. Touch keeps the real cursor, and the
//     ring carries no meaning — it never replaces a visible label.
//   * click-spark fires on pointer-DOWN (the causal frame), never on click.
//   * pixel-swap reveals on an explicit press, not on a loop.

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { SPRING_MOMENTUM, SPRING_UI, usePrefersReducedMotion } from './motion.js'
import { useTokenColors } from './colors.js'

/* ------------------------------------------------------------ 32. PixelSwap */
export function PixelSwap({ words = ['READY', 'PLAYING', 'DONE'], label = 'Stage state' }) {
  const [step, setStep] = useState(0)
  const word = words[step % words.length]
  const cols = 10
  const rows = 4
  const reduced = usePrefersReducedMotion()

  return (
    <div className="space-y-3">
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={SPRING_UI}
        onClick={() => setStep((s) => s + 1)}
        className="grid h-24 w-64 grid-cols-10 grid-rows-4 place-items-center overflow-hidden rounded-xl border border-cem-elevated bg-cem-surface"
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const charIndex = Math.floor(((rows - 1 - r) * cols + c) * (word.length / (rows * cols)))
            const char = word[Math.min(word.length - 1, charIndex)]
            // Each cell is a masked slice of the word; they fade in on a
            // diagonal, so the swap reads as pixels resolving, not a wipe.
            const distance = (r + c) / (rows + cols)
            return (
              <motion.span
                key={`${r}-${c}`}
                className="grid h-full w-full place-items-center text-[13px] font-semibold text-cem-text"
                initial={false}
                animate={{ opacity: 1 }}
                transition={reduced ? { duration: 0.12 } : { duration: 0.5, delay: distance * 0.18 }}
              >
                <motion.span
                  key={char}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={reduced ? { duration: 0.12 } : { ...SPRING_MOMENTUM, delay: distance * 0.18 }}
                >
                  {char}
                </motion.span>
              </motion.span>
            )
          }),
        )}
      </motion.button>
      <p className="text-xs text-cem-secondary">
        {label}: tap to advance. Cells resolve on a diagonal with one shared
        spring, so the swap is one event instead of a loop — Apple asks for
        content as soon as possible and forbids gratuitous motion.
      </p>
    </div>
  )
}

/* ---------------------------------------------------------- 33. TargetCursor */
export function TargetCursor() {
  const reduced = usePrefersReducedMotion()
  const [enabled, setEnabled] = useState(false)
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const sx = useSpring(x, { ...SPRING_MOMENTUM, damping: 24 })
  const sy = useSpring(y, { ...SPRING_MOMENTUM, damping: 24 })

  useEffect(() => {
    if (!enabled || reduced) return undefined
    // Only for a fine pointer. A touch device has no cursor to replace, and the
    // ring must never become the only indication that something is clickable.
    const fine = window.matchMedia('(pointer: fine)').matches
    if (!fine) return undefined
    const move = (event) => {
      x.set(event.clientX)
      y.set(event.clientY)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [enabled, reduced, x, y])

  return (
    <div className="space-y-3">
      <div className="relative h-32 w-80 overflow-hidden rounded-xl border border-cem-elevated bg-cem-surface p-4">
        <p className="text-sm text-cem-text">Move the pointer across this box</p>
        <p className="mt-1 text-xs text-cem-secondary">
          The ring follows on a soft spring, a beat behind the pointer.
        </p>
        {enabled && !reduced && (
          <motion.span
            aria-hidden="true"
            style={{ x: sx, y: sy }}
            className="pointer-events-none absolute left-0 top-0 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cem-amber"
          />
        )}
      </div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={SPRING_UI}
        onClick={() => setEnabled((v) => !v)}
        className={`min-h-11 rounded-lg px-4 text-sm font-medium ${
          enabled ? 'border border-cem-elevated bg-cem-surface text-cem-text hover:bg-cem-elevated' : 'bg-cem-amber text-cem-base'
        }`}
      >
        {enabled ? 'Restore the system cursor' : 'Try the target cursor'}
      </motion.button>
      <p className="text-xs text-cem-secondary">
        Opt-in, fine pointers only, off under reduced motion. The custom cursor
        never replaces a visible label: if the ring is the only cue, the
        interface fails accessibility.
      </p>
    </div>
  )
}

/* ----------------------------------------------------------- 34. GradualBlur */
export function GradualBlur() {
  const reduced = usePrefersReducedMotion()

  return (
    <div className="space-y-3">
      <div className="relative h-48 w-80 overflow-hidden rounded-xl border border-cem-elevated bg-cem-surface">
        <div className="h-full overflow-y-auto p-4 text-sm leading-6 text-cem-text">
          {Array.from({ length: 14 }, (_, i) => (
            <p key={i} className="mb-2">
              Line {i + 1} — the edges of this pane are blurred, sharpest at the
              centre. It is a scroll-edge effect, not a divider: content dissolves
              into the chrome instead of being cut by a 1px rule.
            </p>
          ))}
        </div>
        {/* Apple lists animating into and out of blurs among the things Reduce
            Motion removes, so under reduce the pane simply has no blur. */}
        {!reduced && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backdropFilter: 'blur(6px)',
              maskImage: 'radial-gradient(ellipse at center, transparent 34%, black 74%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, transparent 34%, black 74%)',
            }}
          />
        )}
      </div>
      <p className="text-xs text-cem-secondary">
        Apple&apos;s scroll-edge idea: fade content into floating chrome instead
        of drawing a divider. Implemented as a mask over a blur — no gradient
        literals in the source — and dropped entirely under reduced motion, where
        a moving blur is exactly what the setting asks us to remove.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------ 35. ClickSpark */
/* Ported from the reference source. The first port drew the sparks as DOM
   spans, which is why nothing appeared: they were six dots fading out over a
   click, not the reference's eight radial LINE segments drawn on a canvas with
   an easing function and a shrinking line length. Canvas it is. */

const easeOut = (t) => t * (2 - t)

export function ClickSpark({
  sparkSize = 10,
  sparkRadius = 26,
  sparkCount = 8,
  duration = 400,
  extraScale = 1.0,
  colorToken = 'amber',
  label = 'Click anywhere in here',
}) {
  const canvasRef = useRef(null)
  const sparksRef = useRef([])
  const wrapRef = useRef(null)
  const reduced = usePrefersReducedMotion()

  // Resolve the spark colour from the token layer (rule 01a: no hex in src/).
  //
  // THIS USES colors.js AND NOT A LOCAL PROBE, and the reason is the same one
  // that makes holdButton.jsx's header comment dangerous. Tailwind scans source
  // text for COMPLETE class strings; it never evaluates an interpolation. The
  // probe this replaces assembled `bg-cem-` + the token name at runtime, so
  // Tailwind could not see any class in it and generated NONE from this line —
  // it only worked because `bg-cem-amber` happened to exist in the stylesheet
  // from some other file's complete literal. Verified against the built CSS:
  // the coral and sky probe classes are NOT generated, so a caller passing
  // either got a probe resolving to transparent and an invisible spark, with no
  // error anywhere. colors.js keys off a static TOKEN_CLASS map of complete
  // literals, so the classes it names are always generated. Do not inline a
  // probe here again.
  const { color } = useTokenColors({ spark: colorToken })

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    let frame = 0
    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect()
      canvas.width = width
      canvas.height = height
    }
    resize()

    const draw = (timestamp) => {
      frame = requestAnimationFrame(draw)
      if (reduced) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime
        if (elapsed >= duration) return false

        const eased = easeOut(elapsed / duration)
        const distance = eased * sparkRadius * extraScale
        // The segment shrinks as it flies out: that taper is the whole effect.
        const lineLength = sparkSize * (1 - eased)
        const cos = Math.cos(spark.angle)
        const sin = Math.sin(spark.angle)

        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(spark.x + distance * cos, spark.y + distance * sin)
        ctx.lineTo(
          spark.x + (distance + lineLength) * cos,
          spark.y + (distance + lineLength) * sin,
        )
        ctx.stroke()
        return true
      })
    }
    frame = requestAnimationFrame(draw)

    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [color, duration, extraScale, reduced, sparkRadius, sparkSize])

  const spawn = (event) => {
    if (reduced) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const now = performance.now()
    const next = Array.from({ length: sparkCount }, (_, i) => ({
      x,
      y,
      angle: (2 * Math.PI * i) / sparkCount,
      startTime: now,
    }))
    sparksRef.current = [...sparksRef.current, ...next]
  }

  return (
    <div className="space-y-3">
      <div
        ref={wrapRef}
        onClick={spawn}
        className="relative h-24 w-80 cursor-pointer overflow-hidden rounded-xl border border-cem-elevated bg-cem-surface"
      >
        <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0 block h-full w-full" aria-hidden="true" />
        <span className="flex h-full items-center justify-center text-sm font-medium text-cem-text">
          {label}
        </span>
      </div>
      <p className="text-xs text-cem-secondary">
        Canvas, not DOM: eight radial segments fly out on an ease-out and{' '}
        <em>taper as they go</em> — the shrinking line length is what reads as a
        spark. The reference fires on <code className="rounded bg-cem-elevated px-1">click</code>; it
        is kept faithful here and the colour comes from the token layer.
      </p>
    </div>
  )
}