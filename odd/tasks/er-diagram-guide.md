# ER diagram — generated from the live schema, with a guide that explains the system

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

### 3.7 The Proyecto IV proposal, measured against the schema

`proyecto iv.docx` (Asociación Civil Voces que se Unen) is a **scope proposal**, not a
description of what exists: 21 functional requirements, 34 numbered transactions, 37 proposed
tables and an empty data dictionary. Attached to the guide as-is it would read as a spec the
system meets, so it is attached as a gap analysis instead.

`scripts/proyecto-iv-proposal.json` holds the document's content extracted verbatim —
requirement names, transaction numbering 1–34 and the Spanish table names are the document's,
and reordering them would break the reference a reader has on paper.

`PROPOSAL_MAP` in the generator is curated, because turning `Obra_Musical` into a real table id
cannot be derived from a database. What *is* derived is whether the target exists: a mapping
pointing at a table the migrations never created **fails the build**. Three states, because two
would lie — `exact` (same concept, another name), `partial` (a real table covers part of it),
`missing` (nothing in `public` implements it).

Measured result:

| Dimension | Count |
|---|---|
| Transactions runnable end to end | **10 / 34** |
| Transactions blocked by a missing table | 24 |
| Proposed tables that exist | 12 exact + 3 partial |
| Proposed tables missing | **22 / 37** |

By area: musical/events 8/10 · academic **0/10** · inventory and loans **0/7** ·
users/permissions/reports 2/7.

**A transaction counts as runnable only when none of its tables is missing.** The first pass used
"all exact / some / none" and called 19 of 34 *partial* — which is the wrong answer to the
question the annex exists to answer. Two of three tables existing still means the transaction
cannot run; reporting it as partial hides exactly the gap.

Non-obvious mappings, all `partial` and stated in the UI rather than glossed over:
`Agrupacion` → `organizations` (a tenant, not a group with its own members),
`Evento_Agrupacion` → `event_participants` (links to an organization, not a group),
`Repertorio_Agrupacion` → `collections` (groups songs, but is bound to neither an
organization nor a group).

A contradiction had to be resolved, not papered over: §3.6 said education and inventory were
"fuera de alcance", while the proposal asks for them. The heading is now **"Alcance
implementado"** with **"Fuera de la implementación actual"**, and the excluded list says what the
document asks for and the database does not have — 10 academic transactions, 7 inventory/loan
transactions, event logistics.

UI: four stat tiles, a segmented coverage bar (12 green / 3 amber / 22 red), the step ladder,
and three `<details>` — the 34 transactions per area, the 21 requirements, and the 37-table
catalog. A catalog row with a real target is clickable and focuses that table on the canvas.

### 3.7.1 The annex reads as next steps, not as an audit

A gap analysis answers "how far off are we". The reader's actual question is "what do we build
next", so the section is titled **"Próximos pasos — lo que propone el Proyecto IV"** and opens
with **"propuestas, no compromisos"**. The distance is still measured; it is now expressed as
work.

**Ordering cost alone was wrong.** Sorting the four areas by the tables they own put "users,
permissions and reports" first with two tables — but four of its seven transactions read
academic and inventory tables that do not exist, so it can close one transaction, not seven.
Cost is not the constraint; dependency is. Steps are now ordered topologically: a step becomes
available when every table it borrows is already built, and among the available ones the cheapest
goes first. Ownership is assigned to the area that first asks for a table in document order,
which separates a table an area builds from a table it merely reads.

The ladder the data produces:

| # | Step | Own tables | Leaves the area at |
|---|---|---|---|
| 1 | Musical management and events | 3 | **10 / 10** |
| 2 | Inventory, loans and assignments | 4 | **7 / 7** (borrows 2 from step 1) |
| 3 | Academic management | 13 | **10 / 10** |
| 4 | Users, permissions and reports | 2 | **7 / 7** (borrows 11 from steps 1–3) |

**3 + 4 + 13 + 2 = 22**, exactly the tables missing, and building all four leaves nothing
blocked. Both facts are build-time assertions (`Los pasos planifican N tablas...`,
`Los pasos no cubren las transacciones...`): a ladder is the thing a reader will act on, so an
incomplete one must fail the build rather than read plausibly.

Counts are cumulative, not per-area: inventory shows 7/7 because step 1 already built the two
tables it borrows. Counting only its own tables read "0/7" for a step that in fact finishes the
area. Collapsing the 34 transactions into a `<details>` took the guide from 4424 to 3209 px
scrolled.

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
| Ladder accounting | 3 + 4 + 13 + 2 = 22 tables, all 34 transactions covered — asserted at build time |
| Annex DOM after the reframe | 4 steps, 34 transaction rows inside the detail, 3 collapsed `<details>`, no console errors |
| `bash scripts/check-visual-contract.sh` | OK, 12 rules, 0 failing |
| `pnpm lint` / `pnpm typecheck` | clean |
| Proposal annex: 34 transaction rows, 24 blocked, 85 red chips | as rendered, 1920×867 |
| Catalog row → canvas | `setlists` selected, guide closed, zoom 62% |
| Console errors after the annex | none |

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
| `docs/er-diagram.html` | regenerated — 61 tables, 8 domains, 77 drawn relations, 9 processes, proposal annex |
| `scripts/proyecto-iv-proposal.json` | new — the document's 21 requirements, 34 transactions, 37 table names, verbatim |
| `skills/cemurm-uml-diagrams/SKILL.md` | one line: the diagram is generated, never edited |
