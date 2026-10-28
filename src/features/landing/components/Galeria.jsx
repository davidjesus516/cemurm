import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { landing } from '../../../content/landing.es.js'
import VideoBG from './VideoBG.jsx'
import GlassIcon from './GlassIcon.jsx'
import ClickSpark from './ClickSpark.jsx'

// Dark section, flat (gate 01a). The alpha gradient this used to declare never painted: its
// off-scale `to-` stop emits no CSS, and the layer sat at -z-10 behind the opaque bg.

// Accordion. Each item expands to reveal its media (video or image placeholder) and its label.
// The active panel has a glow layer (bg-cem-amber/10) behind it and a border-cem-amber/30, not a
// box-shadow with rgba — that keeps the source free of raw colour functions (gate 01a). The
// inactive items are dimmer glass. The whole thing cross-fades on change (critically damped
// spring, Apple default), with reduced motion collapsing to a simple swap.

// Spark on expand — mounted only where a real pointer exists and motion is not reduced, same
// gate as the repo's existing ClickSpark call sites. Spark color is cem.amber, resolved from the
// token class, never a literal.

const FOCUS =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cem-text ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-cem-base'

// ONE TRANSITION DECLARATION FOR A CONTROL THAT BOTH FILLS AND PRESSES. The
// trigger used to carry a transition on every property beside a second
// `transition-transform` utility, which is two `transition-property`
// declarations at equal specificity; Tailwind emits `.transition-transform`
// later, so the hover fill snapped. One explicit property list removes the
// race and drops the wildcard. Press keeps his 150ms baseline, so the fill
// moves from 200ms to 150ms, still inside the under-300ms UI band.
// The wildcard class is deliberately not named in this comment: Tailwind scans
// comments, so naming it would leave the rule in the built stylesheet unused.
const PRESS_FILL = 'transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]'

// The icon rotation, built from the four names GlassIcon declares and nothing else.
// `violet` used to sit in this array and is not a token at all; the rest were declared
// nowhere GlassIcon could see, so all six panels resolved to amber. Four names over six
// panels means two pairs repeat, and that is the honest result on a one-accent page: the
// material is one, the tint varies between the accent at two strengths and two greys.
const COLORS = ['amber', 'amberLight', 'secondary', 'secondaryElevated']

export default function Galeria() {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(null)
  const [sparkPos, setSparkPos] = useState({ x: 0, y: 0 })

  const canSpark =
    reduce === false &&
    typeof window !== 'undefined' &&
    window.matchMedia?.('(hover: hover) and (pointer: fine)').matches !== false

  const handleOpen = (index, e) => {
    setOpen(index)
    if (canSpark && e?.clientX != null) {
      setSparkPos({ x: e.clientX, y: e.clientY })
    }
  }

  return (
    <section
      id="galeria"
      className="border-t border-cem-text/10 px-4 py-20 md:px-6 md:py-28 bg-cem-base overflow-hidden"
    >
      <div className="relative mx-auto max-w-7xl">
        {/* Eyebrow + title. Section 4 opens the second eyebrow run (1, 4, 7). */}
        <div className="mb-6 max-w-3xl">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.18em] text-cem-secondary">
            {landing.galeria.eyebrow}
          </p>
          <h2 className="text-3xl font-semibold tracking-tighter leading-[1.05] text-cem-text md:text-5xl">
            {landing.galeria.title}
          </h2>
        </div>

        {/* The accordion. */}
        <div className="mt-12 space-y-3">
          {landing.galeria.items.map((item, index) => {
            const isActive = open === index
            const color = COLORS[index % COLORS.length]

            return (
              <div key={item.id} className={`relative border border-cem-text/10 rounded-cem-lg bg-cem-surface/60 overflow-hidden ${isActive ? 'border-cem-amber/30' : ''}`}>
                {/* Glow layer behind the active panel — bg-cem-amber/10, not a box-shadow with
                    rgba (gate 01a). */}
                {isActive && (
                  <div className="absolute -inset-2 rounded-cem-lg bg-cem-amber/10" aria-hidden="true" />
                )}

                {/* Header — the trigger. */}
                <button
                  type="button"
                  onClick={(e) => handleOpen(index, e)}
                  className={`flex w-full items-center gap-4 px-6 py-5 text-left hover:bg-cem-surface/90 ${PRESS_FILL} ${FOCUS} ${isActive ? 'bg-cem-surface/90' : ''} relative z-10`}
                  aria-expanded={isActive}
                  aria-controls={`galeria-${item.id}`}
                >
                  <GlassIcon kind="chart" color={color} />
                  <span className="text-base font-medium text-cem-text">{item.label}</span>
                  {/* Spanish copy for the media kind: rendering `item.type` put English on a
                      Spanish page six times. */}
                  <span className="ml-auto text-xs font-medium uppercase tracking-wider text-cem-secondary">
                    {landing.galeria.typeLabels[item.type]}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-5 w-5 shrink-0 text-cem-secondary transition-transform duration-200 ${isActive ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {/* Body — the media + label, revealed on expand. `inert` while collapsed: the
                    height animation hides the box but not the subtree. */}
                <motion.div
                  id={`galeria-${item.id}`}
                  className="overflow-hidden"
                  inert={isActive ? undefined : ''}
                  animate={reduce ? { height: isActive ? 'auto' : 0 } : { height: isActive ? 'auto' : 0, opacity: isActive ? 1 : 0 }}
                  transition={{ duration: reduce ? 0 : 0.25, ease: [0.23, 1, 0.32, 1] }}
                >
                  <div className="border-t border-cem-text/10 p-6">
                    {/* Media placeholder. A stable block that holds the space until you connect
                        the real file. The real media goes inside the same box and replaces the
                        placeholder without shifting the layout. */}
                    <div className="relative overflow-hidden rounded-cem-md bg-cem-elevated aspect-video">
                      <VideoBG src={item.type === 'video' ? '/videos/placeholder.mp4' : ''} overlay />
                      {/* Label over the media. */}
                      <div className="absolute bottom-3 left-4 right-4">
                        <span className="inline-block rounded-full bg-cem-base/80 px-3 py-1 text-xs font-medium uppercase tracking-wider text-cem-secondary backdrop-blur-xs">
                          {item.label}
                        </span>
                      </div>
                    </div>

                    {/* Caption, from the content module: it lost its opening mark when it was
                        hardcoded here. */}
                    <p className="mt-4 text-sm text-cem-secondary">
                      {landing.galeria.captions[item.type]}
                    </p>
                  </div>
                </motion.div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Spark behind the accordion. Mounted only where a real pointer exists and motion is not
          reduced. Spark color is cem.amber, resolved from the token class, never a literal. */}
      {canSpark && (
        <ClickSpark
          sparkColor="bg-cem-amber"
          sparkSize={9}
          sparkRadius={16}
          sparkCount={7}
          duration={380}
          extraScale={1.1}
          style={{ position: 'fixed', left: sparkPos.x, top: sparkPos.y, pointerEvents: 'none', zIndex: 9999 }}
        />
      )}
    </section>
  )
}
