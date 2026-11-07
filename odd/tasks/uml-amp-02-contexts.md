# amp-02 — institutional expansion context diagram

Branch: `docs/uml-amp-02-contexts`. Delivery: single PR, no size exception needed.

## Objective

Ship the `amp-02` diagram the roadmap has been describing as non-existent, and correct the
two sentences that claim it does not exist.

## Problem / Why

`docs/roadmap-ampliacion.md:6` stated, as of `main`:

> los dos diagramas previstos — `amp-01-estado-requerimientos.html` y
> `amp-02-arquitectura-contextos.html` — **nunca se generaron y no existen en el árbol**

`git ls-tree -r origin/main -- docs/uml/` confirms it: neither existed. The result is that
the roadmap's central ordering argument — C1 must land first because `org_memberships` is
read-only — was asserted in prose with no diagram behind it.

## Change

- `docs/uml/amp-02-arquitectura-contextos.archify.json` — the diagram source. 251 lines:
  two boundaries (`HOY — ya construido`, `AMPLIACIÓN`), eight components, three
  `roster escribible` edges from C1 into C2/C3/C4, three annotation cards, and three views
  (`orden`, `superficie`, and the reuse view).
- `docs/uml/amp-02-arquitectura-contextos.html` — the generated viewer (14,958 lines).
  Output, not source: it is the archify runtime stamped with the JSON above.
- `docs/roadmap-ampliacion.md:6` — now says what is true: `amp-02` exists and what it shows;
  `amp-01` still does not and has no `.archify.json` source.

## Claims in the diagram, checked against the schema

The strongest card asserts that `org_memberships` is read-only. Verified:

```
$ grep -rn "org_memberships" supabase/migrations/*.sql | grep -iE "grant|policy|create table"
0001_init.sql:27                                    CREATE TABLE org_memberships (
0016_org_repertoire_model.sql:86..101                three `create policy ... _select_*`
0016_org_repertoire_model.sql:552                    grant select on table
                                                     public.organizations, public.branches,
                                                     public.org_memberships to authenticated;
```

Grant `select` only, three policies, all `SELECT`. No `insert`, `update` or `delete` policy
targets that table anywhere in `supabase/migrations/`. The card is accurate.

## Scope

Split out of PR #425 on review request, alongside two sibling slices: the `uc-04` cards file
that repairs `build-all.sh`, and the internal operations console specification.

**The split did not happen.** #425 merged whole on 2026-11-07 (`25c975f`) with a recorded
`size:exception` (`odd/tasks/internal-operations-console.md`). The sibling branch
`docs/uml-uc04-build-fix` / #439 was closed as absorbed, and `docs/ops-console-proposal` /
#442 was reduced to its route revision. This record is recovered from the branch that was
closed; the diagram, the viewer and the roadmap correction had already landed byte-identically
in #425.

The console slice's `/dashboard` question is still open in #442: `src/app/router.jsx:86-110`
mounts that path behind `RequireOrgOwner`, which denies every role the console is meant to
serve.

`amp-01-estado-requerimientos.html` is not part of this slice and has no source file in the
tree. The roadmap now says so instead of lumping both diagrams together.

## Verification

- `python3 -c "json.load(...)"` on the `.archify.json`: parses, eight components, three
  connections, three cards.
- The viewer is closed and complete (`</html>` present) and carries all eight component
  labels, all three `roster escribible` edges and all three card titles.
- `grep -rn "amp-02"` across `*.md`, `*.feature`, `*.json`, `*.yml` finds no remaining
  claim that it is missing. The hits in `odd/tasks/fix-363-review-defects.md` and
  `odd/tasks/judgment-day-ampliacion-r1.md` are historical execution records of an earlier
  review round and are left as written.

## Log

- L1: reviewer asked to split PR #425 into three slices and noted that slice 2 only needs
  to also update `docs/roadmap-ampliacion.md:6`, which states amp-02 "nunca se generó y no
  existe en el árbol" — false the moment the diagram lands.
- L2: 2026-11-07 — the split was abandoned; #425 merged whole with `size:exception`. Record
  rescued to `main` so the unit keeps its execution history.
