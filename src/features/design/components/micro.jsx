/* eslint-disable react/prop-types */
// micro.jsx — the micro-interactions that are still written here rather than
// ported. Eight of them moved to their own files, because a faithful port of the
// reference source is its own file with its own stylesheet:
//
//   shredder.jsx    the snapshot-and-simulate paper shredder
//   swipeRow.jsx    position-mapped swipe with momentum projection
//   swipeToast.jsx  burn-fuse toast, pausable and throwable
//   glideSelect.jsx imperative pill slider, with pointer scrub
//   peekRating.jsx  preview-then-commit rating
//   jellyRadio.jsx  per-chip spring lump
//   holdButton.jsx  the press-and-hold commit, with its completion gate
//   springCheck.jsx the one-press checkbox: five channels off a single value
//
// WHAT CHANGED FROM THE ORIGINALS, and why (every one is a deliberate
// deviation, not an oversight):
//   * No colour literals. Every fill is a cem-* token, so the visual contract
//     gate (rule 01a/01b/02/06) passes without an allowlist entry.
//   * One accent. Amber marks state and the primary action, nothing else.
//   * Nothing loops on its own. Apple: "Make motion optional… avoid using it as
//     the only way to communicate"; the visual system: "Nothing auto-plays and
//     nothing auto-dismisses". Looping pieces (lattice-loader, pulse-heart,
//     status-mark) are static until asked, and freeze under reduced motion.
//   * Hit targets are 44px and every press answers on pointer-DOWN.

import { useCallback, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import {
  SPRING_MOMENTUM,
  SPRING_SHEET,
  SPRING_SOFT,
  SPRING_UI,
  clamp,
  projectMomentum,
  usePrefersReducedMotion,
} from './motion.js'

/* Shared pressable surface: instant feedback on pointer-down, never on release. */
function PressShell({ className = '', children, ...rest }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      transition={SPRING_UI}
      className={`rounded-lg ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  )
}


/* ----------------------------------------------------------- 6. WarmTooltip */
export function WarmTooltip({ label = 'MIDI output', hint = 'Program change target' }) {
  const [open, setOpen] = useState(false)
  const reduced = usePrefersReducedMotion()

  return (
    <div>
      {/* Only the trigger is the positioning context: `bottom-full` has to resolve
          against the button, not against a wrapper that also holds the caption.
          Centering goes through motion's own `x`, because motion writes an inline
          `transform` every frame and would override a Tailwind translate class. */}
      <div className="relative inline-block">
        <motion.button
          type="button"
          onPointerEnter={() => setOpen(true)}
          onPointerLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="min-h-11 rounded-lg border border-cem-elevated bg-cem-surface px-4 text-sm font-medium text-cem-text hover:bg-cem-elevated"
        >
          {label}
        </motion.button>
        <motion.span
          role="tooltip"
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: open ? 0 : 6, scale: open ? 1 : 0.96 }}
          transition={reduced ? { duration: 0.15 } : SPRING_MOMENTUM}
          style={{ x: '-50%', transformOrigin: 'top center' }}
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 whitespace-nowrap rounded-lg border border-cem-elevated bg-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-text shadow-md"
        >
          {hint}
          <span className="absolute left-1/2 top-full -ml-1 border-4 border-transparent border-t-cem-elevated" />
        </motion.span>
      </div>
      <p className="mt-3 text-xs text-cem-secondary">
        Warm but quiet: amber belongs to state and primary action, so the tooltip
        stays on the elevated surface and opens on focus as well as hover.
      </p>
    </div>
  )
}

/* --------------------------------------------------------- 8. LatticeLoader */
export function LatticeLoader() {
  const [run, setRun] = useState(0)
  const reduced = usePrefersReducedMotion()
  const cells = 36

  return (
    <div className="space-y-3">
      <div className="grid w-64 grid-cols-6 gap-1 rounded-lg border border-cem-elevated bg-cem-surface p-3">
        {Array.from({ length: cells }, (_, i) => {
          const row = Math.floor(i / 6)
          const col = i % 6
          const diagonal = row + col
          const lit = (run + diagonal * 2) % 12 < 4
          return (
            <motion.span
              key={i}
              className={`h-3 rounded-sm ${lit ? 'bg-cem-amber' : 'bg-cem-elevated'}`}
              animate={reduced ? { opacity: lit ? 1 : 0.4 } : { scale: lit ? [1, 0.72, 1] : 1, opacity: lit ? 1 : 0.35 }}
              transition={{ ...SPRING_UI, delay: lit ? (row + col) * 0.02 : 0 }}
            />
          )
        })}
      </div>
      <PressShell
        onClick={() => setRun((n) => n + 1)}
        className="min-h-11 border border-cem-elevated bg-cem-surface px-4 text-sm font-medium text-cem-text hover:bg-cem-elevated"
      >
        Run one pass
      </PressShell>
      <p className="text-xs text-cem-secondary">
        A loader that waits for a click, not a shimmer on a loop: Apple asks for
        content as soon as possible, and nothing in CEMURM auto-plays. The offline
        write queue shows a determinate count instead.
      </p>
    </div>
  )
}

/* --------------------------------------------------------- 11. PulseHeart */
export function PulseHeart({ label = 'Favourite' }) {
  const [beats, setBeats] = useState(0)
  const reduced = usePrefersReducedMotion()

  return (
    <div className="space-y-3">
      <PressShell
        onClick={() => setBeats((n) => n + 1)}
        aria-label={label}
        className="grid h-14 w-14 place-items-center rounded-full border border-cem-elevated bg-cem-surface hover:bg-cem-elevated"
      >
        <motion.svg
          key={beats}
          width="26"
          height="26"
          viewBox="0 0 24 24"
          className="text-cem-amber"
          fill="currentColor"
          initial={reduced ? { scale: 1 } : { scale: 0.8 }}
          animate={reduced ? { scale: 1 } : { scale: [0.8, 1.22, 0.96, 1.1, 1] }}
          transition={reduced ? { duration: 0.15 } : { duration: 0.7, times: [0, 0.2, 0.5, 0.75, 1] }}
          aria-hidden="true"
        >
          <path d="M12 21s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6.6 5.4 5.4 0 0 1 21.3 12C19 16.4 12 21 12 21z" />
        </motion.svg>
      </PressShell>
      <p className="text-xs text-cem-secondary">
        One double-beat per press, keyed so each click replays. The original loops
        forever; Apple flags continuous oscillation near 0.2Hz as a comfort
        problem, so the beat is an event, not an ambience.
      </p>
    </div>
  )
}

/* --------------------------------------------------------- 12. BellToggle */
export function BellToggle({ initial = 0 }) {
  const [count, setCount] = useState(initial)
  const [ring, setRing] = useState(0)
  const reduced = usePrefersReducedMotion()

  return (
    <div className="space-y-3">
      <PressShell
        onClick={() => {
          setCount((n) => (n === 0 ? 3 : n))
          setRing((n) => n + 1)
        }}
        aria-label="Notifications"
        className="relative grid h-14 w-14 place-items-center rounded-full border border-cem-elevated bg-cem-surface hover:bg-cem-elevated"
      >
        <motion.svg
          key={ring}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-cem-text"
          animate={reduced ? { rotate: 0 } : { rotate: [0, -14, 12, -8, 5, 0] }}
          transition={reduced ? { duration: 0.15 } : { duration: 0.65 }}
          aria-hidden="true"
        >
          <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 19a2 2 0 004 0" />
        </motion.svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-cem-amber px-1 text-[10px] font-bold text-cem-base">
            {count}
          </span>
        )}
      </PressShell>
      <p className="text-xs text-cem-secondary">
        Motion fires on the causal frame — the toggle itself — and the badge
        carries the count, so the meaning never depends on the swing.
      </p>
    </div>
  )
}

/* -------------------------------------------------------- 13. StatusMark */
export function StatusMark({ state = 'online' }) {
  const reduced = usePrefersReducedMotion()
  const pulse = useSpring(1, SPRING_UI)
  const scale = useTransform(pulse, [1, 1.6], [1, 1])
  const [syncing, setSyncing] = useState(state === 'syncing')

  const copy = {
    online: 'Online — reads cached',
    offline: 'Offline — writes queued',
    syncing: 'Syncing 4 writes',
  }[state]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg border border-cem-elevated bg-cem-surface px-4 py-3">
        <span className="relative grid h-3 w-3 place-items-center">
          {syncing && (
            <motion.span
              className="absolute inset-0 rounded-full bg-cem-amber/40"
              style={{ scale }}
              animate={reduced ? { opacity: 0.6 } : { opacity: [0.7, 0, 0.7] }}
              transition={reduced ? { duration: 0.15 } : { duration: 1.4, repeat: Infinity }}
            />
          )}
          <span
            className={`relative h-3 w-3 rounded-full ${
              state === 'offline' ? 'bg-cem-secondary' : 'bg-cem-amber'
            }`}
          />
        </span>
        <span className="text-sm text-cem-text">{copy}</span>
      </div>
      <PressShell
        onClick={() => setSyncing((v) => !v)}
        className="min-h-11 border border-cem-elevated bg-cem-surface px-4 text-sm font-medium text-cem-text hover:bg-cem-elevated"
      >
        {syncing ? 'Pause sync indicator' : 'Play sync indicator'}
      </PressShell>
      <p className="text-xs text-cem-secondary">
        Dot plus a ring plus a sentence. The only looping piece in the set, and it
        is opt-in and frozen under reduced motion.
      </p>
    </div>
  )
}

/* 14. HoldButton left this file: it is now a faithful port of the reference
   source, in holdButton.jsx, with the reference's own stylesheet in
   reference.css. What it replaced here was an approximation — a 900ms rAF
   against a spring, no done state, no keyboard path and no tap/hold
   distinction — so it is a replacement, not a deletion. The barrel re-exports
   it from the new file; there is exactly one HoldButton export. */