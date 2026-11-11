# Implicit clock injection — `applyLock` and `relativeTime` take `now`

- **Change:** `docs/master-plan.md` §5b items 1 and 3, the last two live entries of the PR 1b
  defect list.
- **Branch:** `freebuff/c0906c7789ee779bfc51a9b9`.
- **Migration:** none. Both modules are pure domain code; no schema, no RPC, no RLS.
- **OpenSpec:** none. Behaviour is unchanged, so there is no capability delta to record — this is
  testability work, not a requirement change. The Gherkin that governs the modules
  (`features/shared-setlist-collaboration.feature` for the advisory lock,
  `features/notifications.feature` for the feed timestamp) is satisfied by the same observable
  output before and after.
- **TDD:** the repo's characterization rule applies. The new tests were written against the
  existing behaviour, and **no existing assertion was edited**.

## Problem (one paragraph)

Two production functions read the wall clock internally, so neither could be asserted against a
fixed instant. `applyLock(locks, payload)` (`collab.js`) called `const now = Date.now()` while its
sibling `isLockStale(lock, now = Date.now())` accepted a clock — the "is this lock stale?" question
was deterministic and the "does this acquisition steal it?" question was not, even though the second
is decided by the first. `relativeTime(iso)` (`relativeTime.js`) never took a `now` at all and read
`Date.now()` inside the bucket computation, which made every boundary assertion (`1m`, `1h`, `1d`,
`7d`) a race against the test run. The determinism the product claims for collaborative editing
lives in this module, and a flake here reads as a collaboration bug.

## In scope / out of scope

**In:** the two production signatures, the `demo()` self-checks that call them, a new
`src/domain/library/relativeTime.test.js`, an `applyLock` block in
`src/domain/setlist/collab.test.js`, and the two `master-plan.md` annotations.

**Out:** changing `LOCK_TTL_MS` or any boundary rule; making `now` a **required** parameter (that
would touch `useSharedSetlist.js` and `Notifications.jsx` for no behavioural gain —
`isLockStale` already established the `now = Date.now()` default as the module's convention, and
this change makes `applyLock` and `relativeTime` match it rather than inventing a third style);
and the third `Date.now()` the plan listed (`collab.js:313` in the 2026-10-12 numbering), which is
not an implicit read at all — see the finding below.

## Tasks

- [x] **T1** — `applyLock(locks, payload, now = Date.now())`: the clock becomes an argument, the
      internal `const now = Date.now()` is gone, and the JSDoc states why.
- [x] **T2** — `relativeTime(iso, now = Date.now())`: same treatment; the `demo()` assertions now
      pass `now` explicitly so the self-check is deterministic too.
- [x] **T3** — `src/domain/library/relativeTime.test.js` (new file, 6 cases): every bucket against
      a fixed clock, the date fallback past a week, the future clamp, unparseable input, and the
      production default.
- [x] **T4** — `applyLock` block in `src/domain/setlist/collab.test.js` (8 cases): acquisition
      stamping, payload `ts` precedence, live foreign lock not stolen, stale foreign lock
      overwritten, non-holder unlock ignored, holder/stale unlock clears, input not mutated,
      default clock.
- [x] **T5** — `docs/master-plan.md` §5b items 1 and 3 annotated as resolved, with the third
      call site corrected in place.

## Finding — the third call site was never a defect

`master-plan.md` §5b recorded "a third implicit read appeared — `collab.js:313`
(`const t0 = Date.now()`)" on 2026-10-12. That line is now `collab.js:408`, and it sits inside
`demo()` — the module's bare-node self-check, not production code. A demo cannot be forbidden from
reading the clock: its whole purpose is to assert against the present. The entry was counted as a
defect because the plan tracked a line number instead of the enclosing function, and the number had
already drifted once (203 → 231 → 408 across three changes).

So the "three call sites" were two, both now closed. The `demo()` reads at `collab.js:408-441` and
`relativeTime.js` are deliberate and stay.

## Verification

Run on 2026-11-11 against this branch, with dependencies installed from the lockfile
(`pnpm install --frozen-lockfile`, pnpm 11.28.11, Node 26):

```
pnpm test        → 31 files, 524 tests passed        exit 0
pnpm typecheck   → tsc --noEmit, no output           exit 0
pnpm lint        → eslint, 0 warnings                exit 0
pnpm build       → built in 3.36s                    exit 0
pnpm test:gherkin → 5 files passed                   exit 0
```

The `>500 kB chunk` warning in the build output is pre-existing (recorded in `AGENTS.md` under the
Vite/Vitest pairing), not introduced here.

**What this does not prove.** No browser was driven: the two call sites that pass no clock
(`useSharedSetlist.js:64,101,110` and `Notifications.jsx:196`) go through the same default as
before, so their behaviour is unchanged by inspection rather than by an interaction test. The
`demo()` self-checks were not re-run through bare node; their assertions are covered by the vitest
file instead.

## Falsifiability

The new tests fail against the previous code in exactly the way the change predicts: with
`relativeTime(iso)` reading `Date.now()`, the fixed-clock bucket assertions return `'just now'` for
inputs a minute, an hour and three days old; with `applyLock` ignoring a third argument, the
stale-lock overwrite case keeps the old holder because the TTL window is measured against the real
clock instead of `T`.
