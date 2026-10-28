/* eslint-disable react/prop-types -- the shape is one boolean; there are no
   propTypes anywhere in src/ (see FeedbackForm.jsx:1). */

import { useState } from 'react'
import { useScroll, useMotionValueEvent } from 'motion/react'
import { landing } from '../../../content/landing.es.js'

// APPLE §12, material + scroll edge. This is the only functional-layer material
// on the page, so it gets the strongest blur and the scrim below it; the rest of
// the landing carries no second chrome surface.
//
// §14, THREE INDEPENDENT SIGNALS, AND WHERE EACH ONE LIVES.
//   prefers-reduced-transparency -> raise the fill toward opaque AND drop the
//     blur.
//   prefers-contrast: more -> near-solid fill plus a defined contrasting edge.
//   prefers-reduced-motion -> collapses globally in index.css and per component;
//     the header itself is static apart from the materialize-on-load transition.
//
// NONE of the two is declared here. Both used to be, as a bracket-wrapped media
// condition and an `@supports` condition used as Tailwind variant prefixes on this
// very constant. Tailwind 3.4 does not treat a parenthesised media condition as a
// variant: it emitted a rule whose escaped selector carries the whole thing
// verbatim, so it can only match an element whose class attribute contains that
// string literally, and nothing renders it. The `@supports` twin was worse: it came
// out with no `@supports` block around it at all. `cem-material` in
// src/app/index.css is real CSS inside real at-rules, and this element carries the
// class. Do not move either signal back into a className.
//
// DO NOT REPRODUCE EITHER CLASS STRING IN A COMMENT HERE. Tailwind's scanner is a
// regex over raw file text with no notion of a comment, so a comment that quotes
// the broken variant verbatim keeps the broken rule in the built stylesheet. That
// is not theoretical: this paragraph's first draft named the class and the rule
// survived the fix that removed it from the constant. Describe the shape instead.
//
// FILL. The header is sticky, so page content scrolls beneath it at every viewport,
// and the sections it floats over are not all the same fill. The fill is the only
// thing that can carry the text's contrast across that moving backdrop, and it
// has to clear the floor against the WORST thing under it, not the average one.
// cem.base/85 is the smallest step that carries cem.secondary-elevated clear of the
// 4.5:1 floor with real margin against near-white text passing beneath (see index.css
// for the measured composite). cem.secondary-elevated on the nav, because /85 alone
// leaves cem.secondary at the floor rather than clear of it.
//
// ONE AMBER PRIMARY PER VIEWPORT. The hero CTA is the primary amber pill; this one
// is the ghost/outline variant, reachable after a scroll past the hero but not
// competing with the hero's primary. When the hero scrolls out of view the header
// CTA can be promoted to a solid amber — gated by the `heroInView` prop the page
// passes.
const MATERIAL = 'cem-material bg-cem-base/85 backdrop-blur-2xl backdrop-saturate-150'

// Mobile dock treatment. On a phone the header becomes a dock: brand left, nav as
// compact dock centre, CTA right. The dock is a row that wraps to its own band
// below the brand on the smallest widths, so every anchor stays reachable without a
// disclosure this slice has no budget for. Above the dock breakpoint the header is
// the classic slim bar.
const DOCK = 'sm:flex sm:items-center sm:gap-x-6'

// Press feedback. Apple §1, respond on pointer-down. Emil's baseline:
// active:scale-[0.97] over 150ms ease-out. This is the one interaction where
// latency is most visible, so 200ms has no place here.
const PRESS = 'transition-transform duration-150 ease-out active:scale-[0.97]'

// ONE TRANSITION DECLARATION FOR A CONTROL THAT BOTH FILLS AND PRESSES.
//
// The header CTA used to carry a transition on every property here as well, on top
// of PRESS. Those are two `transition-property` declarations on the same element at
// equal specificity, and Tailwind emits `.transition-transform` later in the sheet,
// so it won: the hover fill snapped and the press scale animated. One explicit
// property list removes the race and drops the wildcard, which is also Emil's
// checklist entry.
//
// Press stays on his 150ms baseline, so the hover fill moves from 200ms to 150ms.
// That is inside his under-300ms band for UI and it is the only way to have one
// duration on one element; splitting it would mean a wrapper this control does not
// have. The alternative, keeping the wildcard, is the defect.
//
// The wildcard class is NOT named in these comments on purpose. Tailwind's scanner
// reads raw file text and does not know a comment from a className, so naming it
// would keep the rule in the built stylesheet with nothing using it.
const PRESS_FILL = 'transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]'

// Focus ring. Apple §7.5: 2px solid cem.text, offset 2, :focus-visible only, never
// the accent — a visitor has to tell "this has keyboard focus" from "this is the
// current song / current tab" at a glance.
const FOCUS =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cem-text ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-cem-base'

export default function Header({ heroInView = false }) {
  // THE SCROLLED SIGNAL IS MOTION'S, NOT A RAW LISTENER. This used to be
  // `window.addEventListener('scroll', () => setScrolled(window.scrollY > 8))`, which
  // design-taste-frontend §5.D bans outright and names `useScroll` as the sanctioned
  // replacement. `useScroll` owns the subscription and hands back a motion value;
  // `useMotionValueEvent` reads it on Motion's frame, so the callback is off the
  // scroll hot path and no measurement is taken here at all.
  //
  // THE GUARD IS WHAT ACTUALLY MATTERS. A boolean that flips at 8px of scroll flips
  // twice over a whole page: React renders twice instead of once per scroll event,
  // and the updater returns the identical value on every intermediate call, so React
  // bails out of the re-render entirely. Without it, any scroll signal has to be
  // debounced by hand, and a hand-rolled debounce is the same class of bug.
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)

  useMotionValueEvent(scrollY, 'change', (y) => {
    const next = y > 8
    setScrolled((was) => (was === next ? was : next))
  })

  // The hero's primary amber pill is the only full-saturation amber CTA on the page
  // between the top of the hero and the top of the registro section. While that band
  // is on screen, the header's CTA is the ghost variant so the two amber CTAs never
  // sit on screen together. Once the hero is gone, the header CTA can be the solid
  // amber pill.
  const headerCtaSolid = !heroInView

  return (
    <header
      className={`sticky top-0 z-20 ${MATERIAL} ${scrolled ? 'border-b border-cem-text/10' : ''}`}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 md:px-6">
        {/* Logo + brand. A span, not a link: on a marketing page the logo is identity,
            not a jump to the top of a page the visitor is already at. Tracking is size-
            specific: this is text-lg at 18px, so slightly positive tracking is wrong and
            neutral tracking is right for small uppercase with wide letterforms. Negative
            tracking belongs on the display wordmark in Hero, not here. */}
        <span className="order-1 text-lg font-semibold tracking-normal text-cem-amber">
          {landing.brand}
        </span>

        {/* Nav. On desktop it sits between brand and CTA; on mobile it drops into the
            dock band below. The order utilities put it back between brand and CTA from
            sm up so the visual order matches the DOM order on desktop. */}
        <nav className={`order-3 flex w-full flex-wrap items-center gap-x-6 ${DOCK} sm:order-2 sm:w-auto`}>
          {landing.nav.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`inline-flex min-h-12 items-center text-sm font-medium text-cem-secondary-elevated duration-200 hover:text-cem-text ${PRESS} ${FOCUS}`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* CTA. Ghost outline while the hero's primary amber pill is on screen; solid
            amber pill once the hero has scrolled out. Both reach the same destination,
            both are the same action, only the treatment moves. */}
        <a
          href={landing.cta.href}
          className={`order-2 inline-flex min-h-12 items-center rounded-full px-5 text-sm font-semibold text-cem-text hover:bg-cem-text/10 ${PRESS_FILL} ${FOCUS} ${
            headerCtaSolid
              ? 'bg-cem-amber text-cem-base hover:bg-cem-amber/90'
              : 'border border-cem-text/20 bg-transparent hover:bg-cem-text/10'
          } sm:order-3`}
        >
          {landing.cta.label}
        </a>
      </div>

      {/* Scroll edge, not a hard divider. Painted just below the header's own box so it
          travels with the header; pointer-events none so it cannot intercept clicks meant
          for the nav beneath. Hidden entirely when the platform asks for reduced
          transparency and when the browser has no backdrop-filter at all, because there is
          nothing to fade into in either case. */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-b from-cem-base/70 to-cem-base/0"
        aria-hidden="true"
        style={{ pointerEvents: 'none' }}
      />
    </header>
  )
}
