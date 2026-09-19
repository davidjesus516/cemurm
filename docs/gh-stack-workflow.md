# gh stack — chained PR workflow

**Status:** enabled locally (official extension `github/gh-stack` v0.1.1).
Local cycle (init, view, navigation, local cleanup) verified on a scratch
stack, Sep 2026. Remote operations (`submit`, `sync`, `merge`) are documented
from the tool's own help and still need a first real rollout — treat them as
untested until then.

## What is it

`gh stack` is the official GitHub CLI extension for **stacked PRs**: a chain
of branches whose PRs build on each other. It tracks the stack locally and
links the PRs into a Stack on GitHub.

CEMURM already ships chained PRs by hand (e.g. `Hito 3 PR#1a-1 … PR#3-4`).
This runbook formalizes that practice with `gh stack` so branch ordering,
rebasing, and PR creation stay mechanical.

## When to use it

- **Single PR** — the normal flow in `CONTRIBUTING.md` (one branch from
  `main`, one PR). This stays the default for changes that fit one
  reviewable PR (~400 changed lines or less).
- **Stacked PRs** — when a change splits into two or more dependent PRs
  (Hito-scale work, ~400-line budget per PR). `gh stack` keeps each PR small,
  ordered, and rebased on its parent.
- Keep the existing Hito/PR numbering in commit and PR titles
  (`(Hito N PR#x-y)`), and keep Conventional Commits.

## Install / upgrade

```bash
gh extension install github/gh-stack    # once
gh extension upgrade gh-stack            # keep current
gh stack version
gh auth status                           # must be authenticated (repo scope)
```

## Core cycle (verified locally)

```bash
# 1. Start from a clean, up-to-date trunk
git switch main && git pull

# 2. Create the stack (multi-layer in one command, bottom → top).
#    Existing branches are adopted; missing ones are created.
gh stack init feat/hito4-db feat/hito4-api feat/hito4-ui
#    ...or incrementally:
gh stack init feat/hito4-db
gh stack add feat/hito4-api

# 3. Implement and commit on each branch (work units, Conventional Commits).
#    `gh stack bottom / up / down / top` navigate; `gh stack switch` is the
#    interactive picker (needs a real terminal).

# 4. Check the order before touching the remote
gh stack view

# 5. Push the stack and create/update the PRs on GitHub
gh stack submit

# 6. After new commits: push just the active stack atomically
gh stack push

# 7. Keep in sync with the remote (fetch → cascade rebase → atomic push)
gh stack sync

# 8. Merge the stack when reviews pass
gh stack merge
```

### Verified commands (Sep 2026, v0.1.1)

| Command | Behavior observed |
| --- | --- |
| `gh stack init a b` | Adopts existing branches bottom → top; prints the chain (`main ← a ← b`) and marks you on top |
| `gh stack view` | Tree render of the stack with commits; `●` = current |
| `gh stack bottom` / `up` | Checkout moves correctly through the stack |
| `gh stack top` | No-op when already on top (correct) |
| `gh stack switch` | Interactive only — fails cleanly in a non-TTY session |
| `gh stack unstack --local` | Removes local tracking only, never touches GitHub |

## Remote operations — read before first use

- `gh stack submit` — pushes all branches and creates/updates PRs, then
  links them into a Stack on GitHub. **This is the command that opens PRs.**
- `gh stack sync` — fetches, reconciles with the remote stack, fast-forwards
  the trunk, cascade-rebases stack branches, and pushes with
  `--force-with-lease --atomic`. On rebase conflict it restores all branches
  and asks you to run `gh stack rebase` interactively. Sync never opens PRs.
- `gh stack push` — pushes active branches atomically (no PR creation).
- `gh stack merge` — merges the stack's PRs in order.
- `gh stack unstack [stack-number]` — removes local tracking and unstacks on
  GitHub; with `--local` only local. PRs queued for merge or with auto-merge
  stay stacked (GitHub decides).

## Gotchas

- **v0.1.1 is early software.** Do a `gh stack view` before and after every
  remote operation until the workflow has proven itself on a real Hito.
- **Interactive commands need a TTY**: `switch`, `modify`, and rebase
  conflict resolution. In non-interactive/agent sessions use
  `bottom` / `up` / `down` / `top` and plain `git` instead.
- **Start clean.** Stack branches are parent-ordered; commits on the wrong
  branch break the chain. Keep work units on their own branch (`gh stack up`
  before starting the next layer).
- **Don't stack docs-only archives.** Archived branches like
  `docs/hito-*-archive` are closed; new doc/PR changes branch from `main`.
- **Review budget still applies.** Each stacked PR should stay near ~400
  authored changed lines; a stack is never an excuse for a giant single PR.
- Keep the untracked OpenSpec change folders out of stack commits unless the
  PR is the OpenSpec change itself.