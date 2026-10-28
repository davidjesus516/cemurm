/* eslint-disable react/prop-types -- the shape is { src, overlay } and neither
   is required; with no src the component renders an empty spacer. */

import { memo, useEffect, useRef } from 'react'

// A video background is a visitor's ambient media choice, not an app motion decision,
// so reduced motion does NOT kill it — the visitor chose to play the page with video.
// Only Galeria mounts this component now, inside a real `aspect-video` box. Hero and
// CtaFinal each carried a copy behind an `absolute inset-0 -z-10` layer that could never
// paint, and both were deleted rather than made ready: with no asset in the repo, an
// empty `src` renders a zero-height box either way.
//
// CLS is the real enemy here. object-cover fills without aspect distortion, and the video
// carries no width/height attributes, so the wrapper — not the media — sizes the layout.
//
// src is a placeholder until you connect the real file. The component accepts a real src and
// renders an empty spacer when none is present.
//
// The no-src branch painted a placeholder gradient that sat at -z-10 behind the calling
// section's opaque bg and never rendered; it was deleted rather than switched on.

export const VideoBG = memo(function VideoBG({ src = '', overlay = true }) {
  const videoRef = useRef(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // When a real src is connected, the browser can still take a frame to figure out the
  // first paint. The poster/placeholder is the stable thing that holds the space while
  // that happens.
  const hasSrc = typeof src === 'string' && src.length > 0

  return (
    <div className="relative overflow-hidden">
      {hasSrc ? (
        <>
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src={src}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
          {overlay && (
            <div
              className="absolute inset-0 bg-gradient-to-b from-cem-base/70 via-cem-base/40 to-cem-base/80"
              aria-hidden="true"
            />
          )}
        </>
      ) : (
        /* Placeholder: the wrapper has no intrinsic height, so this paints a stable
           gradient spacer until the real file is connected. CLS-safe: the box always
           occupies the same space, matching the video-playing branch. */
        <div
          className="absolute inset-0 bg-gradient-to-b from-cem-base/70 via-cem-base/40 to-cem-base/80"
          aria-hidden="true"
        />
      )}
    </div>
  )
})

export default VideoBG
