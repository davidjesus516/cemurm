import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as Components from './index.js'

// Render smoke for the /design component set.
//
// WHY THIS EXISTS: `pnpm build` only proves the module graph compiles. It does
// not prove a component can mount — a bad hook order, a missing prop, a Motion
// API typo or a reference to an undefined identifier all compile fine and then
// throw on first paint, which for /design means a blank page and a broken
// review. Rendering every exported component server-side exercises the render
// path of all 35 without a browser.
//
// NOT A CHARACTERIZATION TEST of product behaviour: /design is a review surface
// with no data. This asserts one thing — every component mounts and produces
// markup — and the roster, so deleting or renaming a component fails it.
//
// ONE EXPECTED WARNING, and it is not a defect: Shredder settles its rows in a
// useLayoutEffect, which React reports as a no-op under renderToStaticMarkup.
// The app mounts with createRoot and never server-renders, so the effect runs
// for real in the browser; changing it to useEffect would let the rows paint
// once before settling. The warning is the cost of asserting the render path
// without a DOM.
//
// The roster is explicit rather than derived from the export shape: the barrel
// also exports the spring presets and the helpers (usePrefersReducedMotion,
// rubberband, clamp...), and a name-shape heuristic cannot tell a component from
// a hook — it tried to render all of them as elements and failed.

const NAMES = [
  // micro — 14
  'Shredder',
  'SpringCheck',
  'SwipeRow',
  'SwipeToast',
  'WakeSlider',
  'WarmTooltip',
  'GlideSelect',
  'LatticeLoader',
  'PeekRating',
  'JellyRadio',
  'PulseHeart',
  'BellToggle',
  'StatusMark',
  'HoldButton',
  // components — 13
  'Dock',
  'SpotlightCard',
  'BorderGlow',
  'GlassIcons',
  'Counter',
  'Stepper',
  'MorphSlider',
  'AccordionGallery',
  'SpecularButton',
  'OptionWheel',
  'AnimatedList',
  'CardNav',
  'FlexCarousel',
  // text-animations — 4
  'TextLoop',
  'ScrollVelocity',
  'VariableProximity',
  'CountUp',
  // animations — 4
  'PixelSwap',
  'TargetCursor',
  'GradualBlur',
  'ClickSpark',
  // backgrounds — 1
  'ShapeGrid',
  // micro — built to the reference prop surface, no upstream file to read
  'CodeSlots',
]

describe('design component set', () => {
  it('exports every component on the roster', () => {
    const missing = NAMES.filter((name) => typeof Components[name] !== 'function')
    expect(missing).toEqual([])
    expect(NAMES).toHaveLength(37)
  })

  it('renders every component without throwing', () => {
    const failures = []
    for (const name of NAMES) {
      try {
        const html = renderToStaticMarkup(createElement(Components[name]))
        if (typeof html !== 'string' || html.length === 0) {
          failures.push(`${name}: rendered empty markup`)
        }
      } catch (error) {
        failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    expect(failures).toEqual([])
  })
})