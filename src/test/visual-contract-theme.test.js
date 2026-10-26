/* eslint-env node */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CSS = 'src/app/index.css';
const SCRIPT = 'scripts/check-visual-contract.sh';
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const walk = (dir) =>
  readdirSync(join(ROOT, dir), { recursive: true })
    .map(String)
    .filter((f) => /\.(js|jsx|ts|tsx|css|html)$/.test(f))
    .map((f) => join(dir, f));

// The gate namespaces the `cem-*` palette as `cem.<leaf>` and keeps every
// other key in its literal CSS spelling (`chart-1`, `destructive`).
const declared = [...read(CSS).matchAll(/^\s*--color-([a-z0-9-]+)\s*:/gm)].map((m) => m[1]);
const toKey = (s) => (s.startsWith('cem-') ? `cem.${s.slice(4)}` : s);

describe('visual contract port', () => {
  it('gate is green with rule 02 pinned at its ceiling', () => {
    const out = execFileSync('bash', [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
    expect(out).toContain('visual contract: OK');
    const m = out.match(/WARN\s+02\s+.*?(\d+) occurrences \(ceiling (\d+)\)/);
    expect(m, 'rule 02 line missing').toBeTruthy();
    expect(Number(m[1])).toBe(Number(m[2]));
  });

  it('rule 04 keeps chart keys literal and matches the declared set', () => {
    const out = execFileSync('bash', [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
    const inventory = out.match(/token inventory: (.+)/)?.[1] ?? '';
    expect(inventory).toContain('chart-1');
    expect(inventory).not.toContain('chart.1');

    const block = read(SCRIPT).match(/CSS_COLOUR_KEY_ALLOWLIST=\(([\s\S]*?)\n\)/)[1];
    const allow = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(allow).toEqual(declared.map(toKey).sort());
  });

  it('every -cem-<token> utility names a declared --color token', () => {
    const names = new Set(declared);
    const bad = [];
    for (const file of walk('src')) {
      const text = read(file);
      for (const m of text.matchAll(
        /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|divide|decoration|placeholder|shadow)-cem-([a-z0-9-]+)/g
      )) {
        if (!names.has(`cem-${m[1]}`)) bad.push(`${file}:${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('reference.css keeps one @reference and compiles its theme() alpha', () => {
    const text = read('src/features/design/components/reference.css');
    expect(text.match(/@reference/g) ?? []).toHaveLength(1);
    expect(text).not.toMatch(/theme\(\s*'colors\.[^']*'\s*\//);
  });

  // Deliberately strict: project CSS must use the declared palette, so a
  // Tailwind default such as --color-white is flagged and must be mapped.
  it('every var(--color-*) reference names a declared token', () => {
    const names = new Set(declared);
    const bad = [];
    for (const file of walk('src')) {
      const text = read(file);
      for (const m of text.matchAll(/var\(--color-([a-z0-9-]+)\)/g)) {
        if (!names.has(m[1])) bad.push(`${file}:--color-${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
