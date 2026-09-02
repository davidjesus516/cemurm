Feature: Published Plan Freeze
  As a service leader
  I want publishing to freeze the plan content that members execute
  So that a member rehearses and plays exactly the version that was published

  ──────────────────────────────────────────────
  PUBLISHING FREEZES THE PLAN
  ──────────────────────────────────────────────

  Scenario: Publishing snapshots the plan
    Given the service "Sunday 10am" is complete in draft form
    When I publish the plan
    Then a published version of the plan is created
    And members see that published version as the authoritative plan
  Scenario: An edit after publish creates a new plan version
    Given "Sunday 10am" was published on Monday
    When I move "Communion" before "Offering" on Tuesday
    Then a new version of the plan is created marked "Changed after publish"
    And members keep seeing the published version until I publish again
  Scenario: The draft never reaches members
    Given I edited the plan after publishing and have not re-published
    When a member opens the plan
    Then they see the last published version
    And none of my post-publish draft edits appear

  ──────────────────────────────────────────────
  OFFLINE AND DAY-OF
  ──────────────────────────────────────────────

  Scenario: Offline members keep the exact published snapshot
    Given Juan cached the published plan of "Sunday 10am" on service day
    And a newer draft was made after his sync
    When Juan opens the plan offline
    Then he sees exactly the published snapshot he cached
    And no draft change leaks into his call sheet
  Scenario: A chart swapped after publish is flagged
    Given the "Worship" block listed "Song B" in the published version
    When I swap "Song B" for "Song D" after publishing
    Then the pending change is flagged "Changed after publish" on the block
    And when I re-publish, Juan and Lucia receive the notification
    And the change is logged with me as decider
  Scenario: Only the published version is what members execute
    Given a "Changed after publish" draft exists for "Sunday 10am"
    When the service runs
    Then every call sheet executes the published version's songs and keys
    And the draft is never executed on stage

  ──────────────────────────────────────────────
  RE-PUBLISH AND HISTORY
  ──────────────────────────────────────────────

  Scenario: Intentional re-publish replaces the executed version
    Given I made an intentional change to the published plan
    When I re-publish with the reason "New opening song"
    Then the new version becomes the published version members execute
    And the previous published version stays in history
    And members who sync see the change marker and the reason
  Scenario: Plan version history lists every publish
    Given the plan was published twice with an edit between publishes
    When I open the plan's version history
    Then each published version shows its date, decider, and publish reason
    And intermediate draft changes are marked "not executed"
  Scenario: A completed service freezes the executed version
    Given the service concluded with the version published on Sunday
    When a member opens the plan afterward
    Then the plan is shown in read-only historical mode
    And it references the exact published version that was executed