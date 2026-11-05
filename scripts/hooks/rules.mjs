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

/** Shell words that only decorate the command that follows them. */
const SHELL_PREFIX_WORDS = new Set(['sudo', 'env', 'command', 'exec', 'nohup', 'time']);

/** Interpreters whose `-c` argument is a command line of its own. */
const SHELL_INTERPRETERS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);

/** Paths that stay out of `rm -rf` however they are spelled. */
const PROTECTED_SUFFIXES = ['.git', 'supabase/migrations', 'supabase/seed.sql'];

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
  const segments = commandSegments(command);

  // Rules 1-3 match at command position, not anywhere in the string: a `grep`
  // for "supabase db push" is reading, not pushing. `commandWords` strips the
  // shell's decoration first, so `FOO=1`, `sudo` and `./` do not hide that
  // position.
  const head = (segment) => commandName(commandWords(segment)[0]);
  const words = (segment) => commandWords(segment).map(stripQuotes);

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

  if (segments.some((segment) => {
    const parts = words(segment);
    return head(segment) === 'supabase' && parts[1] === 'db' && parts[2] === 'push';
  })) {
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

  if (segments.some((segment) => head(segment) === 'supabase' && words(segment)[1] === 'link')) {
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

  if (segments.some((segment) => {
    if (head(segment) !== 'git' || words(segment)[1] !== 'clean') return false;
    return words(segment)
      .slice(2)
      .some((word) => /^-[a-zA-Z]*f/.test(word) || word === '--force');
  })) {
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

  const rmReason = judgeRecursiveRm(segments);
  if (rmReason) return rmReason;

  return null;
}

/**
 * A segment's words, with the shell's decoration removed: surrounding parens
 * and leading `VAR=value` assignments or wrapper words are not the command.
 *
 * @param {string} segment
 * @returns {string[]}
 */
function commandWords(segment) {
  const text = segment.trim().replace(/^\(+/, '').replace(/\)+$/, '').trim();
  const words = text.split(/\s+/).filter(Boolean);

  let index = 0;
  while (index < words.length) {
    const word = stripQuotes(words[index]);
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word) || SHELL_PREFIX_WORDS.has(word)) {
      index += 1;
      continue;
    }
    break;
  }

  return words.slice(index);
}

/** `./supabase` and `/usr/bin/supabase` name the same command. */
function commandName(word) {
  return stripQuotes(word ?? '').replace(/^.*\//, '');
}

/**
 * The command line split into the segments that are executed, with
 * `bash -c '<command>'` replaced by the command it defers to.
 *
 * @param {string} command
 * @returns {string[]}
 */
function commandSegments(command) {
  const out = [];
  for (const raw of command.split(/\n|&&|\|\||;/)) {
    const segment = raw.trim();
    if (!segment) continue;

    const deferred = deferredCommand(segment);
    if (deferred) {
      out.push(...commandSegments(deferred));
      continue;
    }
    out.push(segment);
  }
  return out;
}

/**
 * The command a shell interpreter was asked to run, or null when this segment
 * is not one. Recursion terminates because each layer drops the interpreter.
 *
 * @param {string} segment
 * @returns {string | null}
 */
function deferredCommand(segment) {
  const words = commandWords(segment);
  if (!words.length || !SHELL_INTERPRETERS.has(commandName(words[0]))) return null;

  const flag = words.findIndex((word) => /^-[a-zA-Z]*c$/.test(stripQuotes(word)));
  if (flag === -1) return null;

  const inner = stripQuotes(words.slice(flag + 1).join(' ').trim());
  return inner && inner !== segment.trim() ? inner : null;
}

/**
 * The path the shell would act on: no quotes, no doubled separators, no
 * leading `./`, no trailing slash.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizePath(value) {
  const unquoted = stripQuotes(value).replace(/\\/g, '/');
  const rooted = unquoted
    .replace(/\/{2,}/g, '/')
    .replace(/^(?:\.\/)+/, '')
    .replace(/\/\.(?=\/|$)/g, '');
  if (!rooted) return '.';
  return rooted.replace(/\/+$/, '') || '/';
}

/**
 * @param {string} target
 * @returns {boolean}
 */
function isDangerousTarget(target) {
  const normalized = normalizePath(target);
  if (DANGEROUS_RM_TARGETS.has(normalized)) return true;
  return PROTECTED_SUFFIXES.some(
    (suffix) => normalized === suffix || normalized.endsWith(`/${suffix}`),
  );
}

/**
 * @param {string[]} segments
 * @returns {{ rule: string, reason: string } | null}
 */
function judgeRecursiveRm(segments) {
  for (const segment of segments) {
    const words = commandWords(segment).map(stripQuotes);
    // `rm` at command position: a commit message that says "rm -rf ." is text.
    if (commandName(words[0]) !== 'rm') continue;

    const args = words.slice(1);
    const recursive = args.some((word) => /^-[a-zA-Z]*[rR]/.test(word) || word === '--recursive');
    if (!recursive) continue;

    const targets = args.filter((token) => token && !token.startsWith('-'));
    const hit = targets.find(isDangerousTarget);
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
 * Remove SQL comments, leaving string literals and quoted identifiers intact.
 *
 * The destructive scan cannot run on raw text. `0046` revokes a grant and then
 * explains, in a comment, that the revoked privilege list includes TRUNCATE —
 * prose about a privilege, not a statement that truncates anything. A plain
 * regex read that comment as a data-loss statement and failed CI on a migration
 * that destroys nothing.
 *
 * Stripping is quote-aware on purpose. A naive `--` strip would treat the `--`
 * inside `'a--b'` as the start of a comment and drop the rest of the line, and
 * a dollar-quoted body (`execute $sql$ drop table x $sql$`) is executable SQL:
 * hiding it would turn this guard into a bypass. Comments go, everything a
 * database would execute stays.
 *
 * @param {string} sql
 * @returns {string}
 */
function stripSqlComments(sql) {
  let out = '';
  let i = 0;
  /** @type {string | null} */
  let dollarTag = null;

  while (i < sql.length) {
    // Inside `$tag$ … $tag$`: copy through verbatim until the tag closes.
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        out += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
      } else {
        out += sql[i];
        i += 1;
      }
      continue;
    }

    const ch = sql[i];

    // Single-quoted string, double-quoted identifier: copy through verbatim,
    // honouring the doubled-quote escape (`''` / `""`).
    if (ch === "'" || ch === '"') {
      out += ch;
      i += 1;
      while (i < sql.length) {
        out += sql[i];
        if (sql[i] === ch) {
          if (sql[i + 1] === ch) {
            out += sql[i + 1];
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    // Dollar-quoted body opener: `$$` or `$tag$`.
    if (ch === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (tag) {
        dollarTag = tag[0];
        out += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    // Line comment.
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      continue;
    }

    // Block comment. Postgres nests them, so track depth rather than stopping
    // at the first `*/`.
    if (ch === '/' && sql[i + 1] === '*') {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth += 1;
          i += 2;
          continue;
        }
        if (sql[i] === '*' && sql[i + 1] === '/') {
          depth -= 1;
          i += 2;
          continue;
        }
        i += 1;
      }
      out += ' ';
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
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
  // The escape hatch is a comment, so it is read before comments are stripped.
  if (/--\s*destructive-ok\b/i.test(content)) return null;
  if (!SQL_DESTRUCTIVE.test(stripSqlComments(content))) return null;

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
