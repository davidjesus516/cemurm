# Supabase config v4 — close #538, land the change in #550, audit the rest

- **Status:** verified — the change waits on human approval (#550 is `BLOCKED` by the last-push rule, not by CI)
- **Change:** `chore/deps-patch-minor-bump` (PR #550), commits `37438b1` and `0dd9c7f`
- **Record:** `docs/f1-record-counts` (PR #557) — moved there from #550 on request, so the dependency-bump PR carries only the bump and the config commits it already shipped
- **Date:** 2026-11-25
- **PRs:** #538 closed as superseded; #550 carries the change; #557 carries this record
- **Changed lines:** `supabase/config.toml` 2+/2− in each commit, plus the gate and its selftest in `e6921ac`; this record is docs-only and lives in a docs PR. #550 is over the budget and carries `size:exception` — see [Size exception](#size-exception).

## Context

Two PRs touched `supabase/config.toml` on the same day:

| PR | Author | Branch | Size | State |
|---|---|---|---|---|
| #538 `feat(deps): bump minor versions for Supabase ecosystem and UI stack` | `davidjesus516` | `feat/deps-minor-update` @ `a5eefb1` | 3 files, +664/−704 | **closed** 2026-11-25T13:14:09Z as superseded |
| #550 `chore(deps): bump patch and minor lines across runtime and tooling` | `davidjesus516` | `chore/deps-patch-minor-bump` | 3 files, +1049/−1100 @ `0dd9c7f` | open, green, awaiting approval |

Both proposed the same two-line config fix, and the local CLI (3.2.0, the devDependency) was emitting
one deprecation warning per line on `main`:

```
WARN: auth.email.enable_signup is deprecated and will be removed in v4, use auth.email.enabled instead.
WARN: auth.sms.enable_signup is deprecated and will be removed in v4, use auth.sms.enabled instead.
```

## Decisions

### #538 is a subset of #550, so it is closed rather than merged

`package.json` was compared branch to branch. Every dependency where the two differ is **newer in
#550**; nothing exists only in #538 and nothing in #538 is ahead. 16 entries differ, all in the same
direction:

| Dependency | #538 | #550 |
|---|---|---|
| `@hugeicons/core-free-icons` | `^4.3.5` | `^4.4.0` |
| `@supabase/supabase-js` | `^2.119.1` | `^2.119.2` |
| `@tiptap/*` (9 packages) | `^3.34.0` | `^3.35.0` |
| `lucide-react` | `^1.57.0` | `^1.77.0` |
| `react-aria-components` | `^1.7.0` | `^1.22.1` |
| `tailwind-merge` | `^3.7.0` | `^3.7.1` |
| `eslint` | `^8.57.0` | `^8.57.1` |
| `eslint-plugin-react` | `^7.34.3` | `^7.37.5` |

Closing #538 loses nothing: all of its version bumps are already in #550, which additionally carries
the config fix. The alternative — merging #538 first — would have created a second migration of the
same lockfile for no gain.

### The config change went onto #550's branch directly

Precedent is #543: a two-line config correction riding a PR that is already open and owned by
`davidjesus516`. Pushed in a temporary worktree (`/tmp/cemurm-550`), never with force, so the
branch history is append-only.

### The record itself lives in #557, not #550

The record was first committed to #550's branch alongside the change it documents. It was moved to
#557 (`docs/f1-record-counts`) on the maintainer's request, for the same reason the config change
rode #543: the dependency-bump PR should read as a dependency bump, and its diff is already the
largest in the chain. Removing it is an ordinary delete commit on #550 — no force, no history
rewrite — so the record's own history shows the move rather than hiding it. #550's body and #557's
are updated to point at the new home. The record still describes #550's commits; only where the
file is reviewed changes.

## The change

`37438b1` — v4 auth provider keys:

```diff
 [auth.email]
-enable_signup = true
+enabled = true
 [auth.sms]
-enable_signup = false
+enabled = false
```

`[auth].enable_signup = true` is **not** touched. It is the project-wide signup switch, not an email
provider switch, and v4 keeps it exactly there — `supabase init` in 3.2.0 emits it with the comment
*"To block new signups only, set enable_signup = false under [auth] instead"*.

Effective behaviour is unchanged: email provider on, SMS provider off.

`0dd9c7f` — `orioledb_version` moved to its v4 section:

```diff
 [db]
 major_version = 17
+# OrioleDB version to use as the Postgres storage engine. Leave empty to use the default engine.
+orioledb_version = ""
 [experimental]
-# Configures Postgres storage engine to use OrioleDB (S3)
-orioledb_version = ""
 # Configures S3 bucket URL, ...
```

## Audit of the whole file against the 3.2.0 template

Method, in this order:

1. Generated a fresh template with the project's own CLI: `supabase init` in `/tmp/sbcfg`.
2. Compared section and key sets with a strict parser (`^#? ?key =` so prose comments in this file
   cannot be mistaken for keys — an early run produced a false positive on the word `verify_jwt`
   inside the `[functions.send-guardian-consent]` comment block).
3. Used the CLI itself as a detector. It lists anything it does not recognise:

   ```
   WARN: supabase/config.toml has keys this version of the Supabase CLI does not recognize and ignores: db.bogus_key.
   ```

   Verified with a throwaway key in `/tmp/sbtest`.

Result — every key that did not appear in the template:

| Key | Verdict | Action |
|---|---|---|
| `auth.email.enable_signup` / `auth.sms.enable_signup` | deprecated (WARN above) | fixed in `37438b1` |
| `[experimental] orioledb_version` | **not supported**; a non-empty value fails the parse | moved to `[db]` in `0dd9c7f` |
| `[functions.send-guardian-consent] verify_jwt` | correct: in v4 `verify_jwt` is per function | none |
| `[api] db_pool`, `[auth.email] require_current_password` | new v4 keys, absent here | none — defaults apply |

`orioledb_version` was the silent one. With a value, the CLI refuses to read the file:

```
experimental.orioledb_version in supabase/config.toml is no longer supported. Use db.orioledb_version instead.
```

Here it held `""`, and the CLI skips the key when the value is empty — no warning, no error, no
effect. It was therefore invisible until the key set was compared. After the move, the same
non-empty value parses cleanly (checked in `/tmp/sbtest`), which confirms the section, not the value,
was the problem. The repository still ships `""`, so the storage engine does not change.

Deliberately not adopted: `api.db_pool` and `auth.email.require_current_password` are new v4 defaults,
not deprecations. Adding them would be a behaviour change with no request behind it.

## The gate that keeps this from coming back

`e6921ac` adds `scripts/check-supabase-config.mjs`, its selftest, one `ci.yml` step and the
AGENTS.md paragraph. It runs local-only: no Docker, no stack, no network.

Why two layers, measured rather than assumed:

| Case | `supabase config validate` (3.2.0) | Verdict |
|---|---|---|
| `auth.email.enable_signup = true` | `⚠ deprecated, will be removed in v4` | **exit 0** — a green run with a deprecated key |
| `db.bogus_key = "x"` | `✗ unknown key`, exit 1 | caught |
| `[experimental] orioledb_version = "1.0"` | `✗ removed`, exit 1 | caught |
| `[experimental] orioledb_version = ""` | `✓ … is valid · 0 warnings` | **invisible** — the decoder skips an empty value |

The last row is the key that hid in the audit above, so a gate built on `validate` alone would have
passed the exact file this record exists to fix. The second layer parses the key set of
`supabase/config.toml` and diffs it against the template `supabase init` generates with the same
binary — generated per run, never committed, so a CLI pin bump cannot leave a stale reference behind.
`[functions.<name>]` is exempt: function names are per project, so no template can list them.

The selftest (`scripts/check-supabase-config.selftest.mjs`) builds each of those four fixtures from
the repository config and asserts the gate's exit code, plus exit 2 when the CLI or the config is
missing. It asserts that the empty-value case fails **without** a `config validate` block, which is
what proves the second layer — not the CLI — caught it.

The gate ships in #550 rather than its own PR because it cannot be green before the fix: on `main`
its first line is the deprecation warning. Fix and guard land together, the way
`check-migrations-destructive.mjs` guards the migration rule rather than describing it.

## Size exception

#550 measures **508 authored lines** against the 400 budget, with generated artifacts already
excluded (the lockfile alone is 2,077 lines that do not count). The breakdown is 406 lines of gate
and selftest, 64 of `package.json`, 16 of AGENTS.md, 14 of `ci.yml` and 8 of `supabase/config.toml`.

Slicing does not solve it: the gate and the selftest are 406 lines on their own, so a child PR would
still need the exception, and shipping either without the other is the failure mode this repository
already fixed once — a gate whose failure nobody has demonstrated. The exception is recorded here,
in the unit's record, and the `size:exception` label is on #550 (`check-pr-size.mjs` skips on it).

## Checks

- `supabase status` on a copy of `origin/main`'s config: exactly the two WARN lines quoted above.
- `supabase status` on this branch: no `WARN` of any kind.
- Key-set diff against the 3.2.0 template: 0 repository keys outside the template, except the
  legitimate per-function `[functions.send-guardian-consent]` section.
- CI on `0dd9c7f`, 10/10 green — `lint-and-build`, `Analyze (actions)`, `Analyze
  (javascript-typescript)`, `CodeQL`, `GitGuardian Security Checks`, `Setup — emit deterministic anon
  key`, `authored-lines`, and **E2E Chromium (2m07s) / Firefox (2m35s) / WebKit (2m57s)**.
  The E2E workflow runs `supabase start` from scratch against this config, so the file is exercised
  by a real stack, not only parsed:
  <https://github.com/davidjesus516/cemurm/actions/runs/45623754700>
- `node scripts/check-supabase-config.mjs` on this tree: `OK (110 keys, all known to the 3.2.0
  template, 0 warnings)`; selftest 6/6. Negative cases were run by hand as well: deprecated,
  unknown, removed, removed-with-empty-value, missing CLI (exit 2) and missing config (exit 2).
- CI on `e6921ac` (the gate commit), 10/10 green, with the new steps inside `lint-and-build`:
  `check-supabase-config selftest: 6 passed` and `supabase config: OK (110 keys, all known to the
  3.2.0 template, 0 warnings)`. So the gate runs in the pipeline with the lockfile-pinned CLI, not
  only on the machine that wrote it.
- `pnpm lint` / `typecheck` / `test` / `build`: not re-run locally for these two-line changes; CI ran
  the JS gate (`lint-and-build`) on the same tree.

## Deviations and findings

- **#538's body states the change backwards.** It says *"enabled → enable_signup for email/SMS"*
  while the diff does the opposite (`enable_signup` → `enabled`), which is the correct direction for
  v4. The diff was kept and the error documented in #538's closing comment and #550's body, rather
  than "fixing" the PR by reverting to the deprecated keys.
- **Empty values hide retired keys from the CLI.** `[experimental] orioledb_version = ""` produced no
  warning at all; the unknown-key warning only fires for keys the decoder actually sees. The key-set
  comparison this finding asked for now runs on every PR (`scripts/check-supabase-config.mjs`), and
  its selftest pins the exact case so the protection cannot be removed silently.
- **The approval flow is deadlocked on #550 (and on #543).** The `review` ruleset (id 24904691) sets
  `required_approving_review_count: 1` with `require_last_push_approval: true` and
  `dismiss_stale_reviews_on_push: true`, and there are only two accounts with write access. On #550
  both `37438b1` and `0dd9c7f` are mine, so the assigned reviewer (`Antony-Figueroa`) is the last
  pusher and cannot approve; the author (`davidjesus516`) cannot approve their own PR. #543 has the
  same shape at `734fbd1`. Unblocking needs a push from `davidjesus516` to each branch — an empty
  commit is enough. #552 (last push from `davidjesus516`) and #557 (author `Antony-Figueroa`,
  reviewer `davidjesus516`) are unaffected. Requested in comments on both PRs.
- No local `supabase start` was run after the change; the running stack predates it. The fresh start
  happens in CI's E2E jobs (above).

## Log

- [x] Confirmed the v4 key names against a template generated by the installed CLI 3.2.0.
- [x] Confirmed #550 is a superset of #538's version bumps, branch to branch.
- [x] Applied the auth-key change on #550's branch (`37438b1`), push without force.
- [x] Updated #550's body and closed #538 with the superseded rationale.
- [x] Audited every key against the template; moved `orioledb_version` (`0dd9c7f`).
- [x] Verified the CLI accepts the new section with a non-empty value, and emits nothing on this tree.
- [x] CI green on `0dd9c7f`, E2E included.
- [x] Added the two-layer CI gate and its selftest (`e6921ac`), wired into `ci.yml` before the
  visual gate and documented in AGENTS.md.
- [x] Verified the gate locally: exit 0 on this tree (110 keys, 0 warnings), exit 1 on deprecated,
  unknown, removed and empty-removed fixtures, exit 2 with no CLI and with no config; selftest 6/6.
- [x] Applied `size:exception` to #550 after `check-pr-size.mjs` measured 508 authored lines, and
  recorded the justification above.
- [ ] Human approval and merge of #550 and #557.
