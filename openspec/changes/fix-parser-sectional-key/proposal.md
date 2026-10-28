# Proposal: Fix dead sectional-key context in the ChordPro parser

> Change: `fix-parser-sectional-key`
> Finding: A of the 10 specification discrepancies in `odd/tasks/music-theory-discrepancies.md`
> Status: proposed. Blocks nothing else; this is the one confirmed finding with no open
> product decision.
>
> **Path note:** on `main` today the file is **`src/lib/chordpro/parser.js`**. After M0a merges it
> becomes `src/domain/chart/parser.js`. An earlier version of this note said
> `src/lib/parser.js`, which does not exist — the parser sits one level deeper, under
> `chordpro/`. Line numbers are the same in both layouts.

## Intent

`features/music-theory.feature:106` ("A song can modulate between sections") and `:138`
("Transposing a modulating song shifts every section relative to its own context") describe
a product capability that the parser cannot perform. The code contains a branch, a
comment and a data structure for sectional key context, and none of them run. A musician
who writes a chart that modulates gets one flattened key for the whole song, and no error.

This change makes the parser do what the feature file says, or — if the capability is
deferred — makes the dead code and the false documentation go away. It will not be left
in the ambiguous middle state where a reader believes the feature works.

## Problem

`src/domain/chart/parser.js:9` lists `'key'` in `KNOWN_META`. The directive loop at `:69`
therefore matches every `{key: …}` directive against `KNOWN_META` and `continue`s before
reaching the check at `:73`. The branch that would record a sectional override is
unreachable, and `sectionKeyContexts` is always `[]`.

The comment at `:74-76` documents the intended behaviour — that a *second* `{key: G}`
overwrites `meta.key` rather than becoming a sectional override — as though it were
happening. It is not. The comment is a description of intent written next to code that
cannot express it.

Reproduction:

```
$ node -e "import('./src/domain/chart/parser.js').then(m=>m.demo())"
demo failed: song-level key is first directive — expected "C", got "G"
```

The module ships a self-check that **fails**. It was evidently never run. That is the
second-order problem: the repo contains a check designed to catch exactly this, and the
check did not run in CI or anywhere else.

## Scope

### In scope

- The parser's directive handling for `{key: …}`: decide first-directive versus
  sectional-override semantics and implement it, or remove the unreachable branch.
- `sectionKeyContexts`: populate it, or remove it from the public surface.
- The comment at `:74-76`, which must describe what the code does.
- The module's self-check: make it runnable and passing, and decide where it is invoked.
- The characterization test at `src/domain/chart/parser.test.js:86`, which currently pins
  the bug (`it('sectionKeyContexts is ALWAYS empty, even for a chart that modulates')`).
  If the capability is implemented, this assertion is **inverted** to assert the spec.
- Delta spec for the `music-theory` capability, with scenarios traced to
  `features/music-theory.feature:106` and `:138`.

### Out of scope

- Findings B, C, D and E. Each gets its own change.
- The six pending discrepancies (F–J).
- Any change to ChordPro directive syntax, the `{…}` format, or how sections are delimited.
- A general parser refactor. The five-boundary split in PR 1b is done; this is a
  behavioural fix inside the module it produced.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `music-theory` (new capability spec — the repository has no
  `openspec/specs/music-theory/` today, so this change creates it and populates it with
  the sectional-key requirements only. The other 18 scenarios in the feature file stay
  unwritten until their own changes land.)

## Approach

Two mutually exclusive options. The proposal does not choose; that is the point of
putting it in a proposal.

**Option 1 — implement the capability.** Treat the first `{key: …}` as the song-level key
and every subsequent one as a sectional override recorded in `sectionKeyContexts` with
its section anchor. Remove `'key'` from `KNOWN_META` so the loop reaches the branch. This
delivers `music-theory.feature:106` and `:138`, and makes `demo()` pass.

**Option 2 — remove the dead code.** Delete the unreachable branch, `sectionKeyContexts`,
and the misleading comment. Mark the two feature scenarios as not-implemented, and remove
the failing self-check.

The tie-breaker is product intent, and the YAGNI entry rule
(`docs/engineering-review-backlog.md:5`) points at Option 2: sectional modulation is
implied by two scenarios but is not the subject of any hito, and nothing in the shipped
surface consumes `sectionKeyContexts` today. Option 1 is the more valuable change and the
larger one.

**Do not choose by default.** Option 1 changes what a musician's chart means, and
`music-theory.feature:138` depends on it: transposing a modulating song must shift every
section relative to its *own* context, which is only meaningful if sectional contexts
exist.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/domain/chart/parser.js` | Modified | directive loop; `KNOWN_META`; `sectionKeyContexts`; comment at `:74-76`; self-check |
| `src/domain/chart/parser.test.js` | Modified | `:86` pins the bug — inverted under Option 1, updated under Option 2 |
| `openspec/specs/music-theory/spec.md` | New | capability spec, sectional-key requirements only |
| `features/music-theory.feature` | Unchanged | the Gherkin is the source of truth; this change conforms to it, not the reverse |
| `docs/propuestas/cemurm-propuesta-para-orquesta-nacional.md:74` | Consumer | claims sectional modulation exists; corrected by whoever writes the landing copy, not here |

## Verification

- `pnpm test` — the inverted (or updated) parser test is the proof. Under Option 1 the
  existing `demo()` self-check must pass, which it currently does not.
- `pnpm typecheck && pnpm lint && pnpm build`.
- Manual: a chart with two `{key: …}` directives at different section anchors, rendered in
  both concrete and degree view, transposed to a target key.

## Rollback

Single module plus its test and one new spec file. Reverting the commit restores the
current behaviour exactly; no schema, no migration, no persisted state. Risk is low.

## Frozen decisions

1. **The Gherkin is not edited to match the code.** `features/music-theory.feature` is the
   product source of truth. If the capability is not wanted, the feature file is changed in
   its own right, as a product decision, with the reason recorded — not silently dropped
   here.
2. **The self-check must run somewhere.** Either a Vitest case or an npm script. A check
   that only exists inside a module comment is how this defect survived; a check that is
   written but never invoked is the same defect one level up.
3. **The bug-pinning test is inverted, not deleted.** `parser.test.js:86` is the artifact
   that made this finding reproducible. Option 1 flips the assertion; deleting the test to
   go green is the failure mode this repository's delivery agreement forbids.
