Feature: Cross-Organization Event Collaboration
  As an organizer or participating organization
  I want to collaborate across unrelated organizations for events
  So that we can coordinate performances while preserving each org's repertoire privacy and ownership

  ──────────────────────────────────────────────
  SCENARIO 1: FRIENDSHIP EVENT — Mixed Groups Across Churches
  ──────────────────────────────────────────────

  Scenario: Churches collaborate on a joint fellowship event with mixed musician groups
    Given Church A, Church B, and Church C are unrelated organizations
    And each church has its own registered repertoire and setlists
    When the churches create a joint event "Viernes de Comunidad"
    And they set the collaboration type to "mixed groups"
    Then musicians from all three churches become eligible for cross-group assignment
    And each musician retains their church affiliation in their profile

  Scenario: Mixed group formation across churches for the event
    Given the event has 12 participating musicians across 3 churches
    And the organizer creates 4 groups of 3 musicians each
    When Group 1 is composed of musicians from Church A, Church B, and Church C
    Then Group 1 can only see songs from the combined repertoire of its members' churches
    And Group 2's song selection is independent of Group 1

  Scenario: Collaboratively chosen setlist for a mixed group
    Given Group 1 has musicians from 3 churches
    When the group creates a setlist for the event
    Then the setlist draws from the union of the 3 churches' repertoires
    And each song in the setlist shows its source church
    And the setlist belongs to the event, not to any single church

  Scenario: Post-event setlist ownership
    Given "Viernes de Comunidad" has concluded
    And Group 1 created a shared setlist during the event
    When the event ends
    Then the setlist is archived under the event record
    And each participating church can reference the setlist in their historical records
    But no single church owns the setlist exclusively — it belongs to the event

  ──────────────────────────────────────────────
  SCENARIO 2: LONG DURATION EVENT — Org Setlists with Organizer Sequence Only
  ──────────────────────────────────────────────

  Scenario: Organizer sees only the performance sequence, not org setlists
    Given 5 churches are performing at "Citywide Sunday"
    And each church has its own private setlist
    When the organizer views the event schedule
    Then the organizer sees: Church name, performance slot time, and duration
    But the organizer does NOT see the songs in each church's setlist
    And the organizer can only reorder performance slots, not modify setlist content

  Scenario: Church organizer sets their own setlist privately
    Given Church D is a participant at "Citywide Sunday"
    When Church D's director creates a setlist of 8 songs
    Then the setlist is marked as "org private"
    And only Church D admins and performers can view the song details
    The main event organizer sees "Setlist confirmed — 8 songs, estimated 45 min"

  Scenario: Organizer modifies the performance sequence
    Given the current sequence is [Church A slot 1, Church B slot 2, Church C slot 3]
    When the organizer moves Church C to slot 1
    Then Church C is now first in the performance order
    And Church A and Church B are notified of the schedule change
    And no setlist content is shared or modified

  Scenario: Organizer sets a global timing constraint per slot
    Given Church E has a 30-minute slot
    When Church E's setlist totals 45 minutes of music
    Then the organizer receives a warning: "Setlist exceeds slot time by 15 min"
    And Church E can adjust their setlist or request a time extension

  Scenario: Multiple events in a weekend festival — org setlists persist across events
    Given "Citywide Sunday" and "Citywide Saturday Night" are both part of "Weekend Festival 2025"
    And Church F participates in both events
    When Church F creates a different setlist for each event
    Then each event retains its own independent setlist
    And Church F's repertoire is not duplicated as separate entries — same songs referenced

  ──────────────────────────────────────────────
  SCENARIO 3: CONCERT ORGANIZATION — Curated Program with External Performers
  ──────────────────────────────────────────────

  Scenario: Concert organizer invites external orgs to a curated program
    Given a concert organizer creates "Symphony Night"
    And the concert features 3 external orchestras plus the organizer's own ensemble
    When the organizer assigns each org a performance slot
    Then the organizer controls the program order
    And each org prepares and submits its own setlist independently

  Scenario: Concert organizer can preview setlists before approving
    Given the concert has 4 performing organizations
    When each org submits its setlist 1 week before the concert
    Then the organizer can preview each setlist for content review
    And the organizer can flag a song for replacement if it violates concert policy
    And the flagged org receives a private message: "Song X needs replacement — please choose another"

  Scenario: Concert organizer builds the program from approved setlists
    Given all 4 orgs have submitted approved setlists
    When the organizer finalizes the program
    Then the full program sequence is revealed to all participating orgs
    And each org sees only their own setlist and their slot time
    But the program booklet includes all orgs' setlists for the audience

  Scenario: Backstage coordinator sees full program details
    Given the concert has a backstage coordinator role
    When the coordinator views the program
    Then the coordinator sees full setlists for all orgs
    And timing notes, intermission schedule, and changeover instructions
    But the coordinator cannot edit any org's setlist

  Scenario: Concert with overlapping repertoire across orgs
    Given Orchestra X and Orchestra Z both have "Ode to Joy" in their repertoires
    When both perform on the same concert program
    Then each org's arrangement is treated independently
    And the audience sees the org name next to each performance
    No conflict arises — each org performs their own version

  Scenario: Post-concert report aggregates all setlists
    Given "Symphony Night" has concluded
    When the organizer generates a post-concert report
    Then the report includes each org's setlist, performance duration, and audience size
    And each org can download their own performance recap

  ──────────────────────────────────────────────
  PERMISSIONS & VISIBILITY MATRIX
  ──────────────────────────────────────────────

  Scenario: Visibility matrix for cross-org event types
    Given an event can be of type "mixed-group", "sequence-only", or "full-program"
    When a "mixed-group" event is created
    Then participating musicians see combined repertoires of their groups
    And org admins see their own org's setlists only
    And the event coordinator sees everything
    When a "sequence-only" event is created
    Then the organizer sees slot times but not setlist content
    And participating orgs see only their own setlist and slot
    When a "full-program" event is created
    Then the organizer sees and can approve all setlists
    And participating orgs see the full program after it's finalized
    But individual org setlists remain editable until approval is locked
