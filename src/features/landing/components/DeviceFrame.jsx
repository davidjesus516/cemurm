/* eslint-disable react/prop-types -- the shape is two props; there are no
   propTypes anywhere in src/ (see FeedbackForm.jsx:1). */

// TIER 1. A hand-rolled device shell: no shadcn, because the plan's budget
// section 7.3 allocates zero dependencies for it and the frame is a rounded
// rectangle with a hairline.
//
// FROZEN PROP SHAPE — { anchor, children }
//   anchor:  'top' | 'center'. Which part of a viewport-sized child the window
//            crops. Default 'top'.
//   children: the screen. It fills the window and is clipped by it. Receding is
//             NOT a prop: it belongs to the caller's `motion.div` wrapper, which
//            carries scale, opacity and rotation. This component animates nothing
//            on its own, so a `receding` flag here would be a second place to
//            keep the same decision in sync.
//
// WHY THE `anchor` SHIFT EXISTS, because it is not cosmetic. Both screens this
// frame hosts are built for a FULL browser viewport: OverlayView.jsx:33 and
// SlideView.jsx:34 both open with `min-h-screen`. Neither can be modified —
// OverlayView is the live OBS streaming surface — so inside a 20rem window they
// render at viewport height and the window crops. OverlayView's content is
// top-aligned, so `top` works. SlideView's is `justify-center`, which puts its
// content at 50vh — far below a 20rem window, so `top` would render the senal
// screen BLANK. `center` shifts the box up by (50vh - half the window) so
// 50vh lands on the window's middle. That assumes exactly one thing, verifiable
// in SlideView.jsx:34: that it centres within a `min-h-screen` box. If that
// line ever changes, this shift is the thing that breaks.
//
// WHY NO SHADOW AND NO MATERIAL. Elevation in dark mode is carried by lightness
// (reference 5.4 rule 3): a content-layer card gets a lighter fill, never a
// shadow. The siblings' depth cue is scale and opacity, which is what section 8.2
// asks for. And the header is already the page's one functional-layer material
// (reference 9: "at most one chrome surface"), so a second blurred surface here
// would buy nothing for a box that is already opaque.
//
// RADIUS. Shell `radius-lg` 16px — section 5.2's "panel" class, which a device
// shell is. Window `radius-md` 12px, one step down so the inset reads; the 4px
// delta keeps section 5.2 rule 6 satisfied in the direction it is written.
export default function DeviceFrame({ anchor = 'top', children }) {
  return (
    <div className="w-full overflow-hidden rounded-cem-lg border border-cem-text/10 bg-cem-surface p-2">
      {/* `h-80` is a component dimension, not spacing: reference 4.4 caps the
          spacing scale at 64px, which is not a device height. It grows to `h-96`
          from `md` up because the hero demo is the page's centrepiece (P3) and at
          320px the demo's own content was too small to read, let alone the
          projection screens this frame hosts. */}
      <div className="h-80 overflow-hidden rounded-cem-md md:h-96">
        {/* `_-_` is Tailwind's underscore-for-space: CSS requires whitespace
            around the `-` inside calc(), and `calc(50vh-10rem)` is invalid. */}
        <div className={anchor === 'center' ? '-mt-[calc(50vh_-_10rem)]' : undefined}>
          {children}
        </div>
      </div>
    </div>
  )
}