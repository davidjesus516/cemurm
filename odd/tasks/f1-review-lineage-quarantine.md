# F1 — native review lineage quarantined (execution record)

The F1 chain (#523 → #530 → #531 → #532) had a native RDD review started and
never finished. It was quarantined on 2026-11-18 rather than left half-open.
This record says what was attempted, why it stopped, and — importantly — that it
produced **no review evidence**.

## What was attempted

| Field | Value |
|---|---|
| Lineage | `review-d72a044f0aec422e` |
| Workspace | `/home/antony/Documentos/GitHub/cemurm` |
| Tier | medium |
| Lenses | risk, readability, reliability |
| State at abandonment | `active` / `reviewing`, revision `sha256:93c317b0624edf6e89f0b4e2a8e79202967de6b2be220a97251d5157ab551282` |

`START` succeeded. The first `capture` failed with
`pi-host-relay-transport-failure`: *"no model is configured for `review-risk`
(routing source: `/home/antony/.pi/gentle-ai/models.json`)"*.

## Why it could not be resumed here

`/home/antony/.pi/gentle-ai/models.json` **does not exist** — the directory holds
`agent-status/`, `personality.json`, `runtime-guardrails.json` and `scratch/`,
but no model routing. Assigning a model to `review-risk`, `review-readability`
and `review-reliability` is human-controlled configuration outside the
repository, so an agent cannot supply it, and inventing a routing file would
mean reviewing against a model nobody chose.

`AGENTS.md` already records the neighbouring constraint: only `claude-code` and
`codex` are eligible review transports, and preflight stops historically resolve
to `immutable_review_transport_unsupported`. The stop here is one step earlier —
the transport existed, the model did not.

## What was done

```
gentle-ai review abandon \
  --cwd /home/antony/Documentos/GitHub/cemurm \
  --lineage review-d72a044f0aec422e \
  --expected-revision sha256:93c317b0624edf6e89f0b4e2a8e79202967de6b2be220a97251d5157ab551282 \
  --reason operator_disposition \
  --actor codebuff \
  --maintainer-authorization <8-line v2 binding>
```

Result (`review/abandon`, status `committed`, 2026-11-18T01:00:50Z):

- Quarantine path: `.git/gentle-ai/review-transactions/quarantine/review-d72a044f0aec422e-333050936`
- Residue: `review-state.json`
- `discarded_work`: `captured_lens_results: []`, `findings_present: false`

`gentle-ai review status --cwd /home/antony/Documentos/GitHub/cemurm` now reports
`status: clean`, `entries: 0`, no diagnostics.

## What this record does not claim

- **No PASS, and no review.** `captured_lens_results` was empty and
  `findings_present` was false: the three lenses never produced a result. The
  abandonment is an audit trail for discarded work, not a quality verdict.
- **F1 is still un-reviewed natively.** Its gate remains human review on the
  PRs, which is where it always was — #523 is waiting on `davidjesus516`, and
  the stacked slices carry no review decision at all.
- The five defects the manual quality pass found (recorded in
  `odd/tasks/f1-membership-admin.md`) were found by reading the code and by
  `supabase db reset`, not by this lineage. Nothing here should be read as the
  native review having caught them.

## Addendum — the retry happened, same day

`~/gentle-ai/models.json` was created with `deepseek-v4.1-flash-free` for the
three lenses, and a fresh lineage was started:

| Field | Value |
|---|---|
| Lineage | `review-b841a975e3ebd585` |
| Tier / lens | medium / `review-reliability` |
| Scope | 10 paths, 1358 changed lines, base tree `9fc8d8b8`, candidate `bfdd44aa` |
| Result | **3 CRITICAL, 1 WARNING, 2 SUGGESTION** |
| State | `correction_required` (bounded correction, budget 200 lines) |

So the paragraph above ("F1 is still un-reviewed natively") described the state
*before* the retry and no longer holds: the chain now has a native review, and it
did find severe defects. It stopped at `correction_required` because the three
CRITICAL findings live in the F1 chain's own branch, which this record's author
could not modify.

Because the CLI has no reviewer launcher of its own, the lens was run through
`review lens-context` + `review capture-result`, i.e. **by the same agent and
model that wrote the review request** — not an independent second opinion. Treat
it as a stronger-than-nothing self-review, not as the independent RDD pass.

## Outcome — the findings were fixed, not just reported

All four defects the review found are closed in `4466da0` on
`feat/f1-pr1-migration` (#523): nullable `actor_id`, branch-preserving role
change, the `org_owner`-appointment guard on the role path, the revoked table
grant, and the upsert that never fired for a null branch. The five assertions
that fail on the reviewed code ship as #535, stacked on #533.

Verified against a real database, not just the gates: `supabase db reset` applies
the chain and the smoke is 21 PASS / 0 FAIL. So the "could not modify the F1
chain's branch" sentence above is now historical — this record is what happened
up to and including the hand-off, and #523 carries the fix itself.

The lineage is still `correction_required` and still bound to the pre-fix
candidate (`bfdd44aa`). Closing it needs a review of the new candidate, or an
abandonment; declaring it validated here would be claiming a review of code that
no longer exists.

## To retry

Configure a model per lens in `/home/antony/.pi/gentle-ai/models.json`, then
start a fresh lineage with `gentle-ai review start`. The abandoned lineage is
terminal and cannot be reopened; `review recover` is for a different failure
class.

`AGENTS.md` states that `review assess` no longer exists in 4.5.0. On this
install it does exist — `gentle-ai review --help` lists it — but
`review assess --help` describes it as *"the read-only candidate risk assessment
review start would use to select lenses, without creating any review authority"*.
So the guide's practical claim holds while its wording does not: `assess` cannot
start or advance a review, and `review start` remains the entry point.
