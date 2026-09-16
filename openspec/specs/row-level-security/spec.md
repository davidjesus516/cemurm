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

