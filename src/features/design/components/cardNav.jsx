/* eslint-disable react/prop-types */
// cardNav.jsx — ported from the reference source (reactbits
// `src/content/Components/CardNav/CardNav.jsx`, with its `CardNav.css` ported
// into reference.css).
//
// WHAT IT IS: a navigation bar, not the card deck that used to carry this name
// in blocks.jsx — a hamburger button, a 60px bar with the logo centred and the
// CTA at the right, and a GSAP timeline that opens the bar to a measured
// height while three link cards rise into place.
//
// PRESERVED EXACTLY, because these are the whole component:
//   * `calculateHeight` — on mobile it forces `.card-nav-content` open
//     (visibility / pointer-events / position / height), reads `scrollHeight`,
//     restores the four styles it touched and returns top bar + content +
//     padding; anywhere else it returns the fixed 260.
//   * the timeline — `gsap.set(nav, { height: 60, overflow: 'hidden' })` and
//     `gsap.set(cards, { y: 50, opacity: 0 })`, then a paused timeline that
//     tweens the height over 0.4s on the `ease` prop and the cards in at
//     `-=0.1` with `stagger: 0.08`.
//   * `toggleMenu` — `play(0)` on open; on close, `eventCallback(
//     'onReverseComplete', …)` clears `isExpanded` first and only then
//     `reverse()`, so the collapsed state lands when the bar has closed.
//   * the resize handler kills and rebuilds the timeline, keeping
//     `progress(1)` while expanded so the measured height follows the viewport.
//   * the hamburger keeps `role="button"`, `aria-label`, `aria-expanded`,
//     `tabIndex` and its Enter/Space handler; `card-nav-content` keeps
//     `aria-hidden={!isExpanded}`; the cards are `items.slice(0, 3)` — three is
//     the contract, not a coincidence of the demo data.
//
// TWO DEVIATIONS, both forced, no others:
//   * COLOUR (rule 01a). Upstream fills `baseColor`, `menuColor`,
//     `buttonBgColor`, `buttonTextColor` and each item's `bgColor` /
//     `textColor` with colour literals. Rule 01a of
//     scripts/check-visual-contract.sh is enforcing over `src/`, so every one
//     of them takes a TOKEN NAME instead, resolved at runtime by
//     `useTokenColors` (colors.js). The defaults keep upstream's read: light
//     bar (`text`) with a dark hamburger and a dark CTA (`base`), dark CTA
//     label (`text`). A token the probe cannot resolve falls back to
//     `surface`, which is colors.js's own fallback; the first frame paints
//     late rather than wrong.
//   * ICON. `GoArrowUpRight` comes from react-icons, which is not a
//     dependency here — upstream's own file says to use your own icon import
//     when react-icons is unavailable. The arrow is `ArrowUpRight01Icon`
//     (Hugeicons) at size 16, which is upstream's 1em at a 16px font, keeping
//     the `nav-card-link-icon` class and the `aria-hidden`.

import { useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ArrowUpRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTokenColors } from './colors.js'
import './reference.css'

export function CardNav({
  logo,
  logoAlt = 'Logo',
  items,
  className = '',
  ease = 'power3.out',
  baseColor = 'text',
  menuColor = 'base',
  buttonBgColor = 'base',
  buttonTextColor = 'text',
}) {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const navRef = useRef(null)
  const cardsRef = useRef([])
  const tlRef = useRef(null)

  // Token names in, resolved colours out — empty on the first pass, so the bar
  // renders before it paints (the ordering colors.js is written for). `|| []`
  // lives here and only here: the render below keeps the reference's own
  // expression for the cards.
  const list = items || []
  const colors = useTokenColors({
    base: baseColor,
    menu: menuColor,
    buttonBg: buttonBgColor,
    buttonText: buttonTextColor,
    bg0: list[0]?.bgColor,
    text0: list[0]?.textColor,
    bg1: list[1]?.bgColor,
    text1: list[1]?.textColor,
    bg2: list[2]?.bgColor,
    text2: list[2]?.textColor,
  })

  const calculateHeight = () => {
    const navEl = navRef.current
    if (!navEl) return 260

    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (isMobile) {
      const contentEl = navEl.querySelector('.card-nav-content')
      if (contentEl) {
        const wasVisible = contentEl.style.visibility
        const wasPointerEvents = contentEl.style.pointerEvents
        const wasPosition = contentEl.style.position
        const wasHeight = contentEl.style.height

        contentEl.style.visibility = 'visible'
        contentEl.style.pointerEvents = 'auto'
        contentEl.style.position = 'static'
        contentEl.style.height = 'auto'

        // Force the reflow the measurement needs before the styles are read.
        contentEl.offsetHeight

        const topBar = 60
        const padding = 16
        const contentHeight = contentEl.scrollHeight

        contentEl.style.visibility = wasVisible
        contentEl.style.pointerEvents = wasPointerEvents
        contentEl.style.position = wasPosition
        contentEl.style.height = wasHeight

        return topBar + contentHeight + padding
      }
    }
    return 260
  }

  const createTimeline = () => {
    const navEl = navRef.current
    if (!navEl) return null

    gsap.set(navEl, { height: 60, overflow: 'hidden' })
    gsap.set(cardsRef.current, { y: 50, opacity: 0 })

    const tl = gsap.timeline({ paused: true })

    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.4,
      ease
    })

    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.08 }, '-=0.1')

    return tl
  }

  useLayoutEffect(() => {
    const tl = createTimeline()
    tlRef.current = tl

    return () => {
      tl?.kill()
      tlRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ease, items])

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return

      if (isExpanded) {
        const newHeight = calculateHeight()
        gsap.set(navRef.current, { height: newHeight })

        tlRef.current.kill()
        const newTl = createTimeline()
        if (newTl) {
          newTl.progress(1)
          tlRef.current = newTl
        }
      } else {
        tlRef.current.kill()
        const newTl = createTimeline()
        if (newTl) {
          tlRef.current = newTl
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded])

  const toggleMenu = () => {
    const tl = tlRef.current
    if (!tl) return
    if (!isExpanded) {
      setIsHamburgerOpen(true)
      setIsExpanded(true)
      tl.play(0)
    } else {
      setIsHamburgerOpen(false)
      tl.eventCallback('onReverseComplete', () => setIsExpanded(false))
      tl.reverse()
    }
  }

  const setCardRef = i => el => {
    if (el) cardsRef.current[i] = el
  }

  return (
    <div className={`card-nav-container ${className}`}>
      <nav ref={navRef} className={`card-nav ${isExpanded ? 'open' : ''}`} style={{ backgroundColor: colors.base }}>
        <div className="card-nav-top">
          <div
            className={`hamburger-menu ${isHamburgerOpen ? 'open' : ''}`}
            onClick={toggleMenu}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toggleMenu()
              }
            }}
            role="button"
            aria-label={isExpanded ? 'Close menu' : 'Open menu'}
            aria-expanded={isExpanded}
            tabIndex={0}
            style={{ color: colors.menu }}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>

          <div className="logo-container">
            <img src={logo} alt={logoAlt} className="logo" />
          </div>

          <button
            type="button"
            className="card-nav-cta-button"
            style={{ backgroundColor: colors.buttonBg, color: colors.buttonText }}
          >
            Get Started
          </button>
        </div>

        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {(items || []).slice(0, 3).map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className="nav-card"
              ref={setCardRef(idx)}
              style={{ backgroundColor: colors[`bg${idx}`], color: colors[`text${idx}`] }}
            >
              <div className="nav-card-label">{item.label}</div>
              <div className="nav-card-links">
                {item.links?.map((lnk, i) => (
                  <a key={`${lnk.label}-${i}`} className="nav-card-link" href={lnk.href} aria-label={lnk.ariaLabel}>
                    <HugeiconsIcon
                      icon={ArrowUpRight01Icon}
                      size={16}
                      className="nav-card-link-icon"
                      aria-hidden="true"
                    />
                    {lnk.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default CardNav
