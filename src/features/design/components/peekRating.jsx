/* eslint-disable react/prop-types */
// peekRating.jsx — ported from the reference source
// (react-bits `src/content/Micro/PeekRating/PeekRating.jsx` + `.css`).
//
// WHAT THE FIRST PORT GOT WRONG: it drew five buttons that filled on click. The
// reference is a PREVIEW control — hovering lifts every star up to the pointer
// and magnifies the one under it, and the filled count is only committed on
// release. The gap is the whole point: you see what you are about to give
// before you give it.
//
// The reference mechanics that are preserved here:
//   * state lives in refs (`st`), and a single `paint()` writes transforms — so
//     a fast drag does not queue a React render per star per frame;
//   * the tip tracks the SLOT, not the pointer, via `translate(calc(<slot *
//     (visual + 0.5)>px - 50%), 0)`, so it sits centred under the star it
//     describes;
//   * committing plays a Web Animations pop on the chosen glyph, and a keyboard
//     commit sets `data-instant` to suppress the CSS rise instead;
//   * arrow keys step, Home/End jump, Delete clears, and pressing the star that
//     is already the value clears it when `allowClear` is set.
//
// COLOUR: `activeColor` / `idleColor` / `tipColor` / `tipTextColor` keep their
// reference names; the values are TOKEN NAMES resolved at runtime, because rule
// 01a of check-visual-contract.sh rejects hex in src/.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { FavouriteIcon, FlashIcon, StarIcon } from '@hugeicons/core-free-icons'
import { clamp } from './motion.js'
import { useTokenColors } from './colors.js'
import './reference.css'

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const SHAPES = { star: StarIcon, heart: FavouriteIcon, bolt: FlashIcon }

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function PeekRating({
  value: valueProp,
  defaultValue = 0,
  onChange,
  onPreview,
  count = 5,
  shape = 'star',
  icon,
  labels = [],
  activeColor = 'amber',
  idleColor = 'elevated',
  tipColor = 'elevated',
  tipTextColor = 'text',
  size = 28,
  lift = 6,
  magnify = 1.15,
  riseDuration = 320,
  popScale = 1.3,
  showTip = true,
  showLabels = false,
  allowClear = true,
  readOnly = false,
  disabled = false,
  ariaLabel = 'Rating',
  className = '',
}) {
  const [inner, setInner] = useState(defaultValue)
  const value = clamp(valueProp ?? inner, 0, count)
  const interactive = !readOnly && !disabled

  const rootRef = useRef(null)
  const rowRef = useRef(null)
  const tipEl = useRef(null)
  const starEls = useRef([])
  const liftEls = useRef([])
  const glyphEls = useRef([])
  const st = useRef({ hover: null, pressing: false, pointerId: null, settled: false, rect: null, rtl: false })

  const colors = useTokenColors({
    active: activeColor,
    idle: idleColor,
    tip: tipColor,
    tipText: tipTextColor,
  })

  const paint = () => {
    const { hover, settled, rtl } = st.current
    const previewing = hover !== null && !settled
    const shown = previewing ? hover + 1 : value
    const still = reducedMotion()

    for (let i = 0; i < count; i += 1) {
      const liftEl = liftEls.current[i]
      const glyphEl = glyphEls.current[i]
      if (!liftEl || !glyphEl) continue
      const lifted = previewing && !still && i <= hover
      liftEl.style.transform = lifted
        ? `translateY(${-lift}px) scale(${i === hover ? magnify : 1})`
        : 'translateY(0px) scale(1)'
      glyphEl.dataset.lit = i < shown
    }

    const tip = tipEl.current
    if (!tip) return
    if (previewing && showTip) {
      const row = rowRef.current
      const slot = row ? row.clientWidth / count : size
      const visual = rtl ? count - 1 - hover : hover
      const wasHidden = tip.dataset.show !== 'true'
      if (wasHidden) tip.style.transition = 'none'
      tip.textContent = labels[hover] ?? String(hover + 1)
      tip.style.transform = `translate(calc(${slot * (visual + 0.5)}px - 50%), 0)`
      if (wasHidden) {
        void tip.offsetWidth
        tip.style.transition = ''
      }
      tip.dataset.show = 'true'
    } else {
      tip.dataset.show = 'false'
    }
  }

  useLayoutEffect(paint)

  const setHover = (index) => {
    if (index === st.current.hover) return
    st.current.hover = index
    if (index !== null) st.current.settled = false
    paint()
    onPreview?.(index === null ? null : index + 1)
  }
  const setHoverRef = useRef(setHover)
  setHoverRef.current = setHover

  const measure = () => {
    const row = rowRef.current
    if (!row) return
    st.current.rect = row.getBoundingClientRect()
    st.current.rtl = getComputedStyle(row).direction === 'rtl'
  }

  const indexAt = (x, y) => {
    const { rect, pressing, rtl } = st.current
    if (!rect || !rect.width) return null
    if (pressing && (y < rect.top - size || y > rect.bottom + size)) return null
    const index = clamp(Math.floor(((x - rect.left) / rect.width) * count), 0, count - 1)
    return rtl ? count - 1 - index : index
  }

  const commit = (next, pop = true) => {
    if (valueProp === undefined) setInner(next)
    onChange?.(next)
    st.current.settled = true
    paint()
    const glyph = glyphEls.current[next - 1]
    if (pop && next > 0 && popScale > 1 && glyph && typeof glyph.animate === 'function' && !reducedMotion()) {
      glyph.getAnimations().forEach((animation) => animation.cancel())
      glyph.animate(
        [
          { transform: 'scale(1)', easing: EASE_OUT },
          { transform: `scale(${popScale})`, offset: 0.35, easing: EASE_OUT },
          { transform: 'scale(1)' },
        ],
        { duration: 300 },
      )
    }
  }

  const handlePointerEnter = (e) => {
    if (!interactive || e.pointerType !== 'mouse') return
    rootRef.current?.removeAttribute('data-instant')
    measure()
  }

  const handlePointerDown = (e) => {
    if (!interactive || e.button !== 0 || st.current.pointerId !== null) return
    rootRef.current?.removeAttribute('data-instant')
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // The row still tracks a mouse that cannot be captured.
    }
    st.current.pointerId = e.pointerId
    st.current.pressing = true
    measure()
    setHover(indexAt(e.clientX, e.clientY))
  }

  const handlePointerMove = (e) => {
    if (!interactive) return
    const { pressing, pointerId } = st.current
    if (e.pointerType !== 'mouse' && !pressing) return
    if (pressing && e.pointerId !== pointerId) return
    if (!pressing && !st.current.rect) measure()
    setHover(indexAt(e.clientX, e.clientY))
  }

  const endPress = (e) => {
    const { pressing, pointerId, hover } = st.current
    if (!pressing || e.pointerId !== pointerId) return
    st.current.pressing = false
    st.current.pointerId = null
    if (e.type === 'pointerup' && hover !== null) {
      const next = hover + 1
      commit(allowClear && next === value ? 0 : next)
    }
    if (e.pointerType !== 'mouse') setHover(null)
  }

  const handlePointerLeave = () => {
    if (!st.current.pressing) setHover(null)
  }

  const handleKeyDown = (e) => {
    if (!interactive) return
    const min = allowClear ? 0 : 1
    let next
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = clamp(value + 1, min, count)
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        next = clamp(value - 1, min, count)
        break
      case 'Home':
        next = 1
        break
      case 'End':
        next = count
        break
      case 'Backspace':
      case 'Delete':
        if (!allowClear) return
        next = 0
        break
      case ' ':
      case 'Enter': {
        const index = starEls.current.indexOf(e.target)
        if (index === -1) return
        next = allowClear && index + 1 === value ? 0 : index + 1
        break
      }
      default:
        return
    }
    e.preventDefault()
    // Keyboard must not animate the row: the value jumped, it did not travel.
    rootRef.current?.setAttribute('data-instant', 'true')
    st.current.hover = null
    commit(next, false)
    starEls.current[Math.max(next, 1) - 1]?.focus()
  }

  useEffect(() => {
    const reset = () => {
      st.current.pressing = false
      st.current.pointerId = null
      setHoverRef.current(null)
    }
    const onVisibility = () => {
      if (document.hidden) reset()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', reset)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', reset)
    }
  }, [])

  const Star = readOnly ? 'span' : 'button'
  const shapeIcon = SHAPES[shape] || SHAPES.star
  const tipRoom = interactive && showTip ? Math.round(size * 0.9) : 0

  return (
    <div className="space-y-2">
      <div
        ref={rootRef}
        role={readOnly ? 'img' : 'radiogroup'}
        aria-label={readOnly ? `${value} of ${count}` : ariaLabel}
        aria-disabled={disabled || undefined}
        className={`peek-rating${className ? ` ${className}` : ''}`}
        style={{
          '--pr-active': colors.active,
          '--pr-idle': colors.idle,
          '--pr-tip': colors.tip,
          '--pr-tip-text': colors.tipText,
          '--pr-size': `${size}px`,
          '--pr-gap': `${Math.round(size * 0.22)}px`,
          '--pr-room': `${lift + tipRoom}px`,
          '--pr-rise': `${riseDuration}ms`,
        }}
        onKeyDown={readOnly ? undefined : handleKeyDown}
      >
        <div
          ref={rowRef}
          className="peek-rating__row"
          onPointerEnter={handlePointerEnter}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPress}
          onPointerCancel={endPress}
          onLostPointerCapture={endPress}
          onPointerLeave={handlePointerLeave}
        >
          {interactive && showTip ? <span ref={tipEl} className="peek-rating__tip" aria-hidden="true" /> : null}
          {Array.from({ length: count }, (_, i) => {
            const checked = value === i + 1
            const label = labels[i] ? `${i + 1} of ${count}, ${labels[i]}` : `${i + 1} of ${count}`
            return (
              <Star
                key={i}
                ref={(el) => {
                  starEls.current[i] = el
                }}
                type={readOnly ? undefined : 'button'}
                className="peek-rating__star"
                role={readOnly ? undefined : 'radio'}
                aria-checked={readOnly ? undefined : checked}
                aria-label={readOnly ? undefined : label}
                aria-hidden={readOnly || undefined}
                tabIndex={!interactive ? -1 : (value === 0 ? i === 0 : checked) ? 0 : -1}
              >
                <span
                  ref={(el) => {
                    liftEls.current[i] = el
                  }}
                  className="peek-rating__lift"
                >
                  <span
                    ref={(el) => {
                      glyphEls.current[i] = el
                    }}
                    className="peek-rating__glyph"
                  >
                    {icon ?? <HugeiconsIcon icon={shapeIcon} size={size} fill="currentColor" strokeWidth={1.5} />}
                  </span>
                </span>
              </Star>
            )
          })}
        </div>
      </div>

      {showLabels && labels.length ? (
        <p className="text-xs text-cem-secondary">
          {value > 0 ? labels[Math.min(value, labels.length) - 1] : 'Not rated yet'}
        </p>
      ) : null}
    </div>
  )
}
