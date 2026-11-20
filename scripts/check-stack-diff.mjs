#!/usr/bin/env node
/**
 * Fail when a chained PR carries files from earlier slices in its diff.
 *
 * A native stack makes each PR show only its own layer because every child PR
 * targets the branch immediately below it. A hand-built chain points every PR
 * at main while branching from the previous head; the child PR then carries its
 * ancestors' files. This gate compares the PR diff with the diff against the
 * declared layer base ("Starts at" in Chain Context) and fails on the extra
 * files. #204-#213 and #244 are the incidents it exists to prevent.
 *
 * Usage:
 *   node scripts/check-stack-diff.mjs --base <ref> --head <ref>
 *
 * Environment:
 *   PR_BODY      PR body markdown, parsed for the Chain Context table
 *   PR_HEAD_REF  source branch name, used to detect -prN- chains
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STARTS_AT = 'Starts at';

/** @param {string} body */
export function parseChainContext(body) {
  const text = String(body ?? '');
  return { chain: readField(text, 'Chain'), startsAt: readField(text, STARTS_AT) };
}

/** @param {string} text @param {string} label */
function readField(text, label) {
  const match = new RegExp(`^\\|\\s*${label}\\s*\\|\\s*(.*?)\\s*\\|\\s*$`, 'im').exec(text);
  if (!match) return null;
  const value = match[1].replace(/^`|`$/g, '').trim();
  return value && !/^(none|n\/a|-)$/i.test(value) ? value : null;
}

/** @param {string} ref */
export function isChainBranch(ref) {
  return /-pr\d+(?:-|$)/.test(String(ref ?? ''));
}

/** @param {string[]} prFiles @param {string[]} ownFiles */
export function findInheritedFiles(prFiles, ownFiles) {
  const own = new Set(ownFiles);
  return prFiles.filter((file) => !own.has(file));
}

/** @param {string} ref */
function resolveRef(ref) {
  for (const candidate of [ref, `refs/remotes/origin/${ref}`]) {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`], {
        stdio: 'ignore',
      });
      return candidate;
    } catch {
      // Try the next spelling.
    }
  }
  throw new Error(`cannot resolve "${ref}" locally or on origin; fetch that branch first`);
}

/** @param {string} from @param {string} to */
function diffNames(from, to) {
  return execFileSync('git', ['diff', '--name-only', `${from}...${to}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

/** @param {string[]} argv @param {NodeJS.ProcessEnv} env */
export function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  if (!args.base) {
    console.error('check-stack-diff: --base <ref> is required');
    return 2;
  }

  const head = args.head ?? 'HEAD';
  const { chain, startsAt } = parseChainContext(String(env.PR_BODY ?? ''));

  if (!chain && !isChainBranch(String(env.PR_HEAD_REF ?? ''))) {
    console.log('check-stack-diff: not a chained PR; skipping.');
    return 0;
  }

  if (!startsAt) {
    console.error(
      `check-stack-diff: chained PR has no "${STARTS_AT}" field in Chain Context. ` +
        'Add the immediate parent branch there (`main` for the bottom slice) so the layer base can be verified.',
    );
    return 1;
  }

  let layerBase;
  try {
    layerBase = resolveRef(startsAt);
  } catch (error) {
    console.error(`check-stack-diff: ${String(error)}`);
    return 2;
  }

  let prFiles;
  let ownFiles;
  try {
    prFiles = diffNames(args.base, head);
    ownFiles = diffNames(layerBase, head);
  } catch {
    console.error(`check-stack-diff: could not diff ${args.base}...${head} against ${layerBase}`);
    return 2;
  }

  const inherited = findInheritedFiles(prFiles, ownFiles);
  if (inherited.length > 0) {
    console.error(
      `check-stack-diff: ${inherited.length} file(s) from earlier slices are in this PR's diff:`,
    );
    for (const file of inherited) console.error(`  ${file}`);
    console.error(
      `Declared layer base: ${startsAt}. Re-cut this slice onto that branch ` +
        '(cherry-pick or gh stack rebase); `git branch -f` is not enough.',
    );
    return 1;
  }

  console.log(`check-stack-diff: clean slice (${ownFiles.length} file(s) over ${startsAt}).`);
  return 0;
}

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

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = main();
}
