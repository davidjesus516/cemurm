// index.js — one import surface for the /design component set.
//
// The pieces are grouped the way the reference library groups them, so a
// reviewer can diff like against like:
//
//   micro (14)          one-control interactions: press, drag, hold, peek
//   components (13)     larger surfaces: dock, wheel, carousel, nav, stepper
//   text-animations (4) type that moves
//   animations (4)      non-type effects: swap, cursor, blur edge, spark
//
// THIRTEEN of them are faithful ports of the reference source, in their own
// files with the reference's own stylesheet (reference.css):
//
//   shredder.jsx    paper shredder: rows are snapshotted to a texture, sliced
//                   into strips and run through a real simulation
//   swipeRow.jsx    position map + rubber-band + momentum projection
//   swipeToast.jsx  WAAPI burn fuse, pausable on hover/focus/hide
//   glideSelect.jsx pill written imperatively in layout effects
//   peekRating.jsx  preview-then-commit, tip tracks the slot
//   jellyRadio.jsx  one spring set per chip
//   dock.jsx        item SIZE is the animated value; the panel grows
//   glassIcons.jsx  three 3D planes: colour plate, glass face, rising label
//   holdButton.jsx  rAF-written --hb-p drives a clip-path fill and two SVG
//                   mask offsets; the crest is a mask, not a draw
//   accordionGallery.jsx
//                   flexGrow is the animated value; perspective turns the
//                   ±8° fan into depth
//   cardNav.jsx     GSAP opens the 60px bar to a measured height while three
//                   link cards rise with a 0.08 stagger
//   springCheck.jsx spring checkmark with a discrete snap; fidelity port of
//                   the reference micro source
//   morphSlider.jsx spring-driven thumb with momentum landing and discrete
//                   steps over a track that fills behind it
//
// All of them are token-safe: colours resolve from the cem-* layer at runtime
// (see colors.js), never as literals. See motion.js for the shared spring
// vocabulary and DESIGN.md §12 for the fidelity ledger.

// micro — 14
export {
  BellToggle,
  LatticeLoader,
  PulseHeart,
  StatusMark,
  WarmTooltip,
} from './micro.jsx'

// micro — ported from the reference source, geometry intact
export { GlideSelect } from './glideSelect.jsx'

// components — ported from the reference source
export { default as WakeSlider } from './wakeSlider.jsx'
// The reference slot 14. Moved out of micro.jsx, which carried an
// approximation of it; this is the port, with the reference stylesheet.
export { HoldButton } from './holdButton.jsx'
export { JellyRadio } from './jellyRadio.jsx'
export { PeekRating } from './peekRating.jsx'
export { Shredder } from './shredder.jsx'
// Moved out of micro.jsx, which carried an approximation: one motion value,
// five imperative channels, and a pointer tap that confirms without animating.
export { default as SpringCheck } from './springCheck.jsx'
export { SwipeRow } from './swipeRow.jsx'
export { SwipeToast } from './swipeToast.jsx'

// components — 13
export {
  AnimatedList,
  Counter,
  OptionWheel,
  SpecularButton,
  Stepper,
} from './blocks.jsx'

// components — ported from the reference source
export { MorphSlider } from './morphSlider.jsx'
export { AccordionGallery } from './accordionGallery.jsx'
export { CardNav } from './cardNav.jsx'
export { default as FlexCarousel } from './flexCarousel.jsx'
export { default as BorderGlow } from './borderGlow.jsx'
export { GlassIcons } from './glassIcons.jsx'
export { Dock } from './dock.jsx'
// A faithful port, but upstream ships Tailwind classes only (the
// shadcn registry variant), so it has no reference.css section.
export { SpotlightCard } from './spotlightCard.jsx'

// text-animations — 4
export {
  CountUp,
  ScrollVelocity,
  TextLoop,
  VariableProximity,
} from './textAnimations.jsx'

// animations — 4
export {
  ClickSpark,
  GradualBlur,
  PixelSwap,
  TargetCursor,
} from './animations.jsx'

// backgrounds — 1 (the canvas plus its sized wrapper; the page renders the panel)
export { ShapeGrid, ShapeGridPanel } from './backgrounds.jsx'

// RAC-backed (react-aria-components) — a THIRD category, not a port.
//
// These are NOT ports of the reference source and are deliberately absent from
// the THIRTEEN list above. A port has an upstream file that was read and
// reproduced; these have an upstream API DOCUMENT that is mirrored because the
// package ships peer-requiring React >=19 + Tailwind >=4
// and Tailwind >=4, and its theme would inject a second colour system, which
// rule 04 forbids. The behaviour comes from `react-aria-components`:
// keyboard navigation, typeahead, focus
// management, selection state, virtualization and the ARIA listbox pattern are
// RAC's, and the BEM classes and tokens are ours. RAC ships no styles and no
// colours, so the styling half is hand-written either way.
// `skeleton.jsx` is in the same category but goes the other way: the source
// behaviour is mirrored outright, because there is no library underneath it to
// outsource to.

// listbox — RAC-backed, documented contract (mirrored from upstream API)
export { ListBox } from './listBox.jsx'

// skeleton — documented-contract loading placeholders, mirrored (no RAC layer)
export { DesignPageSkeleton, Skeleton, SkeletonGroup, SkeletonLine } from './skeleton.jsx'

// micro — built to the reference prop surface (no upstream file to read)
export { CodeSlots } from './codeSlots.jsx'

// shared motion vocabulary
export {
  SPRING_MOMENTUM,
  SPRING_SHEET,
  SPRING_SOFT,
  SPRING_UI,
  clamp,
  projectMomentum,
  rubberband,
  shouldCommit,
  usePrefersReducedMotion,
} from './motion.js'
