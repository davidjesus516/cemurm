import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// API-surface guard for the ported reference components.
//
// WHY: a port can render perfectly and still be wrong in the way that matters
// here — a documented prop that no longer exists. The maintainer's brief was
// "adapt them keeping the original as close as possible", and the API surface
// IS the contract: someone copying the reference's call must not silently lose
// `commitAt` or `hoverTrailAmount`. That failure is invisible to the render
// smoke test in components.test.jsx and to `pnpm build`.
//
// It is a source-text assertion on purpose. Importing the component and reading
// `Component.length` or a propTypes object cannot work: these are plain JSX
// functions with no propTypes (the repo forbids the dependency), so the only
// machine-readable record of the API is the destructuring in the signature.
//
// The lists are transcribed from the reference documentation, not generated,
// so a prop that someone deletes from the component fails here.

const ROOT = new URL('./', import.meta.url)

const API = {
  'backgrounds.jsx': {
    ShapeGrid: [
      'speed', 'squareSize', 'direction', 'borderColor', 'hoverFillColor',
      'shape', 'hoverTrailAmount', 'hoverColor', 'size',
    ],
  },
  'shredder.jsx': {
    Shredder: [
      'items', 'renderItem', 'onShred', 'onReorder', 'width', 'height',
      'feedSpeed', 'bite', 'stripWidth', 'curl', 'autoAnimate', 'loop',
      'loopAfterDelete', 'fallHeight', 'inset', 'gap', 'slitHeight',
      'autoFeed', 'dragTilt', 'lift', 'slitColor', 'color', 'disabled',
    ],
  },
  'swipeRow.jsx': {
    SwipeRow: [
      'actions', 'onAction', 'onCommit', 'actionColor', 'drawerColor',
      'rowColor', 'textColor', 'height', 'radius', 'actionWidth', 'direction',
      'snapBounce', 'resistance', 'collapseMs', 'commitAt', 'fullSwipe',
      'disabled', 'style',
    ],
  },
  'swipeToast.jsx': {
    SwipeToast: [
      'open', 'onClose', 'title', 'description', 'actionLabel', 'onAction',
      'background', 'color', 'fuseColor', 'width', 'radius', 'slideMs',
      'settleBounce', 'swipeDistance', 'duration', 'fuse', 'pauseOnHover',
      'closeButton', 'inline',
    ],
  },
  'codeSlots.jsx': {
    CodeSlots: [
      'length', 'status', 'onChange', 'onComplete', 'accentColor', 'inkColor',
      'slotColor', 'digitColor', 'dangerColor', 'slotSize', 'gap', 'radius',
      'bounce', 'settle', 'rise', 'cascade', 'mask', 'caret', 'outcome',
      'disabled',
    ],
  },
  'glideSelect.jsx': {
    GlideSelect: [
      'options', 'defaultValue', 'onChange', 'ariaLabel', 'showTags',
      'accentColor', 'surfaceColor', 'highlightColor', 'textColor', 'size',
      'radius', 'menuWidth', 'placement', 'align', 'popDuration',
      'glideDuration', 'rememberPosition', 'disabled',
    ],
  },
  'peekRating.jsx': {
    PeekRating: [
      'defaultValue', 'count', 'shape', 'labels', 'activeColor', 'idleColor',
      'tipColor', 'tipTextColor', 'size', 'lift', 'magnify', 'riseDuration',
      'popScale', 'showTip', 'allowClear', 'onChange', 'showLabels',
      'readOnly',
    ],
  },
  'jellyRadio.jsx': {
    JellyRadio: [
      'items', 'defaultValue', 'onChange', 'chipColor', 'activeColor',
      'textColor', 'activeTextColor', 'size', 'gap', 'radius', 'swell',
      'barge', 'shrink', 'jelly', 'bounce', 'stagger', 'stiffness', 'disabled',
    ],
  },
  'dock.jsx': {
    Dock: ['items', 'panelHeight', 'baseItemSize', 'magnification'],
  },
  'borderGlow.jsx': {
    BorderGlow: [
      'children', 'className', 'edgeSensitivity', 'glowColor',
      'backgroundColor', 'borderRadius', 'glowRadius', 'glowIntensity',
      'coneSpread', 'animated', 'colors', 'fillOpacity',
    ],
  },
  'glassIcons.jsx': {
    // items[].icon / color / label / customClass, plus className. `colorful`
    // appears in the reference's usage snippet but not in its own interface,
    // and it has no behaviour there — see glassIcons.jsx.
    GlassIcons: ['items', 'className', 'icon', 'color', 'label', 'customClass'],
  },
  'spotlightCard.jsx': {
    // The shadcn registry variant the maintainer installed
    // (@react-bits/SpotlightCard-TS-TW): the whole API is children +
    // className + spotlightColor — upstream has no title/meta props, which
    // is exactly what the first version here invented.
    SpotlightCard: ['children', 'className', 'spotlightColor'],
  },
  'holdButton.jsx': {
    // The original interface carries 22 named props. The four colour props
    // keep their names and positions but take a TOKEN NAME rather than a hex
    // literal (rule 01a), and fillTextColor defaults to cem.base instead of
    // white — an authorised deviation, since white on cem.amber is 2.1:1 and
    // cem.base on the same amber is 8.3:1. The PROP survives either way;
    // only the default changed.
    HoldButton: [
      'children', 'doneLabel', 'icon', 'doneIcon', 'backgroundColor',
      'fillColor', 'textColor', 'fillTextColor', 'size', 'radius',
      'fillDirection', 'holdTime', 'releaseTime', 'pressScale', 'wave',
      'waveAmplitude', 'glow', 'resetAfter', 'disabled', 'onHold', 'onTap',
      'className',
    ],
  },
  'cardNav.jsx': {
    CardNav: [
      'logo', 'logoAlt', 'items', 'className', 'ease', 'baseColor',
      'menuColor', 'buttonBgColor', 'buttonTextColor',
    ],
  },
  'listBox.jsx': {
    // NOT a port — the first RAC-backed component in the set. The props are
    // transcribed from the upstream ListBox API reference, which documents
    // these names verbatim. That package is not
    // installed, so the contract is enforced here instead of by the package.
    ListBox: [
      'variant', 'className', 'children', 'selectionMode', 'selectedKeys',
      'defaultSelectedKeys', 'onSelectionChange', 'disabledKeys', 'onAction',
      'render',
    ],
    ListBoxItem: ['variant', 'className', 'children', 'id', 'textValue', 'isDisabled'],
    ListBoxSection: ['className', 'children'],
    ListBoxItemIndicator: ['className', 'children', 'isSelected'],
  },
}

// The describe name says "ported components" and listBox.jsx is not one — it is
// RAC-backed. It is listed here anyway, deliberately: the reason this file exists
// is a DOCUMENTED PROP THAT NO LONGER EXISTS, and that risk is larger for a
// contract transcribed from docs than for one copied from a reference source.
// A snippet copied from the upstream docs has to keep working against the same
// names here, so the transcription is guarded the same way.
describe('ported and contract-transcribed components keep their documented API', () => {
  for (const [file, components] of Object.entries(API)) {
    const source = readFileSync(fileURLToPath(new URL(file, ROOT)), 'utf8')

    for (const [name, props] of Object.entries(components)) {
      it(`${name} accepts every documented prop`, () => {
        // A prop counts as present when it is destructured in the signature,
        // which is how every one of these components receives it.
        const missing = props.filter(
          (prop) => !new RegExp(`(^|[^A-Za-z0-9_])${prop}([^A-Za-z0-9_]|$)`, 'm').test(source),
        )
        expect(missing).toEqual([])
      })
    }
  }
})
