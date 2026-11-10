# Repair `docs/uml/build-all.sh` — missing uc-04 cards file

Branch: `docs/uml-uc04-build-fix`. Delivery: single PR, no size exception needed
(17 authored lines plus one generated viewer).

## Objective

Make `bash docs/uml/build-all.sh` exit 0 on `main` again.

## Problem / Why

`docs/uml/build-all.sh:49` calls `build_open` with
`docs/uml/uc-04-alcance-institucional.cards.json` as the fifth argument, and that file
does not exist on `main` (`git ls-tree origin/main -- docs/uml/uc-04-alcance-institucional.cards.json`
returns nothing).

`stamp_archify.py:1033` reads it without a guard:

```python
cards = json.loads(args.cards.read_text()) if args.cards else None
```

So the entire UML regeneration aborts with an uncaught `FileNotFoundError` after it has
already processed uc-01 through uc-03. The repository's documented diagram workflow is
broken, and the fix is one 17-line JSON file.

## Change

- `docs/uml/uc-04-alcance-institucional.cards.json` — the three annotation cards
  `build-all.sh` already expects. 17 authored lines.
- `docs/uml/uc-04-alcance-institucional.html` — the viewer, regenerated (generated output).

## Verification

Failure reproduced on a scratch export of `origin/main` (Kroki running locally):

```
$ git archive origin/main docs/uml | tar -x -C "$SCRATCH" && cd "$SCRATCH"
$ bash docs/uml/build-all.sh
  ...
  File "<scratch>/docs/uml/stamp_archify.py", line 1033, in main
    cards = json.loads(args.cards.read_text()) if args.cards else None
FileNotFoundError: [Errno 2] No such file or directory:
  'docs/uml/uc-04-alcance-institucional.cards.json'
EXIT=1
```

With the file present, on this branch:

```
$ bash docs/uml/build-all.sh
 OK  docs/uml/uc-01-add-song.html
 OK  docs/uml/uc-02-collections.html
 OK  docs/uml/uc-03-comments.html
 OK  docs/uml/uc-04-alcance-institucional.html
     nodos instrumentados : 8
     relaciones           : 3
     placeholders i18n    : 0
Consistencia:
  uc-01/02/03/04  <<actor>> and skinparam-hash c36facf8 identical across all four
EXIT=0
```

The regeneration is deterministic: re-running it left `uc-01`, `uc-02`, `uc-03` untouched
and produced a byte-identical `uc-04` viewer, so the committed HTML is exactly what the
toolchain emits.

## Scope

This unit was split out of PR #425 on review request: a 17-line fix trapped behind 30,995
diff lines is not reviewable as a slice.

**The split did not happen.** #425 merged whole on 2026-11-07 (`25c975f`) with a recorded
`size:exception` (`odd/tasks/internal-operations-console.md`), and the branch
`docs/uml-uc04-build-fix` / PR #439 was closed as absorbed — its content had already landed
there byte-identically. This record is recovered from that branch so the work is not left
undocumented.

The `/dashboard` route question raised here is **closed**: the maintainer settled it on
2026-11-08 at `/ops`, a new path behind a new `RequireStaff` guard. `/dashboard` is mounted
behind `RequireOrgOwner` (`src/app/router.jsx:95-114`), which denies every role the console is
meant to serve; that guard is left untouched. Reasoning in
`openspec/changes/add-internal-operations-console/proposal.md` § Resolved questions.

## Log

- L1: reviewer asked to split PR #425 because a 17-line fix was trapped behind 30,995
  diff lines, and noted `build-all.sh` is broken on `main` right now.
- L2: 2026-11-07 — the split was abandoned; #425 merged whole with `size:exception`. Record
  rescued to `main` so the unit keeps its execution history.
