# Gate truthfulness hardening — make CI failures say what they mean

Feature record for four work units that change no product code: three CI/gate
plumbing units and one enforcement rule. Each unit closes a specific way this
repository's checks can be green, or can hide a failure, without the reader
being able to tell.

## Objective

Remove three silent-failure paths and close one unenforced rule:

1. A gate that precedes `test` and `build` turns their real state into `SKIPPED`.
2. `tsc --noEmit` ships type errors behind a green check, because CI never runs it.
3. The visual system's own skill points at a token file nothing reads.
4. ADR-006 has no machine enforcement; `.skip` and `.todo` clear a gate silently.

## Problem

Each of the four is a case where the *reported* state and the *actual* state can
differ, and the difference is invisible in the CI log. That is the failure class
this record exists to close: not "a gate is missing" but "a gate reports something
the reviewer will believe".

### The gate-before-test ordering, measured

`bash scripts/check-visual-contract.sh` exits 1 on this branch (RULE 07, one
occurrence, `src/features/services/pages/SubstitutionAssignment.jsx`). It sat
between `pnpm lint` and `pnpm test`, and GitHub Actions runs every step under
`set -euo pipefail` semantics, so that exit aborted the job and marked `pnpm test`,
`pnpm test:gherkin` and `pnpm build` **SKIPPED**. A reviewer looking at the checks
tab saw three skipped steps and no evidence about the suite or the bundle. The
failure was real and reported; everything downstream of it was simply unknown.

The fix is ordering, not tolerance: the gate is not made to pass, and its verdict is
not downgraded. It moves to the end of the job, where a FAIL line is read next to a
green test and build instead of above three skips.

### The skill points at a file no gate reads

`skills/cemurm-visual-system/SKILL.md` Hard Rule 1 said colours live in "the token
declarations and `assets/tokens.css`". Measured: `scripts/check-visual-contract.sh`
contains **zero** references to the skill directory or to `tokens.css`, and reads
colours only from `tailwind.config.js` (`TAILWIND_CONFIG`, parsed by rule 04's walk
and consumed by rule 05). `assets/tokens.css` is imported by nothing — it is a
standalone `:root` block — and it declares a *different* ramp from the enforced one:
`--cem-bg: #0c0a09` (warm) against `cem.base: '#0f172a'` (slate blue).

So the document that tells a maintainer where to add a token named a file that is
neither imported nor measured, and named it alongside the file that is both. The
rule's force (no raw colour literals in `src/`) was never in question; its pointer
was wrong, and the two pointers disagreed with each other silently.

## The four units

| Unit | Surface | What changes |
|---|---|---|
| U1 | `.github/workflows/ci.yml` | Visual gate moves after `test`, `test:gherkin`, `build`. Lint stays first. |
| U2 | `.github/workflows/ci.yml` | `pnpm typecheck` added before `pnpm lint`. |
| U3 | `SKILL.md`, `assets/tokens.css`, `check-visual-contract.sh` | Skill names the file the gate reads; the gate fails when the two diverge (new rule 08). |
| U4 | `scripts/check-test-integrity.sh`, `.github/workflows/ci.yml` | New gate failing on `.only` / `.skip` / `.todo`, wired before the test steps. |

## Constraints

- A failing characterization test is fixed in the source, never in the assertion
  (ADR-006). U4 exists to give that rule teeth; U4 must not weaken anything.
- bash + grep only for gate scripts. The gate must stay cheaper and more reliable
  than the thing it guards.
- `pnpm` only. No `npm install`, no `npm run`.
- Conventional Commits, work-unit commits, no AI attribution.
- Nothing under `src/**`, `package.json`, `tailwind.config.js`, `tsconfig.json` or
  any `.sql` is in scope. The RULE 07 finding is therefore out of reach by design.

## Pre-existing failure — not fixed here, and not a regression

`bash scripts/check-visual-contract.sh` fails on this branch **before** any unit in
this record lands:

```
FAIL  07   no unresolved interpolation inside Tailwind arbitrary utility 1 occurrence
        src/features/services/pages/SubstitutionAssignment.jsx:              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${ROLE_STYLE[block.role] || ROLE_STYLE.candidate}`}>
visual contract: FAILED  (1 failing, 10 non-failing)
```

This is outside the authorised edit surface and is deliberately left red. It is
**not** to be cleared by loosening rule 07 or by editing the file: per the script's
own doctrine, a violation is fixed in the source, and the source is not editable
here. U1 makes it *legible* — after U1 this failure no longer costs the test and
build steps their verdicts — which is the whole of what U1 promises.

## Progress

### U1 — visual gate runs last (landed)

`ci.yml` step order is now install → lint → test → test:gherkin → build → visual
gate. The explanatory comment is kept and rewritten to state the reason, and the
gate script's own header (which claimed it ran "between `pnpm lint` and
`pnpm test`") was corrected in the same commit, because a gate that documents the
wrong position is the same defect one layer down.

Verification at this commit:

```
npx tsc --noEmit            → exit 0
pnpm lint                   → exit 0
pnpm test                   → 14 files, 348 tests passed
bash scripts/check-visual-contract.sh → FAILED (1 failing, 10 non-failing), rule 07, pre-existing
```

The last line is the point of U1 in one row: it is unchanged in content, and now it
costs nothing downstream.

### U2 — `pnpm typecheck` wired into CI (landed)

`tsc --noEmit` was absent from `ci.yml`, so a type error shipped behind a green
check. The comment above the step records what it currently covers, because
"typecheck runs" reads as far stronger coverage than it is: `tsconfig.json` sets
`allowJs` with global `checkJs` deliberately OFF, and only files carrying a
`// @ts-check` pragma are checked. `src/features` is not in `include`, so **no UI
`.jsx` is type-checked**. That gap is stated in the workflow file itself, where the
next person will read it, rather than left for a reader to assume.

Placed before lint: a type error names the actual defect, and a lint run over the
same file adds noise rather than signal.

Verification at this commit:

```
npx tsc --noEmit            → exit 0
pnpm lint                   → exit 0
pnpm test                   → 14 files, 348 tests passed
```

Measured coverage claim behind the comment: 47 real files are checked — 24 in
`src/data`, 12 in `src/domain`, 6 in `src/integrations`, 4 in `src/offline`, 1 in
`src/lib`. `tsc --noEmit` is therefore **not** a no-op; it was before this record
misreported it as one.

### Docs that this unit makes stale — not in the edit surface

`AGENTS.md` carries a section titled **"CI does not run typecheck"**, which U2 ends.
It is not an authorised edit surface for this record, so it is left alone and named
here instead. `odd/tasks/music-theory-discrepancies.md` (T20) carries the same claim
("It is absent from CI, and on #224 it caught a real error the other three gates
would not have"); that sentence stays true as history but must not be read as
current state.

### U3 — the skill points at the file the gate actually reads (landed)

Three surfaces, one correction:

| Surface | Change |
|---|---|
| `SKILL.md` Hard Rule 1 | Names `tailwind.config.js` as the single `cem.*` source and states the gate reads it. |
| `SKILL.md` new "Declared Token Source" | One machine-readable `token-source:` line — Hard Rule 1's address. |
| `SKILL.md` References | `assets/tokens.css` relabelled **NON-AUTHORITATIVE**: rationale, not a layer; read for the *why*, do not copy a value out. |
| `assets/tokens.css` | `STATUS: proposal` replaced by a banner stating it is not the source, not imported, not read by any gate, superseded for enforcement. **Nothing deleted** — the provenance is the point of the file. |
| `check-visual-contract.sh` | New **rule 08**, enforcing: the skill's declared token source and `$TAILWIND_CONFIG` must be the same file. |

Rule 08 is `enforcing`, added to the RULE MODES block in numeric order, placed after
rule 07, and written in the script's existing idiom: `verify` for the verdict,
`note` for the state, `$TMP_DIR/findings` for the detail, `|| true` at the call
site because `set -e` would otherwise abort on the `1` return.

The `for required in ...` startup check now includes `SKILL_FILE`, so a partial
checkout fails at setup with the same message shape as a missing `src/`, rather
than producing a rule 08 that cannot read anything.

**A missing declaration is a failure, not a pass.** This is the one design decision
in the rule that matters. An enforcing rule that prints `PASS` over a check that
never ran is worse than no rule, because it reads as coverage — the exact defect
class this record exists to close. It mirrors how rule 05a refuses to score an
unreadable anchor token.

Both failure modes were exercised before the rule was committed:

```
CASE 1  token-source -> assets/tokens.css
  FAIL  08  skill declares the token source this gate reads    1 occurrence
          skills/cemurm-visual-system/SKILL.md: declares token source
          "assets/tokens.css", but this gate reads every colour from "tailwind.config.js"
CASE 2  token-source line deleted
  FAIL  08  skill declares the token source this gate reads    1 occurrence
          skills/cemurm-visual-system/SKILL.md: no "token-source:" declaration;
          the skill must name the file this gate reads
          gate reads tailwind.config.js; skill declares <none declared>
restored
  PASS  08  skill declares the token source this gate reads    0 occurrences
```

Verification at this commit:

```
npx tsc --noEmit            → exit 0
pnpm lint                   → exit 0
pnpm test                   → 14 files, 348 tests passed
bash scripts/check-visual-contract.sh → FAILED (1 failing, 11 non-failing)
                                        the 1 failing is rule 07, pre-existing
                                        11 non-failing = the 10 before, plus rule 08
```

The failing count did **not** move; the non-failing count moved 10 → 11. Rule 08
was proven to fail on purpose first, which is the only way its `PASS` is worth
anything.

## Deviations

- **`AGENTS.md` is stale after U2.** Its section "CI does not run typecheck" is no
  longer true. Outside this unit's edit surface; recorded above, not edited.
- **`check-test-integrity.sh` sits before `pnpm test`** (U4), by instruction. That
  is the one placement in this record that partially gives up U1's principle: a
  trip there still marks the test steps `SKIPPED`. The mitigation is that the check
  is a static scan of the test files themselves, so a trip means the suite's own
  verdict is untrustworthy anyway — but `pnpm build` has no such excuse and is the
  stronger place for it. Flagged rather than decided unilaterally.

## Open

- U4 — not yet landed at the time this section was written.