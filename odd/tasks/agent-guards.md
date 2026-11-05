# Agent guards — destructive-command and PR-size enforcement

Branch: `chore/agent-guards`. Delivery: single PR, `size:exception` documented below.
Runner: `node scripts/hooks/pre-tool-guard.selftest.mjs`.

## Size exception

Measured against `origin/main` at commit `86d9d43`: **1,504 authored changed lines**, over the
400 budget. (It was 948 against `adc8400` when the PR opened; the rebase and the comment-stripping
fix below account for the rest, and the selftest grew from 295 to 455 lines with the checks that
pin it.) The exception is accepted because the unit cannot be split without producing a
non-functional half:

- The rules module, both adapters and the selftest are one artifact. A guard without its
  selftest is unverified, and three adapters without the shared module are three drifting
  policies — the exact defect this unit exists to remove.
- The selftest alone is 455 of the 1,504 lines, and 11 of its checks exercise the second
  adapter against the same matrix. Splitting it would leave one adapter untested in whichever slice
  lands second.
- The CI gate is 106 lines across two files and is meaningless before the rules module exists.

Generated artifacts are already excluded from the count and do not justify anything here.

## Objective

Turn this repository's working rules into gates that actually fail. Two rules were prose
only:

1. Never run destructive SQL against the database (`DROP`, `TRUNCATE`).
2. Never open a PR above ~400 authored changed lines without a recorded exception.

## Problem / Why

The 400-line convention existed in four places — `docs/master-plan.md:7-8`, the checkbox in
`.github/pull_request_template.md:12`, the `size:exception` label, and the `chained-pr`
skill — and nothing measured it. A checkbox cannot fail. Two PRs shipped over budget in the
same cycle: #432 at 1,287 authored lines and #431 at 890.

The destructive-command rule had no enforcement at all. `supabase db push` sends both
migrations and the seed to whatever project is linked, and this stack is local-only by
design (`docs/local-dev.md`).

## Design

One pure rules module (`scripts/hooks/rules.mjs`) read by three independent layers, so the
policy cannot drift between runtimes:

| Layer | File | Blocks with |
|---|---|---|
| Claude Code | `.claude/settings.json` → `scripts/hooks/pre-tool-guard.mjs` | `exit 2`, stderr as the reason |
| OpenCode V2 | `.opencode/plugins/cemurm-guard/index.js` | `permission.hook("evaluate")`, `effect: "deny"` + `message` |
| CI | `.github/workflows/pr-size.yml` → `scripts/check-pr-size.mjs` | non-zero exit |

The CI layer is the one that covers PRs opened from the web UI, by a human, or by an agent
whose runtime has no plugin loaded. The agent layers are the early, cheap feedback.

### What is blocked

- Destructive SQL through a live client (`psql`, `docker exec … psql`) matching
  `DROP TABLE`/`TRUNCATE`, unless the command carries `-- destructive-ok`.
- `supabase db push` and `supabase link`.
- `git clean` with a force flag.
- Recursive `rm` on the repository root, `.git`, or `supabase/migrations`.
- A `DROP`/`TRUNCATE` inside `supabase/migrations/*.sql` without `-- destructive-ok`.
- `gh pr create`, or the CI gate, above 400 authored changed lines.

### What is deliberately not blocked

- **`supabase db reset`.** The smoke tests in `scripts/smoke/` require a fresh reset before
  every run (`AGENTS.md`, "SQL smoke tests"). A guard that breaks the documented workflow is
  disabled within a week, and then it guards nothing.
- **Mentioning a blocked command.** Rules match at command position, not as a substring. A
  `grep` for `supabase db push` is reading; a commit message quoting `rm -rf .` is text.
  The selftest pins both cases.

### Measurement

The PR metric is authored lines only — additions plus deletions, with generated artifacts
excluded: `pnpm-lock.yaml`, `dist/`, `stack-diagram-output/`, `docs/uml/*.html`,
`docs/uml/*.svg` and `docs/er-diagram.html`. Without that exclusion PR #425 measures 30,995
lines of which only 1,128 are content, and a 17-line bug fix sits behind two generated
archify viewers.

`gh pr create --base main` resolves to `origin/main` when it exists. The literal `main` is a
local branch that can be months stale and inflates the count by an order of magnitude.

## Verification

```
node scripts/hooks/pre-tool-guard.selftest.mjs   # 79 checks, both adapters
pnpm lint
pnpm typecheck
pnpm test                                        # 496 tests
bash scripts/check-test-integrity.sh
pnpm build
node scripts/check-migrations-destructive.mjs                    # exit 0, 44 files
node scripts/check-pr-size.mjs --base origin/main --head HEAD   # exit 1 at 1,504
PR_LABELS=size:exception node scripts/check-pr-size.mjs --base origin/main --head HEAD  # exit 0
```

The OpenCode adapter was also verified live: the plugin loaded in a running session and
denied a real tool call, which is what exposed the substring-matching false positive fixed
before this unit was committed.

## Open

- `authored-lines` reports; it does not block a merge until the job is marked as a required
  status check in the `checks` ruleset. That is a repository-admin action, not a code change.
- ~~The migration-content rule is enforced by the Claude Code adapter and the rules module, but
  OpenCode's `permission.hook` for `edit` receives the path, not the file bytes, so that
  runtime cannot evaluate it.~~ Closed: `scripts/check-migrations-destructive.mjs` scans
  `supabase/migrations/*.sql` in CI (full tree, `--base <ref>` for the per-PR path) with the
  same `judgeMigrationContent` rule and the same `-- destructive-ok` escape hatch — see L2.

## Log

- L1: the maintainer asked for agent hooks that prevent deleting a table or emptying the
  database, and for the OpenCode equivalent, and stated that oversized PRs must be avoided
  in every case, not only from an agent session.
- L2 (2026-11-04): the migration-content rule got its CI surface, closing the second Open
  item. `judgeMigrationContent(path, content)` was extracted from `judgeWrite` in
  `scripts/hooks/rules.mjs` — one rule home, two enforcement surfaces (the PreToolUse hook
  wraps it with the tool input; CI calls it per file). The new check scans every migration
  by default and, with `--base <ref>`, only migrations changed since that ref, falling back
  to the full scan when the diff is unreadable — missing a violation is worse than
  re-reading reviewed files. Wired into `ci.yml` next to `check-migrations-unique.sh`,
  after test and build, for the same `set -euo pipefail` reason the other failing gates
  sit there. Selftest grew from 43 to 51 checks: five pin `judgeMigrationContent` (block
  DROP/TRUNCATE, allow the marker, allow DROP COLUMN, ignore non-migration paths) and
  three spawn the check itself against scratch trees (exit 0 clean, exit 1 destructive,
  exit 0 with the marker). Verified against the real tree: 43 migrations, 0 findings;
  a manual negative run exits 1 with the full reason and passes with the marker.
- L3 (2026-11-04): native review of the guards candidate ran four lenses (risk, resilience,
  readability, reliability) and returned one CRITICAL finding, fixed in `cdc5fad`. Both
  adapters routed a Bash call to the PR-size verdict as soon as it contained a `gh pr create`
  segment, so `judgeBash` never ran and a forbidden operation sharing that line — recursive
  delete, `supabase db push`, destructive SQL — reached the tool while the guard reported
  success. Both now judge the bash rules first and add the size verdict only when bash has no
  objection; pinned twice (PreToolUse exit 2, OpenCode deny) with a combined line whose size
  verdict is cleared by `size:exception`, so only `judgeBash` can block it. RED evidence:
  the pre-fix adapters exit 0 on that line, the fixed ones exit 2. A targeted validator then
  re-checked only the correction and approved. Authority burned under
  `review-9579b54b322af81a`; selftest 51 → 54 checks.
- L4 (2026-11-04): the review's non-blocking findings are recorded as follow-ups, not fixed
  here: `bash -lc 'supabase db push'`-style indirection and `./`-or-slash variants of the
  protected delete targets slip past the start-of-segment match; the `-- destructive-ok`
  marker waives a whole file rather than one statement; the blocked-command echo can carry a
  credential into the transcript; `check-migrations-destructive.mjs` reports "0 files" green
  when its directory is unreadable; the selftest step sits before `pnpm test` in `ci.yml` and
  hides a product failure; the Claude crash branch tells the model to edit a file the same
  branch blocks. None block this candidate; each is separate later work.
- L5 (2026-11-04): the CI surface the rule got in L2 failed the moment it met a real migration.
  `check-migrations-destructive.mjs` blocked `0046_feedback_triage_and_github_link.sql`, which
  drops a trigger and two policies and then explains in a comment that 0033 left `TRUNCATE` in
  `authenticated`'s default grant — a sentence about a privilege, read as a truncate statement.
  The scan now strips SQL comments first, quote-aware: string literals, quoted identifiers and
  dollar-quoted bodies are copied through, so `execute $q$ truncate songs $q$` still blocks, and a
  `--` inside `'a--b'` can no longer truncate the line and hide a real `DROP` behind it. Postgres
  nests block comments, so depth is tracked. The `-- destructive-ok` marker is read from the raw
  file, since it is a comment itself. Selftest 54 → 61: three comment shapes must be ignored and
  four executable shapes must still block. `AGENTS.md` gained both new steps in its CI chain,
  which this branch had already made false.
- L6 (2026-11-04): guard hardening, the follow-up L4 pointed at. Three holes, each named by
  the review and each closed with a test that failed first:
  (1) **shell indirection** — `bash -lc 'supabase db push'`, `FOO=1 supabase db push`,
      `(supabase db push)`, a `./`-prefixed `supabase link` and `sudo git clean -xdf` slipped
      past the start-of-segment match. Segments are now split after unwrapping
      `bash|sh|zsh|dash|ksh -c` recursively, and the command position is read from
      `commandWords()`, which drops surrounding parens, leading `VAR=value` assignments and the
      `sudo|env|command|exec|nohup|time` wrappers, and resolves `./x` and `/usr/bin/x` to `x`.
  (2) **target spellings** — a dot-prefixed migrations path, a trailing slash, a dot-prefixed
      `.git` and an absolute path into the migrations now match. Targets are normalized
      (quotes, backslashes, doubled slashes, `./`, trailing slash) before the denylist check,
      and a protected suffix (`.git`, `supabase/migrations`, `supabase/seed.sql`) matches at
      any depth. `dist/`, `node_modules/` and arbitrary scratch paths stay allowed.
  (3) **fail-open scan** — `check-migrations-destructive.mjs` printed `0 files scanned` and
      exited 0 when `supabase/migrations` could not be read. It now exits 2 with the directory
      and the failure, because a missing directory is a misconfiguration, not a clean tree.
  RED evidence: 11 of the new assertions failed against the previous rules; the twelfth, the
  missing-directory case, exited 0. Selftest 61 → 79 checks. A hand matrix outside the selftest
  (11 permitted, 11 blocked) found 0 wrong verdicts.
  Independent verification (gentle-ai-verify) passed all three claims with no blockers; it
  compared candidate against baseline commit by commit and confirmed every blocked spelling
  returned ALLOW at the baseline, so the new assertions are not tautological. Its one in-scope
  advisory — `/./` interior and `/.` trailing segments still normalized past the denylist — is
  closed here and pinned, along with a durable probe that the build-output spellings stay
  allowed. The remaining advisories it raised (quoted `VAR="a b"` assignments, flags between a
  wrapper and the command, glob and brace targets, and non-`;` indirection such as
  `echo … | bash`) are unchanged from the baseline and need a quote-aware tokenizer, which is
  its own unit, not a patch on this one.
  Known limit, unchanged and now easier to hit: the splitter does not understand quotes, so a
  shell command whose *data* contains a `;`-separated blocked command (a `node -e` one-liner,
  for example) is judged as if it ran it. It blocked one of this unit's own verification
  commands. A real tokenizer is the fix; a false positive costs a retry, a missed true positive
  costs the database, so the trade still points the same way.
  RDD assessment of this commit against `aa097b6`: `medium`, `review_due: false`
  (`under_budget`), so no second native review was entered — the independent verifier covers
  the Risk item this unit names.

- L7 (2026-11-04): rebased onto `main` after #438 merged, which is where this unit's premise
  changed. `fix/guard-hardening` was cut from the pre-rewrite `chore/agent-guards`, so it also
  carried every commit #438 already landed. Only the two hardening commits remain on top of the
  merged guard, which is why the delta is 4 files rather than 13 — the rest is already in `main`.
  Two conflicts, both in this record: the selftest count (both sides stale; the merged number was
  61 and the delta made it 79) and the L5 entry, since #438's comment-stripping fix and this
  hardening are both real history and neither replaces the other.
  One hole found while reviewing the delta and closed here: `bash -c "bash -c \"git clean
  -xdf\""` still passed, because `stripQuotes` did not unescape `\"`, so the second unwrap saw
  `\"git` at command position instead of `git`. That is the same indirection class this unit
  exists to close, one quoting style over, and it cost two lines to fix rather than a note.
  `stripQuotes` now unescapes backslash-quoted characters before stripping the surrounding pair.
  RED evidence: the new assertion fails against the previous `stripQuotes` (`78 passed, 1 failed`)
  and passes after. Selftest 77 → 79.
