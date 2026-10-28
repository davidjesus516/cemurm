Feature: Education Teaching Assignments
  As an instructor
  I want to hand specific work to the students I teach and see who has finished it
  So that a course is something I can follow up on instead of publishing and hoping

  ──────────────────────────────────────────────
  STUDENTS IN A COURSE
  ──────────────────────────────────────────────

  Scenario: A student sees the course they are enrolled in
    Given Lucia is enrolled in the course "Guitar Fundamentals" at "Academia Musical"
    When Lucia opens her courses
    Then "Guitar Fundamentals" is listed
    And she can open every exercise in it

  Scenario: Enrolment is per course
    Given Lucia is enrolled in "Guitar Fundamentals"
    And Lucia is not enrolled in "Rhythm Studies"
    When Lucia tries to open "Rhythm Studies"
    Then it is not on her course list
    And she cannot open it

  ──────────────────────────────────────────────
  AN INSTRUCTOR HANDS OUT WORK
  ──────────────────────────────────────────────

  Scenario: An instructor gives one exercise to one student
    Given instructor "Pedro" teaches the course "Guitar Fundamentals" at "Academia Musical"
    And Lucia is enrolled in "Guitar Fundamentals"
    When Pedro gives Lucia the exercise "Bridge of Canción Cambio"
    Then that exercise is on Lucia's learning path as work to do
    And Pedro can see that he gave it to Lucia and when

  Scenario: Work given to a student is offered even when earlier exercises are not done
    Given Lucia is enrolled in "Guitar Fundamentals"
    And "Verse of Canción Z" is still "Locked" for Lucia
    When Pedro gives Lucia the exercise "Bridge of Canción Cambio"
    Then "Bridge of Canción Cambio" is available to Lucia straight away
    And "Verse of Canción Z" stays "Locked"

  Scenario: Work can only be given to a student in that course
    Given instructor "Pedro" teaches "Guitar Fundamentals" at "Academia Musical"
    And Sofia is not enrolled in "Guitar Fundamentals"
    When Pedro tries to give Sofia the exercise "Bridge of Canción Cambio"
    Then the request is refused
    And Sofia is told she is not enrolled in this course

  Scenario: An instructor from another organization cannot hand out work
    Given the course "Guitar Fundamentals" belongs to "Academia Musical"
    And "Orquesta Ciudad Norte" is a different organization
    When an instructor of "Orquesta Ciudad Norte" tries to give work in "Guitar Fundamentals"
    Then the request is refused
    And the course is not revealed to them

  Scenario: An instructor can take back work the student has not started
    Given Pedro gave Lucia the exercise "Bridge of Canción Cambio"
    And Lucia has not started it
    When Pedro takes that work back
    Then it is no longer on Lucia's learning path as work to do
    And Pedro's record of what he handed out shows it as withdrawn

  ──────────────────────────────────────────────
  THE STUDENT COMPLETES THE WORK
  ──────────────────────────────────────────────

  Scenario: The student completes work and it records as done
    Given Pedro gave Lucia the exercise "Bridge of Canción Cambio"
    And Lucia has opened it and is working on it
    When Lucia completes it
    Then it shows "Completed" on her learning path
    And her own XP and her own streak count the day, as education-student-progress defines them

  Scenario: Work given to one student does not appear for another
    Given instructor "Pedro" teaches "Guitar Fundamentals" with Lucia and Sofia both enrolled
    When Pedro gives Lucia the exercise "Bridge of Canción Cambio"
    Then it does not appear on Sofia's learning path
    And Sofia can still work through the course in the course's own order

  ──────────────────────────────────────────────
  WHAT THE INSTRUCTOR SEES
  ──────────────────────────────────────────────

  Scenario: The instructor sees who is done and who is not
    Given instructor "Pedro" teaches "Guitar Fundamentals" with Lucia and Sofia both enrolled
    And Lucia completed the exercise "Bridge of Canción Cambio"
    And Sofia has not started it
    When Pedro opens that exercise in the course
    Then he sees Lucia as done and Sofia as not done
    And he can see which of his students have not started the course at all

  Scenario: A completion made offline reaches the instructor only after it syncs
    Given Pedro gave Lucia the exercise "Bridge of Canción Cambio"
    And Lucia completes it with no connection
    When Lucia reconnects
    Then the completion syncs
    And when Pedro next opens the course it shows as done for Lucia
    And it is not shown as done before that sync

  ──────────────────────────────────────────────
  VISIBILITY BOUNDARIES
  ──────────────────────────────────────────────

  Scenario: The instructor sees course work, not the student's own activity
    Given instructor "Pedro" teaches Lucia in "Guitar Fundamentals"
    And Lucia has practice sessions, a streak, an XP total, and a daily goal of her own
    When Pedro opens what Lucia has done in the course
    Then he sees which exercises she completed and when
    And he does not see her practice sessions, their durations, her streak, her XP, or her daily goal

  Scenario: A student's private note on an exercise stays private
    Given Lucia wrote a private note on the exercise "Bridge of Canción Cambio"
    When Pedro opens that exercise in the course
    Then he sees that Lucia completed it
    And he does not see Lucia's note
    And the note stays visible to Lucia alone
