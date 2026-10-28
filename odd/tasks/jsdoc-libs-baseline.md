# jsdoc-libs-baseline — extend the per-file JSDoc type baseline to every relocated module — task doc

**Feature:** extend the `// @ts-check` per-file baseline (tsconfig.json, `feat/ts-checkjs-baseline`) from the 4 domain libs to ALL of the modules that used to live in `src/lib`. Branch family: `feat/jsdoc-libs-sNN-<domain>-v2`.
**Delivery (revised 2026-09-28):** **independent slices, each cut from `main`, PR base `main`.** The original decision (2026-09-25) was stacked-to-main with each branch FROM the previous slice head. That is what produced the ten unmergeable PRs #204–#213 — see the slice section for why. Each slice is ≤ ~100 type errors (~≤400 JSDoc lines), independently mergeable in any order.
**Repo-relative locator:** `odd/tasks/jsdoc-libs-baseline.md` · Engram mirror topic `odd/jsdoc-libs-baseline/tasks`.

> **Scope correction (2026-09-28).** This document was written against the pre-M0a `src/lib/`
> tree. M0a (`b8a624f`) relocated 111 modules out of `src/lib/`, which now retains only
> `projection.js` and `storage.js`. "All of `src/lib`" no longer names a set of files — the
> scope is "every module in the per-file error inventory below", read at its post-M0a path. The
> slice table further down carries the corrected paths.

## Objective

`pnpm typecheck` green with EVERY module in the inventory opted in via the per-file `// @ts-check` pragma — zero errors, zero behavior change. Baseline contract preserved: do NOT flip `checkJs` globally in tsconfig.json; modules outside the inventory stay opt-in.

## Problem / Why

The original baseline (odd/tasks/ts-checkjs-baseline.md) deliberately scoped to 4 domain libs (`transpose`, `annotations`, `songs`, `setlists`) and left the rest unchecked (tsconfig comment: ~760 errors incl. ~530 out-of-scope). The Hito 5 merge added more un-annotated libs (`musicbrainz`, `lrclib`, `importers/*`, `exporters/*`, `planningcenter`, `pdfCharts`, `enrichments`, `spotify`, `midi`, `overlay`, `substitutions`, `setlistCollab`, `degreeResolver`, `scaleCatalog`). User asked to complete the pass (2026-09-25).

## Verified facts (2026-09-25 original measurement; re-measured 2026-09-28)

`npx tsc --noEmit --checkJs` over `src/lib` → **901 errors across 35 files** (inventory in `/tmp/opencode/checkjs-all-errors.txt`). Clean files already passing `--checkJs`: `annotations.js`, `setlists.js`, `songs.js`, `transpose.js` (already pragma'd) and `supabase.js` (needs the pragma only, 0 errors — added in S11).

> **Re-measured 2026-09-28** on the relocated tree, with the widened `include` from
> `0e64e2a [v2-base]` and `npx tsc --noEmit --checkJs`: **749 errors** across the tree. Every
> per-file count in the slice table reproduced **exactly** — the relocation moved files without
> changing how many type errors they carry, so the sizing below is verified, not estimated.
> The 749 figure replaced the old pre-M0a 901: the tree changed shape, so the totals differ even
> though the per-slice sums do not.
>
> The names in the inventory below are **pre-M0a**. Use it for knowing which modules are in scope —
> not for locating a file. For the current path of any entry, read the slice table.

Per-file error counts (pre-M0a names, source of slice sizing):

```
gigs 105 · rehearsals 48 · services 46 · comments 46 · bandmates 38
importers/queue 36 · substitutions 33 · planningcenter 33 · enrichments 33
spotify 32 · search 29 · importers/onsong 29 · offlineCache 25 · storage 24
notifications 23 · importers/duplicates 23 · musicbrainz 22 · setlistCollab 21
midi 21 · moderation 18 · degreeResolver 18 · scaleCatalog 17 · offlineSync 16
lrclib 15 · importers/urlImport 14 · chordpro/parser 14 · follows 13 · auth 13
overlay 12 · offlineQueue 12 · publicLibrary 10 · pdfCharts 10 · preferences 9
minors 9 · exporters/onsong 9 · profiles 7 · orgRepertoire 6 · readiness 5
progressions 4 · duration 2 · updateManager 1
```

## Delivery slices — PATHS CORRECTED FOR THE POST-M0a TREE

> **Read this before porting any slice.** The original version of this table named files by their
> pre-M0a `src/lib/` path. M0a (`b8a624f`, "relocate 111 modules into enforced module boundaries")
> moved them, and six were **renamed as well as moved** — so a lookup by the old basename silently
> finds nothing, and a port that trusts the old name skips files while still going green. Every
> path below is read from `git diff b8a624f^ b8a624f -M --find-renames=30% --name-status`, not
> inferred.
>
> The error counts were re-measured on the relocated tree on 2026-09-28 and came out **identical**
> to the original pre-M0a figures — verified, not estimated.
>
> Every path below is read from `git diff b8a624f^ b8a624f -M --find-renames=30% --name-status`, not
> inferred.

| Slice | Branch | Files on the relocated tree (errors) | Σ | Status |
|-------|--------|--------------------------------------|---|--------|
| S01 | `feat/jsdoc-libs-s01-perf-core-v2` | `src/data/repositories/gigs.js` (105) | 105 | **#198 open** |
| S02 | `feat/jsdoc-libs-s02-rehearsals-services-v2` | `src/data/repositories/rehearsals.js` (48), `services.js` (46) | 94 | **#240 open** |
| S03 | `feat/jsdoc-libs-s03-collab-core-v2` | `src/data/repositories/comments.js` (46), `bandmates.js` (38) | 84 | `3a119c0` local, **no PR** |
| S04 | `feat/jsdoc-libs-s04-notifications-collab-v2` | `src/data/repositories/notifications.js` (23), `src/domain/setlist/collab.js` (21), `src/data/repositories/follows.js` (13) | 57 | `e76b2a8` local, **no PR** |
| S05 | `feat/jsdoc-libs-s05-import-core-v2` | `src/data/repositories/importQueue.js` (36), `duplicates.js` (23), `src/integrations/urlImport.js` (14) | 73 | in progress |
| S06 | *(no v2 branch)* | `src/integrations/planningcenter.js` (33), `src/domain/chart/importers/onsong.js` (29), `src/domain/setlist/exporters/onsong.js` (9), `src/data/repositories/pdfCharts.js` (10) | 81 | **not ported** |
| S07 | *(no v2 branch)* | `src/integrations/spotify.js` (32), `musicbrainz.js` (22), `lrclib.js` (15), `src/data/repositories/enrichments.js` (33) | 102 | **not ported** |
| S08 | *(no v2 branch)* | `src/data/repositories/substitutions.js` (33), **`src/integrations/webMidi.js`** (21, was `lib/midi.js`), `src/domain/music/progressions.js` (4), `src/data/repositories/scaleCatalog.js` (17), `src/domain/music/degreeResolver.js` (18) | 93 | **not ported** |
| S09 | *(no v2 branch)* | `src/domain/library/search.js` (29), **`src/offline/cache.js`** (25, was `lib/offlineCache.js`), **`src/offline/drainer.js`** (16, was `lib/offlineSync.js`), **`src/offline/queue.js`** (12, was `lib/offlineQueue.js`) | 82 | **not ported** |
| S10 | *(no v2 branch)* | `src/data/repositories/moderation.js` (18), `publicLibrary.js` (10), `profiles.js` (7), `orgRepertoire.js` (6) | 41 | **not ported** |
| S11 | *(no v2 branch)* | `src/data/repositories/auth.js` (13), `preferences.js` (9), `minors.js` (9), `overlay.js` (12), `src/domain/library/duration.js` (2), **`src/domain/chart/parser.js`** (14, was `lib/chordpro/parser.js`), `src/lib/storage.js` (24), `src/offline/updateManager.js` (1), `src/domain/chart/readiness.js` (5), **`src/data/supabase.js`** (pragma only) | 89 | **not ported** |

The slices cover **593 of the tree's 749 errors across 36 files** (35 + the `src/data/supabase.js`
pragma). Slice file sets are disjoint, so per-slice typecheck stays green — but the **branches must
not be stacked**, see below.

### 156 errors the slices do not cover

Re-measuring on the current tree surfaced files that carry type errors and that **no slice names**.
They are outside the objective as written, so this is a scope decision, not an oversight to patch
silently:

| File | Errors | Why it is uncovered |
|------|--------|---------------------|
| `src/lib/projection.js` | 56 | Lives in `src/lib/`, one of the two survivors of the relocate, but was never in the inventory |
| `src/domain/music/transpose.test.js` | 30 | Test file — the inventory names source modules only |
| `src/domain/music/annotations.test.js` | 30 | Test file |
| `src/domain/setlist/collab.test.js` | 17 | Test file |
| `src/domain/chart/parser.test.js` | 17 | Test file |
| `src/domain/library/relativeTime.js` | 5 | Source module, never inventoried |
| `src/domain/chart/readiness.test.js` | 1 | Test file |

Two open questions the maintainer owns, not the writer:

1. **Is `projection.js` in scope?** It is the single largest uncovered file at 56 errors, and the
   objective says "every module", so by the letter of the objective it is in and the inventory is
   wrong. By the letter of the inventory it is out.
2. **Do test files count?** 95 errors sit in `*.test.js`. The constraints say do not touch `features/`
   but say nothing about tests, and the characterization suite is load-bearing — annotating tests
   risks the red-test-is-information rule from the delivery agreement. Sizing: tests are cheap
   (they are small, mostly flat data), but they are the wrong place to spend the first slice.

### The eight path changes M0a made, six of which also renamed the file

`src/lib/` did not survive as a prefix. Six of these changed directory *and* name — exactly the
case a basename lookup cannot detect. The other two changed directory only, and are listed for
completeness:

| pre-M0a | post-M0a | slice |
|----------|----------|-------|
| `lib/midi.js` | `src/integrations/webMidi.js` | S08 |
| `lib/offlineCache.js` | `src/offline/cache.js` | S09 |
| `lib/offlineSync.js` | `src/offline/drainer.js` | S09 |
| `lib/offlineQueue.js` | `src/offline/queue.js` | S09 |
| `lib/importers/queue.js` | `src/data/repositories/importQueue.js` | S05 |
| `lib/setlistCollab.js` | `src/domain/setlist/collab.js` | S04 |
| `lib/chordpro/parser.js` | `src/domain/chart/parser.js` | S11 |
| `lib/supabase.js` | `src/data/supabase.js` | S11 |

### Do not stack the branches, and do not replay the v1 diffs

**Branches.** The ten v1 branches were a *linear cumulative stack*: each contained the previous
one (`s02`→`s01`, `s03`→`s02`, … `s11`→`s10`, verified with `git merge-base --is-ancestor` on all
ten transitions). That is why their file counts grew monotonically — 3, 5, 8, 11, 15, 19, 24, 28,
32, 43 — and why merging any one of them would have merged all of them. The v2 chain
(#215 → #198 → #240) fixed this by cutting independent slices off `main`. Keep doing that.

**Diffs.** The v1 work is still readable and worth reading to learn which shapes the author
resolved, but it is a reference, not a patch. Stripping every `/** … */` block from a v1 file and
diffing the remainder against the relocated file on `main` still shows differences, so the relocate
was not a content-preserving rename. Measured on the control case, whose v2 port is already open
in #198: `gigs.js` carries 71 annotations and 164 lines differ outside the JSDoc. The port is a
re-derivation.

Closing PRs #204–#213 lost nothing: `feat/jsdoc-libs-s11-core-misc` is the tip of that stack,
still pushed, still holding all 43 files and 218 commits.

## Constraints (every writer, every slice)

- JSDoc ONLY — no TS syntax (repo is plain JS/JSX). Match baseline style: `/** @typedef {object} X */` + `@property`, `/** @type {…} */` casts where literals need width (see `transpose.js`, `songs.js`/`setlists.js` post-166 typedefs; `flattenSetlist` fallback cast pattern). Minimal honest `any` only where the baseline style allows (prefer real typedefs).
- Do NOT change behavior, function bodies, call sites, strings, exports, or signatures. `// @ts-check` added at the top of each file in the slice (before imports, after any license header).
- Do NOT touch tsconfig.json; do NOT add pragmas to files outside the slice; do NOT touch migrations, pages, components, hooks, features/.
- Typedefs honest to actual schema/data shapes (see docs/database-schema-v2.md; raw Supabase row interfaces used elsewhere in the tree).
- Verification per slice head: `pnpm typecheck` → 0 errors (NOTE: pragmatic `@ts-ignore` NOT allowed; if a file is genuinely impossible to type without behavior change, escalate to orchestrator — do not paper over), `pnpm lint` → 0 warnings, `pnpm build` → green.
- Commits: work-unit, Conventional Commits, English, NO AI attribution/Co-Authored-By. One commit per file-group within the slice is fine: `chore(lib): add jsdoc types to <domain> modules (<short list>)`.

## Acceptance criteria

1. At every slice head (and after each merge): `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm build` green.
2. Every file in the error inventory above has `// @ts-check`; `pnpm typecheck` still 0 at `main` after the final merge.
3. No behavior changes: orchestrator reviews all non-comment diff lines per slice.
4. Slices are **independent** — each branch from `main`, each PR base `main`, each mergeable on its own. `main`'s `pnpm typecheck` = 0 once all are in.

## Tasks

Status as of 2026-09-29. `v1` = the closed cumulative stack (#204–#213); `v2` = independent slices.

- [x] S01 perf-core (`gigs.js` 105) — v2 port open as **#198**
- [x] S02 rehearsals-services (94) — split in two to respect the ≤400 rule: **#248** (rehearsals, 296) + **#249** (services, 345). The combined **#240** was closed at 641 lines.
- [x] S03 collab-core (84) — v2 port open as **#245**
- [x] S04 notifications-collab (57) — v2 port open as **#246**
- [x] S05 import-core (73) — v2 port open as **#244**
- [ ] S06 planningcenter-onsong (81) — not ported
- [ ] S07 music-providers (102) — not ported
- [ ] S08 theory-midi (93) — not ported
- [ ] S09 search-offline (82) — not ported
- [x] S10 public-library-moderation (41) — v2 port open as **#243**
- [ ] S11 core-misc (89 + `src/data/supabase.js` pragma) — not ported

### The v2 slices WERE stacked again, and were re-cut (2026-09-29)

**Read this before cutting another slice.** The v2 branches were created linearly —
`3a119c0` (S03) is a descendant of `d492e9c` (S02), and `e76b2a8` (S04) and `5fcb8ae9` (S05) are
descendants of both — so each slice's PR carried its predecessors' files. Measured before the fix:

| Slice | commits over main | files in its PR |
|-------|-------------------|-----------------|
| S02 | 2 | 3 |
| S03 | 3 | **5** |
| S04 | 4 | **8** |
| S05 | 5 | **11** — PR #244 opened at +1698/-70 |

That is the v1 failure mode reproduced, against the rule written 100 lines above it in this same
file. Two ways it was wrong: slices were not independently mergeable, and 11 files / +1698 broke
the 400-line PR budget outright.

**Fix.** Each slice's commit was cherry-picked onto `0e64e2a` (v2-base), so every branch is now
2 commits / 3–4 files. Content is byte-identical to what was already verified — checked with
`git diff <old-sha> <new-branch> -- <that slice's own files>`, empty for S03, S04 and S05. #244 went
from 11 files/+1698 to 4 files/+373 without touching the PR itself. The pre-cut history is
preserved at tag `backup/pr244-cumulative-5fcb8ae9`.

**The trap, because it cost a wasted step:** `git branch -f <slice-branch> <slice-sha>` does
**not** fix this. It moves the pointer, but the slice commit still has the earlier slices as
ancestors, so `git diff origin/main...<branch>` keeps showing their files. Only a cherry-pick onto
the shared base actually removes them.

### Budget: measure AFTER #215, and split by file, not arbitrarily

The maintainer's standing call is to respect the ≤400-line rule *wherever it is possible to do so
without harming the change*. Two things follow for the next slice.

**1. Every slice PR carries `tsconfig.json` from the shared base commit `0e64e2a`** — 18 lines,
which the budget must not be charged for, because #215 will land that exact change on `main`
first. Measuring a slice's real size means excluding it:

```bash
git diff --numstat origin/main...<branch> | grep -v tsconfig.json | awk '{s+=$1+$2} END {print s}'
```

| PR | as opened | real size (no tsconfig) |
|----|-----------|------------------------|
| #198 S01 | 323 | 323 |
| #248 S02a | 314 | 296 |
| #249 S02b | 363 | 345 |
| #245 S03 | 397 | 379 |
| #246 S04 | 363 | 345 |
| #244 S05 | **403** | 385 |
| #243 S10 | 314 | 314 |

So **no slice is over budget on its own content** — #244's 403 is the tsconfig line, and it drops
to 385 the moment #215 merges. Do not "fix" that 3-line overage by trimming annotations: the ODD
contract forbids buying line-count savings with deleted comments, and the number is not real.

**2. Split on a file boundary, never mid-file.** S02 was the one genuine overrun (641 lines for
`rehearsals.js` 296 + `services.js` 345) and it was never stacked — 48+46 errors in two large
modules is simply that much annotation. The split was per-file, which keeps each half
independently typecheckable and independently mergeable. Splitting a single file instead would
produce two PRs that neither typechecks alone.

Verify a split half the same way as a whole slice: the annotated file must reach **0** under
`tsc --noEmit --checkJs`, and its sibling must still show its errors *on that branch* — proof the
other half really is absent rather than accidentally included.

- [ ] **Prerequisite — #215** should land before S05, S06, S07, S09 and S11, though for a narrower reason than "the include is too small". Measured on 2026-09-28: `main`'s `include` (`["src/domain", "src/data/repositories", "src/lib"]`) loads **48** files; `0e64e2a`'s widened include loads **55**. tsc loads the globs *plus everything reachable by import*, so most relocated modules come in transitively — `spotify.js`, `webMidi.js`, `offline/cache.js`, `offline/queue.js` and `data/supabase.js` are all reached that way. The **6 slice files `main` genuinely never loads** are:

  | File | Slice | Errors left |
  |------|-------|-------------|
  | `src/integrations/planningcenter.js` | S06 | 33 |
  | `src/integrations/musicbrainz.js` | S07 | 22 |
  | `src/integrations/lrclib.js` | S07 | 15 |
  | `src/offline/drainer.js` | S09 | 16 |
  | `src/offline/updateManager.js` | S11 | 1 |
  | `src/integrations/urlImport.js` | S05 | 0 — already annotated in the working tree |

  87 errors sit in files a `// @ts-check` pragma on `main` cannot reach. Annotate those and the
  slice goes green having checked nothing there. S08 is **not** affected — all five of its files
  load. #215 closes the gap by widening to
  `["src/domain", "src/data", "src/integrations", "src/lib", "src/offline"]`.
- [ ] Final: all PRs open; user merges; verify typecheck at main after merge

## Verification

Per slice: `pnpm typecheck` (0) · `pnpm lint` (0) · `pnpm build` (green) — writer report + orchestrator spot check. Behavior diff check: `git diff <base>..HEAD | grep '^[+-]' | grep -vE '^\+\s*//|^[+-]\s*\*|@param|@property|@typedef|@returns|@type|^\+\s*// @ts-check'` should show only casts/pragma.

### Re-measuring the inventory (the recipe behind the 2026-09-28 numbers)

```bash
# per-file error counts on the current tree, with checkJs forced
npx tsc --noEmit --checkJs 2>&1 | grep 'error TS' \
  | sed 's/(.*//' | sort | uniq -c | sort -rn

# how many files tsc actually loads -- the baseline-death check
npx tsc --noEmit --listFiles | grep -c 'cemurm/src/'

# which files a given include reaches. tsc loads the globs PLUS everything
# reachable by import, so a file absent from the globs can still be checked.
# Compare two lists to find the genuinely-unreachable ones:
npx tsc --project <cfg> --listFiles | grep 'cemurm/src/' | sort
```

Two traps this recipe exists to avoid:

1. **A file missing from `include` is not necessarily unchecked.** Imports pull it in. Only a
   `--listFiles` diff against the real project config reveals what is genuinely unreachable.
2. **A green `pnpm typecheck` proves nothing about a slice's own files.** It exits 0 whether the
   file is fully annotated, partly annotated, or not loaded at all. A slice is only proven by
   `tsc --noEmit --checkJs` showing that file's count reach **0**.