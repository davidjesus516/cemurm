# Proposal: Setlist add/remove reconcile drops operations silently

> Change: `fix-reconcile-silent-drop`
> Findings: **H** of the 10 discrepancies (`odd/tasks/music-theory-discrepancies.md`)
> Status: proposed. Reproduced. **This is the most severe of the pending findings** — it loses
> user work with no error anywhere.

## Intent

The offline write queue replays operations after reconnect. Two shapes of queued operation are
discarded without a notice, without an error, and without the user ever knowing the edit they
made on a plane did not land.

## Problem

`src/lib/setlistCollab.js` decides replay outcomes from the queued op's shape. Two cases fall
through to the same "superseded" branch that is meant for genuinely stale intents.

**1. A lost `queuedAt` is treated as "server is newer".**

```
const queuedAt = op.queuedAt || 0
const serverNewer = !!server?.updatedAt && new Date(server.updatedAt).getTime() > queuedAt
```

With `queuedAt` missing it becomes `0`, every real server timestamp is greater than `0`, so
`serverNewer` is true, and the operation is dropped with a notice. A dropped op *with* a notice
is defensible; a dropped op because of a **missing field** is a data-loss bug wearing the
costume of a correct decision.

**2. A short `args` array yields `songId === undefined`.**

```
const songId = op.args?.[2]
```

`addSongToSetlist` stores `args: [owner, setlist, songId]`. If `args` is short, `songId` is
`undefined`, the server lookup finds nothing, `present` is false, and the op takes the same
branch. The operation is discarded as superseded when it was never even identified.

There is **no scenario at all** for setlist add/remove reconcile in
`features/offline-edit-conflict-policy.feature` — its ten scenarios all cover field-level chord
edits. So neither case is specified, neither is tested, and both fail silently.

## Scope

### In scope

- Distinguish *"the server has a newer version"* from *"I cannot tell what this op is"*.
- The `queuedAt` default: reject, or infer, or refuse to replay.
- The short-`args` case: same.
- What the user sees when an op cannot be replayed. Currently: nothing.
- **New Gherkin scenarios** for setlist add/remove reconcile, which do not exist today.
- Delta spec for the `offline-edit-conflict-policy` capability.

### Out of scope

- Finding D — the missing tie-break on *equal* timestamps. Same module, different decision, and
  D needs a product decision this change does not make. They must not be merged into one PR,
  because D's schema implication would drag this one into it.
- Findings A, B, C, E, F, G, I, J.
- The general shape of the offline queue, the service worker, or the drain scheduling.
- `applyLock`, which reads `Date.now()` internally and is a flake source (recorded separately in
  the master plan §5b).

## Capabilities

### New capabilities

None.

### Modified capabilities

- `offline-edit-conflict-policy` (new capability spec — the repository has no
  `openspec/specs/offline-edit-conflict-policy/` today, so this change creates it)

## Approach

The principle: **an operation the client cannot interpret must not be treated as an operation
the server has superseded.** Those are different facts and the current code cannot tell them
apart.

- `queuedAt` missing → the op is **unidentifiable**, not stale. Surface it as a distinct
  outcome, e.g. `{ drop: true, notice: true, reason: 'unknown-age' }`, so the UI can say
  *"an edit could not be replayed"* rather than silently discarding it.
- `songId === undefined` → the same, with `reason: 'malformed'`.
- The notice text matters more than the branch name. Right now a user who adds a song offline
  and reconnects has no way to learn it did not happen.

The two cases should produce **different** reasons, because they have different causes and a
user reporting "my song didn't get added" needs to be triaged differently from "an edit from
last week didn't sync".

### New scenarios required

`features/offline-edit-conflict-policy.feature` gains at least:

- a setlist `add` replayed successfully
- a setlist `remove` replayed successfully
- a setlist `add` whose `args` is short
- a setlist op whose `queuedAt` is absent
- a setlist op the server genuinely superseded — the existing first-wins behaviour, asserted so
  the supersession path is not broken by the above

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/setlistCollab.js` | Modified | the branch that conflates "stale" with "unidentifiable" |
| `src/domain/setlist/collab.test.js` | Modified | the characterization suite; a real fix inverts part of it |
| `src/lib/offlineSync.js` | Modified | to surface the distinct notice |
| the queue UI | Modified | to render it — **identified at apply time**; the component is not named here because this proposal has not traced the render path |
| `features/offline-edit-conflict-policy.feature` | Modified | the missing scenarios |
| `openspec/specs/offline-edit-conflict-policy/spec.md` | New | capability spec |

## Verification

- `pnpm test` — `collab.test.js` is the gate. It currently pins the conflating behaviour, so
  the test diff is the evidence.
- `pnpm typecheck && pnpm lint && pnpm build`.
- Manual, and this one really needs it: queue an `add`, go offline, reload to drop the
  timestamp, reconnect, and confirm the user is **told** rather than left with a setlist that
  silently lacks the song. A test that only checks the return value does not prove the user
  finds out.

## Rollback

One module, one test, the queue UI, and the feature file. No schema, no migration, no persisted
state. Low risk and fully revertible.

## Frozen decisions

1. **This is not merged with finding D.** Same file, different decision. D needs a tie-break rule
   and a place to store it, which implies a schema change; bundling that here would make an
   urgent data-loss fix wait on a product decision it does not depend on.
2. **An unidentifiable op is never reported as superseded.** The two produce different notices
   with different causes.
3. **The missing Gherkin scenarios are part of this change, not a follow-up.** The gap is why
   this survived: the feature file's ten scenarios all cover chord edits, so the add/remove
   replay path was never specified and therefore never tested.
4. **The characterization assertion is inverted, not deleted.**
   `collab.test.js:88` is the test that pins the `queuedAt` default the refactor removed — it is
   the artifact that made the behaviour visible. Rewriting it to accept anything is the failure
   mode the delivery agreement forbids.
