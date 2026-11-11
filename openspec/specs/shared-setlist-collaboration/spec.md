# Shared Setlist Collaboration Specification

## Purpose

Band collaboration on setlists from `features/shared-setlist-collaboration.feature`: visibility, roles, realtime updates, client advisory lock, transfer/removal, offline merge, activity feed. 12 scenarios IN. The activity feed is client-derived from Realtime change events (D6 — no `setlist_activity` table; that named table is the fallback only if client-derivation is rejected). Merge-conflict screen and revert defer to change 3; change-notifications push defers to change 2 (deferral table below).

## Requirements

### Requirement: Shared setlist creation and invitation

Visibility MUST be one of `'private' | 'shared' | 'public'` (`org`/`branch` reserved for Hito 4). Sharing MUST create `setlist_collaborators` rows; invitees MUST NOT see or edit the setlist until they accept — acceptance unlocks visibility, so no pre-accept view state exists. (Archive reconciliation, verify Finding 3: 0002 `setlists_select_member` requires `accepted_at IS NOT NULL`, so the earlier "view but not edit" wording is not reachable under the shipped RLS; accept is a view-unlock, not an edit-unlock.)

#### Scenario: Create a shared setlist and invite bandmates

- GIVEN I am the band leader with active bandmates "Julian" and "Lucia"
- WHEN I create "Sunday Jam" and set visibility to "shared with band"
- THEN Julian and Lucia can see the setlist only after accepting — pre-accept they do not see it (acceptance unlocks visibility)

### Requirement: Realtime live updates

Realtime MUST deliver a collaborator's edit to all members with access within 2 seconds.

#### Scenario: Bandmate edits a shared setlist online

- GIVEN shared setlist "Sunday Jam" with Julian and Lucia
- WHEN Julian adds "Song X" at position 3
- THEN Julian sees it at position 3, I see it appear in real time, and Lucia sees the change within 2 seconds

### Requirement: Client advisory lock and conflict toast

A concurrent edit MUST trigger a conflict toast offering "Keep my changes" or "Accept server version". An in-progress edit MUST show a lock notice and MUST disable conflicting actions for other members until save/cancel. Advisory state is client-layer (schema-v2 §3 precedent) — no DB row.

#### Scenario: Bandmate removes a song while someone is editing it

- GIVEN Julian has "Song X" selected in the editor
- WHEN Lucia removes "Song X" from the setlist
- THEN Julian's editor shows a conflict toast with "Keep my changes" or "Accept server version"

#### Scenario: Lock a song during edit

- GIVEN Julian opens "Song B" for editing
- WHEN Lucia tries to move "Song B"
- THEN Lucia sees "Song B is being edited by Julian" and the move button stays disabled until Julian saves or cancels

### Requirement: Collaborative reorder

The system MUST apply a bandmate's reorder to all members and MUST indicate which member reordered.

#### Scenario: Reorder setlist collaboratively

- GIVEN a shared setlist with songs [A, B, C] and three bandmates
- WHEN Julian moves "Song C" to position 1
- THEN the order becomes [C, A, B] for all three and each bandmate sees a "Julian reordered" activity indicator

### Requirement: Offline edit with pending sync

Offline edits MUST save locally with a "pending sync" flag (data layer: `buildOptimisticCollab`, cache-persisted). The "offline indicator to bandmates" clause is DEFERRED/partial — no UI badge renders it on setlist surfaces and no server/feed signal exists for a local pending edit (archive annotation, verify Finding 1).

#### Scenario: Edit a shared setlist while offline

- GIVEN I am offline editing the shared setlist "Friday Gig"
- WHEN I add "Song Y" and remove "Song Z"
- THEN the setlist saves locally with a "pending sync" flag (the bandmate-facing offline indicator clause is deferred — no indicator surface shipped)

### Requirement: Non-conflicting offline merge

On reconnect the system MUST merge non-conflicting offline edits with concurrent online changes (`reconcileSetlistOp`: replay vs drop+notice vs silent no-op). The "record both in the activity feed" clause is DEFERRED/partial — drained ops never broadcast activity events; the feed records only live share/reorder/transfer broadcasts and local emits (archive annotation, verify Finding 2, under the disclosed D5/D6 live-broadcast ceiling).

#### Scenario: Merge offline edits when reconnecting

- GIVEN I removed "Song Z" offline and Julian added "Song W" online meanwhile
- WHEN I reconnect
- THEN the setlist contains "Song W" and lacks "Song Z" (the "both changes appear in the activity feed" clause is deferred — drained merges do not enter the feed)

### Requirement: Offline add vs online delete

A song added offline and deleted online before sync MUST stay absent, with a notice to the offline user.

#### Scenario: Offline bandmate adds a song, another deletes it online

- GIVEN "Marco" adds "Song M" offline and "Julian" deletes it online
- WHEN Marco reconnects
- THEN "Song M" is still absent and Marco sees "Song M was removed by Julian before your sync"

### Requirement: Collaborator permissions and view-only badge

The owner MUST set per-collaborator `can_edit`; view-only collaborators MUST see a "View only" badge and MUST NOT reorder or otherwise modify.

#### Scenario: Setlist owner controls permissions

- GIVEN I set "Julian can edit, Lucia view only" on "Acoustic Night"
- WHEN Julian tries to reorder songs
- THEN Julian reorders successfully, while Lucia sees a "View only" badge and cannot drag songs

### Requirement: Ownership transfer

The owner MUST transfer ownership to a collaborator; the new owner MUST gain ownership controls and the former owner MUST retain edit access.

#### Scenario: Transfer ownership of a shared setlist

- GIVEN I created and own "Sunday Jam"
- WHEN I transfer ownership to Julian
- THEN Julian becomes the new owner, I retain edit access but lose ownership controls, and the activity log records "Ownership transferred to Julian"
### Requirement: Bandmate removal from a setlist

Removal MUST immediately revoke the removed member's view and edit access and MUST surface the change to remaining collaborators via the local "N collaborator(s) remaining" notice, and MUST emit a `notifications` row to the removed member in the same transaction (setlists S10 "Julian sees a notification that she was removed" — now IN). The removed member MUST NOT receive further notifications for the setlist (row absence — the `setlist_collaborators` DELETE removes the row, see Realtime publication RLS-safe).

#### Scenario: Remove a bandmate from a shared setlist

- GIVEN "Sunday Jam" shared with Julian and Lucia
- WHEN I remove "Lucia" from the setlist
- THEN Lucia can no longer edit or view it, the setlist shows "2 collaborators remaining", Lucia receives a notification "You have been removed from Sunday Jam", and she receives no further notifications for it

### Requirement: Activity feed

The system MUST show a chronological activity feed of setlist actions with actor and timestamp. The feed MUST be client-derived from Realtime change events (D6 — no `setlist_activity` table in PR#2).

#### Scenario: View setlist activity feed

- GIVEN a shared setlist with several collaborators
- WHEN I open the setlist activity panel
- THEN I see a chronological list of actions, each showing who performed it and when

### Requirement: Setlist change notifications as in-app rows

A collaborator's song add, reorder, permission change, or removal on a shared setlist MUST emit a `notifications` row (in-app) to the affected members, in the same transaction as the change (setlists S10/S15 clauses — now IN as in-app rows; the previous "view-only notification" wording in 0002 has no reachable pre-accept view state; see the change-1 archive reconciliation (verify Finding 3) on the 0006 Realtime publication RLS-safe requirement).

#### Scenario: Bandmate reorders a setlist

- GIVEN "Julian" reorders "Sunday Jam" online
- WHEN the reorder commits
- THEN I receive a notification "Julian reordered songs in Sunday Jam" (relative-time timestamp) and my offline badge unread count increments

#### Scenario: Bandmate adds a song

- GIVEN "Julian" adds "Song X" to "Friday Gig"
- WHEN the add commits
- THEN I receive a notification "Julian added Song X to Friday Gig" with the song's key and tempo when available

### Requirement: A shared setlist shares its songs, not only its rows

Sharing a setlist MUST share the content it points at. An accepted collaborator MUST be able to
read the songs referenced by the setlist — their titles, their `song_versions` and their
`chart_files` — so the setlist page does not render "(missing song)" per row and the export does
not serialize to an empty document. The collaborator's read MUST be the setlist owner's own read
scope applied to those **songs**: what the owner can read, the collaborator can read, and nothing
the owner cannot. A song the owner could not read MUST NOT become readable through the setlist,
even if a collaborator with edit rights inserts its UUID. A pending invitation MUST grant nothing.

For `chart_files` rows the owner-keyed policies key on the song's **creator**, so a collaborator can
reach a chart row of a song created by another org member that the setlist's owner cannot read
through their own scopes. That asymmetry is **created by setlist sharing**: at baseline neither the
owner nor a collaborator could reach that chart row. The narrowness comes from the creator-keyed
policy; the asymmetry itself is created here, and it is the feature's purpose. `song_versions` has
no such asymmetry: its `SELECT` keys on the version's own `owner_id` or the song's creator, and its
other writes require both.

PDF and MusicXML charts are **out of scope** of this requirement: the `charts` storage bucket is
private with owner-folder RLS and 1-hour signed URLs, so a cross-organization collaborator sees the
`chart_files` row and still cannot download the object. Inline ChordPro content is covered.

Implemented in `supabase/migrations/0048_setlist_collaborator_read.sql`; verified by
`scripts/smoke/0048-setlist-collaborator-read.sql` (15 PASS / 0 FAIL on a fresh reset); record:
`odd/tasks/acl-setlist-collaborator-read.md`.

#### Scenario: Bandmate opens a shared setlist from another organization

- GIVEN "Lucia" accepted an invitation to "Julian"'s setlist, which holds "Way Maker" and "Oceans"
- WHEN Lucia opens that setlist
- THEN both songs appear with their titles and their agreed keys
- AND their charts are readable, so the export is not empty

#### Scenario: The owner vouches for the content

- GIVEN "Julian" owns a setlist and "Lucia" is an accepted collaborator with edit rights
- WHEN Lucia inserts the UUID of a song Julian cannot read into that setlist
- THEN the song does not become readable for Lucia
- AND Julian's own vouch for it is unsatisfiable, so no one gains it through the setlist

## Deferred Scenarios

| Scenario | Feature ref | Disposition |
|---|---|---|
| Resolve merge conflict when both edit the same song offline | setlists S8 | → change 3 (conflict policy) |
| Revert setlist to a previous version | setlists S14 | → change 3 (needs version history; activity is client-derived in PR#2) |
| Setlist change notifications (push) | setlists S15 | → change 2 (notifications feed/triggers) |
| Removal notification to remaining collaborators | setlists S10 (clause "Julian sees a notification that she was removed") | → change 2 (notifications feed/triggers); PR#2a surface is the local "N collaborator(s) remaining" notice (verify Finding 4) |