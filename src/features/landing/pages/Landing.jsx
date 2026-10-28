import { useEffect, useState } from 'react'
import { landing } from '../../../content/landing.es.js'
import IntroLoader from '../components/IntroLoader.jsx'
import Header from '../components/Header.jsx'
import Hero from '../components/Hero.jsx'
import StageBus from '../components/StageBus.jsx'
import Galeria from '../components/Galeria.jsx'
import Features from '../components/Features.jsx'
import Registro from '../components/Registro.jsx'
import CtaFinal from '../components/CtaFinal.jsx'
import Accordion from '../components/Accordion.jsx'
import Footer from '../components/Footer.jsx'

// The new landing. Nine sections in the agreed order, all copy from the content module:
// Hero, problema, Stage Bus, Galería, Capacidades, Cómo funciona, Registro, CTA final, FAQ.
// Header, Footer and the intro curtain are page chrome, not sections.
// The header CTA is the ghost outline variant while the hero's primary amber pill is on screen,
// and the solid amber pill once the hero has scrolled out — so the two amber CTAs never sit on
// screen together.
//
// WATCHING THE HERO FOR THE HEADER CTA STATE. The header needs to know whether the hero's
// primary amber pill is on screen so it can switch the header CTA between ghost and solid. The
// page owns that state through ONE IntersectionObserver on the hero; the header reads it as a
// prop. The header never starts an observer for this, because that would be a second observer for
// the same decision.

export default function Landing() {
  const [heroInView, setHeroInView] = useState(true)

  // ONE INTERSECTIONOBSERVER, NOT A SCROLL LISTENER. This used to be a
  // `window.addEventListener('scroll', ...)` that re-measured the hero's rect and called
  // setState on every scroll event, with no frame coalescing at all. design-taste-frontend §5.D
  // bans that pattern outright and names IntersectionObserver as the replacement.
  //
  // `isIntersecting` at threshold 0 is the SAME predicate the rect test computed,
  // `rect.bottom > 0 && rect.top < window.innerHeight`, so the observable behaviour is
  // unchanged. What changes is the cost: the measurement happens off the main thread and
  // the callback fires once per enter and once per exit, not once per event.
  useEffect(() => {
    const hero = document.getElementById('hero')
    if (!hero || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      ([entry]) => setHeroInView(entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  // The registration handler — a placeholder until you wire the backend. For now it logs the
  // address; replace with the real signup when the endpoint exists. The section components call
  // this so the form behaviour is one place, not repeated in each section.
  const handleRegister = (email) => {
    console.log('[landing] register', email)
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-cem-base">
      {/* Intro loader — full-viewport curtain with logo + progress bar, raised on ready. */}
      <IntroLoader />

      {/* Header — sticky glass material, mobile dock, secondary CTA that becomes solid once the
          hero has scrolled out. */}
      <Header heroInView={heroInView} />

      <main className="flex-1">
        {/* Hero — masked-heading + specular CTA + Stage Bus mockups in a rotating fan. */}
        <Hero />

        {/* Problema — editorial, no component noise. */}
        <section
          id="problema"
          className="border-t border-cem-text/10 px-4 py-20 md:px-6 md:py-28 bg-cem-base"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tighter leading-[1.05] text-cem-text md:text-5xl">
              {landing.problema.title}
            </h2>
            <div className="mt-10 space-y-6 text-lg leading-relaxed text-cem-secondary">
              {landing.problema.body.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </div>
          </div>
        </section>

        {/* Stage Bus — floating panel + carousel + dock mobile + click-spark + border-glow. */}
        <StageBus />

        {/* Galeria — accordion of media items + border-glow + spark. */}
        <Galeria />

        {/* Features — bento glass-icons coloridos + animated-list of steps. */}
        <Features />

        {/* Como funciona — editorial, no component noise. */}
        <section
          id="como-funciona"
          className="border-t border-cem-text/10 px-4 py-20 md:px-6 md:py-28 bg-cem-base"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tighter leading-[1.05] text-cem-text md:text-5xl">
              {landing.comoFunciona.title}
            </h2>
            <p className="mt-8 text-lg leading-relaxed text-cem-secondary">
              {landing.comoFunciona.body}
            </p>
          </div>
        </section>

        {/* Registro — email + specular CTA + spark + feedback. */}
        <Registro onSubmit={handleRegister} />

        {/* CtaFinal — masked-heading + email + ghost CTA pointing up. */}
        <CtaFinal onSubmit={handleRegister} />

        {/* Faq — accordion with staggered clip reveal + border-glow. */}
        <Accordion />
      </main>

      {/* Footer — note + license + four columns + legal bar. */}
      <Footer />
    </div>
  )
}
