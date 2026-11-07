# ER diagram — generated from the live schema, with a guide that explains the system

Branch: `docs/er-diagram-schema-truth`. Delivery: single PR, `size:exception` documentado — 61 tablas vivas y el motor de layout no se pueden partir más; el anexo Proyecto IV salió del diff por la pregunta de consentimiento (ver `## Log`).

## 1. Objective

Make `docs/er-diagram.html` answer three questions for a reader who has never seen CEMURM:
what the system is, which tables carry it, and how those tables relate — without opening a
terminal.

## 2. Problem

Three defects, all found by looking at the artifact rather than at the code:

| Defect | Evidence |
|---|---|
| The diagram **lied**. Hand-written, it showed 48 tables; the migrations had created 60 | `docs/er-diagram.html` on `main` |
| It **explained nothing**. 60 boxes, no ordering, no prose — a box is not an explanation | — |
| "Ver todo" rendered a vertical strip at **13%**, unreadable | measured in Chrome at 1280×720 |

A diagram nobody can read is worse than no diagram, because it is used to make decisions.

## 3. What shipped

### 3.1 The artifact is now generated, never edited

`scripts/build-er-diagram.mjs` reads the running local Postgres through `information_schema`
and `pg_constraint`, and injects the data block into `scripts/templates/er-diagram.html`,
which is a pure renderer. Editing the HTML by hand is now a build error waiting to happen.

Cardinality is derived from constraints, not from table names: a table whose primary key is
exactly its FK columns is a bridge (`N:M`); an FK covered by a PK/UNIQUE is `1:1`; everything
else is `1:N`.

### 3.2 One curated block, validated against the database

Product prose cannot come out of `information_schema`, so `GUIDE` in the generator holds the
message, the scope, the core tables and the nine processes. Every table it names is checked
against the live schema before the file is written — a process pointing at a table the
database no longer has **fails the build** instead of shipping a lie.

Relationships per process are not written by hand: they are the real foreign keys between
those tables, read from the database. The "se conecta con" line is derived from outgoing FKs.

### 3.3 Core tables by counted fan-in, not by taste

`fanInCounts()` counts how many tables point at each one. Result:

| Table | Referenced by |
|---|---|
| `songs` | 16 tables |
| `organizations` | 13 |
| `setlists` | 11 |
| `song_versions` | 6 |
| `branches` | 6 |

`auth.users` is excluded: it is a boundary, not a public table.

### 3.4 A map that fits

60 full cards never fit on one screen; 60 headers do. "Ver todo" renders header-only cards and
`chooseLayout()` tries shelf widths from 1400 to 3000 px, keeping the one that maximises
on-screen fit — no magic constant. Result at 1280×720: **13% → 51%**, 60/60 tables fully
inside the canvas. At 1920×867: **70%**.

That change exposed a second bug the zoom number hid: the map touched the bottom edge exactly,
which reads as clipped. `VIEW_GUTTER` keeps 26 px of air, and the measurement is now a real
containment check (`card.bottom <= area.bottom`), not "some part is visible".

### 3.5 Group labels on the canvas

The layout already reserved a 30 px band per domain block and left it empty, so the map was 60
colour-coded boxes with nothing saying which group was which. Eight labels now name the blocks,
fade when a focused process does not touch them, and are clickable.

### 3.6 The guide is the entry point

The canvas opens behind a scrollable panel: system message, the five core tables with their
fan-in, nine process cards (click → the canvas frames exactly those tables with a banner), and
the scope split into "Incluido hoy" (10) and "Fuera de alcance" (3). A caveat states the
numbers honestly: 133 foreign keys total = 50 to `auth.users` + 6 self-references + 77 drawn
between `public` tables.

### 3.8 Merging `main` broke the build on purpose — and that is the point

`main` moved 91 commits while this branch was open, adding `0042`–`0045`: account export,
erasure, import, and a member guard. Applying them locally took `public` from 60 to 61 tables,
and the generator then refused to run:

```
Error: Tablas sin dominio asignado en DOMAIN_OF: account_erasure_requests
Asignales un dominio; el diagrama no adivina.
```

That refusal is the feature. A diagram generated from a schema nobody re-read would have
shipped 60 boxes for a 61-table database — wrong in exactly the way the hand-written one was.
`account_erasure_requests` is now classified `tenancy`, next to `profiles` and
`guardian_consents`, where an account-deletion request belongs.

The merge also made "Incluido hoy" incomplete: export, import and erasure ship with repositories,
domain modules and tests (`src/data/repositories/accountErasure.js`,
`src/domain/account/`). Scope gained one line rather than letting the guide omit a shipped
capability. The 77 drawn relations are unchanged — the new table has no foreign key.

## 4. Verification

| Check | Result |
|---|---|
| `node scripts/build-er-diagram.mjs` twice, `cmp` | byte-identical |
| 1280×720, "Ver todo" | 51%, 60/60 cards inside the canvas, 8 domain labels, no horizontal overflow |
| 1920×867, "Ver todo" | 70%, 60/60 inside, margins 128/130 px |
| Process "Servicio semanal" | 7 highlighted / 53 dimmed, all 7 inside, banner correct |
| Process "Biblioteca" at 1280 / 1920 | 83% / 100%, 7/7 highlighted inside |
| Table click from the map | selected card fully visible; 13 relations listed in the detail panel |
| Console errors | none, both viewports |
| Regenerated after merging `main` (61 tables) | `DOMAINS` rejected the unclassified table before it could ship |
| `bash scripts/check-visual-contract.sh` | OK, 12 rules, 0 failing |
| `pnpm lint` / `pnpm typecheck` | clean |

**Deviation, stated because it matters:** `chrome-devtools` was the agreed tool and produced
the guide/map/process evidence, but the browser then exited repeatedly and the MCP kept a stale
handle (`The browser is already running for …chrome-profile`) across restarts. The final pass
moved to Playwright; the numbers above come from that script, not from the MCP.

**Known limit:** a table's neighbourhood can span four domains and does not fit at the 62%
readable floor. Clicking a table guarantees *that table* is on screen and lists all of its
relations in the detail panel; some neighbours stay off-canvas and are reached by panning.

## 5. Risk

`Risk: none` for production behaviour — no application code, no migration, no schema change.
The generator has no automated test; its correctness rests on the build-time table validation
and byte-identical rebuilds. A schema change that renames a table fails the build rather than
producing a wrong diagram.

## 6. Files

| Path | State |
|---|---|
| `scripts/build-er-diagram.mjs` | new — introspection, `DOMAINS`, `GUIDE`, validation |
| `scripts/templates/er-diagram.html` | new — CSS, layout engine, guide, highlight painter |
| `docs/er-diagram.html` | regenerated — 61 tables, 8 domains, 77 drawn relations, 9 processes |
| `skills/cemurm-uml-diagrams/SKILL.md` | one line: the diagram is generated, never edited |

## Log

- L1 (2026-11-02, reviewer): "Asking for a split — and the reason is not the line count." Slice A = schema truth (`node scripts/build-er-diagram.mjs` as it stands, minus `buildProposalLiteral`); slice B = the Proyecto IV annex, stacked on A. Slice A mergeable once the two 🟡 items settle; slice B waits for the consent question.
- L2 (2026-11-03, split executed): removed from this slice per that request — `buildProposalLiteral`, `PROPOSAL_MAP`, `PROPOSAL_PATH` and the "Propuesta IV" build summary from `scripts/build-er-diagram.mjs`; the annex CSS (`.proposal-*`, `.pstat`, `.cov-*`, `.req-*`, `.cat-*`, `.area-*`, `.tx-*`), `renderProposal()` and the `id="proposal"` section from `scripts/templates/er-diagram.html`; §3.7/§3.7.1 and their verification rows from this record; `scripts/proyecto-iv-proposal.json` stays out entirely.
- L3 (2026-11-03, consent reasoning): `scripts/proyecto-iv-proposal.json` is 708 lines extracted from `proyecto iv.docx`, which is not in the repo — nobody but the maintainer can verify the extraction, it embeds a third party's proposal text (including title options naming the Asociación Civil Voces que se Unen) into a public repository. Whether publication was consented to is a licensing question that must not block schema truth. The two GUIDE prose lines that mention the document ("…10 transacciones del Proyecto IV", "…7 transacciones…") are scope context naming provenance, not extracted content, and stay.
- L4 (2026-11-03, verification on this slice): generator runs against the live local DB (migration `0045`) — 61 tablas, 8 dominios, 133 FK, 77 dibujadas (0 1:1 · 10 N:M · 67 1:N); two consecutive runs byte-identical (`762a7880…`); `DOMAINS`/`ENTITIES`/`GUIDE` literals hash-identical to the artifacts #424 shipped; full diff against #424's `docs/er-diagram.html` contains only annex removals; Playwright at 1280×720 — `#proposal` absent, guide opens, 61 cards, zero console errors. The reviewer's 🟡 #1 (body fan-in typo) lands corrected in the PR body: `song_versions` fan-in 5, `branches` 6. 🟡 #2 (`.mjs` outside `pnpm lint`) is PR #436, separate by the reviewer's own suggestion.
- L5 (2026-11-03): the comment "reading 60 boxes" in the generator became count-neutral ("reading the boxes") — a hardcoded count in a comment goes stale on the next migration, which is the off-by-one the reviewer caught between body and artifact.
