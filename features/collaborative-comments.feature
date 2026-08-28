Feature: Collaborative Comments on Songs
  As a band member
  I want to comment on songs and arrangements
  So that my notes and decisions are visible to my bandmates, not lost in chat

  ──────────────────────────────────────────────
  POSTING COMMENTARY
  ──────────────────────────────────────────────

  Scenario: Comment on a song
    Given I am a member of a band that shares "Song A"
    When I post the comment "slow the intro in the chorus"
    Then the comment is attached to "Song A"
    And all band members with access can see it
    And the comment shows my name and the time it was posted

  Scenario: Comment on a specific section of a chart
    Given I am viewing the chart of "Song A"
    When I anchor a comment on the second chorus
    Then the comment is pinned to that section
    And opening "Song A" jumps to the section the comment is about

  Scenario: Attach a comment to a particular version
    Given "Song A" has versions v1 and v2 with different chord changes
    When I comment only on the v2 chart
    Then the comment appears on the v2 version only
    And viewing v1 does not show that comment

  Scenario: Reply to a comment (threading)
    Given "Marco" commented on "Song A" about the bridge
    When I reply to his comment
    Then my reply is grouped under Marco's comment
    And the thread shows both messages in order

  ──────────────────────────────────────────────
  EDITING & RESOLVING
  ──────────────────────────────────────────────

  Scenario: Edit my own comment
    Given I posted a comment with a typo on "Song A"
    When I edit the comment
    Then the comment text is updated
    And the edit history records my correction

  Scenario: Resolve a comment after the change is applied
    Given my leader posted "raise the key a step" on "Song A"
    When the key is changed and I mark the comment resolved
    Then the comment is marked "resolved"
    And collapsed by default in the comment thread

  Scenario: Delete my own comment
    Given I posted a comment on "Song A"
    When I delete the comment
    Then the comment is removed from the thread
    And no notification about that comment remains actionable

  ──────────────────────────────────────────────
  PERMISSIONS & VISIBILITY
  ──────────────────────────────────────────────

  Scenario: Comment visibility follows the setlist/arrangement scope
    Given a setlist is shared with the full band
    When a member comments on a song in that setlist
    Then only band members with access to the arrangement see the comment
    And a member from another org cannot see it

  Scenario: Personal annotations stay separate from shared comments
    Given I have a personal annotation on "Song A"
    And "Marco" posts a shared comment on "Song A"
    When both are rendered
    Then my annotation stays private to me
    And the shared comment is visible to the band

  Scenario: Cannot comment on a song I do not have access to
    Given the arrangement of "Song X" is not shared with me
    When I try to comment on "Song X"
    Then I see a "No access" notice and cannot post

  ──────────────────────────────────────────────
  ACTIVITY & NOTIFICATIONS
  ──────────────────────────────────────────────

  Scenario: Notify bandmates when a comment is posted
    Given I have a shared setlist with "Song A"
    When "Marco" comments on "Song A"
    Then participating bandmates receive a notification
    And the notification deep-links to the commented section

  Scenario: Comment mention notifies the named member
    Given I am commenting on "Song A"
    When I type "@Lucia" and the comment is posted
    Then Lucia receives a notification pointing at my comment

  Scenario: Offline comment queues and syncs later
    Given I am offline
    When I post a comment on "Song A"
    Then the comment is saved locally with a "pending sync" flag
    And it publishes to the band when I reconnect
