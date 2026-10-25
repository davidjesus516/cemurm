/* eslint-disable react/prop-types -- the shape is one boolean (panelRef) and
   there are no propTypes anywhere in src/ (see FeedbackForm.jsx:1). */

import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { landing } from '../../../content/landing.es.js'
import ClickSpark from './ClickSpark.jsx'
import GlassIcon from './GlassIcon.jsx'
import DeviceFrame from './DeviceFrame.jsx'

// APPLE §12 — the panel is the one place on the page where a translucent functional surface
// is justified outside the header: it is a bright material floating over the dark section, and
// the depth it carries is the point. The rest of the section is dark; only the panel is the
// material. There is no background wash: the alpha gradient this used to declare never
// painted (off-scale `to-` stop emits no CSS, layer at -z-10 behind the opaque bg).

// The one accent. The active panel has a glow layer (bg-cem-amber/10) behind it, not a
// box-shadow with rgba — that keeps the source free of raw colour functions (gate 01a). The
// inactive panels are dimmer glass (same material, lower alpha), not a new colour.

// Motion. The panel set is three cards that cross-fade and slide laterally on change, with the
// active one lifting and the others receding. Critically damped springs (Apple default) so the
// change feels decisive, not bouncy. Reduced motion collapses to a simple opacity swap.

const FOCUS =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cem-text ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-cem-base'

const PRESS = 'transition-transform duration-150 ease-out active:scale-[0.97]'

// THE DOCK (mobile). On a phone the Stage Bus nav is a dock: the three view labels as compact
// dock items, with the active one highlighted in amber. Same visual language as the header dock,
// same radius, same spacing — it is the same control pattern reused for a different target.

export default function StageBus() {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const panelRef = useRef(null)

  // Spark gating — same gate as the repo's existing ClickSpark call sites.
  const canSpark =
    reduce === false &&
    typeof window !== 'undefined' &&
    window.matchMedia?.('(hover: hover) and (pointer: fine)').matches !== false

  const current = landing.stageBus.views[active]

  return (
    <section
      id="stage-bus"
      ref={panelRef}
      data-stage-bus
      className="border-t border-cem-text/10 px-4 py-20 md:px-6 md:py-28 bg-cem-base overflow-hidden"
    >
      <div className="relative mx-auto max-w-7xl">
        {/* Title. No eyebrow: one per three sections, and section 3 is mid-run. */}
        <div className="mb-6 max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tighter leading-[1.05] text-cem-text md:text-5xl">
            {landing.stageBus.title}
          </h2>
        </div>

        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-cem-secondary">
          {landing.stageBus.intro}
        </p>

        {/* THE PANEL ROW. Three DeviceFrame screens, the active one lifted with a glow layer
            (bg-cem-amber/10) behind it and the others dimmed. The panel is a bright translucent
            surface (the one material justified here); the depth is the point. */}
        <div className="mt-12 flex flex-col items-center gap-6 md:flex-row md:items-end md:gap-8">
          {/* The three view panels. */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {landing.stageBus.views.map((view, index) => {
              const isActive = index === active
              return (
                <motion.div
                  key={view.id}
                  className={`relative ${isActive ? 'z-10' : 'z-0'}`}
                  animate={reduce ? { opacity: isActive ? 1 : 0.4 } : {
                    opacity: isActive ? 1 : 0.4,
                    scale: isActive ? 1 : 0.96,
                    y: isActive ? 0 : 6,
                  }}
                  transition={{ duration: reduce ? 0 : 0.25, ease: [0.23, 1, 0.32, 1] }}
                >
                  {/* Glow layer behind the active panel — bg-cem-amber/10, not a box-shadow with
                      rgba (gate 01a). */}
                  {isActive && (
                    <div
                      className="absolute -inset-2 rounded-cem-xl bg-cem-amber/10"
                      aria-hidden="true"
                    />
                  )}
                  <DeviceFrame anchor="top">
                    <ViewTile view={view} index={index} />
                  </DeviceFrame>
                </motion.div>
              )
            })}
          </div>

          {/* THE DOCK — mobile view navigation. On a phone the three view labels are a dock;
              on desktop the same three labels are a row of buttons, and the carousel arrows are
              the primary control. */}
          <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-6">
            {/* Left / right arrows — desktop primary control. */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActive((active + 1) % landing.stageBus.views.length)}
                className={`inline-flex h-12 w-12 items-center justify-center rounded-full border border-cem-text/20 bg-cem-surface text-cem-text hover:bg-cem-elevated hover:border-cem-text/30 ${PRESS} ${FOCUS}`}
                aria-label="Siguiente vista"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() =>
                  setActive((active - 1 + landing.stageBus.views.length) % landing.stageBus.views.length)
                }
                className={`inline-flex h-12 w-12 items-center justify-center rounded-full border border-cem-text/20 bg-cem-surface text-cem-text hover:bg-cem-elevated hover:border-cem-text/30 ${PRESS} ${FOCUS}`}
                aria-label="Vista anterior"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
            </div>

            {/* The dock — mobile. Plain buttons, not a tablist: all three frames render at
                once, so there is no tabpanel for role="tab" to point at. Selection is
                aria-pressed, which a button may honestly carry. */}
            <div className="flex w-full justify-center gap-2 sm:hidden">
              {landing.stageBus.views.map((view, index) => (
                <button
                  key={view.id}
                  type="button"
                  aria-pressed={index === active}
                  onClick={() => setActive(index)}
                  className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-cem-text/10 bg-cem-surface text-xs font-medium ${PRESS} ${FOCUS} ${
                    index === active
                      ? 'bg-cem-amber/20 border-cem-amber/50 text-cem-amber'
                      : 'text-cem-secondary hover:text-cem-text hover:border-cem-text/20'
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>

            {/* Desktop row — the same three labels as buttons between the arrows. Plain
                buttons, for the dock's reason. */}
            <div className="hidden items-center gap-2 sm:flex">
              {landing.stageBus.views.map((view, index) => (
                <button
                  key={view.id}
                  type="button"
                  aria-pressed={index === active}
                  onClick={() => setActive(index)}
                  className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-cem-sm border-b-2 px-4 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cem-text focus-visible:ring-offset-2 focus-visible:ring-offset-cem-base ${
                    index === active
                      ? 'border-cem-amber text-cem-amber'
                      : 'border-transparent text-cem-secondary hover:text-cem-text'
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>

            {/* The spark. Mounted only on hover devices with motion not reduced, gated the same
                way the repo's existing ClickSpark call sites are. The spark sits behind the dock
                / tab row so the burst comes from the control the visitor just touched. */}
            {canSpark && (
              <ClickSpark
                sparkColor="bg-cem-amber"
                sparkSize={9}
                sparkRadius={16}
                sparkCount={7}
                duration={380}
                extraScale={1.1}
              >
                <div className="flex h-12 w-full justify-center">
                  {landing.stageBus.views.map((view) => (
                    <span key={view.id} className="sr-only">
                      {view.label}
                    </span>
                  ))}
                </div>
              </ClickSpark>
            )}
          </div>
        </div>

        {/* The one-line caption under the current view. */}
        <p className="mt-4 text-center text-sm text-cem-secondary">{current.blurb}</p>
      </div>
    </section>
  )
}

// One view tile inside a DeviceFrame. A glass tile (icon + label + blurb) so the three frames
// read as screens with content, not as empty black boxes. The icon tint walks the three names
// GlassIcon declares (amber / amberLight / secondary), so the three views differ while the
// material stays one. This call site was always honest about the rotation, and it is the
// reference for the other three.
function ViewTile({ view, index }) {
  const colors = ['amber', 'amberLight', 'secondary']
  return (
    <div className="flex h-full flex-col items-center justify-center p-4 text-center">
      <GlassIcon kind={['chart', 'roles', 'projection'][index]} color={colors[index]} />
      <span className="mt-3 text-sm font-medium text-cem-text">{view.label}</span>
      <span className="mt-1 text-xs text-cem-secondary">{view.blurb}</span>
    </div>
  )
}
