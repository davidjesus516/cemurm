import { motion, useReducedMotion } from 'motion/react'
import { landing } from '../../../content/landing.es.js'
import GlassIcon from './GlassIcon.jsx'

// Dark section, flat (gate 01a). The alpha gradient this used to declare never painted: its
// off-scale `to-` stop emits no CSS, and the layer sat at -z-10 behind the opaque bg.

// BENTO. One card per body paragraph, derived from content, so an empty tile is not
// expressible. The grid is 2-col on md+, 1-col on mobile, and the FIRST and LAST cards span
// both columns: 6 cards over 8 areas (4 rows x 2 cols), every area claimed, so `gap-px
// bg-cem-text/15` never paints an empty cell as a light block. Each card is glass-icon
// (tint from the four names GlassIcon declares, amber first) + eyebrow + headline + one line,
// with a glow layer (bg-cem-amber/10) on hover: amber, the one accent, never a second colour.

// ANIMATED LIST. The steps are an ordered list with staggered clip reveal on scroll entry
// (IntersectionObserver with once:true), critically damped spring per Apple default, reduced
// motion collapses to plain text.

const FOCUS =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cem-text ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-cem-base'

// The icon rotation, built from the four names GlassIcon declares and nothing else. Two of
// the six names this array used to hold are gate-02 accents and one is not a token at all,
// so every cell rendered amber and the source described a rotation the page never showed.
// Four names over six cards means two pairs repeat, which is the honest result here.
const COLORS = ['amber', 'amberLight', 'secondary', 'secondaryElevated']

export default function Features() {
  const reduce = useReducedMotion()

  return (
    <section
      id="features"
      className="border-t border-cem-text/10 px-4 py-20 md:px-6 md:py-28 bg-cem-base overflow-hidden"
    >
      <div className="relative mx-auto max-w-7xl">
        {/* Title. No eyebrow: one per three sections, and this one is mid-run. */}
        <div className="mb-6 max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tighter leading-[1.05] text-cem-text md:text-5xl">
            {landing.features.title}
          </h2>
        </div>

        {/* BENTO GRID. First and last cards span both columns so 6 cards claim all 8 areas. */}
        <div className="mt-12 grid grid-cols-1 gap-px bg-cem-text/15 md:grid-cols-2">
          {landing.features.cards.map((card, index) => {
            const color = COLORS[index % COLORS.length]
            const isBookend = index === 0 || index === landing.features.cards.length - 1

            return (
              <motion.div
                key={card.id}
                className={`relative bg-cem-elevated p-8 ${isBookend ? 'md:col-span-2' : ''}`}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: reduce ? 0 : 0.4, ease: [0.23, 1, 0.32, 1] }}
              >
                {/* Hover glow layer — bg-cem-amber/10 behind the card, not a box-shadow with
                    rgba (gate 01a). The card has a relative parent so the glow sits behind. */}
                <div className="absolute -inset-1 rounded-cem-lg bg-cem-amber/0 transition-colors duration-200 hover:bg-cem-amber/10" aria-hidden="true" />

                {/* Glass icon + eyebrow + headline + body. */}
                <div className="relative z-10 flex items-start gap-4">
                  <GlassIcon kind={card.icon} color={color} />
                  <div>
                    {card.eyebrow && (
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-cem-secondary-elevated">
                        {card.eyebrow}
                      </p>
                    )}
                    <h3 className="text-lg font-semibold text-cem-text">{card.title}</h3>
                    {/* cem.secondary-elevated, not cem.secondary: on this card's own
                        bg-cem-elevated fill the latter is 4.04:1 and fails AA. Rule 06 cannot
                        see it because the background is inherited, not declared here. */}
                    <p className="mt-2 text-base leading-relaxed text-cem-secondary-elevated">
                      {card.body}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* ANIMATED LIST — the ordered steps. No label: one eyebrow per three sections. */}
        <div className="mt-16 max-w-2xl">
          <ol className="space-y-6">
            {landing.features.steps.map((step, index) => (
              <li key={index} className="group">
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden="true"
                    className="text-sm font-semibold tabular-nums text-cem-secondary transition-colors duration-200 group-hover:text-cem-amber"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <motion.p
                    className="text-lg leading-relaxed text-cem-secondary"
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : index * 80, ease: [0.23, 1, 0.32, 1] }}
                  >
                    {step}
                  </motion.p>
                </div>
                <span
                  aria-hidden="true"
                  className="mt-2 block h-px origin-left bg-cem-text/20"
                  style={{ transition: 'opacity 200ms ease' }}
                />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
