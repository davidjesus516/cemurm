# music-theory-discrepancies — fix the confirmed spec/code gaps

> Feature: the 10 specification discrepancies found by the characterization suite
> (`odd/tasks/cemurm-brand-landing.md` §14). Vehicle per §14.4: "a change proposal per
> finding is the right next vehicle — not a bugfix smuggled into a refactor."
> Authorized: 2026-09-27 by user ("arranca con los cambios"). Branch: to be cut from
> `feat/cemurm-brand-landing-pr1b-boundary-refactors` after PR #168 merges.

## Objective

Turn the four reproduced findings (A–E) and the six pending ones (F–J) into explicit
OpenSpec change proposals, resolve the design decisions each one hides, and only then
change code — so no fix is smuggled into a refactor and no test is weakened to make a
gate pass.

## Problem / Why

The characterization suite added in PR 1b-0 (`e267b97`) was written against the code as
it is, not as the Gherkin says it is. Where they disagree, the tests recorded the code.
Ten discrepancies were reported; four were independently reproduced and confirmed.

Three of the four confirmed findings share one failure mode: **code that looks
implemented and is not.** A branch exists, a comment documents the intended behaviour,
the schema supports it, a feature file specifies it, and an outreach proposal sells it.
The implementation is absent or wrong.

Consequence beyond the bugs: `docs/propuestas/cemurm-propuesta-para-orquesta-nacional.md`
lines 73, 74 and 75 — every music-theory claim in that document — are now known false.
The music-theory layer is what separates CEMURM from a setlist app, so the layer that
differentiates the product is also the least trustworthy part of it.

## The confirmed findings

| # | Finding | Gherkin it violates | Status |
|---|---|---|---|
| A | `src/domain/chart/parser.js:9` puts `'key'` in `KNOWN_META`, so the check at `:69` matches every `{key: …}` and `continue`s. The `directive.name === 'key'` branch at `:73` is unreachable; `sectionKeyContexts` is always `[]`. The module's own self-check fails and was never run. | `music-theory.feature:106`, `:138` | Reproduced |
| B | Enharmonic spelling is decided by a hardcoded set of six major key names (`transpose.js:46`), not by the key's own spelling. A Cb major chart renders entirely in sharps, and the same key written `F minor` vs `Fm` gets opposite answers, because the set holds `F` but not `Fm`. | `music-theory.feature:149,155,159` | Reproduced by execution. Proposal: `fix-key-spelling-preference` |
| C | The OnSong export cannot reach `agreed_key`; `flattenSetlist()` never copies it. Data exists one layer below (`supabase/seed.sql:104`). | `external-integrations.feature` | Reproduced |
| D | No tie-break in offline conflict resolution. `features/offline-edit-conflict-policy.feature:47-51` requires the applied rule stored with the resolution. Code is strict `>`; nothing is stored. | `offline-edit-conflict-policy.feature:47-51` | Reproduced |
| E | `qualityForDegree` is **inert**: it returns `'power'` for every degree of every heptatonic scale — **0 correct out of 49** measured across 7 scales. Its `:77-78` reads the *next two scale steps* instead of scale degrees 3 and 5, an off-by-two. The chord's own suffix is never parsed, so the "musician override wins" scenario cannot pass either. | `features/music-theory.feature:72,79` — "Degree quality derives from the scale" / "Musician override wins over derived quality" | Confirmed by execution. Proposal: `fix-degree-quality-derivation` |

**Lettering note.** These letters are the eight proposals', which are the artifact in review
(#185). An earlier draft of this table used different letters for F, G and H — it split the two
readiness findings and gave F to an unrelated OnSong item. The proposals pair the readiness
findings as F+G (one defect from two sides) and give H to the reconcile silent drop, which is
the more severe of the two. The split-letter draft is superseded, not merely renumbered; §14.2
of the branch-only `cemurm-brand-landing.md` reuses `E` for a different finding than §14.1's `E`
and should not be used as the reference lettering.

~~Pending, reported by the suite, not yet reproduced~~ — **resolved, and it is not an eleventh
finding.** The OnSong directive duplication reproduced against the seed's own stored shape
(`supabase/seed.sql:224-227` stores `${title: Amazing Grace}` / `{artist: John Newton}` /
`{key: G}` inside the body, and `parser.js:9` lists `title`/`key`/`artist` as `KNOWN_META`).
`serializeOnSong` emits its own three at `:39-41` and appends the body verbatim at `:42-43`, so
every metadata directive appears twice and **the two `{key:}` values conflict** — the exporter
says the agreed key, the body says the chart key, and nothing says which wins. It is **finding
C's second half**, not a separate item: the decision of which `{key:}` survives is the same
decision as carrying `agreed_key`, and splitting them would put two PRs on the same three lines
in an order that cannot be made safe. `fix-onsong-agreed-key` is amended accordingly.

Now proposed, all eight lettered: `F`+`G` readiness lifecycle and per-version tracking
(`fix-readiness-lifecycle`); `H` the reconcile silent drop (`fix-reconcile-silent-drop`); `I`+`J`
Spotify key labels and the mode comparison (`fix-spotify-key-parsing`). `H` is the most severe
of the pending findings and is scoped as such — a queued op with a lost `queuedAt` becomes `0`,
every real server timestamp beats `0`, and the op is dropped as *"superseded"*, with a notice
indistinguishable from the one for a genuinely stale op.

## The sharp edges — triaged 2026-09-27, one refuted

Seven behaviours the suite recorded because no feature file specifies them. All seven were
executed against the real modules. **Six reproduced. One is false.**

| # | Behaviour | Verdict |
|---|---|---|
| 1 | `transposeChord('C', 2.5)` → `"undefined"` | reproduced — **garbage output, not a throw**; `transposeNote:73` indexes `NOTES_SHARP[2.5]` |
| 2 | `transposeChord('am', 3)` → `"am"` | reproduced — `CHORD_RE` at `transpose.js:79` is case-sensitive |
| 3 | `transposeKey('B♭', 2)` → `"C#♭"` | reproduced — U+266D is in neither note table, so it is captured as a modifier and re-appended |
| 4 | ~~`buildSubstitutionMap` creates a key for `undefined`~~ | **REFUTED** — see below |
| 5 | a flat-spelled anchor never matches under a sharp key | reproduced, with a mechanism |
| 6 | `reconcileSetlistOp(null, …)` throws | reproduced — one production call site, `offlineSync.js:111` |
| 7 | `computeReadiness` throws on a truthy non-string key | reproduced |

**#4 is false and is recorded as refuted, not deferred.** `buildSubstitutionMap`
(`annotations.js:55-64`) guards with `if (a.kind !== 'chord_substitution') continue` and then
`if (anchor) map[anchor] = a.value`. Probed against seven malformed shapes — `undefined`, `null`,
`{chord:null}`, `{chord:""}`, `{chord:0}`, a bare number — **all produce zero keys**; only a
legitimate non-empty string produces one. The guard is present and correct.

**#5's mechanism, which is what makes it a real bug rather than a quirk.**
`applySubstitution` (`annotations.js:82-89`) looks up `transposeChord(token, -semitones,
preferFlatForKey(baseKey))` — the token reverse-transposed using the **base key's** flat
preference. So whether an anchor written `"Bb"` matches depends on whether the chart's key
happens to be a flat key: on a C-major chart the lookup key comes out sharp-spelled, misses, and
the function returns the token **unchanged with no signal**. Same substitution, same anchor,
different chart key, silently inert. It needs finding B's rule as a prerequisite and B is
necessary but **not** sufficient — `preferFlatForKey('C')` is false before and after B, so the
C-chart case reproduces identically once B lands.

**That is four claims in this record that did not survive execution:** B's
`transposeKey('C', -2)` example, E's 4-scale measurement, the letter-to-finding mapping, and now
#4. The pattern is the same each time — a claim copied from a suite report without being run.

## Design decisions — three resolved, one still open

**These three were listed as open product decisions. They were not.** The Gherkin answers each
one; they had to be read, not asked.

1. **B — when does a flat win? → Resolved by `music-theory.feature:149,155,159`.** The rule is
   the key's own spelling: a key written with a flat prefers flats throughout, one written with
   a sharp prefers sharps, and one spelling per section. The code substituted a hardcoded set
   of six major key names for that rule. The set is deleted; the rule is derived. Proposal:
   `fix-key-spelling-preference`.
2. **D — the tie-break rule → Resolved by the Gherkin's own determinism constraint.** The
   feature file names *that* a recorded rule applies and that it is stored with the resolution
   "so every device reaches the same result", but not *which* value breaks the tie. That
   constraint decides it: the key must be computable from data both devices already hold, with
   no coordination. `seq` is per-queue and therefore 0 on every device — rejected. `args[0]` is
   the author, is different on each device, and is already present — chosen. **The key is
   derived, not specified**, and a maintainer can overrule it on one line. The storage half is a
   verified gap: no migration in `supabase/migrations/` has a column to put it in. Proposal:
   `fix-offline-tie-break`, and its migration number is deliberately left open.
3. **E — the correct degree-quality algorithm → Resolved by `music-theory.feature:72,79`.**
   Quality derives from the scale, so stack scale degrees 1, 3, 5 — the standard tertian
   computation. The explicit chord overrides the scale. There was never a choice to make: the
   function is inert, wrong 0 times out of 49, and no alternative algorithm could be "correct"
   and still contradict the feature file. Proposal: `fix-degree-quality-derivation`.

**Still genuinely open — one, and it is narrower than it was.** `F`/`G` is now **decided**:
per-version, and `retired` as an absence (2026-09-27). No migration, `is_ready` becomes
meaningful, and the feature file is not amended. What is left open is not a product question but
an implementation one: what makes a version *current*, for a song that has several. That is
resolved at apply time, not here, and it is flagged in the proposal rather than assumed.

## Scope

- OpenSpec change proposal per finding, each with a delta spec against the Gherkin it
  violates.
- The three design decisions above, resolved with the maintainer, recorded in the
  proposals as Frozen Decisions.
- Implementation only after each proposal's decisions are settled — one PR per finding.
- Repair `openspec/config.yaml`, which is stale: it declares "NO test framework, NO
  typecheck, NO CI" and points at the pre-relocation `src/` layout
  (`components/, pages/, hooks/, lib/, store/, utils/`).

### Out of scope

- The outreach proposal's copy. Findings feed it; rewriting it is a separate task.
- The 4 unmerged branches of Hito 5 and `fix/hito4-review-batch1` (9 commits, including
  the songs-metadata RLS leak on `0016:125`). Untouched here.
- Any weakening of an existing characterization assertion to make a gate pass.

## Constraints

- **A failing characterization test is fixed in the source, never in the assertion**
  (AGENTS.md, delivery workflow clause 3). Tests that pin buggy behaviour on purpose are
  marked `FINDING (behaviour, do not "fix")` — those are the ones a real fix must update,
  and the update is the deliverable, not a shortcut.
- YAGNI entry rule (`docs/engineering-review-backlog.md:5`) is active: implement an item
  only when its hito or BDD feature requires it.
- Conventional Commits; work-unit commits; chained `-prN-` slices at ~400 changed lines.

## Tasks

- [x] T1 — Map the branch state and verify the refactor gates. `pnpm lint` 0,
      `pnpm test` 293/9 files, `pnpm typecheck` 0, `pnpm build` OK.
- [x] T2 — Land PR 1b (six ADR 0002 refactors) with the acceptance-gate deviation
      documented. PR #168.
- [x] T3 — Write this record and its Engram mirror.
- [x] T4 — Proposal for finding A (parser sectional key).
      `openspec/changes/fix-parser-sectional-key/`
- [x] T5 — Proposal for finding C (OnSong `agreed_key`).
      `openspec/changes/fix-onsong-agreed-key/`
- [x] T6 — Proposal for findings F + G (readiness lifecycle and per-version
      tracking), paired because they are one defect seen from two sides.
      `openspec/changes/fix-readiness-lifecycle/`
- [x] T7 — Proposal for finding H (reconcile silent drop).
      `openspec/changes/fix-reconcile-silent-drop/`
- [x] T8 — Proposal for findings I + J (Spotify key parsing), paired because same
      module and same root cause class.
      `openspec/changes/fix-spotify-key-parsing/`
- [x] T9 — Proposals for findings **B**, **D** and **E**. All three were listed as blocked on
      product decisions; **none was**. The Gherkin answers each one — read, not asked. B's rule
      is the key's own spelling, D's is forced by the feature file's own determinism
      constraint, and E's is the standard tertian stacking the feature file already names. Only
      `F`/`G` still holds a real product decision.
      `openspec/changes/fix-key-spelling-preference/`,
      `openspec/changes/fix-offline-tie-break/`,
      `openspec/changes/fix-degree-quality-derivation/`
- [ ] T10 — Repair `openspec/config.yaml`. Deferred until the M0 chain merges, since it
      must describe the post-M0a tree and the test runner that M0b adds.
- [x] T11 — Correct the findings table. B's evidence was the withdrawn `transposeKey('C', -2)`
      example, E's was 4 scales where 7 were measured, and the letter-to-finding mapping
      disagreed with the proposals for F, G and H. All three fixed. The `§14` lettering of the
      branch-only `cemurm-brand-landing.md` is not used as the reference, and the eight
      proposals' citation to it — a file that exists on no base branch — was repointed at this
      record.
- [x] T12 — **F/G decided**: per-version, `retired` as an absence. `fix-readiness-lifecycle`
      amended from "the proposal does not make this decision" to a dated decision with the
      alternatives kept, and with the cost stated: a retired version renders *nothing* rather
      than a distinct label, so if the product later wants retired to look different from draft,
      this is the wrong decision and it is cheaper to reverse before call sites are touched.
- [x] T13 — Sharp edges triaged. All seven executed; six reproduced, one **refuted** (#4). Split
      by whether a decision is required, not by whether it throws: `fix-unspecified-crashes`
      (three with no valid reading at all) and `fix-unspecified-silent-wrong` (three where the
      input is plausibly valid and the right answer is arguable).
- [x] T14 — C amended with the duplicate-directive finding. Not an eleventh finding: the
      decision of which `{key:}` survives is C's decision. Its "emit alongside first"
      recommendation is withdrawn and recorded as withdrawn, because alongside *is* the conflict.
- [x] T15 — Closed the five superseded PRs (#143, #144, #145, #146, #168) with a comment naming
      the replacement chain on each. #168 was the dangerous one: 5908 lines, unreviewable,
      inviting an accidental merge. 21 open → 18, and all 18 are now part of a real chain.
- [x] T16 — Findings A, B, C, E, F+G, H, J implemented, one PR each: #218 A, #219 B, #220 C,
      #217 E, #222 F+G, #216 H, #221 J. All open and MERGEABLE against `main`.
- [x] T17 — The seven sharp edges split and both halves implemented: #223
      `fix-unspecified-crashes` (three with no valid reading) and #224
      `fix-unspecified-silent-wrong` (three that needed a decision, all three now recorded as
      Frozen Decisions **before** the code, and a fourth lookup that the tests surfaced is
      declared as beyond the decision).
- [x] T18 — **Finding D did not become a `fix/` branch.** It is the offline conflict tie-break and
      it is already carried by the `m2-plan-freeze` chain (#192/#193), which owns the stored
      resolution rule. Duplicating it here would have put two PRs on the same migration. Finding
      **I** stays open on purpose: the Spotify sharp-only spelling needs the caller to say whether
      the chart is flat-friendly, and only a human knows that. Neither is forgotten; both are
      declined, with a reason.
- [x] T19 — Two capability specs created, which this record had assumed were contested:
      `openspec/specs/music-theory/spec.md` and `openspec/specs/substitutions-and-coverage/spec.md`.
      The proposal predicted #218 and #219 would also create `music-theory/spec.md` and that one
      would have to own the file. **Checked rather than assumed: all 16 `fix/*` branches were
      inspected and not one adds any file under `openspec/specs/`.** The hazard never materialised.
- [x] T20 — `pnpm typecheck` was run on every PR after all. It is absent from CI, and on #224 it
      caught a real error the other three gates would not have: a helper returning `string | null`
      passed straight into a `string` parameter.

## Sequencing constraint

**No finding may be implemented until M0b (#171) merges.** The 293-test characterization
suite is the only regression net this repository has, and every finding here is a behaviour
change against code the suite currently pins. Fixing a finding rewrites the assertion that
pins the bug — legitimate, because the behaviour is intentionally changing, but it also means
nothing can catch an *unintended* change until the suite is on `main`.

## Verified file locations

The proposals cite these. An earlier version of the A proposal cited `src/lib/parser.js`,
which does not exist — the parser sits one level deeper, under `chordpro/`.

| Finding | File on `main` | After M0a |
|---|---|---|
| A | `src/lib/chordpro/parser.js` | `src/domain/chart/parser.js` |
| B, E | `src/lib/transpose.js`, `src/lib/degreeResolver.js` | `src/domain/music/*` |
| C | `src/lib/exporters/onsong.js` | `src/domain/setlist/exporters/onsong.js` |
| D, H | `src/lib/setlistCollab.js` | `src/domain/setlist/collab.js` |
| F, G | `src/lib/readiness.js` | `src/domain/chart/readiness.js` |
| I, J | `src/lib/spotify.js` | `src/integrations/spotify.js` |

## Acceptance criteria

- [x] Each of A–E has an OpenSpec change with a delta spec whose scenarios are traceable
      to the Gherkin scenario it violates. **Met, with one correction:** the two new capability
      specs live in `openspec/specs/`, not as per-change delta specs.
- [x] Each proposal records its design decisions as Frozen Decisions, not as assumptions. Met —
      and the three that were open when #224 was written were taken and written down **before** the
      code, which is the whole point of the rule.
- [x] The outreach proposal is not edited in this change; findings are handed to it.
- [x] No characterization assertion is weakened to clear a gate. **Met, and the mechanism held:**
      every bug-pinning assertion was **inverted**, named, and the comment explaining *why* the old
      answer was wrong was kept in the file. Not one was deleted or loosened.
- [x] Every fix ships as its own PR with the Gherkin scenario it closes cited. Met for 9 of the
      10 findings across #216–#224; D and I are declined with a reason, not skipped silently.

## Checks

- TDD: not applicable in the classic sense — these are behaviour changes against existing
  code, so the test is written from the Gherkin scenario, not from the implementation.
- Functional: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` (typecheck is not in
  CI — run it locally).
- For A, B and E specifically: the `FINDING (behaviour, do not "fix")` tests
  (`src/domain/chart/parser.test.js:86`, `src/domain/music/transpose.test.js:44`) must be
  **inverted** — the assertion changes from pinning the bug to asserting the spec.

## Progress / Verification evidence

- Engram mirror: topic `odd/music-theory-discrepancies/tasks`, project `cemurm`.
- T2 evidence: PR #168, 9 commits, gates green, gate deviation documented in the PR body.
- The four reproductions are recorded verbatim in `odd/tasks/cemurm-brand-landing.md` §14.1.

## The suite caught six of my own wrong claims

The single most useful line in this record. An assertion I wrote from memory instead of running
failed, and each failure was my arithmetic rather than the module's. Kept here because the next
person will be tempted the same way.

| Claim I made | What the module actually does |
|---|---|
| `transposeChord('bm', 3)` → `'C#m'` | `'Dm'` — B minor up a minor third |
| `transposeChord('F♯m', 2)` → `'Gm'` | `'G#m'` — the default spelling is sharp |
| `semitonesBetween('C♯', 'D')` → 2 | 1 — C♯ to D is a minor second |
| a lowercase **key** tonic is safe to accept | it broke `Am` and `Bbm`; `atonal` became `Btonal`. Implemented, measured, **reverted** |
| `transposeKey('Bes', 2)` → `'C#es'` | the fix works, but only because `Bes` is matched *before* the generic pattern |
| **`pnpm build` is the only coverage of imports** | **false.** Build prints the missing-export error and **exits 0**. `pnpm lint` is the real gate (`no-undef`); `pnpm test` catches it only incidentally |

The last one changes how every PR in this series should be reviewed: **a green build proves nothing
about imports.** It was measured by breaking an import on purpose, twice.

## Next step

Nothing is blocked in this record. Nine PRs (#216–#224) are open and MERGEABLE, all based on `main`,
all with the four gates green locally. Two are declared overlaps and the one that lands second
needs the other:

- **#224 and #223** share the fractional-semitone assertion in `annotations.test.js` (~2 lines).
- **#224 and #219** — #224 does not close the C♭ edge, and says so in its body.

**Landing order is not constrained** beyond those two overlaps: every one of the nine is based on
`main`, not on another fix branch. The maintainer merges; nothing here merges itself.
