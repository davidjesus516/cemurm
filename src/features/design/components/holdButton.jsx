/* eslint-disable react/prop-types */
// holdButton.jsx — ported from the reference source
// (react-bits HoldButton, TSX + its inline <style> block).
//
// WHAT IS PRESERVED: the rAF drive loop that writes --hb-p, the double gate on
// completion (the rAF arrival AND the 100ms timer, each re-checking that the
// hold actually lasted holdTime - 50), the release that decides tap vs hold
// from a 250ms threshold, the 10px hit-pad that cancels a drifted pointer, the
// pointer-capture handoff, the Escape/blur/visibilitychange cancels, the
// ResizeObserver that keeps --hb-w/--hb-h honest, and the two-label grid where
// the resting label blurs out while the done label blurs in. The wavelet crest
// is an SVG mask, not a draw: it is the reference's own data URI, rule for rule,
// now in reference.css.
//
// THREE DEVIATIONS, all forced by the token layer:
//
//   1. COLOUR DEFAULTS. The four colour props keep their names and their
//      positions but take a TOKEN NAME, resolved at runtime by colors.js, as
//      every other ported component does (rule 01a rejects hex in src/). The
//      mapping is DESIGN.md's: surface / amber / text / base. The reference's
//      violet fill cannot exist here at all — rule 04 is palette growth, and
//      one amber accent is the whole visual system.
//   2. fillTextColor DEFAULTS TO cem.base, not white. White or cem.text on
//      cem.amber measures 2.1:1, under the 4.5:1 AA floor, in exactly the state
//      the component exists to communicate; cem.base on the same amber is
//      8.3:1. Authorised by the maintainer. The prop itself is untouched.
//   3. THE GLOW SHADOW MOVED INTO reference.css, ON A ::after LAYER. Two
//      reasons, both forced. (a) The original injects it as a `shadow-`
//      arbitrary-value utility whose value is a JS template literal, and
//      Tailwind v3 scans source text for COMPLETE class strings — an
//      interpolation means the parser never sees the class, so the glow is
//      never generated and the button has no glow at all. That is an upstream
//      bug, not a port decision, and moving the rule into the stylesheet is
//      where it is fixed. (b) The glow's colour is a colour MIX against
//      transparent and
//      the inset top highlight is a white literal; rule 01a bans colour
//      functions and literals in src/, and reference.css is inside src/. So
//      the glow is a
//      ::after box-shadow carrying the resolved --hb-fill at full strength
//      with the 0.7 folded into the LAYER's opacity (SpotlightCard's
//      precedent), and the top highlight uses cem.text at 0.06 alpha. Same
//      colour, same 10px/32px/-6px geometry, same intensity.
//   4. THE HOVER BACKGROUND IS cem.hover. The original mixes the button's own
//      background 92% with white, which is a colour function over a runtime
//      value — unrepresentable without one. cem.hover is the nearest token in
//      the ramp. Note the consequence honestly: it ignores backgroundColor,
//      so a caller who passes a custom background loses the hover lift.
//
// ONE THING NOT TO "FIX" IN THIS COMMENT. Paragraph 3(a) deliberately does NOT
// write the upstream glow class out in full, even though doing so would read
// better. Tailwind's extractor does not parse JavaScript: it cannot tell that a
// candidate string sits inside a `//` comment, so writing the complete
// `shadow-[…]` utility here made Tailwind GENERATE a rule for a class that does
// not exist, carrying a literal `${GLOW}` into `--tw-shadow-color`. esbuild then
// warned three times and the invalid rule shipped in dist. reference.css quotes
// the full literal safely because tailwind.config.js scans only
// `./src/**/*.{js,ts,jsx,tsx}` — CSS is not in the content globs. Keep the
// bracket pair out of this file.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTokenColors } from './colors.js'
import './reference.css'

const TAP_MS = 250
const HIT_PAD = 10
const LINEAR = (t) => t
const EASE_OUT = (t) => 1 - Math.pow(1 - t, 3)

const SIZES = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-[22px] text-[15px]',
  lg: 'h-[52px] px-7 text-[17px]',
}

const LABEL_SPAN =
  '[grid-area:1/1] inline-flex items-center gap-2 whitespace-nowrap [transition:opacity_200ms_ease,filter_200ms_ease]'

const HoldButton = ({
  children = 'Hold to delete',
  doneLabel = 'Deleted',
  icon = null,
  doneIcon = null,
  backgroundColor = 'surface',
  fillColor = 'amber',
  textColor = 'text',
  fillTextColor = 'base',
  size = 'md',
  radius = 14,
  fillDirection = 'right',
  holdTime = 2000,
  releaseTime = 200,
  pressScale = 0.97,
  wave = true,
  waveAmplitude = 6,
  glow = true,
  resetAfter = 1200,
  disabled = false,
  onHold,
  onTap,
  className = '',
}) => {
  const [phase, setPhase] = useState('idle')
  const [input, setInput] = useState(null)
  const phaseRef = useRef('idle')
  const inputRef = useRef(null)
  const buttonRef = useRef(null)
  const gesture = useRef({ pointerId: null, start: 0, rect: null })
  const timers = useRef({ complete: 0, reset: 0 })
  const hintId = useId()

  const colors = useTokenColors({
    bg: backgroundColor,
    fill: fillColor,
    text: textColor,
    fillText: fillTextColor,
  })

  const go = (next, kind = null) => {
    phaseRef.current = next
    inputRef.current = kind
    setPhase(next)
    setInput(kind)
  }

  const clearTimers = () => {
    clearTimeout(timers.current.complete)
    clearTimeout(timers.current.reset)
  }

  const motion = useRef({ raf: 0, p: 0, from: 0, to: 0, start: 0 })
  const drive = (to, duration, ease) => {
    const m = motion.current
    cancelAnimationFrame(m.raf)
    m.from = m.p
    m.to = to
    m.start = performance.now()
    const step = (now) => {
      const t = duration > 0 ? Math.min(1, (now - m.start) / duration) : 1
      m.p = m.from + (m.to - m.from) * ease(t)
      buttonRef.current?.style.setProperty('--hb-p', m.p.toFixed(4))
      if (t < 1) {
        m.raf = requestAnimationFrame(step)
        return
      }
      m.raf = 0
      if (m.to === 1) complete()
    }
    m.raf = requestAnimationFrame(step)
  }

  const complete = () => {
    if (phaseRef.current !== 'holding') return
    if (performance.now() - gesture.current.start < holdTime - 50) return
    clearTimers()
    go('done', inputRef.current)
    onHold?.()
    if (resetAfter > 0) {
      timers.current.reset = window.setTimeout(() => {
        go('idle')
        drive(0, releaseTime, EASE_OUT)
      }, resetAfter)
    }
  }

  const begin = (kind) => {
    if (disabled || phaseRef.current !== 'idle') return false
    const button = buttonRef.current
    if (!button) return false
    gesture.current.start = performance.now()
    gesture.current.rect = button.getBoundingClientRect()
    go('holding', kind)
    drive(1, holdTime, LINEAR)
    timers.current.complete = window.setTimeout(complete, holdTime + 100)
    return true
  }

  const release = ({ drifted = false } = {}) => {
    if (phaseRef.current !== 'holding') return
    clearTimers()
    const held = performance.now() - gesture.current.start
    go('idle')
    drive(0, releaseTime, EASE_OUT)
    if (!drifted && held < TAP_MS) onTap?.()
  }
  const releaseRef = useRef(release)
  releaseRef.current = release

  const handlePointerDown = (e) => {
    if (e.button !== 0 || !e.isPrimary || gesture.current.pointerId !== null) return
    if (!begin('pointer')) return
    gesture.current.pointerId = e.pointerId
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Pointer capture is best-effort: a browser that refuses it still lets
      // the gesture finish through the move/up handlers.
    }
  }

  const endPointer = (e, options) => {
    if (e.pointerId !== gesture.current.pointerId) return
    gesture.current.pointerId = null
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Same as above: a capture that was never taken throws here, and the
      // release still has to happen.
    }
    release(options)
  }

  const handlePointerMove = (e) => {
    if (e.pointerId !== gesture.current.pointerId) return
    const r = gesture.current.rect
    if (!r) return
    const out =
      e.clientX < r.left - HIT_PAD ||
      e.clientX > r.right + HIT_PAD ||
      e.clientY < r.top - HIT_PAD ||
      e.clientY > r.bottom + HIT_PAD
    if (out) endPointer(e, { drifted: true })
  }

  const handlePointerLeave = (e) => {
    if (e.pointerType !== 'touch') endPointer(e, { drifted: true })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (inputRef.current === 'key') release({ drifted: true })
      return
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (!e.repeat) begin('key')
    }
  }

  const handleKeyUp = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (inputRef.current === 'key') release()
    }
  }

  useLayoutEffect(() => {
    const button = buttonRef.current
    if (!button) return undefined
    const measure = () => {
      button.style.setProperty('--hb-w', `${button.offsetWidth}px`)
      button.style.setProperty('--hb-h', `${button.offsetHeight}px`)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(button)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (phase !== 'holding') return undefined
    const cancel = () => releaseRef.current({ drifted: true })
    const onVisibility = () => {
      if (document.hidden) cancel()
    }
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', cancel)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [phase])

  useEffect(() => {
    const t = timers.current
    const m = motion.current
    return () => {
      clearTimeout(t.complete)
      clearTimeout(t.reset)
      cancelAnimationFrame(m.raf)
    }
  }, [])

  const direction = fillDirection === 'up' ? 'up' : 'right'
  const labels = (
    <>
      <span
        className={`${LABEL_SPAN} group-data-[phase=done]:opacity-0 group-data-[phase=done]:blur-[2px]`}
        aria-hidden={phase === 'done'}
      >
        {icon ? <span className="inline-flex flex-none [&>svg]:block">{icon}</span> : null}
        {children}
      </span>
      <span
        className={`${LABEL_SPAN} opacity-0 blur-[2px] group-data-[phase=done]:opacity-100 group-data-[phase=done]:blur-0`}
        aria-hidden={phase !== 'done'}
      >
        {doneIcon ? <span className="inline-flex flex-none [&>svg]:block">{doneIcon}</span> : null}
        {doneLabel}
      </span>
    </>
  )

  const cssVars = {
    '--hb-radius': `${radius}px`,
    '--hb-bg': colors.bg,
    '--hb-fill': colors.fill,
    '--hb-text': colors.text,
    '--hb-fill-text': colors.fillText,
    '--hb-hold': `${holdTime}ms`,
    '--hb-cycles': holdTime / 1100,
    '--hb-release': `${releaseTime}ms`,
    '--hb-press': pressScale,
    '--hb-wave': `${wave ? waveAmplitude : 0}px`,
    '--hb-ease-out': 'cubic-bezier(0.23, 1, 0.32, 1)',
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      className={`hb-root group relative isolate m-0 inline-grid cursor-pointer touch-manipulation select-none place-items-center border-0 font-medium leading-none tracking-[0.01em] outline-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [background:var(--hb-bg)] [border-radius:var(--hb-radius)] [color:var(--hb-text)] [transition:transform_160ms_var(--hb-ease-out),background-color_160ms_ease] data-[phase=holding]:data-[input=pointer]:[transform:scale(var(--hb-press))] data-[glow=true]:data-[phase=holding]:[transition:transform_160ms_var(--hb-ease-out),background-color_160ms_ease] focus-visible:[outline:2px_solid_var(--hb-fill)] focus-visible:outline-offset-[3px] disabled:pointer-events-none disabled:cursor-default disabled:opacity-50 contrast-more:[outline:1px_solid_var(--hb-text)] ${SIZES[size] || SIZES.md}${className ? ` ${className}` : ''}`}
      data-phase={phase}
      data-input={input ?? undefined}
      data-direction={direction}
      data-glow={glow ? 'true' : undefined}
      aria-describedby={hintId}
      style={cssVars}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => endPointer(e)}
      onPointerCancel={(e) => endPointer(e, { drifted: true })}
      onLostPointerCapture={(e) => endPointer(e, { drifted: true })}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span
        className="hb-pulse pointer-events-none absolute inset-0 z-0 opacity-0 [border-radius:var(--hb-radius)] group-data-[glow=true]:group-data-[phase=done]:[animation:hb-pulse_600ms_var(--hb-ease-out)_forwards]"
        aria-hidden="true"
      />
      <span className="hb-label relative z-[2] grid place-items-center">{labels}</span>
      <span
        className="pointer-events-none absolute inset-0 z-[3] [clip-path:inset(0_round_var(--hb-radius))]"
        aria-hidden="true"
      >
        <span className="hb-fill absolute inset-0 grid place-items-center [background:var(--hb-fill)] [color:var(--hb-fill-text)]">
          <span className="hb-label grid place-items-center">{labels}</span>
        </span>
        <span className="hb-crest absolute inset-0 grid place-items-center [background:var(--hb-fill)] [color:var(--hb-fill-text)]">
          <span className="hb-label grid place-items-center">{labels}</span>
        </span>
      </span>
      <span id={hintId} className="absolute h-px w-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]">
        Press and hold for {Math.round(holdTime / 100) / 10} seconds to confirm
      </span>
    </button>
  )
}

export default HoldButton
export { HoldButton }