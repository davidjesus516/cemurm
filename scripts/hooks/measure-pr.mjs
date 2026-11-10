/**
 * Measure the current branch against the PR base, the way GitHub will.
 *
 * Shared by both agent adapters (Claude Code's PreToolUse hook and the OpenCode
 * permission hook) so the number can never disagree between them.
 */

import { execFileSync } from 'node:child_process';

import { judgePrSize } from './rules.mjs';

/**
 * @param {string} command A full Bash command string.
 * @param {string} cwd
 * @returns {{ rule: string, reason: string } | null} null when the PR fits the budget
 *   or cannot be measured.
 */
export function evaluatePrCreate(command, cwd) {
  const segment = String(command ?? '')
    .split(/\n|&&|\|\||;/)
    .map((part) => part.trim())
    .find((part) => /^gh\s+pr\s+create\b/.test(part));

  if (!segment) return null;

  const base = /--base[=\s]+['"]?([^\s'"]+)/.exec(segment)?.[1] ?? 'origin/main';
  const measured = gitNumstat(base, cwd);

  if (measured === null) {
    // No measurable base (detached head, missing remote, brand-new branch):
    // report nothing rather than inventing a failure.
    process.stderr.write(
      `CEMURM guard: could not measure the diff against ${base}; PR size not checked.\n`,
    );
    return null;
  }

  const size = judgePrSize(segment, measured.numstat, { base: measured.ref });
  return size ? { rule: 'pr-size', reason: size.reason } : null;
}

/**
 * `gh pr create --base main` means the repository's `main` on GitHub, not the
 * local branch that happens to be named `main` and may be months stale. Prefer
 * the remote-tracking ref, fall back to the literal one.
 *
 * @param {string} base
 * @param {string} cwd
 * @returns {{ numstat: string, ref: string } | null}
 */
export function gitNumstat(base, cwd) {
  const candidates = base.startsWith('origin/') ? [base] : [`origin/${base}`, base];

  for (const ref of candidates) {
    try {
      const numstat = execFileSync('git', ['diff', '--numstat', `${ref}...HEAD`], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 15_000,
      });
      return { numstat, ref };
    } catch {
      // Try the next candidate; a missing ref is not an error worth blocking on.
    }
  }

  return null;
}
