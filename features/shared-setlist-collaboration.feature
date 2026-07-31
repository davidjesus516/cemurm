Feature: Shared Setlist Collaboration
  As a band member
  I want to collaborate on setlists with my bandmates
  So that we can plan gigs together and react to changes in real time

  ──────────────────────────────────────────────
  CORE SCENARIOS
  ──────────────────────────────────────────────

  Scenario: Create a shared setlist and invite bandmates
    Given I am logged in as the band leader
    And I have two bandmates, "Julian" and "Lucia", both active
    When I create a setlist called "Sunday Jam"
    And I set the setlist visibility to "shared with band"
    Then Julian and Lucia can see the setlist
    And they can view but not edit until they accept

  Scenario: Bandmate edits a shared setlist (online)
    Given I have a shared setlist "Sunday Jam" with Julian and Lucia
    When Julian adds "Song X" to position 3
    Then Julian sees the song at position 3
    And I see the song appear at position 3 in real time
    And Lucia sees the change within 2 seconds

  Scenario: Bandmate removes a song while someone is editing
    Given Julian has "Song X" selected in the editor
    When Lucia removes "Song X" from the setlist
    Then Julian's editor shows a conflict toast
    And Julian can choose to "Keep my changes" or "Accept server version"

  Scenario: Reorder setlist collaboratively
    Given the setlist has songs [A, B, C] shared with three bandmates
    When Julian moves "Song C" to position 1
    Then the setlist order becomes [C, A, B] for all three bandmates
    And each bandmate sees a "Julian reordered" activity indicator

  Scenario: Lock a song during edit to prevent conflicts
    Given Julian opens "Song B" for editing
    When Lucia tries to move "Song B" to a different position
    Then Lucia sees "Song B is being edited by Julian"
    And the move button for "Song B" is disabled for Lucia until Julian saves or cancels

  ──────────────────────────────────────────────
  OFFLINE COLLABORATION ON SETLISTS
  ──────────────────────────────────────────────

  Scenario: Edit a shared setlist while offline
    Given I am offline
    And I am editing the shared setlist "Friday Gig"
    When I add "Song Y" and remove "Song Z"
    Then the setlist is saved locally with a "pending sync" flag
    And my bandmates see an offline indicator on the setlist

  Scenario: Merge offline edits when reconnecting
    Given I removed "Song Z" offline
    And Julian added "Song W" online while I was offline
    When I reconnect to the internet
    Then my offline changes merge with Julian's online changes
    And the final setlist contains "Song W" and lacks "Song Z"
    And both my and Julian's changes appear in the activity feed

  Scenario: Resolve merge conflict when both edit the same song offline
    Given I edit the lyrics of "Song A" offline
    And Julian edits the chords of "Song A" offline
    When both of us reconnect
    Then the app presents a conflict resolution screen
    And both changes are preserved in the final version of "Song A"

  Scenario: Offline bandmate adds a song, another bandmate deletes it online
    Given "Marco" adds "Song M" to a setlist while offline
    And "Julian" (online) deletes "Song M" from the same setlist
    When Marco reconnects
    Then "Song M" is still absent from the setlist
    And Marco sees a notification: "Song M was removed by Julian before your sync"

  ──────────────────────────────────────────────
  SETLIST SHARING CONTROLS
  ──────────────────────────────────────────────

  Scenario: Setlist owner controls permissions
    Given I created the setlist "Acoustic Night"
    And I set permissions: "Julian can edit, Lucia can view only"
    When Julian tries to reorder songs
    Then Julian can successfully reorder
    But when Lucia tries to reorder songs
    Then Lucia sees a "View only" badge and cannot drag songs

  Scenario: Transfer ownership of a shared setlist
    Given I created "Sunday Jam" and own it
    When I transfer ownership to Julian
    Then Julian becomes the new owner
    And I retain edit access but lose ownership controls
    And the activity log records "Ownership transferred to Julian"

  Scenario: Remove a bandmate from a shared setlist
    Given I have a shared setlist with Julian and Lucia
    When I remove "Lucia" from the setlist
    Then Lucia can no longer edit or view the setlist
    And the setlist shows "2 collaborators remaining"
    And Julian sees a notification that Lucia was removed

  ──────────────────────────────────────────────
  ACTIVITY & VERSION HISTORY
  ──────────────────────────────────────────────

  Scenario: View setlist activity feed
    Given I have a shared setlist with several collaborators
    When I open the setlist activity panel
    Then I see a chronological list of actions
    And each action shows who performed it and when

  Scenario: Revert setlist to a previous version
    Given the setlist has 5 edits in its history
    When I revert to version 3
    Then the setlist state matches version 3
    And all current collaborators see the reverted setlist
    And the activity feed records "Reverted to version 3"

  Scenario: Setlist change notifications
    Given I am a collaborator on "Friday Gig"
    When another bandmate moves a song
    Then I receive a push notification
    And the notification shows "Julian moved Song X to position 1"
