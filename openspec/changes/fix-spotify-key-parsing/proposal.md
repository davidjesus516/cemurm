# Proposal: Spotify key labels cannot spell flats, and the mode check is exact-string

> Change: `fix-spotify-key-parsing`
> Findings: **I** and **J** of the 10 discrepancies (`odd/tasks/music-theory-discrepancies.md`)
> Status: proposed. Both reproduced. Paired deliberately — same module, same root cause class.

## Intent

`src/lib/spotify.js` turns a Spotify key index into a human label. Two defects in that path
produce wrong labels rather than errors, and both are invisible to the user: a chart imported
from Spotify can come back labelled in a key the musician does not recognise.

## Problem

**I — the label table is sharp-only.**

```
const NOTES_SHARP[((Number(keyIndex) % 12) + 12) % 12]
```

The table has twelve sharp spellings and no flats, so `Db`, `Eb`, `Bb` and the rest are
structurally unreachable. The input arrives from Spotify as an integer, and Spotify's own
convention for flat keys is to return the sharp index — so the spelling decision has to happen
here, and it currently always goes one way.

**B♭ is among the most common keys in orchestral and worship music.** A player looking at
`"A# major"` for a chart that is in B♭ major has no way to know the label is merely a
spelling of the right key.

**J — the mode check is an exact string comparison.**

```
`${note} ${mode === 'minor' ? 'minor' : 'major'}`
```

Anything that is not the literal string `'minor'` becomes `major`. The characterization suite
asserts that `'Minor'`, `'MINOR'`, `'minor '` (trailing space), `'m'`, `0`, `1` and `null` all
render as `'E major'`. Spotify's API returns a mode **integer** in some shapes and a string in
others, and this code was evidently written against one of them.

The combination is worse than either alone: a flat key in a minor mode can render as a sharp
major key.

## Scope

### In scope

- `spotifyKeyToLabel` (or its post-#182 equivalent): a spelling rule that can emit flats.
- The mode check: accept the shapes Spotify actually sends, and reject genuinely unknown input
  rather than defaulting it to major.
- What an unknown mode should do — see the decision below.
- Delta spec for the `external-autotagging` capability.

### Out of scope

- **Finding B**, the enharmonic-spelling problem in `src/lib/transpose.js`. That is a different
  function, a different consumer, and it carries the open product decision *"when does a flat
  win?"*. This change fixes the Spotify label path; B fixes transposition. They are related and
  they are **not** the same change — merging them would couple a mechanical fix to an unresolved
  product question.
- Findings A, C, D, E, F, G, H.
- Changing what is sent to Spotify. This is read-side only.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `external-autotagging` (new capability spec — the repository has no
  `openspec/specs/external-autotagging/` today, so this change creates it)

## Approach

**Spelling.** The mechanical fix is "add a flat table and choose between them". The rule for
choosing is the part that overlaps finding B, and it must be decided once and shared:

- *circle of fifths canonical form* — deterministic, one answer per key, but it will call Bb
  "A#" for the same reason Spotify does.
- *preference by key* — a flat-preferring key stays flat throughout. Matches how musicians
  read, costs a table.
- *caller-supplied* — the caller knows whether the context is flat-friendly (a flat-key
  orchestral chart) or sharp-friendly (a jazz chart) and says so.

**Recommendation:** the caller-supplied rule, defaulting to sharp. It defers the product
decision to whoever knows the context, which is the same conclusion finding B reaches, and it
means this change and B can land independently without either one hard-coding a preference.

**Mode.** Accept the documented shapes — `'minor'`, `'Minor'`, `'MINOR'`, `'m'`, and the
integers Spotify uses — after trimming and case-folding. The question is what happens to
anything *else*. Defaulting unknown input to `major` is the current bug: it converts "I do not
know" into a confident wrong answer. Returning `null`, or a `{ label, known: false }` shape,
lets the caller decide. That is a small API change with a wider blast radius, so it is stated
here as a decision rather than assumed.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/spotify.js` | Modified | the label table and the mode comparison |
| `src/integrations/spotify.test.js` | Modified | the characterization suite pins both defects on purpose |
| `openspec/specs/external-autotagging/spec.md` | New | capability spec |

## Verification

- `pnpm test` — `spotify.test.js` is the gate. It currently asserts `'Minor'`, `'MINOR'`,
  `'minor '`, `'m'`, `0`, `1` and `null` all produce `'E major'`, and asserts only sharp
  spellings. **Every one of those assertions inverts.** The test diff is the evidence.
- `pnpm typecheck && pnpm lint && pnpm build`.
- Manual: import a chart in B♭ minor and confirm the label reads as a flat minor key.

## Rollback

One module, one test, one new spec. No schema, no migration, no persisted state. Low risk.

## Frozen decisions

1. **Not merged with finding B.** B is `transpose.js` and carries the open decision *"when does
   a flat win?"*. This is `spotify.js` and is mechanical. Coupling them would make an urgent
   label fix wait on an unresolved product question.
2. **The mode comparison stops being an exact match.** The current form cannot receive data
   from the API it claims to integrate with.
3. **Unknown input does not become `major`.** That conversion is the bug. Whatever the
   replacement shape is, it must distinguish "not minor" from "not a mode I recognise".
4. **The assertions invert, they do not get deleted.** The suite's seven mode assertions and its
   sharp-only assertion are precisely what made these findings reproducible.
