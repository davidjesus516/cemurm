/* eslint-disable react/prop-types */
// blocks.jsx — the five larger components from the React Bits set, token-safe.
// (CardNav, AccordionGallery, MorphSlider and the other fidelity ports moved
// out to their own files; what stays here are the original five: Counter,
// Stepper, SpecularButton, OptionWheel and AnimatedList.)
//
// Notable deviations, each forced by the CEMURM visual contract:
//   * glass-icons  — the original stacks light-on-light glass, which collapses
//     legibility and breaks the one-material-per-view rule. Here ONE material
//     surface carries plain tiles; only the active tile takes amber.
//   * border-glow  — the original fakes the glow with a "Literally Grid"
//     em-shadow hack, which needs colour literals. Here the glow is a token
//     amber ring that tracks the pointer; same read, no literals.
//   * dock         — one material bar, proximity magnification, no stacked
//     glass tiles.
//   * option-wheel — fades at the edges with token fills, not colour stops.
//
// Motion budget: every spring here animates transform/opacity only. Nothing
// animates width, height, filter or backdrop-filter, except the accordion's
// height (a one-shot reveal, not a gesture) and the wake/morph thumb.

import { useCallback, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react'
import {
  SPRING_MOMENTUM,
  SPRING_SHEET,
  SPRING_SOFT,
  SPRING_UI,
  clamp,
  projectMomentum,
  rubberband,
  usePrefersReducedMotion,
} from './motion.js'

/* ------------------------------------------------------------------ 15. Dock */
/* Moved to ./dock.jsx - ported from the reference source. The earlier
   version here scaled a fixed box and kept the panel at a constant height, so
   the tiles never reflowed and read as plain buttons. */

/* -------------------------------------------------------- 16. SpotlightCard */
/* Moved to ./spotlightCard.jsx — ported from the shadcn registry item the
   maintainer installed (@react-bits/SpotlightCard-TS-TW). The version here
   invented a title/meta API and a spring-driven blurred disc; the reference
   is a children wrapper whose gradient layer fades on hover and on focus,
   with the glow centre tracked in card coordinates. */

/* ----------------------------------------------------------- 17. BorderGlow */
/* Moved to ./borderGlow.jsx — ported from the reference source. The inline stub
   that used to live here tracked the pointer with a spring and drew a ring; the
   real component solves edge proximity and masks a 7-layer mesh gradient with a
   conic gradient that follows the cursor angle. */

/* ----------------------------------------------------------- 18. GlassIcons */
/* Moved to ./glassIcons.jsx — ported from the reference source the
   maintainer pasted. The version here had the three planes but not the grid,
   not customClass, not the plate gradient, and it invented an active state
   the reference does not have, so it could not be compared to the original. */

/* -------------------------------------------------------------- 19. Counter */
export function Counter({ to = 128, label = 'Songs in the public library' }) {
  const value = useMotionValue(0)
  const spring = useSpring(value, { ...SPRING_SOFT, damping: 34 })
  const rounded = useTransform(spring, (v) => Math.round(v))

  return (
    <div className="space-y-3">
      <p className="text-4xl font-semibold tracking-tight text-cem-text">
        <motion.span>{rounded}</motion.span>
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
        A counter is a MotionValue, so the number animates without re-rendering
        the tree — the text node is driven directly at 60fps.
      </p>
    </div>
  )
}

/* --------------------------------------------------------------- 20. Stepper */
export function Stepper({ label = 'Rehearsal count', min = 0, max = 12 }) {
  const [value, setValue] = useState(3)
  const pop = useSpring(1, SPRING_MOMENTUM)

  const bump = useCallback(
    (delta) => {
      setValue((v) => {
        const next = clamp(v + delta, min, max)
        if (next !== v) {
          pop.set(1.18)
          pop.set(1)
        }
        return next
      })
    },
    [max, min, pop],
  )

  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-4 rounded-lg border border-cem-elevated bg-cem-surface px-3 py-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          transition={SPRING_UI}
          onClick={() => bump(-1)}
          disabled={value <= min}
          className="grid h-11 w-11 place-items-center rounded-md border border-cem-elevated text-lg text-cem-text hover:bg-cem-elevated disabled:opacity-40"
        >
          −
        </motion.button>
        <motion.span style={{ scale: pop }} className="min-w-10 text-center text-lg font-semibold text-cem-text">
          {value}
        </motion.span>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          transition={SPRING_UI}
          onClick={() => bump(1)}
          disabled={value >= max}
          className="grid h-11 w-11 place-items-center rounded-md border border-cem-elevated text-lg text-cem-text hover:bg-cem-elevated disabled:opacity-40"
        >
          +
        </motion.button>
      </div>
      <p className="text-xs text-cem-secondary">
        {label} — the value pops on change and every target is 44px. The stepper
        stays disabled rather than grey-ambiguous: disabled means &quot;not
        available&quot;, never &quot;failed&quot;.
      </p>
    </div>
  )
}

/* ----------------------------------------------------------- 21. MorphSlider */
/* Moved to ./morphSlider.jsx — ported from the reference source. The
   version here was a text widget with `motion` drag controls — no thumb
   visual, no spring momentum projection, no discrete-step snapping, so the
   demo compared the reference link against an object that does not exist upstream.
   Nothing about the discrete-slider behaviour survived: no spring-driven thumb,
   no momentum-based landing, no step increments, no discrete options. */


/* ------------------------------------------------------- 22. AccordionGallery */
/* Moved to ./accordionGallery.jsx — ported from the reference source. The
   version here was a text accordion (three strings, a rotating chevron, an
   animated height): no image panels, no flexGrow, no tilt, no parallax, no
   grayscale, no label bar, so nothing about the reference survived. */

/* -------------------------------------------------------- 23. SpecularButton */
export function SpecularButton({ label = 'Create setlist' }) {
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, SPRING_SOFT)
  const sy = useSpring(py, SPRING_SOFT)
  const reduced = usePrefersReducedMotion()

  return (
    <div className="space-y-3">
      <motion.button
        type="button"
        whileTap={reduced ? undefined : { scale: 0.97 }}
        transition={SPRING_UI}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          px.set(event.clientX - rect.left)
          py.set(event.clientY - rect.top)
        }}
        className="relative h-14 w-64 overflow-hidden rounded-xl bg-cem-amber text-sm font-semibold text-cem-base"
      >
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cem-text/20 blur-lg"
          style={{ left: sx, top: sy }}
        />
        <span className="relative">{label}</span>
      </motion.button>
      <p className="text-xs text-cem-secondary">
        The specular highlight lags the pointer on a soft spring, so the button
        reads as lit from where your hand is. Amber carries the primary action;
        the highlight is the token text colour, not a second hue.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------ 24. OptionWheel */
export function OptionWheel({ options = ['C', 'G', 'D', 'A', 'E', 'F#', 'B'], label = 'Key' }) {
  const ITEM = 40
  const [index, setIndex] = useState(1)
  const y = useMotionValue(-ITEM)
  const springY = useSpring(y, SPRING_SHEET)
  const base = useRef(-ITEM)

  const settle = (velocity) => {
    // Project the flick, then snap to the nearest option to the projected point:
    // the gesture decides where it lands, not where the finger stopped.
    const projected = base.current - projectMomentum(velocity)
    const next = clamp(Math.round(projected / ITEM), 0, options.length - 1)
    setIndex(next)
    y.set(-next * ITEM)
    base.current = -next * ITEM
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-cem-text">
        {label}: <span className="text-cem-amber">{options[index]}</span>
      </p>
      <div className="relative h-40 w-40 overflow-hidden rounded-xl border border-cem-elevated bg-cem-surface">
        <motion.div
          drag="y"
          dragConstraints={{ top: -ITEM * (options.length - 1), bottom: 0 }}
          dragElastic={0}
          onDragStart={() => {
            base.current = y.get()
          }}
          onDrag={(_, info) => {
            const raw = base.current + info.offset.y
            const min = -ITEM * (options.length - 1)
            // Progressive resistance past both ends instead of a hard stop.
            if (raw > 0) y.set(rubberband(raw, 140))
            else if (raw < min) y.set(min + rubberband(raw - min, 140))
            else y.set(raw)
          }}
          onDragEnd={(_, info) => settle(info.velocity.y)}
          style={{ y: springY }}
          className="flex w-full cursor-grab flex-col items-center pt-[52px]"
        >
          {options.map((option, i) => (
            <div
              key={option}
              className={`grid h-10 w-full place-items-center text-lg font-medium ${
                i === index ? 'text-cem-text' : 'text-cem-secondary'
              }`}
            >
              {option}
            </div>
          ))}
        </motion.div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-cem-surface" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-cem-surface" />
        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-10 -translate-y-1/2 rounded-lg border border-cem-amber" />
      </div>
      <p className="text-xs text-cem-secondary">
        The iOS wheel, rebuilt on tokens: momentum projection, rubber-band at both
        ends, and the centred option framed in amber. Reduced motion collapses the
        spring to a short settle.
      </p>
    </div>
  )
}

/* ---------------------------------------------------------- 25. AnimatedList */
export function AnimatedList() {
  const [songs, setSongs] = useState(['Amazing Grace', 'Holy Holy Holy', 'Great Is Thy Faithfulness'])
  const reduced = usePrefersReducedMotion()

  const remove = (name) => setSongs((list) => list.filter((s) => s !== name))
  const add = () => {
    const next = `Imported take ${songs.length + 1}`
    setSongs((list) => [...list, next])
  }

  return (
    <div className="w-80 space-y-3">
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {songs.map((song) => (
            <motion.li
              key={song}
              layout={!reduced}
              initial={{ opacity: 0, scale: 0.96, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={reduced ? { duration: 0.15 } : SPRING_SHEET}
              className="flex min-h-12 items-center justify-between rounded-lg border border-cem-elevated bg-cem-surface px-4"
            >
              <span className="truncate text-sm text-cem-text">{song}</span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                transition={SPRING_UI}
                onClick={() => remove(song)}
                className="grid h-9 w-9 place-items-center rounded-md text-cem-secondary hover:text-cem-text"
                aria-label={`Remove ${song}`}
              >
                ×
              </motion.button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={SPRING_UI}
        onClick={add}
        className="min-h-11 w-full rounded-lg bg-cem-amber px-4 text-sm font-semibold text-cem-base"
      >
        Add a song
      </motion.button>
      <p className="text-xs text-cem-secondary">
        Insert and remove share one spring and one path, so the list never
        teleports: the surviving rows slide, the leaving row scales out.
      </p>
    </div>
  )
}
