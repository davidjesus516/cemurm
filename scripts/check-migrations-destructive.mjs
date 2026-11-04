#!/usr/bin/env node
/**
 * Fail when a migration in `supabase/migrations/` destroys data without
 * declaring it.
 *
 * The Claude Code PreToolUse hook catches the Write/Edit that introduces a
 * DROP or TRUNCATE. This catches the file itself: written by a person, by a
 * runtime whose permission hook only ever sees the path (OpenCode), or by any
 * other tool. Same rule (judgeMigrationContent), same escape hatch.
 *
 * The escape hatch is the file's own comment, not a flag:
 *   -- destructive-ok: <why this data is safe to drop>
 *
 * Usage: node scripts/check-migrations-destructive.mjs [--base <ref>]
 *
 *   no --base : scan every migration in the tree (scheduled/main safety net)
 *   --base R  : scan only files changed between R and HEAD (cheap per-PR path)
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { judgeMigrationContent } from './hooks/rules.mjs';

const args = process.argv.slice(2);
const baseIndex = args.indexOf('--base');
const base = baseIndex !== -1 ? args[baseIndex + 1] : null;

const MIGRATIONS_DIR = 'supabase/migrations';

/** @returns {string[]} */
function listMigrations() {
  try {
    return readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .sort();
  } catch {
    // A tree without the directory has nothing to scan; that is not an error.
    return [];
  }
}

let files = listMigrations();

if (base) {
  try {
    const out = execFileSync(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`, '--', `${MIGRATIONS_DIR}/*.sql`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
    );
    const changed = new Set(out.split('\n').map((line) => line.trim()).filter(Boolean));
    files = files.filter((name) => changed.has(join(MIGRATIONS_DIR, name)));
  } catch {
    // An unreadable base falls back to the full scan: missing a violation is
    // worse than re-scanning files that were already reviewed.
    process.stderr.write(
      `check-migrations-destructive: could not diff against ${base}; scanning every migration.\n`,
    );
  }
}

let findings = 0;

for (const name of files) {
  const path = join(MIGRATIONS_DIR, name);
  const verdict = judgeMigrationContent(path, readFileSync(path, 'utf8'));
  if (!verdict) continue;
  findings += 1;
  console.error(verdict.reason);
}

if (findings > 0) {
  process.exit(1);
}

process.stdout.write(
  `migrations: OK (${files.length} file${files.length === 1 ? '' : 's'} scanned, 0 destructive without -- destructive-ok)\n`,
);
