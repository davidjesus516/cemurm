Feature: Service Planning
  As a worship or service leader
  I want to structure a service into blocks with assigned musicians and a call sheet
  So that everyone knows what to play, when, and in which order

  ──────────────────────────────────────────────
  SERVICE STRUCTURE
  ──────────────────────────────────────────────

  Scenario: Service is composed of ordered blocks
    Given I create a service "Sunday 10am"
    When I add the blocks "Opening", "Worship", "Offering", "Communion", and "Closing" in order
    Then the service shows the 5 blocks in that order

  Scenario: A setlist fills a block
    Given the setlist "Worship Songs" contains "Song A", "Song B", and "Song C"
    When I assign "Worship Songs" to the "Worship" block
    Then the "Worship" block lists the 3 songs in order
    And each song keeps its agreed key from the setlist

  Scenario: Reordering blocks updates the service order
    Given the service has blocks [Opening, Worship, Offering, Communion, Closing]
    When I move "Communion" before "Offering"
    Then the service order is [Opening, Worship, Communion, Offering, Closing]

  Scenario: Each block keeps an independent setlist
    Given the "Worship" block has 3 songs and the "Closing" block has 1 song
    When I edit the "Closing" block
    Then the "Worship" block is unchanged

  Scenario: Block time budget warns on overrun
    Given the "Worship" block has a 25-minute budget
    And its setlist totals 28 minutes
    When the plan is saved
    Then the app warns "Worship block: 28 minutes estimated — 3 minutes over budget"

  ──────────────────────────────────────────────
  MUSICIAN ASSIGNMENT
  ──────────────────────────────────────────────

  Scenario: Assign musicians to blocks
    Given the service has blocks "Worship" and "Offering"
    When I assign Juan and Lucia to "Worship" and Pedro to "Offering"
    Then the plan shows Juan and Lucia on "Worship" and Pedro on "Offering"
    And each member sees only their assigned blocks in their view

  Scenario: A member can cover multiple sequential blocks
    Given Juan is assigned to "Opening" and to "Communion"
    And the blocks are sequential with no overlap
    When the plan validates assignments
    Then Juan's double assignment is accepted

  Scenario: Overlapping assignments conflict
    Given Lucia is assigned to "Worship"
    When I also assign Lucia to a simultaneous block "Prayer" that runs at the same time
    Then the app warns "Lucia is already assigned to Worship — overlapping times"
    And the conflicting assignment is rejected

  Scenario: Uncovered block warns before the service
    Given "Offering" has no assigned musicians
    When the plan is validated for the service
    Then the app warns "Offering block has no musicians assigned"
    And links to the substitution flow

  ──────────────────────────────────────────────
  CALL SHEET
  ──────────────────────────────────────────────

  Scenario: Call sheet lists each member's songs and keys
    Given Juan is assigned to the "Worship" block with "Song A" (G) and "Song B" (C)
    When Juan opens his call sheet
    Then he sees "Song A" in G and "Song B" in C in service order
    And his call time and the block's start time

  Scenario: Call sheet reflects the agreed keys
    Given the plan agrees "Song B" in C but Juan's projection renders in D
    When Juan opens his call sheet
    Then the call sheet shows the agreed key C
    And the chord view still renders in his projection D

  ──────────────────────────────────────────────
  DAY-OF COORDINATION
  ──────────────────────────────────────────────

  Scenario: Members check in on service day
    Given the service starts at 10:00
    When Juan marks himself present at 9:30
    Then the leader sees Juan as checked in
    And the plan records Juan's check-in time

  Scenario: Last-minute song swap notifies affected members
    Given the "Worship" block lists "Song B" as its third song
    When the leader swaps "Song B" for "Song D" 2 hours before the service
    Then the plan updates for everyone
    And Juan and Lucia (assigned to Worship) receive a notification
    And the change is logged with the leader as decider

  Scenario: Plan is read-only for members until published
    Given the leader is still editing the service plan
    When Juan tries to reorder a block
    Then the action is rejected with "Only the service leader can edit the plan"
    And Juan can still view the current plan

  ──────────────────────────────────────────────
  REHEARSAL LINK
  ──────────────────────────────────────────────

  Scenario: Rehearsal outcomes surface in the final plan
    Given "Song C" was marked "Needs work" in the last rehearsal
    When the leader reviews the final service plan
    Then "Song C" shows the warning "Needs work — check in rehearsal notes"
    And the rehearsal notes are one tap away

  ──────────────────────────────────────────────
  SERVICE COMPLETION
  ──────────────────────────────────────────────

  Scenario: Completed service becomes a read-only record
    Given the service "Sunday 10am" has concluded
    When a member opens the plan
    Then the plan is shown in read-only historical mode
    And it can be referenced for planning the next service

  ──────────────────────────────────────────────
  OFFLINE
  ──────────────────────────────────────────────

  Scenario: Members carry the plan and charts offline
    Given the service plan is published
    When Juan opens the plan on service day without connection
    Then he sees his blocks, songs, agreed keys, and charts
    And his check-in is queued and synced when he reconnects
