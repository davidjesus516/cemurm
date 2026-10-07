/* eslint-disable react/prop-types */
// dock.jsx — ported from the reference source
// (react-bits `src/content/Components/Dock/Dock.jsx` + `.css`).
//
// WHAT THE FIRST PORT GOT WRONG: it scaled a fixed box with `scale` and left
// the panel at a constant height, so the tiles read as buttons rather than
// objects. The reference animates the item's WIDTH AND HEIGHT, which makes the
// row REFLOW — neighbours are pushed apart by the growing tile and the panel
// itself grows to fit the tallest one. That reflow is the dock.
//
// What is preserved here:
//   * `useTransform` on the pointer's distance to the item centre, mapped
//     LINEARLY through [-distance, 0, distance] onto
//     [baseItemSize, magnification, baseItemSize];
//   * the panel's height springs between panelHeight and
//     max(dockHeight, magnification * 1.5 + 4) so it can hold the magnified
//     tile and the label above it;
//   * labels enter and leave through AnimatePresence and are driven off the
//     same hover motion value, so keyboard focus raises one too;
//   * Enter and Space activate, because each tile is role="button".
//
// COLOUR: the reference gives every tile the same background. Here `item.color`
// is an optional TOKEN NAME, resolved at runtime — rule 01a of
// check-visual-contract.sh rejects hex in src/, and a dock with one colour for
// six tiles is not the "coloured version" the maintainer asked for.

import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { Children, cloneElement, useEffect, useMemo, useRef, useState } from 'react'
import { useTokenColors } from './colors.js'
import './reference.css'

function DockItem({ children, className = '', onClick, mouseX, spring, distance, magnification, baseItemSize, label, ink }) {
  const ref = useRef(null)
  const isHovered = useMotionValue(0)

  const mouseDistance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: baseItemSize }
    return val - rect.x - baseItemSize / 2
  })

  const targetSize = useTransform(mouseDistance, [-distance, 0, distance], [baseItemSize, magnification, baseItemSize])
  const size = useSpring(targetSize, spring)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  return (
    <motion.div
      ref={ref}
      style={{ width: size, height: size, '--dock-ink': ink }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      onClick={onClick}
      className={`dock-item ${className}`}
      tabIndex={0}
      role="button"
      aria-haspopup="true"
      aria-label={label}
      onKeyDown={handleKeyDown}
    >
      {Children.map(children, (child) => cloneElement(child, { isHovered }))}
    </motion.div>
  )
}

function DockLabel({ children, className = '', ...rest }) {
  const { isHovered } = rest
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const unsubscribe = isHovered.on('change', (latest) => {
      setIsVisible(latest === 1)
    })
    return () => unsubscribe()
  }, [isHovered])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -10 }}
          exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.2 }}
          className={`dock-label ${className}`}
          role="tooltip"
          style={{ x: '-50%' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function DockIcon({ children, className = '' }) {
  return <div className={`dock-icon ${className}`}>{children}</div>
}

export function Dock({
  items = [],
  className = '',
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = 70,
  distance = 200,
  panelHeight = 68,
  dockHeight = 256,
  baseItemSize = 50,
}) {
  const mouseX = useMotionValue(Infinity)
  const isHovered = useMotionValue(0)

  // One resolve per distinct token, not per item: a dock with six tiles that
  // share two colours should probe twice.
  const tokenSpec = useMemo(() => {
    const spec = { accent: 'amber' }
    items.forEach((item, i) => {
      if (item.color) spec[`i${i}`] = item.color
    })
    return spec
  }, [items])
  const colors = useTokenColors(tokenSpec)

  const maxHeight = Math.max(dockHeight, magnification + magnification / 2 + 4)
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight])
  const height = useSpring(heightRow, spring)

  return (
    <motion.div style={{ height, scrollbarWidth: 'none' }} className="dock-outer">
      <motion.div
        onMouseMove={({ pageX }) => {
          isHovered.set(1)
          mouseX.set(pageX)
        }}
        onMouseLeave={() => {
          isHovered.set(0)
          mouseX.set(Infinity)
        }}
        className={`dock-panel ${className}`}
        style={{ height: panelHeight, '--dock-accent': colors.accent }}
        role="toolbar"
        aria-label="Application dock"
      >
        {items.map((item, index) => (
          <DockItem
            key={item.label ?? index}
            onClick={item.onClick}
            className={item.className}
            mouseX={mouseX}
            spring={spring}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
            label={item.label}
            ink={item.color ? colors[`i${index}`] : undefined}
          >
            <DockIcon>{item.icon}</DockIcon>
            <DockLabel>{item.label}</DockLabel>
          </DockItem>
        ))}
      </motion.div>
    </motion.div>
  )
}
