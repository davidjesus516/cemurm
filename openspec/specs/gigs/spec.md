# Gigs Specification

## Purpose

Online gig planning and truthful performance history (issue #44): venue suggestion/reuse, one-setlist lifecycle (planned→confirmed→completed/cancelled), exactly one performance record per completed gig (played/skipped/off_setlist), played-tag display, offline gig ops. Coverage: `features/gigs-and-performance-history.feature` — every scenario except the NON-GOALS scenarios (calendar/recurring/attendees; multi-org gigs). The "Gig visibility follows the org and branch model" scenario was **deferred until the org model landed** (Hito 4) and is now implemented by `supabase/migrations/0041_gig_shared_read.sql`: a completed gig its owner shared is readable, read-only, by the active members of the gig's own branch (`branch_id = any(private.user_branch_ids(auth.uid()))`, mirroring `songs_select_branch`), with `branch_id IS NULL` failing closed to owner-only. The read extends to `performances` and `performance_items` through the same gig hop. Verified by `scripts/smoke/0041-gig-shared-read.sql` (23 PASS / 0 FAIL on a fresh reset); record: `odd/tasks/gig-shared-read-access.md`.

## Requirements

### Requirement: Gig creation

The system MUST create a gig with name, scheduled date/time, one venue (name, location, type), and exactly one linked setlist. The linked setlist MUST be swappable by editing before completion, and one setlist MAY serve multiple gigs without modifying any of them.

#### Scenario: Create a gig with venue details and a linked setlist

- GIVEN setlist "Friday Gig Set" ("Song A", "Song B", "Song C")
- WHEN I create "Friday Gig" Fri 9 PM, venue "Café La Luna" (Calle Luna 3, Madrid, bar), linked to that setlist
- THEN the gig shows name, date/time, venue location/type, and the linked setlist

#### Scenario: A gig references exactly one setlist at planning time

- GIVEN setlists "Friday Gig Set" and "Acoustic Set"
- WHEN I create "Friday Gig" linked to "Friday Gig Set"
- THEN no second setlist can be linked; I can swap it via edit before completion

#### Scenario: The same setlist can serve multiple gigs

- GIVEN "Sunday Worship Set" linked to "Church Sunday Service"
- WHEN I link it to "Youth Group Night" as well
- THEN both gigs reference it and editing one gig leaves the setlist and the other gig unchanged

### Requirement: Venue suggestion and reuse

The system SHOULD suggest prior venues (stored location, type) while typing a venue name, and selecting a suggestion MUST reuse the saved venue. A venue change MUST affect only the edited gig.

#### Scenario: Prior venues are offered as suggestions for reuse

- GIVEN prior venues "Café La Luna" and "Parque El Retiro" (type "outdoor")
- WHEN I type "Caf" in the venue field
- THEN the app suggests "Café La Luna" with its stored location/type, and selecting it reuses the saved details

#### Scenario: Edit a gig to change its venue

- GIVEN "Friday Gig" planned at "Café La Luna"
- WHEN I change the venue to "Centro Cultural Aurora"
- THEN the gig shows the new venue with its location/type, and the change applies only to this gig

### Requirement: Gig lifecycle

A planned gig MUST support confirm, edit (date/time/venue/setlist until completion), and cancel. Cancelling MUST NOT write a performance record or played tags; a cancelled gig MUST be reopenable to reschedule or complete.

#### Scenario: Confirm a planned gig

- GIVEN planned gig "Friday Gig"
- WHEN I confirm it
- THEN status becomes "confirmed" and date/time/venue/setlist remain editable until completion

#### Scenario: Edit a gig before completion, including its setlist

- GIVEN "Friday Gig" confirmed with "Friday Gig Set"
- WHEN I move it to Sat 8 PM, change the venue to "Centro Cultural Aurora", and link "Acoustic Set"
- THEN the gig shows the new values and "Friday Gig Set" is unchanged

#### Scenario: Cancel a gig before the show

- GIVEN confirmed gig "Friday Gig"
- WHEN I cancel it
- THEN status becomes "cancelled", no performance record or played tag is written, and I can re-open it later

### Requirement: Performance record on completion

Completing a gig MUST write exactly one `performances` row plus `performance_items` (state played|skipped|off_setlist). The StageMode post-show flow MUST write that same single entity — never a duplicate.

#### Scenario: Completing a gig writes one performance record

- GIVEN "Friday Gig" confirmed with "Friday Gig Set"
- WHEN the show ends and I mark the gig completed
- THEN status becomes "completed" and exactly one performance record holds the date, venue, and songs actually played

#### Scenario: Skipped songs are recorded separately

- GIVEN "Friday Gig" lists "Song A", "Song B", "Song C"
- WHEN I complete it having played only "Song A" and "Song B"
- THEN the record lists them as played and "Song C" as skipped

#### Scenario: Songs played outside the setlist are recorded separately

- GIVEN I played encore "Song D", not in "Friday Gig Set"
- WHEN I complete "Friday Gig"
- THEN "Song D" appears as played outside the setlist and the setlist is unchanged

#### Scenario: Post-show flow writes the gig's performance record

- GIVEN I performed "Friday Gig" with "Friday Gig Set"
- WHEN I mark the setlist as played from the StageMode post-show flow
- THEN the gig completes and its single performance record is saved — the same entity the gig owns

### Requirement: Played tags and demand counts

The system MUST show a "played at <gig>" tag for each gig a song was played at, feed the demand count to song analytics, and MUST NOT tag skipped songs.

#### Scenario: Played songs get "played at" tags and demand counts

- GIVEN "Amazing Grace" was actually played at "Church Sunday Service" and "Youth Group Night"
- WHEN I open it in my repertoire
- THEN it shows both "played at" tags and demand count 2, and no tag exists for any skipped song

### Requirement: Notifications data source

A gig record MUST expose its date, time, and venue location for reminders; notification delivery itself stays the notifications feature's contract.

#### Scenario: The gig record provides date, time, and location for reminders

- GIVEN gig "Friday Gig" at 9 PM Friday at "Café La Luna"
- WHEN the notifications feature reads the gig record
- THEN it has the date/time for the one-hour reminder and the venue location, and the gig stays the data source

### Requirement: Offline gig operations

The system MUST queue gig create/edit/complete offline with a "pending sync" flag and MUST sync the gig and its performance record on reconnect, clearing the flag.

#### Scenario: Create, edit, and complete a gig offline

- GIVEN I am offline at the venue
- WHEN I create "Friday Gig" (venue "Café La Luna", setlist "Friday Gig Set") and complete it after the show
- THEN the gig and its performance record are stored locally with "pending sync"
- WHEN I reconnect
- THEN both sync to the server and the flag clears

### Requirement: Gig visibility follows the org and branch model

A gig MUST be private to its owner until the owner shares it. A **completed** shared gig MUST then be
readable — read-only — by the **active members of the gig's own branch**, and never by a member of a
sibling branch of the same organization. The read MUST extend to the gig's performance record
(`performances`, and `performance_items` through it). A shared gig with `branch_id IS NULL` MUST stay
owner-only: the requirement fails closed rather than widening to the whole organization. Only SELECT
is added, so INSERT, UPDATE and DELETE remain owner-only and the owner keeps them regardless of her
membership state. Implemented in `supabase/migrations/0041_gig_shared_read.sql`, mirroring the
`songs_select_branch` shape — `branch_id = any(private.user_branch_ids(auth.uid()))`, where
`private.user_branch_ids` aggregates **active** memberships only, so a member who left loses the read
without a status check of its own. Verified by `scripts/smoke/0041-gig-shared-read.sql`.

#### Scenario: Gig visibility follows the org and branch model

- GIVEN Lucia is a member of "Sede Madrid" in "Academia Musical"
- AND she creates the gig "Friday Gig"
- THEN the gig is private to Lucia by default
- AND Juan, a member of "Sede Madrid", does not see it
- WHEN Lucia shares the gig to "Sede Madrid"
- THEN Juan can open the gig and, once completed, its performance record
- AND Pedro, a member of "Sede Lima", cannot open the gig

#### Scenario: Read-only access survives the owner leaving the organization

Source: `features/offboarding-cascade.feature:33-37` — the same rule asserted from the offboarding side.

- GIVEN Sofia completed the gig "Friday Gig" and shared it to the branch
- WHEN Sofia leaves the org
- THEN the gig and its performance record stay with her
- AND the remaining members of that branch keep read-only access to the completed gig