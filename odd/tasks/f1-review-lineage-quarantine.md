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
