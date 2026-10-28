# Offline conflict tie-break (finding D) — execution record

> Feature branches: `fix/offline-tie-break` (PR1 = WU1) and `fix/offline-tie-break-pr2`
> (PR2 = WU2 + WU3), both cut from `origin/main` = `a610dd0`
> OpenSpec change: `openspec/changes/fix-offline-tie-break/`
> Migration: **`0037`** — verified free on every remote branch on 2026-10-13, and re-verified on
> 2026-10-13 against `origin/main` = `a610dd0` from the branch: `main` carries **34** migrations
> numbered `0001`–`0036`, of which `0036_guardian_approve_public_sharing.sql` is **taken** — so
> `0037` is the next free number on `main`, and `0038` follows this change. (The planning note that
> the file "must sort after `0036`" holds; the earlier reading that `0036` was *free* was stale.)
> Status: **WU1 merged; WU2 + WU3 rebased and open as PR #366. Feature complete, awaiting human
> review.** PR #365 merged to `main` on 2026-10-13 as merge commit **`8a9b1b2`** — by explicit
> maintainer decision with an **admin bypass** of the ruleset's 1-approval rule (asked and answered
> this session; see Delivery). PR1's two commits are therefore ancestors of `main`, so PR2's rebase
> onto the updated `main` dropped them cleanly and its diff carries no part of PR1. All gates were
> re-run **after** the rebase, on HEAD `808eb37`. Independent verification found and fixed **one
> concurrency defect (WU1)** and **one client-mirror defect (WU2)** — see Progress.

## Objective

Make `features/offline-edit-conflict-policy.feature:47-51` true: when two conflicting
offline writes carry the **same timestamp**, the app applies a **recorded** tie-break rule,
and **the applied rule is stored with the resolution so every device reaches the same
result**. This is finding **D**, the last of the ten spec discrepancies and the only one of
the ten whose Gherkin requires new storage.

## Problem

`reconcileSetlistOp` (`src/domain/setlist/collab.js:242`) orders my queued op against the
server copy with a strict `>` at `:268`:

```js
const serverNewer = !!server?.updatedAt && new Date(server.updatedAt).getTime() > op.queuedAt
```

`server.updatedAt` is `setlists.updated_at`, bumped by the trigger
`setlist_items_bump_setlists_updated_at` (`0006_band_collaboration.sql:295`) with the
**server** clock. On an exact tie the comparison is false, both writes replay, and the winner
is decided by **drain order**, which differs per device — the precise opposite of the
determinism claim.

### Why the existing proposal is not enough (verified 2026-10-13)

`openspec/changes/fix-offline-tie-break/proposal.md` derives the key as `args[0]` (the op's
author `userId`). The op half is correct — `setlists.js:592` and `:714` both queue
`args: [userId, setlistId, songId]`. **The other half does not exist.** The client's server
read (`fetchServerSetlist` → `fetchSetlistById` → `flattenSetlist`) exposes only `itemIds`,
`updatedAt`, versions, agreed keys and MIDI. It carries **no other-writer identity and no
stored `queuedAt`**, and `grep -rniE 'tie.?break' supabase/` returns nothing.

Consequence, checked by reasoning over the code: on a tie, neither simple rule works.

| Rule | Result |
|---|---|
| "always lose" | **Both writes are lost.** The first drainer compares against a `server.updatedAt` its own write already set to the same millisecond. |
| "always win" | Both apply; **drain order decides** — the current defect. |

So the deciding value must be visible to **both** sides. The server record has to carry the
last conflicting write, and it must be written **atomically with the item change** — which a
trigger cannot do, because `setlist_items_bump_setlists_updated_at` cannot see the client's
`queuedAt`/op key. Hence an RPC, not just a client comparator. This is why D is not a
pure-logic one-PR change.

## Decision record

### 1. Tie-break key: a per-operation uuid (`opKey`) — user decision, 2026-10-13

Chosen over the proposal's `args[0]` (author `userId`) after both were laid out with their
trade-offs. Reasons recorded:

- A uuid v4 pair never collides, so `(queuedAt, opKey)` is a **genuine total order**. The
  author key is **not**: the same user on two devices with the same millisecond still ties,
  and `seq` cannot break it (it is per-queue — two devices collide at `0`).
- The tie-break carries **no authorship semantics**. "The lexicographically greater user id
  wins" reads as one user outranking another in a history the losing editor can see; an
  opaque uuid is defensible as pure chance.
- Accepted cost: the op shape changes (a new field on every queued op, in `offline/queue.js`
  `enqueueOp` and its contract) and the audit trail is not human-readable.

Rule name in `rule` (the closed vocabulary): `'later-timestamp'` for the primary order,
`'op-key'` for the tie.

### 2. Where the decision lives: the server arbitrates, the pure function mirrors it

The client comparator **cannot** be authoritative under concurrency: two devices draining at
once both read "no prior resolution" and both decide to apply. So:

- **The RPC is the arbiter.** It compares, applies or refuses, and records the resolution in
  one transaction.
- **`reconcileSetlistOp` mirrors the rule** so the notice is right and the logic stays a
  tested pure unit. Proposal frozen decision #2 requires the bug-pinning assertions in
  `collab.test.js:123-129` to be **inverted, not deleted** — that is only possible if the
  function really holds the rule.
- **Named risk:** the rule is expressed twice (SQL + JS). Mitigation: identical fixtures in
  the smoke file and the unit test, with a comment in both pointing at the other.

### 3. Storage: one append-only table, read back through the existing select

`public.setlist_conflict_resolutions` — one row per applied resolution. The comparator reads
the latest row for `(setlist, song)`; the audit trail reads the same rows. One storage site,
not two.

### 4. Scope: replay and online writes both stamp

If only the replay path stamped, a replay racing an online edit would compare against stale
metadata. Both paths for the two ops route through the RPC. This is the invasive part:
`setlists.addSongToSetlist` / `removeSongFromSetlist` change their write path. Pre-authorized
by `AGENTS.md` delivery workflow clause 3 (fix what breaks to land the unit honestly).

### 5. Out of scope

- **Finding H** — a missing `queuedAt` is an unidentifiable op, not an equal-timestamp
  conflict. Same module, different decision, already landed (`e34e7c6`). Not reopened.
- The pre-existing **clock-domain** question: `op.queuedAt` is a client clock and
  `updatedAt` a server clock, so the *primary* order is already approximate under skew. D
  makes the tie deterministic; it does not re-base `queuedAt` onto server time. Named here so
  it is a known limit, not a surprise.
- Any other op family (`substitutions.js:247` queues `args: [requestId, true]`, so no
  authorship or ordering assumption transfers).

## Constraints

- `0037` is the number. Filename order is dependency order; the file extends setlist schema,
  so it must sort after `0036`. Verified against every remote branch.
- Migration numbering is a moving target in this repo — re-run
  `git branch -r | xargs -I{} git ls-tree --name-only {} -- supabase/migrations/`
  immediately before merging, not just before writing.
- The Gherkin is **not** edited to match the code. The rule is derived from the determinism
  constraint and recorded as a decision so a maintainer overrule stays visible.
- A migration ships with a smoke file or it ships unverified. Smoke rules: fresh
  `supabase db reset` first, **single run only** (not idempotent), `-v ON_ERROR_STOP=1`,
  fixed UUID literals in the `30000…6xx/7xx/8xx` families, mandatory preamble
  (`set client_min_messages to notice`, `tmp_assert`, `tmp_expect_error`).
- `crypto.randomUUID` gets the guarded fallback already used at
  `src/data/repositories/pdfCharts.js:59` — do not assume `crypto` exists.

## Test mode

- **TDD: off.** Source: `openspec/config.yaml:13` (`strict_tdd: false`). Not re-litigated.
- Runner: `pnpm test` (Vitest 5, node env). Do not invent a runner.

## Authorized scope

Source writes limited to: `supabase/migrations/0037_*.sql`, `scripts/smoke/0037-*.sql`,
`src/offline/queue.js`, `src/offline/drainer.js`, `src/domain/setlist/collab.js`,
`src/domain/setlist/collab.test.js`, `src/data/repositories/setlists.js`,
`features/offline-edit-conflict-policy.feature`, `src/test/gherkin/**`,
`openspec/specs/offline-edit-conflict-policy/**`, `openspec/changes/fix-offline-tie-break/**`,
`docs/master-plan.md`, this file. Nothing else.

## Tasks

- [x] **WU1 — migration `0037` + smoke** (`supabase/migrations/0037_offline_tie_break.sql`,
  `scripts/smoke/0037-offline-tie-break.sql`)
  - `public.setlist_conflict_resolutions`: `id`, `setlist_id`, `song_id`, `op_name`
    (check: the two reconciled op names), `winner_author_id`, `winner_queued_at`,
    `winner_op_key uuid`, `rule` (check: `'later-timestamp' | 'op-key'`), `created_at`.
    Append-only; select policy for setlist members; no update/delete grants.
  - `public.apply_setlist_item_op(p_setlist_id, p_song_id, p_op_name, p_queued_at, p_op_key)`
    returns `jsonb` → `{applied, rule, superseded}`. **Follow the shape and permission model of
    the closest precedent, `public.move_setlist_items` (`0009_notifications_activity.sql:56`) —
    an RPC that mutates setlist items — rather than inventing a permission model.**
    Compares against the latest resolution for `(setlist, song)`:
    `p_queued_at > last.queued_at` → apply, `'later-timestamp'`;
    equal → compare `p_op_key` text > `last.op_key` text → apply, `'op-key'`, else
    `{applied:false, superseded:true}`; no prior row → apply, `'later-timestamp'`.
    Applies the item change and inserts the resolution row in the same transaction.
  - Smoke file with the mandatory preamble, fixed UUID literals, `expects N PASS / 0 FAIL`.
    Must cover: no-prior-row applies; later timestamp applies; **equal timestamp, greater
    opKey applies**; **equal timestamp, lesser opKey is superseded and writes nothing**; the
    recorded `rule` value; two calls with the same op in either order land on the same winner.
- [x] **WU2 — client** — commit `e97d2b2` (5 files, +421/−76), amended from `1d2533c` after
  verification found a defect; see Progress.

  - `src/offline/queue.js`: mint `opKey` (guarded `crypto.randomUUID`) in `enqueueOp`,
    persist it, expose it on pending ops. Done — `newOpKey()` at `:109`; the pre-existing
    `outboxKey()` `:89` was renamed to free the `opKey` name for the per-op uuid that matches
    SQL `p_op_key`/`winner_op_key` (9 call sites updated).
  - `src/domain/setlist/collab.js`: extend the `ReconcileServer` typedef with the latest
    resolution for the song; on equal `queuedAt` compare `op.opKey` vs the server's key and
    let the greater win; return the rule on the decision. **The first cut was wrong** — it
    compared the op against the setlist's `updatedAt` (a server clock) instead of the recorded
    `winner_queued_at` (a client clock), so in the realistic ordering the losing op was dropped
    as `superseded` *before* the tie was ever reached. Corrected: the recorded resolution
    decides first, the legacy `updatedAt` heuristic is the fallback for songs with no usable
    recorded resolution only, and a keyless legacy op now **replays** (the write path mints a
    key) instead of dropping.
  - `src/data/repositories/setlists.js`: route both write paths of the two ops through the
    RPC; extend `fetchSetlistById`'s select to embed the latest resolution row. Done — the
    embed at `:289` was verified live (HTTP 200 with real rows) rather than assumed, and the
    `flattenSetlist` reduce was proven order-independent across all 6 permutations of three
    same-timestamp rows.
  - `src/offline/drainer.js`: send `opKey`; treat the RPC outcome as authoritative for
    drop/notice; keep the `reason` vocabulary honest. Done.
  - `src/domain/setlist/collab.test.js`: **invert** the tie-break assertion at `:123-129`
    (frozen decision #2). Never delete it, never loosen it into accepting anything. Done —
    inverted, not loosened; a teeth harness proves the new tie tests **fail** against the
    pre-correction commit `1d2533c`, so they are not tautological.
- [x] **WU3 — spec, Gherkin, docs** — commit `83e1db1` (5 files, +241/−30).
  - `features/offline-edit-conflict-policy.feature`: **not edited — deliberate deviation from
    the plan above.** The file already specifies the requirement at `:47-51` ("the app applies
    the recorded tie-break rule" / "the applied rule is stored with the resolution"), and frozen
    decision #3 says the Gherkin deliberately does **not** name the rule. Adding scenarios that
    name the `opKey` rule would have contradicted that decision and over-specified the product;
    the new coverage went to the BDD *verification* tier, the capability spec and the unit/smoke
    tiers instead, which is where the determinism property is actually provable.
  - `src/test/gherkin/steps/collab.js` + `src/test/gherkin/collab.test.js`: three scenarios
    added to the BDD tier (Equal timestamps resolve by the recorded tie-break rule; The losing
    writer is superseded under the same recorded rule; The same pair reaches one winner
    regardless of reconcile order) plus six step definitions and the shared `TIE_MS` /
    `…7f0`/`…7f1`/`…7f2` fixtures kept in lockstep with the `collab.js` demo and the smoke file.
    `pnpm test:gherkin` 41 → **44**.
  - `openspec/specs/offline-edit-conflict-policy/spec.md`: new capability spec, one requirement
    (the tie-break) traced to `:47-51`, with the adopted rule recorded as a decision.
  - `openspec/changes/fix-offline-tie-break/proposal.md`: a `## Correction at apply time`
    section; superseded passages (the `args[0]` key, pre-relocation paths, the open migration
    number, column storage) keep their original prose with inline pointers, so the record of
    what was proposed stays readable.
  - `docs/master-plan.md`: `0036` is no longer free (`0036_guardian_approve_public_sharing.sql`
    took it), this change takes `0037` and leaves `0038` next, and finding D is fixed in review —
    pending merge, **not yet on `main`**. Nine edits; §0 table, §3 banner, D's row, the three
    paragraphs, the decision list and the N1 block.
  - **Known remaining doc rot, flagged not fixed:** `docs/bdd-coverage-map.md:72` still says the
    code has no tie-break, and `docs/handbook.html` (generated from `docs/`) repeats it. Both are
    out of WU3's declared scope: that paragraph is a two-item finding (D + the still-open
    music-theory slash-bass contradiction), so correcting half of it would leave it internally
    inconsistent, and the handbook is a generated artifact regenerated by its own unit.
    `scripts/build-docs-viewer.mjs` regenerates it when that unit lands.

## Acceptance criteria

1. The three new Gherkin scenarios pass; `pnpm test:gherkin` is green.
2. `pnpm test && pnpm typecheck && pnpm lint && pnpm build` all exit 0.
3. A fresh `supabase db reset` then the smoke file reports `0 FAIL`.
4. The tie-break assertions in `collab.test.js` are inverted, not deleted or loosened.
5. Two devices holding the same conflicting pair reach the same winner **regardless of drain
   order**, asserted in the smoke test by calling the RPC in both orders.
6. The applied rule is readable from `setlist_conflict_resolutions` after the resolution.

## Checks per task

`pnpm test && pnpm typecheck && pnpm lint && pnpm build` for WU2/WU3; WU1 additionally
`supabase db reset` + the smoke file.

## Delivery

- Forecast at planning: **~545 authored changed lines** (WU1 ~210, WU2 ~125, WU3 ~210).
  Above the ~400 budget heuristic, so this ships as **chained PRs**, two slices.
- Slice boundaries: **PR1 = WU1** (migration + smoke, self-contained). **PR2 = WU2 + WU3**
  (client + spec + docs) — it depends on PR1's RPC existing.
  This record lands in **PR2**, not PR1: PR1's accepted size exception rests on the SQL+smoke being
  indivisible, and this file is a feature-level record that is only final when WU3 closes.
- Strategy: `ask-on-risk` (default) → chain strategy asked once at planning. **Answer
  (2026-10-13): `stacked-to-main`.** PR1 merges to `main` first; PR2 branches from the
  updated `main` and also targets `main`, so PR2 does not carry PR1's diff into review.
- RDD is **on** (global, read-only status checked 2026-10-13). Per work-unit commit, run
  `gentle-ai review assess --cwd <repo> --base-ref <last reviewed boundary> --committed-only
  --json` and act on the tier. First boundary is the branch point.
  **Update (2026-10-13): native review must NOT be started on this runtime.** The installed
  OpenCode is **v2.0.25 = V2**, and the Review Execution Contract states the V2 review transport
  is unavailable — *"Do not start a review or launch reviewer subagents on V2."* An earlier note
  in this file attributed the block to a staged `relay_unavailable` adapter; the accurate reason
  is the V2 contract guard. The lifecycle *is* responsive for this candidate — `review status`
  returns `action: "start"` with exact tokens — and those tokens are deliberately **not** invoked,
  because the guard forbids starting the review, not because the transport failed. Per the Native
  Checking Contract an unavailable verifier preserves its typed unavailable result and never
  becomes a fabricated PASS. The substitute for this feature is **one fresh-context independent
  adversarial verifier per slice** plus the parent spot check. That substitute is not a native
  review receipt and is not reported as one.
  **Risk tiers recorded (no native review executed):** WU2's corrected candidate assessed
  **`medium`** (`changed_paths: 5`, `changed_lines: 497`, `review_due: true`,
  `review_due_reason: slice_budget_reached`, base-ref `cc74151`), so the candidate is the PR
  slice rather than the single commit — which is exactly the two-PR shape this plan chose. WU3
  is documentation and BDD-tier tests only, well inside the per-unit budget.
- **Size exception (2026-10-13): maintainer-accepted.** PR1 is 795 authored changed lines
  (235 SQL + 560 smoke) against a ~400 heuristic. One honest slicing pass found no cohesive
  split: a migration ships with its smoke or it ships unverified, and the smoke carries the
  coverage that caught the concurrency bug. Recorded in the PR body under the repo template's own
  clause ("≤400 changed lines, or this PR is part of a documented `-prN-` chain").
- Merge stays human. Open the PR and request a reviewer; never merge.
  **Known limitation (2026-10-13):** the reviewer request is structurally impossible here —
  `gh` is authenticated as `davidjesus516`, so the PR author *is* `davidjesus516`, and GitHub
  rejects self-review requests (`HTTP 422 "Review cannot be requested from pull request author."`).
  Recent PRs (#358, #360) also merged with no recorded review. Reported, not silently skipped.


## Progress

| When | Unit | Outcome | Evidence |
|---|---|---|---|
| 2026-10-13 | planning | Feature record created; key decided (`opKey`); migration number verified `0037` free on all remote branches; branch `fix/offline-tie-break` cut from `origin/main` `a610dd0`. No source write yet. | this file |
| 2026-10-13 | WU1 correction | **Independent verification found a MAJOR defect and it was fixed.** The arbiter read the latest resolution with an unlocked SELECT, and `setlist_conflict_resolutions` has no unique guard on `(setlist_id, song_id)`, so under READ COMMITTED two concurrent drains of the SAME pair both read "no prior row" and both applied — the second add dying on `UNIQUE (setlist_id, position)` (`0001_init.sql:188`) with 23505 and the winner decided by ARRIVAL ORDER. That falsified the change's own rationale (Decision #2). Fixed by taking `pg_advisory_xact_lock(hashtextextended(pair))` before the resolve SELECT, which makes read-decide-write atomic per pair. Also: the smoke now exercises `removeSongFromSetlist` (applying + superseded, item-side "writes nothing"), and a regression assertion reads the lock back from `pg_locks`. | smoke **40 PASS / 0 FAIL** (fresh reset, re-run by the parent); `pnpm test` 404/404 after the correction. Commit `cc74151` (2 files, +154/−20) |
| 2026-10-13 | PR1 | Branch `fix/offline-tie-break` pushed. The branch's upstream was misconfigured to `origin/main`, so a bare `git push` would have targeted main; fixed with an explicit `-u origin fix/offline-tie-break`. **PR #365** opened against `main` (795 additions / 2 files, CI running). Size exception accepted by the maintainer and recorded in the PR body. The reviewer request was attempted and REJECTED by GitHub (HTTP 422, self-review) because the `gh` session *is* the PR author. | `gh pr view 365` |
| 2026-10-13 | WU1 | Migration + smoke written and committed. `pnpm test` 404/404 (17 files) exit 0; `pnpm typecheck` exit 0; `pnpm lint` exit 0; `pnpm build` ✓ 5.14s; `check-visual-contract.sh` 12 rules / 0 failing; fresh `supabase db reset` then smoke **33 PASS / 0 FAIL**. Parent spot-check re-ran `pnpm test` → 404/404 exit 0. A post-smoke comment-only typo fix (`00065` → `0009:65-71`) was re-verified against the final file (reset + smoke re-run). JS gates ran on source byte-identical to the final files. Commit `473903f`. | `git show --stat 473903f` (2 files, 661 insertions); smoke `33 PASS / 0 FAIL` |
| 2026-10-13 | WU2 | Client mirror + RPC routing implemented on `fix/offline-tie-break-pr2` (cut from `cc74151`). `queue.js` mints the per-op `opKey` (`newOpKey()`, guarded `randomUUID`); `collab.js` compares the op against the **recorded** resolution (`winner_queued_at` / `winner_op_key`) with the legacy `updatedAt` heuristic demoted to a fallback; both item write paths route through `apply_setlist_item_op`; the embed is read back in `fetchSetlistById`; the tie-break assertions are inverted. Gates: `pnpm test` 407/407 (17 files), `typecheck` exit 0, `lint` exit 0, `test:gherkin` 41/41 (5 files), visual 12 rules / 0 failing, `build` ✓. | commit `e97d2b2` (5 files, +421/−76) |
| 2026-10-13 | WU2 verification + correction | **Verifier #1 returned `partial` with a confirmed HIGH defect:** the mirror keyed its tie on the setlist's server-side `updatedAt` while the SQL compares against the client-side `winner_queued_at`, so in the realistic ordering (the winner has written, `updatedAt` is now newer than both ops) the losing op was dropped as `superseded` with **no rule** before the arbiter ever saw it — the exact determinism failure this change exists to close. The parent reproduced it independently in a scratch probe (`updatedAt = T+5s` → both keys returned `{drop:true, notice:true, reason:'superseded'}`; only a fabricated `updatedAt === queuedAt` fixture passed). Corrected as described in WU2 above, and the realistic server shape (`updatedAt` newer than both ops) is now a module-level fixture (`TIE_SERVER`) in the unit test so the fiction cannot be reintroduced. **Verifier #2 then returned PASS:** correction verdict CORRECT, 29/29 differential checks match the SQL arbiter, and a teeth harness proves the new tie tests **fail** against the pre-correction commit `1d2533c` (not tautological). Three pre-existing LOW/informational findings were recorded as follow-ups; none was candidate-caused. | verifier transcripts; `collab.js` mirror `:308-347`; `collab.test.js` `TIE_SERVER` |
| 2026-10-13 | WU3 | BDD-tier scenarios + capability spec + doc corrections. `pnpm test:gherkin` **44/44** (was 41), `pnpm test` **410/410** (17 files — the BDD tier is part of the default run, so both counts move by 3), `typecheck` exit 0, `lint` exit 0, visual 12 rules / 0 failing, `build` ✓. Parent spot check re-ran `pnpm test:gherkin` (44/44) and `pnpm test` (410/410) plus `lint`, `typecheck` and the visual gate, all exit 0. `features/offline-edit-conflict-policy.feature` deliberately **not** edited (see WU3 above); `docs/bdd-coverage-map.md:72` and the generated `docs/handbook.html` remain stale and are flagged, not silently fixed. Migration numbering re-verified from the branch: `origin/main` = `a610dd0` carries `0001`–`0036`, so `0037` is the next free number on `main` and `0038` follows this change. | commit `83e1db1` (5 files, +241/−30) |
| 2026-10-13 | PR1 merged → PR2 opened | **PR #365 merged to `main`** as `8a9b1b2`, with `--merge` and **not** squash: every recent PR in this repo carries two parents, and a squash would have made PR2's rebase replay `0037` onto a `main` that already contained it — a guaranteed conflict. Merged with an **admin bypass** of the 1-approval rule on the maintainer's explicit instruction; the standing "merge stays human" clause is overridden **for this PR only**, by the human who owns it. `fix/offline-tie-break-pr2` then rebased onto the updated `main`: clean, PR1's two commits dropped by patch-id, 3 commits and the identical `11 files, +998/−106` diff remaining. Pushed with `-u origin`, with the upstream and `branch.*.merge` verified by hand. **PR #366 opened** against `main`. All six gates **re-run after the rebase** on HEAD `808eb37`: `test` 410/410, `test:gherkin` 44/44, `typecheck` 0, `lint` 0, visual 12 rules / 0 failing, `build` ✓ 4.49 s, plus the `checkJs` baseline aliveness check (64 files, must stay > 1). Size: **1104 lines / 11 paths**, `risk: medium`, `slice_budget_reached` — the 1099 recorded at planning predated this record's final amend (+5 lines). | `git log --oneline origin/main..HEAD`; `gh pr view 366` |

## Next step

**Nothing is blocked. PR #366 is open and needs a human review, then a human merge.** The five-step
runbook that used to live here was executed on 2026-10-13, with one correction to the plan:

1. **Rebase — done, clean.** PR1's two commits were already ancestors of `main`, so `git rebase`
   dropped them by patch-id and replayed the three PR2 commits onto `8a9b1b2`. The diff came out
   byte-for-byte unchanged (`11 files, +998/−106`), which is the check that the rebase neither lost
   nor duplicated work.
2. **Push — done** with `-u origin fix/offline-tie-break-pr2`, and the upstream was verified by hand
   (`git rev-parse --abbrev-ref @{u}` → `origin/fix/offline-tie-break-pr2`; `branch.*.merge` →
   `refs/heads/fix/offline-tie-break-pr2`), because this repo has caught branches inheriting
   `refs/heads/main`.
3. **Reviewer request — attempted twice, and it fails silently. Worth recording.**
   `gh pr edit 366 --add-reviewer davidjesus516` prints the PR URL and exits **0**, while
   `reviewRequests` stays **empty**. The raw call
   (`gh api -X POST repos/…/pulls/366/requested_reviewers -f 'reviewers[]=davidjesus516'`) gives the
   real answer: **HTTP 422, "Review cannot be requested from pull request author."** So the
   `gh pr edit` path reports success for a request GitHub rejected — a silent no-op, not a
   notification. A PR comment mentioning `@davidjesus516` is therefore the actual notification, per
   the standing delivery workflow ("never self-approve", "notify, do not wait silently").
4. **Size exception — recorded in the PR body**: **1104 lines / 11 paths** (`risk: medium`,
   `slice_budget_reached`), with the WU2/WU3 split point offered to the maintainer as an option. The
   repo template's own clause ("or this PR is part of a documented `-prN-` chain") covers a chain
   member.
5. **Honest flags — all in the PR body**: the deliberate non-edit of the feature file and why; the
   remaining doc rot (`docs/bdd-coverage-map.md:72`, generated `docs/handbook.html`); the
   clock-domain limit; and the native-review limitation, **with the correction that PR1's body
   attributes the block to a staged adapter refusing with `relay_unavailable` when the accurate
   reason is the V2 contract guard**.

Still open afterwards, none of it blocking: the three pre-existing LOW/informational findings
verifier #2 recorded.

Carry forward for any later work on this path: the `opKey` is canonicalized (lowercase) before the
JS comparison; canonical uuid v4 strings were verified to order identically under the DB's
`en_US.UTF-8` collation and `C`, so the remaining risk is input normalization only.
