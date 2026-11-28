#!/usr/bin/env node
/**
 * Self-test for the supabase/config.toml gate.
 *
 * The gate's only value is that it fails, and three of the four config cases
 * below exit 0 under `supabase config validate` on its own: a deprecation is a
 * warning, and a removed key with an empty value is not even that. A gate that
 * quietly passed them would look exactly like a working one, so each one is
 * asserted here against the real binary.
 *
 * Run with: node scripts/check-supabase-config.selftest.mjs [--cli <path>]
 *
 * Not a Vitest file on purpose: vitest.config.js only includes src/**\/*.test.js.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GATE = join(REPO_ROOT, 'scripts', 'check-supabase-config.mjs');
const REPO_CONFIG = readFileSync(join(REPO_ROOT, 'supabase', 'config.toml'), 'utf8');

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

function parseArgs(argv) {
  const cliIndex = argv.indexOf('--cli');
  return cliIndex === -1 ? {} : { cli: resolve(argv[cliIndex + 1]) };
}

const { cli } = parseArgs(process.argv.slice(2));
const scratch = mkdtempSync(join(tmpdir(), 'cemurm-supabase-config-selftest-'));

/**
 * A project directory holding the repository config with `mutations` applied.
 *
 * @param {string} name
 * @param {[string, string][]} mutations
 */
function fixture(name, mutations) {
  const dir = join(scratch, name);
  mkdirSync(join(dir, 'supabase'), { recursive: true });

  let text = REPO_CONFIG;
  for (const [from, to] of mutations) {
    if (!text.includes(from)) {
      throw new Error(`${name}: fixture anchor not found: ${from.split('\n')[0]}`);
    }
    text = text.replace(from, to);
  }

  writeFileSync(join(dir, 'supabase', 'config.toml'), text);
  return dir;
}

/** @param {string[]} args */
function runGate(args) {
  const cliArgs = cli ? ['--cli', cli] : [];
  return spawnSync(process.execPath, [GATE, ...args, ...cliArgs], { encoding: 'utf8' });
}

const CLEAN = fixture('clean', []);

const DEPRECATED = fixture('deprecated', [
  [
    '# Allow/disallow new user signups via email to your project.\nenabled = true',
    '# Allow/disallow new user signups via email to your project.\nenabled = true\nenable_signup = true',
  ],
]);

const UNKNOWN = fixture('unknown', [['orioledb_version = ""', 'orioledb_version = ""\nbogus_key = "x"']]);

// The case that motivated the key-set layer: the CLI calls this file valid.
const EMPTY_REMOVED = fixture('empty-removed', [
  [
    '# OrioleDB version to use as the Postgres storage engine. Leave empty to use the default engine.\norioledb_version = ""\n',
    '',
  ],
  ['[experimental]\n', '[experimental]\norioledb_version = ""\n'],
]);

const EMPTY_DIR = join(scratch, 'empty-project');
mkdirSync(EMPTY_DIR, { recursive: true });

try {
  assert('passes on the repository config', () => {
    const result = runGate(['--dir', CLEAN]);
    return (
      (result.status === 0 && result.stdout.includes('supabase config: OK')) ||
      `exit ${result.status}: ${result.stdout}${result.stderr}`
    );
  });

  assert('fails on a deprecated key that `config validate` only warns about', () => {
    const result = runGate(['--dir', DEPRECATED]);
    return (
      (result.status === 1 &&
        result.stderr.includes('deprecated') &&
        result.stderr.includes('auth.email.enable_signup')) ||
      `exit ${result.status}: ${result.stderr}`
    );
  });

  assert('fails on a key the CLI does not know', () => {
    const result = runGate(['--dir', UNKNOWN]);
    return (
      (result.status === 1 && result.stderr.includes('bogus_key')) || `exit ${result.status}: ${result.stderr}`
    );
  });

  assert('fails on a removed key whose empty value the CLI silently ignores', () => {
    const result = runGate(['--dir', EMPTY_REMOVED]);
    return (
      (result.status === 1 &&
        result.stderr.includes('orioledb_version') &&
        // Layer 1 must not have been the one to catch it: no validate block.
        !result.stderr.includes('`config validate` is not clean')) ||
      `exit ${result.status}: ${result.stderr}`
    );
  });

  assert('exits 2 when the CLI cannot be run', () => {
    const result = spawnSync(
      process.execPath,
      [GATE, '--dir', CLEAN, '--cli', join(scratch, 'no-such-supabase')],
      { encoding: 'utf8' },
    );
    return (
      (result.status === 2 && result.stderr.includes('cannot run')) || `exit ${result.status}: ${result.stderr}`
    );
  });

  assert('exits 2 when the config is missing', () => {
    const result = runGate(['--dir', EMPTY_DIR]);
    return (
      (result.status === 2 && result.stderr.includes('config.toml')) || `exit ${result.status}: ${result.stderr}`
    );
  });
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`check-supabase-config selftest: ${passed} passed, ${failures.length} FAILED`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`check-supabase-config selftest: ${passed} passed`);
}
