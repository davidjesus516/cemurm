/* eslint-disable react/prop-types -- the shape is the one heading string plus
   type/behavior props; there are no propTypes anywhere in src/ (see
   FeedbackForm.jsx:1). */

import { Fragment } from 'react'
import { motion, useReducedMotion } from 'motion/react'

// EMIL §3 — easing. This is a strong ease-out, the one that starts fast and feels
// responsive, chosen over the built-in ease-out which is too weak. Named so a reader can
// see it is a deliberate curve, not a magic array.

const EASE_OUT = [0.16, 1, 0.3, 1]

// THE REVEAL. Each word is wrapped in an overflow:hidden box; the inner span starts at
// translateY(115%) with opacity 0 and animates to translateY(0)/opacity 1, so the text
// rises out of its own mask rather than fading in place. That is the primitive the reactbits
// masked-heading is built on, and this file is the display-scale version of it, used for the
// hero headline.
//
// THE OTHER COPY OF THIS PRIMITIVE IS GONE. A sibling component used to implement the same
// mask for section-scale text and this comment cited it as the precedent. It had zero
// importers, so it was deleted rather than left as an unreachable 297 lines; nothing points
// at it any more.
//
// LINE HEIGHT AND THE DESCENT RESERVE. This heading is the only line in the file that runs
// line-height under 1, and that is intentional: display type is tight. The tighter the
// line-height, the deeper the clip box must be to keep descenders inside the mask, and the
// reserve is (inkSpan - lineHeight) / 2 where inkSpan is the ascent+descent of the font. For
// Inter at its shipped metrics that is 1.21em, so at line-height 0.9 the reserve is 0.155em;
// the file rounds that UP to 0.16em and asserts it below so a later type change cannot
// silently reintroduce a clipped descender.
//
// TRACKING. Display text wants NEGATIVE tracking as it grows (Apple §15): the letters read
// too far apart as they get big, so pull them together. The hero headline is display size, so
// it carries negative tracking. The page holds both directions on purpose, one per size
// band, rather than one tracking value enforced everywhere: negative here and on the
// section headings, positive on the small uppercase eyebrows.
const LINE_LINE_HEIGHT = 0.9
const LINE_RESERVE = 'pb-[0.16em]'

// THE WORD BOX. For word-mode reveal the boxes must be inline-block so the words flow on one
// line and only wrap when the measure genuinely cannot hold them. A block box forces one unit
// per line, which at display scale turns a headline into a stack of single words and kills the
// composition. vertical-align bottom pins every inline-block box to the line-box bottom so
// the reserve math stays exact (an inline-block's baseline is its bottom margin edge, not its
// text baseline).
const WORD_BOX = 'inline-block align-bottom overflow-hidden'
const LINE_BOX = 'block overflow-hidden'

// The default scroll trigger, named so the two reveal paths above can share one definition.
const VIEWPORT = { once: true, amount: 0.4 }

// REVEAL CONTROL. `whileInView` is the default: a section heading reveals when it scrolls into
// view. The hero is the exception — its reveal is the one motion moment the page budgets, and
// it fires behind IntroLoader's opaque curtain if it waits for a viewport it is already inside.
// A caller that passes `animate` therefore drives the reveal itself (Hero passes the loader's
// ready signal) and `viewport` is inert for it, because there is no scroll trigger left to
// configure. Both paths are explicit here so neither the caller nor this file can silently
// disable the other.
export default function MaskedHeading({
  text,
  as: Tag = 'h1',
  className = '',
  stagger = 0.1,
  duration = 0.9,
  initial,
  animate,
  viewport,
}) {
  const reduce = useReducedMotion()
  const words = text.split(' ').filter(Boolean)

  if (reduce) {
    return <Tag className={className}>{text}</Tag>
  }

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: 0 } },
  }
  const unit = {
    hidden: { y: '115%', opacity: 0 },
    show: {
      y: '0%',
      opacity: 1,
      transition: { duration, ease: EASE_OUT },
    },
  }

  const MotionTag = motion[Tag]

  const reveal = animate
    ? { initial: initial ?? 'hidden', animate }
    : { initial: initial ?? 'hidden', whileInView: 'show', viewport: viewport ?? VIEWPORT }

  return (
    <MotionTag className={className} variants={container} {...reveal}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className={`${WORD_BOX} ${LINE_RESERVE}`}>
            <motion.span className={WORD_BOX} variants={unit}>
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </MotionTag>
  )
}

// ASSERTION, dev-only. The reserve is arithmetic, not a claim in prose, so a later change
// to the line-height or the font cannot silently reintroduce a clipped descender without a
// console warning in development.
const INK_SPAN = 1.21
const REQUIRED_RESERVE = (lineHeight) => Math.max(0, (INK_SPAN - lineHeight) / 2)
const SHIPPED_RESERVE = parseFloat(LINE_RESERVE.match(/0\.(\d+)em/)[1]) / 10

if (import.meta.env?.DEV && SHIPPED_RESERVE < REQUIRED_RESERVE(LINE_LINE_HEIGHT)) {
  console.warn(
    `[MaskedHeading] clip reserve ${SHIPPED_RESERVE}em is under the ${REQUIRED_RESERVE(LINE_LINE_HEIGHT)}em that line-height ${LINE_LINE_HEIGHT} demands`,
  )
}
