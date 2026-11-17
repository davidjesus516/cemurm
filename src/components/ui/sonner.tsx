import { type CSSProperties } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from 'lucide-react'

// CEMURM mounts one toaster for the whole app, so this component must not depend
// on a theme provider. There is none outside /dashboard: ThemeProvider lives only
// inside AdminThemeBoundary (src/app/providers/AdminThemeBoundary.jsx), so the
// previous `useTheme()` call was unusable at the app root.
//
// Sonner's `theme` prop is omitted on purpose. `html.light` in src/app/index.css
// redefines the same --color-cem-* custom properties the dark ramp declares, so
// the toaster follows the palette instead of being told which one is active.
//
// `richColors` stays off and the icons stay monochrome, on purpose. The glyph is
// what carries the meaning — a check, a triangle, an octagon — so the toast stays
// readable under colour blindness and passes WCAG 1.4.1, the same reasoning that
// keeps macOS alerts mostly monochrome. Tinting an icon would also add uses of the
// four accents `check-visual-contract.sh` rule 02 ratchets down as debt, and Hard
// Rule 2 of the visual skill allows exactly one accent: amber, on the logo, the
// primary CTA and the active state. An icon tint is not on that list.
//
// The values below are the six variables Sonner 2.0.8 actually reads for a
// normal toast (dist/styles.css), mapped onto tokens that exist at runtime:
// --color-cem-* are emitted by `@theme`, --cem-radius-md is declared in :root.
// The old file read --popover, --border and --radius, none of which this project
// defines, so a mounted toaster would have rendered with empty variables.
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    className="toaster group"
    icons={{
      success: <CircleCheckIcon className="size-4" />,
      info: <InfoIcon className="size-4" />,
      warning: <TriangleAlertIcon className="size-4" />,
      error: <OctagonXIcon className="size-4" />,
      loading: <Loader2Icon className="size-4 animate-spin" />,
    }}
    style={
      {
        '--normal-bg': 'var(--color-cem-surface)',
        '--normal-text': 'var(--color-cem-text)',
        '--normal-border': 'var(--color-cem-elevated)',
        '--normal-bg-hover': 'var(--color-cem-elevated)',
        '--normal-border-hover': 'var(--color-cem-hover)',
        '--border-radius': 'var(--cem-radius-md)',
      } as CSSProperties
    }
    {...props}
  />
)

export { Toaster }
