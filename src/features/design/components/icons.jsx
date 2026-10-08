/* eslint-disable react/prop-types */
// icons.jsx — the icon set the /design page and the component defaults draw
// from, so a component never invents its own inline SVG.
//
// These are Hugeicons (already a dependency for the app's icon usage), stroked
// at the same weight and optical size so they sit on the same baseline as the
// type. Everything takes `size` and inherits colour from `currentColor`: an
// icon is a glyph, not a decoration, and a second palette for icons is the same
// mistake as a second palette for surfaces.

import { HugeiconsIcon } from '@hugeicons/react'
import {
  Archive02Icon,
  Delete02Icon,
  FlashIcon,
  Grid2X2Icon,
  Grid3x3Icon,
  HeadphonesIcon,
  Home01Icon,
  MusicNote01Icon,
  Notification03Icon,
  Settings01Icon,
  StarIcon,
  UserAccountIcon,
} from '@hugeicons/core-free-icons'

const SOURCES = {
  home: Home01Icon,
  repertoire: MusicNote01Icon,
  setlists: Grid3x3Icon,
  gigs: Archive02Icon,
  profile: UserAccountIcon,
  settings: Settings01Icon,
  grid: Grid2X2Icon,
  headphones: HeadphonesIcon,
  bolt: FlashIcon,
  star: StarIcon,
  bell: Notification03Icon,
  delete: Delete02Icon,
}

export function Icon({ name, size = 22, strokeWidth = 2, ...rest }) {
  const source = SOURCES[name]
  if (!source) return null
  return <HugeiconsIcon icon={source} size={size} strokeWidth={strokeWidth} {...rest} />
}

/** Icon element for passing into a component's `icon` prop. */
export function icon(name, size = 22) {
  return <Icon name={name} size={size} />
}

export { SOURCES as ICON_SOURCES }
