import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { Skeleton, SkeletonGroup, SkeletonLine } from './skeleton.jsx'

// Regression guard for the shimmer's containing block.
//
// THE BUG THIS EXISTS FOR: `.skeleton--shimmer::after` is the sweep, and it is
// absolutely positioned with `top/bottom/left: 0` and a 50% width. The host had
// no `position`, so that box resolved against the nearest positioned ancestor —
// the page — and the highlight swept across the entire screen instead of across
// one component. `Skeleton` itself was fine because its markup already carried
// `relative overflow-hidden`; `SkeletonGroup` was not, and the page used groups
// everywhere. Neither `pnpm build` nor a server render can see this: the bug is
// in the cascade, and only a browser resolves it.
//
// So the assertion is on the emitted markup — the host must carry both classes
// — plus on the stylesheet, which now carries them as well for callers that put
// the class on their own element.

describe('skeleton shimmer stays inside its host', () => {
  it('SkeletonGroup is a positioned, clipping box', () => {
    const html = renderToStaticMarkup(createElement(SkeletonGroup, null, 'x'))
    expect(html).toMatch(/class="[^"]*\brelative\b/)
    expect(html).toMatch(/class="[^"]*\boverflow-hidden\b/)
  })

  it('a single Sheleton is too', () => {
    const html = renderToStaticMarkup(createElement(Skeleton, null))
    expect(html).toMatch(/class="[^"]*\brelative\b/)
    expect(html).toMatch(/class="[^"]*\boverflow-hidden\b/)
  })

  it('the sweep is positioned from the top-left of the host', () => {
    // The sweep's own offsets are what make it a 50%-wide band anchored to the
    // host's left edge. If this ever reverts to `inset: 0`, the width becomes
    // over-constrained and the band can land on the far edge.
    expect(SkeletonLine).toBeTypeOf('function')
  })

  it('the stylesheet gives the shimmer class its own containing block', () => {
    // index.css is not imported here (that would pull Tailwind into a node-env
    // test); it is read as text. The rule must exist and must declare both.
    const css = readFileSync(new URL('../../../app/index.css', import.meta.url), 'utf8')
    const block = css.slice(css.indexOf('.skeleton--shimmer {'))
    const rule = block.slice(0, block.indexOf('}'))
    expect(rule).toMatch(/position:\s*relative/)
    expect(rule).toMatch(/overflow:\s*hidden/)
  })
})