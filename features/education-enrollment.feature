Feature: Education Course Enrollment
  As an organization running courses for its members
  I want the organization to decide who is enrolled in a course
  So that a student's courses are set by their academy and not by whoever signs up first

  ──────────────────────────────────────────────
  WHO ENROLLS
  ──────────────────────────────────────────────

  Scenario: An org admin enrols a student in a course
    Given Lucia is a member of "Academia Musical"
    And the course "Guitar Fundamentals" belongs to "Academia Musical"
    When the org admin of "Academia Musical" enrols Lucia in "Guitar Fundamentals"
    Then Lucia is enrolled in "Guitar Fundamentals"
    And she can open every exercise in it

  Scenario: The org owner can enrol as well
    Given "Academia Musical" has an org owner
    And the course "Guitar Fundamentals" belongs to "Academia Musical"
    When the org owner enrols Sofia in "Guitar Fundamentals"
    Then Sofia is enrolled in "Guitar Fundamentals"

  Scenario: A branch admin enrols within their own branch
    Given the course "Guitar Fundamentals" belongs to branch "Sede Bogota" of "Academia Musical"
    And a branch admin is in charge of "Sede Bogota"
    When that branch admin enrols Lucia in "Guitar Fundamentals"
    Then Lucia is enrolled in "Guitar Fundamentals"

  Scenario: A branch admin cannot enrol outside their own branch
    Given the course "Guitar Fundamentals" belongs to branch "Sede Lima" of "Academia Musical"
    And a branch admin is in charge of "Sede Bogota"
    When that branch admin enrols Lucia in "Guitar Fundamentals"
    Then the request is refused
    And Lucia is not enrolled in "Guitar Fundamentals"

  Scenario: An instructor cannot enrol anybody
    Given instructor "Pedro" teaches "Guitar Fundamentals" at "Academia Musical"
    And Marco is a member of "Academia Musical"
    When Pedro enrols Marco in "Guitar Fundamentals"
    Then the request is refused
    And Marco is not enrolled
    And Pedro can still author the course and hand out work — he does not decide who is on its roster

  Scenario: A student cannot enrol themselves and the product offers no way to
    Given Lucia is a member of "Academia Musical"
    And Lucia is not enrolled in "Guitar Fundamentals"
    When Lucia tries to enrol herself in "Guitar Fundamentals"
    Then the request is refused
    And no "Join course" control is offered to her anywhere in the product
    And her course list says "You are not enrolled in any course" with no action attached

  ──────────────────────────────────────────────
  ENROLLMENT NEEDS SOMEONE WHO ALREADY BELONGS
  ──────────────────────────────────────────────

  Scenario: Only a member of the organization can be enrolled
    Given Diego holds no membership in "Academia Musical"
    And the course "Guitar Fundamentals" belongs to "Academia Musical"
    When the org admin enrols Diego in "Guitar Fundamentals"
    Then the request is refused and Diego is not enrolled
    And the roster of people who can be enrolled is the organization's own members

  Scenario: Someone who left the organization is not offered for enrolment
    Given Lucia was a member of "Academia Musical" and her membership is now "former"
    When the org admin opens the roster of people who can be enrolled
    Then Lucia is not in it
    And she cannot be enrolled in a course of "Academia Musical"

  Scenario: A person from another organization cannot be enrolled here
    Given Sofia is a member of "Orquesta Ciudad Norte"
    And the course "Guitar Fundamentals" belongs to "Academia Musical"
    When the org admin of "Academia Musical" tries to enrol Sofia in "Guitar Fundamentals"
    Then the request is refused
    And "Orquesta Ciudad Norte" is not revealed as a roster the admin could enrol from

  ──────────────────────────────────────────────
  THE ROLE IS PER COURSE
  ──────────────────────────────────────────────

  Scenario: The same person can be a student in one course and an instructor in another
    Given "Pedro" is an instructor at "Academia Musical"
    And he is an instructor of "Guitar Fundamentals"
    When the org admin enrols "Pedro" in "Rhythm Studies" as a student
    Then "Pedro" is a student in "Rhythm Studies"
    And "Pedro" is still an instructor in "Guitar Fundamentals"

  Scenario: An instructor of a course is enrolled with the instructor role
    Given the course "Guitar Fundamentals" belongs to "Academia Musical"
    When the org admin enrols "Pedro" in "Guitar Fundamentals" as an instructor
    Then "Pedro" is the instructor of "Guitar Fundamentals"
    And he can open the authoring surface of that course
    And the organization, not he, is what put him there

  Scenario: Changing the role in one course leaves the others alone
    Given "Pedro" is an instructor of "Guitar Fundamentals" and a student of "Rhythm Studies"
    When the org admin changes "Pedro" to a student in "Guitar Fundamentals"
    Then "Pedro" is a student in "Guitar Fundamentals"
    And his role in "Rhythm Studies" does not change

  ──────────────────────────────────────────────
  WITHDRAWING AND ENROLING AGAIN
  ──────────────────────────────────────────────

  Scenario: An org admin withdraws a student from a course
    Given Lucia is enrolled in "Guitar Fundamentals"
    When the org admin of "Academia Musical" withdraws Lucia from "Guitar Fundamentals"
    Then Lucia is no longer enrolled in "Guitar Fundamentals"
    And the course is not offered to her

  Scenario: A withdrawn student keeps the record of what they completed
    Given Lucia completed the exercise "Bridge of Canción Cambio" in "Guitar Fundamentals"
    When the org admin withdraws Lucia from "Guitar Fundamentals"
    Then the completion is still on record
    And the withdrawal does not erase it

  Scenario: A withdrawn student no longer sees the course as theirs
    Given Lucia was withdrawn from "Guitar Fundamentals"
    When Lucia opens her course list
    Then "Guitar Fundamentals" is not on it
    And she cannot open it

  Scenario: Enrolling again revives the one record instead of creating a second
    Given Lucia was withdrawn from "Guitar Fundamentals"
    When the org admin enrols Lucia in "Guitar Fundamentals" again
    Then she is enrolled in "Guitar Fundamentals" once
    And the course holds a single record of her, not two

  Scenario: Nobody but the organization can withdraw a student
    Given Lucia is enrolled in "Guitar Fundamentals"
    When Lucia tries to withdraw herself from "Guitar Fundamentals"
    Then the request is refused
    And she is still enrolled

  ──────────────────────────────────────────────
  WHAT THE ENROLMENT REVEALS
  ──────────────────────────────────────────────

  Scenario: An instructor sees the roster of the course he teaches
    Given instructor "Pedro" teaches "Guitar Fundamentals" with Lucia and Sofia both enrolled
    When Pedro opens the roster of "Guitar Fundamentals"
    Then he sees Lucia and Sofia on it
    And he can assign work to exactly those students and no other

  Scenario: Enrolling someone does not reveal their private activity
    Given Lucia has practice sessions, a streak, an XP total and a daily goal of her own
    And she wrote a private note on an exercise
    When the org admin opens what Lucia is enrolled in
    Then the admin sees the courses Lucia is enrolled in
    And not Lucia's practice sessions, their durations, her streak, her XP, her daily goal or her private note

  Scenario: An instructor from another organization sees no roster
    Given the course "Guitar Fundamentals" belongs to "Academia Musical"
    And "Orquesta Ciudad Norte" is a different organization
    When an instructor of "Orquesta Ciudad Norte" tries to open the roster of "Guitar Fundamentals"
    Then the request is refused and the roster is not revealed

  ──────────────────────────────────────────────
  REPEATED ENROLMENT
  ──────────────────────────────────────────────

  Scenario: Enrolling the same student twice leaves one enrolment
    Given Lucia is enrolled in "Guitar Fundamentals"
    When the org admin enrols Lucia in "Guitar Fundamentals" again
    Then there is still exactly one enrolment for Lucia in that course
    And the repeated request does not fail the operation that carried it