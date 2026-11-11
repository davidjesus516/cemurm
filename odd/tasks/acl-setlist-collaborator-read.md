# ACL: an accepted setlist collaborator can read the songs in it

Branch `feat/acl-setlist-collaborator-read`, base `main`. Delivery: one PR, `size:exception`
documented (1 545 authored lines against the ~400 budget; composition and the slicing pass in
`L8`).
Runner: `bash scripts/check-doc-counts.sh`, `./node_modules/.bin/supabase db reset`, and the smoke
through `docker exec -i supabase_db_cemurm psql`.

## Specs

**S1 — the gap.** An accepted setlist collaborator from another org can read `setlists` and
`setlist_items` but not `songs`, `song_versions` or `chart_files`. Measured on a fresh reset, as
`isolation` (`10000000-0000-0000-0000-000000000002`):

```
songs          → 6 rows: Isolation Anthem (own org) + 5 with org_id IS NULL
                 NOT Way Maker, NOT Oceans
setlists       → 1 row: Demo Setlist
setlist_items  → 2 rows, agreed_key G and C
chart_files    → 0 rows
song_versions  → 0 rows
```

The page therefore renders `(missing song)` per row and the export serializes to `""`. This unit
fixes the read path for inline ChordPro charts. It does **not** fix PDF/MusicXML: the `charts`
bucket is private with owner-folder RLS and 1-hour signed URLs, so a cross-org collaborator will see
the `chart_files` row and still fail to download the object. That stays a named finding.

**S2 — the rule: the owner vouches for the content.** Two helpers, not one.

`private.setlist_owner_can_read_song(owner_id uuid, song_id uuid)` asks, for the setlist's owner, the
question the five pre-existing song scopes ask for the caller: `songs_select_owner` (`created_by`),
`songs_select_system` (**`org_id is null and source_org_id is not null`** — the LIVE form, tightened by
`0020_review_batch1.sql:30-32` and re-issued by `0040_fix_migration_chain_rls.sql:60-66`; `0016`'s
original `org_id is null` alone is the C1 leak, and copying THAT form is what `L12` is about),
`songs_select_org` (org-level song, active member of that org), `songs_select_branch` (branch song,
active member of that branch) and `songs_select_public_library` (a live `public_songs` row).

`private.is_song_in_readable_setlist(user_id uuid, song_id uuid)` is what the policies call:

```sql
create function private.setlist_owner_can_read_song(owner_id uuid, song_id uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.songs s
    where s.id = $2
      and (
        s.created_by = $1
        or (s.org_id is null and s.source_org_id is not null)
        or (s.org_id is not null and s.branch_id is null and exists (
              select 1 from public.org_memberships m
              where m.user_id = $1 and m.org_id = s.org_id and m.status = 'active'))
        or (s.branch_id is not null and exists (
              select 1 from public.org_memberships m
              where m.user_id = $1 and m.branch_id = s.branch_id and m.status = 'active'))
        or exists (select 1 from public.public_songs ps
                   where ps.song_id = s.id and ps.status = 'live')
      )
  ) $$;

create function private.is_song_in_readable_setlist(user_id uuid, song_id uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.setlist_items i
    join public.setlists s on s.id = i.setlist_id
    join public.setlist_collaborators c on c.setlist_id = s.id
    where i.song_id = $2
      and c.user_id = $1
      and c.accepted_at is not null
      and s.owner_id is not null
      and s.owner_id <> $1
      and $1 = (select auth.uid())
      and private.setlist_owner_can_read_song(s.owner_id, $2)
  ) $$;
```

Three conditions, and each one answers a specific way the grant could be forged:

- **The caller is an accepted collaborator.** `c.accepted_at is not null` keeps a pending invite out.
- **The setlist's owner could already read the song.** This is the load-bearing one. It is what stops
  *forged content*: `setlists_insert_owner` (`0002_rls_core.sql:193-195`) checks only
  `owner_id = auth.uid()` and does **not** constrain `org_id` or `branch_id`, so any user can create a
  setlist carrying the victim org's ids and insert a foreign song into it. The obvious alternative
  rule — "the song's org/branch matches the setlist's org/branch" — is forgeable for exactly that
  reason and was rejected.
- **The caller is not the owner.** `s.owner_id <> $1`, with `s.owner_id is not null` first because
  `setlists.owner_id` is nullable and a NULL comparison would not be true. This one is **defence in
  depth, not the thing that closes the self-invite**: `setlist_collaborators_insert_owner`
  (`0002_rls_core.sql:247-253`) admits the owner inserting a collaborator row for *themselves* with
  `accepted_at` set, so the "accepted collaborator" condition is forgeable on a setlist the caller
  created — but the owner-vouches condition blocks that attack on its own, because the caller cannot
  read the foreign song they planted. That is what the attack depends on, and the matrix shows the
  difference: with the vouch removed, the self-invite probe fails; with only this condition removed,
  it does not.
  **It is pinned, though** — `L13` is where that was fixed, because until then no assertion held it
  down. The smoke now has demo admit *themselves* as an accepted collaborator of the Demo Setlist
  (the same pre-existing hole, exercised for real and admitted by the pre-existing policy rather
  than forced by postgres), so every other condition of the helper holds for the owner's own call
  and `s.owner_id <> $1` is the only thing denying it. Remove the condition and assertion 9 fails.
  One qualifier, because the measurement is not uniform: for **songs**, excluding the owner grants
  nothing and loses nothing — with the vouch faithful to the live scopes, an owner who could read
  the song could already read it by other means. For **`chart_files` rows** it is NOT uniform:
  `chart_files_select_owner` keys on `songs.created_by`, so for a song created by somebody else the
  setlist's owner can be narrower than the collaborator, and removing this condition turns the
  owner's chart read from 0 rows into 1. The song stays gated by the vouch; only the
  owner-exclusion clause differs.

Two further pre-existing holes are absorbed rather than trusted:

- `setlist_collaborators_insert_owner` lets an owner invite themselves — closed by the owner-vouches
  condition, as above.
- `setlists_update_member` (`0002_rls_core.sql:197-224`) lets a `can_edit` collaborator reassign
  `owner_id`, because its `WITH CHECK` does not constrain the new owner. With both owner conditions
  present, an ownership hijack grants nothing: the hijacker becomes the owner and is then excluded
  by `s.owner_id <> $1`, and the hijacker cannot vouch for a song they cannot read.

Mechanics:

- `security definer` is mandatory on both: `setlist_collaborators` has own-row RLS, so an
  invoker-rights helper cannot see the row it must find, and `org_memberships` shows a user only their
  own rows. Same reason `private.is_org_member` is definer.
- `stable` because both are evaluated per candidate row.
- `$1 = (select auth.uid())` is the tenancy guard: the function must never answer about another user.
  A caller passing a foreign uuid gets `false`, not an answer.
- `set search_path = ''` and fully-qualified names, matching `0002_rls_core.sql:14-24`.

**S3 — grants, and a default-privileges claim that did not hold.** `0002_rls_core.sql:42` runs
`alter default privileges in schema private revoke execute on functions from public, anon, authenticated`.
Measured on this database, that leaves **no `pg_default_acl` row** for the `private` schema, so it
does **not** cover functions created later: a new helper keeps PUBLIC's default EXECUTE. Both
functions therefore need explicit revokes, and the outer one an explicit grant:

```sql
revoke execute on function private.setlist_owner_can_read_song(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.is_song_in_readable_setlist(uuid, uuid) from public, anon;
grant execute on function private.is_song_in_readable_setlist(uuid, uuid) to authenticated, service_role;
```

The inner helper answers "can this person read this song", and that question must not be askable from
the outside. `authenticated` has USAGE on schema `private` (`{postgres=UC,authenticated=U,
service_role=U}`), so the revoke — not the schema — is what keeps it out of reach. The outer helper is
reachable only from the policies, and it runs as its owner, which is why it may call the inner one.

No table grants. `songs`, `song_versions` and `chart_files` already carry Supabase's default
`select` grant to `authenticated`; explicit table grants are #451's `0047_public_table_privileges.sql`
and must not be duplicated here.

**S4 — three additive SELECT policies**, in this exact spelling, `to authenticated`, with
`drop policy if exists` before each `create policy` (repo style):

| policy | table | predicate |
|---|---|---|
| `songs_select_via_setlist` | `public.songs` | `private.is_song_in_readable_setlist((select auth.uid()), id)` |
| `song_versions_select_via_setlist` | `public.song_versions` | `private.is_song_in_readable_setlist((select auth.uid()), song_id)` |
| `chart_files_select_via_setlist` | `public.chart_files` | `private.is_song_in_readable_setlist((select auth.uid()), song_id)` |

`chart_files.song_id` is `NOT NULL REFERENCES songs(id)` (`0001_init.sql:91`), so it needs no hop
through `song_versions`. No INSERT/UPDATE/DELETE policy changes: sharing is read-by-construction and
`can_edit` already governs writes. No recursion is possible — the chain is
`songs → setlist_items → setlists → setlist_collaborators → songs`, and nothing points back at `songs`
except the vouch helper, which reads `songs` as the definer owner with RLS bypassed.

**S5 — the indexes.** `setlist_items` has `UNIQUE (setlist_id, position)` and
`idx_setlist_items_orders (setlist_id, position)`, and **no index on `song_id`** (`0001_init.sql:188-190`).
A foreign key creates no index in Postgres. `public_songs` has no index on `song_id` either, although
both this helper and the pre-existing `songs_select_public_library` policy look rows up by it. Add:

```sql
create index if not exists idx_setlist_items_song on public.setlist_items(song_id);
create index if not exists idx_public_songs_song on public.public_songs(song_id);
```

Without the first, every `songs` read seq-scans `setlist_items` once per candidate row; without the
second, the vouch helper scans `public_songs` for every candidate song.

**S6 — the smoke, `scripts/smoke/0048-setlist-collaborator-read.sql`.** Fresh reset, single run,
`-v ON_ERROR_STOP=1`, the standard preamble copied from `0046-feedback-triage.sql:19-32`
(`set client_min_messages to notice`, `tmp_assert(text, boolean)`, `tmp_expect_error`), role switches
via `select set_config('role', ..., false)` and `select set_config('request.jwt.claims', ...)`,
fixtures in the `30000…` range as fixed UUID literals. The seed's two shared songs have no
`chart_files` and no `song_versions` row, so the smoke creates its own: Song A in demo's org (`…a1`)
with a `chart_files` row and a `song_versions` row, appended to the Demo Setlist at position 3;
Song B in demo's org in **no** setlist; Song C in demo's org inside a **second** demo-owned setlist
that has outsider as its accepted collaborator and isolation as nothing; Song D in demo's org in no
setlist, the target of the self-invite probe; a third demo-owned setlist where isolation holds
`can_edit`; **Song E, outsider's own PERSONAL song** — `org_id IS NULL` and `source_org_id IS
NULL`, no org at all, not in `public_songs` — which is what pins the live form of the system scope
(`L12`); and **demo's own self-invite row** on the seed's Demo Setlist, admitted by the pre-existing
`setlist_collaborators_insert_owner` rather than forced, which is what pins `s.owner_id <> $1` on
its own (`L13`). Fourteen assertions plus the tidy check:

1. `isolation` reads Song A's title — **the bug, and the RED assertion**.
2. `isolation` reads its `chart_files` row, including non-null `content`.
3. `isolation` reads its `song_versions` row.
4. `isolation` reads **0** rows of Song B — catches a helper that drops `where i.song_id = $2`.
   Measured: that mutation fails assertions 4, 5, 6 and 10.
5. `isolation` reads **0** rows of Song C — catches a helper that drops `c.user_id = $1`. Measured:
   that mutation fails assertions 5 and 6.
6. `outsider` (`…0003`, `accepted_at IS NULL` on the Demo Setlist) reads neither Song A nor its
   chart — catches dropping the `accepted_at is not null` guard.
7. `outsider` reads Song C, because it *is* accepted on that second setlist, and belongs to no org at
   all — with assertion 6 this pins the predicate to the per-setlist invite rather than to org
   membership or to the user's history.
8. `isolation` calling `private.is_song_in_readable_setlist(outsider_uuid, song_c_uuid)` returns
   `false` — the anti-oracle guard, and the only thing that can make it false: outsider **is** an
   accepted collaborator on the setlist holding Song C, so only `$1 = (select auth.uid())` denies it.
   The owner cannot be used for this assertion, because the owner's case is pinned by a DIFFERENT
   condition — the next item.
9. **The owner condition, pinned on its own (`L13`).** demo admits *themselves* as an accepted
   collaborator of the Demo Setlist — the same pre-existing hole the self-invite probe uses, and
   admitted by the pre-existing policy rather than forced. With that row in place, every other
   condition of the helper holds for demo's own call, so `s.owner_id <> $1` is the only thing
   denying it. Remove that condition and this assertion fails.
10. **The self-invite attack.** `isolation` creates its own setlist, inserts Song D into it and
    accepts its own invitation — every one of those writes is allowed by the pre-existing policies —
    and must still read **0** rows of Song D.
11. **The editor-forgery attack.** `isolation`, holding `can_edit` on a demo-owned setlist, inserts a
    song from another org into it. The helper must answer `false` for that pair — the visible row
    count would prove nothing, since isolation can read her own org's songs anyway.
12. **The personal-song attack (`L12`).** `isolation`, holding `can_edit` on the same demo-owned
    setlist, inserts the UUID of **Song E** — outsider's personal song, which the setlist's owner
    cannot read either — and must read **0** rows of it, of its `chart_files` row and of its
    `song_versions` row. This is the RED assertion against a vouch written in the pre-0020 form of
    `songs_select_system`: measured, that mutation fails this assertion and nothing else.
13. The setlist's **owner** reads **0** rows of Song E as well — the reason the assertion above
    holds. The owner's vouch is unsatisfiable, and the C1 leak stays shut: a personal song belongs
    to whoever created it, not to the system.
14. The owner still reads Song A, its chart and its version (non-regression).
15. The fixture tidy check.

The file closes with its `expects 15 PASS / 0 FAIL` line and removes every fixture it created.

**S7 — the count gate.** After adding one migration and one smoke, `bash scripts/check-doc-counts.sh`
must pass with `45 migrations, 23 smokes, 48 features, 776 scenarios, 0047 free`. Update exactly
these claims, and nothing else in the documents:

- `AGENTS.md:154` — `**22 files**` → `**23 files**`; `through 0046-feedback-triage.sql` →
  `through 0048-setlist-collaborator-read.sql`; and the sentence naming the newest file.
- `AGENTS.md:187` — `**44 files on main**` → `**45 files on main**`; `numbered 0001–0046` →
  `numbered 0001–0048`; state that `0047` is free on `main` and claimed by #451.
- `AGENTS.md:196` — next free stays `0047` (the gate measures the tree; `0047` is still absent).
- `docs/master-plan.md:119` and `:121` — the same two numbers and ranges.

If `0047` appears during the work (because #451 merged), re-run the gate and let it dictate the
numbers instead of guessing.

## Tasks

| ID | Spec | Route | Status |
|---|---|---|---|
| T1 | S6 | delegated (writer) | done — 4 PASS / 4 FAIL before the migration, verbatim in the writer's report |
| T2 | S2–S5 | delegated (writer) | done — `0048` applied, 8 PASS / 0 FAIL |
| T3 | S7 | delegated (writer) | done — gate green at 45/23/0047 |
| T4 | S1–S7 | delegated (verifier) | **BLOCKED** — four blockers, see `L10` |
| T5 | S2–S6 | inline (parent) | done — correction batch; the recheck it asked for returned BLOCKED, see `L10` and `L12` |
| T6 | S1–S7 | delegated (verifier) | **BLOCKED** — B1–B4, A1 and A2 confirmed met; new blocker B5, see `L12` |
| T7 | S2–S6 | inline (parent) | done — B5 correction: the vouch mirrors the LIVE system scope, re-measured matrix and differential |
| T8 | S1–S7 | delegated (verifier) | **BLOCKED** — B5 and A4 confirmed met; new blocker B6 (spec text) and four advisories, see `L13` |
| T9 | S2–S6 | inline (parent) | done — correction batch: B6 fixed, the `chart_files` qualifiers added, the owner condition pinned |
| T10 | S1–S7 | delegated (verifier) | **BLOCKED** — B6 and the four advisories confirmed met; B7 and B8 in the batch's own text, see `L14` |
| T11 | S1–S6 | inline (parent) | done — correction batch 2: B7 re-attributed, B8 re-worded, A1 completed against the live policies |
| T12 | S1–S7 | delegated (verifier) | done — PASS on B7, B8 and A1, all sanity checks green, see `L15` |
| T13 | — | inline (parent) | pending — commit, push, PR |

## Log

**L1** — user, verbatim: "si,       delegalo por fases y especificaciones"

**L2** — user, verbatim, the authorization this unit executes: "explicame como lo haras, con la amplia"
and, before it, "que podemos hacer al respecto?"

**L3** — Measured RED on a fresh reset (2026-11-11), as `isolation`: 6 songs, none of them Way Maker
or Oceans; 1 setlist; 2 items with `agreed_key` G and C; 0 `chart_files`; 0 `song_versions`.

**L4** — Design correction found while writing this document, before any source write: the first
draft of the helper carried `s.owner_id = $1`. `setlist_items_insert_member` lets an owner insert an
arbitrary `song_id`, so that branch would have turned every authenticated user into someone who can
read any song whose UUID they know. The helper was made collaborator-only and dropped the `setlists`
join entirely. **This correction was necessary but not sufficient, and `L10` says so: removing the
owner branch did not stop the escalation, because `setlist_collaborators_insert_owner` lets an owner
invite themselves with `accepted_at` set.** The claim that collaborator-only closed the hole was
wrong.

**L5** — Residual, as first written: a collaborator with `can_edit` could insert a song UUID into a
setlist they can edit and then read it, provided they already knew the UUID. **In the corrected design
this is closed** — the setlist's owner must be able to read the song, and the owner cannot read a song
from another org — but it was open in the design that was shipped for verification. What remains open
at the source is pre-existing and out of scope here: `setlist_collaborators_insert_owner` lets an
owner invite themselves, and `setlists_update_member` lets a `can_edit` collaborator reassign
`owner_id`. Both are absorbed by the rule in `S2`; neither is fixed there. Fixing them means changing
existing policies, which is its own unit with its own risk.

**L6** — Writer, on returning T1–T3: the smoke carries 8 notices, not the 7 S6 stated, because it
added the fixture-tidy check and `0046` counts its tidy check too. Accepted, and S6 now says ten after
L7. It also had to move one range S7 did not list, `What has a smoke: … 0041–0046` → `0041–0048`,
because leaving it would have created exactly the prose drift the count gate exists to prevent. It
verified `0047_public_table_privileges.sql` is present on three unmerged remote branches before
writing that `0047` is free only because #451 has not merged. That is evidence, not an assumption.

**L7** — Parent review of the writer's smoke found a real hole in the negative controls, before any
verification ran. Song B (same org, no setlist) catches a helper missing `where i.song_id = $2`; it
does **not** catch a helper missing `c.user_id = $1`, because Song B has no setlist and Song A belongs
to the caller. A second setlist (demo-owned, containing Song C, with outsider as its accepted
collaborator and isolation as nothing) closes it, and doubles as a positive proof that the gate is the
per-setlist invite: outsider reads Song C while belonging to no org at all, and reads nothing in the
Demo Setlist where its invite is pending. S6 rewritten to ten assertions.

**The table this entry used to carry was wrong, and the correction matters more than the table.** It
was built by mutating the helper and reading what each user could *see* — not by running the smoke
against each mutant — and its last column ("caught by assertion N") was an inference, not a
measurement. The independent verifier re-measured it by running the smoke, and the inference was off:
dropping `c.user_id = $1` fails **two** assertions, not one. A mutation table has to be produced by
running the suite against the mutant; anything else is a guess wearing a table's clothes. The
corrected, measured table is in `L11`.

**L8** — `size:exception`, and the reasoning, because a label like that should never be unexplained.
`git diff --numstat origin/main...HEAD` measures **1 545** authored lines against the ~400 budget: the
migration is 190, the smoke 538, this record 687, the two capability specs 105, and the count-gate
updates 25. The repo's own
`chained-pr` skill allows one honest slicing pass before recommending an exception, so here it is:

- **Slice by table — `songs` first, `song_versions` + `chart_files` in a follow-up.** Rejected: that is
  the metadata-only variant this unit argued against. It leaves the page showing titles while the
  export stays empty, which is the half-state the user explicitly chose *against* when they picked the
  broad variant, and it splits the security proof in two — the first PR's smoke cannot pin the second
  PR's policies. The skill asks for one deliverable work unit per PR; a half-feature is not one.
- **Slice the smoke from the migration.** Rejected: the skill says to keep tests with the unit they
  verify, and a security policy shipped without the assertions that pin it is two reviews of the same
  risk, with the second PR having no reason to exist on its own.
- **Slice this record into a docs-only PR.** Rejected: the repo's convention is that a change that
  ships writes to both — an OpenSpec spec for the capability and an `odd/tasks/` record for the unit —
  and this record is the specification the writer and the verifier read by reference. A PR that changes
  an authorization policy without its specification is not auditable. The convention is honoured
  inside this PR: `openspec/specs/row-level-security/spec.md` and
  `openspec/specs/shared-setlist-collaboration/spec.md` carry the requirement and its scenarios, and
  this record carries the execution. Splitting them would ship a policy whose capability spec
  arrives later, or a capability spec with no proof behind it.
- **Trim the artifact to fit.** The skill forbids it: "the budget constrains how work is sliced, never
  the code itself". The duplication between this record's SQL blocks and the migration is real, but
  deleting it to chase a number this change cannot reach anyway would be cosmetic surgery dressed as
  discipline.

No cohesive split brings every slice within budget, which is the skill's own decision gate for
recommending `size:exception`. The number the reviewer has to read is 190 lines of SQL; the rest is
the proof of it and the record of how the proof was forced to change. The label is the maintainer's to
remove, and removing it means slicing, not shipping.

**L9** — Verification evidence, all measured by the parent, not taken from a report: smoke 15 PASS /
0 FAIL on a fresh reset; `check-doc-counts.sh` → `45 migrations, 23 smokes, 48 features, 776 scenarios,
0047 free`; `check-migrations-unique.sh` → `45 migrations, all versions unique`;
`check-migrations-destructive.mjs` → `45 files scanned, 0 destructive`. The mutation table in `L7`
is the parent's own run against the live database.

**L10** — The independent verifier returned **BLOCKED**, and its central finding was that `S2`/`L4`
were wrong. The escalation was not the owner branch this record had removed; it was the same door
wearing a different hat. `setlist_collaborators_insert_owner` (`0002_rls_core.sql:247-253`) checks only
that the caller owns the setlist, so the owner can insert a collaborator row for **themselves** with
`accepted_at` set. The attack, entirely inside the pre-existing policies: create a setlist, insert a
foreign song's UUID as an item, accept your own invitation, read the song. Measured by the verifier:
**0 rows at baseline, 1 row after `0048`**. A collaborator-only helper does not stop that, because the
caller is a genuine accepted collaborator of a setlist they genuinely own.

Four blockers, all accepted:

- **B1** the self-invite escalation above.
- **B2** the smoke could not detect the forbidden owner branch: adding it back passed 10/10, because
  no fixture had the caller owning a setlist holding a foreign song.
- **B3** the anti-oracle assertion was tautological: it asked about the setlist's *owner*, who has no
  collaborator row, so the answer was false for an unrelated reason. Measured with the tenancy guard
  removed, the helper answered `true` about a foreign accepted collaborator — the guard was load-bearing
  and untested.
- **B4** this record's `L7` mutation table did not match the verifier's measurement.

Advisories accepted: **A1** the new helper kept PUBLIC's EXECUTE, because
`alter default privileges in schema private` leaves no `pg_default_acl` row and therefore does not
cover functions created later — the repo convention of an explicit `revoke` is not optional here;
**A2** `AGENTS.md` claimed a smoke for `0047`, which does not exist because #451 has not merged;
**A4** this record's line citations were stale. **A3** (`45 files on main` while `main` still has 44)
is the repo's as-if-merged convention and was left as it is.

**L11** — The correction, and what it cost this record's credibility. The rule changed from "the
caller is an accepted collaborator" to "the caller is an accepted collaborator **and the setlist's
owner could already read the song**". The alternative rules were considered and rejected against the
policies rather than against intuition: matching the song's org to the setlist's org is forgeable,
because `setlists_insert_owner` does not constrain `org_id`/`branch_id` at all; excluding the owner is
not sufficient on its own, because the self-invite manufactures that exclusion; and the owner's vouch
is the condition that survives every forgery, because an attacker can only vouch with a read scope
they really have.

RED, first and against the vulnerable helper: **11 PASS / 2 FAIL** — the self-invite probe and the
editor-forgery probe, which are the two attacks the new rule closes. Then, with the corrected
migration applied: **13 PASS / 0 FAIL**. Then the mutation matrix, this time **measured by re-running
the suite against each mutant** — the method `L7` should have used from the start:

> The table below was measured against the **13-assertion** suite of that round. `L12` adds the
> personal-song assertion and carries the table re-measured for the shipped 15-assertion suite.

| helper mutation | suite result | assertions that fail |
|---|---|---|
| as shipped | 13 PASS / 0 FAIL | — |
| `where i.song_id = $2` removed | 9 PASS / 4 FAIL | 4, 5, 6, 10 |
| `c.user_id = $1` removed | 11 PASS / 2 FAIL | 5, 6 |
| `c.accepted_at is not null` removed | 12 PASS / 1 FAIL | 6 |
| `$1 = (select auth.uid())` removed | 12 PASS / 1 FAIL | 8 |
| owner-vouches removed | 12 PASS / 1 FAIL | 11 |
| guard + owner condition + vouch removed | 10 PASS / 3 FAIL | 8, 10, 11 |
| **`s.owner_id <> $1` removed** | **13 PASS / 0 FAIL** | **none** |

The last row is the honest one. `s.owner_id <> $1` is **defence in depth, not load-bearing**: the
owner-vouches condition blocks the self-invite on its own, and because the vouch mirrors the
pre-existing scopes exactly, a caller who owns the setlist could already read the song by other
means, so excluding the owner grants nothing and loses nothing. It is kept because it makes the
helper's contract explicit, and `S2` now says exactly that instead of claiming it closes the hole. A
condition that no assertion pins is not automatically a defect — but **describing it as the thing that
closes the hole would have been a lie**, and that is what `L4` and `L7` did.

`L13` corrects two sentences in this paragraph, both of which were false when written: the vouch did
NOT mirror the pre-existing scopes at this point (it carried the pre-0020 system form — that is
`L12`'s B5), and the claim that nothing pins the condition was true only because no assertion
tried.

**L12** — The second recheck returned **BLOCKED** again, and this time it found a defect in the
correction itself. Not the rule — the rule is right — but **the vouch's transcription of it**.

**B5, what it was.** `private.setlist_owner_can_read_song` was written with the system scope as
`s.org_id is null`. That is the form `0016_org_repertoire_model.sql:123-125` shipped. But the LIVE
policy is not that form: `0020_review_batch1.sql:30-32` tightened it to
`org_id is null and source_org_id is not null`, and `0040_fix_migration_chain_rls.sql:60-66`
re-issued the tightened one. The loose form is the **C1 leak** — it counted every personal song of
every user as system content. Copying it into the vouch put the leak back inside the sharing path:
the vouch answered "the setlist's owner can read this song" for a stranger's personal song, so the
owner "vouched" for it and an editor could read it through the setlist.

The verifier's minimal reproduction, measured: a personal song of another user (`org_id IS NULL`,
`source_org_id IS NULL`) inside a demo-owned setlist where `isolation` holds `can_edit` →
**0 rows at baseline, 1 row after `0048`**, while the setlist's owner read 0. A `can_edit`
collaborator could read a private song the owner could not read.

**The fix is one line** — the vouch's system scope now mirrors the live policy:

```sql
-        or s.org_id is null
+        or (s.org_id is null and s.source_org_id is not null)
```

**And the smoke had to grow a fixture that the seed cannot provide.** The seed's personal songs
(`…0004`–`…0008`) all belong to `demo` *and* are in `public_songs`, so every scope that could expose
them already covers them — the seed cannot express the bug. Song E is the fixture that can:
**outsider's own personal song**, `org_id IS NULL`, `source_org_id IS NULL`, absent from
`public_songs`. With it in the population, `isolation` inserts its UUID into the setlist she can edit,
and the suite asserts she reads **0** rows of it, of its chart and of its version (assertion 12), while
the setlist's owner reads 0 too (assertion 13).

RED, first and against the vulnerable helper: **14 PASS / 1 FAIL**, the failure being exactly
assertion 12. Then, with the corrected migration applied: **15 PASS / 0 FAIL** on a fresh reset.

**The differential check, which is the one that generalises.** A single fixture proves a single case;
what matters is whether the vouch can EVER exceed the live scopes. So: for each seed user, compare
the vouch's answer for every song against what the live policies actually let that user see (the
live set captured under `role authenticated`, the vouch evaluated as the definer). Two directions:
*too wide* — the vouch permits a song the live scopes deny; *too narrow* — the live scopes permit a
song the vouch denies.

| population | user | too wide | too narrow |
|---|---|---|---|
| seed only | demo | 0 | 0 |
| seed only | isolation | 0 | 2 |
| seed only | outsider | 0 | 0 |
| seed + Song E, **vouch in the pre-0020 form** | demo | **1** | 0 |
| seed + Song E, **vouch in the pre-0020 form** | isolation | **1** | 2 |
| seed + Song E, **vouch in the pre-0020 form** | outsider | 0 | 0 |
| seed + Song E, **corrected vouch** | demo | 0 | 0 |
| seed + Song E, **corrected vouch** | isolation | 0 | 2 |
| seed + Song E, **corrected vouch** | outsider | 0 | 0 |

The one song the broken vouch over-grants is, measured and listed, exactly Song E — `org_id NULL`,
`source_org_id NULL`, created by `outsider`. The surviving "too narrow" pair for `isolation` is the
two songs `0048` exists to share (Way Maker and Oceans), visible to her through the setlist and not
through her own scopes. The seed-only rows are also worth reading: they show the check is **blind**
without a personal song of a third party in the population, which is why the fixture is part of the
suite and not an afterthought of this entry.

**The matrix, re-measured for the shipped 15-assertion suite.** Every mutant applied, its body read
back with `pg_get_functiondef` to prove it landed, then the suite re-run on a fresh reset:

| helper mutation | suite result | assertions that fail |
|---|---|---|
| as shipped | 15 PASS / 0 FAIL | — |
| `where i.song_id = $2` removed | 11 PASS / 4 FAIL | 4, 5, 6, 10 |
| `c.user_id = $1` removed | 13 PASS / 2 FAIL | 5, 6 |
| `c.accepted_at is not null` removed | 14 PASS / 1 FAIL | 6 |
| `$1 = (select auth.uid())` (tenancy guard) removed | 14 PASS / 1 FAIL | 8 |
| owner-vouch removed | 13 PASS / 2 FAIL | 11, 12 |
| tenancy guard + `s.owner_id <> $1` + vouch removed | 11 PASS / 4 FAIL | 8, 10, 11, 12 |
| **`s.owner_id <> $1` removed alone** | **15 PASS / 0 FAIL** | **none** |
| `s.owner_id is not null` removed alone | 15 PASS / 0 FAIL | none |
| **vouch's system scope reverted to `s.org_id is null`** | **14 PASS / 1 FAIL** | **12** |

**Two rows of that table are historical.** The owner-condition pin of `L13` moved them: with the
pin, removing `s.owner_id <> $1` alone fails assertion 9, and so does the
three-conditions-removed row. `L13` carries the current measurement; this table is what the
pre-pin suite actually did.

**The claim about `s.owner_id <> $1` is re-worded, because the sentence that supported it was
false until this fix.** `L11` said the condition is "not load-bearing" because "the vouch mirrors the
pre-existing scopes exactly" — and at that time it did NOT: it was the loose `org_id is null` form,
one scope wider than the live policies. It mirrors them only now, and the measurement is unchanged
(15 PASS / 0 FAIL with it removed) for a different reason: with the vouch faithful, a caller who owns
the setlist could already read the song through their own scopes, so excluding the owner grants
nothing and loses nothing. **No assertion pins that condition**, and this record says so rather than
implying coverage it does not have. It is kept because it makes the helper's contract explicit —
reading what you shared is the owner's pre-existing business, not this policy's — and because it
keeps the sharing path for collaborators only, which is what the contract says.

`L13` is where the third recheck corrected this paragraph twice more: the "grants nothing and loses
nothing" sentence is true for **songs** but not for **`chart_files` rows**, and "no assertion pins
that condition" stopped being true.

**A4, the stale citations.** Fixed in this entry's own references, and the numbers were checked
against the files rather than assumed: `AGENTS.md:187` is the `45 files on main` line and
`AGENTS.md:196` is `The next free number is 0047` (the record cited 186 and 195);
`0002_rls_core.sql:197-224` is `setlists_update_member` (it cited 197-226, which ran one line into
the next policy); `0001_init.sql:91` is `chart_files.song_id` (it cited 89-90, which is the table
header).

---

**L13** — The third recheck returned **BLOCKED** a third time, and this time the implementation was
clean. B5 was confirmed met on every check: the verifier reproduced its own scenario (personal song
of a third party inside a demo-owned setlist → isolation reads 0/0/0, the owner reads 0, the
baseline still 0), measured the new RED assertion (pre-0020 vouch → 14 PASS / 1 FAIL, failing
assertion 12, mutation verified in `pg_get_functiondef`), checked the vouch against all five live
scopes branch by branch, re-ran the population differential in both directions for all three seed
users, and re-measured the whole mutation matrix — **every row matched what `L12` claimed**.

What the recheck found was **B6, and it was a documentation defect**: the capability spec stated
more than the migration delivers.

**B6, the two sentences.** In `openspec/specs/row-level-security/spec.md`:

1. "The read MUST extend to `song_versions` and `chart_files`, so the collaborator sees the chart
   payload and not only the metadata." True for inline ChordPro; **false for PDF and MusicXML**,
   whose payload is an object in the private `charts` bucket and stays unreachable. Measured by the
   verifier: the `chart_files` row is visible (count = 1), the storage object is not (count = 0).
   The sibling Requirement in `shared-setlist-collaboration` already said so — the two Requirements
   contradicted each other, which is exactly how a spec stops being a contract.
2. "a caller MUST NOT gain a song they could not read themselves." Read literally, that forbids the
   feature's own purpose: the caller **does** gain songs she could not previously read — isolation
   gains Way Maker and Oceans, which is the gap `S1` measures. The intended subject is the
   **owner**.

**The fix** is those two sentences in place: the chart clause now says the collaborator sees the
inline ChordPro content and states the PDF/MusicXML residual, and the second now reads "a caller
MUST NOT gain a song the setlist's owner could not read."

**The four advisories, and what each one changed.**

- **The owner-condition wording.** "Removing it changes nothing / grants nothing and loses nothing"
  holds for **songs**, not for `chart_files` rows: with the condition removed, the owner's chart read
  goes from 0 rows to 1, because `chart_files_select_owner` keys on `songs.created_by` and the
  setlist's owner can be narrower than the collaborator for a song somebody else created. The
  qualifier is now in `S2`, in the migration's comment, and in this log — and it is stated where it
  was false before (`L11`, `L12`), not only where it is true now.
- **The `chart_files` asymmetry** is change-created and benign: it is the feature's purpose (the
  collaborator needs the chart), but the owner's narrower access was undocumented. It is now stated
  in both capability specs and in `S2`.
- **"Exactly the owner's own read scope"** in the collaboration spec is exact for **songs** and not
  for rows. The Requirement now says "the setlist owner's own read scope applied to those
  **songs**" and carries the row asymmetry as its own paragraph.
- **"INSERT, UPDATE and DELETE remain governed by `can_edit`"** was loose in the same spec: the
  write policies on `songs`, `song_versions` and `chart_files` are **creator-keyed**
  (`created_by`), and `can_edit` governs `setlists` and `setlist_items`. The Requirement now says
  that, and so does the migration's scope bullet.

**The pin.** The verifier's recommendation was to stop leaving `s.owner_id <> $1` unpinned. The
record had been honest about it — "no assertion pins this condition" — but an unpinned condition is
one mutation away from being deleted without anyone noticing, and this one had already been
described wrongly twice. So the smoke now pins it: **demo admits themselves** as an accepted
collaborator of the seed's Demo Setlist. The insert is admitted by the pre-existing
`setlist_collaborators_insert_owner` (whose WITH CHECK is only `session_owns_setlist(setlist_id)`,
with no constraint on `user_id`) — the same hole the self-invite probe uses, exercised for real
rather than forced by postgres.

With that row in place, every other condition of the helper holds for demo's own call: the song is
in the setlist, the caller is an accepted collaborator, the invitation is accepted, `owner_id` is
not null, the tenancy guard matches (the call is made **by** demo), and the vouch holds (demo can
read Song A — it is demo's own org). The only thing left denying the call is `s.owner_id <> $1`.
Remove it and assertion 9 fails. The condition is still **not** what closes the attack — the
owner-vouches condition is, and the self-invite probe proves that by failing on its own when the
vouch is removed. The pin says what the condition is for: it makes the helper's contract explicit.

**The storage probe, evaluated and declined.** The verifier suggested a second probe: a collaborator
reads one `chart_files` row but **0** `storage.objects` rows for `bucket_id = 'charts'`, pinning the
PDF/MusicXML residual. It was evaluated and **not** committed. First, the cleanup needs an escape
hatch: a plain `DELETE` on `storage.objects` is refused by `storage.protect_delete` ("use the
Storage API instead"), and that trigger only checks a GUC — `storage.allow_delete_query = 'true'`
makes the delete work (measured, see `L14`), so the smoke *could* clean up after itself, but only
by opting into an escape hatch a future reader would have to know about. Second, and decisively,
pinning a **limitation** is the wrong kind of test: the day somebody deliberately fixes cross-org
PDF access, the suite would fail with a message that reads like a security regression. The residual
is therefore stated in both capability specs, carried in `S1`, and backed here by the verifier's
measured 1-row / 0-object pair.

**The matrix, re-measured for the pinned suite.** Every mutant applied, its body read back with
`pg_get_functiondef` to prove it landed, then the suite re-run on a fresh reset:

| helper mutation | suite result | assertions that fail |
|---|---|---|
| as shipped | 15 PASS / 0 FAIL | — |
| `where i.song_id = $2` removed | 11 PASS / 4 FAIL | 4, 5, 6, 10 |
| `c.user_id = $1` removed | 13 PASS / 2 FAIL | 5, 6 |
| `c.accepted_at is not null` removed | 14 PASS / 1 FAIL | 6 |
| `$1 = (select auth.uid())` (tenancy guard) removed | 14 PASS / 1 FAIL | 8 |
| owner-vouch removed | 13 PASS / 2 FAIL | 11, 12 |
| tenancy guard + `s.owner_id <> $1` + vouch removed | 10 PASS / 5 FAIL | 8, 9, 10, 11, 12 |
| **`s.owner_id <> $1` removed alone** | **14 PASS / 1 FAIL** | **9** |
| `s.owner_id is not null` removed alone | 15 PASS / 0 FAIL | none |
| **vouch's system scope reverted to `s.org_id is null`** | **14 PASS / 1 FAIL** | **12** |

Two rows moved against `L12`'s table, and both moved **because** of the pin: `s.owner_id <> $1`
alone now fails assertion 9 (it failed nothing before), and the three-conditions-removed row now
also fails it. `L12`'s table is the historical measurement of the pre-pin suite; this one is
current.

**What the pin cost.** The suite still carries fifteen notices — no new assertion, a stronger
fixture — and the seed survives the cleanup: the owner-self-invite row is removed **by user_id**,
because isolation's and outsider's rows on the Demo Setlist belong to the seed, not to this file.
Verified after a full run: exactly those two seed rows remain, demo's is gone.

**Verification of this correction batch**, all measured by the parent on a fresh reset: smoke
**15 PASS / 0 FAIL**; `check-doc-counts.sh` → `45 migrations, 23 smokes, 48 features, 776 scenarios,
0047 free`; `check-migrations-unique.sh` → `45 migrations, all versions unique`;
`check-migrations-destructive.mjs` → `45 files scanned, 0 destructive`; the mutation matrix above.

---

**L14** — The fourth recheck returned **BLOCKED** again, and this time it was aimed at the
correction batch itself. Everything mechanical came back clean: **all ten rows** of `L13`'s matrix
reproduced exactly, the owner-condition pin fails exactly assertion 9, the suite still carries 15
notices, the seed survives the cleanup (demo's row gone, isolation's and outsider's intact), and
the insert is genuinely admitted by the pre-existing policy — as `authenticated` with demo's JWT it
returns `INSERT 0 1`, and on a setlist demo does not own it raises "new row violates row-level
security policy". What it found were **two sentences I wrote in that batch** and one advisory: all
documentation, no security defect open.

**B7 — the `chart_files` asymmetry was mis-attributed.** Both capability specs said the asymmetry
"is not introduced here" and "belongs to the creator-keyed policies, not to setlist sharing". The
verifier measured it on both trees and the measurement is unambiguous: at baseline (44 migrations)
neither the owner nor a collaborator could reach the chart row — there was no asymmetry to
attribute, because `chart_files_select_via_setlist` did not exist; with 0048 the collaborator reads
1 row and the owner 0. **The asymmetry is created by this change**, which is what this record's own
`L13` said two paragraphs earlier. The specs now say exactly that: the narrowness comes from the
creator-keyed policy, the asymmetry itself is created here, and it is the feature's purpose. A spec
can under-claim as wrongly as it can over-claim, and mis-attributing a change-caused effect leaves
the spec contradicting its own record.

**B8 — the storage-probe justification was false as written.** `L13` said the fixture "cannot be
removed" because `storage.protect_delete` refuses direct deletes. The refusal is real — measured
here as postgres and as `service_role`, a plain `DELETE` raises "Direct deletion from storage
tables is not allowed" — but the trigger only checks a GUC, and `select
set_config('storage.allow_delete_query','true',false)` makes the delete work. The fixture **can**
be cleaned up. `L13`'s sentence is corrected in place, and the decline now rests on what it should
have rested on: the cleanup would need that escape hatch, and — decisively — pinning a limitation
is the wrong kind of test. The residual stays in the capability specs and in this record.

**A1 — the write claim was incomplete.** "creator-keyed" is right for `songs`, `song_versions` and
`chart_files`, but `songs` has a **second** UPDATE scope, `songs_update_source_org`
(`source_org_id IS NOT NULL` plus an active membership with role `instructor`, `branch_admin`,
`org_admin` or `org_owner`), and "owner-or-`can_edit`" over-generalised `setlists`. The live
policies, read from `pg_policies` rather than recalled, are now what both the Requirement and the
migration's scope bullet say:

| table | INSERT | UPDATE | DELETE |
|---|---|---|---|
| `songs` | `created_by` + org/branch scoping | `created_by`, **plus** `songs_update_source_org` | `created_by` |
| `song_versions` | `owner_id` + the song's creator | same | same |
| `chart_files` | the song's creator | same | same |
| `setlists` | owner only | owner, or an accepted collaborator to read and `can_edit` to write | owner only |
| `setlist_items` | owner or `can_edit` | same, with the read scope wider than the write scope | owner or `can_edit` |

**The correction bound.** This was the second correction batch, and it was allowed because the
previous recheck did not clear the item it had raised: the `chart_files` asymmetry advisory came
back **partially met**. One more bounded recheck follows, limited to B7, B8 and A1. After that, a
new finding does not earn another correction — it becomes a decision for the maintainer rather than
another round.

**L15 — the final bounded recheck cleared.** T12 returned PASS on all three items, on evidence
rather than on assertion:

- **B7** — both specs, the migration comment and `L13`/`L14` now state the `chart_files` asymmetry
  as created here, with the measured baseline (collaborator 0 / owner 0) and the same causal
  mechanism: `chart_files_select_owner` keys on `songs.created_by`
  (`0003_chart_content_rls.sql:16-26`), re-measured in a rolled-back transaction — at baseline the
  chart row was unreachable for both, with 0048 the collaborator reads 1 and the owner 0 while the
  owner still reads the song through org scope.
- **B8** — the storage refusal reproduced exactly as postgres **and** as `service_role`, and
  `set_config('storage.allow_delete_query','true',false)` turned both into `DELETE 1`, so cleanup is
  possible and the decline rests on the right grounds. The residual stays named in both specs, the
  smoke header and this record.
- **A1** — the `L14` table checked clause by clause against the live `pg_policies` (28 public rows
  across the five tables), `qual` and `with_check` included, and 0048 confirmed to add only the
  three `for select` policies.

Sanity, all re-measured here rather than carried over: fresh reset → **15 PASS / 0 FAIL**; the seed
intact afterwards (`isolation` accepted, `outsider` pending, demo's self-invite row gone); the two
matrix rows re-landed and re-run on their own resets — `s.owner_id <> $1` alone → **14 / 1** failing
assertion 9, `s.owner_id is not null` alone → **15 / 0**; `check-doc-counts.sh`,
`check-migrations-unique.sh` and `check-migrations-destructive.mjs` all exit 0 at 45/23/0047.

One advisory inside B7's prose was true and is now fixed: the specs generalised the creator-keying
to `song_versions`, whose `SELECT` also admits the version's own `owner_id`. The `chart_files`
conclusion is untouched; the sentence now says what `pg_policies` says. That is a wording
correction to a paragraph already under review, not a new finding, so it does not reopen the
correction bound `L14` set.
