/* eslint-disable react/prop-types */

// A QR symbol as inline SVG — renders what src/domain/qr/encode.js produces.
//
// Polarity is fixed (dark modules on a light field) through the `cem.qr-*`
// tokens rather than the theme's background/text pair, because those two flip
// with the light theme and a scanner needs one polarity. The quiet zone is the
// four modules the spec asks for and is drawn here, not in the encoder: it is
// a display concern.

import { useMemo } from 'react'
import { encodeQr } from '../../domain/qr/encode.js'

const QUIET_ZONE = 4

export default function QrCode({ value, size = 176, label }) {
  const { matrix, error } = useMemo(() => {
    try {
      return { matrix: encodeQr(value), error: '' }
    } catch (err) {
      return { matrix: null, error: err.message }
    }
  }, [value])

  if (error) return <p className="text-xs text-cem-secondary">{error}</p>

  const span = matrix.size + QUIET_ZONE * 2
  let path = ''
  matrix.modules.forEach((row, r) => {
    row.forEach((dark, c) => {
      if (dark) path += `M${c + QUIET_ZONE} ${r + QUIET_ZONE}h1v1h-1z`
    })
  })

  return (
    <svg
      viewBox={`0 0 ${span} ${span}`}
      width={size}
      height={size}
      role="img"
      aria-label={label || 'QR code'}
      shapeRendering="crispEdges"
      className="rounded-md"
    >
      <rect width={span} height={span} className="fill-cem-qr-paper" />
      <path className="fill-cem-qr-ink" d={path} />
    </svg>
  )
}
