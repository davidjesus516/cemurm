import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import DesignSystem from './DesignSystem.jsx'

// Contract test for the /design page itself.
//
// WHY: the request behind this page was explicit — every component of the set
// must be ON the page, not merely exported from the barrel. The barrel is
// covered by components.test.jsx; this asserts the other half, so deleting a
// <Demo> block, renaming a component in the page, or rendering one twice fails
// here instead of failing silently in review.
//
// Rendered server-side for the same reason as the sibling test: a compile is not
// a mount. No jsdom in this repo, and none is needed — the requirement is about
// the rendered tree, not about interaction.

const ROSTER = [
  'Shredder', 'SpringCheck', 'SwipeRow', 'SwipeToast', 'WakeSlider',
  'WarmTooltip', 'GlideSelect', 'LatticeLoader', 'PeekRating', 'JellyRadio',
  'PulseHeart', 'BellToggle', 'StatusMark', 'HoldButton',
  'Dock', 'SpotlightCard', 'BorderGlow', 'GlassIcons', 'Counter', 'Stepper',
  'MorphSlider', 'AccordionGallery', 'SpecularButton', 'OptionWheel',
  'AnimatedList', 'CardNav', 'FlexCarousel',
  'TextLoop', 'ScrollVelocity', 'VariableProximity', 'CountUp',
  'PixelSwap', 'TargetCursor', 'GradualBlur', 'ClickSpark',
  'ShapeGrid', 'ListBox',
]

describe('/design page', () => {
  const html = renderToStaticMarkup(createElement(DesignSystem))

  it('renders every component of the roster exactly once', () => {
    const missing = []
    const duplicated = []
    for (const name of ROSTER) {
      // Anchored on the </h3> closing the Demo title, NOT on a bare >Name<.
      // A bare match double-counts: Shredder's own demo prints the word
      // "Shredder" as its label, so the component body collides with its title.
      const occurrences = html.split(`>${name}</h3>`).length - 1
      if (occurrences === 0) missing.push(name)
      if (occurrences > 1) duplicated.push(`${name} x${occurrences}`)
    }
    expect({ missing, duplicated }).toEqual({ missing: [], duplicated: [] })
    // 37 after ListBox joined the roster. The count is asserted rather than
    // derived so that ADDING a name without wiring a <Demo> for it fails here,
    // which is the whole contract of this file.
    expect(ROSTER).toHaveLength(37)
  })

  it('keeps the token foundations alongside the components', () => {
    // The page is the style guide, not a component gallery: the ramp, the type
    // ramp and the scales have to survive the rewrite. Section headings are
    // asserted in their RENDERED form — renderToStaticMarkup escapes "&" as
    // "&amp;", so asserting the source spelling would fail on a correct page.
    for (const section of ['cem.base', 'cem.amber', 'display —', 'space-1 · 4', 'Elevation &amp; material']) {
      expect(html).toContain(section)
    }
  })
})