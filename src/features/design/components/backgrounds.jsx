/* eslint-disable react/prop-types */
// backgrounds.jsx — ShapeGrid, ported from the reference source
// (react-bits `src/content/Backgrounds/ShapeGrid/ShapeGrid.jsx`).
//
// WHAT THE FIRST PORT GOT WRONG, because it was written from the demo page's
// description instead of the source:
//   * `speed` is the SCROLL speed of the grid, not a trail decay. The original
//     advances a wrapped `gridOffset` every frame and redraws; the first port
//     drew a STATIC grid and decayed a trail, so nothing on screen ever moved.
//     That is the "the grid does not change" report.
//   * Cell state lives in an opacity Map that lerps 15% toward its target each
//     frame, not in a per-cell scalar list — so overlapping hover paths blend
//     instead of snapping.
//   * The trail is the last N hovered CELLS, pushed on every cell change, with
//     opacity falling off by position in the queue.
//   * Hex/triangle/circle need different coordinate maths and different wrap
//     periods, and hexagon wraps on 2x its width.
//   * The loop pauses on IntersectionObserver and on visibilitychange, so a
//     background nobody is looking at costs nothing.
//
// COLOURS: the reference takes borderColor/hoverFillColor as hex. Rule 01a of
// check-visual-contract.sh rejects hex anywhere in src/, so the palette is not a
// literal — it is resolved from the token layer at runtime by a probe element
// wearing a token class. Change a token, the canvas follows.

import { useEffect, useRef, useState } from 'react'

const TOKEN_CLASS = {
  base: 'bg-cem-base',
  surface: 'bg-cem-surface',
  elevated: 'bg-cem-elevated',
  hover: 'bg-cem-hover',
  amber: 'bg-cem-amber',
}

function resolveTokenColor(leaf, probe) {
  probe.className = TOKEN_CLASS[leaf] || TOKEN_CLASS.surface
  return getComputedStyle(probe).backgroundColor
}

export function ShapeGrid({
  direction = 'right',
  speed = 1,
  // The reference prop is `cell`. The site query string calls the same
  // number `size`, and both appear in real usage, so both are accepted and
  // `size` is an alias rather than a second knob.
  squareSize,
  size,
  shape = 'square',
  hoverTrailAmount = 0,
  borderColor,
  hoverColor,
  hoverFillColor,
  borderToken = 'surface',
  hoverToken = 'amber',
  className = '',
}) {
  const canvasRef = useRef(null)
  const cell = squareSize ?? size ?? 40
  const [colors, setColors] = useState({ border: '', hover: '' })

  // Mutable state for the animation loop. These are refs, not state, on
  // purpose: the grid advances every frame and a state write per frame would
  // re-render the tree 60 times a second for a decorative background.
  const gridOffsetRef = useRef({ x: 0, y: 0 })
  const hoveredRef = useRef(null)
  const trailRef = useRef([])
  const opacityRef = useRef(new Map())
  // The rAF handle is a REF, not a number: `cancelAnimationFrame` has to be
  // able to reach the pending frame, so the id lives at .current and the
  // handle itself is the object. Declared at component level because the effect
  // below closes over it across renders.
  const requestRef = useRef(0)

  // Resolve both colours from the token layer once, through a probe element.
  // `borderColor` / `hoverColor` / `hoverFillColor` keep the reference prop
  // NAMES, but their values here are token names rather than hex strings —
  // rule 01a rejects colour literals in src/, and a caller passing a raw hex
  // would land in the same trap.
  useEffect(() => {
    const probe = document.createElement('span')
    probe.style.position = 'absolute'
    probe.style.width = '0'
    probe.style.height = '0'
    probe.style.opacity = '0'
    document.body.appendChild(probe)
    const next = {
      border: resolveTokenColor(borderColor || borderToken, probe),
      // `hoverFillColor` is the reference's own prop name for the fill a cell
      // takes when hovered, so it wins over the site query-string alias
      // `hoverColor`. Passing both is what the maintainer's snippet does, and
      // the reference name has to be the one that counts.
      hover: resolveTokenColor(hoverFillColor || hoverColor || hoverToken, probe),
    }
    document.body.removeChild(probe)
    setColors(next)
  }, [borderColor, borderToken, hoverColor, hoverFillColor, hoverToken])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const isHex = shape === 'hexagon'
    const isTri = shape === 'triangle'
    const isCircle = shape === 'circle'

    // Hexagons tile on 1.5 x sqrt(3) periods; triangles on half a cell wide.
    const hexHoriz = cell * 1.5
    const hexVert = cell * Math.sqrt(3)
    const triHalf = cell / 2

    // Only gridOffset is aliased: its `.current` IS the mutable {x, y} object
    // the reference advances each frame. The other three are NOT — their
    // `.current` holds a value (a cell, an array, a Map), and the reference
    // reads them through the ref. Aliasing them and then assigning
    // `alias.current = …` writes a property onto that value, which is the
    // TypeError that took the grid down on mount.
    const gridOffset = gridOffsetRef.current

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    const trace = (cx, cy, size) => {
      if (isHex) {
        ctx.beginPath()
        for (let i = 0; i < 6; i += 1) {
          const angle = (Math.PI / 3) * i
          const vx = cx + size * Math.cos(angle)
          const vy = cy + size * Math.sin(angle)
          if (i === 0) ctx.moveTo(vx, vy)
          else ctx.lineTo(vx, vy)
        }
        ctx.closePath()
      } else if (isCircle) {
        ctx.beginPath()
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
        ctx.closePath()
      } else if (isTri) {
        ctx.beginPath()
        ctx.moveTo(cx, cy - size / 2)
        ctx.lineTo(cx + size / 2, cy + size / 2)
        ctx.lineTo(cx - size / 2, cy + size / 2)
        ctx.closePath()
      } else {
        ctx.beginPath()
        ctx.rect(cx - size / 2, cy - size / 2, size, size)
      }
    }

    const drawGrid = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!colors.border || !colors.hover) return

      if (isHex) {
        const colShift = Math.floor(gridOffset.x / hexHoriz)
        const offsetX = ((gridOffset.x % hexHoriz) + hexHoriz) % hexHoriz
        const offsetY = ((gridOffset.y % hexVert) + hexVert) % hexVert
        const cols = Math.ceil(canvas.width / hexHoriz) + 3
        const rows = Math.ceil(canvas.height / hexVert) + 3
        for (let col = -2; col < cols; col += 1) {
          for (let row = -2; row < rows; row += 1) {
            const cx = col * hexHoriz + offsetX
            const cy = row * hexVert + ((col + colShift) % 2 !== 0 ? hexVert / 2 : 0) + offsetY
            const alpha = opacityRef.current.get(`${col},${row}`)
            if (alpha) {
              ctx.globalAlpha = alpha
              trace(cx, cy, cell)
              ctx.fillStyle = colors.hover
              ctx.fill()
              ctx.globalAlpha = 1
            }
            trace(cx, cy, cell)
            ctx.strokeStyle = colors.border
            ctx.stroke()
          }
        }
        return
      }

      if (isTri) {
        const offsetX = ((gridOffset.x % triHalf) + triHalf) % triHalf
        const offsetY = ((gridOffset.y % cell) + cell) % cell
        const cols = Math.ceil(canvas.width / triHalf) + 4
        const rows = Math.ceil(canvas.height / cell) + 4
        for (let col = -2; col < cols; col += 1) {
          for (let row = -2; row < rows; row += 1) {
            const cx = col * triHalf + offsetX
            const cy = row * cell + cell / 2 + offsetY
            const alpha = opacityRef.current.get(`${col},${row}`)
            if (alpha) {
              ctx.globalAlpha = alpha
              trace(cx, cy, cell)
              ctx.fillStyle = colors.hover
              ctx.fill()
              ctx.globalAlpha = 1
            }
            trace(cx, cy, cell)
            ctx.strokeStyle = colors.border
            ctx.stroke()
          }
        }
        return
      }

      // Square and circle share a grid, offset by a wrapped cell.
      const offsetX = ((gridOffset.x % cell) + cell) % cell
      const offsetY = ((gridOffset.y % cell) + cell) % cell
      const cols = Math.ceil(canvas.width / cell) + 2
      const rows = Math.ceil(canvas.height / cell) + 2
      for (let col = -2; col < cols; col += 1) {
        for (let row = -2; row < rows; row += 1) {
          const cx = col * cell + offsetX
          const cy = row * cell + offsetY
          const alpha = opacityRef.current.get(`${col},${row}`)
          if (alpha) {
            ctx.globalAlpha = alpha
            trace(cx, cy, cell)
            ctx.fillStyle = colors.hover
            ctx.fill()
            ctx.globalAlpha = 1
          }
          trace(cx, cy, cell)
          ctx.strokeStyle = colors.border
          ctx.stroke()
        }
      }
    }

    // Every cell lerps 15% toward its target each frame: the hovered cell
    // targets 1, the trail targets a falling-off value, everything else 0.
    const updateCellOpacities = () => {
      const targets = new Map()
      if (hoveredRef.current) targets.set(`${hoveredRef.current.x},${hoveredRef.current.y}`, 1)
      if (hoverTrailAmount > 0) {
        for (let i = 0; i < trailRef.current.length; i += 1) {
          const t = trailRef.current[i]
          const key = `${t.x},${t.y}`
          if (!targets.has(key)) {
            targets.set(key, (trailRef.current.length - i) / (trailRef.current.length + 1))
          }
        }
      }
      for (const key of targets.keys()) {
        if (!opacityRef.current.has(key)) opacityRef.current.set(key, 0)
      }
      for (const [key, opacity] of opacityRef.current) {
        const target = targets.get(key) || 0
        const next = opacity + (target - opacity) * 0.15
        if (next < 0.005) opacityRef.current.delete(key)
        else opacityRef.current.set(key, next)
      }
    }

    const step = () => {
      requestRef.current = requestAnimationFrame(step)
      if (mq.matches) return
      const effective = Math.max(speed, 0.1)
      const wrapX = isHex ? hexHoriz * 2 : cell
      const wrapY = isHex ? hexVert : isTri ? cell * 2 : cell
      switch (direction) {
        case 'right':
          gridOffset.x = (gridOffset.x - effective + wrapX) % wrapX
          break
        case 'left':
          gridOffset.x = (gridOffset.x + effective + wrapX) % wrapX
          break
        case 'up':
          gridOffset.y = (gridOffset.y + effective + wrapY) % wrapY
          break
        case 'down':
          gridOffset.y = (gridOffset.y - effective + wrapY) % wrapY
          break
        case 'diagonal':
          gridOffset.x = (gridOffset.x - effective + wrapX) % wrapX
          gridOffset.y = (gridOffset.y - effective + wrapY) % wrapY
          break
        default:
          // An unknown direction must still MOVE. Silently doing nothing here is
          // the exact failure the first port shipped: a grid that renders and
          // looks fine while nothing animates, because the caller passed a name
          // this switch does not know ("top"/"bottom" instead of up/down).
          gridOffset.x = (gridOffset.x - effective + wrapX) % wrapX
          gridOffset.y = (gridOffset.y + effective + wrapY) % wrapY
          break
      }
      updateCellOpacities()
      drawGrid()
    }

    const cellFromEvent = (event) => {
      const rect = canvas.getBoundingClientRect()
      const mx = event.clientX - rect.left
      const my = event.clientY - rect.top
      if (isHex) {
        const colShift = Math.floor(gridOffset.x / hexHoriz)
        const offsetX = ((gridOffset.x % hexHoriz) + hexHoriz) % hexHoriz
        const offsetY = ((gridOffset.y % hexVert) + hexVert) % hexVert
        const col = Math.round((mx - offsetX) / hexHoriz)
        const rowOffset = (col + colShift) % 2 !== 0 ? hexVert / 2 : 0
        const row = Math.round((my - offsetY - rowOffset) / hexVert)
        return { x: col, y: row }
      }
      if (isTri) {
        const offsetX = ((gridOffset.x % triHalf) + triHalf) % triHalf
        const offsetY = ((gridOffset.y % cell) + cell) % cell
        return {
          x: Math.round((mx - offsetX) / triHalf),
          y: Math.floor((my - offsetY) / cell),
        }
      }
      const offsetX = ((gridOffset.x % cell) + cell) % cell
      const offsetY = ((gridOffset.y % cell) + cell) % cell
      return {
        x: Math.round((mx - offsetX) / cell),
        y: Math.round((my - offsetY) / cell),
      }
    }

    const handleMouseMove = (event) => {
      const cell = cellFromEvent(event)
      const prev = hoveredRef.current
      if (prev && prev.x === cell.x && prev.y === cell.y) return
      if (prev && hoverTrailAmount > 0) {
        trailRef.current.unshift({ ...prev })
        if (trailRef.current.length > hoverTrailAmount) trailRef.current.length = hoverTrailAmount
      }
      hoveredRef.current = cell
    }

    const handleMouseLeave = () => {
      if (hoveredRef.current && hoverTrailAmount > 0) {
        trailRef.current.unshift({ ...hoveredRef.current })
        if (trailRef.current.length > hoverTrailAmount) trailRef.current.length = hoverTrailAmount
      }
      hoveredRef.current = null
    }

    resizeCanvas()
    drawGrid()
    requestRef.current = requestAnimationFrame(step)

    const onResize = () => {
      resizeCanvas()
      drawGrid()
    }
    window.addEventListener('resize', onResize)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)

    // Pause when nobody can see it: a background must not hold frames open.
    const io = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(requestRef.current)
      if (entry.isIntersecting) requestRef.current = requestAnimationFrame(step)
    })
    io.observe(canvas)
    const onVisibility = () => {
      cancelAnimationFrame(requestRef.current)
      if (!document.hidden) requestRef.current = requestAnimationFrame(step)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(requestRef.current)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [colors, direction, hoverTrailAmount, shape, speed, cell])

  return (
    <canvas
      ref={canvasRef}
      className={`block h-full w-full ${className}`}
      aria-hidden="true"
      data-testid="shape-grid-canvas"
    />
  )
}

/** The framed wrapper the page renders around <ShapeGrid />. */
export function ShapeGridPanel(props) {
  const { className = '', ...rest } = props
  return (
    <div className={`relative h-56 w-full overflow-hidden rounded-xl border border-cem-elevated bg-cem-base ${className}`}>
      <ShapeGrid {...rest} />
    </div>
  )
}