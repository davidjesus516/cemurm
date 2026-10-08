/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'

// skeleton.jsx — a documented Skeleton contract, mirrored in plain JSX.
//
// WHY MIRRORED AND NOT IMPORTED: a component package that peer-requires React
// >=19 and Tailwind >=4 cannot be installed here (this repo runs React 18.3.1 +
// Tailwind 3.4.19), and loading it anyway fails at module load — a React 19
// `use` import evaluated under React 18 leaves `react` providing no export
// named `use`, which is exactly what turned three design test files red. It
// would also ship a second theme, and injecting a second colour system is what
// rule 04 forbids.
//
// The layer below RAC is worth noting: `react-aria-components` ships NO styles
// at all. Zero colours. So the
// BEM classes and the sweep below are the same work either way; only the
// behaviour is outsourced. See listBox.jsx for that half.
//
// Preserved from the source component one for one: the `animationType` prop
// (shimmer / pulse / none), the `isLoaded` early return, the
// `--skeleton-animation` global override, and the `skeleton--*` class names.

/**
 * The animation resolves from the `animationType` prop first and from
 * the `--skeleton-animation` custom property second. The property is read
 * after mount so server markup and the first client paint cannot disagree.
 */
function useAnimationType(animationType) {
  const [global, setGlobal] = useState(null)

  useEffect(() => {
    const raw = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--skeleton-animation')
      .trim()
    setGlobal(raw === 'pulse' || raw === 'none' ? raw : 'shimmer')
  }, [])

  if (animationType) return animationType
  return global || 'shimmer'
}

export function Skeleton({ animationType, isLoaded = false, className = '', children, ...rest }) {
  // The hook runs BEFORE the isLoaded early return: hook order must be
  // identical on every render, or React tears down the effects above.
  const type = useAnimationType(animationType)

  if (isLoaded && children) return children

  const variant =
    type === 'pulse' ? 'skeleton--pulse' : type === 'none' ? 'skeleton--none' : 'skeleton--shimmer'

  // A plain div, the same shape the source component renders: `dom.div` with
  // the variant classes. The animation classes were the whole component, and
  // they live in index.css beside the keyframes they drive.
  //
  // `relative overflow-hidden` are written out here for the same reason they are
  // on SkeletonGroup below: they belong on the element itself, and the
  // sweep's `::after` is absolutely positioned. A caller can also drop the bare
  // `skeleton--shimmer` class on their own element, which is why the stylesheet
  // declares the same pair — but the component that owns the class should not
  // depend on that file being loaded.
  return <div className={`skeleton ${variant} relative overflow-hidden ${className}`} {...rest} />
}

export function SkeletonGroup({ animationType = 'shimmer', className = '', children, ...rest }) {
  useAnimationType(animationType)
  // `relative overflow-hidden` are load-bearing, not decoration: the sweep is an
  // absolutely-positioned pseudo-element with top/bottom/left 0 and 50% width,
  // so without a positioned, clipping host it resolves against the PAGE and the
  // highlight travels across the whole screen. `.skeleton--shimmer` carries both
  // too — this is the explicit half of the same guarantee, so the markup says
  // why rather than relying on a stylesheet someone may not have read.
  //
  // The animationType argument is deliberately dropped from the rendered box: a
  // group is the SYNCHRONISED host. One sweep crosses the whole block, and the
  // children opt out with `animationType="none"`. Honouring the prop here would
  // give the group its own sweep plus a parent sweep, i.e. two highlights.
  return (
    <div className={`skeleton--shimmer relative overflow-hidden ${className}`} {...rest}>
      {children}
    </div>
  )
}

/** A text-line placeholder. Inherits the group's animation by opting out. */
export function SkeletonLine({ width = '100%', className = '', ...rest }) {
  return <div className={`skeleton skeleton--none h-3 ${className}`} style={{ width }} {...rest} />
}

/** The page-level skeleton for /design: the same shape as the real page. */
export function DesignPageSkeleton() {
  return (
    <div className="max-w-5xl" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the design system…</span>

      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-full max-w-prose" />
      <Skeleton className="mt-2 h-4 w-2/3 max-w-prose" />

      <SkeletonGroup className="mt-10 grid gap-4 sm:grid-cols-4">
        {['ramp-1', 'ramp-2', 'ramp-3', 'ramp-4'].map((key) => (
          <div key={key}>
            <Skeleton animationType="none" className="h-16 w-full" />
            <SkeletonLine className="mt-2 w-20" />
            <SkeletonLine className="mt-1 w-28" />
          </div>
        ))}
      </SkeletonGroup>

      <SkeletonGroup className="mt-10 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-xl border border-cem-elevated bg-cem-surface p-5">
            <Skeleton animationType="none" className="h-4 w-32" />
            <Skeleton animationType="none" className="mt-4 h-24 w-full" />
            <SkeletonLine className="mt-4" />
            <SkeletonLine className="mt-2 w-4/5" />
          </div>
        ))}
      </SkeletonGroup>
    </div>
  )
}