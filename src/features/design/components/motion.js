// Shared motion vocabulary for the /design component set.
//
// WHY THIS FILE: the apple-design skill turns on two parameters that CSS
// transitions do not expose — damping ratio and response — plus three physics
// helpers (rubber-band, momentum projection, velocity handoff). Writing them
// once keeps every component speaking the same physical language, and it is the
// one place to change that language.
//
// TOKEN SAFETY: this file is scanned by scripts/check-visual-contract.sh rule
// 01a, so it carries no colour literals at all. Springs animate transforms and
// opacity only — never width, height, filter or backdrop-filter.
//
// SPRING TABLE (apple-design §4):
//   SPRING_UI         damping ~1.0, response ~0.35s — default for anything a
//                     finger touches. Critically damped: settles, does not bounce.
//   SPRING_MOMENTUM   damping ~0.7, response ~0.4s — only after a gesture that
//                     carried momentum (a flick, a throw, a release).
//   SPRING_SHEET      damping ~0.8, response ~0.3s — drawers and sheets.

import { useEffect, useState } from 'react'

/** Default UI spring: critically damped, no overshoot. */
export const SPRING_UI = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }

/** Softer spring for large surfaces that need to arrive, not snap. */
export const SPRING_SOFT = { type: 'spring', stiffness: 300, damping: 30, mass: 1 }

/** Under-damped. Only legal where a flick preceded it — overshoot elsewhere reads wrong. */
export const SPRING_MOMENTUM = { type: 'spring', stiffness: 240, damping: 22, mass: 1 }

/** Sheet/drawer spring: Apple's drawer row is damping 0.8 / response 0.3. */
export const SPRING_SHEET = { type: 'spring', stiffness: 340, damping: 26, mass: 1 }

export const EASE_OUT = [0.2, 0, 0, 1]
export const EASE_STANDARD = [0.4, 0, 0.2, 1]

/** Stage Mode ceiling from the visual system: a song change resolves in 90ms. */
export const STAGE_CEILING_S = 0.09

/**
 * Reduced motion is not "no feedback" — it is the gentler equivalent. Callers
 * use this to swap springs for opacity cross-fades and to freeze loops, never
 * to delete the feedback itself.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return reduced
}

/**
 * Soft boundary. The further past the limit, the less the element follows:
 * real things slow down before they stop. A hard stop reads as "frozen";
 * progressive resistance reads as "responsive, and there is nothing more here".
 */
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

/**
 * Momentum projection — Apple's exponential-decay form from Designing Fluid
 * Interfaces, NOT the physics-textbook v²/(2·decel). `rate` 0.998 is normal
 * scroll feel; 0.99 is snappier.
 */
export function projectMomentum(velocity, rate = 0.998) {
  return (velocity / 1000) * rate / (1 - rate)
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Velocity handoff. Decides commit vs. reverse from the SIGN of the release
 * velocity, not from where the finger happened to be — that is what makes a
 * flick feel like a throw rather than a snap.
 */
export function shouldCommit(velocity, offset, threshold) {
  return Math.abs(velocity) > 450 ? velocity < 0 : offset < -threshold
}