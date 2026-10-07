/* eslint-disable react/prop-types */
// DesignSystem (living style guide) — /design.
//
// TIER 1 surface (nav/settings class): full macOS language, radius, depth and
// at most one material per view.
//
// WHAT IS HERE: the token foundations (colour, type, spacing, radius,
// elevation) plus the 35 interaction components of the React Bits set,
// reimplemented token-safe. The earlier hand-rolled demos (plain buttons,
// plain inputs, a checkbox, a static segmented control, a static nav) were
// REPLACED by them: SpringCheck, HoldButton, WarmTooltip, GlideSelect,
// JellyRadio, PeekRating, Stepper, MorphSlider, WakeSlider, SwipeRow,
// SwipeToast, StatusMark, BellToggle, PulseHeart, Shredder, LatticeLoader,
// Dock, SpotlightCard, BorderGlow, GlassIcons, Counter, SpecularButton,
// OptionWheel, AnimatedList, CardNav, FlexCarousel, AccordionGallery,
// TextLoop, ScrollVelocity, VariableProximity, CountUp, PixelSwap,
// TargetCursor, GradualBlur, ClickSpark.
//
// CONTRACT WITH scripts/check-visual-contract.sh — this page obeys the gate,
// it does not test it:
//   * No colour literals of any kind (rule 01a): swatches show token names,
//     never hex or function values.
//   * No Tailwind default-palette utilities (rule 01b): cem tokens only.
//   * The four retired accents (rule 02) are named in prose but never used.
//   * No cem-secondary text on an elevated/hover fill (rule 06): raised fills
//     use cem-secondary-elevated or cem-text.
// Contrast figures quoted below were computed with WCAG relative luminance on
// the values declared in tailwind.config.js and re-verified by the gate matrix.

import { useState } from 'react'
import { motion } from 'motion/react'
// RAC's Virtualizer + ListLayout, used directly: they are behaviour, not style,
// and the ListBox contract below sits on top of them. Layout direction is
// vertical, which is the default here, so no direction override is needed.
import { ListLayout, Virtualizer } from 'react-aria-components'
import {
  DesignPageSkeleton,
  Skeleton,
  SkeletonGroup,
  SkeletonLine,
} from '../components/skeleton.jsx'
import { ListBox } from '../components/index.js'
import {
  AccordionGallery,
  AnimatedList,
  BellToggle,
  BorderGlow,
  ClickSpark,
  CodeSlots,
  Counter,
  CountUp,
  FlexCarousel,
  GlassIcons,
  GradualBlur,
  HoldButton,
  LatticeLoader,
  MorphSlider,
  OptionWheel,
  PixelSwap,
  ShapeGridPanel,
  PulseHeart,
  ScrollVelocity,
  SpotlightCard,
  SpecularButton,
  SpringCheck,
  StatusMark,
  Stepper,
  TargetCursor,
  TextLoop,
  VariableProximity,
  WakeSlider,
  WarmTooltip,
} from '../components/index.js'
import {
  CardNavDemo,
  DockDemo,
  GlassIconsDemo,
  GlideSelectDemo,
  JellyRadioDemo,
  PeekRatingDemo,
  ShredderDemo,
  SwipeRowDemo,
  SwipeToastDemo,
} from '../components/demos.jsx'
import { SPRING_UI } from '../components/motion.js'

/* ---------------------------------------------------------------- icons */

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
}

const Icons = {
  note: (
    <svg {...iconProps}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
  plus: (
    <svg {...iconProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  search: (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  chevronRight: (
    <svg {...iconProps}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
  clock: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  list: (
    <svg {...iconProps}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  play: (
    <svg {...iconProps}>
      <path d="M6 4l14 8-14 8V4z" />
    </svg>
  ),
}

/* -------------------------------------------------------- listbox fixtures */

// Real repertoire names, because a listbox of "Item 1 / Item 2 / Item 3" cannot
// show what it is for: the reason this control exists in the product is picking
// a folder to filter 128 songs by.
const FOLDERS = ['All songs', 'Standards', 'Gospel', 'Originals', 'Instrumentals']

const TUNING = ['Concert A', 'Drop D', 'Open G', 'DADGAD']

// 1000 rows, generated rather than typed: the point of the Virtualizer demo is
// the count, and a thousand hand-written song titles would be noise in the diff.
const BIG_LIST = Array.from({ length: 1000 }, (_, i) => ({
  id: `song-${i}`,
  label: `Rehearsal song ${i + 1}`,
}))

/* ------------------------------------------------------------ primitives */

function Section({ title, subtitle, children }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="text-lg font-semibold tracking-tight text-cem-text">{title}</h2>
      {subtitle && <p className="mt-1 max-w-prose text-sm text-cem-secondary">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** One component under review: name, origin, and what it demonstrates.
 *
 *  THE CARD CONTRACT — every Demo card gets the same three effects, because a
 *  page where only some cards respond reads as broken:
 *    entry      fades and lifts once on mount (280ms, spring, not a loop)
 *    hover      lifts 2px and softens its shadow; the border warms to amber
 *    focus-within  a card holding focus behaves exactly like a hovered one
 *  The blur is the elevation language: the resting card has NO shadow (dark mode
 *  earns depth with lightness), and the shadow appears only while it is raised. */
function Demo({ name, origin, note, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_UI, duration: 0.28 }}
      className="group rounded-xl border border-cem-elevated bg-cem-surface p-5 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-cem-amber/40 hover:shadow-lg focus-within:-translate-y-0.5 focus-within:border-cem-amber/40 focus-within:shadow-lg"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-cem-text">{name}</h3>
        <span className="text-xs text-cem-secondary">{origin}</span>
      </div>
      <div className="mt-4">{children}</div>
      {note && <p className="mt-4 text-xs leading-5 text-cem-secondary">{note}</p>}
    </motion.div>
  )
}

function Swatch({ className, label, note }) {
  return (
    <div>
      <div className={`h-16 rounded-lg border border-cem-elevated ${className}`} />
      <p className="mt-2 text-sm font-medium text-cem-text">{label}</p>
      {note && <p className="text-xs text-cem-secondary">{note}</p>}
    </div>
  )
}

function DemoCard({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-cem-elevated bg-cem-surface p-6 ${className}`}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ page */

export default function DesignSystem() {
  const [materialVisible, setMaterialVisible] = useState(true)
  const [gridShape, setGridShape] = useState('square')
  const [gridDirection, setGridDirection] = useState('right')
  const [gridSize, setGridSize] = useState(44)
  const [gridTrail, setGridTrail] = useState(11)
  const [deletedCount, setDeletedCount] = useState(0)
  // The ListBox demos are controlled, because a selection list whose selection
  // cannot be read back is a demo, not a contract. RAC's selection is ALWAYS a
  // Set of keys, in single mode too: `onSelectionChange` hands back a Set, and
  // `selectedKeys` takes an iterable of keys (the string 'all' is RAC's reserved
  // select-everything value, so a bare string key would be misread). Every demo
  // therefore keeps a Set in state and reads `[...set][0]` for the single case.
  const [folder, setFolder] = useState(new Set([FOLDERS[0]]))
  const [tuning, setTuning] = useState(new Set(['Concert A']))
  const [lastAction, setLastAction] = useState('')
  const [exportFormat, setExportFormat] = useState(new Set(['mid']))

  return (
    <div className="max-w-5xl">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-cem-text">Design system</h1>
        <p className="mt-2 max-w-prose text-sm leading-6 text-cem-secondary">
          Living style guide: the token foundations plus 35 interaction
          components, every one built from the same tokens the product uses and
          animated with the spring vocabulary in{' '}
          <code className="rounded bg-cem-elevated px-1">motion.js</code>. Motion is
          CSS-native plus Motion (springs); the projector surface stays chrome-free
          and static. Source of truth: DESIGN.md at the repo root.
        </p>
      </header>

      {/* ------------------------------------------------------- foundations */}
      <Section
        title="Color"
        subtitle="One dark ramp, one accent. The amber is the only saturated colour and marks exactly one thing on screen at a time. The four retired accents (coral, emerald, rose, sky) exist in code as debt and must not appear in new work."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Swatch className="bg-cem-base" label="cem.base" note="App background" />
          <Swatch className="bg-cem-surface" label="cem.surface" note="Cards, rows, panels" />
          <Swatch className="bg-cem-elevated" label="cem.elevated" note="Sheets, modals, popovers only" />
          <Swatch className="bg-cem-hover" label="cem.hover" note="Hover / pressed. Never a resting fill" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Swatch className="bg-cem-amber" label="cem.amber" note="The one accent: primary CTA, active state, logo" />
          <div>
            <div className="flex h-16 items-center justify-center rounded-lg border border-cem-elevated bg-cem-surface text-sm font-medium text-cem-text">
              Aa
            </div>
            <p className="mt-2 text-sm font-medium text-cem-text">cem.text</p>
            <p className="text-xs text-cem-secondary">Primary label</p>
          </div>
          <div>
            <div className="flex h-16 items-center justify-center rounded-lg border border-cem-elevated bg-cem-surface text-sm font-medium text-cem-secondary">
              Aa
            </div>
            <p className="mt-2 text-sm font-medium text-cem-text">cem.secondary</p>
            <p className="text-xs text-cem-secondary">Secondary label — base/surface only</p>
          </div>
          <div>
            <div className="flex h-16 items-center justify-center rounded-lg border border-cem-elevated bg-cem-elevated text-sm font-medium text-cem-secondary-elevated">
              Aa
            </div>
            <p className="mt-2 text-sm font-medium text-cem-text">cem.secondary-elevated</p>
            <p className="text-xs text-cem-secondary">Secondary label on raised fills</p>
          </div>
        </div>

        <DemoCard className="mt-6">
          <h3 className="text-sm font-semibold text-cem-text">
            Contrast (WCAG relative luminance, floor 4.5:1)
          </h3>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-cem-secondary">
            <li>text — base 17.06 / surface 13.98 / elevated 9.90 / hover 7.24</li>
            <li>secondary — base 6.96 / surface 5.71 / elevated 4.04 (fail) / hover 2.96 (fail)</li>
            <li>secondary-elevated — base 9.27 / surface 7.59 / elevated 5.38 / hover 3.93 (fail)</li>
            <li>amber — base 8.31 / surface 6.81 / elevated 4.82 / hover 3.53 (fail)</li>
          </ul>
          <p className="mt-2 text-xs text-cem-secondary">
            The rule that falls out: a raised fill (elevated, hover) carries
            cem-text or cem-secondary-elevated labels only, and amber text stays
            at or above 18px.
          </p>
        </DemoCard>
      </Section>

      <Section
        title="Typography"
        subtitle="Inter, self-hosted via @fontsource/inter and imported in src/app/main.jsx (400/500/600/700). Hierarchy is size + weight + leading as a set: large sizes get negative tracking, body stays near zero, caption uppercase gets positive tracking. No weight below 400 anywhere."
      >
        <DemoCard className="space-y-4">
          <div>
            <p className="text-3xl font-semibold leading-tight tracking-tight text-cem-text">Stage Mode</p>
            <p className="mt-1 text-xs text-cem-secondary">display — 30px / semibold / tracking-tight</p>
          </div>
          <div>
            <p className="text-2xl font-semibold leading-snug tracking-tight text-cem-text">Your setlists</p>
            <p className="mt-1 text-xs text-cem-secondary">title — 24px / semibold / tracking-tight</p>
          </div>
          <div>
            <p className="text-lg font-semibold leading-snug text-cem-text">Sunday service — main hall</p>
            <p className="mt-1 text-xs text-cem-secondary">heading — 18px / semibold</p>
          </div>
          <div>
            <p className="text-base leading-relaxed text-cem-text">
              Amazing Grace — key of G, 72 bpm, capo 2. The agreed key lives on the
              song row so the whole team plays from the same version.
            </p>
            <p className="mt-1 text-xs text-cem-secondary">body — 16px / regular / relaxed leading</p>
          </div>
          <div>
            <p className="text-sm text-cem-secondary">Last practiced 3 days ago · 4 min read</p>
            <p className="mt-1 text-xs text-cem-secondary">callout — 14px / secondary</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-cem-secondary-elevated">Section label</p>
            <p className="mt-1 text-xs text-cem-secondary">caption — 12px / uppercase / wide tracking</p>
          </div>
        </DemoCard>
      </Section>

      <Section
        title="Spacing & radius"
        subtitle="4px base grid, closed scale (4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64) and a radius that grows with the component: chip 4, input 6, row 8, card 12, sheet 16. Pills are for things that are semantically pills."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <DemoCard>
            <div className="space-y-2">
              {[
                ['space-1 · 4', 'w-1'],
                ['space-2 · 8', 'w-2'],
                ['space-3 · 12', 'w-3'],
                ['space-4 · 16', 'w-4'],
                ['space-6 · 24', 'w-6'],
                ['space-8 · 32', 'w-8'],
                ['space-12 · 48', 'w-12'],
                ['space-16 · 64', 'w-16'],
              ].map(([label, w]) => (
                <div key={label} className="flex items-center gap-4">
                  <span className="w-28 text-xs text-cem-secondary">{label}</span>
                  <span className={`h-2 rounded-full bg-cem-amber ${w}`} />
                </div>
              ))}
            </div>
          </DemoCard>
          <div className="grid grid-cols-3 gap-4">
            {[
              ['rounded', '4'],
              ['rounded-md', '6'],
              ['rounded-lg', '8'],
              ['rounded-xl', '12'],
              ['rounded-2xl', '16'],
              ['rounded-full', 'pill'],
            ].map(([r, label]) => (
              <div key={r} className="text-center">
                <div className={`h-14 border border-cem-elevated bg-cem-elevated ${r}`} />
                <p className="mt-1 text-xs text-cem-secondary">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="Elevation & material"
        subtitle="Dark mode earns depth with lightness: every level up is lighter, never darker, never a hue shift. Shadows exist only to lift transient surfaces off content scrolling beneath them."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-cem-elevated bg-cem-surface p-5">
            <p className="text-sm font-medium text-cem-text">Level 1 — surface</p>
            <p className="mt-1 text-xs text-cem-secondary">Cards and rows. Border + lightness, no shadow.</p>
          </div>
          <div className="rounded-xl border border-cem-elevated bg-cem-elevated p-5 shadow-md">
            <p className="text-sm font-medium text-cem-text">Level 2 — elevated</p>
            <p className="mt-1 text-xs text-cem-secondary-elevated">Popovers and menus. shadow-md.</p>
          </div>
          <div className="rounded-xl border border-cem-elevated bg-cem-elevated p-5 shadow-xl">
            <p className="text-sm font-medium text-cem-text">Level 3 — modal</p>
            <p className="mt-1 text-xs text-cem-secondary-elevated">Sheets and dialogs. shadow-xl.</p>
          </div>
        </div>
        <div className="mt-4">
          <DemoCard className="relative h-40 overflow-hidden p-0">
            <div className="h-full overflow-y-auto px-4 py-3 text-sm leading-6 text-cem-secondary">
              {Array.from({ length: 10 }, (_, i) => (
                <p key={i} className="mb-2">
                  Line {i + 1} — content scrolls underneath the floating chrome. One
                  material surface per view, never stacked on another.
                </p>
              ))}
            </div>
            {materialVisible && (
              <div className="absolute inset-x-4 bottom-3 flex items-center gap-3 rounded-lg border border-cem-elevated bg-cem-surface/70 px-3 py-2 backdrop-blur-md">
                <span className="text-xs font-medium text-cem-text">Floating toolbar</span>
                <button
                  type="button"
                  onClick={() => setMaterialVisible(false)}
                  className="ml-auto rounded-md px-2 py-1 text-xs text-cem-secondary hover:text-cem-text"
                >
                  Dismiss
                </button>
              </div>
            )}
          </DemoCard>
          <p className="mt-2 text-xs text-cem-secondary">
            The material is the floating functional layer: blur + 70% fill +
            hairline edge, content scrolling beneath. Never on a scroll container
            or a list row, never in stage mode.
          </p>
        </div>
      </Section>

      {/* ------------------------------------------------------------ micro */}
      <Section
        title="Micro interactions (16)"
        subtitle="One control each: press, drag, hold, peek. Every press answers on pointer-down, every target is at least 44px, and nothing loops unless you ask it to."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Demo name="SpringCheck" origin="reactbits.dev/micro/spring-check" note="Replaces the plain checkbox. One press, one spring: fill, tick draw, label strike and dim.">
            <SpringCheck />
          </Demo>
          <Demo name="HoldButton" origin="reactbits.dev/micro/hold-button" note="For irreversible actions only. Fill shows commitment building; release early cancels.">
            {/* children/doneLabel/onHold, because the component's props moved
                with the port. The previous demo passed `label` and no
                `onComplete`, so the done state was unreachable and the most
                interesting phase of the component could never be seen here. */}
            <div className="space-y-3">
              <HoldButton
                size="md"
                radius={14}
                holdTime={2000}
                doneLabel="Setlist deleted"
                onHold={() => setDeletedCount((n) => n + 1)}
              >
                Hold to delete the setlist
              </HoldButton>
              <p className="text-xs text-cem-secondary">
                Committed {deletedCount}
                {deletedCount === 1 ? ' time' : ' times'} — onHold fires only after
                the full hold, and releasing early cancels without counting.
              </p>
            </div>
          </Demo>
          <Demo name="WarmTooltip" origin="reactbits.dev/micro/warm-tooltip" note="Replaces the tooltip-less controls. Opens on focus as well as hover — nothing depends on a pointer.">
            <WarmTooltip />
          </Demo>
          <Demo name="GlideSelect" origin="reactbits.dev/micro/glide-select" note="Replaces the static segmented control. The pill is written imperatively, so an interrupted scrub continues from where it is.">
            <GlideSelectDemo />
          </Demo>
          <Demo name="JellyRadio" origin="reactbits.dev/micro/jelly-radio" note="Replaces the plain radio rows. Every chip runs its own spring, staggered by distance from the selection.">
            <JellyRadioDemo />
          </Demo>
          <Demo name="PeekRating" origin="reactbits.dev/micro/peek-rating" note="Hover previews, release commits. The tip tracks the slot, not the pointer.">
            <PeekRatingDemo />
          </Demo>
          <Demo name="WakeSlider" origin="reactbits.dev/micro/wake-slider" note="Continuous slider. The knob wakes while held; the landing value is projected from the release velocity.">
            <WakeSlider />
          </Demo>
          <Demo name="SwipeRow" origin="reactbits.dev/micro/swipe-row" note="Replaces the plain list row. The landing point is the projected momentum, not the release position.">
            <SwipeRowDemo />
          </Demo>
          <Demo name="SwipeToast" origin="reactbits.dev/micro/swipe-toast" note="A burn fuse that pauses on hover, focus, drag and tab-hide. Throwing it away reports a reason.">
            <SwipeToastDemo />
          </Demo>
          <Demo name="StatusMark" origin="reactbits.dev/micro/status-mark" note="Offline-first status: dot + ring + sentence. The only looping piece here, and it is opt-in.">
            <StatusMark />
          </Demo>
          <Demo name="BellToggle" origin="reactbits.dev/micro/bell-toggle" note="Notification toggle. The swing fires on the causal frame; the badge carries the count.">
            <BellToggle />
          </Demo>
          <Demo name="PulseHeart" origin="reactbits.dev/micro/pulse-heart" note="One double-beat per press. The original loops forever; the beat is an event here.">
            <PulseHeart />
          </Demo>
          <Demo name="Shredder" origin="reactbits.dev/micro/shredder" note="Rows are snapshotted to a texture, sliced into strips and released through a real simulation.">
            <ShredderDemo />
          </Demo>
          <Demo name="LatticeLoader" origin="reactbits.dev/micro/lattice-loader" note="A loader that waits for a click, not a shimmer on a loop.">
            <LatticeLoader />
          </Demo>
          <Demo name="CodeSlots" origin="reactbits.dev/micro/code-slots" note="One-time code entry. A single hidden input drives every slot, so paste, the keyboard and mobile autofill all work.">
            <CodeSlots />
          </Demo>
        </div>
      </Section>

      {/* ------------------------------------------------------ components */}
      <Section
        title="Components (13)"
        subtitle="Larger surfaces. Every entry and exit shares one curve, every dismissal returns along the path it came in on, and one transient surface at a time."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Demo name="Dock" origin="reactbits.dev/components/dock" note="The item SIZE is the animated value, so the row reflows and the panel grows. Tiles can carry their own colour.">
            <DockDemo />
          </Demo>
          <Demo name="SpotlightCard" origin="reactbits.dev/components/spotlight-card" note="The registry original: the glow centre is the pointer in card coordinates, the layer fades over 500ms on hover and on keyboard focus, and mousemove freezes while the card holds focus.">
            <SpotlightCard>
              <p className="text-sm font-semibold text-cem-text">Sunday service</p>
              <p className="mt-1 text-xs text-cem-secondary">Main hall · 10 songs</p>
            </SpotlightCard>
          </Demo>
          <Demo name="BorderGlow" origin="reactbits.dev/components/border-glow" note="Token amber ring that tracks the pointer — same read as the original glow, with no colour literals.">
            <BorderGlow />
          </Demo>
          <Demo name="GlassIcons" origin="reactbits.dev/components/glass-icons" note="Three 3D planes per tile: a colour plate, a glass face with real backdrop blur, and a label that rises. The plate gradient is resolved from the token layer.">
            <GlassIconsDemo />
          </Demo>
          <Demo name="Counter" origin="reactbits.dev/components/counter" note="The number is a MotionValue driven into the text node: 60fps with no re-render.">
            <Counter />
          </Demo>
          <Demo name="Stepper" origin="reactbits.dev/components/stepper" note="Replaces +/- rows. Value pops on change; every target is 44px; disabled means unavailable, never failed.">
            <Stepper />
          </Demo>
          <Demo name="SpecularButton" origin="reactbits.dev/components/specular-button" note="Replaces the plain CTA. The highlight lags the pointer on a soft spring; amber stays the primary action.">
            <SpecularButton />
          </Demo>
          <Demo name="OptionWheel" origin="reactbits.dev/components/option-wheel" note="The iOS wheel rebuilt on tokens: momentum projection, rubber-band at both ends, amber frame on the centred option.">
            <OptionWheel />
          </Demo>
          <Demo name="AnimatedList" origin="reactbits.dev/components/animated-list" note="Insert and remove share one spring and one path, so the list never teleports.">
            <AnimatedList />
          </Demo>
          <Demo name="CardNav" origin="reactbits.dev/components/card-nav" note="The bar is the container: the hamburger opens it from 60px to its measured height while the three link cards rise staggered. Thirteen links, the reference's three-card limit — Play, Band, System.">
            <div className="relative h-[340px] w-full">
              <CardNavDemo />
            </div>
          </Demo>
          <Demo name="FlexCarousel" origin="reactbits.dev/components/flex-carousel" note="An infinite image row flowing through an invisible liquid lens at the edges: the edge bends, the flow curls and colour splits along it. Click a card to focus it while the others slide away — four bend presets, five entrances, one speed squeeze. The default images come from Unsplash, so a reviewer working offline sees grey placeholders rather than a broken demo.">
            <div className="relative h-[460px] w-full">
              <FlexCarousel />
            </div>
          </Demo>
          <Demo name="AccordionGallery" origin="reactbits.dev/components/accordion-gallery" note="Flex-grow is the animated value — one object moving, not five boxes resizing — and perspective turns the ±8° fan into depth. Inactive tiles desaturate and dim; the label leads in with an amber bar. Reduced motion drops it to 0s.">
            <AccordionGallery />
          </Demo>
          <Demo name="MorphSlider" origin="reactbits.dev/components/morph-slider" note="Discrete slider. The thumb morphs along the direction of travel, then settles on the projected target.">
            <MorphSlider />
          </Demo>
        </div>
      </Section>

      {/* -------------------------------------------------- text animations */}
      <Section
        title="Text animations (4)"
        subtitle="Type that moves. All of them are opt-in or pointer-driven, clamped, and switched off under prefers-reduced-motion — Apple asks that motion be optional and never the only channel."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Demo name="TextLoop" origin="reactbits.dev/text-animations/text-loop" note="Loops only after you press Play, at a 2.4s reading pace (Apple flags oscillation near 0.2Hz).">
            <TextLoop />
          </Demo>
          <Demo name="ScrollVelocity" origin="reactbits.dev/text-animations/scroll-velocity" note="Skews with scroll velocity, clamped to 10°, and springs back to zero when the scroll stops.">
            <ScrollVelocity lines="Amazing Grace — the agreed key lives on the song row" />
          </Demo>
          <Demo name="VariableProximity" origin="reactbits.dev/text-animations/variable-proximity" note="Letters rise, grow and hand over from secondary to amber by distance. DOM writes in a rAF loop: zero re-renders.">
            <VariableProximity />
          </Demo>
          <Demo name="CountUp" origin="reactbits.dev/text-animations/count-up" note="Counts once per press; shows the plain number under reduced motion, which is the information the animation carried.">
            <CountUp />
          </Demo>
        </div>
      </Section>

      {/* ------------------------------------------------------- animations */}
      <Section
        title="Animations (4)"
        subtitle="Non-type effects. Each replaces an effect the visual contract forbids, and each degrades: the blur edge is dropped under reduced motion, the cursor under a coarse pointer, the spark under reduced motion."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Demo name="PixelSwap" origin="reactbits.dev/animations/pixel-swap" note="Cells resolve on a diagonal with one shared spring — an event, not a loop.">
            <PixelSwap />
          </Demo>
          <Demo name="TargetCursor" origin="reactbits.dev/animations/target-cursor" note="Opt-in, fine pointers only. The custom ring never replaces a visible label.">
            <TargetCursor />
          </Demo>
          <Demo name="GradualBlur" origin="reactbits.dev/animations/gradual-blur" note="Scroll-edge effect as a mask over a blur — no gradient literals — and dropped entirely under reduced motion.">
            <GradualBlur />
          </Demo>
          <Demo name="ClickSpark" origin="reactbits.dev/animations/click-spark" note="Fires on pointer-DOWN so the burst and the press feedback land on the same frame.">
            <ClickSpark />
          </Demo>
        </div>
      </Section>

      <Section
        title="Background (1)"
        subtitle="Shape Grid — the reference takes its colours as hex query parameters, and this repo cannot: rule 01a rejects any hex or colour function in src/. So the palette is not a literal but a runtime lookup — a hidden probe wears a token class and the canvas reads the resolved value. Change a token and the background follows; there is no second palette to drift."
      >
        <Demo
          name="ShapeGrid"
          origin="reactbits.dev/backgrounds/shape-grid"
          note="The grid lines are cem.surface and the trail is cem.amber — a hover trail is interaction feedback, and amber is the only colour allowed to mean &quot;this responded to you&quot;. The reference asked for a near-black blue and a dark indigo; neither is a token, and inventing a fifth colour is what the one-accent rule forbids. The mapping is recorded in DESIGN.md §12. The trail follows the pointer and decays at speed; under reduced motion the grid renders once and never lights."
        >
          <div className="space-y-4">
            <ShapeGridPanel
              squareSize={gridSize}
              speed={0.3}
              hoverTrailAmount={gridTrail}
              shape={gridShape}
              direction={gridDirection}
            />
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-cem-secondary">Shape</span>
              {['square', 'circle', 'hexagon', 'triangle'].map((shape) => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => setGridShape(shape)}
                  aria-pressed={gridShape === shape}
                  className={`min-h-9 rounded-md border px-3 text-xs font-medium transition duration-150 ${
                    gridShape === shape
                      ? 'border-cem-amber bg-cem-amber text-cem-base'
                      : 'border-cem-elevated bg-cem-surface text-cem-secondary hover:text-cem-text'
                  }`}
                >
                  {shape}
                </button>
              ))}
              <span className="text-xs font-medium text-cem-secondary">Reveal from</span>
              {['left', 'right', 'up', 'down', 'diagonal'].map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setGridDirection(dir)}
                  aria-pressed={gridDirection === dir}
                  className={`min-h-9 rounded-md border px-3 text-xs font-medium transition duration-150 ${
                    gridDirection === dir
                      ? 'border-cem-amber bg-cem-amber text-cem-base'
                      : 'border-cem-elevated bg-cem-surface text-cem-secondary hover:text-cem-text'
                  }`}
                >
                  {dir}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-cem-secondary">
                size
                <input
                  type="range"
                  min="28"
                  max="72"
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value))}
                  className="w-32 accent-cem-amber"
                />
                <span className="w-8 text-cem-text">{gridSize}</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-cem-secondary">
                hoverTrailAmount
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={gridTrail}
                  onChange={(e) => setGridTrail(Number(e.target.value))}
                  className="w-32 accent-cem-amber"
                />
                <span className="w-8 text-cem-text">{gridTrail}</span>
              </label>
            </div>
          </div>
        </Demo>
      </Section>

      <Section
        title="Navigation"
        subtitle="The wayfinding layer: where am I, where can I go, how do I get out. Selection is persistent and amber, the active item is never colour-only (fill plus a leading bar plus weight), and hover carries no meaning — a tablet is a touch device."
      >
        <Demo
          name="Sidebar navigation"
          origin="macOS sidebar pattern (HIG › Navigation)"
          note="Grouped sections with a persistent selected row. The leading bar is the second channel: if amber is unavailable the row is still unmistakably selected."
        >
          <nav aria-label="Demo" className="flex w-64 flex-col gap-1">
            {[
              ['Repertoire', '128 songs'],
              ['Setlists', '6 lists'],
              ['Gigs', '3 upcoming'],
              ['Rehearsals', 'Next on Thursday'],
            ].map(([label, meta], i) => (
              <button
                key={label}
                type="button"
                aria-current={i === 0 ? 'page' : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-lg px-3 text-left transition duration-150 ${
                  i === 0 ? 'bg-cem-amber/15 text-cem-amber' : 'text-cem-secondary hover:bg-cem-base hover:text-cem-text'
                }`}
              >
                <span className={`h-5 w-1 rounded-full ${i === 0 ? 'bg-cem-amber' : 'bg-transparent'}`} aria-hidden="true" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-cem-secondary">{meta}</span>
                </span>
              </button>
            ))}
          </nav>
        </Demo>
      </Section>

      <Section
        title="Skeleton"
        subtitle="Loading placeholders: the animationType prop, the skeleton--* class names, the synchronized shimmer (a parent sweeping while its children opt out), the global --skeleton-animation override, and isLoaded handing over to real content in place."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Demo
            name="Skeleton"
            note="animationType: shimmer (default, a synchronized sweep), pulse (opacity breathing) and none (a static 50% fill). isLoaded swaps the placeholder for real content — the same shape, so nothing jumps."
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1">
                  <SkeletonLine className="w-32" />
                  <SkeletonLine className="mt-2 w-48" />
                </div>
              </div>
              <div>
                <SkeletonLine />
                <SkeletonLine className="mt-2 w-5/6" />
                <SkeletonLine className="mt-2 w-2/3" />
              </div>
              <Skeleton className="h-24 w-full" />
              <div className="flex gap-3">
                <Skeleton animationType="pulse" className="h-9 w-24" />
                <Skeleton animationType="none" className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          </Demo>
          <Demo
            name="Synchronized shimmer"
            note="One sweep crosses the whole block instead of every placeholder pulsing out of step. That is the parent/children split the reference documents, reproduced with a shared pseudo-element."
          >
            <SkeletonGroup className="grid gap-4 sm:grid-cols-3">
              {['Card', 'Card', 'Card'].map((label) => (
                <div key={label} className="rounded-xl border border-cem-elevated bg-cem-surface p-4">
                  <Skeleton animationType="none" className="h-20 w-full" />
                  <SkeletonLine animationType="none" className="mt-3 w-20" />
                </div>
              ))}
            </SkeletonGroup>
          </Demo>
          <Demo
            name="isLoaded"
            note="The placeholder hands over to real content in place. This is what the page-level skeleton does for the whole /design route while its chunk loads."
          >
            <Skeleton isLoaded className="h-9 w-40">
              <div className="rounded-lg border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text">
                Loaded — the skeleton is gone
              </div>
            </Skeleton>
          </Demo>
        </div>
      </Section>

      <Section
        title="ListBox"
        subtitle="A selection list with the compound API ListBox, ListBox.Item, ListBox.Section and ListBox.ItemIndicator, implemented on react-aria-components. RAC ships the behaviour and no styles, so the BEM classes and the tokens are this repo's."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Demo
            name="ListBox"
            note="selectionMode defaults to single — the documented default for this contract; RAC's own default is none, so it is set explicitly rather than inherited. Amber marks the selection and nothing else; the keyboard focus ring is the same accent at a different moment, so a selected row and a focused row can never be told apart by hue alone."
          >
            <div className="max-w-xs">
              <ListBox
                aria-label="Repertoire folder"
                selectedKeys={folder}
                onSelectionChange={setFolder}
              >
                {FOLDERS.map((name) => (
                  <ListBox.Item key={name} id={name} textValue={name}>
                    <span className="flex-1">{name}</span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
              <p className="mt-3 text-xs text-cem-secondary">
                Selected: {[...folder][0] ?? 'nothing'}
              </p>
            </div>
          </Demo>
          <Demo
            name="Multi-select"
            note="Every selected row keeps its fill, and the indicator is a second channel rather than the only one — the visual system forbids colour-only state. The check stays in the DOM when hidden (visibility, not display) so a row's text never reflows as the selection changes."
          >
            <div className="max-w-xs">
              <ListBox
                aria-label="Tuning"
                selectionMode="multiple"
                selectedKeys={tuning}
                onSelectionChange={setTuning}
              >
                {TUNING.map((name) => (
                  <ListBox.Item key={name} id={name} textValue={name}>
                    <span className="flex-1">{name}</span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
              <p className="mt-3 text-xs text-cem-secondary">
                {tuning.size} selected{tuning.size > 1 ? ' — the keyboard shows the count too' : ''}
              </p>
            </div>
          </Demo>
          <Demo
            name="Sections"
            note="Grouped rows, and the section title is RAC's Header rather than a bare element: RAC's aria-labelledby on the section points at the id the Header registers, so a plain header child would leave the group pointing at nothing. A full listbox vocabulary composes Header/Label/Description/Surface/Kbd around the list; RAC exports none of Description, Surface or Kbd, so those five are not re-invented here — the section label is a header element and the rows are plain text, which is what the existing vocabulary already had."
          >
            <div className="max-w-xs">
              <ListBox aria-label="Setlist actions" selectionMode="none" onAction={setLastAction}>
                <ListBox.Section title="Editing">
                  {['Rename', 'Duplicate', 'Reorder'].map((name) => (
                    <ListBox.Item key={name} id={name} textValue={name}>
                      {name}
                    </ListBox.Item>
                  ))}
                </ListBox.Section>
                <ListBox.Section title="Danger zone">
                  {['Delete setlist'].map((name) => (
                    <ListBox.Item key={name} id={name} textValue={name} variant="danger">
                      {name}
                    </ListBox.Item>
                  ))}
                </ListBox.Section>
              </ListBox>
              <p className="mt-3 text-xs text-cem-secondary">
                onAction: {lastAction || 'nothing yet — press a row'}
              </p>
            </div>
          </Demo>
          <Demo
            name="Disabled items"
            note="disabledKeys is the list-level prop; isDisabled is the per-item one, and both produce data-disabled on the row. A disabled row does not paint a hover fill — hovering something you cannot pick is a lie about what the control does — and opacity carries the state instead of a second grey token, which WCAG 1.4.11 exempts."
          >
            <div className="max-w-xs">
              <ListBox
                aria-label="Export"
                selectionMode="single"
                selectedKeys={exportFormat}
                onSelectionChange={setExportFormat}
                disabledKeys={['pdf']}
              >
                {['mid', 'csv', 'pdf'].map((name) => (
                  <ListBox.Item key={name} id={name} textValue={name} isDisabled={name === 'pdf'}>
                    <span className="flex-1">{name.toUpperCase()}</span>
                    {name === 'pdf' ? (
                      <span className="text-xs text-cem-secondary">10 MB cap</span>
                    ) : (
                      <ListBox.ItemIndicator />
                    )}
                  </ListBox.Item>
                ))}
              </ListBox>
              <p className="mt-3 text-xs text-cem-secondary">
                Format: {[...exportFormat][0] ?? 'nothing'}
              </p>
            </div>
          </Demo>
          <Demo
            name="Virtualizer (1000 items)"
            note="A thousand rows through RAC's Virtualizer, which renders only what the viewport holds. The height container is load-bearing for the same reason it is on FlexCarousel: the virtualizer needs a scroll box to measure against, and a ListLayout with a fixed rowHeight needs that box to exist before it can place anything."
          >
            <div className="h-[460px] max-w-xs">
              <Virtualizer layout={ListLayout} layoutOptions={{ rowHeight: 44 }}>
                <ListBox aria-label="Every song" className="h-full" items={BIG_LIST}>
                  {(song) => (
                    <ListBox.Item id={song.id} textValue={song.label} className="min-h-11">
                      {song.label}
                    </ListBox.Item>
                  )}
                </ListBox>
              </Virtualizer>
            </div>
          </Demo>
        </div>
      </Section>

      <Section title="Icons" subtitle="16px stroke set, stroke 2, currentColor — one token drives icon and label. Grows by feature need, never by catalogue.">
        <DemoCard>
          <div className="flex flex-wrap gap-6 text-cem-text">
            {Object.entries(Icons).map(([name, svg]) => (
              <div key={name} className="flex flex-col items-center gap-2">
                {svg}
                <span className="text-xs text-cem-secondary">{name}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2 rounded-lg border border-cem-elevated bg-cem-surface px-4 py-2 text-sm font-medium text-cem-text">
              {Icons.search} Search songs
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm text-cem-secondary">
              {Icons.chevronRight} Pairs
            </span>
          </div>
        </DemoCard>
      </Section>

      <footer className="mt-12 border-t border-cem-elevated pt-4 text-xs text-cem-secondary">
        Review surface, not a shipped feature: no data, no repository calls,
        lazy-loaded so the product routes do not pay for the motion library. Full
        specification and the deviations list in DESIGN.md at the repo root.
      </footer>
    </div>
  )
}