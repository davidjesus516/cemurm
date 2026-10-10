# Verification

Greps and `archify validate` pass on diagrams that are visibly wrong. Run a real browser.
Playwright is not a project dependency; use the Chromium already cached by Playwright.

```bash
ls -d /home/antony/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | head -1
mkdir -p /tmp/pw && cd /tmp/pw && npm i --silent playwright-core@1.64.0
```

`CHROME` is that path. If it is missing, report the visual check as skipped — never claim a
visual review that did not happen.

## What each probe catches

| Probe | Catches |
|---|---|
| read the diagram texts before/after `#btn-lang` | untranslated diagram content, wrong line counts |
| `getComputedStyle` on `.subtitle` vs `svg text` | font stack drift, stray `stroke`, weights |
| `svgRect.width / viewBox.width` | the residual scaling blur |
| walk the passport tree printing `display` per child | inline children sticking together |
| list lines matching `/^viewer\./` in the panel | raw untranslated keys |
| `pageerror` + `console.error` | silent JS failures |

## Minimal harness

```js
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const CHROME = '/home/antony/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + process.argv[2], { waitUntil: 'load' });
await page.waitForTimeout(1000);

console.log('ES:', await page.evaluate(() => ({
  lang: document.documentElement.lang,
  sub: document.querySelector('.subtitle').textContent.trim(),
  nodes: document.querySelectorAll('[data-node-id]').length,
  edges: document.querySelectorAll('[data-edge-from]').length,
  uc: Array.from(document.querySelectorAll('svg [data-i18n^="uc."]')).map(e => e.textContent.trim()),
})));

await page.click('#btn-lang');
await page.waitForTimeout(500);
console.log('EN:', await page.evaluate(() => document.querySelector('.subtitle').textContent.trim()));

await page.click('svg [data-node-id]');
await page.waitForTimeout(500);
const raw = await page.evaluate(() =>
  (document.querySelector('.relationship-lens')?.innerText || '')
    .split('\n').filter(l => /^viewer\./.test(l.trim())));
console.log('claves crudas:', raw.length ? raw : 'ninguna');

await page.screenshot({ path: '/tmp/out.png' });
console.log('errores:', errors.length ? errors : 'ninguno');
await browser.close();
```

## Screenshot at diagram scale

Look at the whole page **and** at the diagram alone. The full page hides thin strokes.

```js
await (await page.$('.diagram-container > svg')).screenshot({ path: '/tmp/diagram.png' });
```

## Checks the DOM alone will not catch

- Text looking fat, outlined or doubled: read the SVG attributes, not computed styles.
- A transform overlapping the diagram: read `transform` on `svg`.
- Words spaced apart after a language switch: look for `textLength`.

## Cross-diagram consistency

Run this after every new diagram. Inconsistency between diagrams is invisible to any
single-diagram probe — it only shows when they sit side by side.

```bash
cd docs/uml
for f in uc-*.puml; do
  echo "== $f"
  grep -c '<<actor>>' "$f" | sed 's/^/   stereotypes <<actor>>: /'
  grep -E '^skinparam|^left to right' "$f" | sort | md5sum | sed 's/^/   skinparam hash: /'
done
```

All of these must hold across every diagram:

| Check | Rule |
|---|---|
| Actor stereotypes | one `<<actor>>` per actor, no exceptions |
| Skinparam block | identical hash across every `.puml` |
| `left to right direction` | present in every file |
| `nodesep` / `ranksep` | `60` / `100` everywhere |
| First association | actor → base use case only |
| Derived use cases | all to the right of the base |

Then diff the shapes side by side:

```bash
for f in uc-*.html; do node verify.mjs "$PWD/$f"; done   # save each screenshot
```

Two diagrams differing in silhouette means the modelling differs, not just the labels.
Fix the `.puml`, never the layout by hand.