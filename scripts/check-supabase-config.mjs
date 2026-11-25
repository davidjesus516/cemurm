#!/usr/bin/env node
/**
 * Fail when `supabase/config.toml` carries a key the pinned Supabase CLI does
 * not recognise, has removed, or has deprecated.
 *
 * Two layers, because neither is enough on its own:
 *
 *   1. `supabase config validate` — the CLI's own parser. It exits 1 on syntax
 *      errors, unknown keys and removed keys, and prints the line. A
 *      *deprecation* is only a warning and it still exits 0, so this gate treats
 *      any warning as a failure too. Otherwise the next renumbering or bump
 *      walks straight past the message that already warned about it.
 *
 *   2. A key-set diff against the template `supabase init` generates with the
 *      same binary. Layer 1 is blind to a removed key whose value is empty:
 *      `[experimental] orioledb_version = ""` validated as "valid · 0 warnings"
 *      on 2026-11-25, because the decoder skips an empty value before it can
 *      complain. That is exactly the key that hid while the v4 config change was
 *      written, and no amount of reading `status` output finds it.
 *
 * `[functions.<name>]` is allowed: function names are per project, so no
 * template can list them. Everything else has to be a key the CLI knows.
 *
 * Usage: node scripts/check-supabase-config.mjs [--dir <project root>] [--cli <path>]
 *
 * Exit codes: 0 clean, 1 findings, 2 could not run (missing CLI, missing config,
 * unreadable template). A gate that cannot see its input must not be green.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CONFIG_REL = join('supabase', 'config.toml');

// Noop noise from the CLI's own update check. It goes to stderr on every
// invocation and says nothing about this project's config.
const NOISE = /new version of Supabase CLI|recommend updating regularly/i;

// What counts as a finding in validate's output. `✓ … is valid · 2 warnings`
// matches on "warnings", so a run can never be green with a warning in it.
const PROBLEM = /⚠|✗|\bdeprecated\b|\bunknown\b|\bremoved\b|\bwarning\b/i;

const SECTION = /^\s*\[\[?([^\]]+)\]\]?\s*$/;
const KEY = /^\s*("?[A-Za-z0-9_.-]+"?)\s*=/;

function stop(message, code) {
  process.stderr.write(`check-supabase-config: ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const options = {
    dir: REPO_ROOT,
    cli: join(REPO_ROOT, 'node_modules', '.bin', 'supabase'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--help' || flag === '-h') {
      process.stdout.write(
        'Usage: node scripts/check-supabase-config.mjs [--dir <project root>] [--cli <path>]\n',
      );
      process.exit(0);
    }
    if (flag !== '--dir' && flag !== '--cli') {
      stop(`unknown argument ${flag}`, 2);
    }
    const value = argv[index + 1];
    if (!value) stop(`missing value for ${flag}`, 2);
    options[flag.slice(2)] = resolve(value);
    index += 1;
  }

  return options;
}

/**
 * Section and key names with their line numbers. Values are irrelevant here:
 * the comparison is structural, so an empty value counts exactly like a set one.
 *
 * @param {string} text
 * @returns {Map<string, Map<string, number>>}
 */
function parseKeys(text) {
  const sections = new Map();
  let section = '';

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const header = SECTION.exec(line);
    if (header) {
      section = header[1].trim();
      continue;
    }

    const key = KEY.exec(line);
    if (!key) continue;

    if (!sections.has(section)) sections.set(section, new Map());
    sections.get(section).set(key[1].replace(/^"|"$/g, ''), index + 1);
  }

  return sections;
}

function isPerFunctionSection(section) {
  return section === 'functions' || section.startsWith('functions.');
}

/**
 * @param {Map<string, Map<string, number>>} repo
 * @param {Map<string, Map<string, number>>} template
 * @returns {{ section: string, key: string, line: number }[]}
 */
function findUnknownKeys(repo, template) {
  const findings = [];

  for (const [section, keys] of repo) {
    if (isPerFunctionSection(section)) continue;
    const known = template.get(section);
    for (const [key, line] of keys) {
      if (known && known.has(key)) continue;
      findings.push({ section, key, line });
    }
  }

  return findings.sort((a, b) => a.line - b.line);
}

function run(cli, args, options = {}) {
  const result = spawnSync(cli, args, { encoding: 'utf8', ...options });
  if (result.error) {
    stop(
      `cannot run ${cli}: ${result.error.message}\n` +
        'Run `pnpm install` so node_modules/.bin/supabase exists.',
      2,
    );
  }
  return result;
}

function withoutNoise(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !NOISE.test(line))
    .join('\n')
    .trim();
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const configPath = join(options.dir, CONFIG_REL);

  let configText;
  try {
    configText = readFileSync(configPath, 'utf8');
  } catch (error) {
    stop(`cannot read ${configPath}: ${String(error)}`, 2);
  }

  const version = withoutNoise(run(options.cli, ['--version']).stdout || '') || 'unknown';

  // Layer 1: the CLI's own verdict.
  const validation = run(options.cli, ['config', 'validate', '--workdir', options.dir]);
  const validationOutput = withoutNoise(`${validation.stdout || ''}${validation.stderr || ''}`);
  const problems = validationOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => PROBLEM.test(line));

  if (validation.status === 0 && problems.length === 0 && !/is valid/u.test(validationOutput)) {
    stop(
      `cannot interpret \`config validate\` output (exit 0, no verdict):\n${validationOutput}`,
      2,
    );
  }

  // Layer 2: the template for the same binary. Generated in a scratch directory
  // rather than committed, so it cannot drift from the CLI the lockfile pins.
  const scratch = mkdtempSync(join(tmpdir(), 'cemurm-supabase-config-'));
  let templateText;
  try {
    const init = run(options.cli, ['init'], { cwd: scratch });
    if (init.status !== 0) {
      stop(
        `\`supabase init\` failed in ${scratch}; cannot build the ${version} template:\n` +
          withoutNoise(`${init.stdout || ''}${init.stderr || ''}`),
        2,
      );
    }
    templateText = readFileSync(join(scratch, 'supabase', 'config.toml'), 'utf8');
  } catch (error) {
    stop(`cannot read the generated ${version} template: ${String(error)}`, 2);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  const repo = parseKeys(configText);
  const unknown = findUnknownKeys(repo, parseKeys(templateText));
  const keyCount = [...repo.values()].reduce((total, keys) => total + keys.size, 0);

  if (problems.length === 0 && unknown.length === 0) {
    process.stdout.write(
      `supabase config: OK (${keyCount} keys, all known to the ${version} template, 0 warnings)\n`,
    );
    return;
  }

  if (problems.length > 0) {
    console.error(`supabase/config.toml: \`config validate\` is not clean with CLI ${version}:`);
    console.error(validationOutput);
  }

  for (const { section, key, line } of unknown) {
    const where = section ? `[${section}] ` : '';
    console.error(
      `supabase/config.toml:${line}: ${where}${key} is not in the ${version} template ` +
        '(unknown, removed, or silently ignored)',
    );
  }

  console.error(
    '\nFix the key, or move it to the section the CLI reads it from. ' +
      'Regenerate the reference with `supabase init` in an empty directory.',
  );
  process.exit(1);
}

main();
