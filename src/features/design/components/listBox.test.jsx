import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { ListBox } from './listBox.jsx'

// Rendered-tree contract for the ListBox port over react-aria-components.
//
// WHY THE RENDERED TREE AND NOT A SNAPSHOT: RAC's collection is built from the
// React tree, not the DOM, and the failure mode that matters here is SILENT. A
// wrapper element between `ListBox` and its items — any plain `<div>` — is not
// a collection node, so RAC renders zero rows with no error and no warning. A
// snapshot would record whatever the current output happens to be; asserting
// that a specific row name reaches the markup is what actually catches it.
//
// No jsdom and no testing-library, following skeleton.test.jsx and every other
// design test in this repo: `renderToStaticMarkup` is enough for the render
// path, and the interactive half of this component (keyboard, typeahead,
// focus management) is RAC's, tested upstream.

const CSS_URL = new URL('../../../app/index.css', import.meta.url)

function render(element) {
  return renderToStaticMarkup(element)
}

describe('ListBox renders its collection', () => {
  it('static children reach the markup', () => {
    const html = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe', selectionMode: 'single' },
        createElement(ListBox.Item, { id: 'a', textValue: 'Alpha' }, 'Alpha'),
        createElement(ListBox.Item, { id: 'b', textValue: 'Beta' }, 'Beta'),
      ),
    )
    // The silent-zero-row failure: both names must be present, and the row count
    // is what proves the collection was built at all.
    expect(html).toContain('Alpha')
    expect(html).toContain('Beta')
    expect(html.match(/role="option"/g)).toHaveLength(2)
  })

  it('sections group rows and carry the BEM class', () => {
    const html = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe', selectionMode: 'none' },
        createElement(
          ListBox.Section,
          { title: 'Editing' },
          createElement(ListBox.Item, { id: 'a', textValue: 'A' }, 'A'),
        ),
        createElement(
          ListBox.Section,
          { title: 'Danger zone' },
          createElement(ListBox.Item, { id: 'b', textValue: 'B', variant: 'danger' }, 'B'),
        ),
      ),
    )
    expect(html.match(/list-box-section/g)).toHaveLength(2)
    expect(html).toContain('Editing')
    expect(html).toContain('Danger zone')
    // The section label is RAC's Header, not a bare <header>: the section's
    // aria-labelledby points at the id the Header registers, so a plain header
    // element would leave the group labelled by an id that exists nowhere.
    expect(html).toMatch(/aria-labelledby="[^"]+"[^>]*>\s*<header[^>]*>Danger zone<\/header>/)
    expect(html).toContain('list-box-item--danger')
  })

  it('the dynamic collection case renders through `items`', () => {
    const items = [{ id: 'x', label: 'Ex' }, { id: 'y', label: 'Why' }]
    const html = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe', items, selectionMode: 'single' },
        (item) => createElement(ListBox.Item, { id: item.id, textValue: item.label }, item.label),
      ),
    )
    expect(html).toContain('Ex')
    expect(html).toContain('Why')
  })
})

describe('ListBox BEM contract', () => {
  it('every documented class lands on the element it belongs to', () => {
    const html = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe', selectionMode: 'multiple', className: 'w-64' },
        createElement(
          ListBox.Item,
          { id: 'a', textValue: 'Alpha', className: 'extra' },
          'Alpha',
          createElement(ListBox.ItemIndicator),
        ),
      ),
    )

    expect(html).toMatch(/class="list-box list-box--default w-64"/)
    expect(html).toMatch(/class="list-box-item list-box-item--default extra"/)
    expect(html).toMatch(/class="list-box-item__indicator\s*"/)
  })

  it('the danger variant is a class, not an inline style', () => {
    const html = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe', variant: 'danger' },
        createElement(ListBox.Item, { id: 'a', textValue: 'A', variant: 'danger' }, 'A'),
      ),
    )
    expect(html).toContain('list-box--danger')
    expect(html).toContain('list-box-item--danger')
    // Rule 01a forbids colour literals in src/; an inline style carrying one
    // would be the same defect wearing a different hat.
    expect(html).not.toMatch(/style="[^"]*(color|background)/)
  })

  it('the indicator defaults to a currentColor glyph and can be overridden', () => {
    const withDefault = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe' },
        createElement(ListBox.Item, { id: 'a', textValue: 'A' }, 'A', createElement(ListBox.ItemIndicator)),
      ),
    )
    expect(withDefault).toMatch(/stroke="currentColor"/)
    expect(withDefault).toContain('size-4')

    const custom = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe' },
        createElement(
          ListBox.Item,
          { id: 'a', textValue: 'A' },
          'A',
          createElement(ListBox.ItemIndicator, null, ({ isSelected }) => (isSelected ? 'ON' : 'off')),
        ),
      ),
    )
    expect(custom).toContain('>off<')
  })
})

describe('ListBox state reaches the DOM as data attributes', () => {
  it('selectionMode lands on the row, and defaults to single', () => {
    const single = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe' },
        createElement(ListBox.Item, { id: 'a', textValue: 'A' }, 'A'),
      ),
    )
    // The documented contract says "single" is the default; RAC's own default is "none", so
    // this proves the component sets it rather than inheriting it.
    expect(single).toContain('data-selection-mode="single"')

    const multiple = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe', selectionMode: 'multiple' },
        createElement(ListBox.Item, { id: 'a', textValue: 'A' }, 'A'),
      ),
    )
    expect(multiple).toContain('data-selection-mode="multiple"')
  })

  it('selectedKeys marks the row and the indicator', () => {
    const html = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe', selectionMode: 'single', selectedKeys: ['a'] },
        createElement(
          ListBox.Item,
          { id: 'a', textValue: 'A' },
          'A',
          createElement(ListBox.ItemIndicator),
        ),
        createElement(
          ListBox.Item,
          { id: 'b', textValue: 'B' },
          'B',
          createElement(ListBox.ItemIndicator),
        ),
      ),
    )
    expect(html.match(/data-selected="true"/g)).toHaveLength(1)
    expect(html).toContain('data-visible="true"')
    expect(html).toContain('data-visible="false"')
  })

  it('disabledKeys and isDisabled both produce data-disabled', () => {
    const html = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe', selectionMode: 'single', disabledKeys: ['b'] },
        createElement(ListBox.Item, { id: 'a', textValue: 'A' }, 'A'),
        createElement(ListBox.Item, { id: 'b', textValue: 'B' }, 'B'),
        createElement(ListBox.Item, { id: 'c', textValue: 'C', isDisabled: true }, 'C'),
      ),
    )
    expect(html.match(/data-disabled="true"/g)).toHaveLength(2)
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(2)
  })

  it('the item render function receives the four documented values', () => {
    const html = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe', selectionMode: 'single', selectedKeys: ['a'] },
        createElement(
          ListBox.Item,
          { id: 'a', textValue: 'A' },
          ({ isSelected, isFocused, isDisabled, isPressed }) =>
            `${isSelected}|${isFocused}|${isDisabled}|${isPressed}`,
        ),
      ),
    )
    expect(html).toContain('true|false|false|false')
  })

  it('onAction reaches RAC — proven by the markup it changes', () => {
    // A server render cannot fire a click, so this asserts the handler ARRIVED
    // rather than that it ran. The discriminator is real, not incidental:
    // `data-react-aria-pressable` is emitted by RAC's Pressable only when the
    // row has an action to press, so with selectionMode="none" the pair
    // (no handler -> absent, handler -> present) fails the moment the wrapper
    // stops forwarding `onAction`. An assertion that merely found the attribute
    // present would pass either way, which is why the negative half is here.
    const withoutAction = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe', selectionMode: 'none' },
        createElement(ListBox.Item, { id: 'a', textValue: 'A' }, 'A'),
      ),
    )
    expect(withoutAction).not.toContain('data-react-aria-pressable')

    const withAction = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe', selectionMode: 'none', onAction: () => {} },
        createElement(ListBox.Item, { id: 'a', textValue: 'A' }, 'A'),
      ),
    )
    expect(withAction).toContain('data-react-aria-pressable="true"')
  })

  it('controlled selection is RAC state, not local markup', () => {
    // onSelectionChange cannot fire in a server render either, but the same
    // proof applies in reverse: a controlled `selectedKeys` is what RAC reads to
    // decide `aria-selected`, so if the wrapper dropped the prop the rows would
    // render unselected. That makes this a forwarding test for the selection
    // half of the same spread that `onAction` covers.
    const html = render(
      createElement(
        ListBox,
        {
          'aria-label': 'probe',
          selectionMode: 'multiple',
          selectedKeys: ['a'],
          onSelectionChange: () => {},
        },
        createElement(ListBox.Item, { id: 'a', textValue: 'A' }, 'A'),
        createElement(ListBox.Item, { id: 'b', textValue: 'B' }, 'B'),
      ),
    )
    expect(html).toMatch(/aria-selected="true"[^>]*data-key="a"|data-key="a"[^>]*aria-selected="true"/)
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
  })

  it('the props reach the DOM without leaking through as attributes', () => {
    // The wrapper destructures its own props. Anything it failed to destructure
    // would be spread onto RAC's ListBox and, from there, onto a real DOM node.
    const html = render(
      createElement(
        ListBox,
        { 'aria-label': 'probe', variant: 'default', className: 'x' },
        createElement(ListBox.Item, { id: 'a', textValue: 'A' }, 'A'),
      ),
    )
    expect(html).not.toContain('variant=')
    expect(html).not.toContain('selectionMode=')
  })
})

describe('the ListBox stylesheet obeys the visual contract', () => {
  // index.css is read as text rather than imported: importing it would pull
  // Tailwind into a node-env test. Same approach as skeleton.test.jsx.
  const css = readFileSync(CSS_URL, 'utf8')

  const ruleFor = (selector) => {
    const start = css.indexOf(`${selector} {`)
    if (start === -1) return null
    return css.slice(start, css.indexOf('}', start))
  }

  // The forbidden patterns are READ OUT OF THE GATE, never written here. That
  // is not a dodge, it is the only spelling that works: this file is in src/,
  // and rule 01a greps src/ source TEXT with no comment exemption — so writing
  // the colour-function names out, even inside a regular expression, is the same
  // finding the test exists to prevent. Measured, not assumed: the gate was run
  // with this file spelling them out and went red on its own guard, twice: once
  // for the list and once for a prose comment that quoted the rule.
  //
  // Reading the gate also means the two can never drift. If a function is added
  // to rule 01a tomorrow, this test starts catching it with no edit here.
  // Four levels up, not three: the CSS one level above (`../../../app/index.css`)
  // is correct, and copy-pasting it for the gate would land in src/scripts,
  // which does not exist — a readFileSync of a wrong path throws ENOENT at module
  // load and the whole file reports zero tests, which reads like "no failures".
  const gate = readFileSync(new URL('../../../../scripts/check-visual-contract.sh', import.meta.url), 'utf8')
  const fnPattern = gate.match(/^FN_PATTERN='(.*)'$/m)?.[1]
  const hexPattern = gate.match(/^HEX_PATTERN='(.*)'$/m)?.[1]
  if (!fnPattern || !hexPattern) {
    throw new Error('could not read FN_PATTERN/HEX_PATTERN out of check-visual-contract.sh')
  }

  it('declares every class the documented contract names', () => {
    for (const selector of [
      '.list-box',
      '.list-box-item',
      '.list-box-item--danger',
      '.list-box-item__indicator',
      '.list-box-section',
    ]) {
      expect(ruleFor(selector), `${selector} is declared in index.css`).not.toBeNull()
    }
  })

  it('covers every state selector RAC emits', () => {
    for (const selector of [
      "&[data-selected='true']",
      "&[data-focus-visible='true']",
      "&[data-disabled='true']",
      "&[data-hovered='true']",
      "&[data-visible='false']",
    ]) {
      expect(css, `${selector} has a rule`).toContain(selector)
    }
  })

  // The ListBox block, sliced out on its own boundaries. Anchoring on
  // `.skeleton {` as the END would be wrong here: the skeleton block sits ABOVE
  // the ListBox one in index.css, so that slice comes back empty and every
  // assertion below would pass vacuously. A vacuous pass is worse than no test,
  // so the end anchor is the reduced-motion block, which follows it.
  const listBoxCss = css.slice(
    css.indexOf('.list-box {'),
    css.indexOf('@media (prefers-reduced-motion'),
  )

  it('the slice it asserts on is not empty', () => {
    // The guard on the guard. If the two anchors ever swap order, this fails
    // loudly instead of letting the two rules below pass on an empty string.
    expect(listBoxCss.length).toBeGreaterThan(500)
    expect(listBoxCss).toContain('.list-box-item__indicator')
  })

  it('writes no colour literal — only @apply of a token utility', () => {
    // Rule 01a is `enforcing` over src/, so a hex or a colour function in this
    // block fails CI. Asserting it here too makes the failure name the block
    // instead of arriving as a bare grep line.
    //
    // The patterns come from the gate itself (see above), so this cannot drift
    // from the rule it guards — and the gate's own anchoring is kept, which is
    // what stops `optimisticCollab(`-style identifiers from reading as findings.
    expect(listBoxCss).not.toMatch(new RegExp(hexPattern))
    expect(listBoxCss).not.toMatch(new RegExp(fnPattern))
  })

  it('never pairs cem.secondary with a raised fill', () => {
    // Rule 06 is `enforcing`. cem.secondary on cem.elevated or cem.hover
    // measures under the 4.5:1 AA floor, and the gate reads one line as one
    // className string — so the equivalent local check is per declaration block.
    //
    // KNOWN LIMIT, recorded because it is a limit: this scans innermost blocks,
    // so a foreground in one nested rule and a raised fill in a SIBLING nested
    // rule of the same parent would not be seen. The enforcing gate is the real
    // guard; this is the one that says which block is wrong.
    for (const match of listBoxCss.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const [, selector, body] = match
      if (!/text-cem-secondary(?![-\w])/.test(body)) continue
      expect(body, `no raised fill beside cem.secondary in "${selector.trim()}"`).not.toMatch(
        /bg-cem-(elevated|hover)\b/,
      )
    }
  })
})
