# Proposal: Equal-timestamp offline conflicts need a recorded tie-break

> Change: `fix-offline-tie-break`
> Finding: **D** of the 10 discrepancies (`odd/tasks/music-theory-discrepancies.md`)
> Status: proposed. Reproduced by execution. **The tie-break key is derived, not specified** —
> see Approach. **This is the only finding of the ten whose Gherkin requires new storage**, so it
> needs a migration, and the migration number is deliberately left open.
> **[Superseded — see "Correction at apply time": the key is the per-operation `opKey` uuid, and
> the migration number is resolved at `0037`.]**
>
> **Path note:** on `main` today the module is `src/lib/setlistCollab.js`; after M0a it becomes
> `src/domain/setlist/collab.js`. Its characterization suite is the matching
> `src/domain/setlist/collab.test.js`, **shared with finding H**. Neither the test file nor
> `src/domain/` exists on `main` — M0b (#171) has not merged.
> **[Superseded — see "Correction at apply time": the relocation landed, M0b (#171) merged, and
> `src/domain/` exists.]**

## Correction at apply time (2026-10-13)

This section records what changed against the proposal's assumptions when the change was
implemented. The prose below is left intact so the record of what was proposed stays readable;
each superseded passage carries a short inline pointer back here.

- **The tie-break key decision is reversed.** The proposal chose `args[0]` (the `userId`) and
  rejected a per-operation `uuid` by YAGNI. The **per-operation `opKey` uuid was adopted instead**.
  The offline queue mints it at enqueue (`newOpKey()` in `src/offline/queue.js`), so
  `(queuedAt, opKey)` is a genuine total order with no authorship semantics — the same user on two
  devices at the same millisecond still collides on `userId`, while a uuid pair does not. This is
  precisely the maintainer overrule the proposal asked to make visible rather than bury.
- **Paths relocated.** `src/lib/setlistCollab.js` → `src/domain/setlist/collab.js`;
  `src/lib/offlineSync.js` → `src/offline/drainer.js`, with the queue itself in
  `src/offline/queue.js`. **M0b (#171) has merged**, so the proposal's "no finding before M0b" gate
  is satisfied and `src/domain/` exists.
- **Migration number resolved:** `0037_offline_tie_break.sql`. Verified against `origin/main` =
  `a610dd0` (2026-10-13): `main` carries **34** migrations numbered `0001`–`0036` with `0021`/`0022`
  free; `0036` is taken by `0036_guardian_approve_public_sharing.sql`; this change takes `0037`, so
  the next free number after it lands is `0038`. The proposal's `0028` high-water mark and its
  `0020`–`0022` "claimed race" claim are both stale.
- **Storage shape as shipped.** An **append-only table** `public.setlist_conflict_resolutions` plus
  the `apply_setlist_item_op` RPC, which arbitrates server-side under a per-pair advisory lock —
  rather than a column the client writes. The record stores the applied rule (`rule` — the closed
  vocabulary `later-timestamp` | `op-key`), satisfying the `:51` half without a client-driven write.

## Intent

`features/offline-edit-conflict-policy.feature:47-51` requires two things of a conflict whose
writes carry the same timestamp: the app *"applies the recorded tie-break rule"*, and *"the
applied rule is stored with the resolution so every device reaches the same result"*.

Today neither half exists. On an exact tie no rule runs at all, and there is nowhere to store
one.

## Problem

**The primary order is already specified and already implemented.** `:14` requires that *"the
write with the later timestamp becomes the current chorus chords"*, and `reconcileSetlistOp`
already compares `queuedAt`. That part is correct and this change does not touch it.

**What the spec does not name is which value breaks an exact tie.** The comparison at
`src/lib/setlistCollab.js:122` is a strict `>`, so on an exact tie `serverNewer` is false and the
op falls through to the replay branch. Verified by execution:

```
empate exacto de queuedAt, ambos ausentes en el servidor:
  device X draina A: {"drop":false}
  device Y draina B: {"drop":false}
```

Neither write is marked superseded, both replay, and the winner is decided by **drain order** —
which differs per device. That is the precise opposite of `:51`'s requirement that every device
reach the same result.

**The storage half is a real gap, verified by grep.** No migration among the 25 files in
`supabase/migrations/` contains a `resolution_rule`, `tie_break`, `tiebreak` or `superseded`
column — the pattern returns nothing across all of them. The spec requires the applied rule to be
*"stored with the resolution"*, and there is nowhere to put it.
**[Superseded — see "Correction at apply time": the storage shipped as the append-only
`public.setlist_conflict_resolutions` table plus the `apply_setlist_item_op` RPC, not a column.]**

**Migration numbering is a constraint, not a choice.** Filename order is dependency order. The
highest current file is `0028_import_pipeline.sql`, and `0020`–`0022` are **absent** — a
numbering race between parallel branches that several open branches already claim, not a
reservation. Before a name is chosen, every open branch must be checked:
`git branch -r | xargs -I{} git ls-tree --name-only {} -- supabase/migrations/`. **This proposal
does not pick a number** — `0029` and a free slot in the 0020–0022 gap make materially different
dependency claims, and that is a decision, not a detail.
**[Superseded — see "Correction at apply time": the high-water mark is `0036`, not `0028`, and the
number is resolved at `0037`.]**

## Scope

### In scope

- The tie-break: which value orders two conflicting writes whose `queuedAt` is equal, and where
  that rule is applied.
- **Recording the applied rule on the resolution** — the migration, the column, and the write —
  plus whatever else the record carries so the rule stays auditable.
- Cross-device agreement: the rule must be computable from data both devices already hold, with
  no coordination round-trip.
- Delta spec for the `offline-edit-conflict-policy` capability, the tie-break requirement only,
  traced to `features/offline-edit-conflict-policy.feature:47-51`.

### Out of scope

- **Finding H** (`fix-reconcile-silent-drop`, open in PR #185) — the silent drop on
  `op.queuedAt || 0` at `:120` and on a short `args` at `:119`. Same module, adjacent line,
  **different decision, not to be folded in and not to be duplicated here.** The boundary is
  stated explicitly below.
- Findings A, B, C, E, F, G, I, J; the notification the losing editor receives (`feature:16-20`)
  and the identical-edit fast path (`:42-46`), both specified and neither missing a rule; and the
  general shape of the offline queue, the service worker, or the drain scheduling.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `offline-edit-conflict-policy` (new capability spec — the repository has no
  `openspec/specs/offline-edit-conflict-policy/` today, so this change creates it)

## Approach

**The honesty first, because it is the point.** `feature:50` names *the recorded tie-break rule*
and `:51` constrains it; **neither says which rule it is.** What follows is a defensible reading
of the determinism constraint, not a specified fact. A maintainer who would rather mint a
per-operation `uuid` overrules it on one line, and that is a legitimate call. The job here is to
make the choice visible, not to disguise it as a requirement.

**The constraint that decides it.** *"so every device reaches the same result"* means the
tie-break must be computable from data both devices already hold, with **no coordination
round-trip**. The queued op is `[...ops, { seq: ops.length, ...op, queuedAt: Date.now() }]`
(`offlineQueue.js:71`). Three candidates, one survivor:

| Candidate | Held by both devices? | Verdict |
|---|---|---|
| `seq` | no — **per-queue**, so each device starts at 0 | **rejected.** Verified: the first op on two devices both carries `seq: 0`. Valid only within one device's queue; comparing it across devices is meaningless. |
| `args[0]` (the `userId`) | yes — the op's own author | **chosen.** Different on each device, comparable by a total order with no coordination, and **already present**. The only value that satisfies the constraint without adding a field. **[REVERSED at apply time — the per-op `opKey` uuid was adopted; see "Correction at apply time".]** |
| a new per-op `uuid` | would be, once minted | **rejected by YAGNI** — a new field, and better only if a maintainer decides the tie-break must not encode authorship. **[ADOPTED at apply time — a maintainer did decide; see "Correction at apply time".]** |

**How it is applied.** Compare `queuedAt` first, unchanged. On equality, order the two writes by
`args[0]` and let the greater one win, so the rule is a total order and the same pair resolves
the same way on every device. The comparison runs over the **string**, and the equality test on
the resolved millisecond value, not on string form.
**[Superseded — see "Correction at apply time": equality now orders the writes by the per-operation
`opKey` uuid compared as a lowercased string, not `args[0]`.]**

**One thing to verify before relying on `args[0]`.** It is the `userId` for every op the setlist
reconcile path handles — `setlists.js:576` and `:698` queue `args: [userId, setlistId, songId]`,
matching `reconcileSetlistOp`'s `op.args?.[2]`. But the convention is **not universal**:
`substitutions.js:247` queues `args: [requestId, true]`. So `args[0]` is safe for the ops in this
path, and the apply-time work is to confirm per `op.name` rather than assume it.

**The storage half.** Write the applied rule onto the resolution record — the rule *identifier*,
not just its outcome, so a device replaying the same pair can verify it reached the same answer.
The rule is a small closed vocabulary, which is what makes it storable and auditable. Column
name, table, and migration number are all apply-time decisions; the requirement from `:51` is not.

**The boundary with finding H, stated precisely.** With `const queuedAt = op.queuedAt || 0`, a
**missing** timestamp is not an equal-timestamp conflict at all — it is an *unidentifiable
operation*, and it must never reach the tie-break. H owns that case; this proposal is only about
which rule resolves a *genuinely equal* timestamp. If D forces a signature change to
`reconcileSetlistOp` — it may, to pass the rule or the resolution record — **the two changes must
coordinate at apply time. D does not wait on H, and H does not absorb D's migration.**

**Scenarios to add**, under MERGE AND TIE-BREAK: equal `queuedAt` resolving the same way
regardless of which the device drained first, the core of `feature:51`; the same pair replayed
twice; two devices holding the same conflicting pair and asserting one winner; an op whose
`queuedAt` is **absent** never reaching the tie-break, the boundary with H; and the applied rule
present on the stored resolution.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/setlistCollab.js` | Modified | the tie-break in `reconcileSetlistOp` (`:118-132`) and possibly its signature |
| `src/domain/setlist/collab.test.js` | Modified | the characterization suite, **shared with finding H**; a real fix inverts the tie-break assertions. The specific assertion is identified at apply time — H owns `:88` |
| `supabase/migrations/<N>_<name>.sql` | New | stores the applied rule on the resolution. **Number and name deliberately not chosen here** — check every open branch first |
| `src/lib/offlineSync.js` | Modified | writes the applied rule onto the resolution record; identified at apply time |
| the conflict UI | Modified | to show which rule resolved it — **identified at apply time**; this proposal has not traced the render path |
| `features/offline-edit-conflict-policy.feature` | Modified | the new tie-break scenarios |
| `openspec/specs/offline-edit-conflict-policy/spec.md` | New | capability spec, tie-break requirement only |

**[Superseded — see "Correction at apply time": the pre-relocation paths are
`src/domain/setlist/collab.js` and `src/offline/drainer.js` (plus `src/offline/queue.js`); the
storage is the append-only `public.setlist_conflict_resolutions` table plus the
`apply_setlist_item_op` RPC (`0037_offline_tie_break.sql`), not a column.]**

## Verification

- `pnpm test` — `collab.test.js` is the gate, and it is the same file finding H touches, so the
  two diffs must be read together. A real fix **inverts** the tie-break assertions rather than
  editing them to accept anything.
- `supabase db reset`, then the migration applied and a `scripts/smoke/` file run the documented
  way (`AGENTS.md`: fresh reset before every run, single run only, `-v ON_ERROR_STOP=1`). A new
  migration ships with a smoke file or it ships unverified. Then `pnpm typecheck && pnpm lint &&
  pnpm build`.
- Manual, and this is the half that proves the spec's actual claim: two devices, one conflicting
  pair, the same `queuedAt`, both reconnect — they must land on the **same** winner, and the stored
  resolution must say which rule decided it. A unit test can assert the comparator; only two real
  devices can assert agreement.
- **No finding may be implemented until M0b (#171) merges** — the characterization suite is the
  only regression net this repository has, and this change shares a test file with finding H,
  which is where the risk of an unintended change is highest.

## Rollback

This is **the only finding of the ten whose Gherkin requires new storage**, so rollback is not a
plain revert. (F/G's `retired_at` column is contingent on an option its proposal does not
choose; this one is not contingent on anything.) The code half reverts cleanly. The column does not: a resolution row that already carries a rule
value loses the audit trail `feature:51` requires if the column is dropped. Revert the code and
leave the column in place — additive, nullable, no behaviour — unless a later change needs it
gone. **The decision to make the column nullable and additive rather than required is what keeps
this revertible at all**; a `not null` column on a table with existing rows is not.

## Frozen decisions

1. **The Gherkin is not edited to match the code.**
   `features/offline-edit-conflict-policy.feature:47-51` is the product source of truth, and this
   change conforms to it.
2. **The bug-pinning assertions invert; they do not get deleted.** The characterization suite is
   what made this reproducible, and `collab.test.js` is shared with finding H — loosening an
   assertion there to clear a gate here is the failure mode the delivery agreement forbids.
3. **The tie-break key is derived from the determinism constraint, not specified by the
   Gherkin.** `feature:50` names *the recorded tie-break rule* and `:51` constrains it; neither
   says `args[0]`. It is recorded as a decision precisely so that a maintainer overrule is visible
   rather than buried. `seq` is likewise never the cross-device key, since it is per-queue and two
   devices collide at `0` — settled by `offlineQueue.js:71`, not by preference.
4. **The migration number is deliberately left open.** `0020`–`0022` are a claimed race between
   open branches and `0028` is the high-water mark; the number encodes a dependency claim, so it
   is chosen against every open branch at apply time, not in a proposal.
5. **Finding H is neither merged into this change nor duplicated by it.** A **missing**
   `queuedAt` is an unidentifiable op (H), not an equal-timestamp conflict (D). If the signature
   of `reconcileSetlistOp` must change for D, the two coordinate at apply time; D does not wait
   on H.
6. **The rule is stored as a name, not only as an outcome.** A device that can see *which* rule
   ran can verify it got the same result; an outcome-only record satisfies the letter of
   `feature:51` and not the intent.
