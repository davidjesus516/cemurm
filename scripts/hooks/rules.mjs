/**
 * Pure decision rules for the agent PreToolUse guard.
 *
 * No I/O, no side effects: every function takes plain data and returns a verdict,
 * so the rules can be exercised without spawning an agent session.
 */

/** Authored changed-line budget per PR (`docs/master-plan.md:7`). */
export const PR_LINE_BUDGET = 400;

/**
 * Generated artifacts. They inflate a diff without asking anyone to review prose,
 * so they never count against the budget. Precedent: PR #425 measured 30,995 lines
 * of diff and 1,128 authored, the rest being two archify viewers.
 */
const GENERATED_PATHS = [
  /^docs\/uml\/[^/]+\.html$/,
  /^docs\/uml\/[^/]+\.svg$/,
  /^docs\/er-diagram\.html$/,
  /^pnpm-lock\.yaml$/,
  /^dist\//,
  /^stack-diagram-output\//,
];

/** SQL that destroys data rather than reshaping it. */
const SQL_DESTRUCTIVE = /\b(?:drop\s+(?:table|schema|database|extension)|truncate)\b/i;

/** Commands that actually execute SQL (grep over a .sql file is not one of them). */
const SQL_EXECUTION = /(?:^|[\s;&|(])psql\b|docker\s+exec\b[^\n]*\bpsql\b/i;

/** Targets where a recursive delete is never a normal operation. */
const DANGEROUS_RM_TARGETS = new Set([
  '.',
  './',
  '..',
  '../',
  '*',
  './*',
  '/',
  '/*',
  '$PWD',
  '${PWD}',
  '.git',
  'supabase',
  'supabase/migrations',
  'supabase/seed.sql',
]);

const MIGRATION_PATH = /(?:^|\/)supabase\/migrations\/[^/]+\.sql$/;

/**
 * Detect a `gh pr create` invocation at a command boundary.
 *
 * Kept separate from {@link judgeBash} because the PR verdict needs git, while
 * every other rule is pure data.
 *
 * @param {string} command
 * @returns {boolean}
 */
export function mentionsPrCreate(command) {
  if (typeof command !== 'string') return false;
  return command
    .split(/\n|&&|\|\||;/)
    .map((segment) => segment.trim())
    .some((segment) => /^gh\s+pr\s+create\b/.test(segment));
}

/**
 * Decide whether a Bash command must be blocked.
 *
 * @param {string} command
 * @returns {{ rule: string, reason: string } | null} null means "no objection".
 */
export function judgeBash(command) {
  if (typeof command !== 'string' || !command.trim()) return null;

  const flat = command.replace(/\s+/g, ' ').trim();
  const segments = command
    .split(/\n|&&|\|\||;/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  // Rules 1-3 match at command position, not anywhere in the string: a `grep`
  // for "supabase db push" is reading, not pushing.
  const startsWith = (pattern) => segments.some((segment) => pattern.test(segment));

  if (segments.some((segment) => SQL_EXECUTION.test(segment) && SQL_DESTRUCTIVE.test(segment))) {
    return {
      rule: 'destructive-sql',
      reason: [
        'Blocked: destructive SQL through a live client.',
        '',
        `  command: ${truncate(flat, 160)}`,
        '',
        'DROP and TRUNCATE erase rows with no undo. The migrations in',
        'supabase/migrations/ are the source of truth, and `supabase db reset`',
        'rebuilds the database from them — deleting data ad hoc only removes the',
        'evidence you would need to rebuild it.',
        '',
        'Rewrite it as a migration (and read the migration rule below) or run the',
        'statement against a scratch database you recreated on purpose.',
      ].join('\n'),
    };
  }

  if (startsWith(/^supabase\s+db\s+push\b/)) {
    return {
      rule: 'supabase-db-push',
      reason: [
        'Blocked: `supabase db push`.',
        '',
        'AGENTS.md forbids it: this project is local-only and not linked to a hosted',
        'Supabase project (docs/local-dev.md). A push sends both migrations and the',
        'seed to whatever project is linked.',
      ].join('\n'),
    };
  }

  if (startsWith(/^supabase\s+link\b/)) {
    return {
      rule: 'supabase-link',
      reason: [
        'Blocked: `supabase link`.',
        '',
        'Linking is how this local-only stack acquires a remote target, which is the',
        'precondition for the accidental push above. If a remote project is genuinely',
        'wanted, that is a decision for the maintainer, not a side effect of a command.',
      ].join('\n'),
    };
  }

  if (startsWith(/^git\s+clean\b[^\n]*\s(?:-[a-zA-Z]*f[a-zA-Z]*|--force)\b/)) {
    return {
      rule: 'git-clean',
      reason: [
        'Blocked: `git clean` with force.',
        '',
        'It deletes untracked files irreversibly. In this repository that includes',
        '.env.local (gitignored, holds VITE_SUPABASE_* ) and any uncommitted scratch',
        'work. Remove the specific paths you mean instead.',
      ].join('\n'),
    };
  }

  const rmReason = judgeRecursiveRm(flat);
  if (rmReason) return rmReason;

  return null;
}

/**
 * @param {string} flat
 * @returns {{ rule: string, reason: string } | null}
 */
function judgeRecursiveRm(flat) {
  for (const segment of flat.split(/\n|&&|\|\||;/)) {
    // `rm` at command position: a commit message that says "rm -rf ." is text.
    const match = /^\s*(?:sudo\s+)?rm\b([^;&|]*)/.exec(segment);
    if (!match) continue;

    const args = match[1] ?? '';
    const recursive = /\s-[a-zA-Z]*[rR]/.test(args) || /--recursive\b/.test(args);
    if (!recursive) continue;

    const targets = args
      .split(/\s+/)
      .filter((token) => token && !token.startsWith('-'))
      .map(stripQuotes);

    const hit = targets.find((target) => DANGEROUS_RM_TARGETS.has(target));
    if (!hit) continue;

    return {
      rule: 'recursive-rm',
      reason: [
        `Blocked: recursive delete of \`${hit}\`.`,
        '',
        'It removes tracked source, or the database definition this project rebuilds',
        'from, with no undo. Delete the specific paths you mean, one level at a time.',
      ].join('\n'),
    };
  }

  return null;
}

/**
 * Decide whether a migration's content must be blocked.
 *
 * Shared by both enforcement surfaces that can read file bytes: the Claude
 * Code PreToolUse hook (which sees Write/Edit content) and the CI check over
 * `supabase/migrations/` (which covers humans and runtimes whose permission
 * hook only ever sees the path). Same rule, one home.
 *
 * @param {string} path
 * @param {string} content
 * @returns {{ rule: string, reason: string } | null} null means "no objection".
 */
export function judgeMigrationContent(path, content) {
  if (!MIGRATION_PATH.test(path)) return null;
  content = String(content ?? '');
  if (!content) return null;
  if (!SQL_DESTRUCTIVE.test(content)) return null;
  if (/--\s*destructive-ok\b/i.test(content)) return null;

  return {
    rule: 'destructive-migration',
    reason: [
      `Blocked: data loss inside a migration (${path}).`,
      '',
      'supabase/migrations/ is append-only and `supabase db reset` replays every file:',
      'a DROP or TRUNCATE here deletes data on every rebuild, for every clone, forever.',
      '',
      'If the loss is intentional, state it in the file itself:',
      '',
      '  -- destructive-ok: <why this data is safe to drop>',
      '',
      'That marker is the reviewable record. Without it the rule holds.',
    ].join('\n'),
  };
}

/**
 * Decide whether a Write/Edit must be blocked.
 *
 * @param {{ file_path?: string, path?: string, content?: string, new_string?: string }} toolInput
 * @returns {{ rule: string, reason: string } | null}
 */
export function judgeWrite(toolInput) {
  const path = String(toolInput?.file_path ?? toolInput?.path ?? '');
  if (!MIGRATION_PATH.test(path)) return null;

  const content = String(toolInput?.content ?? toolInput?.new_string ?? '');
  return judgeMigrationContent(path, content);
}

/**
 * Parse `git diff --numstat` output into authored and excluded buckets.
 *
 * @param {string} numstat
 * @returns {{ authored: Array<{ path: string, lines: number }>, excluded: Array<{ path: string, reason: string, lines: number }> }}
 */
export function parseNumstat(numstat) {
  const authored = [];
  const excluded = [];

  for (const line of String(numstat ?? '').split('\n')) {
    if (!line.trim()) continue;

    const [added, deleted, ...rest] = line.split('\t');
    const path = rest.join('\t');
    if (!path) continue;

    if (added === '-' || deleted === '-') {
      excluded.push({ path, reason: 'binary', lines: 0 });
      continue;
    }

    const lines = Number(added) + Number(deleted);

    const generated = GENERATED_PATHS.some((pattern) => pattern.test(path));
    if (generated) {
      excluded.push({ path, reason: 'generated', lines });
      continue;
    }

    authored.push({ path, lines });
  }

  return { authored, excluded };
}

/**
 * Build the PR-size verdict from a `gh pr create` invocation and its numstat.
 *
 * @param {string} segment The `gh pr create ...` command segment.
 * @param {string} numstat Output of `git diff --numstat <base>...HEAD`.
 * @param {{ budget?: number, base?: string }} [options]
 * @returns {{ total: number, files: number, excludedLines: number, reason: string } | null}
 */
export function judgePrSize(segment, numstat, { budget = PR_LINE_BUDGET, base = 'origin/main' } = {}) {
  if (/--label[=\s]+['"]?size:exception\b/.test(segment)) return null;

  const { authored, excluded } = parseNumstat(numstat);
  const total = authored.reduce((sum, file) => sum + file.lines, 0);
  if (total <= budget) return null;

  const excludedLines = excluded
    .filter((file) => file.reason === 'generated')
    .reduce((sum, file) => sum + file.lines, 0);

  const largest = [...authored]
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5)
    .map((file) => `    ${String(file.lines).padStart(5)}  ${file.path}`)
    .join('\n');

  return {
    total,
    files: authored.length,
    excludedLines,
    reason: [
      `Blocked: this PR is ${total} authored changed lines against ${base}, over the ${budget} budget.`,
      '',
      largest,
      '',
      `Generated artifacts are already excluded (${excluded.length} file(s), ${excludedLines} lines:`,
      'lockfile, dist, archify and ER viewers), so this number is content someone has to read.',
      '',
      `If that looks wrong, check the base: a stale ${base} measures a diff that is not the PR.`,
      '`git fetch origin` and re-run.',
      '',
      'Two honest ways forward:',
      '',
      '  1. Slice it. Close the current slice at its last reviewed boundary and ship the',
      '     rest as a -prN- chain (see the chained-pr skill).',
      '  2. Record an exception. Re-run with --label size:exception and write the',
      '     justification into odd/tasks/<feature>.md, the way',
      '     odd/tasks/hito5-substitutions-and-coverage.md:4 does.',
      '',
      'A generated file never justifies an exception here: it does not count.',
    ].join('\n'),
  };
}

function stripQuotes(token) {
  return token.replace(/^['"]|['"]$/g, '');
}

function truncate(value, max) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
