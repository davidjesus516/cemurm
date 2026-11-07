#!/usr/bin/env node
/**
 * Fail when a PR exceeds the authored changed-line budget.
 *
 * The agent guards (Claude Code PreToolUse, OpenCode permission hook) catch the
 * command. This catches the PR itself: opened from the web UI, by a human, or by
 * an agent whose runtime has no plugin loaded. Same metric, same rules module.
 *
 * Usage:
 *   node scripts/check-pr-size.mjs --base <ref> --head <ref>
 *
 * Environment:
 *   PR_LABELS=bug,docs,size:exception   comma-separated label names
 */

import { execFileSync } from 'node:child_process';

import { judgePrSize } from './hooks/rules.mjs';

const args = parseArgs(process.argv.slice(2));
const base = args.base;
const head = args.head ?? 'HEAD';

if (!base) {
  console.error('check-pr-size: --base <ref> is required');
  process.exit(2);
}

const labels = String(process.env.PR_LABELS ?? '')
  .split(',')
  .map((label) => label.trim())
  .filter(Boolean);

if (labels.includes('size:exception')) {
  console.log('check-pr-size: size:exception is applied, skipping.');
  process.exit(0);
}

let numstat;
try {
  numstat = execFileSync('git', ['diff', '--numstat', `${base}...${head}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
} catch {
  console.error(`check-pr-size: could not diff ${base}...${head}`);
  process.exit(2);
}

const size = judgePrSize('gh pr create', numstat, { base });

if (!size) {
  process.exit(0);
}

console.error(size.reason);
process.exit(1);

/** @param {string[]} argv @returns {{ base?: string, head?: string }} */
function parseArgs(argv) {
  /** @type {{ base?: string, head?: string }} */
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base') parsed.base = argv[index += 1];
    else if (arg === '--head') parsed.head = argv[index += 1];
  }

  return parsed;
}
