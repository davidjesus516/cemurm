Feature: Organizational Repertoire Model
  As a system director
  I want a hierarchical repertoire model that supports organizations, branches, and collaborative events
  So that a national system of orchestras or a multi-branch academy can manage shared and org-specific material independently

  ──────────────────────────────────────────────
  SYSTEM-LEVEL REPERTOIRE
  ──────────────────────────────────────────────

  Scenario: System repertoire as the unified catalog
    Given "National Orchestras System" is registered at the system level
    And the system repertoire contains 200 songs
    When Org "Orquesta Ciudad Norte" creates a new setlist
    Then the setlist can include any song from the 200 system songs
    And the system repertoire remains unchanged

  Scenario: Organization adds a song to the system repertoire
    Given "Academia Rock" is an organization with 3 branches
    And instructor "Carlos" at branch "Sede Centro" creates an arrangement of "Smoke on the Water"
    When Carlos adds the arrangement to the system repertoire
    Then "Smoke on the Water (Carlos arrangement)" is available to all 3 branches immediately
    And the song metadata marks the source organization as "Academia Rock"

  Scenario: Song ownership in shared catalogue
    Given the system repertoire contains a song added by Org A
    Org B, and Org C
    When Org A wants to update its arrangement
    Then only Org A can edit its version
    And Org B and Org C continue to use their own versions or the system default

  ──────────────────────────────────────────────
  ORGANIZATION HIERARCHY (Branch / Sede)
  ──────────────────────────────────────────────

  Scenario: Organization with multiple branches
    Given "Academia Musical" has branches in "Madrid", "Lima", and "Bogota"
    And each branch has its own admins and instructors
    When a song is added at the "Madrid" branch level
    Then it is visible to Madrid admins and instructors
    And it is NOT visible to Lima or Bogota by default

  Scenario: System-level song available across all branches
    Given a song exists at the system repertoire level
    When the Lima instructor opens the song library
    Then the song appears alongside Lima-specific material
    And the Lima instructor can add it to a setlist

  Scenario: Branch-specific repertoire addition
    Given "Sede Lima" has its own organization under "Academia Musical"
    When Lima admin adds "Cancion Limeña" to the branch repertoire
    Then only Lima branch members can see it
    And it does NOT appear in Madrid's library unless explicitly shared up

  Scenario: Promote a branch song to system repertoire
    Given "Cancion Limeña" exists only in Sede Lima
    When Lima admin promotes it to system level
    Then the song appears in all branches' libraries
    And Sede Lima retains editing rights (source org)

  Scenario: Demote a system song back to org level
    Given "Song X" is at the system repertoire
    When the owning org demotes it
    Then the song moves to the org's private repertoire
    And other orgs that were using it retain their local cached copies
    But new setlists from other orgs can no longer add it

  ──────────────────────────────────────────────
  USER ROLES ACROSS LEVELS
  ──────────────────────────────────────────────

  Scenario: User with multiple roles across branches
    Given Ana is admin of "Sede Madrid"
    And Ana is also a performer in "Sede Lima" as a collaborator
    When Ana logs in
    Then she sees a dashboard with both branches
    And her admin tools are available for Madrid only
    And her performer tools are available for Lima

  Scenario: Instructor can only add songs at their branch
    Given instructor "Pedro" belongs to Sede Bogota only
    When Pedro tries to add a song to Sede Madrid
    Then the system rejects the action
    And Pedro sees "You can only add songs to your own branch"

  Scenario: Cross-branch collaboration for an event
    Given events can include participants from multiple branches
    When "Academia Musical" creates an event "Festival Nacional"
    And they invite participants from Madrid, Lima, and Bogota
    Then a cross-branch setlist library becomes available
    And each branch can see songs from the other invited branches only for this event

  ──────────────────────────────────────────────
  EVENT-LEVEL COLLABORATION
  ──────────────────────────────────────────────

  Scenario: Event with partial organization collaboration
    Given event "Gala Primavera" includes Org "Orquesta A" and Org "Orquesta C"
    But NOT Org "Orquesta B"
    When the event setlist is composed
    Then only songs from Orquesta A and Orquesta C are available for selection
    And Orquesta B's songs are excluded from the event repertoire picker

  Scenario: Event with full (all-org) collaboration
    Given event "Concierto Anual" includes all registered orgs
    When the event setlist is being built
    Then songs from all organizations are available
    And a filter lets the organizer distinguish system repertoire from org-specific additions

  Scenario: Event setlist composed from multiple sources
    Given event "Festival Instrumental" includes 3 orgs
    When the organizer adds "Song 1" (system repertoire)
    And adds "Song 2" (Org A specific)
    And adds "Song 3" (Org C specific)
    Then the event setlist shows the source of each song
    And permissions are preserved (only Org A members can edit Song 2 after the event)

  Scenario: Same org plays different setlists at different events
    Given "Orquesta A" participates in Event 1 and Event 2
    When Orquesta A creates a different setlist for each event
    Then Event 1 and Event 2 have independent setlists
    And changes to Event 1's setlist do not affect Event 2

  Scenario: Event setlist persists after the event ends
    Given "Festival 2025" has concluded
    When a member tries to view the Festival 2025 setlist
    Then the setlist is shown in read-only historical mode
    And can be referenced for future event planning

  ──────────────────────────────────────────────
  OFFLINE CROSS-ORG SCENARIOS
  ──────────────────────────────────────────────

  Scenario: Branch offline during event composition
    Given Sede Lima is offline while an event setlist is being composed
    When the Lima organizer adds a branch-specific song
    Then the addition is queued locally with a pending sync flag
    When Lima reconnects
    Then the song is validated against org permissions and added to the event setlist

  Scenario: Org member goes offline mid-event
    Given a performer from Org A is at a live event and loses connection
    When the setlist is updated by other orgs
    Then Org A's local app keeps the last known state
    And the performer can still view their current song
    When connectivity returns
    Then the app syncs the latest setlist version

  ──────────────────────────────────────────────
  ACCESS CONTROL AFTER ORG CHANGE
  ──────────────────────────────────────────────

  Scenario: Member leaves an org but retains event history
    Given performer "Sofia" was in Org A and participated in Event X
    When Sofia leaves Org A
    Then her org membership status becomes "former"
    She can no longer edit Org A's setlists
    But she can still view Event X's setlist in read-only mode
    And she retains access to songs she personally added

  Scenario: Org disbanded — repertoire transfer
    Given "Orquesta Clásica Norte" is disbanded
    When the system director assigns its repertoire to "Orquesta Clásica Centro"
    Then all songs previously owned by Norte are now accessible by Centro
    And event setlists referencing Norte's songs remain functional
    And the Norte org record is archived (not deleted)

  Scenario: System admin removes an org's song from system repertoire
    Given Org A added "Song X" to the system repertoire
    When the system admin removes "Song X" from the system level
    Then all orgs that had cached "Song X" retain a local copy
    But no new setlists can reference it at the system level
    And Org A retains full ownership of its private copy
