/* eslint-disable react/prop-types */
// listBox.jsx — a documented ListBox contract, backed by react-aria-components.
//
// WHY RAC: a component package that peer-requires React >=19 and Tailwind >=4
// cannot load in this repo — React 18.3.1 + Tailwind 3.4.19 — because a
// React 19 `use` import evaluated under React 18 fails at module load (`react`
// provides no export named `use`), which is what turned three design test files
// red before this file existed. It would also ship a second theme, which is
// exactly the palette growth rule 04 forbids. RAC accepts React 18 and carries
// no Tailwind peer, no theme and no colours: zero effect on rule 04.
//
// THE TRADE, STATED PLAINLY: RAC ships behaviour, this file ships the surface.
// Keyboard navigation, typeahead, focus management, selection state,
// virtualization and the whole ARIA listbox pattern are RAC's; the BEM classes
// and the tokens are ours, and they would have to be under rule 04 regardless.
//
// COLLECTION NESTING — verified, not guessed. RAC's standalone `ListBox` builds
// its own collection: `dist/private/ListBox.mjs` wraps its children in
// `CollectionBuilder` + `Collection`, so `<ListBox>` IS the collection-aware
// boundary and no explicit `<Collection>` wrapper is needed. Its `SectionContext`
// provider names `ListBoxSection` as the section render function, which is why
// `ListBoxSection` must be RAC's own component and not an element of ours.
// A plain function wrapper around `ListBoxItem` was probed and works, because
// the collection builder reads the rendered tree rather than the element type —
// so these wrappers are safe, and that is a measured result, not an assumption.
//
// The failure mode this shape avoids: putting a plain `<div>` between the ListBox
// and its items. RAC would render zero rows, with no error and no warning, because
// a raw div is not a collection node. Everything between the two must be
// `ListBox.Item`, `ListBox.Section`, a fragment, or one of RAC's own collection
// components.
//
// ON Header / Label / Description / Surface / Kbd: the source contract composes
// these five around a ListBox, but RAC does not export Description, Surface or
// Kbd at all (verified by runtime probe of the package's exports), and RAC's
// `Header`/`Label` are collection leaves whose styling the caller brings — RAC
// ships no styles. Composing five new
// primitives for a review surface would be inventing an API nobody asked for, and
// `/design` already has an answer for all five: `Demo`/`DemoCard` for the surface,
// `text-cem-text` / `text-cem-secondary` for label and description, the page's own
// `Section` headings for headers. That is what the demos use, and reusing the
// existing vocabulary is why the demos read like the rest of the page.

import {
  Header as RacHeader,
  ListBox as RacListBox,
  ListBoxItem as RacListBoxItem,
  ListBoxSection as RacListBoxSection,
} from 'react-aria-components'
import { createContext, useContext } from 'react'

// The selection state an ItemIndicator needs, bridged out of RAC's context so the
// component can read it with a hook instead of importing a context object into
// every caller. RAC already publishes `SelectionIndicatorContext` and sets it on
// every ListBoxItem (dist/private/ListBox.mjs), so this re-provides the same value
// under a local name — the local context is what makes the indicator work even if
// RAC's naming moves, and it keeps the public surface of this file to four names.
const ItemStateContext = createContext(null)

function useItemState() {
  return useContext(ItemStateContext) ?? { isSelected: false }
}

/** The selection check. Children may be a render function receiving `{ isSelected }`. */
export function ListBoxItemIndicator({ children, className = '', ...rest }) {
  const { isSelected } = useItemState()
  const visible = String(!!isSelected)

  return (
    <span className={`list-box-item__indicator ${className}`} data-visible={visible} {...rest}>
      {typeof children === 'function' ? children({ isSelected }) : children ?? <CheckGlyph />}
    </span>
  )
}

/**
 * The default check glyph. Inline SVG on `currentColor` at `size-4`, the same
 * convention as the icon set in icons.jsx: an icon is a glyph, so it inherits the
 * item's colour and there is no second palette for icons.
 */
function CheckGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

/**
 * One option. Children may be a render function receiving
 * `{ isSelected, isFocused, isDisabled, isPressed }`.
 *
 * The render-prop values are RAC's own (ItemRenderProps in
 * node_modules/react-aria-components/dist/types/src/Collection.d.ts), so the
 * four values this component documents are a subset of what is available rather than a
 * re-derivation of it.
 */
export function ListBoxItem({ variant = 'default', className = '', children, ...rest }) {
  return (
    <RacListBoxItem
      {...rest}
      // A plain string child: RAC reads `textValue` for typeahead and labels the
      // option with it, so nothing extra is needed here.
      className={[
        'list-box-item',
        `list-box-item--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {(values) => (
        <ItemStateContext.Provider value={values}>
          {typeof children === 'function' ? children(values) : children}
        </ItemStateContext.Provider>
      )}
    </RacListBoxItem>
  )
}

/**
 * A group of options.
 *
 * `title` renders RAC's own `Header`, and that is not a convenience — it is the
 * accessible name. RAC's `useListBoxSection` puts `aria-labelledby` on the section
 * pointing at the id the Header registers through `HeaderContext`; a plain
 * `<header>` child does not register one, and the rendered markup then points
 * `aria-labelledby` at an id that does not exist (probed, not assumed). So `title`
 * is the section label by contract and a raw element is not accepted.
 *
 * RAC renders `Header` as a `<header>` element carrying `react-aria-Header`, which
 * is why the stylesheet styles `.list-box-section > header` rather than a BEM
 * class of our own — the element type is the stable hook, and the source
 * stylesheet this contract mirrors has no rule for the section label either.
 */
export function ListBoxSection({ title, className = '', children, ...rest }) {
  return (
    <RacListBoxSection {...rest} className={['list-box-section', className].filter(Boolean).join(' ')}>
      {title ? <RacHeader>{title}</RacHeader> : null}
      {children}
    </RacListBoxSection>
  )
}

/**
 * The listbox itself.
 *
 * `selectionMode` defaults to `"single"` — the documented default for this
 * contract, and RAC's
 * own default is `"none"`, so the default is set explicitly here rather than
 * inherited. Everything else is RAC's prop surface passed straight through:
 * `selectedKeys` / `defaultSelectedKeys` / `onSelectionChange`, `disabledKeys`,
 * `onAction`, `items` for the dynamic-collection and virtualization case, `render`
 * to replace the DOM element, and `aria-label` / `aria-labelledby`.
 */
export function ListBox({
  variant = 'default',
  className = '',
  children,
  selectionMode = 'single',
  ...rest
}) {
  return (
    <RacListBox
      {...rest}
      selectionMode={selectionMode}
      className={['list-box', `list-box--${variant}`, className].filter(Boolean).join(' ')}
    >
      {children}
    </RacListBox>
  )
}

// The compound syntax (`ListBox.Item`, `ListBox.Section`,
// `ListBox.ItemIndicator`). Attached rather than exported alone, so a caller
// copying a documented snippet works without a rename.
ListBox.Item = ListBoxItem
ListBox.Section = ListBoxSection
ListBox.ItemIndicator = ListBoxItemIndicator
