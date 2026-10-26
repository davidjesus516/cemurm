import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { landing } from '../../../content/landing.es.js'
import ClickSpark from './ClickSpark.jsx'

// Dark section, flat (gate 01a). The alpha gradient this used to declare never painted: its
// off-scale `to-` stop emits no CSS, and the layer sat at -z-10 behind the opaque bg.

// Accordion. Each item expands to reveal its answer with a staggered clip reveal (the answer
// rises out of its own mask), critically damped spring per Apple default, reduced motion
// collapses to plain text. The active item has a glow layer (bg-cem-amber/10) behind it, not a
// box-shadow with rgba — that keeps the source free of raw colour functions (gate 01a). The
// inactive items are dimmer glass. The spark on expand is mounted only where a real pointer
// exists and motion is not reduced, same gate as the repo's existing ClickSpark call sites.
// Spark color is cem.amber, resolved from the token class, never a literal.

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

export default function Accordion() {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(null)
  const [sparkPos, setSparkPos] = useState({ x: 0, y: 0 })

  const canSpark =
    reduce === false &&
    typeof window !== 'undefined' &&
    window.matchMedia?.('(hover: hover) and (pointer: fine)').matches !== false

  const handleOpen = (index, e) => {
    setOpen(open === index ? null : index)
    if (canSpark && e?.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect()
      setSparkPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    }
  }

  return (
    <section
      id="faq"
      className="border-t border-cem-text/10 px-4 py-20 md:px-6 md:py-28 bg-cem-base overflow-hidden"
    >
      <div className="relative mx-auto max-w-3xl">
        {/* Title. No eyebrow: this is section 9, and the run it belongs to ended at 7. */}
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tighter leading-[1.05] text-cem-text md:text-5xl">
            {landing.faq.title}
          </h2>
        </div>

        {/* Accordion list. */}
        <div className="mt-12 space-y-3">
          {landing.faq.items.map((item, index) => {
            const isActive = open === index

            return (
              <div
                key={index}
                className={`relative border border-cem-text/10 rounded-cem-lg bg-cem-surface/60 overflow-hidden ${isActive ? 'border-cem-amber/30' : ''}`}
              >
                {/* Glow layer behind the active item — bg-cem-amber/10, not a box-shadow with
                    rgba (gate 01a). */}
                {isActive && (
                  <div className="absolute -inset-2 rounded-cem-lg bg-cem-amber/10" aria-hidden="true" />
                )}

                {/* Trigger. */}
                <button
                  type="button"
                  onClick={(e) => handleOpen(index, e)}
                  className={`flex w-full items-center justify-between gap-4 px-6 py-5 text-left hover:bg-cem-surface/90 ${PRESS_FILL} ${FOCUS} relative z-10`}
                  aria-expanded={isActive}
                  aria-controls={`faq-${index}`}
                >
                  <span className="text-base font-medium text-cem-text">{item.q}</span>
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

                {/* Answer — revealed on expand with a staggered clip reveal. `inert` while
                    collapsed: the height animation hides the box but not the subtree. */}
                <motion.div
                  id={`faq-${index}`}
                  className="overflow-hidden"
                  inert={isActive ? undefined : ''}
                  animate={reduce ? { height: isActive ? 'auto' : 0 } : { height: isActive ? 'auto' : 0, opacity: isActive ? 1 : 0 }}
                  transition={{ duration: reduce ? 0 : 0.25, ease: [0.23, 1, 0.32, 1] }}
                >
                  <div className="border-t border-cem-text/10 px-6 py-5">
                    <motion.p
                      className="text-base leading-relaxed text-cem-secondary"
                      initial={{ opacity: 0, y: 8 }}
                      animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                      transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 0.08, ease: [0.23, 1, 0.32, 1] }}
                    >
                      {item.a}
                    </motion.p>
                  </div>
                </motion.div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Spark on expand. */}
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
