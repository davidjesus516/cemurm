Feature: Substitutions and Coverage
  As a service or band leader
  I want to cover missing musicians with substitutes who see the assignment in their own key and instrument
  So that the service stays covered even when someone is absent

  ──────────────────────────────────────────────
  SUBSTITUTION REQUEST
  ──────────────────────────────────────────────

  Scenario: Member unavailability opens a substitution request
    Given Lucia is assigned to the "Worship" block
    When Lucia marks herself unavailable for the service
    Then the plan opens a substitution request for Lucia's assignment
    And the leader is notified

  Scenario: Request lists eligible substitutes
    Given Lucia's assignment needs a bass player
    When the substitution request is created
    Then the request lists band members who play bass
    And each candidate shows their availability and substitution history

  Scenario: Request goes to eligible candidates
    Given the substitution request for bass has 3 eligible candidates
    When the leader sends the request
    Then the 3 candidates receive a notification with the assignment details
    And the request shows who has accepted, declined, or not answered

  Scenario: First confirmed accept covers the request
    Given candidates "Pedro" and "Mario" receive the bass substitution request
    When Pedro confirms first
    Then Pedro is assigned to Lucia's bass part
    And Mario's pending request is closed with "Position already covered"
    And Mario receives a notification that the position was taken

  ──────────────────────────────────────────────
  SUB'S EXPERIENCE
  ──────────────────────────────────────────────

  Scenario: Substitute sees the assignment projected to their own key
    Given the plan agrees "Song A" in G
    And substitute Juan has a personal offset of +2
    When Juan opens the assignment
    Then the call sheet shows the agreed key G
    And his chords render in A (his personal projection)
    And the stored plan is unchanged

  Scenario: Substitute's instrument determines the rendered part
    Given Lucia's bass part is covered by keyboardist "Mario"
    When Mario opens the assignment
    Then Mario sees the song in his keyboard-friendly rendering with his personal key offset
    And the original bass part is still the plan's reference

  Scenario: Transposing instrument renders its written pitch
    Given the flute part in "Song C" is in concert G
    And substitute "Rosa" plays a B-flat trumpet
    When Rosa opens the assignment
    Then her part renders written a whole step up (A)
    And the score stays in concert G for the rest of the band

  Scenario: Substitute's version preference applies
    Given "Song B" has versions "Original (artist)" and "Pedro's arrangement"
    And substitute Pedro prefers "Pedro's arrangement"
    When Pedro opens the assignment for "Song B"
    Then he sees "Pedro's arrangement" by default
    And the plan's chosen version is still "Original (artist)"

  Scenario: Personal chord substitutions render for the substitute
    Given Mario has a personal substitution "Bm -> Dmaj7" for "Song A"
    When Mario opens the assignment
    Then his view renders Dmaj7 where the chart says Bm
    And the shared chart keeps B minor

  ──────────────────────────────────────────────
  COVERAGE STATUS
  ──────────────────────────────────────────────

  Scenario: Block coverage shows which parts are covered
    Given the "Worship" block needs vocals, guitar, bass, and drums
    When the plan shows coverage
    Then covered parts show "Covered by <member>"
    And uncovered parts show "Uncovered"

  Scenario: Uncovered part keeps warning until a substitute confirms
    Given the bass part is uncovered in the "Worship" block
    When the plan is validated the day before the service
    Then the plan still warns "Bass part uncovered — Lucia absent"
    And the warning clears only when a substitute confirms

  Scenario: Substitute cancel returns the part to uncovered
    Given Pedro confirmed he would cover Lucia's bass part
    When Pedro cancels the day before the service
    Then the bass part returns to "Uncovered"
    And the leader receives a notification with the remaining candidates

  ──────────────────────────────────────────────
  SUBSTITUTION LIFECYCLE
  ──────────────────────────────────────────────

  Scenario: Original member returns and reclaims the part
    Given Pedro is covering Lucia's bass part
    When Lucia returns and confirms she can play
    Then the assignment returns to Lucia
    And Pedro is released from the part
    And both receive a confirmation notification

  Scenario: Substitution is logged for history
    Given Pedro covered Lucia's bass part for the "Sunday 10am" service
    When the service concludes
    Then the plan records "Bass: Pedro (sub for Lucia)"
    And the substitution appears in both members' history

  Scenario: Leader can overrule a self-assigned substitute
    Given candidates confirmed for Lucia's part
    When the leader instead assigns "Mario" directly
    Then Mario is recorded as the substitute with the leader as decider
    And the earlier confirmations are released

  ──────────────────────────────────────────────
  CROSS-ORG EVENT COVERAGE
  ──────────────────────────────────────────────

  Scenario: Substitute from another organization gets scoped access
    Given the event "Festival Nacional" includes Org A and Org B
    And a trumpet player from Org B covers a missing part in Org A's set
    When the substitute opens the assignment
    Then they see only the assigned songs and the event setlist
    And they do not see Org A's private repertoire

  ──────────────────────────────────────────────
  OFFLINE
  ──────────────────────────────────────────────

  Scenario: Substitution acceptance works offline
    Given Pedro has no connection when the request arrives
    When Pedro confirms the substitution
    Then the confirmation is queued locally with a pending sync flag
    When Pedro reconnects
    Then the assignment updates and the leader sees Pedro as confirmed
