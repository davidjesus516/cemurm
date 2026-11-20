#!/usr/bin/env node
/**
 * Self-test for the stacked-slice diff gate.
 *
 * Run with: node scripts/check-stack-diff.selftest.mjs
 *
 * Not a Vitest file on purpose: vitest.config.js only includes src/**\/*.test.js.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findInheritedFiles, isChainBranch, parseChainContext } from './check-stack-diff.mjs';

const GATE = fileURLToPath(new URL('./check-stack-diff.mjs', import.meta.url));

let passed = 0;
const failures = [];

/** @param {string} name @param {() => boolean | string} check */
function assert(name, check) {
  let result;
  try {
    result = check();
  } catch (error) {
    result = `threw ${String(error)}`;
  }

  if (result === true) {
    passed += 1;
    return;
  }

  failures.push(`${name}${typeof result === 'string' ? `\n    ${result}` : ''}`);
}

const BODY = [
  '## Chain Context',
  '',
  '| Field | Value |',
  '|-------|-------|',
  '| Chain | f1-membership |',
  '| Position | 2 of 3 |',
  '| Base | `feat/f1-pr1-migration` |',
  '| Starts at | `feat/f1-pr1-migration` |',
  '',
  '## Checklist',
].join('\n');

assert('parses Chain and Starts at from a markdown table', () => {
  const ctx = parseChainContext(BODY);
  return ctx.chain === 'f1-membership' && ctx.startsAt === 'feat/f1-pr1-migration';
});

assert('treats None, N/A and a missing field as absent', () =>
  ['| Starts at | None |', '| Starts at | `N/A` |', ''].every(
    (line) => parseChainContext(`| Chain | f1 |\n${line}`).startsAt === null,
  ));

assert('ignores a similarly named field', () =>
  parseChainContext('| Starts at something | `main` |').startsAt === null);

assert('recognises a -prN- branch and ignores a standalone one', () =>
  isChainBranch('feat/f1-pr2-repository') === true &&
  isChainBranch('feat/deps-minor-update') === false);

assert('finds files inherited from lower slices', () => {
  const inherited = findInheritedFiles(['a.js', 'b.js', 'c.js'], ['b.js', 'c.js']);
  return inherited.length === 1 && inherited[0] === 'a.js';
});

assert('reports a clean slice as empty', () =>
  findInheritedFiles(['b.js'], ['b.js']).length === 0);

// End-to-end: two slices cut the broken way (both PRs based on main) and the
// native way (child PR based on the parent branch). Only the first must fail.
const CHAIN_BODY = [
  '| Field | Value |',
  '|-------|-------|',
  '| Chain | foo |',
  '| Starts at | `feat/foo-pr1` |',
].join('\n');

const scratch = mkdtempSync(join(tmpdir(), 'cemurm-stack-gate-'));
try {
  /** @param {...string} args */
  const git = (...args) =>
    execFileSync('git', args, { cwd: scratch, encoding: 'utf8', stdio: 'pipe' });

  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'gate@example.invalid');
  git('config', 'user.name', 'Gate Test');
  writeFileSync(join(scratch, 'base.txt'), 'base\n');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  const mainSha = git('rev-parse', 'HEAD').trim();

  git('checkout', '-q', '-b', 'feat/foo-pr1');
  writeFileSync(join(scratch, 'p1.txt'), 'layer 1\n');
  git('add', '.');
  git('commit', '-q', '-m', 'p1');
  const p1Sha = git('rev-parse', 'HEAD').trim();

  git('checkout', '-q', '-b', 'feat/foo-pr2');
  writeFileSync(join(scratch, 'p2.txt'), 'layer 2\n');
  git('add', '.');
  git('commit', '-q', '-m', 'p2');
  const p2Sha = git('rev-parse', 'HEAD').trim();

  /**
   * @param {string[]} args
   * @param {{ body?: string, headRef?: string }} [env]
   */
  const runRaw = (args, env = {}) =>
    spawnSync(process.execPath, [GATE, ...args], {
      cwd: scratch,
      encoding: 'utf8',
      env: {
        ...process.env,
        PR_BODY: env.body ?? CHAIN_BODY,
        PR_HEAD_REF: env.headRef ?? 'feat/foo-pr2',
      },
    });

  /** @param {string} base @param {string} [body] */
  const run = (base, body = CHAIN_BODY) =>
    runRaw(['--base', base, '--head', p2Sha], { body });

  assert('fails when the PR base is main but the slice starts on PR1', () => {
    const result = run(mainSha);
    return result.status === 1 && result.stderr.includes('p1.txt');
  });

  assert('passes when the PR base is the declared parent branch', () => {
    const result = run(p1Sha);
    return result.status === 0 && result.stdout.includes('clean slice');
  });

  assert('fails when a chained PR omits Starts at', () => {
    const result = run(p1Sha, '| Chain | f1 |');
    return result.status === 1 && result.stderr.includes('Starts at');
  });

  assert('skips an unresolvable parent ref instead of failing CI', () => {
    const result = runRaw(['--base', mainSha, '--head', p2Sha], {
      body: '| Chain | foo |\n| Starts at | `gone-branch` |',
    });
    return result.status === 0 && result.stdout.includes('not available');
  });

  assert('skips a standalone PR with no chain context', () => {
    const result = runRaw(['--base', mainSha, '--head', p2Sha], {
      body: '## What changed\nsomething',
      headRef: 'feat/deps-minor-update',
    });
    return result.status === 0 && result.stdout.includes('not a chained PR');
  });

  assert('requires --base', () => {
    const result = runRaw(['--head', p2Sha]);
    return result.status === 2 && result.stderr.includes('--base');
  });
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`check-stack-diff selftest: ${passed} passed, ${failures.length} FAILED`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`check-stack-diff selftest: ${passed} passed`);
}
