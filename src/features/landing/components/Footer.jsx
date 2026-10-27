import { landing } from '../../../content/landing.es.js'

// A footer is content-layer text, not chrome, so it gets no material and no shadow. Elevation
// in dark mode is carried by lightness, and a lighter fill here would read as a panel for no
// reason. The only separator is the 1px hairline that matches the rest of the page.

export default function Footer() {
  return (
    <footer className="border-t border-cem-text/10 px-4 py-12 md:px-6 md:py-16 bg-cem-base">
      <div className="mx-auto max-w-6xl">
        {/* Top row — note + license. */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm text-cem-secondary">
          <p>{landing.footer.note}</p>
          <p>{landing.footer.license}</p>
        </div>

        {/* Four nav columns. */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {landing.footer.columns.map((col) => (
            <div key={col.label}>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-cem-secondary">
                {col.label}
              </p>
              <ul className="space-y-2">
                {col.links.map((link) => {
                  const id = landing.footer.anchors[link]
                  return (
                    <li key={link}>
                      {/* Anchor only where this page has that section; an href="#" goes
                          nowhere. */}
                      {id ? (
                        <a
                          href={`#${id}`}
                          className="text-sm text-cem-secondary hover:text-cem-text transition-colors duration-200"
                        >
                          {link}
                        </a>
                      ) : (
                        <span className="text-sm text-cem-secondary">{link}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Legal bottom bar. */}
        <div className="mt-10 pt-6 border-t border-cem-text/10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-xs text-cem-secondary">
          <p>{landing.footer.legal.reserved}</p>
          <p className="max-w-xs text-center sm:text-left">{landing.footer.legal.mission}</p>
        </div>
      </div>
    </footer>
  )
}
