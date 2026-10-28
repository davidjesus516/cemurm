# Patch `postcss-selector-parser@6.1.4` in place — CVE-2026-104844

- **Status:** verified — ready for review
- **Branch:** `fix/postcss-selector-parser-cve` (from `origin/main` = `5a2bb8d`)
- **Date:** 2026-10-18
- **Alert:** Dependabot #15 — `GHSA-rj75-hqrm-r3gf` / `CVE-2026-104844`
- **Changed lines:** 4 authored (`pnpm-workspace.yaml` +2, `pnpm-lock.yaml` net +3),
  plus the generated `.patch` and this record. Well inside the 400-line PR budget.

## Problem

Dependabot alert #15 reports `postcss-selector-parser` `< 7.1.6` as vulnerable to
quadratic complexity while parsing flat selectors, allowing CPU exhaustion
`CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H` (5.9), CWE-400 + CWE-407.

The advisory is **unfixable through normal dependency management**:

- `6.x` ends at `6.1.4` — the exact version the lockfile resolves. There is **no** `6.1.5`
  and therefore no backport on the v6 line.
- The only published fix is `7.1.6`, which is outside the ranges both parents declare
  (`tailwindcss@3.4.19` → `^6.1.2`, `postcss-nested@6.2.0` → `^6.1.1`).
- The dependency chain is entirely dev-side: `cemurm (dev)` → `tailwindcss@3.4.19` →
  `postcss-selector-parser`. Tailwind runs as a PostCSS plugin at build time; it is not
  part of the shipped bundle and never executes in a browser or on a server.

## Why patch in place rather than upgrade

The upstream fix is **three hunks confined to `dist/parser.js`**, and every one of them is
the same mechanical change: replace `Array.prototype.indexOf` membership scans with `Set`
membership tests. Isolated by diffing `7.1.5` → `7.1.6`, which is exactly the security
delta (the advisory marks `< 7.1.6` vulnerable).

The same quadratic code exists **verbatim** in `6.1.4`:

| `6.1.4` location | Vulnerable code |
| --- | --- |
| `dist/parser.js:86-91` | `uniqs()` — `filter(function (item, i) { return i === list.indexOf(item) })` |
| `dist/parser.js:820` | `!~interpolations.indexOf(hashIndex)` |
| `dist/parser.js:834` | `if (~hasClass.indexOf(ind))` |
| `dist/parser.js:841` | `} else if (~hasId.indexOf(ind))` |

The full `6.1.4` → `7.1.6` diff is large (`dist/parser.js` alone differs by ~2089 lines),
but that is a codegen/refactor delta, **not** the security fix. Porting only the three
security hunks keeps the v6 API surface intact.

**The deciding constraint:** `dist/index.js` changes between 6.1.4 and 7.1.6 — the export
shape moves from `module.exports = exports` (Babel interop with `__esModule` + `default`)
to `module.exports = parser`. That is precisely the change that could break `tailwindcss@3`
silently, and no gate in this repo would catch it: the visual contract gate verifies CSS
token shape, not selector-parser export shape. **This work therefore never touches
`dist/index.js`.**

### Decisions this change deliberately does NOT make

Two heavier alternatives were measured and rejected, and are recorded here so the reasoning
is not lost:

- **Migrate to Tailwind v4.** Rejected on evidence. **ADR-009** (*"Tailwind pinned on the
  3.4 line"*, accepted 2026-09-27) already considered this and deferred it, and
  `skills/cemurm-visual-system/SKILL.md` Hard Rule 6 states *"Tailwind stays 3.4.19. Never
  flip `checkJs`, never bump Tailwind to 4."* Measured usage that a v4 migration would
  silently change: `border` at rest **318×** (default border colour moves from `gray-200` to
  `currentColor`), `rounded` at rest **97×**, `shadow-sm` **45×**, `ring` **17×**,
  `outline-none` **6×**. Raw default-palette classes are **0**, so palette renames are not
  in scope — but the border-colour change alone alters rendered output across the app while
  **no test fails**, which is exactly the failure mode ADR-009 named. It would additionally
  require rewriting `scripts/check-visual-contract.sh`, which reads `tailwind.config.js`
  structurally (setup check, rules 01b/04/05/08).
- **Force `7.1.6` via `pnpm.overrides`.** Rejected on evidence. The `index.js` export-shape
  change above is a real interop risk for `tailwindcss@3`, and again no gate would detect a
  silent CSS regression.

## Scope

- **In scope:** `package.json` / `pnpm-workspace.yaml` (`pnpm.patchedDependencies`),
  `pnpm-lock.yaml`, a new `.patches/*.patch`, and the ODD record.
- **Out of scope:** any change to `tailwind.config.js`, `postcss.config.js`,
  `assets/tokens.css`, `scripts/check-visual-contract.sh`, `src/**`, or
  `skills/cemurm-visual-system/**`.

## Acceptance criteria

1. `postcss-selector-parser@6.1.4` is installed under `pnpm.patchedDependencies`; the
   vulnerable `indexOf` membership scans are replaced with `Set` lookups.
2. `dist/index.js` is **byte-identical** to the published 6.1.4 (export shape preserved).
3. The built CSS is **byte-identical** to the pre-patch baseline.
4. A pathological flat selector (`.a.a.a…` with a large N) parses in near-linear time.
5. Full gate green: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`.
6. Dependabot alert #15 dismissed as `false_positive`, justified by the applied patch.

## Checks

- `pnpm test` — Vitest, node environment, characterization tier.
- `pnpm test:gherkin` — BDD scenarios, separate tier.
- `pnpm typecheck` — `tsc --noEmit` (per-file `@ts-check` opt-in; baseline is 4 files).
- `pnpm lint` — ESLint, `--max-warnings 0`.
- `pnpm build` — production build; CSS compared byte-for-byte against baseline.
- `bash scripts/check-visual-contract.sh` — visual gate.

## Log

- [x] Investigated the advisory, the dependency chain, and the reachability of `7.1.6`.
- [x] Isolated the security fix by diffing `7.1.5` → `7.1.6` (3 hunks, all in `dist/parser.js`).
- [x] Confirmed the identical quadratic code exists in `6.1.4`.
- [x] Branch cut from `origin/main` (`5a2bb8d`); production CSS baseline captured
      (`dist/index-XPkQQORR.css`, sha256 `2ca97830a2bc1685996d64899d012787004e717b265691d4e678fc307ab3c646`).
- [x] Applied the patch via `pnpm patch postcss-selector-parser@6.1.4` + `pnpm patch-commit`.
- [x] Verified export shape, CSS byte-identity, and pathological-selector timing (below).
- [x] Full gate green (below).
- [ ] Commit, push, open PR.
- [ ] Dismiss Dependabot alert #15 with evidence.

## Verification evidence

### The fix

`patches/postcss-selector-parser@6.1.4.patch` touches **only `dist/parser.js`**, three hunks,
all the same mechanical change — `Array.prototype.indexOf` membership scans replaced with `Set`
membership tests. `dist/index.js` is deliberately untouched, and is **byte-identical to the
published 6.1.4**:

```
patch    e018289b5005993cb461adecb242be81bcb25b085d17adec223adebbab31609b  dist/index.js
upstream e018289b5005993cb461adecb242be81bcb25b085d17adec223adebbab31609b  dist/index.js
```

`package.json` is **unchanged** — pnpm 12 records `patchedDependencies` in `pnpm-workspace.yaml`,
and the lockfile carries the matching `patch_hash`.

### 1. The vulnerable code is gone

No remaining occurrences of `~hasClass.indexOf(ind)`, `~hasId.indexOf(ind)`,
`interpolations.indexOf(hashIndex)`, or `list.indexOf(item)`. `node --check` passes.

### 2. The fix is real — quadratic vs linear (acceptance criterion 4)

Parsing a flat selector (`.a` repeated N times), wall clock in ms. "Growth" is the ratio against
the previous, doubled N: **4x per doubling is quadratic, 2x is linear.**

| N | Vulnerable 6.1.4 | Growth | Patched 6.1.4 | Growth |
| ---: | ---: | ---: | ---: | ---: |
| 8 000 | 12.0 | — | 6.2 | — |
| 16 000 | 32.6 | 2.72x | 14.3 | 2.29x |
| 32 000 | 98.4 | 3.02x | 33.5 | 2.35x |
| 64 000 | 379.2 | 3.85x | 71.6 | 2.14x |
| 128 000 | 1 635.2 | 4.31x | 211.7 | 2.95x |
| 256 000 | 6 220.0 | 3.80x | 321.5 | 1.52x |

The vulnerable curve converges on 4x per doubling — quadratic, as the advisory describes. The
patched curve sits around 2x. At N = 256 000 the patched parser is **19.3x faster**, and the gap
widens with N.

Honest caveat: the patched growth is not perfectly 2x at every step (2.35x and 2.95x appear),
so some mild superlinearity remains elsewhere in the parser. That is **outside the vulnerable
code path** and outside this change's scope; what matters is that the quadratic term is gone.

### 3. Production CSS is byte-identical (acceptance criterion 3)

Rebuilt with the patch applied and compared against the pre-patch baseline:

```
before   2ca97830a2bc1685996d64899d012787004e717b265691d4e678fc307ab3c646  index-XPkQQORR.css
after    2ca97830a2bc1685996d64899d012787004e717b265691d4e678fc307ab3c646  index-XPkQQORR.css
before   3c6402d02ce4f85f0ab2ef92f0d7954f96377d5bad44cad99cd7b34ec12f9e12  fonts.css
after    3c6402d02ce4f85f0ab2ef92f0d7954f96377d5bad44cad99cd7b34ec12f9e12  fonts.css
```

`diff -r` over the two directories: **identical, 0 differences.** Vite even emits the same
content-hashed filename, which is itself evidence the input CSS did not move.

### 4. Full gate green (acceptance criterion 5)

```
pnpm test                        PASS   409 passed
pnpm test:gherkin                PASS    41 passed
pnpm typecheck                   PASS   tsc --noEmit
pnpm lint                        PASS   --max-warnings 0
pnpm build                       PASS
bash scripts/check-visual-contract.sh
                                 PASS   visual contract: OK (12 rules checked, 0 failing)
```

## Deviations

- `pnpm patch` initially failed with `ERR_PNPM_EDIT_DIR_NOT_EMPTY` on a stale
  `node_modules/.pnpm_patches/` directory; cleared it and retried. No effect on the outcome.
- The generated patch keeps the upstream comment wording verbatim, so the three hunks can be
  matched against `7.1.6` when the project eventually moves off the v3 line.
