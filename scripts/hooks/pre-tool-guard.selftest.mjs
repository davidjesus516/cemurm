#!/usr/bin/env node
/**
 * Self-test for the PreToolUse guard.
 *
 * Run with: node scripts/hooks/pre-tool-guard.selftest.mjs
 *
 * Not a Vitest file on purpose: vitest.config.js only includes src/**\/*.test.js,
 * and widening it to cover scripts/ would pull the whole harness into the unit tier
 * for three files that spawn processes.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  judgeBash,
  judgeMigrationContent,
  judgePrSize,
  judgeWrite,
  mentionsPrCreate,
  parseNumstat,
  PR_LINE_BUDGET,
} from './rules.mjs';

const GUARD = fileURLToPath(new URL('./pre-tool-guard.mjs', import.meta.url));

let passed = 0;
const failures = [];

/**
 * @param {string} name
 * @param {() => boolean | string} check
 */
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

/** @param {string} command @returns {string | null} */
function bashRule(command) {
  return judgeBash(command)?.rule ?? null;
}

// --- destructive SQL ---------------------------------------------------------

assert('blocks DROP TABLE through psql', () =>
  bashRule('psql -U postgres -c "drop table songs"') === 'destructive-sql',
);

assert('blocks TRUNCATE through docker exec psql', () =>
  bashRule('docker exec -i supabase_db_cemurm psql -U postgres -c "truncate songs"') ===
  'destructive-sql',
);

assert('allows grepping for drop table', () =>
  bashRule('grep -rn "drop table" docs/') === null,
);

assert('allows writing drop table into a scratch file', () =>
  bashRule('echo "drop table songs" > /tmp/scratch.sql') === null,
);

assert('allows the smoke-test psql invocation', () =>
  bashRule(
    'docker exec -i supabase_db_cemurm psql -U postgres -d postgres -X -f - < scripts/smoke/0028-import-integrations.sql',
  ) === null,
);

// --- supabase ----------------------------------------------------------------

assert('blocks supabase db push', () => bashRule('supabase db push') === 'supabase-db-push');

assert('blocks supabase link', () =>
  bashRule('supabase link --project-ref abcdef') === 'supabase-link',
);

assert('allows supabase db reset (the smoke tests require it)', () =>
  bashRule('supabase db reset') === null,
);

// --- working tree ------------------------------------------------------------

assert('blocks git clean -xdf', () => bashRule('git clean -xdf') === 'git-clean');

assert('blocks rm -rf on the repo root', () => bashRule('rm -rf .') === 'recursive-rm');

assert('blocks sudo rm -rf on the repo root', () => bashRule('sudo rm -rf .') === 'recursive-rm');

assert('does not block a commit message that quotes a dangerous command', () =>
  bashRule('git commit -m "docs: rm -rf . is forbidden"') === null,
);

assert('does not block grepping for a forbidden command', () =>
  bashRule('grep -rn "supabase db push" docs/') === null,
);

assert('blocks rm -rf on the migrations', () =>
  bashRule('rm -rf supabase/migrations') === 'recursive-rm',
);

assert('allows rm -rf on node_modules', () => bashRule('rm -rf node_modules') === null);

assert('allows rm -rf inside a scratch dir', () =>
  bashRule('rm -rf /tmp/opencode/scratch') === null,
);

assert('allows ordinary commands', () => bashRule('pnpm test && pnpm lint') === null);

// --- shell indirection -------------------------------------------------------
// A wrapper or a quote is how a shell defers a command, not a different policy.
// The rule has to look one level in, or it only blocks the spelling its own
// tests use.

assert('blocks supabase db push behind bash -lc', () =>
  bashRule("bash -lc 'supabase db push'") === 'supabase-db-push',
);

assert('blocks supabase db push behind an inline assignment', () =>
  bashRule('FOO=1 supabase db push') === 'supabase-db-push',
);

assert('blocks supabase db push inside a subshell', () =>
  bashRule('(supabase db push)') === 'supabase-db-push',
);

assert('blocks a path-qualified supabase link', () =>
  bashRule('./supabase link --project-ref abcdef') === 'supabase-link',
);

assert('blocks destructive SQL behind sh -c', () =>
  bashRule(`sh -c 'psql -c "drop table songs"'`) === 'destructive-sql',
);

assert('blocks git clean -f behind sudo', () =>
  bashRule('sudo git clean -xdf') === 'git-clean',
);

assert('allows a wrapped command that breaks no rule', () =>
  bashRule("bash -lc 'pnpm test'") === null,
);

// Recursion has to survive the quoting style, not just the single-quoted one.
// Escaped double quotes are how a nested `bash -c` is written inside another.
assert('blocks git clean -f behind two layers of bash -c', () =>
  bashRule('bash -c "bash -c \\"git clean -xdf\\""') === 'git-clean',
);

assert('blocks supabase db push behind two layers of bash -c', () =>
  bashRule('bash -lc "bash -lc \'supabase db push\'"') === 'supabase-db-push',
);

// --- delete target spellings -------------------------------------------------
// The same directory written three ways is still the same directory.

assert('blocks rm -rf on a dot-prefixed migrations path', () =>
  bashRule('rm -rf ./supabase/migrations') === 'recursive-rm',
);

assert('blocks rm -rf on the migrations with a trailing slash', () =>
  bashRule('rm -rf supabase/migrations/') === 'recursive-rm',
);

assert('blocks rm -rf on a dot-prefixed .git', () =>
  bashRule('rm -rf ./.git') === 'recursive-rm',
);

assert('blocks rm -rf on an absolute path into the migrations', () =>
  bashRule('rm -rf /home/dev/cemurm/supabase/migrations') === 'recursive-rm',
);

assert('still allows rm -rf on an unrelated absolute directory', () =>
  bashRule('rm -rf /home/dev/cemurm/dist') === null,
);

assert('blocks an interior dot-segment path into the migrations', () =>
  bashRule('rm -rf supabase/./migrations') === 'recursive-rm',
);

assert('blocks a trailing dot-segment path into the migrations', () =>
  bashRule('rm -rf supabase/migrations/.') === 'recursive-rm',
);

assert('allows a recursive delete of build output however spelled', () =>
  [
    'rm -rf dist',
    'rm -rf ./dist',
    'rm -rf dist/',
    'rm -rf ./dist/',
    'rm -rf dist/assets',
    'rm -rf node_modules',
    'rm -rf ./node_modules',
    'rm -rf /tmp/scratch-1234',
    'rm -rf ../tmp-build',
  ].every((command) => bashRule(command) === null),
);

// --- migrations --------------------------------------------------------------

assert('blocks DROP TABLE written into a migration', () =>
  judgeWrite({
    file_path: 'supabase/migrations/0046_cleanup.sql',
    content: 'drop table songs;',
  })?.rule === 'destructive-migration',
);

assert('blocks TRUNCATE written into a migration', () =>
  judgeWrite({
    file_path: 'supabase/migrations/0046_cleanup.sql',
    content: 'truncate songs;',
  })?.rule === 'destructive-migration',
);

assert('allows a migration that declares destructive-ok', () =>
  judgeWrite({
    file_path: 'supabase/migrations/0046_cleanup.sql',
    content: '-- destructive-ok: fixture rows only, rebuilt by the seed\ndrop table songs;',
  }) === null,
);

assert('allows a non-destructive migration', () =>
  judgeWrite({
    file_path: 'supabase/migrations/0046_cleanup.sql',
    content: 'alter table songs add column key_signature text;',
  }) === null,
);

assert('allows dropping a column anywhere', () =>
  judgeWrite({
    file_path: 'supabase/migrations/0046_cleanup.sql',
    content: 'alter table songs drop column legacy_flag;',
  }) === null,
);

assert('ignores non-migration files', () =>
  judgeWrite({ file_path: 'src/domain/music/transpose.js', content: '// drop table' }) === null,
);

// --- migration content rule (shared with CI) ---------------------------------
// judgeWrite is a thin wrapper over judgeMigrationContent; CI scans files with
// the same function, so these cases pin the rule both surfaces enforce.

assert('judgeMigrationContent blocks DROP TABLE', () =>
  judgeMigrationContent('supabase/migrations/0046_cleanup.sql', 'drop table songs;')
    ?.rule === 'destructive-migration',
);

assert('judgeMigrationContent blocks TRUNCATE', () =>
  judgeMigrationContent('supabase/migrations/0046_cleanup.sql', 'truncate songs;')
    ?.rule === 'destructive-migration',
);

assert('judgeMigrationContent allows the destructive-ok marker', () =>
  judgeMigrationContent(
    'supabase/migrations/0046_cleanup.sql',
    '-- destructive-ok: fixture rows only, rebuilt by the seed\ndrop table songs;',
  ) === null,
);

assert('judgeMigrationContent allows DROP COLUMN', () =>
  judgeMigrationContent(
    'supabase/migrations/0046_cleanup.sql',
    'alter table songs drop column legacy_flag;',
  ) === null,
);

assert('judgeMigrationContent ignores non-migration paths', () =>
  judgeMigrationContent('docs/sql-notes.md', 'drop table songs;') === null,
);

// Comments are prose, not statements. `0046` revokes a grant and then explains
// that the revoked privilege list includes TRUNCATE; the raw scan read that
// sentence as data loss and failed CI on a migration that destroys nothing.
assert('judgeMigrationContent ignores a line comment that mentions TRUNCATE', () =>
  judgeMigrationContent(
    'supabase/migrations/0046_cleanup.sql',
    '-- the residual grant includes TRUNCATE, which RLS does not cover\ngrant select on table songs to authenticated;',
  ) === null,
);

assert('judgeMigrationContent ignores a block comment that mentions DROP TABLE', () =>
  judgeMigrationContent(
    'supabase/migrations/0046_cleanup.sql',
    '/* this used to run drop table songs; it no longer does */\nalter table songs add column title text;',
  ) === null,
);

assert('judgeMigrationContent ignores a comment inside a nested block comment', () =>
  judgeMigrationContent(
    'supabase/migrations/0046_cleanup.sql',
    '/* outer /* inner truncate songs; */ still a comment */\nselect 1;',
  ) === null,
);

// The strip must not become a bypass: anything the database would execute still
// counts, including a `--` that is really part of a string literal, and SQL
// assembled inside a dollar-quoted body.
assert('judgeMigrationContent still blocks DROP TABLE after a string containing --', () =>
  judgeMigrationContent(
    'supabase/migrations/0046_cleanup.sql',
    "select 'a--b'; drop table songs;",
  )?.rule === 'destructive-migration',
);

assert('judgeMigrationContent still blocks SQL inside a dollar-quoted body', () =>
  judgeMigrationContent(
    'supabase/migrations/0046_cleanup.sql',
    'do $body$ begin execute $q$ truncate songs $q$; end $body$;',
  )?.rule === 'destructive-migration',
);

assert('judgeMigrationContent still blocks DROP TABLE on the line after a string with a quote escape', () =>
  judgeMigrationContent(
    'supabase/migrations/0046_cleanup.sql',
    "select 'it''s fine';\ndrop table songs;",
  )?.rule === 'destructive-migration',
);

assert('judgeMigrationContent still blocks when only the comment is destructive-looking', () =>
  judgeMigrationContent(
    'supabase/migrations/0046_cleanup.sql',
    '-- nothing here\ndrop schema private cascade;',
  )?.rule === 'destructive-migration',
);

/** Spawn the CI check from `cwd` and return its exit status. */
const CHECK = fileURLToPath(new URL('../check-migrations-destructive.mjs', import.meta.url));

/**
 * @param {string} cwd
 * @returns {number}
 */
function runCheck(cwd) {
  try {
    execFileSync('node', [CHECK], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return 0;
  } catch (error) {
    return error.status ?? -1;
  }
}

/** @param {string} name @param {string} content @returns {string} scratch dir to remove */
function scratchMigration(name, content) {
  const dir = mkdtempSync(join(tmpdir(), 'cemurm-mig-check-'));
  mkdirSync(join(dir, 'supabase/migrations'), { recursive: true });
  writeFileSync(join(dir, 'supabase/migrations', name), content);
  return dir;
}

assert('ci check exits 0 on a clean migration tree', () => {
  const dir = scratchMigration('0001_t.sql', 'create table songs ();\n');
  try {
    return runCheck(dir) === 0 ? true : 'expected exit 0';
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

assert('ci check exits 1 on destructive SQL without the marker', () => {
  const dir = scratchMigration('0001_bad.sql', 'drop table songs;\n');
  try {
    return runCheck(dir) === 1 ? true : 'expected exit 1';
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

assert('ci check honors the destructive-ok marker', () => {
  const dir = scratchMigration('0001_ok.sql', '-- destructive-ok: fixture only\ndrop table temp_fixture;\n');
  try {
    return runCheck(dir) === 0 ? true : 'expected exit 0';
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A gate that cannot see its input is not green. Reporting "0 files scanned"
// and exiting 0 is the failure mode this repository rewrote other gates to avoid.
assert('ci check exits non-zero when the migrations directory is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cemurm-mig-missing-'));
  try {
    return runCheck(dir) !== 0 ? true : 'expected a non-zero exit, got 0';
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- PR size -----------------------------------------------------------------

const NUMSTAT = [
  '120\t40\tdocs/uml/build-all.sh',
  '300\t250\tsrc/features/stage/pages/StageMode.jsx',
  '14909\t0\tdocs/uml/uc-04-alcance-institucional.html',
  '-\t-\tpublic/icon-512.png',
  '50\t0\tpnpm-lock.yaml',
].join('\n');

assert('excludes generated artifacts and binaries from the authored count', () => {
  const { authored, excluded } = parseNumstat(NUMSTAT);
  const total = authored.reduce((sum, file) => sum + file.lines, 0);
  if (total !== 710) return `expected 710 authored lines, got ${total}`;
  if (excluded.length !== 3) return `expected 3 excluded entries, got ${excluded.length}`;
  return true;
});

assert('blocks a PR over the budget', () => {
  const size = judgePrSize('gh pr create --base main', NUMSTAT);
  if (!size) return 'expected a block';
  if (size.total !== 710) return `expected 710, got ${size.total}`;
  return true;
});

assert(`allows a PR at exactly ${PR_LINE_BUDGET} lines`, () =>
  judgePrSize('gh pr create', `400\t0\tsrc/x.js`) === null,
);

assert('allows the documented size:exception escape hatch', () =>
  judgePrSize('gh pr create --label size:exception', NUMSTAT) === null,
);

assert('ignores a PR whose authored content fits the budget', () =>
  judgePrSize('gh pr create', '100\t20\tsrc/x.js\n14909\t0\tdocs/uml/x.html') === null,
);

assert('detects gh pr create at a command boundary', () =>
  mentionsPrCreate('git checkout -b x && gh pr create --base main') &&
  mentionsPrCreate('gh pr create --title "x"') &&
  !mentionsPrCreate('echo "gh pr create" >> notes.md'),
);

// --- end to end --------------------------------------------------------------

assert('exit 2 and a reason on a blocked command', () => {
  const { status, stderr } = runGuard({ tool_name: 'Bash', tool_input: { command: 'rm -rf .' } });
  if (status !== 2) return `expected exit 2, got ${status}`;
  if (!stderr.includes('recursive delete')) return `unexpected stderr: ${stderr.slice(0, 120)}`;
  return true;
});

assert('exit 0 on an allowed command', () => {
  const { status } = runGuard({ tool_name: 'Bash', tool_input: { command: 'pnpm test' } });
  return status === 0 ? true : `expected exit 0, got ${status}`;
});

assert('exit 0 when the payload is not JSON', () => {
  try {
    execFileSync('node', [GUARD], { input: 'not json', encoding: 'utf8', stdio: 'pipe' });
    return true;
  } catch (error) {
    return `expected exit 0, got ${error.status}`;
  }
});

// A `gh pr create` on the same line used to route the whole command to the size
// verdict and skip judgeBash, so a blocked operation rode through next to it.
assert('still blocks a forbidden command that shares a line with gh pr create', () => {
  const { status, stderr } = runGuard({
    tool_name: 'Bash',
    // `size:exception` clears the size verdict, so only judgeBash can block here.
    tool_input: { command: 'rm -rf . && gh pr create --base main --label size:exception' },
  });
  if (status !== 2) return `expected exit 2, got ${status}`;
  if (!stderr.includes('recursive delete')) return `unexpected stderr: ${stderr.slice(0, 120)}`;
  return true;
});

/** @param {Record<string, unknown>} payload */
function runGuard(payload) {
  try {
    execFileSync('node', [GUARD], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { status: 0, stderr: '' };
  } catch (error) {
    return { status: error.status ?? -1, stderr: String(error.stderr ?? '') };
  }
}

// --- opencode adapter --------------------------------------------------------
// Same policy, second runtime. Both adapters read scripts/hooks/rules.mjs, so a
// drift here means an adapter is broken, not that the policy differs.

{
  let hook;
  const plugin = (await import('../../.opencode/plugins/cemurm-guard/index.js')).default;

  await plugin.setup({
    location: { directory: process.cwd() },
    permission: {
      hook: async (_name, callback) => {
        hook = callback;
        return { dispose() {} };
      },
    },
  });

  const cases = [
    ['psql -U postgres -c "drop table songs"', 'deny'],
    ['docker exec -i supabase_db_cemurm psql -c "truncate songs"', 'deny'],
    ['rm -rf .', 'deny'],
    [`supabase db ${'push'}`, 'deny'],
    ['supabase link --project-ref abc', 'deny'],
    ['git clean -xdf', 'deny'],
    // No `gh pr create` deny case here: it depends on how much the current branch
    // holds against a real base, so it would pass locally and fail on a shallow CI
    // checkout. The PR-size verdict itself is covered by the parseNumstat/judgePrSize
    // cases above, and the CLI is exercised by .github/workflows/pr-size.yml.
    ['supabase db reset', 'allow'],
    ['pnpm test', 'allow'],
    ['grep -rn "drop table" docs/', 'allow'],
    ['git commit -m "docs: rm -rf is forbidden"', 'allow'],
    ['gh pr create --base main --label size:exception --title x', 'allow'],
    // The size verdict supplements the bash rules, it does not replace them.
    // `size:exception` clears the size verdict on purpose, so a deny here can
    // only come from judgeBash still having run.
    ['rm -rf . && gh pr create --base main --label size:exception', 'deny'],
    [`supabase db ${'push'} && gh pr create --base main --label size:exception`, 'deny'],
  ];

  for (const [command, expected] of cases) {
    assert(`opencode adapter: ${expected} ${command}`, () => {
      const event = { action: 'shell', resources: [command], effect: 'allow' };
      hook(event);
      const actual = event.effect === 'deny' ? 'deny' : 'allow';
      return actual === expected ? true : `expected ${expected}, got ${actual}`;
    });
  }
}

// --- report ------------------------------------------------------------------

if (failures.length === 0) {
  console.log(`${passed} checks passed.`);
  process.exit(0);
}

console.error(`${passed} passed, ${failures.length} failed:\n`);
for (const failure of failures) console.error(`  ✗ ${failure}\n`);
process.exit(1);
