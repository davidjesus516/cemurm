Feature: Education Student Progress
  As a student working through a course
  I want to see where I am and whether I showed up today
  So that I keep a learning rhythm that belongs to me alone

  ──────────────────────────────────────────────
  THE LEARNING PATH
  ──────────────────────────────────────────────

  Scenario: Every exercise on the path shows one of four states
    Given Lucia is enrolled in the course "Guitar Fundamentals"
    And its exercises are [1] "Verse of Canción Z", [2] "Chorus of Canción Z", [3] "Bridge of Canción Cambio"
    When Lucia opens her learning path
    Then the path lists the exercises in course order
    And every exercise shows "Completed", "In progress", "Locked", or "Pending"
    And exercise [1] "Verse of Canción Z" shows "Pending"
    And exercise [3] "Bridge of Canción Cambio" shows "Locked"

  Scenario: A path shows completed, in progress, and locked side by side
    Given Lucia completed exercise [1] "Verse of Canción Z"
    And Lucia started but did not finish exercise [2] "Chorus of Canción Z"
    And exercise [3] "Bridge of Canción Cambio" is still locked for her
    When Lucia opens her learning path
    Then [1] "Verse of Canción Z" shows "Completed" with the date she finished it
    And [2] "Chorus of Canción Z" shows "In progress"
    And [3] "Bridge of Canción Cambio" shows "Locked"

  Scenario: Completing an exercise unlocks the next one
    Given "Verse of Canción Z" shows "Pending" for Lucia
    And "Chorus of Canción Z" shows "Locked" for Lucia
    When Lucia completes "Verse of Canción Z"
    Then "Verse of Canción Z" shows "Completed"
    And "Chorus of Canción Z" is no longer "Locked"

  Scenario: A locked exercise cannot be opened
    Given "Bridge of Canción Cambio" shows "Locked" for Lucia
    When Lucia tries to open it
    Then the exercise does not open
    And she is told which exercise has to come first

  Scenario: Opening an exercise makes it in progress and it stays that way
    Given "Chorus of Canción Z" shows "Pending" for Lucia
    When Lucia opens it and works on it
    Then it shows "In progress"
    And it still shows "In progress" when Lucia leaves it for another day

  Scenario: Doing a completed exercise again
    Given Lucia completed "Verse of Canción Z" three days ago
    When Lucia opens it again and finishes it
    Then it still shows "Completed" with the original date
    And the exercise shows that Lucia has attempted it twice

  ──────────────────────────────────────────────
  XP AS AN EVENT HISTORY
  ──────────────────────────────────────────────

  Scenario: An XP total is the sum of a list of events
    Given Lucia completed two exercises
    When Lucia opens her XP
    Then her total is the sum of two XP events, one per completion
    And each event names what it was for and when it happened

  Scenario: XP history is append-only
    Given Lucia's XP total is 40 across three events
    When one of those events turns out to be wrong
    Then that event cannot be edited or deleted
    And a correcting event is added instead
    And her total still equals the sum of the four events

  Scenario: The same completion arriving from two devices pays once
    Given Lucia completed an exercise offline on her phone
    And the same completion syncs from her tablet
    When both reach the server
    Then her XP total counts that completion once
    And her history shows a single event for it

  ──────────────────────────────────────────────
  STREAKS & ACTIVE DAYS
  ──────────────────────────────────────────────

  Scenario: Opening the app is not an active day
    Given Lucia's streak is 3 days
    And today she only opens the app and reads her learning path
    When the day ends
    Then today is not counted as an active day
    And her streak still reads 3

  Scenario: Completing an exercise makes the day active
    Given Lucia opens her learning path
    When Lucia completes "Chorus of Canción Z"
    Then today counts as an active day
    And her streak moves to 4

  Scenario: A practice session also makes the day active
    Given Lucia opens her learning path
    When Lucia completes a practice session for "Canción Z" on guitar
    Then today counts as an active day
    And her streak moves to 4
    And the practice session stays personal to Lucia, as practice-mode defines it

  Scenario: A missed day ends the streak but keeps the history
    Given Lucia's streak was 4 days and she did nothing for a whole day
    When she returns the next day and completes an exercise
    Then her streak restarts at 1
    And the days she was active are still listed in her history
    And her XP total is untouched

  Scenario: An active day follows my own calendar day
    Given Lucia practises at 23:30 in her own timezone
    When her streak is worked out
    Then that activity counts toward her local day
    And the same activity is not counted a second time toward the next day

  ──────────────────────────────────────────────
  DAILY GOALS
  ──────────────────────────────────────────────

  Scenario: A daily goal shows how far I am
    Given Lucia set herself a daily goal of 20 minutes practised
    And she has practised 12 minutes today
    When Lucia opens her learning path
    Then the goal shows 12 of 20 minutes
    And it is not met yet

  Scenario: Reaching the goal is recorded for the day
    Given Lucia's daily goal is 20 minutes practised
    And she has practised 20 minutes today
    When the day is worked out
    Then today is recorded as a day the goal was met
    And the goal starts again unmet for the next day

  Scenario: Missing a day does not erase anything
    Given Lucia did not practise yesterday
    When she opens the app today
    Then yesterday is recorded as a missed goal
    And her streak history, her XP total, and her completed exercises are all unchanged

  ──────────────────────────────────────────────
  PROGRESS OFFLINE
  ──────────────────────────────────────────────

  Scenario: Progress completed offline is shown at once and syncs later
    Given Lucia is offline
    When Lucia completes "Chorus of Canción Z"
    Then the completion appears on her learning path at once
    And it is held locally with a "pending sync" flag
    And when she reconnects it syncs and the flag is cleared

  Scenario: An offline day still counts once it syncs
    Given Lucia is offline on the third day of her streak
    And she completes an exercise
    When she reconnects
    Then that day counts as an active day and her streak reads 3

  ──────────────────────────────────────────────
  WHAT ONLY THE STUDENT SEES
  ──────────────────────────────────────────────

  Scenario: XP, streak, and daily goal are the student's own
    Given Lucia has an XP total, a streak, and a daily goal of her own
    When Lucia opens what she has done in the course
    Then she sees her own XP, her own streak, and her own goal
    And no other member of the organization can open any of them
