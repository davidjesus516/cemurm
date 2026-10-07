/* eslint-disable react/prop-types */
// accordionGallery.jsx — ported from the reference source the maintainer pasted
// (reactbits `src/content/Components/AccordionGallery/AccordionGallery.tsx`).
//
// WHAT THE EARLIER VERSION GOT WRONG: the version that used to live in blocks.jsx
// was not this component. It was a text accordion — a bordered list of three
// strings with a rotating chevron and an animated height — so the demo on /design
// compared the reference link against an object that does not exist upstream.
// Nothing about the image accordion survived: no image panels, no flexGrow, no
// tilt, no parallax, no grayscale, no label bar.
//
// PRESERVED EXACTLY, because these are the whole component:
//   * `flexGrow` is the animated value (the reference solves
//     `grow = (r * (count - 1)) / (1 - r)` so the ACTIVE panel lands on exactly
//     `expandRatio` of the row, clamped to [0.2, 0.9]). One object moving, not
//     five boxes resizing — the same idea FlexCarousel is built on.
//   * `perspective: 1400px` on the row and `transform-style: preserve-3d` on each
//     panel, with the ±`tilt` rotation fanning away from the active index. That
//     pair is what makes the row read as depth instead of a flat strip.
//   * the media is sized to `--ag-media-size` (measured from the row, `usable *
//     expandRatio * 1.22`) and centred at `xPercent/yPercent: -50`, so the
//     parallax shift never exposes the panel edge.
//   * parallax drift is `clamp(active - i, ±1.5) * parallax * mediaSize * 0.06`
//     — the tiles ahead of the active one drift one way, the ones behind the
//     other.
//   * the label is bar + text revealed together with `stagger`, entering with
//     `opacity 0 → 1` and `x -14 → 0`, exiting at 60% of the enter duration.
//   * `prefers-reduced-motion` collapses the whole timeline to duration 0 —
//     every state is still reachable, nothing moves.
//   * keyboard: arrows (both axes) wrap around the row, `tabIndex` per panel,
//     `role="list"` / `role="listitem"`, `aria-current` on the active panel.
//   * `ResizeObserver` re-measures and re-applies the layout, so the ratio holds
//     after a resize.
//
// COLOUR, the substitution this component cannot avoid. The reference takes
// three colour props filled with hex literals and composes its overlay with two
// `color-mix` stops. Rule 01a of scripts/check-visual-contract.sh is
// ENFORCING over `src/` — `.jsx` and `.css` alike — and rejects every hex and
// every colour function (`rgb/rgba/hsl/hsla/oklch/oklab/lab/lch/hwb/color-mix`).
// So:
//   * `accentColor`, `overlayColor` and `textColor` keep their NAMES and their
//     POSITION in the API, but take a token NAME instead of a hex string,
//     resolved at runtime by `useTokenColors` (colors.js). Default mapping:
//     accent → `amber` (the active/selected state; DESIGN.md §6 "Selected → ámbar
//     + barra líder", same as the leader bar in blocks.jsx), overlay → `base`,
//     text → `text`. Change a token in tailwind.config.js and the gallery
//     follows; there is no second palette to drift.
//   * the panel background (a near-black hex fill in the reference) becomes `bg-cem-surface`, so an image
//     that fails to load (the reference's own items are remote `picsum.photos`
//     URLs) reads as a dark tile instead of a hole.
//   * the overlay's two `color-mix` stops become two stacked layers with the
//     alpha folded into element `opacity` — the precedent SpotlightCard and
//     HoldButton set. `linear-gradient` is not a colour function and passes.
//   * the shadows (`rgba` at .8 and .55 black) and the accent glow
//     (a `color-mix` at 60%) live in reference.css as real rules, the shadows
//     through Tailwind's `theme('colors.cem.*' / α)` alpha syntax, which is not
//     a colour function either (precedent: reference.css:1166, :1255). The
//     glow runs at full alpha because 01a forbids its 60% form.
//   * the focus ring is `cem.text`, NEVER amber: DESIGN.md §6 "Focused → anillo
//     2px `text` al 90%". The reference reuses its accent for the ring, so that
//     arbitrary class was dropped.
//
// ONE BUG FIXED, because it silently disabled half the effect. The reference
// writes `--ag-dim` on the MEDIA element, but the overlay layers are SIBLINGS of
// the media, not descendants — CSS custom properties inherit down, never up, so
// `var(--ag-dim)` on the overlay always fell back to 0.35. Every panel, active
// included, was permanently dimmed and the dim tween animated nothing. Here the
// tween writes `--ag-dim` on the PANEL, where it inherits to both overlay
// layers, so the intended values hold: active 0, inactive 0.35.
//
// MOTION BUDGET. This set animates transform/opacity only, with two recorded
// exceptions: `flexGrow`, which FlexCarousel already animates (blocks.jsx:159),
// and the grayscale below. `--ag-gray` is a NUMBER tweened by GSAP; the filter is
// `grayscale(var(--ag-gray))`, so the property on screen is still one
// declarative value per state rather than a filter animation GSAP owns.
// Both are recorded in DESIGN.md §12.

import { useCallback, useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useTokenColors } from './colors.js'
import './reference.css'

const DEFAULT_ITEMS = [
  { image: 'https://picsum.photos/id/1015/900/1200', label: 'Canyon', link: '#' },
  { image: 'https://picsum.photos/id/1018/900/1200', label: 'Ridgeline', link: '#' },
  { image: 'https://picsum.photos/id/1039/900/1200', label: 'Falls', link: '#' },
  { image: 'https://picsum.photos/id/1043/900/1200', label: 'Harbour', link: '#' },
  { image: 'https://picsum.photos/id/1044/900/1200', label: 'Skyline', link: '#' },
]

export function AccordionGallery({
  items = DEFAULT_ITEMS,
  defaultIndex = 2,
  accentColor = 'amber',
  overlayColor = 'base',
  textColor = 'text',
  height = 460,
  gap = 10,
  radius = 16,
  expandRatio = 0.52,
  orientation = 'horizontal',
  duration = 0.6,
  ease = 'power3.out',
  parallax = 0.5,
  tilt = 8,
  stagger = 0.06,
  trigger = 'hover',
  showLabels = true,
  grayscale = true,
  className = '',
}) {
  const rootRef = useRef(null)
  const panelRefs = useRef([])
  const mediaRefs = useRef([])
  const barRefs = useRef([])
  const textRefs = useRef([])
  const tlRef = useRef(null)
  const firstRunRef = useRef(true)
  const mediaSizeRef = useRef(320)

  const vertical = orientation === 'vertical'
  const count = items.length
  const [active, setActive] = useState(Math.min(Math.max(defaultIndex, 0), count - 1))

  // Token names in, resolved colour strings out. Empty on the first pass, so the
  // structure renders first and paints colour on the layout pass after — the
  // ordering colors.js is written for.
  const colors = useTokenColors({
    accent: accentColor,
    overlay: overlayColor,
    text: textColor,
  })

  const prefersReduced =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  const applyLayout = useCallback(
    (animate) => {
      const panels = panelRefs.current
      if (!panels.length) return

      const r = Math.min(Math.max(expandRatio, 0.2), 0.9)
      const grow = count > 1 ? (r * (count - 1)) / (1 - r) : 1
      const mediaSize = mediaSizeRef.current

      tlRef.current?.kill()
      const dur = animate && !prefersReduced ? duration : 0
      const tl = gsap.timeline()

      panels.forEach((panel, i) => {
        if (!panel) return
        const isActive = i === active
        const media = mediaRefs.current[i]
        const bar = barRefs.current[i]
        const text = textRefs.current[i]

        const rot = isActive ? 0 : i < active ? tilt : -tilt
        const rotProp = vertical ? { rotateX: -rot } : { rotateY: rot }

        // `--ag-dim` rides on the panel, NOT on the media: the overlay layers are
        // siblings of the media, so a custom property written there would never
        // reach them and the dim would sit frozen at its fallback.
        tl.to(
          panel,
          { flexGrow: isActive ? grow : 1, '--ag-dim': isActive ? 0 : 0.35, ...rotProp, duration: dur, ease },
          0,
        )

        if (media) {
          const drift = Math.max(-1.5, Math.min(1.5, active - i))
          const shift = drift * parallax * mediaSize * 0.06
          const gray = grayscale ? (isActive ? 0 : 1) : 0
          tl.to(
            media,
            {
              xPercent: -50,
              yPercent: -50,
              x: vertical ? 0 : isActive ? 0 : shift,
              y: vertical ? (isActive ? 0 : shift) : 0,
              '--ag-gray': gray,
              duration: dur,
              ease,
            },
            0,
          )
        }

        if (showLabels && bar && text) {
          if (isActive) {
            tl.to(
              [bar, text],
              { opacity: 1, x: 0, duration: dur, ease, stagger: prefersReduced ? 0 : stagger },
              0,
            )
          } else {
            tl.to([bar, text], { opacity: 0, x: -14, duration: dur * 0.6, ease }, 0)
          }
        }
      })

      tlRef.current = tl
    },
    [
      active,
      count,
      expandRatio,
      duration,
      ease,
      vertical,
      tilt,
      parallax,
      grayscale,
      showLabels,
      stagger,
      prefersReduced,
    ],
  )

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const measure = () => {
      const rect = el.getBoundingClientRect()
      const total = vertical ? rect.height : rect.width
      const usable = Math.max(total - gap * (count - 1), 120)
      const size = Math.max(140, usable * Math.min(Math.max(expandRatio, 0.2), 0.9) * 1.22)
      mediaSizeRef.current = size
      el.style.setProperty('--ag-media-size', `${size}px`)
      applyLayout(!firstRunRef.current)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [applyLayout, gap, count, expandRatio, vertical])

  useEffect(() => {
    applyLayout(!firstRunRef.current)
    firstRunRef.current = false
  }, [applyLayout])

  useEffect(() => () => {
    tlRef.current?.kill()
  }, [])

  const handleEnter = (i) => {
    if (trigger === 'hover') setActive(i)
  }

  const handleClick = (i, e) => {
    if (i !== active) {
      e.preventDefault()
      setActive(i)
    }
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i + 1) % count)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i - 1 + count) % count)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`flex ${vertical ? 'flex-col' : 'flex-row'} w-full max-w-full [perspective:1400px] max-[520px]:!flex-col max-[520px]:[perspective:none] ${className}`}
      style={{ gap: `${gap}px`, height: vertical ? `${Math.round(height * 1.6)}px` : `${height}px` }}
      role="list"
      aria-label="Image accordion gallery"
    >
      {items.map((item, i) => {
        const isActive = i === active
        const Tag = item.link ? 'a' : 'div'
        return (
          <Tag
            key={i}
            ref={(el) => {
              panelRefs.current[i] = el
            }}
            className="ag-panel group relative block min-w-0 min-h-0 flex-[1_1_0] cursor-pointer overflow-hidden bg-cem-surface no-underline outline-none [transform-style:preserve-3d] [transform-origin:center] max-[520px]:min-h-[84px] max-[520px]:!transform-none"
            style={{
              borderRadius: `${radius}px`,
              '--ag-accent': colors.accent,
              '--ag-overlay': colors.overlay,
              '--ag-text': colors.text,
              willChange: 'flex-grow, transform',
            }}
            href={item.link || undefined}
            onClick={(e) => handleClick(i, e)}
            onMouseEnter={() => handleEnter(i)}
            onFocus={() => setActive(i)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            role="listitem"
            tabIndex={0}
            aria-current={isActive ? 'true' : undefined}
            aria-label={item.label}
          >
            <span className="absolute inset-0 overflow-hidden [border-radius:inherit]">
              <span
                ref={(el) => {
                  mediaRefs.current[i] = el
                }}
                className="ag-media absolute top-1/2 left-1/2"
                style={{
                  width: vertical ? '100%' : 'var(--ag-media-size, 320px)',
                  height: vertical ? 'var(--ag-media-size, 320px)' : '100%',
                  willChange: 'transform, filter',
                }}
              >
                <img
                  src={item.image}
                  alt={item.alt || item.label || ''}
                  draggable={false}
                  className="block h-full w-full select-none object-cover [-webkit-user-drag:none]"
                />
              </span>
              {/* Two layers where the reference had two `color-mix` background
                  stops: the dim reads `--ag-dim` off the panel, the scrim keeps
                  its own constant 78% and sits on top. */}
              <span className="ag-dim pointer-events-none absolute inset-0" aria-hidden="true" />
              <span className="ag-scrim pointer-events-none absolute inset-0" aria-hidden="true" />
            </span>
            {showLabels && (
              <span
                className="pointer-events-none absolute bottom-5 left-5 right-5 z-[2] flex items-center gap-3"
                aria-hidden="true"
              >
                <span
                  ref={(el) => {
                    barRefs.current[i] = el
                  }}
                  className="ag-bar h-[26px] w-[3px] flex-none rounded-[3px] opacity-0"
                />
                <span
                  ref={(el) => {
                    textRefs.current[i] = el
                  }}
                  className="ag-label overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(1rem,1.4vw,1.4rem)] font-semibold tracking-[0.01em] opacity-0"
                >
                  {item.label}
                </span>
              </span>
            )}
          </Tag>
        )
      })}
    </div>
  )
}

export default AccordionGallery
