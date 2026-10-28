Feature: Education Courses and Exercises
  As an instructor at an organization
  I want to build a course as a flat ordered list of exercises, each aimed at real material
  So that my students rehearse the songs we actually play instead of generic drills

  ──────────────────────────────────────────────
  COURSE OWNERSHIP
  ──────────────────────────────────────────────

  Scenario: An organization owns a course
    Given instructor "Pedro" belongs to "Academia Musical" at "Sede Bogota"
    And "Academia Musical" has an org owner
    And Lucia is a student at "Academia Musical"
    When Pedro creates the course "Guitar Fundamentals"
    Then the course belongs to "Academia Musical" and its org owner can see it
    And it appears in no other organization's course list

  Scenario: A course stays a draft until the instructor publishes it
    Given Pedro created the course "Guitar Fundamentals" in draft
    And Lucia is a student at "Academia Musical"
    When Lucia opens her course list before Pedro publishes
    Then "Guitar Fundamentals" is not offered to her
    When Pedro publishes the course
    Then "Guitar Fundamentals" is offered to Lucia

  Scenario: An instructor from another organization cannot open the course
    Given the course "Guitar Fundamentals" belongs to "Academia Musical"
    And "Orquesta Ciudad Norte" is a different organization
    When an instructor of "Orquesta Ciudad Norte" tries to open "Guitar Fundamentals"
    Then the request is refused and the course is not revealed

  ──────────────────────────────────────────────
  THE ORDERED EXERCISE LIST
  ──────────────────────────────────────────────

  Scenario: Exercises form one flat ordered list
    Given the course "Guitar Fundamentals" has [1] "Verse of Canción Z", [2] "Chorus of Canción Z", [3] "Bridge of Canción Cambio"
    When Lucia opens the course
    Then she sees the three exercises in that order as a single list
    And each exercise shows the position it holds in the course
    And there is no unit or lesson level to open between the course and an exercise

  Scenario: Reordering the exercises keeps each student's progress
    Given Lucia has completed exercise [1] "Verse of Canción Z"
    And the course "Guitar Fundamentals" has [1] "Verse of Canción Z", [2] "Chorus of Canción Z", [3] "Bridge of Canción Cambio"
    When Pedro moves exercise [3] to position 1
    Then the course order becomes [3] "Bridge of Canción Cambio", [1] "Verse of Canción Z", [2] "Chorus of Canción Z"
    And Lucia's completed mark follows "Verse of Canción Z" rather than the slot it sits in
    And no completion is left attached to a position number instead of the exercise

  ──────────────────────────────────────────────
  AIMING AN EXERCISE AT A SONG
  ──────────────────────────────────────────────

  Scenario: An exercise targets a whole song
    Given the course "Guitar Fundamentals" has the exercise "Learn the intro of Canción Z"
    When Pedro aims that exercise at the song "Canción Z"
    Then the exercise names "Canción Z" as the material to work on
    And opening the exercise opens "Canción Z"

  Scenario: An exercise targets one specific section of a song
    Given "Canción Cambio" has a Bridge in 3/4 at 90 BPM inside a 4/4 song at 120 BPM
    And the course "Guitar Fundamentals" has the exercise "Bridge of Canción Cambio"
    When Lucia opens that exercise
    Then "Canción Cambio" opens at the Bridge
    And the exercise asks her to name the chords in that Bridge
    And no copy of the song and no new version of it is created

  Scenario: The section target follows the song's current chart
    Given Lucia is working on "Bridge of Canción Cambio"
    When the Bridge of "Canción Cambio" is corrected in the chart
    And Lucia opens the exercise again
    Then the exercise still opens at the Bridge
    And she works on the corrected chart

  Scenario: Renaming the targeted section leaves the exercise pointing at a section that is gone
    Given Lucia is working on "Bridge of Canción Cambio"
    When the Bridge of "Canción Cambio" is renamed to "Interlude"
    And Lucia opens the exercise
    Then the exercise flags that its target section no longer exists
    And Pedro is asked to point the exercise at a section that does

  Scenario: An exercise can only aim at a song the organization can already reach
    Given the course "Guitar Fundamentals" belongs to "Academia Musical"
    When Pedro looks for a song to aim an exercise at
    Then he is offered the songs "Academia Musical" can already reach
    And the branch and org visibility rules of organizational-repertoire-model still apply
    And a song that belongs only to another organization is never offered

  Scenario: A retired song still renders inside an exercise the student already did
    Given Lucia completed "Bridge of Canción Cambio"
    When "Canción Cambio" is retired from the repertoire
    Then Lucia's completion stays on the exercise
    And the exercise shows that its song is retired and no longer playable

  ──────────────────────────────────────────────
  EXERCISE DETAILS
  ──────────────────────────────────────────────

  Scenario: An exercise carries its instructions and an estimate
    Given Pedro adds the exercise "Bridge of Canción Cambio" to "Guitar Fundamentals"
    When he writes the instructions and sets an estimate of 15 minutes
    Then the exercise shows the instructions and "About 15 minutes"
    And Lucia sees the same instructions and the same estimate

  Scenario: Removing an exercise from a course
    Given Lucia has not started "Bridge of Canción Cambio"
    When Pedro removes that exercise from "Guitar Fundamentals"
    Then it is no longer offered to Lucia
    And the songs it referred to are untouched
