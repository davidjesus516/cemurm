/* eslint-disable react/prop-types -- the shape is one boolean (heroInView) and
   there are no propTypes anywhere in src/ (see FeedbackForm.jsx:1). */

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { landing } from '../../../content/landing.es.js'
import MaskedHeading from './MaskedHeading.jsx'
import SpecularButton from './SpecularButton.jsx'
import GlassIcon from './GlassIcon.jsx'
import DeviceFrame from './DeviceFrame.jsx'

// APPLE §14 — reduced motion. The hero has no ambient media of its own: the video layer
// was deleted because `absolute inset-0 -z-10` inside a section with `z-index: auto` is
// not a stacking context, so it painted in step 3 of the root stacking context while the
// page's opaque `bg-cem-base` painted in step 4 and covered it. What reduced motion
// kills here is the fan's rotation, which is the synthetic motion.
// The headline reveal still cross-fades under reduced motion (a comprehension aid) but
// does not translate.

// The one non-user-triggered motion moment the page budgets. The hero's reveal is a response
// to the page becoming visible (the intro loader hands off a READY signal), not a loop; it
// cannot re-trigger and it is gone before the visitor can act on anything else. The fan's
// settle animation is a transition on user state, not a page motion moment.

// THE PARALLAX IS GONE, AND THIS IS THE ARITHMETIC THAT REMOVED IT.
//
// It was `offset = (min(scrollY, 0.6 * vh) / vh) * PARALLAX` with PARALLAX = 14, so the
// entire travel was 0.6 * 14 = 8.4px, reached across 0.6 viewport heights of scrolling.
// Worse, the fan multiplied it per frame: `active ? 0 : index < 1 ? 1 : -0.6`. Index 0 is
// the active frame, so it was multiplied by 0 and never moved at all; indexes 1 and 2 both
// fell to the `-0.6` branch, so they moved by the same 5.04px. Two frames moving identically
// is a group translate, not a parallax, and the one frame a viewer would most expect to see
// drift was the one pinned still.
//
// 5.04px over 0.6 screen-heights sits under the ~8px per-frame perception floor, and
// design-taste-frontend §5.D is explicit about the case: if the effect is imperceptible,
// delete it rather than port it. Porting it to a motion value would have been the
// defensible second-best answer and the wrong first one. What it cost per scroll event was a
// React render plus three re-targeted 200ms tweens, which is the price of shipping nothing.

const FOCUS =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cem-text ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-cem-base'

const PRESS = 'transition-transform duration-150 ease-out active:scale-[0.97]'

// THE HEADLINE SCALE. Display size, clamped so a 375px phone does not overflow a 72px line.
// Negative tracking (Apple §15) because it is display text, and MaskedHeading applies the same
// discipline to this very heading.
//
// THREE UTILITIES, NOT ONE ARBITRARY PROPERTY. Writing `font-size`, `leading-tight` and the
// tracking inside a single `[..._...]` token asks Tailwind for one CSS declaration whose value
// is `clamp(...) leading-tight tracking-[-0.02em]`, which is not valid CSS, so Tailwind emits
// no rule at all and the h1 silently inherits body size. The length type hint is required:
// `text-` accepts both a colour and a length, and without `length:` the value is ambiguous.
// Verified against the built stylesheet, not assumed: `grep -c 'clamp('` on the emitted CSS.
const HEADLINE =
  'text-[length:clamp(2rem,6vw,4.5rem)] leading-tight tracking-[-0.02em]'

// THE SPARK. The hero no longer hosts one: it wrapped only screen-reader-only labels that
// duplicated the visible captions below, so the spark fired on nothing.

// The mockup stack. Each frame is a DeviceFrame around one of the three Stage Bus views,
// angled slightly so the stack reads as three objects in space rather than three flat cards.
// The active frame lifts (z-10) and the others recede (z-0) so the focused view is never the
// most occluded one. There is no scroll-driven translate on the stack; see the arithmetic on
// PARALLAX above for why the one that used to be there was deleted rather than ported.
function MockupStack({ reduce }) {
  return (
    <div className="relative mx-auto mt-16 max-w-7xl md:mt-24">
      {/* Eyebrow — moved here from the hero copy stack, sitting directly above the frames
          it names. §15 tracking, the other direction: this stays POSITIVE at 0.18em because
          it is 12px uppercase. Apple asks for negative tracking on display text and slightly
          positive on small text, and the page needs both, so the scale keeps both rather than
          flattening to one value. */}
      <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-cem-secondary">
        {landing.hero.eyebrow}
      </p>

      {/* The three frames, stacked with opposing tilts so the outer edges recede (a concave
          fan embracing the active frame). Perspective is on the parent; the crop is on this
          container; the active frame lifts with z-10 so it is never the most occluded one.
          figure wraps frames + caption because figcaption is only valid inside figure, and
          preflight zeroes figure's margin, so this adds no space.

          MOBILE COLLAPSE, declared here because §4.7 requires the sub-768px fallback to
          live in the component. Below `xl` the row is a scroll-snap track; from `xl` up it
          is the centred fan again. The boundary is arithmetic: the active frame is the
          FIRST child and `first:ml-0` zeroes its negative margin, so "fully inside the
          container" reduces to `3W - 2M <= container`, which fails at every width below
          1280 (375: 768 > 343, 26% visible; 768: 864 > 720, 78%; 1024: 1024 > 976, 94%)
          and passes at 1280, where the container is 1232 against 1024 of content.
          Narrowing W does not survive the scale: the middle frame's visible sliver is
          `W - 2M`, so asking 24px of it caps W at 159.5, and the scale only offers
          `w-36` (144) there, a 126px column that makes the projection window 1:2.5
          portrait while dragging `md:w-80` and `lg:w-96` down too. Scaling the fan
          scales the 14px label with it.
          `justify-start` below `xl` puts the active frame at offset 0 with the NEXT frame
          peeking from under it: 55px at 375, 70 at 390, 94 at 414, 400 at 768. That peek
          plus `snap-mandatory` is the affordance, and it is structural rather than a
          caption because copy is not editable here. Document-level horizontal scroll is
          unaffected: the section is `overflow-hidden`, and the container now scrolls its
          own overflow instead of letting it out. */}
      <figure className="m-0">
        <div
          className="cem-perspective flex items-end justify-start overflow-y-hidden overflow-x-auto snap-x snap-mandatory xl:overflow-hidden xl:snap-none xl:justify-center"
          style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
        >
          {landing.hero.views.map((view, index) => {
            const active = index === 0
            return (
              <motion.div
                key={view.id}
                className={`-ml-12 w-72 shrink-0 origin-bottom first:ml-0 snap-start md:w-80 lg:-ml-16 lg:w-96 ${
                  active ? 'z-10' : 'z-0'
                }`}
                animate={reduce ? { opacity: 1 } : {
                  opacity: active ? 1 : 0.45,
                  scale: active ? 1 : 0.92,
                  rotateY: active ? 0 : index < 1 ? 9 : -9,
                  rotateZ: active ? 0 : index < 1 ? 5 : -5,
                }}
                transition={{ duration: reduce ? 0 : 0.2, ease: [0.32, 0.72, 0, 1] }}
              >
                <MockupFrame view={view} index={index} />
              </motion.div>
            )
          })}
        </div>

        {/* Caption — the honest place for the licence claim (Section 8.2 forbids asserting
            one nobody has checked): on the asset, next to the demo. text-sm, not caption-sized
            text-xs, because a disclosure nobody can read is not a disclosure. */}
        <figcaption className="mt-6 text-center text-sm leading-relaxed text-cem-secondary">
          {landing.hero.caption}
        </figcaption>
      </figure>

      {/* THE PER-VIEW CAPTION ROW THAT USED TO SIT HERE IS GONE, AND THE COMMENT THAT
          KEPT IT IS GONE WITH IT. The row printed every label and every blurb a second
          time, about 40px below the identical pair inside the DeviceFrame it was
          describing, so the page said the same six sentences twice and the second
          reading was the one nobody needs. Its justification was that the reader should
          not have to chase the tab label: the label is inside the frame it names, which
          is the frame the reader is already looking at. MockupFrame renders the label
          and the blurb inside the DeviceFrame, and if a view ever needs a caption that
          is NOT its label, that belongs inside the frame too, where it describes
          something. */}
    </div>
  )
}

// One mockup frame: a DeviceFrame around a glass tile (icon + label) so the three views read
// as screens, not as empty black boxes. The icon is a glass tile whose tint walks the three
// names GlassIcon declares for a one-accent page: amber, amberLight, secondary. Gate rule 02
// bans the four dead accents anywhere in src/, so no wider set is available, and none is
// needed: the material is one and only the tint moves.
function MockupFrame({ view, index }) {
  const colors = ['amber', 'amberLight', 'secondary']
  return (
    <DeviceFrame anchor="top">
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <GlassIcon kind={['chart', 'roles', 'projection'][index]} color={colors[index]} />
          <span className="text-sm font-medium text-cem-text">{view.label}</span>
          <span className="text-xs text-cem-secondary">{view.blurb}</span>
        </div>
      </div>
    </DeviceFrame>
  )
}

export default function Hero() {
  const reduce = useReducedMotion()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const onReady = () => setReady(true)
    // The intro loader dispatches a cemurm:landing-ready event; this component polls the
    // dataset on documentElement AND subscribes, so it reveals correctly whether it mounts
    // before or after the loader finishes. The poll is what makes it a dual path: the
    // dataset survives the loader being gone, so a late mount does not miss the signal.
    if (document.documentElement.dataset.landingReady === 'true') {
      setReady(true)
    }
    window.addEventListener('cemurm:landing-ready', onReady)
    return () => window.removeEventListener('cemurm:landing-ready', onReady)
  }, [])

  return (
    <section
      id="hero"
      className="relative overflow-hidden px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-24"
    >
      {/* THERE IS NO VIDEO BACKGROUND HERE, AND THAT IS THE FIX.
          The section used to carry an `absolute inset-0 -z-10` layer holding a
          `VideoBG` and a bottom scrim. It has never rendered, for two independent
          reasons, either of which is sufficient on its own:

            1. `#hero` is `relative` with `z-index: auto`, which is NOT a stacking
               context. A negative z-index child therefore paints in step 3 of the
               ROOT stacking context, and Landing.jsx's opaque `bg-cem-base` wrapper
               paints in step 4, on top of it. This is the same trap that killed the
               seven decorative gradients in W2 and W3.
            2. `VideoBG src=""` takes the no-src branch, which renders
               `absolute inset-0` inside a wrapper with no intrinsic height. It is a
               zero-height box: nothing to paint even when the layering is right.

          So the honest choice is deletion rather than a layering fix. Making the
          layer paintable would produce ZERO visible change, because there is no
          asset: no video file exists anywhere in the repo and none was invented.
          A scrim over an empty box is a scrim over the page background.

          What would NOT have been honest is switching the layering on and leaving
          `src=""` behind it. That is the version that looks like a fix in the diff
          and renders nothing in a browser.

          The scrim went with the layer for the same reason. It described a bottom
          gradient that made the headline area "the brightest part of the hero", over
          a video that never existed. The hero now has no background of its own and
          sits on the page fill, which is what every other section does.

          `VideoBG` itself is untouched: Galeria still mounts it inside an
          `aspect-video` media box, where it holds that box's space until a real
          file is connected. If a hero video ever ships, it needs a stacking context
          on the section (`isolate`) AND a real src, and both changes are reviewable
          only with a browser. */}
      <div className="relative mx-auto max-w-7xl">
        {/* Headline — masked reveal.
            THE MEASURE IS SIZED FROM THE TYPE, NOT PICKED. Measured in Chromium with
            `white-space: nowrap` and `width: max-content`, the string needs 893px at the
            clamp's 72px ceiling, and it needs that at every viewport from 1200px up,
            because 6vw reaches 4.5rem exactly there. `max-w-3xl` is 768px, so the
            headline wrapped to two lines on the widest screens and one line on the
            narrow ones, which is backwards: giving the layout more room made it worse.
            The crossover was about 1030px, where the clamp gives 61.44px and the string
            needs 762px, clearing the 768px measure by 6px.

            `max-w-5xl` at 1024px is the first token with real margin: 131px over the
            893px. `max-w-4xl` at 896px technically fits, by 3px, which is not a margin
            but a rounding error, and it breaks the moment a visitor raises their default
            text size — Apple §15 asks for Dynamic Type to be respected, and a display
            line with 3px of slack does not respect it.

            This wrapper constrains the headline and nothing else. The subtitle carries
            its own `max-w-2xl` at 672px, which is a readable body measure and is well
            under 65ch at its 18px size, and the CTA is `w-fit`. Widening this column
            widens the h1 alone, so display type gets the measure it needs and body copy
            keeps the one it already had. */}
        <div className="max-w-5xl">
          <MaskedHeading
            as="h1"
            className={`${HEADLINE} text-cem-text font-semibold`}
            text={landing.hero.title}
            stagger={0.12}
            duration={1.1}
            initial="hidden"
            animate={ready ? 'show' : 'hidden'}
          />

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-cem-secondary md:text-lg">
            {landing.hero.subtitle}
          </p>

          {/* The one amber primary CTA on screen at a time. Below the hero this becomes the
              ghost outline variant in the header, so the two amber CTAs never sit on screen
              together. */}
          <div className="mt-8">
            <SpecularButton href={landing.hero.cta.href} label={landing.hero.cta.label} />
          </div>
        </div>
      </div>

      {/* Mockup stack — three Stage Bus views as angled frames. */}
      <MockupStack reduce={reduce} />
    </section>
  )
}
