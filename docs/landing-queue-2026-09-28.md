# Landing queue — 2026-09-28

> **This is a dated snapshot, not a living plan.** It describes the 23 open PRs as they stood on
> 2026-09-28 against `main` @ `bfaf6e8`. Once the queue drains, delete it.
>
> **Nobody merges from this document.** The maintainer approves and merges. What is listed here is
> the order, and which PRs will need a rebase and therefore a fresh approval — the ruleset has
> `require_last_push_approval: true`, so a rebase invalidates any prior approval.
>
> **Superseded 2026-10-11.** The `PR` ruleset (id `24085467`) referenced below no longer exists: it
> was split into `checks` (id `24904685`, no bypass — required CI and branch integrity for everyone)
> and `review` (id `24904691`, a `pull_request`-mode bypass for the maintainer). The
> `require_last_push_approval` blocker described under "Pending — needs an approval" is therefore
> resolved: the maintainer's own PRs now merge without an approval, while CI still gates them. This
> document itself remains a dated 2026-09-28 snapshot; the note records the later state, it does not
> rewrite it.

## Why this order and not the PR number order

Three facts, each computed rather than assumed:

1. **Every branch is based on `main`, so the chains cost nothing.** A child PR is already based on
   its parent, so `git diff main..child` shows the parent's files too. Those "overlaps" are not
   conflicts. The rebase cost is only at the *roots*.
2. **`src/app/router.jsx` is a hub.** Seven PRs add routes to it: #188, #189, #194, #195, #196, #197,
   #225. Every one after the first will need a rebase. Grouping them consecutively means paying that
   cost once, in one block, instead of seven times across the whole queue.
3. **#223 is the other hub.** It collides with four PRs, each in a *different* file, with real line
   overlap — not textual adjacency. Landing it last means four PRs merge untouched and only #223
   rebases.

## The queue

### Phase 1 — no conflicts, no router. Nothing rebases.

| # | PR | Finding / what |
|---|---|---|
| 1 | **#226** | fixtures. Fixes nothing; makes phases 2–4 demonstrable in the app |
| 2 | **#187** | correct the migration paragraph the merges made wrong |
| 3 | **#198** | jsdoc types for the gigs module |
| 4 | **#221** | Spotify: the mode check was an exact match |
| 5 | **#220** | OnSong: carry the agreed key to the export |
| 6 | **#218** | parser sectional key **+** `qualityForDegree` (findings A **and** E) |
| 7 | **#222** | readiness is per-version |

### Phase 2 — the `router.jsx` block. Rebases concentrate here.

| # | PR | Chain |
|---|---|---|
| 8 | **#186** | projection relocation (+4/−4) |
| 9 | **#188** | projection pages and routes |
| 10 | **#189** | start-projection entry point |
| 11 | **#194** | minors: guardian capability link |
| 12 | **#195** | moderation: queue, case detail, own-cases |
| 13 | **#196** | login-less external display channel |
| 14 | **#197** | external display into Stage Mode |
| 15 | **#225** | overlay capability is a token, not the primary key |

**#225 lands last in this block on purpose** — it is the sixth PR to touch `router.jsx`, so it takes
the rebase. Its other file, `StageMode.jsx`, is also touched by #197, but the two changes are in
different features: #197 integrates the *external display*, #225 changes the *OBS overlay*. Verified
by diff, not assumed.

### Phase 3 — migrations and their chains

| # | PR | Chain |
|---|---|---|
| 16 | **#190** | feedback data layer — **BLOCKED, see below** |
| 17 | **#191** | feedback form modal and header entry |
| 18 | **#192** | freeze published plans into versions (592 lines) |
| 19 | **#193** | plan-freeze publish UI |

### Phase 4 — the multi-rebase tail

| # | PR | Rebases onto |
|---|---|---|
| 20 | **#216** | #190/#191 — `src/offline/drainer.js` |
| 21 | **#219** | — (first of the transpose pair) |
| 22 | **#224** | #219 — `transpose.js` and its test, the largest overlap in the queue |
| 23 | **#223** | #216, #222, #219, #224 — **the one to watch** |

**#223 deserves a human eye on the diff, not just the gates.** It touches `collab.js`,
`readiness.js` and `transpose.js` — precisely the three files the other PRs also move. A bad merge
there is a change of *context*, not of code, and no gate detects that. Land it with the diff open.

## Merged since this queue was written — #235, 2026-09-28

**#235 is already on `main`**, merge commit `5547150`. It was not in this queue when it was
written. It carried the visual contract (`skills/cemurm-visual-system/`), a CI gate
(`scripts/check-visual-contract.sh`, 10 rules, runs between `lint` and `test`), and a real
accessibility fix: `cem.secondary` measured 4.04:1 against `cem.elevated`, under the WCAG AA
4.5:1 floor.

It overlapped six files with five queued PRs. **All five merge clean against the new `main`**,
verified with `git merge-tree --write-tree` returning exit 0 for each — none of this queue needs
a rebase because of it:

| PR | Shared file | Nature of the overlap |
|---|---|---|
| **#187** | `AGENTS.md` | Real but non-adjacent: #235 added a `## Visual system` section after Methodology; #187 edits the database-layer migration paragraph. Different regions of the file |
| **#189**, **#193** | `src/features/services/pages/ServiceDetail.jsx` | One line each — a Tailwind class name |
| **#194** | `src/features/repertoire/pages/SongDetail.jsx` | One line — a Tailwind class name |
| **#195** | `CaseDetail.jsx`, `ModerationQueue.jsx`, `Moderation.jsx` | One line each — a Tailwind class name |

The `src/` overlaps are class-name changes on elements that carry `bg-cem-elevated`, far from
what those PRs edit. If any of them conflicts on merge anyway, it is that PR's own drift against
`main`, not #235.

**This also resolves the Phase 3 blocker below.** #228 renumbers the feedback migration to
`0033_feedback.sql` and adds the smoke test it was missing, so **#190 can now land as-is**.

One consequence for whoever picks up the landing work: `docs/design-system.md` and
`odd/tasks/cemurm-brand-landing.md` §5–§6 are now formally **superseded** for visual decisions by
`skills/cemurm-visual-system/SKILL.md`, which is registered in `AGENTS.md`. Two documents still
describe a visual system that no longer applies. They are not corrected by this queue.

## BLOCKER — #190 could not land as-is · RESOLVED by #228

> **Resolved 2026-09-28.** #228 renumbers the migration to `0033_feedback.sql` and adds
> the missing smoke test. **#190 can land as-is.** The analysis below is kept because the
> reasoning is the reusable part, but nothing here is blocking any more.

**Originally:** `#190` carries `supabase/migrations/0029_feedback.sql`. **`0029` is also claimed by the guardian
branch family** — `origin/fix/fail-closed-minors`, `origin/feat/guardian-consent-db` and
`origin/feat/guardian-email` all carry a *contiguous run*:

```
0029_fail_closed_minors.sql
0030_date_of_birth_step.sql
0031_guardian_consent_email.sql
```

`supabase db reset` executes migrations in **filename order**, so two files sharing a version prefix
have an arbitrary relative order, and the migration ledger is keyed on that version.

**Recommendation: renumber #190, not the guardian branch.** The guardian side is a contiguous
three-file run where each builds on the last, so renumbering inside it is the more invasive move.
#190's `0029_feedback.sql` is standalone. `0032` is taken by #225, so **`0033_feedback.sql`** is the
first genuinely free number.

**This needs someone with push to `feat/m2-feedback-data-v2` on the upstream.** It is not a
mechanical rename either: `scripts/smoke/` has no smoke for `0029_feedback.sql`, which is the only
migration since 0022 shipping without one, and that gap should be closed in the same pass.

Recorded as item 8 in `docs/engineering-review-backlog.md`.

## Already decided

**#217 is closed as superseded by #218.** Not by judgement: `fix/parser-sectional-key` carries two
commits, and the second is `83e6b48` — #217's only commit. It is the parent of #218's own commit, so
GitHub listed it first under a title that said "parser" only. #218 has been retitled and its body
corrected so the reviewer sees both findings.

## Pending — needs an approval, 2026-09-28

Two PRs are open and green, blocked on a ruleset setting rather than on review feedback.

| PR | What | Size |
|---|---|---|
| **#237** | focus ring to the 2px the spec asks for, and the `prefers-reduced-motion` block the spec requires and the code lacked | 18 files, +41/−26 |
| **#238** | `docs/design-system.md` — mark the visual half superseded, correct three checkably false claims | 1 file, +56/−9 |

`main` is at `5547150`. The visual contract gate runs in CI between `lint` and `test`, 10 rules,
0 failing. 235 tests. Neither PR is in this queue's four phases, and neither collides with it
except **#195**, which shares `src/features/moderation/components/CaseDetail.jsx` with #237 and will
need a rebase.

**The blocker is a ruleset setting, not a review.** The `PR` ruleset sets
`require_last_push_approval: true`, so the last person to push cannot approve their own PR. The
branches were pushed by an agent, so it cannot approve them and they sit at `REVIEW_REQUIRED`.
The fix is one boolean, and it is worth deciding deliberately rather than per-PR:

- **`require_last_push_approval: false`**, keeping `require_code_owner_review: true` and raising
  `required_approving_review_count` from `0` to `1`. A review is still required; the maintainer
  can be the one who gives it. **Recommended** — the current setting means "nobody may approve
  alone", which in a one-maintainer repo with agent-authored branches means "never".
- **A bypass actor** for the maintainer, leaving the rest of the control intact. More fragile.

Worth noting while it is open: the same ruleset has `required_approving_review_count: 0` alongside
`require_code_owner_review: true`. As written, the review rule demands code-owner review while
requiring zero approvals, so it does not gate. If the intent was for it to gate, that is the second
half of the same change.

## Gates

Every PR in this queue passed all four locally: `pnpm test`, `pnpm typecheck`, `pnpm lint`,
`pnpm build`. **Typecheck is not in CI** — `AGENTS.md` says so and it is still true — so it was run
by hand on every branch.

A note that matters for reviewing any PR in this queue: **`pnpm build` does not verify imports.** With
a deliberately broken import it prints the missing-export error and **exits 0**, still writing
`dist/`. `pnpm lint` is the real gate — `no-undef` catches it, from `eslint:recommended`.
