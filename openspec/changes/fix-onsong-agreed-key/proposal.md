# Proposal: OnSong export must reach `agreed_key`

> Change: `fix-onsong-agreed-key`
> Finding: C of the 10 specification discrepancies in `odd/tasks/music-theory-discrepancies.md`
> Status: proposed. Reproduced. No open product decision.

## Intent

`features/external-integrations.feature` requires the OnSong export to contain *"the songs in
order with their charts and **agreed keys**"*. The exporter cannot produce a key that is not
written on the chart. The data exists — the setlist item's agreed key is already in the database
— but nothing carries it into the export.

This is a reachability bug, not a missing feature.

## Problem

`src/lib/exporters/onsong.js` has **zero** references to `agreed_key`. `flattenSetlist()`
copies the song and its versions onto flat objects and never copies the setlist item's
`agreed_key`, so by the time the serializer runs the value is gone. `supabase/seed.sql:104`
writes it, so the column is populated and correct — it simply never reaches the output.

Two distinct keys are in play and the exporter currently emits only one:

| Key | Source | Meaning |
|---|---|---|
| chart key | `song_versions.base_key` | the key the chart is written in |
| **agreed key** | `setlist_items.agreed_key` | what the band agreed to sing it in |

For a player those can differ, and the agreed key is the one that matters on the night.

**And the value cannot be emitted at all as the file stands.** `serializeOnSong` writes its own
`{title:}` / `{artist:}` / `{key:}` lines (`:39-41`) and then appends the chart body **verbatim**
(`:42-43`, and the header comment at `:5` says that is deliberate so ChordPro sections survive).
Bodies in this application *carry those directives*: the app's own parser lists them as metadata
at `src/lib/chordpro/parser.js:9` — `KNOWN_META = new Set(['title', 'key', 'artist'])` — and
`supabase/seed.sql:224-227` stores Amazing Grace with `${title: Amazing Grace}` / `{artist: John
Newton}` / `{key: G}` inside the body. Run against that exact shape:

```
{title: Amazing Grace}      ← the exporter's
{artist: Tradicional}       ← the exporter's
{key: C}                    ← the exporter's
${title: Amazing Grace}     ← the body's
{key: G}                    ← the body's, and it disagrees
```

**Every metadata directive appears twice, and the two `{key:}` values conflict.** `agreed_key:0`
references in the module, three duplicates in the output. OnSong reads one of them and nothing
says which. `supabase/migrations/0001_init.sql:184` states the precedence rule in a comment —
*"explicit agreed key → precedence over context (code-level rule, not schema)"* — and a file
containing two `{key:}` directives cannot express which one is the explicit one.

This is why **C cannot be fixed by carrying the value alone**, and why it is one change rather
than two. Emitting the agreed key "alongside" what the body already says would produce exactly
this conflict, twice over.

## Scope

### In scope

- `flattenSetlist()` (or its equivalent) carries `agreed_key` from the setlist item onto the
  flattened object.
- `serializeOnSong()` emits it, in a form OnSong understands.
- **Stripping the body's own `title` / `artist` / `key` directives before appending it.** Order
  matters: strip first, then emit. Emitting first and stripping after can strip the line this
  change just wrote. This is not separable from the key — whichever directive survives is the
  decision, so a change that carries `agreed_key` without resolving the duplicate produces a
  file with two conflicting keys.
- The decision for a song with **no** agreed key: fall back to the chart key, and say so.
- Delta spec for the `external-integrations` capability, with the scenario traced to
  `features/external-integrations.feature`.

### Out of scope

- Findings A, B, D, E and F–J. Each gets its own change.
- The Planning Center exporter (`exportSetlistToPlan`), which has the same gap. Separate change;
  it is a different format with a different consumer.
- Any change to how a setlist item's agreed key is *set*. That flow works.
- ChordPro export to `.cho` beyond what this change already does.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `external-integrations` (delta spec against the existing feature file; the repository has no
  `openspec/specs/external-integrations/` yet, so this change creates it)

## Approach

Two things have to be decided, and only the first is a real question.

**1. Representation.** OnSong's `.cho` format has no first-class "agreed key" field. Options:

- emit the agreed key as the chart key — i.e. transpose the exported chart. This is what a
  player actually wants, but it is a transformation, not a label.
- emit it as a directive or comment alongside the chart key.
- emit both and let the import decide.

The trade-off is fidelity versus effort. Transposing is the most useful and the most work, and
it changes what the file *is*. Emitting alongside is cheap and leaves the interpretation to
OnSong, which may not support it.

**2. Fallback when `agreed_key` is NULL.** Recommend the chart key, silently. A setlist where
nobody agreed on a key is normal, and a file missing a key is worse than one carrying the
chart's.

**3. Which `{key:}` survives the duplicate.** Not a question — forced by Problem. One key per
file, because two is not a representation, it is a contradiction. Strip the body's own `title`,
`artist` and `key` before appending, then emit the agreed key (or the chart-key fallback) in the
one slot that remains.

Recommendation: **strip the duplicate, then emit the agreed key as the single `{key:}`**, and
leave transposition to a follow-up with real usage data. The earlier draft of this proposal
recommended "emit alongside first", and that recommendation is withdrawn: alongside *is* the
conflict. It was written before the duplicate was found. That is also what YAGNI points at —
`docs/engineering-review-backlog.md:5`.

Stripping is not a loss. The body's `{key: G}` is the chart's own key, which is exactly what the
fallback emits when there is no agreed key, so nothing is discarded that the file would not
otherwise say. What is lost is a *second, contradictory* answer, which was never information.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/exporters/onsong.js` | Modified | carry and emit `agreed_key` |
| `src/lib/exporters/onsong.test.js` | Modified | the characterization suite pins the current output; a real fix inverts it |
| `src/lib/setlists.js` | Possibly | if the query that feeds `flattenSetlist` does not select the column |
| `openspec/specs/external-integrations/spec.md` | New | capability spec, agreed-key requirement only |

## Verification

- `pnpm test` — the OnSong characterization suite is the gate. It currently asserts the output
  **without** the agreed key, so a real fix inverts that assertion; the diff in the test file is
  the proof the behaviour actually changed.
- `pnpm typecheck && pnpm lint && pnpm build`.
- **A duplication assertion, not just a presence one.** A test that only checks `agreed_key`
  appears would pass on the current duplicated output, because `{key:}` is already there twice.
  The gate must count occurrences — one `{title:}`, one `{artist:}`, one `{key:}` — against a
  body that already carries all three. Use the seed's own shape:
  `${title: Amazing Grace}` / `{artist: John Newton}` / `{key: G}`.
- Manual: a setlist whose item has an `agreed_key` different from the chart key, exported and
  reopened. The seed sets `agreed_key` on the demo setlist item, so the fixture exists. Open the
  file in OnSong and confirm it reports the agreed key, not the chart's — that is the only check
  that proves the right directive won.

## Rollback

One module, one test file, one new spec. No schema, no migration, no persisted state. Low risk.

## Frozen decisions

1. **The Gherkin is not edited to match the exporter.** `features/external-integrations.feature`
   is the product source of truth. This change conforms to it.
2. **The bug-pinning test is inverted, not deleted.** `exporters/onsong.test.js` is what made
   this finding reproducible. Deleting it to go green is the failure mode the delivery
   agreement forbids.
3. **A NULL `agreed_key` falls back to the chart key**, not to an error and not to an empty
   field. A setlist where nothing was agreed is an ordinary state.
4. **Planning Center is a separate change.** It has the same gap and a different format; folding
   it in would make this PR untestable against one consumer.
5. **The duplicate directive is part of C, not a separate finding.** The suite reported it
   unlettered, which made it look like an eleventh item. It is not: the decision of *which*
   `{key:}` survives is the same decision as carrying `agreed_key`, and splitting them would
   produce two PRs touching the same three lines with an order that cannot be made safe.
6. **Strip before emit, never emit then strip.** The body's `{key:}` is the chart key, which is
   what the fallback emits anyway, so nothing is lost. The alternative ordering can strip the
   line this change just wrote.
7. **The earlier "emit alongside first" recommendation is withdrawn.** Alongside *is* the
   conflict, and it was written before the duplicate was known. Recorded rather than quietly
   removed, because the reasoning that produced it was reasonable given what was known then.
