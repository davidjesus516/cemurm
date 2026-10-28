# jsdoc-libs S09 + S11 v2 — the two slices that have no v2 port

**Feature:** close the last gap in the jsdoc-libs v2 chain — port S09 (search-offline) and S11 (core-misc) onto the post-M0a tree.
**Branches:** `feat/jsdoc-libs-s09a-v2`, `feat/jsdoc-libs-s09b-v2`, `feat/jsdoc-libs-s11a-v2`, `feat/jsdoc-libs-s11b-v2`, `feat/jsdoc-libs-s11c-v2` (S11 split per file). PRs **#261–#265**.
**Base for every branch:** `origin/main` (5547150) + `1f664a1 [v2-base]` (the tsconfig widen). Both from the same shared base, never stacked.
**Repo-relative locator:** `odd/tasks/jsdoc-libs-s09-s11-v2.md` · Engram mirror topic `odd/jsdoc-libs-s09-s11-v2/tasks`.
**Parent plan:** `odd/tasks/jsdoc-libs-baseline.md` (PR #242) — this file extends it, it does not replace it.

## Objective

`pnpm typecheck` green with every module in the S09 and S11 inventories opted in via the per-file `// @ts-check` pragma. Zero errors, zero behavior change.

## Problem / why this slice exists

The v2 chain ported S01–S05, S10 (#198, #248, #249, #245, #246, #244, #243) and S06–S08 arrived as #250/#251/#255/#256/#258/#259/#260. **S09 and S11 were never ported** — only v1 branches exist, and v1 was invalidated by the M0a relocate (`b8a624f`) that moved 111 modules out of `src/lib/`.

That is not a cosmetic gap:

- **87 type errors sit in files a `// @ts-check` pragma on `main` cannot reach.** `main`'s `include` is `["src/domain", "src/data/repositories", "src/lib"]`; tsc loads those globs *plus everything reachable by import*. The genuinely-unreachable ones inside these two slices are `src/offline/drainer.js` (S09, 16 errors) and `src/offline/updateManager.js` (S11, 1 error). Annotate them on `main` and they go green having checked nothing. `#215` (the tsconfig widen, commit `1f664a1`) closes this — so every branch here is cut on top of it.
- **`pnpm typecheck` exiting 0 proves nothing about these files.** It exits 0 whether a file is fully annotated, partly annotated, or not loaded at all. The only proof a slice is real is `tsc --noEmit --checkJs` showing that file's own count reach **0**.

## Verified measurements (re-measured 2026-09-29, not copied from the plan)

`npx tsc --noEmit --checkJs` on `a47fe13` (this tree, widened include) — per-file counts, every one matching the plan's figures exactly:

**S09 — 82 errors, 4 files**

| File | Errors |
|------|--------|
| `src/domain/library/search.js` | 29 |
| `src/offline/cache.js` | 25 |
| `src/offline/drainer.js` | 16 |
| `src/offline/queue.js` | 12 |

**S11 — 89 errors, 9 files + 1 pragma-only**

| File | Errors |
|------|--------|
| `src/lib/storage.js` | 24 |
| `src/domain/chart/parser.js` | 14 |
| `src/data/repositories/auth.js` | 13 |
| `src/data/repositories/overlay.js` | 12 |
| `src/data/repositories/preferences.js` | 9 |
| `src/data/repositories/minors.js` | 9 |
| `src/domain/chart/readiness.js` | 5 |
| `src/domain/library/duration.js` | 2 |
| `src/offline/updateManager.js` | 1 |
| `src/data/supabase.js` | 0 — the pragma only |

None of the 14 files carries `// @ts-check` on `main`; every first line is still a plain comment (or, for `data/supabase.js`, an import). Verified individually.

## Scope decision made before writing: S11 splits by file

The standing call is to respect the ≤400-line rule wherever it does not harm the change. The measured precedent is decisive: **S02 was 94 errors in 2 files and landed at 641 lines**, which is why it was split. S11 is 89 errors across 10 files — the same order of annotation volume, and a single PR would overrun.

Split on a **file** boundary, never mid-file: a half-annotated file would not typecheck alone, so splitting inside one would produce two PRs where neither passes. Each half must independently reach 0 for its own files.

**S11 split (writer confirms final line counts before committing):**

| PR | Files | Σ errors |
|----|-------|-----------|
| S11a | `src/lib/storage.js`, `src/data/supabase.js` (pragma), `src/offline/updateManager.js` | 25 |
| S11b | `src/domain/chart/parser.js`, `src/domain/chart/readiness.js`, `src/domain/library/duration.js` | 21 |
| S11c | `src/data/repositories/auth.js`, `overlay.js`, `preferences.js`, `minors.js` | 43 |

S09 is 4 files / 82 errors. The writer measures it the same way and splits on a file boundary if it lands over 400 — the expected seam is `search.js` (29) separate from the three `offline/` modules (53).

## Reference material (read, do not replay)

`origin/feat/jsdoc-libs-s11-core-misc` is the v1 stack tip, cut from the **current** `main`, and its diff is 43 files **already at post-M0a paths**. The two relevant commits are isolated:

- `bd8c6ee` — `chore(lib): add jsdoc types to search and offline modules [s09]`
- `def704b` — `chore(lib): add jsdoc types to core and misc modules, widen SongInput key [s11]`
- `0f73b1a` — `fix(typecheck): repair 12 JSDoc import paths this branch exposed` (read this one too: it records which v1 annotations were wrong)

**v1 is a reference, not a patch.** Stripping every `/** */` block from a v1 file and diffing the remainder against the relocated file on `main` still shows differences — the relocate was not content-preserving. On the control case, `gigs.js` carries 71 annotations and 164 lines differ *outside* the JSDoc. Porting is a re-derivation: read what shape v1 resolved, then write the annotation against the file as it is today.

## Constraints (every writer, every file)

- JSDoc only. No TS syntax — the repo is plain JS/JSX. Match baseline style: `/** @typedef {object} X */` + `@property`, `/** @type {…} */` casts only where a literal needs width (see `transpose.js`, and the `flattenSetlist` fallback-cast pattern in the baseline).
- `// @ts-check` at the very top of each file, before imports, after any license header.
- **Do NOT** change behavior, function bodies, call sites, strings, exports, or signatures. A non-comment diff line is a finding, not a convenience.
- **Do NOT** touch `tsconfig.json` (it arrives via the shared base), migrations, `src/features/`, pages, components, hooks.
- Typedefs honest to the actual schema — see `docs/database-schema-v2.md` and the raw-Supabase-row interfaces used elsewhere in the tree.
- Minimal honest `any`, only where baseline style allows. Prefer real typedefs.
- **Pragmatic `@ts-ignore` is NOT allowed.** If a file is genuinely impossible to type without a behavior change, stop and escalate — do not paper over it. `webMidi.js`'s `sendProgramChange` is the precedent for a *deliberate, labelled* unsound cast: if one is truly needed, the comment must say in those words that it is unsound and why.
- Commits: work-unit, Conventional Commits, English, **no AI attribution, no `Co-Authored-By`**. One commit per file-group: `chore(lib): jsdoc types for <group> [sNNx]`.

## Acceptance criteria

1. Every listed file carries `// @ts-check` and reaches **0** under `npx tsc --noEmit --checkJs`.
2. `pnpm typecheck` → 0 · `pnpm lint` → 0 warnings · `pnpm build` → green, at every branch head.
3. Every PR is independently mergeable: branched from the shared base, base `main`, no predecessor's files in the diff. Verify with `git diff --numstat origin/main...<branch>` — it must list only that PR's own files.
4. Non-comment diff check is clean: `git diff origin/main...HEAD | grep '^[+-]' | grep -vE '^\+\s*//|^[+-]\s*\*|@param|@property|@typedef|@returns|@type'` shows only intentional casts and the pragma.
5. Real size measured excluding the `tsconfig.json` line, which #215 owns:
   ```bash
   git diff --numstat origin/main...<branch> | grep -v tsconfig.json | awk '{s+=$1+$2} END {print s}'
   ```

## Tasks

- [x] T1 — S09a: `src/domain/library/search.js` → 0 — commit `5baf60e`, branch `feat/jsdoc-libs-s09a-v2`, 85 lines
- [x] T2 — S09b: `src/offline/cache.js`, `queue.js`, `drainer.js` → 0 — commit `2c7ee85`, branch `feat/jsdoc-libs-s09b-v2`, 250 lines (queue.js arrived pragma-only with 12 errors from the interrupted writer; its full annotation was completed in this same unit so the file typechecks alone)
- [x] T3 — S11a: `src/lib/storage.js` + `src/data/supabase.js` pragma + `src/offline/updateManager.js` → 0 — commit `b656a5f`, branch `feat/jsdoc-libs-s11a-v2`, 81 lines
- [x] T4 — S11b: `src/domain/chart/parser.js`, `readiness.js`, `src/domain/library/duration.js` → 0 — commit `b1fa9ac`, branch `feat/jsdoc-libs-s11b-v2`, 106 lines
- [x] T5 — S11c: `src/data/repositories/auth.js`, `overlay.js`, `preferences.js`, `minors.js` → 0 — commit `d09b397`, branch `feat/jsdoc-libs-s11c-v2`, 261 lines
- [x] T6 — Verify every branch head: typecheck 0, lint 0, build green (235/235 tests), non-comment diff clean — run per unit by writers, spot-checked again by the orchestrator (s09b + s11c re-checked; casts runtime-identical, verified against `origin/main`)
- [x] T7 — Branches pushed and one PR per slice opened against `main`: **#261** (s09a), **#262** (s09b), **#263** (s11a), **#264** (s11b), **#265** (s11c). Sizes and verification evidence are in each PR body. This record landed on #261 as its second commit.

**Sizes (real, excl. the tsconfig line #215 owns): S09a 85 · S09b 250 · S11a 81 · S11b 106 · S11c 261 — all under the 400 budget. Six total files, incl. `tsconfig.json` from the shared base.**

### Findings from the port (recorded 2026-09-29)

1. **Dead `key` directive branch in `src/domain/chart/parser.js`** — the `if (directive.name === 'key')` sectional-key branch is unreachable: `KNOWN_META` already contains `'key'`, so the branch above matches first. `parser.test.js` documents this as a FINDING and asserts `demo()` throws. Pinned by the characterization suite — NOT fixed in this pass, annotations document the intended shape. A separate finding for the maintainer.
2. **v1 annotations were wrong in two places, fixed in S11c**: the auth `error?.code` shape needs a labelled cast var (Supabase transport errors carry a string `code`; the `?.` stays as the runtime guard); `minors.js` catch needs the TS7 `unknown`→Error cast (songs.js:180 baseline pattern). preferences.js's JSDoc `typeof import('../supabase.js')` path was wrong in v1 (`./supabase.js`) — written correctly from the start; `0f73b1a` repaired exactly this.
3. **`QueuedSetlistOp` typedef is dead post-M0a** — never existed on this tree; current `reconcileSetlistOp` only reads the `QueuedOp` surface, so the v1 cast was dropped, not repaired.
4. **M0a relocate was content-preserving for 7 of the 14 files** (storage, supabase, updateManager, parser, readiness, duration + S09's three had only cosmetic drift): v1 annotated files matched byte-identically at their post-M0a paths.
5. **`oldVersion` unsound-cast pattern spreads**: `indexedDB.open`'s `req.oldVersion` is declared on IDBVersionChangeEvent, not IDBOpenDBRequest — the documented intersection `IDBOpenDBRequest & { oldVersion?: number }` is now in cache.js and queue.js, mirroring the webMidi `sendProgramChange` precedent.
6. **AGENTS.md's `grep -c 'cemurm/src/'` gate reads 0 inside worktrees** — absolute paths are `.../cemurm-worktrees/<name>/src/`. The baseline-alive check must use `grep -c '/src/'` (55 files) in a worktree. This is a worktree-environment artifact, not a broken baseline.

## Out of scope

- `projection.js` (56 errors) and the 95 errors in `*.test.js` — the plan records these as an explicit maintainer scope decision, not a slice. Do not absorb them silently.
- Merging. PRs open, human merges.
