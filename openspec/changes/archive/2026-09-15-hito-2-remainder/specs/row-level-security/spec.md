# Delta for Row-Level Security

## ADDED Requirements

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

## MODIFIED Requirements

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