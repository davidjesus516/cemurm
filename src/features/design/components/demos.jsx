// demos.jsx — the /design page's instances of the ported components, driven
// through the REFERENCE prop surface rather than left on defaults.
//
// Why this file exists: a component shown with no props proves nothing about its
// API. Each instance below is the same call the reference documentation shows,
// with the reference's own example data — a reel-to-reel list for the
// shredder, an export-format list with tags for the select, five playability
// words for the rating — so the page exercises the real contract.
//
// The colour props take TOKEN NAMES (see colors.js), which is the one deviation
// from the documented call: rule 01a of check-visual-contract.sh rejects colour
// literals in src/. Every other prop matches the reference exactly.

import { useState } from 'react'
import { Archive02Icon, Delete02Icon, MusicNote01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CardNav,
  Dock,
  GlideSelect,
  GlassIcons,
  JellyRadio,
  PeekRating,
  Shredder,
  SwipeRow,
  SwipeToast,
} from './index.js'
import { icon } from './icons.jsx'

/* --------------------------------------------------------------- Shredder */

const REELS = [
  { id: 1, name: 'Harbour at dusk', meta: 'Concert · rear hall', size: '4.1 MB' },
  { id: 2, name: 'Studio, take two', meta: 'Rehearsal · 96 bpm', size: '2.8 MB' },
  { id: 3, name: 'Fog over the bay', meta: 'Concert · closing', size: '6.3 MB' },
  { id: 4, name: 'Last call, uncut', meta: 'Live · single take', size: '9.7 MB' },
]

export function ShredderDemo() {
  const [files, setFiles] = useState(REELS)
  return (
    <div className="space-y-3">
      {/* The machine needs a floor to stand on: the root carries no background
          of its own, so without this frame it sits directly on the demo card's
          bg-cem-surface and the surface-coloured rows read as nothing. bg-cem-base
          is a recessed well, which puts the rows back in contrast and gives the
          falling strips something to fall across.
          NOT w-fit: the root sizes itself `min(var(--sh-w), 100%)`, and a
          fit-content parent leaves that 100% indeterminate — the machine
          collapses to content width and the demo renders empty. A block parent
          has a definite width, so 100% resolves. */}
      <div className="rounded-xl border border-cem-elevated bg-cem-base p-4">
        <Shredder
          items={files}
          renderItem={(file) => (
            /* The row is not decoration here, it is the shredder's INPUT: the
               component snapshots this div to a texture and the falling strips
               are slices of these pixels. A bare text row shreds into
               unreadable hairlines; a row with a glyph and a second line
               shreds into fragments you can still recognise. So the row carries
               a recessed thumbnail tile, the name, and a subtitle — which is
               also what the row would look like in the product.
               bg-cem-elevated, not bg-cem-surface: two adjacent steps of the
               same dark ramp made the strips invisible against the well. Text
               follows the fill up — secondary on elevated is 4.04:1 and the gate
               enforces 4.5:1, so the sub-line uses secondary-elevated. */
            <div className="flex items-center gap-3 rounded-xl border border-cem-elevated bg-cem-elevated py-2 pl-2 pr-4">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-cem-base text-cem-amber">
                <HugeiconsIcon icon={MusicNote01Icon} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-cem-text">{file.name}</span>
                <span className="block truncate text-xs text-cem-secondary-elevated">{file.meta}</span>
              </span>
              <span className="flex-none text-xs tabular-nums text-cem-secondary-elevated">{file.size}</span>
            </div>
          )}
          onShred={(file) => setFiles((prev) => prev.filter((f) => f.id !== file.id))}
          onReorder={(next) => setFiles(next)}
          width={440}
          height={460}
          feedSpeed={180}
          bite={18}
          stripWidth={10}
          curl={1}
          autoAnimate={false}
          loop
          loopAfterDelete={false}
          fallHeight={140}
          inset={14}
          gap={10}
          slitHeight={4}
          autoFeed
          dragTilt={6}
          lift={1.02}
          slitColor="elevated"
          color="text"
          disabled={false}
        />
      </div>
      <p className="text-xs text-cem-secondary">
        Drag a reel into the slit, or focus it and press{' '}
        <kbd className="rounded bg-cem-elevated px-1">Delete</kbd>. Drag it above
        the stack instead and the rest closes the gap like cards. The slit
        shivers while something is being pulled.
      </p>
    </div>
  )
}

/* --------------------------------------------------------------- SwipeRow */

const ROW_ACTIONS = [
  {
    id: 'delete',
    label: 'Delete',
    icon: <HugeiconsIcon icon={Delete02Icon} size={20} />,
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: <HugeiconsIcon icon={Archive02Icon} size={20} />,
    dismiss: true,
  },
]

export function SwipeRowDemo() {
  const [log, setLog] = useState('nothing yet')
  return (
    <div className="space-y-3">
      <SwipeRow
        actions={ROW_ACTIONS}
        onAction={(action) => setLog(`action: ${action.id}`)}
        onCommit={(action) => setLog(`committed: ${action.label}`)}
        actionColor="amber"
        drawerColor="elevated"
        rowColor="surface"
        textColor="text"
        height={64}
        radius={16}
        actionWidth={80}
        direction="left"
        snapBounce={0.2}
        resistance={0.55}
        collapseMs={200}
        commitAt={0.6}
        fullSwipe
        disabled={false}
      >
        <span className="text-sm text-cem-text">Design review notes</span>
      </SwipeRow>
      <p className="text-xs text-cem-secondary">
        Swipe left to reveal, keep going to commit. The target is the{' '}
        <em>projected</em> resting point from the release velocity, not where you
        let go — last event: <code className="rounded bg-cem-elevated px-1">{log}</code>.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------- SwipeToast */

export function SwipeToastDemo() {
  const [open, setOpen] = useState(true)
  const [reason, setReason] = useState('—')
  const [count, setCount] = useState(0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            setReason('—')
          }}
          className="min-h-11 rounded-lg border border-cem-elevated px-4 text-sm font-medium text-cem-text hover:bg-cem-elevated"
        >
          Show toast
        </button>
        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="min-h-11 rounded-lg border border-cem-elevated px-4 text-sm font-medium text-cem-text hover:bg-cem-elevated"
        >
          Stack inline ({count})
        </button>
      </div>

      {open ? (
        <SwipeToast
          open={open}
          onClose={(why) => {
            setReason(why)
            setOpen(false)
          }}
          title="File archived"
          description="Moved to Archive"
          actionLabel="Undo"
          onAction={() => setReason('undo')}
          background="elevated"
          color="text"
          fuseColor="amber"
          width={356}
          radius={12}
          slideMs={400}
          settleBounce={0.2}
          swipeDistance={40}
          duration={4000}
          fuse="bottom"
          pauseOnHover
          closeButton={false}
          inline
        />
      ) : null}

      {Array.from({ length: count }, (_, i) => (
        <SwipeToast
          key={i}
          inline
          title="Link copied"
          duration={2500}
          onClose={() => setCount((c) => Math.max(0, c - 1))}
        />
      ))}

      <p className="text-xs text-cem-secondary">
        The fuse is a real countdown, and it pauses on hover, on focus, while you
        drag it and while the tab is hidden. Swipe it down to throw it away;
        <kbd className="rounded bg-cem-elevated px-1">Esc</kbd> dismisses instantly
        because a keyboard user should never wait out an animation. Last close
        reason: <code className="rounded bg-cem-elevated px-1">{reason}</code>.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------- GlideSelect */

const FORMATS = [
  { value: 'png', label: 'PNG', tag: 'Lossless' },
  { value: 'jpg', label: 'JPG', tag: 'Smallest' },
  { value: 'webp', label: 'WebP', tag: 'Modern' },
  { value: 'svg', label: 'SVG', tag: 'Vector' },
  { value: 'pdf', label: 'PDF', tag: 'Print' },
]

export function GlideSelectDemo() {
  const [value, setValue] = useState('png')
  return (
    <div className="space-y-3">
      <GlideSelect
        options={FORMATS}
        value={value}
        onChange={(next, option) => setValue(next ?? option?.value)}
        ariaLabel="Export format"
        showTags
        accentColor="amber"
        surfaceColor="surface"
        highlightColor="elevated"
        textColor="text"
        size="md"
        radius={10}
        menuWidth={176}
        placement="bottom"
        align="left"
        popDuration={180}
        glideDuration={220}
        rememberPosition
        disabled={false}
      />
      <p className="text-xs text-cem-secondary">
        The pill is written imperatively in a layout effect, so a scrub that
        reverses mid-glide continues from the on-screen value instead of
        restarting. Press and drag down the list: the pill follows your finger
        and the choice commits on release. Arrow keys, typeahead and{' '}
        <kbd className="rounded bg-cem-elevated px-1">Home</kbd>/
        <kbd className="rounded bg-cem-elevated px-1">End</kbd> work too.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------- PeekRating */

export function PeekRatingDemo() {
  const [value, setValue] = useState(3)
  return (
    <div className="space-y-3">
      <PeekRating
        value={value}
        onChange={setValue}
        count={5}
        shape="star"
        labels={['Poor', 'Fair', 'Good', 'Great', 'Superb']}
        activeColor="amber"
        idleColor="elevated"
        tipColor="elevated"
        tipTextColor="text"
        size={40}
        lift={8}
        magnify={1.15}
        riseDuration={320}
        popScale={1.3}
        showTip
        showLabels
        allowClear
        readOnly={false}
        disabled={false}
      />
      <p className="text-xs text-cem-secondary">
        Hover to preview, release to commit. Pressing the star that already holds
        the value clears it, and the tip tracks the <em>slot</em>, not the
        pointer, so it always sits under the star it names. Value: {value}.
      </p>
    </div>
  )
}

/* --------------------------------------------------------------- JellyRadio */

const LEVELS = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Max', label: 'Max' },
]

const VIEWS = [
  { value: 'list', label: 'List', icon: icon('setlists', 16) },
  { value: 'grid', label: 'Grid', icon: icon('grid', 16) },
  { value: 'map', label: 'Map', icon: icon('gigs', 16), disabled: true },
]

export function JellyRadioDemo() {
  const [level, setLevel] = useState('Medium')
  const [view, setView] = useState('grid')
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <JellyRadio
          items={LEVELS}
          value={level}
          onChange={(next) => setLevel(next)}
          chipColor="elevated"
          activeColor="text"
          textColor="text"
          activeTextColor="base"
          size="md"
          gap={8}
          radius={18}
          swell={0.2}
          barge={6}
          shrink={0.05}
          jelly={1}
          bounce={0.25}
          stagger={22}
          stiffness={580}
          disabled={false}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <JellyRadio
          items={VIEWS}
          value={view}
          onChange={(next) => setView(next)}
          size="md"
          disabled={false}
        />
      </div>
      <p className="text-xs text-cem-secondary">
        Every chip owns three motion values and releases on its own spring,
        staggered by distance from the selection, with x-stiffness falling 12% per
        step. Neighbours shove by{' '}
        <code className="rounded bg-cem-elevated px-1">(width × swell) / 2 + barge</code>.
        &ldquo;Map&rdquo; is disabled and arrow keys skip it. Level: {level}, view: {view}.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------- Dock */

export function DockDemo() {
  const [last, setLast] = useState('—')
  const items = [
    { icon: icon('home', 18), label: 'Home', color: 'elevated', onClick: () => setLast('Home') },
    { icon: icon('repertoire', 18), label: 'Archive', color: 'elevated', onClick: () => setLast('Archive') },
    { icon: icon('profile', 18), label: 'Profile', color: 'amber', onClick: () => setLast('Profile') },
    { icon: icon('settings', 18), label: 'Settings', color: 'elevated', onClick: () => setLast('Settings') },
  ]
  return (
    <div className="space-y-3">
      <div className="flex h-56 items-center overflow-hidden rounded-xl bg-cem-base/60">
        <Dock items={items} panelHeight={68} baseItemSize={50} magnification={70} distance={200} />
      </div>
      <p className="text-xs text-cem-secondary">
        The item&apos;s <em>width and height</em> are the animated values, so a
        magnified tile pushes its neighbours aside and the panel grows to fit it.
        Profile is amber because it is the current destination. Last tap:{' '}
        <code className="rounded bg-cem-elevated px-1">{last}</code>.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------- GlassIcons */

/* The reference's own example shape — six tiles, one per reference colour
   name. The names still work (warm names take amber, cool names the neutral
   plate); a real token name works too. */
const GLASS_ITEMS = [
  { icon: icon('setlists'), color: 'blue', label: 'Files' },
  { icon: icon('repertoire'), color: 'purple', label: 'Songs' },
  { icon: icon('headphones'), color: 'red', label: 'Health' },
  { icon: icon('gigs'), color: 'indigo', label: 'Weather' },
  { icon: icon('bell'), color: 'orange', label: 'Alerts' },
  { icon: icon('home'), color: 'green', label: 'Stats' },
]

export function GlassIconsDemo() {
  return (
    <div className="space-y-3">
      <div className="relative h-[600px] overflow-hidden rounded-xl bg-cem-base/60">
        <GlassIcons items={GLASS_ITEMS} />
      </div>
      <p className="text-xs text-cem-secondary">
        `perspective: 24em` on the grid and `preserve-3d` on each tile: that pair
        is what makes the back plate read as depth instead of as a skewed square.
        The plate turns 15° from its own bottom-right corner and travels forward{' '}
        <code className="rounded bg-cem-elevated px-1">2em</code> on hover while
        the glass face comes to meet it.
      </p>
    </div>
  )
}

/* --------------------------------------------------------------- CardNav */

/* The app's own 13 destinations (AppLayout.jsx `navLinks`, same labels and
   same routes), grouped into the reference's three-card limit: Play, Band,
   System. `href` is the real route — the reference renders plain <a> elements,
   so these navigate by full page load, which is its contract, not an oversight.
   The colour props are token names (colors.js): the ramp's three steps behind
   `text` ink, so all three cards clear 4.5:1. */
const NAV_CARDS = [
  {
    label: 'Play',
    bgColor: 'surface',
    textColor: 'text',
    links: [
      { label: 'Home', href: '/', ariaLabel: 'Go to Home' },
      { label: 'Repertoire', href: '/songs', ariaLabel: 'Go to Repertoire' },
      { label: 'Library', href: '/library', ariaLabel: 'Go to Library' },
      { label: 'Setlists', href: '/setlists', ariaLabel: 'Go to Setlists' },
      { label: 'Gigs', href: '/gigs', ariaLabel: 'Go to Gigs' },
    ],
  },
  {
    label: 'Band',
    bgColor: 'elevated',
    textColor: 'text',
    links: [
      { label: 'Rehearsals', href: '/rehearsals', ariaLabel: 'Go to Rehearsals' },
      { label: 'Bandmates', href: '/bandmates', ariaLabel: 'Go to Bandmates' },
      { label: 'Organizations', href: '/organizations', ariaLabel: 'Go to Organizations' },
      { label: 'Services', href: '/services', ariaLabel: 'Go to Services' },
    ],
  },
  {
    label: 'System',
    bgColor: 'base',
    textColor: 'text',
    links: [
      { label: 'Moderation', href: '/moderation', ariaLabel: 'Go to Moderation' },
      { label: 'Notifications', href: '/notifications', ariaLabel: 'Go to Notifications' },
      { label: 'Settings', href: '/settings', ariaLabel: 'Go to Settings' },
      { label: 'Storage', href: '/settings/storage', ariaLabel: 'Go to Storage' },
    ],
  },
]

export function CardNavDemo() {
  /* No caption paragraph, unlike every other demo here: the reference
     positions the bar absolutely inside its container, so copy in normal flow
     would land underneath it. The /design note explains the demo instead. */
  return (
    <CardNav
      logo="/ceumrm-wordmark.svg"
      logoAlt="CEMURM"
      items={NAV_CARDS}
      baseColor="text"
      menuColor="base"
      buttonBgColor="base"
      buttonTextColor="text"
      ease="power3.out"
    />
  )
}
