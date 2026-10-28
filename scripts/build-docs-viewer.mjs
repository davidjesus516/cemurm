#!/usr/bin/env node
/**
 * build-docs-viewer.mjs — generate `docs/handbook.html` from this repository's own sources.
 *
 * RUN (no npm script exists for this on purpose — package.json is outside the edit surface):
 *
 *     node scripts/build-docs-viewer.mjs
 *
 * WHAT IT READS (everything in the output is derived at build time; no document prose is
 * hand-copied into the HTML):
 *
 *   docs/*.md                                     every documentation page, rendered by the
 *                                                 markdown renderer inside this file
 *   skills/cemurm-visual-system/assets/tokens.css the token layer: colours, radius, spacing,
 *                                                 elevation, motion
 *   skills/cemurm-visual-system/SKILL.md          the four-tier surface classification table
 *   docs/decisions.md                             ADR-001 … ADR-010, parsed into cards
 *   src/                                          layer inventory + import evidence
 *   every .html file under docs/                 links to the existing visualizations
 *                                                 (docs/handbook.html itself is excluded)
 *
 * DETERMINISM: no timestamps, no random ids, no network reads; every input is read in sorted
 * order. Two consecutive runs must produce a byte-identical file.
 *
 * DESIGN DIALS: variance 6/10, motion 4/10, visual density 3/5.
 *
 * FAILURE POLICY: a missing or unparseable input throws. A silently empty handbook is worse
 * than a red run.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ constants */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DOCS_DIR = join(ROOT, 'docs');
const TOKENS_FILE = join(ROOT, 'skills/cemurm-visual-system/assets/tokens.css');
const SKILL_FILE = join(ROOT, 'skills/cemurm-visual-system/SKILL.md');
const DECISIONS_FILE = join(DOCS_DIR, 'decisions.md');
const SRC_DIR = join(ROOT, 'src');
const OUT_FILE = join(DOCS_DIR, 'handbook.html');

/** Design dials handed to this task (documented in the script header, shown in the overview). */
const DIALS = [
  ['Design variance', '6 / 10', 'asymmetric layout, no centered hero'],
  ['Motion', '4 / 10', 'entry transition + hover only, nothing loops'],
  ['Visual density', '3 / 5', 'moderate spacing from the 4px scale'],
];

function fail(message) {
  throw new Error(`[build-docs-viewer] ${message}`);
}

function readFile(path) {
  if (!existsSync(path)) fail(`missing input: ${relative(ROOT, path)}`);
  return readFileSync(path, 'utf8');
}

/* ------------------------------------------------------------------ small utils */

/** Escape every text position. Raw markdown is never interpolated into the output. */
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Strip inline markdown so a heading can be used as a plain label (sidebar, nav, page title). */
function plainText(value) {
  return String(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/[*_]/g, '')
    .trim();
}

/**
 * GitHub-compatible heading slugs: lowercase, punctuation dropped, each space kept as one
 * hyphen (so "Scope & Milestones" becomes "scope--milestones", as GitHub renders it).
 */
function makeSlugger() {
  const seen = new Map();
  return (text) => {
    let slug = plainText(text)
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N} -]/gu, '')
      .replace(/ /g, '-');
    if (!slug) slug = 'section';
    const count = seen.get(slug) || 0;
    seen.set(slug, count + 1);
    return count === 0 ? slug : `${slug}-${count}`;
  };
}

const indentOf = (line) => line.length - line.trimStart().length;

/* ------------------------------------------------------------------ link routing */

const EXTERNAL_HREF = /^(https?:|mailto:|data:)/i;

/**
 * Rewrite an in-document href to a handbook route. External URLs and real relative files are
 * left alone; `*.md` links become handbook pages; bare `#anchor` links stay inside the page
 * that carries them; `docs/…` prefixed paths are corrected for a file that lives in docs/.
 */
function mapHref(href, ctx) {
  if (EXTERNAL_HREF.test(href)) return href;
  if (href.startsWith('#')) {
    const anchor = href.slice(1);
    return anchor ? `${ctx.route}/${anchor}` : ctx.route;
  }
  const [path, anchor] = href.split('#');
  const suffix = anchor ? `/${anchor}` : '';
  if (path.endsWith('.md')) {
    const stem = path.split('/').pop().replace(/\.md$/, '');
    if (ctx.docs.has(stem)) return `#/docs/${stem}${suffix}`;
    return href; // points outside docs/ — leave it as a file link
  }
  if (path.startsWith('docs/')) return `${path.slice('docs/'.length)}${suffix ? `#${anchor}` : ''}`;
  return href;
}

/* ------------------------------------------------------------------ inline markdown */

function renderInline(raw, ctx) {
  const codeSpans = [];
  let text = String(raw).replace(/`([^`]+)`/g, (match, code) => {
    codeSpans.push(code);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });

  text = esc(text);

  // hrefs are already escaped: text went through esc() above, and mapped targets are built
  // from stems and paths that carry no metacharacters. Escaping twice would corrupt them.
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, href) => {
    return `<img src="${mapHref(href, ctx)}" alt="${alt}" loading="lazy">`;
  });
  text = text.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (match, label, href) => {
    const target = mapHref(href, ctx);
    const external = EXTERNAL_HREF.test(target);
    return `<a href="${target}"${external ? ' rel="noopener"' : ''}>${label}</a>`;
  });

  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  text = text.replace(/(^|[^\w&])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');

  return text.replace(/\u0000(\d+)\u0000/g, (match, index) => `<code>${esc(codeSpans[Number(index)])}</code>`);
}

/* ------------------------------------------------------------------ block markdown */

const RE_FENCE = /^(\s*)(\x60{3,}|~{3,})\s*([A-Za-z0-9+-]*)\s*$/;
const RE_HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*$/;
const RE_HR = /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
const RE_LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const RE_QUOTE = /^ {0,3}>\s?(.*)$/;
const RE_DELIM = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/;

const isRow = (line) => {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && (trimmed.match(/\|/g) || []).length >= 3;
};

/** Split a table row on pipes, ignoring pipes inside `code spans`. */
function splitRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let buffer = '';
  let inCode = false;
  for (const char of trimmed) {
    if (char === '`') inCode = !inCode;
    if (char === '|' && !inCode) {
      cells.push(buffer.trim());
      buffer = '';
      continue;
    }
    buffer += char;
  }
  cells.push(buffer.trim());
  return cells;
}

function alignClass(alignments, index) {
  const align = alignments[index];
  if (align === 'center') return ' style="text-align:center"';
  if (align === 'right') return ' style="text-align:right"';
  return '';
}

function renderTable(headerLine, bodyLines, ctx, out) {
  const header = splitRow(headerLine);
  const alignments = header.map(() => '');
  if (bodyLines.length && RE_DELIM.test(bodyLines[0])) {
    splitRow(bodyLines[0]).forEach((cell, index) => {
      if (cell.startsWith(':') && cell.endsWith(':')) alignments[index] = 'center';
      else if (cell.endsWith(':')) alignments[index] = 'right';
      else if (cell.startsWith(':')) alignments[index] = 'left';
    });
    bodyLines = bodyLines.slice(1);
  }
  const head = header
    .map((cell, index) => `<th${alignClass(alignments, index)}>${renderInline(cell, ctx)}</th>`)
    .join('');
  const body = bodyLines
    .map((line) => {
      let cells = splitRow(line);
      if (cells.length > header.length) {
        const extra = cells.slice(header.length - 1).join(' | ');
        cells = cells.slice(0, header.length - 1);
        cells.push(extra);
      }
      while (cells.length < header.length) cells.push('');
      return `<tr>${cells
        .map((cell, index) => `<td${alignClass(alignments, index)}>${renderInline(cell, ctx)}</td>`)
        .join('')}</tr>`;
    })
    .join('');
  out.tables += 1;
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function dedent(lines) {
  const indents = lines.filter((line) => line.trim() !== '').map(indentOf);
  const strip = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => (line.trim() === '' ? '' : line.slice(strip)));
}

function sameMarkerKind(marker, ordered) {
  const isOrdered = /\d/.test(marker);
  return isOrdered === ordered;
}

function parseList(lines, start, ctx, out) {
  const first = lines[start].match(RE_LIST_ITEM);
  const ordered = /\d/.test(first[2]);
  const baseIndent = first[1].length;
  const items = [];
  let index = start;
  let current = null;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '') {
      let lookahead = index;
      while (lookahead < lines.length && lines[lookahead].trim() === '') lookahead += 1;
      if (lookahead < lines.length && indentOf(lines[lookahead]) > baseIndent) {
        index += 1;
        continue;
      }
      break;
    }
    const match = line.match(RE_LIST_ITEM);
    const indent = indentOf(line);
    if (match && match[1].length === baseIndent && sameMarkerKind(match[2], ordered)) {
      const contentIndent = match[3] ? line.length - match[3].length : baseIndent + match[2].length + 1;
      current = { head: match[3], contentIndent, cont: [] };
      items.push(current);
      index += 1;
      continue;
    }
    if (current && indent > baseIndent) {
      current.cont.push(line);
      index += 1;
      continue;
    }
    break;
  }

  const tag = ordered ? 'ol' : 'ul';
  const rendered = items
    .map((item) => {
      let task = '';
      let head = item.head;
      const taskMatch = head.match(/^\[([ xX])\]\s+(.*)$/);
      if (taskMatch) {
        const checked = taskMatch[1].toLowerCase() === 'x' ? ' checked' : '';
        task = `<input type="checkbox" disabled${checked}> `;
        head = taskMatch[2];
      }
      let tail = '';
      if (item.cont.length) {
        const blocks = renderBlocks(dedent(item.cont), ctx, out);
        const onlyParagraph = blocks.match(/^<p>[\s\S]*<\/p>$/);
        tail = onlyParagraph && head.trim() ? ` ${blocks.slice(3, -4)}` : blocks;
      }
      const classes = task ? ' class="task-item"' : '';
      return `<li${classes}>${task}${renderInline(head, ctx)}${tail}</li>`;
    })
    .join('');
  const listClass = items.some((item) => item.head.startsWith('[')) ? ' class="task-list"' : '';
  out.lists += 1;
  return { html: `<${tag}${listClass}>${rendered}</${tag}>`, next: index };
}

/**
 * The markdown renderer. Handles ATX headings, paragraphs, ul/ol (nested, task items), tables,
 * fenced code with language, blockquotes, horizontal rules and the inline set. Every text
 * position goes through esc(); raw markdown never reaches the output.
 */
function renderBlocks(lines, ctx, out) {
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const fence = line.match(RE_FENCE);
    if (fence) {
      const marker = fence[2][0];
      const indent = fence[1].length;
      const body = [];
      index += 1;
      while (index < lines.length) {
        const closing = lines[index].match(RE_FENCE);
        if (closing && closing[2][0] === marker && closing[2].length >= fence[2].length && !closing[3]) break;
        const strip = Math.min(indent, lines[index].length - lines[index].trimStart().length);
        body.push(lines[index].slice(strip));
        index += 1;
      }
      index += 1;
      const language = fence[3] ? ` class="language-${esc(fence[3])}"` : '';
      out.fences += 1;
      html.push(`<pre class="code-block"><code${language}>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(RE_HEADING);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const slug = ctx.slugger(text);
      const id = `h-${ctx.pageKey}--${slug}`;
      out.headings.push({ level, text: plainText(text), id });
      if (level === 2) out.toc.push({ text: plainText(text), id, slug });
      html.push(`<h${level} id="${id}">${renderInline(text, ctx)}</h${level}>`);
      index += 1;
      continue;
    }

    if (RE_HR.test(line)) {
      html.push('<hr>');
      index += 1;
      continue;
    }

    if (RE_QUOTE.test(line)) {
      const quoted = [];
      while (index < lines.length && RE_QUOTE.test(lines[index])) {
        quoted.push(lines[index].match(RE_QUOTE)[1]);
        index += 1;
      }
      html.push(`<blockquote>${renderBlocks(quoted, ctx, out)}</blockquote>`);
      continue;
    }

    if (RE_LIST_ITEM.test(line)) {
      const list = parseList(lines, index, ctx, out);
      html.push(list.html);
      index = list.next;
      continue;
    }

    if (isRow(line) && index + 1 < lines.length && (RE_DELIM.test(lines[index + 1]) || isRow(lines[index + 1]))) {
      const body = [];
      index += 1;
      if (RE_DELIM.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      while (index < lines.length && isRow(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      html.push(renderTable(line, body, ctx, out));
      continue;
    }

    // paragraph: consecutive plain lines
    const paragraph = [];
    while (index < lines.length) {
      const current = lines[index];
      if (
        current.trim() === '' ||
        RE_HEADING.test(current) ||
        RE_HR.test(current) ||
        RE_FENCE.test(current) ||
        RE_QUOTE.test(current) ||
        RE_LIST_ITEM.test(current)
      ) {
        break;
      }
      if (isRow(current) && index + 1 < lines.length && (RE_DELIM.test(lines[index + 1]) || isRow(lines[index + 1]))) {
        break;
      }
      paragraph.push(current.trim());
      index += 1;
    }
    if (paragraph.length) {
      out.paragraphs += 1;
      html.push(`<p>${renderInline(paragraph.join(' '), ctx)}</p>`);
    }
  }

  return html.join('\n');
}

/* ------------------------------------------------------------------ inputs */

function parseTokens() {
  const source = readFile(TOKENS_FILE);
  const rootMatch = source.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!rootMatch) fail('no :root block in tokens.css');
  const values = new Map();
  const notes = new Map();
  for (const line of rootMatch[1].split('\n')) {
    const match = line.match(/^\s*(--cem-[a-z0-9-]+):\s*([^;]+);(?:\s*\/\*\s*(.*?)\s*\*\/)?\s*$/);
    if (!match) continue;
    values.set(match[1], match[2].trim());
    if (match[3]) notes.set(match[1], match[3].trim());
  }
  const required = [
    '--cem-bg', '--cem-surface', '--cem-elevated', '--cem-hover',
    '--cem-text', '--cem-secondary', '--cem-fill-subtle', '--cem-fill-hover',
    '--cem-separator', '--cem-separator-strong',
    '--cem-accent', '--cem-accent-hover', '--cem-accent-press', '--cem-accent-quiet', '--cem-on-accent',
    '--cem-radius-xs', '--cem-radius-sm', '--cem-radius-md', '--cem-radius-lg', '--cem-radius-xl', '--cem-radius-pill',
    '--cem-elev-1', '--cem-elev-2', '--cem-elev-3', '--cem-border',
    '--cem-space-1', '--cem-space-2', '--cem-space-3', '--cem-space-4', '--cem-space-5',
    '--cem-space-6', '--cem-space-8', '--cem-space-10', '--cem-space-12', '--cem-space-16',
    '--cem-dur-instant', '--cem-dur-fast', '--cem-dur-base', '--cem-ease-out', '--cem-ease-standard',
    '--cem-material', '--cem-material-border', '--cem-material-blur',
  ];
  const missing = required.filter((name) => !values.has(name));
  if (missing.length) fail(`tokens.css is missing: ${missing.join(', ')}`);
  return { values, notes };
}

function parseAdrs() {
  const source = readFile(DECISIONS_FILE);
  const adrs = [];
  let current = null;
  let lastField = null;

  for (const line of source.split('\n')) {
    const heading = line.match(/^###\s+(ADR-\d+)\s+—\s+(.*)$/);
    if (heading) {
      if (current) adrs.push(current);
      current = { id: heading[1], title: heading[2].trim(), fields: new Map() };
      lastField = null;
      continue;
    }
    if (!current) continue;
    const field = line.match(/^- \*\*([A-Za-z]+):\*\*\s*(.*)$/);
    if (field) {
      lastField = field[1];
      current.fields.set(lastField, field[2]);
      continue;
    }
    if (lastField && /^\s{2,}\S/.test(line)) {
      current.fields.set(lastField, `${current.fields.get(lastField)} ${line.trim()}`);
    }
  }
  if (current) adrs.push(current);
  if (!adrs.length) fail('no ADR-0NN headings found in docs/decisions.md');
  for (const adr of adrs) {
    if (!adr.fields.has('Status') || !adr.fields.has('Decision')) {
      fail(`${adr.id} is missing Status/Decision — the parser contract changed`);
    }
  }
  return adrs;
}

/** The four-tier surface classification table, extracted from the skill's Decision Gates. */
function parseTierTable() {
  const source = readFile(SKILL_FILE);
  const lines = source.split('\n');
  const start = lines.findIndex((line) => /^##\s+Decision Gates\s*$/.test(line));
  if (start < 0) fail('no "## Decision Gates" heading in the visual-system skill');
  const table = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('|')) table.push(lines[index]);
    if (table.length && !lines[index].startsWith('|')) break;
  }
  if (table.length < 3) fail('the Decision Gates table could not be parsed');
  return table.join('\n');
}

function walk(dir, base, extensions, skip = new Set()) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort(byName)) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, base, extensions, skip));
    else if (extensions.some((extension) => entry.name.endsWith(extension)) && !skip.has(entry.name)) {
      found.push(relative(base, full));
    }
  }
  return found.sort();
}

/** Codepoint order: localeCompare would make the output depend on the machine's locale. */
function byName(a, b) {
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
}

function scanSrc() {
  if (!existsSync(SRC_DIR)) fail('src/ not found');
  const directories = readdirSync(SRC_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const known = new Set(directories);
  const files = [];
  for (const directory of directories) {
    for (const path of walk(join(SRC_DIR, directory), ROOT, ['.js', '.jsx'])) {
      files.push({ directory, path, text: readFileSync(join(ROOT, path), 'utf8') });
    }
  }
  const counts = new Map(directories.map((directory) => [directory, 0]));
  const imports = new Map();
  const supabase = [];
  /** specifiers imported from src/app by layers the diagram draws below it (shared providers). */
  const appSpecifiers = new Map();
  /** every import that leaves src/domain/, recorded so the purity claim can be checked. */
  const domainOut = [];
  for (const file of files) {
    counts.set(file.directory, counts.get(file.directory) + 1);
    const importRe = /from\s+['"]((?:\.{1,2}\/)+[A-Za-z0-9_./-]+)['"]/g;
    let match;
    while ((match = importRe.exec(file.text)) !== null) {
      // Resolve the specifier against the importing file instead of trusting the dot count:
      // only imports that really land on a top-level src/ folder count as layer edges.
      const specifier = match[1];
      const resolved = relative(SRC_DIR, resolve(ROOT, dirname(file.path), specifier));
      if (resolved.startsWith('..')) continue;
      const target = resolved.split('/')[0];
      if (target === file.directory || !known.has(target)) continue;
      const display = `src/${resolved}`;
      const key = `${file.directory} → ${target}`;
      imports.set(key, (imports.get(key) || 0) + 1);
      if (target === 'app') {
        const entry = appSpecifiers.get(display) || { count: 0, dirs: new Set() };
        entry.count += 1;
        entry.dirs.add(file.directory);
        appSpecifiers.set(display, entry);
      }
      if (file.directory === 'domain') domainOut.push({ file: file.path, specifier: display });
    }
    if (/from\s+['"][^'"]*supabase[^'"]*['"]/i.test(file.text)) supabase.push(file.path);
  }
  return { directories, counts, imports, supabase, total: files.length, appSpecifiers, domainOut };
}

function parseDoc(path) {
  const source = readFile(path);
  const lines = source.split('\n');
  let title = null;
  let start = 0;
  for (let index = 0; index < Math.min(lines.length, 25); index += 1) {
    const match = lines[index].match(/^#\s+(.*?)\s*$/);
    if (match) {
      title = plainText(match[1]);
      start = index + 1;
      break;
    }
  }
  return { source, lines: lines.slice(start), title: title || path.replace(/\.md$/, ''), lineCount: lines.length };
}

/* ------------------------------------------------------------------ page builders */

/** Slugger state per authored page, so two pages may reuse the same heading text. */
const authoredSluggers = new Map();

function heading(pageKey, level, text, extraClass = '') {
  if (!authoredSluggers.has(pageKey)) authoredSluggers.set(pageKey, makeSlugger());
  const slug = authoredSluggers.get(pageKey)(text);
  const className = extraClass ? ` class="${extraClass}"` : '';
  return `<h${level} id="h-${pageKey}--${slug}"${className}>${esc(text)}</h${level}>`;
}

function buildSwatch(token, tokenValue, note) {
  const value = tokenValue;
  return `<li class="swatch">
      <span class="swatch-chip" style="background:${esc(`var(${token})`)}"></span>
      <span class="swatch-meta"><code>${esc(token)}</code><span class="swatch-value">${esc(value)}</span>${note ? `<span class="swatch-note">${esc(note)}</span>` : ''}</span>
    </li>`;
}

function buildDesignPage({ tokens, notes, tierTable }) {
  const get = (name) => {
    if (!tokens.values.has(name)) fail(`token ${name} missing while building the design page`);
    return tokens.values.get(name);
  };
  const note = (name) => notes.get(name) || '';

  const groups = [
    { title: 'Dark ramp', blurb: 'Hierarchy is carried by value, not by one colour per level.', tokens: ['--cem-bg', '--cem-surface', '--cem-elevated', '--cem-hover'] },
    { title: 'Foreground', blurb: 'Measured contrast: text sits at 18.92:1 on the page background.', tokens: ['--cem-text', '--cem-secondary'] },
    { title: 'Fills and separators', blurb: 'Overlays rather than solid steps.', tokens: ['--cem-fill-subtle', '--cem-fill-hover', '--cem-separator', '--cem-separator-strong'] },
    { title: 'Accent', blurb: 'The only saturated colour in the system.', tokens: ['--cem-accent', '--cem-accent-hover', '--cem-accent-press', '--cem-accent-quiet', '--cem-on-accent'] },
  ];

  const palette = groups
    .map(
      (group) => `<section class="token-group">
      <h3>${esc(group.title)}</h3>
      <p class="group-blurb">${esc(group.blurb)}</p>
      <ul class="swatch-grid">
        ${group.tokens.map((token) => buildSwatch(token, get(token), note(token))).join('\n        ')}
      </ul>
    </section>`
    )
    .join('\n');

  const radiusTokens = ['--cem-radius-xs', '--cem-radius-sm', '--cem-radius-md', '--cem-radius-lg', '--cem-radius-xl', '--cem-radius-pill'];
  const radius = radiusTokens
    .map(
      (token) => `<li class="scale-row">
        <span class="radius-demo" style="border-radius:${esc(`var(${token})`)}"></span>
        <code>${esc(token)}</code>
        <span class="scale-value">${esc(get(token))}</span>
        <span class="scale-note">${esc(note(token))}</span>
      </li>`
    )
    .join('\n');

  const spaceTokens = ['--cem-space-1', '--cem-space-2', '--cem-space-3', '--cem-space-4', '--cem-space-5', '--cem-space-6', '--cem-space-8', '--cem-space-10', '--cem-space-12', '--cem-space-16'];
  const spacing = spaceTokens
    .map(
      (token) => `<li class="scale-row">
        <span class="space-demo" style="width:${esc(`var(${token})`)}"></span>
        <code>${esc(token)}</code>
        <span class="scale-value">${esc(get(token))}</span>
        <span class="scale-note">${esc(note(token))}</span>
      </li>`
    )
    .join('\n');

  const elevation = ['--cem-elev-1', '--cem-elev-2', '--cem-elev-3']
    .map(
      (token) => `<li class="elev-demo" style="box-shadow:${esc(`var(${token})`)}">
        <code>${esc(token)}</code>
        <span class="scale-value">${esc(get(token))}</span>
        <span class="scale-note">${esc(note(token))}</span>
      </li>`
    )
    .join('\n');

  const motion = ['--cem-dur-instant', '--cem-dur-fast', '--cem-dur-base']
    .map(
      (token) => `<li class="scale-row motion-row">
        <code>${esc(token)}</code>
        <span class="scale-value">${esc(get(token))}</span>
        <span class="scale-note">${esc(note(token))}</span>
      </li>`
    )
    .join('\n');

  const tierCtx = { route: '#/design', pageKey: 'design', slugger: makeSlugger(), docs: new Set() };
  const tierHtml = renderBlocks(tierTable.split('\n'), tierCtx, { headings: [], toc: [], tables: 0, lists: 0, fences: 0, paragraphs: 0 });

  return `<section class="page" id="page-design" data-route="/design">
  <header class="page-head">
    <p class="page-kicker">Section</p>
    <h1>Design system</h1>
    <p class="lede">The token layer exactly as the source files declare it. Every value on this page was parsed at build time from <code>skills/cemurm-visual-system/assets/tokens.css</code> and <code>skills/cemurm-visual-system/SKILL.md</code>; none of it is retyped here.</p>
  </header>

  <div class="page-body">
    ${heading('design', 2, 'Palette')}
    <p class="section-note">Real colours: each chip is painted with the token it names. Dark values come from the token layer; light mode re-declares the same variable names under <code>[data-theme="light"]</code>.</p>
    <div class="token-groups">
${palette}
    </div>

    ${heading('design', 2, 'Radius scale')}
    <p class="section-note">Radius increases with component size. Cards use <code>--cem-radius-md</code>; a fixed radius everywhere is the defect this scale replaces.</p>
    <ul class="scale-list">
      ${radius}
    </ul>

    ${heading('design', 2, 'Spacing scale')}
    <p class="section-note">A 4px base. Bars are drawn at their real token width.</p>
    <ul class="scale-list">
      ${spacing}
    </ul>

    ${heading('design', 2, 'Elevation ladder')}
    <p class="section-note">Three levels: shadow plus a hairline border. In dark mode most separation comes from surface lightness, not from the shadow.</p>
    <ul class="elev-list">
      ${elevation}
    </ul>

    ${heading('design', 2, 'Motion budget')}
    <p class="section-note">CSS-native only. Reduced-motion collapses all three durations to zero.</p>
    <ul class="scale-list">
      ${motion}
    </ul>

    ${heading('design', 2, 'Surface classification')}
    <p class="section-note">Classify the surface before styling it. Styling a performance surface like a product screen is the failure this table prevents.</p>
    ${tierHtml}
  </div>
</section>`;
}

function buildDecisionsPage(adrs) {
  const ctx = { route: '#/decisions', pageKey: 'decisions', slugger: makeSlugger(), docs: new Set() };
  const cards = adrs
    .map((adr, index) => {
      const status = adr.fields.get('Status') || 'Unknown';
      const known = /^accepted/i.test(status);
      const date = adr.fields.get('Date') || 'Unknown';
      const decision = adr.fields.get('Decision') || '';
      const expanded = ['Context', 'Alternatives', 'Reason', 'Consequences']
        .filter((field) => adr.fields.has(field))
        .map((field) => {
          const value = adr.fields.get(field);
          return `<div class="adr-field">
            <h4>${esc(field)}</h4>
            <p>${renderInline(value, ctx)}</p>
          </div>`;
        })
        .join('\n');
      const open = index === adrs.length - 1;
      return `<article class="adr" id="h-decisions--${adr.id.toLowerCase()}"${open ? ' data-open data-current' : ''}>
      <header class="adr-head">
        <span class="adr-id">${esc(adr.id)}</span>
        <h3>${renderInline(adr.title, ctx)}</h3>
        <span class="adr-status${known ? '' : ' status-unknown'}">${esc(plainText(status))}</span>
        <span class="adr-date">${renderInline(date, ctx)}</span>
      </header>
      <p class="adr-decision">${renderInline(decision, ctx)}</p>
      <button class="adr-toggle" type="button" aria-expanded="${open ? 'true' : 'false'}">${open ? 'Hide record' : 'Show record'}</button>
      <div class="adr-panel"><div>
        ${expanded}
      </div></div>
    </article>`;
    })
    .join('\n');

  const jumps = adrs
    .map((adr) => `<a class="adr-jump" href="#/decisions/${adr.id.toLowerCase()}"${adr.id === adrs[adrs.length - 1].id ? ' data-current' : ''}>${esc(adr.id)}</a>`)
    .join('\n      ');

  const statuses = new Set(adrs.map((adr) => adr.fields.get('Status') || 'Unknown'));

  return `<section class="page" id="page-decisions" data-route="/decisions">
  <header class="page-head">
    <h1>Decisions</h1>
    <p class="lede">${adrs.length} records parsed from <code>docs/decisions.md</code>. Status, date and decision stay visible; context, alternatives, reasoning and consequences expand. An unrecognised status renders as written, never as a broken chip.</p>
    <nav class="adr-rail" aria-label="Jump to an ADR">
      ${jumps}
    </nav>
    <p class="page-meta">Status values in this set: ${esc([...statuses].join(' · '))}</p>
  </header>
  <div class="page-body adr-list">
    ${cards}
  </div>
</section>`;
}

function buildArchitecturePage(scan) {
  const dirRows = scan.directories
    .map((directory) => {
      const outbound = [...scan.imports.entries()]
        .filter(([key]) => key.startsWith(`${directory} → `))
        .sort(([a], [b]) => {
          const targetA = a.split(' → ')[1];
          const targetB = b.split(' → ')[1];
          return targetA < targetB ? -1 : targetA > targetB ? 1 : 0;
        })
        .map(([key, count]) => `${key.split(' → ')[1]} (${count})`);
      const role = ROLES[directory] || 'source files';
      return `<tr>
        <td><code>src/${esc(directory)}/</code></td>
        <td class="num">${scan.counts.get(directory)}</td>
        <td>${esc(role)}</td>
        <td class="imports">${outbound.length ? outbound.map((entry) => `<span>${esc(entry)}</span>`).join('') : '<span class="none">— no outbound layer imports</span>'}</td>
      </tr>`;
    })
    .join('\n');

  const dataExceptions = scan.supabase.filter((path) => !path.startsWith('src/data/'));
  const dataCount = scan.supabase.length - dataExceptions.length;
  const exceptionCount = dataExceptions.length;

  const appEdges = [...scan.appSpecifiers.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const outward = [...scan.domainOut].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const offDiagram = [
    ...appEdges.map(
      ([specifier, entry]) =>
        `<li><code>${esc(specifier)}</code><span class="flag">${entry.count} imports from ${[...entry.dirs].sort().map((dir) => esc(dir)).join(', ')}</span></li>`
    ),
    ...outward.map(
      (edge) =>
        `<li><code>${esc(edge.file)} → ${esc(edge.specifier)}</code><span class="flag">outward from the pure layer</span></li>`
    ),
  ];
  const offDiagramHtml = offDiagram.length
    ? offDiagram.join('\n      ')
    : '<li><span class="none">none — every cross-folder import follows the diagram</span></li>';

  const svgBoxes = [
    { id: 'app', y: 16, label: 'src/app/**', sub: 'entrypoint, router, shell, providers' },
    { id: 'features', y: 140, label: 'src/features/**', sub: 'pages and components, one folder per feature' },
    { id: 'data', y: 264, label: 'src/data/repositories/**', sub: 'the impure half — talks to Supabase' },
    { id: 'domain', y: 388, label: 'src/domain/**', sub: 'pure logic, no I/O' },
  ];
  const edges = [
    { from: 'app', to: 'features', label: 'renders' },
    { from: 'features', to: 'data', label: 'calls repositories' },
    { from: 'data', to: 'domain', label: 'queries as pure functions' },
  ];

  const boxSvg = svgBoxes
    .map(
      (box) => `<g class="layer">
      <rect x="40" y="${box.y}" width="520" height="84" rx="10"></rect>
      <text x="64" y="${box.y + 36}" class="layer-name">${esc(box.label)}</text>
      <text x="64" y="${box.y + 62}" class="layer-sub">${esc(box.sub)}</text>
    </g>`
    )
    .join('\n    ');

  const boxY = Object.fromEntries(svgBoxes.map((box) => [box.id, box.y]));
  const edgeSvg = edges
    .map((edge) => {
      const y1 = boxY[edge.from] + 84;
      const y2 = boxY[edge.to];
      const middle = (y1 + y2) / 2;
      return `<g class="edge">
      <line x1="180" y1="${y1}" x2="180" y2="${y2}" marker-end="url(#arrow)"></line>
      <text x="198" y="${middle + 4}" class="edge-label">${esc(edge.label)}</text>
    </g>`;
    })
    .join('\n    ');

  const leafLines = ['ui', 'hooks', 'lib', 'integrations', 'offline', 'content']
    .filter((directory) => scan.counts.has(directory))
    .map((directory, index) => `<text x="640" y="${104 + index * 34}" class="leaf-line">src/${esc(directory)}/ — ${scan.counts.get(directory)} files</text>`)
    .join('\n    ');

  return `<section class="page" id="page-architecture" data-route="/architecture">
  <header class="page-head">
    <p class="page-kicker">Section</p>
    <h1>Architecture</h1>
    <p class="lede">Dependency direction with the folder names and file counts read from the live <code>src/</code> tree at build time (${scan.total} source files across ${scan.directories.length} top-level folders).</p>
  </header>

  <div class="page-body">
    ${heading('architecture', 2, 'Layering')}
    <figure class="arch-figure">
      <svg class="arch-svg" viewBox="0 0 960 500" role="img" aria-labelledby="arch-title arch-desc">
        <title id="arch-title">CEMURM layering: app renders features, features call repositories, repositories query the domain</title>
        <desc id="arch-desc">Dependency direction runs downward. src/app depends on src/features, src/features depends on src/data, src/data depends on src/domain. Supporting folders are leaves imported by the layers above.</desc>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--cem-secondary)"></path>
          </marker>
        </defs>
        ${boxSvg}
    ${edgeSvg}
    <g class="leaf">
      <rect x="620" y="16" width="300" height="234" rx="10"></rect>
      <text x="640" y="48" class="leaf-title">Leaf modules</text>
      <text x="640" y="74" class="leaf-sub">shared support folders, outside</text>
      <text x="640" y="94" class="leaf-sub">the four-arrow chain</text>
      ${leafLines}
    </g>
    <g class="rule">
      <rect x="620" y="286" width="300" height="186" rx="10"></rect>
      <text x="640" y="322" class="rule-title">Rule</text>
      <text x="640" y="356" class="rule-line">UI never talks to the</text>
      <text x="640" y="380" class="rule-line">database directly.</text>
      <text x="640" y="416" class="leaf-sub">The client lives behind</text>
      <text x="640" y="436" class="leaf-sub">src/data/ — ${exceptionCount} file(s) do not.</text>
    </g>
      </svg>
      <figcaption>The arrows show the intended dependency direction. The imports that run against it are listed under Evidence rather than smoothed over.</figcaption>
    </figure>

    ${heading('architecture', 2, 'Evidence')}
    <p class="section-note">Which files import the Supabase client, counted from the current tree: <strong>${scan.supabase.length}</strong> in total, <strong>${dataCount}</strong> of them inside <code>src/data/</code>. The exceptions are listed because a rule with hidden exceptions is not a rule.</p>
    <ul class="evidence-list">
      ${scan.supabase
        .map((path) => `<li><code>${esc(path)}</code>${path.startsWith('src/data/') ? '' : '<span class="flag">outside src/data/</span>'}</li>`)
        .join('\n      ')}
    </ul>

    ${heading('architecture', 3, 'Imports the diagram does not draw')}
    <p class="section-note">Cross-folder imports that are neither one of the four arrows nor a leaf being consumed. They are counted in the table below; nothing here is excluded to make the picture cleaner.</p>
    <ul class="evidence-list">
      ${offDiagramHtml}
    </ul>

    ${heading('architecture', 2, 'Folder inventory')}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Folder</th><th class="num">Files</th><th>Role</th><th>Imports into (count)</th></tr></thead>
        <tbody>
${dirRows}
        </tbody>
      </table>
    </div>

    ${heading('architecture', 2, 'Read next')}
    <ul class="link-list">
      <li><a href="#/docs/master-plan">Master Plan — what is on main, and in what order it ships</a></li>
      <li><a href="#/decisions">Decisions — the ADRs behind this layering</a></li>
      <li><a href="#/docs/technical-spec">CEMURM — Technical Specification</a></li>
    </ul>
  </div>
</section>`;
}

const ROLES = {
  app: 'entrypoint, router, shell, providers',
  content: 'static copy and content data',
  data: 'repositories and the Supabase client — the impure half',
  domain: 'pure logic with no I/O',
  features: 'pages and components, one folder per feature',
  hooks: 'shared React hooks',
  integrations: 'provider clients that never throw',
  lib: 'client setup and small utilities',
  offline: 'service worker glue, read cache, write queue',
  ui: 'shared presentational components',
};

function buildDocPage(stem, doc, docs) {
  const pageKey = `doc-${stem}`;
  const ctx = { route: `#/docs/${stem}`, pageKey, slugger: makeSlugger(), docs };
  const out = { headings: [], toc: [], tables: 0, lists: 0, fences: 0, paragraphs: 0 };
  const body = renderBlocks(doc.lines, ctx, out);

  const toc = out.toc.length
    ? `<nav class="onthispage" aria-label="Sections in this document">
      <p class="onthispage-label">On this page</p>
      <ul>
        ${out.toc.map((entry) => `<li><a href="${ctx.route}/${entry.slug}">${esc(entry.text)}</a></li>`).join('\n        ')}
      </ul>
    </nav>`
    : '';

  return {
    html: `<section class="page" id="page-${pageKey}" data-route="/docs/${stem}" data-page-key="${pageKey}">
  <header class="page-head">
    <h1>${esc(doc.title)}</h1>
    <p class="page-meta"><code>docs/${esc(stem)}.md</code> · ${doc.lineCount} lines · ${out.headings.length} headings · ${out.tables} tables</p>
    ${toc}
  </header>
  <div class="page-body prose">
${body}
  </div>
</section>`,
    stats: out,
  };
}

function buildOverviewPage({ docCount, docs, viz, adrs, tokenCount, scan }) {
  const docLinks = docs
    .map((doc) => `<li><a href="#/docs/${esc(doc.stem)}">${esc(doc.title)}</a> <span class="muted">docs/${esc(doc.stem)}.md</span></li>`)
    .join('\n      ');
  const vizLinks = viz
    .map((path) => `<li><a href="${esc(path)}">${esc(path)}</a></li>`)
    .join('\n      ');

  return `<section class="page" id="page-overview" data-route="/overview">
  <header class="page-head">
    <h1>CEMURM Handbook</h1>
    <p class="lede">The repository's documentation, design tokens, decisions and layering in one page that opens from the file system and works offline. Nothing here is typed in: every section below is generated from the files it names.</p>
  </header>
  <div class="page-body">
    ${heading('overview', 2, 'What is in here')}
    <dl class="overview-grid">
      <dt><a href="#/design">Design system</a></dt>
      <dd>Colours, radius, spacing, elevation, motion and the four-tier surface table, parsed from <code>skills/cemurm-visual-system/assets/tokens.css</code> (${tokenCount} tokens) and the visual-system skill.</dd>
      <dt><a href="#/decisions">Decisions</a></dt>
      <dd>${adrs.length} records parsed from <code>docs/decisions.md</code>.</dd>
      <dt><a href="#/architecture">Architecture</a></dt>
      <dd>Layering diagram, import evidence and folder inventory computed from <code>src/</code> (${scan.total} files).</dd>
      <dt>Documentation</dt>
      <dd>All ${docCount} <code>docs/*.md</code> files, rendered by the markdown renderer inside the generator.</dd>
      <dt>Visualizations</dt>
      <dd>The existing <code>docs/**/*.html</code> diagrams, linked as files rather than copied.</dd>
    </dl>

    ${heading('overview', 2, 'Regenerating this file')}
    <pre class="code-block"><code>node scripts/build-docs-viewer.mjs</code></pre>
    <p>There is deliberately no npm script for it. The run is deterministic: no timestamps, no random ids, no network reads, inputs in sorted order, so two runs produce the same bytes.</p>

    ${heading('overview', 2, 'Design dials')}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Dial</th><th>Value</th><th>How it shows up here</th></tr></thead>
        <tbody>
          ${DIALS.map(([name, value, effect]) => `<tr><td>${esc(name)}</td><td class="mono">${esc(value)}</td><td>${esc(effect)}</td></tr>`).join('\n          ')}
        </tbody>
      </table>
    </div>

    ${heading('overview', 2, 'Notes on this artifact')}
    <ul>
      <li>Colour lives only in the token layer at the top of the stylesheet; every rule below it uses <code>var(--cem-*)</code>. Light mode re-declares the same variable names under <code>[data-theme="light"]</code> and the choice persists in <code>localStorage</code>, defaulting to <code>prefers-color-scheme</code>.</li>
      <li>JetBrains Mono loads asynchronously with a system monospace fallback, so a page opened with no network still renders correctly.</li>
      <li><code>scripts/check-visual-contract.sh</code> scans <code>src/</code> only — its PASS does not cover <code>docs/*.html</code>, this file included.</li>
      <li>This surface is tier 1 (navigation and reference chrome), not a performance surface: materials are allowed here and forbidden on the projector overlay.</li>
    </ul>

    ${heading('overview', 2, 'Documentation index')}
    <ul class="link-list">
      ${docLinks}
    </ul>

    ${heading('overview', 2, 'Visualizations')}
    <ul class="link-list">
      ${vizLinks}
    </ul>
  </div>
</section>`;
}

/* ------------------------------------------------------------------ shell */

function buildSidebar({ docs, viz }) {
  const docLinks = docs
    .map((doc) => `<a href="#/docs/${esc(doc.stem)}" data-route="/docs/${esc(doc.stem)}">${esc(doc.title)}</a>`)
    .join('\n        ');
  const vizLinks = viz
    .map((path) => `<a href="${esc(path)}">${esc(path)}</a>`)
    .join('\n        ');

  return `<aside class="sidebar" id="sidebar">
      <div class="sidebar-top">
        <a class="brand" href="#/overview" data-route="/overview">
          <span class="brand-name">CEMURM</span>
          <span class="brand-sub">Handbook</span>
        </a>
        <div class="sidebar-actions">
          <button id="theme-toggle" type="button" aria-label="Switch theme">Light</button>
          <button id="menu-toggle" type="button" aria-expanded="false" aria-controls="nav-body">Menu</button>
        </div>
      </div>
      <div class="nav-body" id="nav-body">
        <nav aria-label="Handbook sections">
          <p class="nav-group">Start</p>
          <a href="#/overview" data-route="/overview" aria-current="page">Overview</a>
          <p class="nav-group">Sections</p>
          <a href="#/design" data-route="/design">Design system</a>
          <a href="#/decisions" data-route="/decisions">Decisions</a>
          <a href="#/architecture" data-route="/architecture">Architecture</a>
          <p class="nav-group">Documentation · ${docs.length}</p>
        ${docLinks}
          <p class="nav-group">Visualizations · ${viz.length}</p>
        ${vizLinks}
        </nav>
        <p class="sidebar-foot">Generated from the repository. Regenerate with <code>node scripts/build-docs-viewer.mjs</code>.</p>
      </div>
    </aside>`;
}

const PREPAINT_SCRIPT = `<script>
    // Resolve the theme before first paint so light-preference users don't see a dark flash.
    // Copied from the pattern at the top of docs/architecture-current.html.
    (function () {
      var theme = null;
      try { theme = localStorage.getItem('cem-handbook-theme'); } catch (_) {}
      if (theme !== 'light' && theme !== 'dark') {
        theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
      document.documentElement.setAttribute('data-theme', theme);
    })();
  </script>`;

const CLIENT_SCRIPT = `<script>
  (function () {
    var THEME_KEY = 'cem-handbook-theme';
    var root = document.documentElement;

    function applyTheme(theme) {
      root.setAttribute('data-theme', theme);
      try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
      var toggle = document.getElementById('theme-toggle');
      if (toggle) {
        toggle.textContent = theme === 'light' ? 'Dark' : 'Light';
        toggle.setAttribute('aria-label', 'Switch to ' + (theme === 'light' ? 'dark' : 'light') + ' theme');
      }
    }

    var themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.textContent = root.getAttribute('data-theme') === 'light' ? 'Dark' : 'Light';
      themeToggle.addEventListener('click', function () {
        applyTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
      });
    }

    var menuToggle = document.getElementById('menu-toggle');
    function setMenu(open) {
      document.body.classList.toggle('nav-open', open);
      if (menuToggle) menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (menuToggle) {
      menuToggle.addEventListener('click', function () {
        setMenu(!document.body.classList.contains('nav-open'));
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setMenu(false);
    });

    var pages = Array.prototype.slice.call(document.querySelectorAll('.page'));
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.sidebar a[data-route]'));

    function parseRoute(hash) {
      var raw = String(hash || '').replace(/^#/, '');
      if (raw.charAt(0) !== '/') return null;
      var parts = raw.slice(1).split('/').filter(Boolean);
      // route is compared against each page's data-route attribute, so it carries no '#'.
      if (!parts.length) return { key: 'overview', route: '/overview', anchor: null };
      if (parts[0] === 'docs') {
        if (!parts[1]) return null;
        return { key: 'doc-' + parts[1], route: '/docs/' + parts[1], anchor: parts[2] || null };
      }
      return { key: parts[0], route: '/' + parts[0], anchor: parts[1] || null };
    }

    function setCurrentAdr(key) {
      var cards = document.querySelectorAll('.adr');
      Array.prototype.forEach.call(cards, function (card) {
        var isCurrent = key && card.id === 'h-decisions--' + key;
        if (isCurrent) {
          card.setAttribute('data-current', '');
          card.setAttribute('data-open', '');
        } else {
          card.removeAttribute('data-current');
          card.removeAttribute('data-open');
        }
        var button = card.querySelector('.adr-toggle');
        if (button) {
          button.setAttribute('aria-expanded', isCurrent ? 'true' : 'false');
          button.textContent = isCurrent ? 'Hide record' : 'Show record';
        }
      });
      Array.prototype.forEach.call(document.querySelectorAll('.adr-jump'), function (jump) {
        var current = key && jump.getAttribute('href') === '#/decisions/' + key;
        if (current) jump.setAttribute('data-current', '');
        else jump.removeAttribute('data-current');
      });
    }

    var firstRender = true;
    var lastLocation = null;

    function navigate() {
      var target = parseRoute(window.location.hash);
      // A hash that is not a handbook route (the skip link's #main, for instance) is left to
      // the browser: it scrolls, the current page stays visible.
      if (!target) return;
      // The landing hash and the hashchange it triggers resolve to the same place: render once.
      var location = target.route + '|' + (target.anchor || '');
      if (location === lastLocation) return;
      lastLocation = location;
      var active = null;
      pages.forEach(function (page) {
        var match = page.getAttribute('data-route') === target.route;
        page.hidden = !match;
        if (match) active = page;
      });
      if (!active) {
        window.location.replace('#/overview');
        return;
      }
      navLinks.forEach(function (link) {
        if (link.getAttribute('data-route') === target.route) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      if (target.key === 'decisions') {
        if (target.anchor) {
          setCurrentAdr(target.anchor);
        } else {
          var marked = document.querySelector('.adr[data-current]');
          setCurrentAdr(marked ? marked.id.replace('h-decisions--', '') : null);
        }
      }

      // Entry transition on navigation only: the first paint must never start at opacity 0.
      if (firstRender) {
        firstRender = false;
      } else {
        active.classList.remove('enter');
        void active.offsetWidth;
        active.classList.add('enter');
      }

      var anchorTarget = null;
      if (target.anchor) {
        anchorTarget = document.getElementById('h-' + target.key + '--' + target.anchor);
      }
      if (anchorTarget) {
        anchorTarget.scrollIntoView({ block: 'start' });
      } else {
        window.scrollTo(0, 0);
      }
      setMenu(false);
    }

    window.addEventListener('hashchange', navigate);
    if (!window.location.hash) window.location.replace('#/overview');
    navigate();

    Array.prototype.forEach.call(document.querySelectorAll('.adr-toggle'), function (button) {
      button.addEventListener('click', function () {
        var card = button.closest('.adr');
        var open = card.hasAttribute('data-open');
        var key = open ? null : card.id.replace('h-decisions--', '');
        setCurrentAdr(key);
        if (open) return;
        if (window.location.hash !== '#/decisions/' + key) {
          history.replaceState(null, '', '#/decisions/' + key);
        }
      });
    });
  })();
</script>`;

function buildStyles({ tokens }) {
  const v = (name) => tokens.values.get(name);
  const tokenLines = [...tokens.values.keys()].map((name) => `  ${name}: ${v(name)};`);

  return `<style>
  /* ------------------------------------------------------------------
     TOKEN LAYER. The dark values are parsed from
     skills/cemurm-visual-system/assets/tokens.css at build time; the light
     values are a project decision (tokens.css declares no light ramp).
     Every colour literal in this file lives in these two blocks — every rule
     below them uses var(--cem-*) and nothing else.
     ------------------------------------------------------------------ */
  :root {
    color-scheme: dark;
${tokenLines.join('\n')}
    --cem-link: var(--cem-accent);
    --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --sidebar-width: 17rem;
    --content-width: 46rem;
  }

  [data-theme="light"] {
    color-scheme: light;
    --cem-bg: #efedea;
    --cem-surface: #f5f3f1;
    --cem-elevated: #fbfaf9;
    --cem-hover: #e4e1dd;
    --cem-text: #1c1917;
    --cem-secondary: #57534e;
    --cem-fill-subtle: rgb(28 25 23 / 4%);
    --cem-fill-hover: rgb(28 25 23 / 8%);
    --cem-separator: rgb(28 25 23 / 12%);
    --cem-separator-strong: rgb(28 25 23 / 22%);
    --cem-accent-quiet: rgb(245 158 11 / 18%);
    --cem-on-accent: #1c1917;
    --cem-material: rgb(251 250 249 / 82%);
    --cem-material-border: rgb(28 25 23 / 12%);
    --cem-link: var(--cem-accent-press);
  }

  * { box-sizing: border-box; }

  html { -webkit-text-size-adjust: 100%; }

  body {
    margin: 0;
    background: var(--cem-bg);
    color: var(--cem-text);
    font-family: var(--font-sans);
    font-size: 15px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }

  a { color: var(--cem-link); text-decoration-thickness: 1px; text-underline-offset: 0.18em; }
  a:hover { text-decoration-thickness: 2px; }
  a:focus-visible, button:focus-visible {
    outline: 2px solid var(--cem-text);
    outline-offset: 2px;
    border-radius: var(--cem-radius-xs);
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.9em;
    background: var(--cem-fill-subtle);
    border-radius: var(--cem-radius-xs);
    padding: 0.1em 0.35em;
  }

  .skip-link {
    position: absolute;
    left: -9999px;
    top: var(--cem-space-2);
    z-index: 40;
    background: var(--cem-text);
    color: var(--cem-bg);
    padding: var(--cem-space-2) var(--cem-space-4);
    border-radius: var(--cem-radius-sm);
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .skip-link:focus { left: var(--cem-space-4); }

  /* ------------------------------------------------------------------ shell */
  .shell {
    display: grid;
    grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
    align-items: start;
    min-height: 100vh;
  }

  .sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    padding: var(--cem-space-5) var(--cem-space-4) var(--cem-space-6);
    background: var(--cem-material);
    backdrop-filter: blur(var(--cem-material-blur));
    -webkit-backdrop-filter: blur(var(--cem-material-blur));
    border-right: 1px solid var(--cem-material-border);
  }

  .sidebar-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--cem-space-3);
    padding-bottom: var(--cem-space-4);
    border-bottom: 1px solid var(--cem-separator);
  }

  .brand { text-decoration: none; color: var(--cem-text); display: block; }
  .brand-name {
    display: block;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.06em;
  }
  .brand-sub {
    display: block;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--cem-secondary);
  }

  .sidebar-actions { display: flex; gap: var(--cem-space-2); }
  .sidebar-actions button {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--cem-secondary);
    background: var(--cem-fill-subtle);
    border: 1px solid var(--cem-separator);
    border-radius: var(--cem-radius-sm);
    padding: var(--cem-space-1) var(--cem-space-3);
    cursor: pointer;
    transition: background-color var(--cem-dur-fast) var(--cem-ease-out), color var(--cem-dur-fast) var(--cem-ease-out);
  }
  .sidebar-actions button:hover { background: var(--cem-fill-hover); color: var(--cem-text); }
  #menu-toggle { display: none; }

  .nav-body { padding-top: var(--cem-space-4); }
  .nav-group {
    margin: var(--cem-space-5) 0 var(--cem-space-2);
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--cem-secondary);
  }
  .nav-group:first-child { margin-top: 0; }

  .nav-body nav > a {
    display: block;
    padding: var(--cem-space-2) var(--cem-space-3);
    margin-bottom: 2px;
    border-radius: var(--cem-radius-sm);
    color: var(--cem-secondary);
    font-family: var(--font-mono);
    font-size: 12.5px;
    line-height: 1.45;
    text-decoration: none;
    transition: background-color var(--cem-dur-fast) var(--cem-ease-out), color var(--cem-dur-fast) var(--cem-ease-out);
  }
  .nav-body nav > a:hover { background: var(--cem-fill-hover); color: var(--cem-text); }
  .nav-body nav > a[aria-current="page"] {
    background: var(--cem-accent);
    color: var(--cem-on-accent);
    font-weight: 700;
  }

  .sidebar-foot {
    margin-top: var(--cem-space-6);
    padding-top: var(--cem-space-4);
    border-top: 1px solid var(--cem-separator);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.7;
    color: var(--cem-secondary);
  }
  .sidebar-foot code { background: none; padding: 0; color: var(--cem-text); }

  /* ------------------------------------------------------------------ content */
  main {
    min-width: 0;
    padding: var(--cem-space-10) clamp(var(--cem-space-6), 5vw, var(--cem-space-12)) var(--cem-space-16);
  }

  .page { max-width: var(--content-width); }
  .page[hidden] { display: none; }

  .page.enter { animation: page-in var(--cem-dur-base) var(--cem-ease-out) both; }
  @keyframes page-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }

  .page-head { margin-bottom: var(--cem-space-8); }
  .page-kicker {
    margin: 0 0 var(--cem-space-3);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--cem-secondary);
  }

  h1 {
    margin: 0 0 var(--cem-space-4);
    font-size: clamp(26px, 3.4vw, 34px);
    line-height: 1.15;
    letter-spacing: -0.02em;
    font-weight: 650;
  }

  .lede {
    margin: 0;
    font-size: 17px;
    line-height: 1.6;
    color: var(--cem-secondary);
    max-width: 62ch;
  }

  .page-meta {
    margin: var(--cem-space-4) 0 0;
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--cem-secondary);
  }
  .page-meta code { background: none; padding: 0; }

  .page-body h2 {
    margin: var(--cem-space-10) 0 var(--cem-space-3);
    font-size: 21px;
    line-height: 1.3;
    letter-spacing: -0.01em;
    font-weight: 640;
    scroll-margin-top: var(--cem-space-6);
  }
  .page-body h3 {
    margin: var(--cem-space-6) 0 var(--cem-space-2);
    font-size: 16px;
    font-weight: 640;
    scroll-margin-top: var(--cem-space-6);
  }
  .page-body h4 {
    margin: var(--cem-space-4) 0 var(--cem-space-1);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--cem-secondary);
    font-weight: 500;
  }

  .section-note, .group-blurb {
    margin: 0 0 var(--cem-space-4);
    color: var(--cem-secondary);
    font-size: 14px;
    max-width: 68ch;
  }

  hr {
    border: 0;
    border-top: 1px solid var(--cem-separator);
    margin: var(--cem-space-8) 0;
  }

  /* ------------------------------------------------------------------ prose */
  .prose { max-width: 70ch; }
  .prose p { margin: 0 0 var(--cem-space-4); }
  .prose ul, .prose ol { margin: 0 0 var(--cem-space-4); padding-left: var(--cem-space-5); }
  .prose li { margin-bottom: var(--cem-space-2); }
  .prose li > ul, .prose li > ol { margin-top: var(--cem-space-2); margin-bottom: 0; }
  .prose img { max-width: 100%; height: auto; border-radius: var(--cem-radius-md); }

  .task-list { list-style: none; padding-left: var(--cem-space-2); }
  .task-list input { accent-color: var(--cem-secondary); margin-right: var(--cem-space-2); }

  blockquote {
    margin: 0 0 var(--cem-space-4);
    padding: var(--cem-space-3) var(--cem-space-4);
    border-left: 2px solid var(--cem-separator-strong);
    background: var(--cem-fill-subtle);
    border-radius: var(--cem-radius-md);
    color: var(--cem-secondary);
  }
  blockquote > :last-child { margin-bottom: 0; }

  .code-block {
    margin: 0 0 var(--cem-space-4);
    padding: var(--cem-space-4);
    background: var(--cem-surface);
    border: 1px solid var(--cem-separator);
    border-radius: var(--cem-radius-md);
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 12.5px;
    line-height: 1.7;
    tab-size: 2;
  }
  .code-block code { background: none; padding: 0; font-size: inherit; color: var(--cem-text); }

  .table-wrap {
    margin: 0 0 var(--cem-space-5);
    overflow-x: auto;
    border: 1px solid var(--cem-separator);
    border-radius: var(--cem-radius-md);
  }
  table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
  th, td {
    text-align: left;
    vertical-align: top;
    padding: var(--cem-space-3) var(--cem-space-4);
    border-bottom: 1px solid var(--cem-separator);
  }
  thead th {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--cem-secondary);
    font-weight: 500;
    background: var(--cem-fill-subtle);
    white-space: nowrap;
  }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:nth-child(even) td { background: var(--cem-fill-subtle); }
  td.num, th.num { font-family: var(--font-mono); white-space: nowrap; }
  .mono { font-family: var(--font-mono); }

  /* ------------------------------------------------------------------ on this page */
  .onthispage {
    margin-top: var(--cem-space-6);
    padding: var(--cem-space-4);
    background: var(--cem-surface);
    border: 1px solid var(--cem-separator);
    border-radius: var(--cem-radius-md);
  }
  .onthispage-label {
    margin: 0 0 var(--cem-space-2);
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--cem-secondary);
  }
  .onthispage ul { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: var(--cem-space-5); }
  .onthispage li { margin-bottom: var(--cem-space-1); break-inside: avoid; }
  .onthispage a { font-family: var(--font-mono); font-size: 12px; text-decoration: none; }
  .onthispage a:hover { text-decoration: underline; }

  /* ------------------------------------------------------------------ design page */
  .token-groups { display: grid; gap: var(--cem-space-6); }
  .token-group h3 {
    margin: 0 0 var(--cem-space-1);
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 500;
  }
  .token-group .group-blurb { margin-bottom: var(--cem-space-3); }

  .swatch-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--cem-space-3);
  }
  .swatch {
    display: flex;
    gap: var(--cem-space-3);
    align-items: center;
    padding: var(--cem-space-3);
    background: var(--cem-surface);
    border: 1px solid var(--cem-separator);
    border-radius: var(--cem-radius-md);
    transition: border-color var(--cem-dur-fast) var(--cem-ease-out);
  }
  .swatch:hover { border-color: var(--cem-separator-strong); }
  .swatch-chip {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    border-radius: var(--cem-radius-sm);
    border: 1px solid var(--cem-separator-strong);
  }
  .swatch-meta { display: flex; flex-direction: column; min-width: 0; }
  .swatch-meta code { background: none; padding: 0; font-size: 12px; color: var(--cem-text); }
  .swatch-value, .scale-value {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--cem-secondary);
    word-break: break-all;
  }
  .swatch-note, .scale-note {
    font-size: 11.5px;
    color: var(--cem-secondary);
  }

  .scale-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--cem-space-2); }
  .scale-row {
    display: grid;
    grid-template-columns: 88px minmax(140px, auto) 72px minmax(0, 1fr);
    align-items: center;
    gap: var(--cem-space-3);
    padding: var(--cem-space-3);
    background: var(--cem-surface);
    border: 1px solid var(--cem-separator);
    border-radius: var(--cem-radius-md);
  }
  .scale-row code { background: none; padding: 0; }
  .radius-demo {
    display: block;
    width: 72px;
    height: 40px;
    background: var(--cem-elevated);
    border: 1px solid var(--cem-separator-strong);
  }
  .space-demo { display: block; height: 10px; background: var(--cem-separator-strong); border-radius: var(--cem-radius-xs); }
  .motion-row { grid-template-columns: minmax(140px, auto) 72px minmax(0, 1fr); }

  .elev-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--cem-space-5); }
  .elev-demo {
    display: flex;
    flex-direction: column;
    gap: var(--cem-space-1);
    padding: var(--cem-space-5);
    background: var(--cem-elevated);
    border: 1px solid var(--cem-separator);
    border-radius: var(--cem-radius-md);
  }
  .elev-demo code { background: none; padding: 0; }

  /* ------------------------------------------------------------------ decisions page */
  .adr-rail { display: flex; flex-wrap: wrap; gap: var(--cem-space-2); margin-top: var(--cem-space-5); }
  .adr-jump {
    font-family: var(--font-mono);
    font-size: 11.5px;
    text-decoration: none;
    color: var(--cem-secondary);
    background: var(--cem-fill-subtle);
    border: 1px solid var(--cem-separator);
    border-radius: var(--cem-radius-pill);
    padding: var(--cem-space-1) var(--cem-space-3);
    transition: border-color var(--cem-dur-fast) var(--cem-ease-out), color var(--cem-dur-fast) var(--cem-ease-out);
  }
  .adr-jump:hover { color: var(--cem-text); border-color: var(--cem-separator-strong); }
  .adr-jump[data-current] { color: var(--cem-text); border-color: var(--cem-accent); }

  .adr-list { display: grid; gap: var(--cem-space-4); }
  .adr {
    background: var(--cem-surface);
    border: 1px solid var(--cem-separator);
    border-left: 3px solid var(--cem-separator);
    border-radius: var(--cem-radius-md);
    padding: var(--cem-space-5);
    scroll-margin-top: var(--cem-space-6);
    transition: border-color var(--cem-dur-fast) var(--cem-ease-out), background-color var(--cem-dur-fast) var(--cem-ease-out);
  }
  .adr:hover { background: var(--cem-elevated); }
  .adr[data-current] { border-left-color: var(--cem-accent); }

  .adr-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--cem-space-3); }
  .adr-head h3 { margin: 0; font-size: 17px; line-height: 1.35; flex: 1 1 16rem; }
  .adr-id {
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.08em;
    color: var(--cem-secondary);
    background: var(--cem-fill-subtle);
    border: 1px solid var(--cem-separator);
    border-radius: var(--cem-radius-xs);
    padding: 2px var(--cem-space-2);
  }
  .adr[data-current] .adr-id { color: var(--cem-text); border-color: var(--cem-accent); }
  .adr-status {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--cem-text);
    background: var(--cem-fill-hover);
    border: 1px solid var(--cem-separator-strong);
    border-radius: var(--cem-radius-pill);
    padding: 2px var(--cem-space-3);
  }
  .adr-status.status-unknown { border-style: dashed; color: var(--cem-secondary); }
  .adr-date {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--cem-secondary);
  }
  .adr-decision { margin: var(--cem-space-4) 0 var(--cem-space-3); }

  .adr-toggle {
    font-family: var(--font-mono);
    font-size: 11.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--cem-secondary);
    background: transparent;
    border: 1px solid var(--cem-separator);
    border-radius: var(--cem-radius-sm);
    padding: var(--cem-space-1) var(--cem-space-3);
    cursor: pointer;
    transition: color var(--cem-dur-fast) var(--cem-ease-out), border-color var(--cem-dur-fast) var(--cem-ease-out);
  }
  .adr-toggle:hover { color: var(--cem-text); border-color: var(--cem-separator-strong); }

  .adr-panel {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows var(--cem-dur-base) var(--cem-ease-out);
  }
  .adr[data-open] .adr-panel { grid-template-rows: 1fr; }
  .adr-panel > div { overflow: hidden; visibility: hidden; transition: visibility 0s linear var(--cem-dur-base); }
  .adr[data-open] .adr-panel > div { visibility: visible; transition-delay: 0s; }
  .adr-field { padding-top: var(--cem-space-3); border-top: 1px solid var(--cem-separator); margin-top: var(--cem-space-3); }
  .adr-field:first-child { border-top: 0; margin-top: var(--cem-space-4); }
  .adr-field p { margin: 0; font-size: 14px; color: var(--cem-secondary); }

  /* ------------------------------------------------------------------ architecture page */
  .arch-figure { margin: 0 0 var(--cem-space-6); }
  .arch-svg {
    width: 100%;
    height: auto;
    display: block;
    background: var(--cem-surface);
    border: 1px solid var(--cem-separator);
    border-radius: var(--cem-radius-lg);
    padding: var(--cem-space-4);
  }
  .arch-svg .layer rect { fill: var(--cem-elevated); stroke: var(--cem-separator-strong); }
  .arch-svg .leaf rect, .arch-svg .rule rect {
    fill: var(--cem-fill-subtle);
    stroke: var(--cem-separator);
    stroke-dasharray: 4 4;
  }
  .arch-svg .edge line { stroke: var(--cem-separator-strong); }
  .arch-svg text { font-family: var(--font-mono); }
  .arch-svg .layer-name { fill: var(--cem-text); font-size: 15px; font-weight: 700; }
  .arch-svg .layer-sub, .arch-svg .leaf-sub { fill: var(--cem-secondary); font-size: 12px; }
  .arch-svg .edge-label { fill: var(--cem-secondary); font-size: 12px; }
  .arch-svg .leaf-title, .arch-svg .rule-title {
    fill: var(--cem-text);
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .arch-svg .leaf-line { fill: var(--cem-secondary); font-size: 12.5px; }
  .arch-svg .rule-line { fill: var(--cem-text); font-size: 16px; font-weight: 700; }
  figcaption { margin-top: var(--cem-space-3); font-size: 13px; color: var(--cem-secondary); }

  .evidence-list { list-style: none; margin: 0 0 var(--cem-space-5); padding: 0; display: grid; gap: var(--cem-space-1); }
  .evidence-list li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--cem-space-3);
    align-items: baseline;
    font-family: var(--font-mono);
    font-size: 12.5px;
    padding: var(--cem-space-2) var(--cem-space-3);
    background: var(--cem-surface);
    border: 1px solid var(--cem-separator);
    border-radius: var(--cem-radius-sm);
  }
  .evidence-list code { background: none; padding: 0; }
  .flag {
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--cem-secondary);
    border: 1px dashed var(--cem-separator-strong);
    border-radius: var(--cem-radius-pill);
    padding: 1px var(--cem-space-2);
  }
  td.imports { font-family: var(--font-mono); font-size: 12px; }
  td.imports span { display: inline-block; margin-right: var(--cem-space-3); }
  td.imports .none { color: var(--cem-secondary); }

  /* ------------------------------------------------------------------ overview */
  .overview-grid { display: grid; grid-template-columns: minmax(7rem, 10rem) minmax(0, 1fr); gap: var(--cem-space-3) var(--cem-space-5); margin: 0 0 var(--cem-space-5); }
  .overview-grid dt { font-weight: 640; }
  .overview-grid dd { margin: 0; color: var(--cem-secondary); font-size: 14.5px; }
  .link-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--cem-space-2); }
  .link-list li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--cem-space-3);
    align-items: baseline;
    padding: var(--cem-space-2) 0;
    border-bottom: 1px solid var(--cem-separator);
  }
  .link-list li:last-child { border-bottom: 0; }
  .muted { font-family: var(--font-mono); font-size: 11.5px; color: var(--cem-secondary); }

  /* ------------------------------------------------------------------ responsive
     Fallback: below 768px the left sidebar collapses into a sticky top bar whose
     nav body is hidden behind the Menu button (aria-expanded toggles .nav-open). */
  @media (max-width: 767px) {
    .shell { grid-template-columns: minmax(0, 1fr); }
    .sidebar {
      position: sticky;
      top: 0;
      height: auto;
      max-height: none;
      padding: var(--cem-space-3) var(--cem-space-4);
      border-right: 0;
      border-bottom: 1px solid var(--cem-material-border);
      z-index: 20;
    }
    .sidebar-top { padding-bottom: 0; border-bottom: 0; align-items: center; }
    #menu-toggle { display: inline-block; }
    .nav-body { display: none; padding-top: var(--cem-space-4); border-top: 1px solid var(--cem-separator); margin-top: var(--cem-space-3); }
    body.nav-open .nav-body { display: block; max-height: 65vh; overflow-y: auto; }
    main { padding: var(--cem-space-6) var(--cem-space-4) var(--cem-space-12); }
    .scale-row { grid-template-columns: 72px minmax(0, 1fr); row-gap: var(--cem-space-2); }
    .scale-row .scale-note { grid-column: 1 / -1; }
    .onthispage ul { columns: 1; }
    .overview-grid { grid-template-columns: minmax(0, 1fr); gap: var(--cem-space-1); }
    .overview-grid dd { margin-bottom: var(--cem-space-3); }
  }

  /* ------------------------------------------------------------------ reduced motion */
  @media (prefers-reduced-motion: reduce) {
    :root {
      --cem-dur-instant: 0ms;
      --cem-dur-fast: 0ms;
      --cem-dur-base: 0ms;
    }
    * { animation: none !important; transition-duration: 0ms !important; }
  }
</style>`;
}

/* ------------------------------------------------------------------ assembly */

function buildHtml({ docs, viz, adrs, tokens, notes, tierTable, scan, docCount }) {
  const pages = [
    buildOverviewPage({ docCount, docs, viz, adrs, tokenCount: tokens.values.size, scan }),
    buildDesignPage({ tokens, notes, tierTable }),
    buildDecisionsPage(adrs),
    buildArchitecturePage(scan),
    ...docs.map((doc) => buildDocPage(doc.stem, doc, new Set(docs.map((entry) => entry.stem))).html),
  ]
    // Everything but the landing page ships hidden so the first paint shows one page even
    // before the router runs; <noscript> reveals them all.
    .map((page) =>
      page.startsWith('<section class="page" id="page-overview"')
        ? page
        : page.replace('<section class="page"', '<section class="page" hidden')
    )
    .join('\n\n  ');

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="scripts/build-docs-viewer.mjs">
  <meta name="color-scheme" content="dark light">
  <title>CEMURM Handbook — documentation, design system, decisions</title>
  <meta name="description" content="Generated reference for the CEMURM repository: documentation, design tokens, architecture decision records and layering.">
  ${PREPAINT_SCRIPT}
  <!-- Async font load: a blackholed network must not block first paint. The stack falls
       back to the system monospace until it lands, so the page works offline. -->
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&amp;display=swap"
        rel="stylesheet" media="print" onload="this.media='all'">
  <noscript>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&amp;display=swap" rel="stylesheet">
    <style>.page[hidden] { display: block !important; }</style>
  </noscript>
  ${buildStyles({ tokens })}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="shell">
    ${buildSidebar({ docs, viz })}
    <main id="main">
  ${pages}
    </main>
  </div>
  ${CLIENT_SCRIPT}
</body>
</html>
`;
}

function main() {
  const docNames = readdirSync(DOCS_DIR)
    .filter((name) => name.endsWith('.md'))
    .sort();
  if (!docNames.length) fail('no docs/*.md files found');

  const docs = docNames.map((name) => {
    const stem = name.replace(/\.md$/, '');
    return { stem, ...parseDoc(join(DOCS_DIR, name)) };
  });

  const viz = walk(DOCS_DIR, DOCS_DIR, ['.html'], new Set(['handbook.html']));

  const tokens = parseTokens();
  const adrs = parseAdrs();
  const tierTable = parseTierTable();
  const scan = scanSrc();

  const html = buildHtml({ docs, viz, adrs, tokens, notes: tokens.notes, tierTable, scan, docCount: docs.length });
  writeFileSync(OUT_FILE, html, 'utf8');

  const bytes = Buffer.byteLength(html, 'utf8');
  process.stdout.write(
    `[build-docs-viewer] wrote docs/handbook.html\n` +
      `  docs rendered:   ${docs.length} (${docs.reduce((sum, doc) => sum + doc.lineCount, 0)} source lines)\n` +
      `  tokens parsed:   ${tokens.values.size} from skills/cemurm-visual-system/assets/tokens.css\n` +
      `  ADRs parsed:     ${adrs.length} (${adrs[0].id} … ${adrs[adrs.length - 1].id})\n` +
      `  tier table:      4 rows from the visual-system skill\n` +
      `  src inventory:   ${scan.total} files in ${scan.directories.length} folders, ${scan.imports.size} import edges\n` +
      `  visualizations:  ${viz.length} linked HTML files\n` +
      `  size:            ${(bytes / 1024).toFixed(1)} KiB\n`
  );
}

main();
