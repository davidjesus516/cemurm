# Row-Level Security Specification

## Purpose

Owner-scoped row-level security over the 48-table schema from `supabase/migrations/0001_init.sql`, with hardened lookup helpers and a demo seed. PR #1 (S2) covers helpers, RLS on all tables, owner-scoped policies, and `seed.sql`. The full org/branch/system/event matrix (S3) and offline sync (S5–S7) are future changes, outside this contract.

## Requirements

### Requirement: Hardened lookup helpers

The `private` schema MUST provide `is_org_member(user_id, org_id)`, `user_branch_ids(user_id)`, and `session_role_in(user_id, org_id, roles[])`. All three MUST be `SECURITY DEFINER` with `search_path` set to `''`, execution revoked from `public` and `anon`, and granted only to `authenticated` and `service_role`. Enmienda D7 (aprobada): a 4th session-bound SECURITY DEFINER helper `session_owns_setlist(setlist_id)` may exist for RLS-recursion breaking, under the same hardening contract.

#### Scenario: Membership lookup

- GIVEN a seeded `org_memberships` row for the demo user
- WHEN `private.is_org_member(demo_user_id, demo_org_id)` is called as authenticated
- THEN it returns the membership role
- AND a non-member user evaluates `false`

#### Scenario: No execution for revoked roles

- GIVEN the migration's revoke/grant statements
- WHEN an `anon` session calls `private.is_org_member`
- THEN execution is denied

### Requirement: RLS enabled on all 48 tables

Every table created in `0001_init.sql` MUST have row-level security enabled, and client-role grants MUST NOT precede policy creation.

#### Scenario: No table left open

- GIVEN the migrated database
- WHEN querying `pg_tables` for the 48 public tables
- THEN `relrowsecurity` is `true` for all of them
- AND `supabase db reset` completes without error

### Requirement: Owner-scoped policies

Policies MUST enforce: `songs` by `created_by = auth.uid()`; `setlists` by owner or accepted collaborators (`setlist_collaborators`, writes gated by `can_edit`); `setlist_items` inheriting the setlist scope; `practice_sessions`, `personal_annotations`, `notifications` (read + mark-read only), and `device_configs` by `user_id = auth.uid()`; `outbox` self insert/select; `scale_catalog` read for authenticated users. Gig tables MUST be owner-scoped too: `gigs` by `owner_id = auth.uid()`, `venues` by `owner_id = auth.uid()`, `performances` scoped through their gig's owner, and `performance_items` inheriting their performance's (gig-owner) scope. (Previously: owner scope covered songs/setlists/items/practice/annotations/notifications/device_configs/outbox/scale_catalog only; `gigs`, `venues`, `performances`, `performance_items` were revoked with zero policies.)

#### Scenario: Demo user reads own song

- GIVEN a seeded song with `created_by = demo_user_id`
- WHEN the demo user reads `songs`
- THEN exactly that row is returned

#### Scenario: Other user sees zero rows

- GIVEN a second seeded authenticated user with no ownership
- WHEN they query the same `songs` table
- THEN zero rows are returned

#### Scenario: Anonymous sees zero rows

- GIVEN an `anon` session
- WHEN querying an owner-scoped table (`songs`, `setlists`, `notifications`)
- THEN zero rows are returned

#### Scenario: Setlist collaborator access

- GIVEN an accepted collaborator on a seeded setlist
- WHEN they read or edit per `can_edit`
- THEN owner-granted rows are visible
- AND view-only collaborators cannot update `setlists`

#### Scenario: Outbox self service

- GIVEN an authenticated session
- WHEN the user inserts and selects their own `outbox` row
- THEN insert succeeds and select returns only their rows

#### Scenario: Gig owner access on all four gig tables

- GIVEN a seeded gig, venue, performance, and performance items owned by the demo user, plus a second user with no ownership
- WHEN both query `gigs`, `venues`, `performances`, and `performance_items`
- THEN the demo user sees only their rows and the second user sees zero rows on all four tables

#### Scenario: Performance items inherit their gig's owner scope

- GIVEN a non-owner session and a completed gig with `performance_items`
- WHEN the non-owner reads `performance_items`
- THEN zero rows are returned, and the owner reads all items of their own performance
### Requirement: Gap tables deny-by-default

`dmca_notices`, `invite_codes`, `tags`, `song_tags`, `song_duplicates`, `external_enrichments`, `event_rsvps`, and `event_participants` MUST have RLS enabled with no client policies and no `anon`/`authenticated` grants: service-role only. This confirmed decision is documented and revisited before S3.

#### Scenario: Client denied on gap tables

- GIVEN an authenticated session
- WHEN selecting from a gap table (e.g. `dmca_notices`)
- THEN zero rows are returned
- AND `service_role` retains full access

### Requirement: Demo seed data

`seed.sql` MUST create the demo org, a branch, `org_memberships`, auth users (demo + one isolation user), and owner rows so `supabase db reset` passes and every isolation scenario is runnable.

#### Scenario: Reset produces runnable dev state

- GIVEN the seed file
- WHEN `supabase db reset` runs
- THEN schema, RLS, and seed apply cleanly
- AND demo login plus owner-scoped reads work end to end
### Requirement: User preferences owner-scoped

The new `user_preferences` table MUST be created with owner RLS: exactly one row per user, with insert/select/update/delete scoped by `user_id = auth.uid()`. `device_configs` MUST remain unchanged and pedal-bound.

#### Scenario: One preferences row per user

- GIVEN an authenticated user with no `user_preferences` row
- WHEN the user reads `user_preferences`
- THEN zero rows are returned, and a first write creates a row with `user_id = auth.uid()`

#### Scenario: Self-only access to preferences

- GIVEN two users, each with a `user_preferences` row
- WHEN each queries the table
- THEN each sees only their own row, and updating the other user's row is denied

### Requirement: Profiles table with RLS

Migration 0006 MUST add `profiles` (id → auth.users CASCADE, display_name, username UNIQUE nullable, instrument, avatar_url) — a **documented deviation** adding a 49th DDL table beyond the 48-table contract (`auth.users` is not client-queryable, so bandmate search needs a public identity surface; Supabase-standard pattern). RLS MUST grant the owner self CRUD and MUST grant authenticated users search-SELECT over limited columns only. A trigger MUST auto-create the profile row on signup.

#### Scenario: Self-only CRUD on profiles

- GIVEN a user with an auto-created profile row
- WHEN the user reads or updates their profile
- THEN only their own row is visible and editable

#### Scenario: Authenticated search is column-limited

- GIVEN several users with profiles
- WHEN an authenticated user searches `profiles`
- THEN only limited columns (username, display_name, avatar_url) are exposed

### Requirement: Bandmate links pair-scoped RLS

`bandmate_links` MUST be readable and writable only by the two users of the pair (`user_id`/`bandmate_id`), replacing the 0002 deny-by-default revoke (previously: zero policies, service-role only).

#### Scenario: Bandmate pair reads their link

- GIVEN a `bandmate_links` row pairing user A and user B
- WHEN A or B queries `bandmate_links`
- THEN only rows involving them are returned, and inserts/updates affecting their own pair succeed

#### Scenario: Non-pair sees zero rows

- GIVEN user C is in neither side of the pair
- WHEN C queries `bandmate_links`
- THEN zero rows are returned

### Requirement: Shared comments arrangement-scoped RLS

`shared_comments` MUST scope select and insert through a JOIN-free, nested EXISTS chain — song → `setlist_items` → `setlists` → `setlist_collaborators` — where the setlist hop matches `owner_id = auth.uid()` OR an accepted `setlist_collaborators` row (0004 nested single-relation shape; no joins per the acyclic policy-graph constraint). The RLS skeleton MUST ship in 0006 even though notification triggers defer to change 2.

#### Scenario: Band member with access reads and comments

- GIVEN a song inside a setlist the user owns or is an accepted collaborator on
- WHEN the user selects or inserts a `shared_comments` row for that song
- THEN the row is returned / inserted successfully

#### Scenario: No-access insert is denied

- GIVEN the arrangement of "Song X" is not shared with the user
- WHEN the user inserts a `shared_comments` row for "Song X"
- THEN the insert fails with RLS denial (42501) and zero rows are readable

### Requirement: Setlist collaborator self-accept

Migration 0006 MUST add a `setlist_collaborators` UPDATE policy allowing an invitee to set `accepted_at` on their own row — fixing the 0002 gap where only owner-management UPDATE exists (invitee acceptance loop is broken today). Owner-management policies MUST remain unchanged.

#### Scenario: Invitee accepts their invitation

- GIVEN a pending `setlist_collaborators` row for the current user
- WHEN the user updates `accepted_at` on their own row
- THEN the update succeeds and the user gains collaborator visibility on the setlist

#### Scenario: View-only collaborator still cannot write setlists

- GIVEN the invitee accepted with `can_edit = false`
- WHEN they attempt to update the `setlists` row
- THEN the write is denied (existing owner/can_edit 0002 shape preserved)

### Requirement: Realtime publication RLS-safe

Migration 0006 MUST add `setlists`, `setlist_items`, and `setlist_collaborators` to the `supabase_realtime` publication, and MUST publish only RLS-enabled tables so `postgres_changes` honors RLS for each subscriber. Migration 0009 MUST also add `notifications` to the publication — realtime notification filtering targets the non-PK `user_id` column and relies on `replica identity full` (set by 0009) so `postgres_changes` honors RLS per subscriber.

#### Scenario: Subscribers receive only readable rows

- GIVEN two users, one with setlist access and one without
- WHEN a `setlists` row changes
- THEN the authorized user's `postgres_changes` subscription receives the change and the unauthorized user's does not

#### Scenario: Publication limited to RLS-enabled tables after 0009

- GIVEN the `supabase_realtime` publication after 0009
- WHEN listing published tables
- THEN `setlists`, `setlist_items`, `setlist_collaborators`, and `notifications` are published and no non-RLS table is

#### Scenario: Notification rows filter by non-PK user_id honoring RLS

- GIVEN the `notifications` table with `replica identity full` after 0009
- WHEN a `notifications` row changes
- THEN the recipient's `postgres_changes` subscription receives the change and another user's subscription does not (non-PK `user_id` filter honors RLS via replica identity full)
### Requirement: Notifications replica identity full

Migration 0009 MUST set `replica identity full` on `notifications` — required because realtime filtering targets the non-PK `user_id` column and the old value (no full identity) cannot honor RLS per subscriber for Postgres changes on a non-PK field (Realtime publication)

#### Scenario: Notifications replica identity full honors RLS per subscriber

- GIVEN `notifications` replica identity after 0009
- WHEN a `notifications` row changes for a recipient
- THEN the recipient's `postgres_changes` subscription receives it and a non-recipient's does not

### Requirement: Setlist collaborator reads the songs in the setlist

A song referenced by a setlist MUST be readable by an **accepted collaborator** of that setlist when
the setlist's **owner** could already read the song. The owner's read scope MUST be evaluated
against the same five scopes the owner's own session has — `songs_select_owner`, the LIVE
`songs_select_system` (`org_id IS NULL AND source_org_id IS NOT NULL`), `songs_select_org`,
`songs_select_branch` and `songs_select_public_library` — and MUST NOT be widened: a personal song
of another user (`org_id IS NULL AND source_org_id IS NULL`) MUST NOT count as system content, which
is the leak the C1 fix closed in migration 0020. The read MUST extend to `song_versions` and
`chart_files`, so the collaborator sees the inline ChordPro content (`chart_files.content`) and not
only the metadata. PDF and MusicXML charts are **out of scope**: the `charts` storage bucket is
private with owner-folder RLS and 1-hour signed URLs, so a cross-organization collaborator sees the
`chart_files` row and still cannot download the object. Only SELECT is added. The existing write
policies are unchanged: `songs` is keyed on `created_by`, plus the pre-existing
`songs_update_source_org` scope for the source org's admins; `song_versions` is keyed on its own
`owner_id` and the song's creator; `chart_files` is keyed on the song's creator; `setlists` INSERT
and DELETE are owner-only, and `can_edit` governs `setlists` UPDATE and the `setlist_items` writes.

The owner's scope governs the **song**. The pre-existing `chart_files` owner policies key on the
song's **creator**, not on the setlist's owner, so a collaborator can reach a chart row of a song
created by another org member that the setlist's owner cannot read through their own scopes. That
asymmetry is **created by the setlist path**: at baseline neither the owner nor a collaborator could
reach that chart row, because `chart_files_select_owner` keys on the song's creator. 0048 lets the
collaborator reach it through the setlist while the owner's own scope still does not. The narrowness
comes from the creator-keyed policy; the asymmetry itself is created here, and it is the feature's
purpose. `song_versions` carries the same asymmetry for a different reason: its `SELECT` admits the
version's own `owner_id` **or** the song's creator, so the collaborator also reaches version rows of
a song the owner reads only through org or branch scope.

Two conditions MUST NOT be satisfiable by the caller alone. `setlists_insert_owner` does not
constrain `org_id` or `branch_id`, and `setlist_collaborators_insert_owner` admits an owner
inserting a collaborator row for themselves with `accepted_at` set, so neither "the song's org
matches the setlist's org" nor "the caller is an accepted collaborator" MAY stand in for the owner's
vouch: a caller MUST NOT gain a song the setlist's owner could not read. Implemented in
`supabase/migrations/0048_setlist_collaborator_read.sql`; verified by
`scripts/smoke/0048-setlist-collaborator-read.sql` (15 PASS / 0 FAIL on a fresh reset); record:
`odd/tasks/acl-setlist-collaborator-read.md`.

#### Scenario: Accepted collaborator reads the songs in a shared setlist

- GIVEN Lucia is an accepted collaborator on a setlist owned by Julian, from another organization
- WHEN Lucia reads the songs referenced by that setlist
- THEN she sees each song's title, its `song_versions` row and its `chart_files` row
- AND the inline ChordPro content of that chart row
- AND a song Julian could not read himself is not among them

#### Scenario: A PDF chart object stays out of reach

- GIVEN a shared setlist whose chart is a PDF stored in the private `charts` bucket
- WHEN Lucia reads the setlist's songs
- THEN she sees the `chart_files` row
- AND she cannot read the storage object, because the bucket's owner-folder RLS is keyed on the
  object creator, not on setlist membership

#### Scenario: A pending collaborator gains nothing

- GIVEN Marco has a pending invitation to Julian's setlist
- WHEN Marco reads the songs referenced by that setlist
- THEN zero rows are returned

#### Scenario: The owner vouches, not the caller

- GIVEN Julian owns a setlist and Lucia is an accepted collaborator with edit rights
- WHEN Lucia inserts the UUID of a personal song belonging to a third party into that setlist
- THEN Lucia reads zero rows of that song
- AND Julian reads zero rows of it as well, so his vouch is unsatisfiable
- AND the self-invitation attack fails too: a collaborator who invites themselves on a setlist they
  created reads zero rows of a song they planted

