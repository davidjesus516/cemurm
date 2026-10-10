/* eslint-disable react/prop-types */
// codeSlots.jsx — CodeSlots: a one-time-code entry built to the reference API
// (`length`, `status`, `onChange`, `onComplete`, slot geometry, `caret`,
// `mask`, `cascade`, `rise`, `outcome`).
//
// It was in the maintainer's API list but not in the original 35, so there is no
// upstream source to read: this is built to the documented prop surface, with
// the same physics the rest of the set uses — each slot rises as it fills, the
// empty ones cascade in behind, and the caret sits on the active slot.
//
// Colours are tokens, resolved at runtime (rule 01a forbids literals in src/).
// `dangerColor` is a token name too: the reference's red is not in the palette,
// and the retired accents (rose) cannot be reintroduced by a new component.

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import { SPRING_UI, usePrefersReducedMotion } from './motion.js'
import { useTokenColors } from './colors.js'

export function CodeSlots({
  length = 6,
  status = 'idle',
  onChange,
  onComplete,
  // Colour props take TOKEN NAMES, not hex: rule 01a of
  // check-visual-contract.sh rejects colour literals in src/. Same names and
  // positions as the documented call, resolved at runtime by colors.js.
  accentColor = 'amber',
  inkColor = 'text',
  slotColor = 'elevated',
  digitColor = 'base',
  dangerColor = 'amber',
  slotSize = 44,
  gap = 8,
  radius = 12,
  bounce = 0.2,
  settle = 0.3,
  rise = 8,
  cascade = 20,
  mask = false,
  caret = true,
  outcome = 'accept',
  disabled = false,
}) {
  const [digits, setDigits] = useState(() => Array(length).fill(''))
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const reduced = usePrefersReducedMotion()
  const colors = useTokenColors({ accent: accentColor, ink: inkColor, slot: slotColor, digit: digitColor, danger: dangerColor })
  // `bounce` and `settle` are the reference's two knobs on the digit rise: how
  // much overshoot, and how long to take. Both are fed to the spring rather than
  // accepted and ignored.
  const riseSpring = useSpring(
    1,
    reduced ? { duration: 0.12 } : { type: 'spring', duration: settle, bounce },
  )
  const riseY = useTransform(riseSpring, [1, 0.9], [0, -1])

  useEffect(() => {
    setDigits((prev) => (prev.length === length ? prev : Array(length).fill('')))
    setActive((prev) => Math.min(prev, length - 1))
  }, [length])

  // One real input drives the slots: paste, keyboard, and mobile autofill all
  // arrive through it, which a div-per-slot implementation cannot do.
  const handleInput = useCallback(
    (event) => {
      const raw = event.target.value.replace(/\D/g, '').slice(0, length)
      const next = Array(length)
        .fill('')
        .map((_, i) => raw[i] || '')
      setDigits(next)
      setActive(Math.min(raw.length, length - 1))
      riseSpring.set(0.9)
      riseSpring.set(1)
      onChange?.(raw)
      if (raw.length === length) onComplete?.(raw)
    },
    [length, onChange, onComplete, riseSpring],
  )

  const focusSlot = (index) => {
    setActive(index)
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-4">
      <div className="relative inline-flex" style={{ gap }}>
        {digits.map((digit, i) => {
          const isActive = i === active && status === 'idle'
          const filled = Boolean(digit)
          // The empty slots cascade in behind the fill: each one is delayed a
          // little further, which is what makes the block feel assembled.
          const delay = (length - i) * (cascade / 1000)
          return (
            <motion.div
              key={i}
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduced ? { duration: 0.12 } : { ...SPRING_UI, delay }}
              onClick={() => focusSlot(i)}
              className="relative grid cursor-text place-items-center border font-semibold"
              // Borders, fills and ink all come from the resolved palette, so
              // the reference's five colour props are live knobs and not
              // decoration. `status === 'error'` reuses the danger token with a
              // heavier fill: the retired red accents cannot be reintroduced.
              style={{
                width: slotSize,
                height: slotSize,
                borderRadius: radius,
                borderColor: status === 'error' ? colors.danger : isActive ? colors.accent : colors.slot,
                background: filled
                  ? colors.accent
                  : status === 'error'
                    ? colors.danger
                    : status === 'success'
                      ? colors.accent
                      : 'transparent',
                color: filled || status !== 'idle' ? colors.digit : colors.ink,
                opacity: status === 'success' || status === 'error' ? 1 : 0.08,
              }}
            >
              <motion.span style={{ y: filled ? riseY : 0 }} className="text-lg">
                {filled ? (mask ? '•' : digit) : ''}
              </motion.span>
              {caret && isActive && !disabled && (
                <motion.span
                  aria-hidden="true"
                  animate={reduced ? { opacity: 1 } : { opacity: [1, 0.2, 1] }}
                  transition={reduced ? { duration: 0.15 } : { duration: 1, repeat: Infinity }}
                  className="absolute bottom-2 h-1.5 w-0.5 rounded-full"
                  style={{ background: colors.accent }}
                />
              )}
            </motion.div>
          )
        })}
        <input
          ref={inputRef}
          value={digits.join('')}
          onChange={handleInput}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`${length}-character code`}
          className="absolute inset-0 h-full w-full opacity-0"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          transition={SPRING_UI}
          onClick={() => onComplete?.(digits.join(''))}
          className="min-h-11 rounded-lg bg-cem-amber px-4 text-sm font-semibold text-cem-base"
        >
          Verify
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          transition={SPRING_UI}
          onClick={() => {
            setDigits(Array(length).fill(''))
            setActive(0)
          }}
          className="min-h-11 rounded-lg border border-cem-elevated px-4 text-sm font-medium text-cem-text hover:bg-cem-elevated"
        >
          Clear
        </motion.button>
        {status !== 'idle' && (
          <span className={`text-xs font-medium ${status === 'error' ? 'text-cem-amber' : 'text-cem-secondary'}`}>
            {status === 'success' ? 'Accepted' : 'Rejected'} · outcome: {outcome}
          </span>
        )}
      </div>

      <p className="text-xs leading-5 text-cem-secondary">
        One hidden input drives every slot, so paste, the keyboard and mobile
        autofill all work — a div-per-slot grid cannot do that. Filled slots rise{' '}
        <code className="rounded bg-cem-elevated px-1">{rise}px</code>, the empty
        ones cascade in at <code className="rounded bg-cem-elevated px-1">{cascade}ms</code>{' '}
        apart, and the danger state reuses amber with a heavier fill rather than
        reintroducing the retired red.
      </p>
    </div>
  )
}