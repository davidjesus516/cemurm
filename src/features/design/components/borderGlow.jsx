/* eslint-disable react/prop-types */
// borderGlow.jsx — BorderGlow, original reference implementation
// This component brings in the @react-bits/BorderGlow-TS-TW design with
// edge-proximity conic masking, 7-layer mesh gradients, and a 13-layer
// outside glow that follows the cursor.
//
// DEVIATION (forced by rules 01a/01b of scripts/check-visual-contract.sh):
// the reference hands this component colour as raw values — a near-black hex
// background, a violet/pink/sky mesh, and an HSL string it parses itself — and
// none of that may land in src/. The colour props keep their name, their
// position and their arity; what they hold now is a TOKEN name, resolved
// through colors.js, and the per-layer alpha the reference wrote as an HSL
// colour function is folded into an 8-digit hex by withAlpha(), so there is no
// colour-function syntax anywhere in this file. Mapping: violet -> secondary-
// elevated, pink -> amber, sky -> text; the chartreuse glow default -> amber,
// which is what the /design demo note already promises. Rule 04 forbids
// re-declaring the reference's hues as tokens and rule 02's ratchet sits at its
// ceiling, so the one accent plus the light neutrals is the closest a
// one-accent palette gets. Recorded in DESIGN.md.

import { useCallback, useEffect, useRef, useState } from 'react'
import { luminance, useTokenColors, withAlpha } from './colors.js'

// Same thirteen layers, same offsets, blurs, spreads, inset flags and per-layer
// alphas as the reference — only the colour spelling changed.
const GLOW_LAYERS = [
  [0, 0, 0, 1, 1.0, true], [0, 0, 1, 0, 0.6, true], [0, 0, 3, 0, 0.5, true],
  [0, 0, 6, 0, 0.4, true], [0, 0, 15, 0, 0.3, true], [0, 0, 25, 2, 0.2, true],
  [0, 0, 50, 2, 0.1, true],
  [0, 0, 1, 0, 0.6, false], [0, 0, 3, 0, 0.5, false], [0, 0, 6, 0, 0.4, false],
  [0, 0, 15, 0, 0.3, false], [0, 0, 25, 2, 0.2, false], [0, 0, 50, 2, 0.1, false],
]

function buildBoxShadow(color, intensity) {
  if (!color) return undefined
  return GLOW_LAYERS.map(([x, y, blur, spread, alpha, inset]) => {
    const a = Math.min(alpha * intensity, 1)
    return `${inset ? 'inset ' : ''}${x}px ${y}px ${blur}px ${spread}px ${withAlpha(color, a)}`
  }).join(', ')
}

function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3) }
function easeInCubic(x) { return x * x * x }

function animateValue({ start = 0, end = 100, duration = 1000, delay = 0, ease = easeOutCubic, onUpdate, onEnd }) {
  const t0 = performance.now() + delay
  function tick() {
    const elapsed = performance.now() - t0
    const t = Math.min(elapsed / duration, 1)
    onUpdate(start + (end - start) * ease(t))
    if (t < 1) requestAnimationFrame(tick)
    else if (onEnd) onEnd()
  }
  setTimeout(() => requestAnimationFrame(tick), delay)
}

const GRADIENT_POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%']
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1]

function buildMeshGradients(colors) {
  const gradients = []
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)]
    gradients.push(`radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`)
  }
  gradients.push(`linear-gradient(${colors[0]} 0 100%)`)
  return gradients
}

function isLightColor(color) {
  // The reference inlines its own luminance test against a raw hex; the value
  // it gets here is a resolved token, so the same threshold runs through the
  // shared helper — 180 on the 0..255 scale, normalised to 0.706.
  return luminance(color) > 0.706
}

const BorderGlow = ({
  children,
  className = '',
  edgeSensitivity = 30,
  glowColor = 'amber',
  backgroundColor = 'base',
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1.0,
  coneSpread = 25,
  animated = false,
  // The reference's three mesh hues — violet, pink and sky — mapped onto the
  // light neutrals plus the one accent the palette allows (see the header).
  colors = ['secondary-elevated', 'amber', 'text'],
  fillOpacity = 0.5,
}) => {
  const cardRef = useRef(null)
  const [isHovered, setIsHovered] = useState(false)
  const [cursorAngle, setCursorAngle] = useState(45)
  const [edgeProximity, setEdgeProximity] = useState(0)
  const [sweepActive, setSweepActive] = useState(false)

  // Colour props carry token names; this is the probe that turns them back into
  // painted values. `spec` is a fresh object every render, so the hook keys on
  // its serialised form rather than the reference — same contract as every other
  // ported component here.
  const resolved = useTokenColors({
    bg: backgroundColor,
    glow: glowColor,
    ink: 'base',
    ...colors.reduce((acc, leaf, index) => ({ ...acc, [`c${index}`]: leaf }), {}),
  })

  const getCenterOfElement = useCallback((el) => {
    const { width, height } = el.getBoundingClientRect()
    return [width / 2, height / 2]
  }, [])

  const getEdgeProximity = useCallback((el, x, y) => {
    const [cx, cy] = getCenterOfElement(el)
    const dx = x - cx
    const dy = y - cy
    let kx = Infinity
    let ky = Infinity
    if (dx !== 0) kx = cx / Math.abs(dx)
    if (dy !== 0) ky = cy / Math.abs(dy)
    return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1)
  }, [getCenterOfElement])

  const getCursorAngle = useCallback((el, x, y) => {
    const [cx, cy] = getCenterOfElement(el)
    const dx = x - cx
    const dy = y - cy
    if (dx === 0 && dy === 0) return 0
    const radians = Math.atan2(dy, dx)
    let degrees = radians * (180 / Math.PI) + 90
    if (degrees < 0) degrees += 360
    return degrees
  }, [getCenterOfElement])

  const handlePointerMove = useCallback((e) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setEdgeProximity(getEdgeProximity(card, x, y))
    setCursorAngle(getCursorAngle(card, x, y))
  }, [getEdgeProximity, getCursorAngle])

  useEffect(() => {
    if (!animated) return
    const angleStart = 110
    const angleEnd = 465
    setSweepActive(true)
    setCursorAngle(angleStart)

    animateValue({ duration: 500, onUpdate: (v) => setEdgeProximity(v / 100) })
    animateValue({ ease: easeInCubic, duration: 1500, end: 50, onUpdate: (v) => {
      setCursorAngle((angleEnd - angleStart) * (v / 100) + angleStart)
    }})
    animateValue({ ease: easeOutCubic, delay: 1500, duration: 2250, start: 50, end: 100, onUpdate: (v) => {
      setCursorAngle((angleEnd - angleStart) * (v / 100) + angleStart)
    }})
    animateValue({ ease: easeOutCubic, delay: 2500, duration: 1500, start: 100, end: 0,
      onUpdate: (v) => setEdgeProximity(v / 100),
      onEnd: () => setSweepActive(false),
    })
  }, [animated])

  const colorSensitivity = edgeSensitivity + 20
  const isVisible = isHovered || sweepActive
  const borderOpacity = isVisible ? Math.max(0, (edgeProximity * 100 - colorSensitivity) / (100 - colorSensitivity)) : 0
  const glowOpacity = isVisible ? Math.max(0, (edgeProximity * 100 - edgeSensitivity) / (100 - edgeSensitivity)) : 0

  const meshColors = colors.map((_, index) => resolved[`c${index}`])
  const meshReady = Boolean(resolved.bg) && meshColors.every(Boolean)
  // Nothing is composed until the probe lands, so the layer paints late rather
  // than painting a gradient whose colour token has not resolved yet.
  const meshGradients = meshReady ? buildMeshGradients(meshColors) : []
  const borderBg = meshGradients.map(g => `${g} border-box`)
  const fillBg = meshGradients.map(g => `${g} padding-box`)
  const angleDeg = `${cursorAngle.toFixed(3)}deg`
  const lightSurface = isLightColor(resolved.bg)

  // Same shadow layers, offsets and blurs as the reference; only the near-black
  // ink is resolved now instead of spelled out as a raw colour function.
  const ink = resolved.ink
  const darkInk = ink && withAlpha(ink, 0.1)
  const cardShadow = !ink
    ? undefined
    : lightSurface
      ? `${withAlpha(ink, 0.04)} 0 1px 2px, ${withAlpha(ink, 0.05)} 0 8px 24px`
      : `${darkInk} 0 1px 2px, ${darkInk} 0 2px 4px, ${darkInk} 0 4px 8px, ${darkInk} 0 8px 16px, ${darkInk} 0 16px 32px, ${darkInk} 0 32px 64px`

  // The reference stacks three layers here: the card fill, a fully transparent
  // layer that reserves the border box, and the mesh. The transparent one reads
  // the same spelled with the keyword, so no raw colour value exists in source.
  const borderBackground = meshReady
    ? [
        `linear-gradient(${resolved.bg} 0 100%) padding-box`,
        'linear-gradient(transparent 0% 100%) border-box',
        ...borderBg,
      ].join(', ')
    : undefined

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      className={`relative grid isolate border ${lightSurface ? 'border-cem-base/[0.12]' : 'border-cem-text/[0.15]'} ${className}`}
      style={{
        background: resolved.bg,
        borderRadius: `${borderRadius}px`,
        transform: 'translate3d(0, 0, 0.01px)',
        boxShadow: cardShadow,
      }}
    >
      {/* mesh gradient border */}
      <div
        className="absolute inset-0 rounded-[inherit] -z-[1]"
        style={{
          border: '1px solid transparent',
          background: borderBackground,
          opacity: borderOpacity,
          maskImage: `conic-gradient(from ${angleDeg} at center, black ${coneSpread}%, transparent ${coneSpread + 15}%, transparent ${100 - coneSpread - 15}%, black ${100 - coneSpread}%)`,
          WebkitMaskImage: `conic-gradient(from ${angleDeg} at center, black ${coneSpread}%, transparent ${coneSpread + 15}%, transparent ${100 - coneSpread - 15}%, black ${100 - coneSpread}%)`,
          transition: isVisible ? 'opacity 0.25s ease-out' : 'opacity 0.75s ease-in-out',
        }}
      />

      {/* mesh gradient fill near edges */}
      <div
        className="absolute inset-0 rounded-[inherit] -z-[1]"
        style={{
          border: '1px solid transparent',
          background: fillBg.join(', '),
          maskImage: [
            'linear-gradient(to bottom, black, black)',
            'radial-gradient(ellipse at 50% 50%, black 40%, transparent 65%)',
            'radial-gradient(ellipse at 66% 66%, black 5%, transparent 40%)',
            'radial-gradient(ellipse at 33% 33%, black 5%, transparent 40%)',
            'radial-gradient(ellipse at 66% 33%, black 5%, transparent 40%)',
            'radial-gradient(ellipse at 33% 66%, black 5%, transparent 40%)',
            `conic-gradient(from ${angleDeg} at center, transparent 5%, black 15%, black 85%, transparent 95%)`,
          ].join(', '),
          WebkitMaskImage: [
            'linear-gradient(to bottom, black, black)',
            'radial-gradient(ellipse at 50% 50%, black 40%, transparent 65%)',
            'radial-gradient(ellipse at 66% 66%, black 5%, transparent 40%)',
            'radial-gradient(ellipse at 33% 33%, black 5%, transparent 40%)',
            'radial-gradient(ellipse at 66% 33%, black 5%, transparent 40%)',
            'radial-gradient(ellipse at 33% 66%, black 5%, transparent 40%)',
            `conic-gradient(from ${angleDeg} at center, transparent 5%, black 15%, black 85%, transparent 95%)`,
          ].join(', '),
          maskComposite: 'subtract, add, add, add, add, add',
          WebkitMaskComposite: 'source-out, source-over, source-over, source-over, source-over, source-over',
          opacity: borderOpacity * fillOpacity,
          mixBlendMode: lightSurface ? 'normal' : 'soft-light',
          transition: isVisible ? 'opacity 0.25s ease-out' : 'opacity 0.75s ease-in-out',
        }}
      />

      {/* outer glow */}
      <span
        className="absolute pointer-events-none z-[1] rounded-[inherit]"
        style={{
          inset: `${-glowRadius}px`,
          maskImage: `conic-gradient(from ${angleDeg} at center, black 2.5%, transparent 10%, transparent 90%, black 97.5%)`,
          WebkitMaskImage: `conic-gradient(from ${angleDeg} at center, black 2.5%, transparent 10%, transparent 90%, black 97.5%)`,
          opacity: glowOpacity,
          mixBlendMode: lightSurface ? 'normal' : 'plus-lighter',
          transition: isVisible ? 'opacity 0.25s ease-out' : 'opacity 0.75s ease-in-out',
        }}
      >
        <span
          className="absolute rounded-[inherit]"
          style={{
            inset: `${glowRadius}px`,
            boxShadow: buildBoxShadow(resolved.glow, glowIntensity),
          }}
        />
      </span>

      <div className="flex flex-col relative overflow-auto z-[1]">
        {children}
      </div>
    </div>
  )
}

export default BorderGlow