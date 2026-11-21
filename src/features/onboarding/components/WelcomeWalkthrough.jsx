import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WALKTHROUGH_SLIDES } from '../../../domain/onboarding/content.js'
import { markWalkthroughDone } from '../localFlags.js'

// Tier 1 (auth/welcome): full macOS language — surface, radius and depth are
// all in the token layer. Swipe = touchstart/touchend delta, no animation lib.
function WelcomeWalkthrough() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [touchX, setTouchX] = useState(null)
  const slide = WALKTHROUGH_SLIDES[index]
  const isLast = index === WALKTHROUGH_SLIDES.length - 1

  function finish(fromOnboarding) {
    markWalkthroughDone()
    navigate('/auth', { state: { fromOnboarding, intent: 'signup' } })
  }

  function advance() {
    if (isLast) finish(true)
    else setIndex((i) => i + 1)
  }

  function onTouchEnd(event) {
    if (touchX === null) return
    const delta = event.changedTouches[0].clientX - touchX
    if (delta < -40) advance()
    else if (delta > 40 && index > 0) setIndex((i) => i - 1)
    setTouchX(null)
  }

  return (
    <section
      aria-label="Welcome walkthrough"
      className="mx-auto max-w-lg rounded-xl border border-cem-elevated bg-cem-surface p-8 shadow-lg"
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={onTouchEnd}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-cem-amber">
        Step {index + 1} of {WALKTHROUGH_SLIDES.length}
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-cem-text">{slide.topic}</h2>
      <p className="mt-3 text-sm leading-relaxed text-cem-secondary-elevated">{slide.body}</p>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => finish(false)}
          className="rounded-md px-3 py-2 text-sm font-medium text-cem-secondary-elevated hover:bg-cem-elevated"
        >
          Skip
        </button>
        <div className="flex items-center gap-3">
          <div aria-hidden="true" className="flex gap-1.5">
            {WALKTHROUGH_SLIDES.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full ${i === index ? 'w-5 bg-cem-amber' : 'w-1.5 bg-cem-elevated'}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={advance}
            className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </section>
  )
}

export default WelcomeWalkthrough
