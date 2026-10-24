/* eslint-disable react/prop-types -- the shape is { href, label, onPress, type,
   onClick, ghost, children } and only href is required for an anchor; there are
   no propTypes anywhere in src/ (see FeedbackForm.jsx:1). */

import { memo } from 'react'

// APPLE §1, respond on pointer-down. The button highlights the instant it is pressed, and
// commits on release. The scale is Emil's baseline — 0.97 over 150ms ease-out — because
// 200ms is past the top of the band for press feedback and this is the one interaction where
// latency is most visible. The press state is pure CSS :active, no JS.
//
// ONE AMBER PRIMARY PER VIEWPORT. This button is the primary amber pill and it is the only
// full-saturation amber surface on screen at a time. The hover state is a darker amber, not a
// new colour, and the press state is the same amber scaled, so the accent never multiplies.
//
// NO SPARK HERE. This component used to carry one behind a gate that read a ref it never
// attached, so it could not mount; and making it mount would be wrong twice over. The hero's
// primary CTA must not burst (Hero says so, because the CTA points at a waitlist that is not
// wired yet), and Registro and CtaFinal already mount their own press-point spark. The section
// owns the burst, the button owns the press: onPress fires on pointer-down and the host decides
// whether anything renders.
//
// FOCUS. Apple §7.5: 2px solid cem.text, offset 2, :focus-visible only, never the accent.

const FOCUS =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cem-text ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-cem-base'

const PRESS = 'transition-transform duration-150 ease-out active:scale-[0.97]'

// The light sweep. A pill with a subtle highlight move on hover is the specular
// treatment: a pure CSS highlight crossing the surface, not a new colour. This is
// what the component is named for, so the strip is wired to the control rather
// than deleted. `group` sits on the control and `group-hover` /
// `group-focus-visible` on the strip, which is the only way a child's variant can
// react to the parent's pointer and keyboard state.
//
// THE PREVIOUS VERSION NEVER RAN. The strip sat at `-translate-x-full` with no
// group, hover or focus variant anywhere in the file, so it never left the pill,
// while a 300ms transform transition was paid for on every render. Worse,
// `absolute inset-0 w-1/2` is over-constrained: `inset-0` sets all four offsets and
// `width` then wins over the right offset, so the strip resolved to
// `left: 0; width: 50%` and a permanent `from-cem-text/10` wash sat over the left
// quarter of every amber pill. Hence `inset-y-0 left-0 w-1/2` below: the box is
// unambiguous, and it is off the pill at rest.
//
// THE CLIP BELONGS ON THE CONTROL, and that is the fix for a strip that painted
// 113px of grey gradient immediately to the LEFT of the CTA at every width. The
// utilities used to sit on a `<span>` around the control, and a non-replaced
// INLINE box ignores `overflow`: the property applies to block, flex and grid
// containers, so `overflow-hidden` there clipped nothing while `relative` on that
// span still made it the strip's containing block. The control is `inline-flex`,
// which IS a flex container, so `overflow-hidden` on it applies. `-translate-x-full`
// is then invisible at rest, as it always meant to be: the strip is half the pill
// wide, so it lands entirely outside, and the control's clip is the only thing that
// makes that true. On hover it crosses the full pill width.
//
// Under reduced motion the strip does not travel at all. It becomes a brightness
// step on the left half of the pill, which is a real override in src/app/index.css
// rather than a claim in a comment.
const SWEEP = 'relative overflow-hidden'

// `w-fit` is the price of deleting that wrapper: as a flex item in Registro's and
// CtaFinal's `flex flex-col` form the control would stretch to the column on a
// phone, and `fit-content` is not `auto`, so `align-items: stretch` never applies.
// In block flow it resolves identically to `w-auto`, so the hero CTA is unchanged.

// Off the pill at rest, across the pill on hover or keyboard focus. `focus-visible`
// is not optional: a keyboard user has to get the same specular read as a pointer,
// and the component already refuses to show a `:focus` ring for the same reason it
// shows one for `:focus-visible`.
const SWEEP_STRIP =
  'cem-sweep-strip pointer-events-none absolute inset-y-0 left-0 h-full w-1/2 ' +
  '-translate-x-full bg-gradient-to-r from-cem-text/10 to-transparent ' +
  'transition-transform duration-300 group-hover:translate-x-full ' +
  'group-focus-visible:translate-x-full'

export const SpecularButton = memo(function SpecularButton({
  href,
  label,
  onPress,
  onClick,
  type = 'button',
  ghost = false,
  children,
}) {
  // onPress is the pointer-down hook (spark hosts position themselves from it); onClick is the
  // commit hook. Neither is required: a plain anchor needs neither, and a form submit only needs
  // type="submit" so the form's own onSubmit stays the single capture point.
  const handlePointerDown = (e) => {
    if (onPress) onPress(e)
  }

  const content = children ?? label

  return href ? (
    <a
      href={href}
      className={`group ${SWEEP} inline-flex w-fit min-h-12 items-center justify-center whitespace-nowrap rounded-full px-6 text-sm font-semibold ${PRESS} ${FOCUS} ${
        ghost
          ? 'border border-cem-text/20 bg-transparent text-cem-text hover:bg-cem-text/10'
          : 'bg-cem-amber text-cem-base border-t border-cem-text/20 hover:bg-cem-amber/90'
      }`}
      onPointerDown={handlePointerDown}
      onClick={onClick}
    >
      {/* The light sweep — a thin highlighted strip that crosses the surface on
          hover and on keyboard focus. Pure CSS, no JS, no colour literal (the
          highlight is the near-white text token at low alpha, not amber). */}
      <span className={SWEEP_STRIP} aria-hidden="true" />
      <span className="relative z-10">{content}</span>
    </a>
  ) : (
    <button
      type={type}
      className={`group ${SWEEP} inline-flex w-fit min-h-12 items-center justify-center whitespace-nowrap rounded-full px-6 text-sm font-semibold ${PRESS} ${FOCUS} ${
        ghost
          ? 'border border-cem-text/20 bg-transparent text-cem-text hover:bg-cem-text/10'
          : 'bg-cem-amber text-cem-base border-t border-cem-text/20 hover:bg-cem-amber/90'
      }`}
      onPointerDown={handlePointerDown}
      onClick={onClick}
    >
      <span className={SWEEP_STRIP} aria-hidden="true" />
      <span className="relative z-10">{content}</span>
    </button>
  )
})

export default SpecularButton
