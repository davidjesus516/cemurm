Feature: Assignable Tasks
  As a musician working with collaborators
  I want to hand a small piece of work to one of my bandmates and see whether it is done
  So that coordination happens in the app instead of in a chat thread I have to re-read

  ──────────────────────────────────────────────
  THE TASK
  ──────────────────────────────────────────────

  Scenario: I assign a task to an active bandmate
    Given I have an active bandmate "Lucia"
    When I create the task "Book the rehearsal room" for Lucia with no due date
    Then Lucia can see the task as assigned to her
    And I can see it as a task I assigned
    And I see it as open

  Scenario: The assignee marks the task done
    Given I assigned "Book the rehearsal room" to Lucia
    When Lucia marks it done
    Then the task shows as done for Lucia and for me
    And the completion records when it was done

  Scenario: A task can carry a due date and shows when it is late
    Given I assigned "Send the setlist PDF" to Lucia due "2026-11-30"
    When the current date is past "2026-11-30" and the task is still open
    Then the task is marked overdue
    And marking it done clears overdue

  ──────────────────────────────────────────────
  WHO MAY DO WHAT
  ──────────────────────────────────────────────

  Scenario: I cannot assign a task to someone who is not an active bandmate
    Given "Pedro" is a pending bandmate invitation, not an active bandmate
    When I try to assign "Book the rehearsal room" to Pedro
    Then the assignment is refused
    And no task is created

  Scenario: A third party cannot see a task between two other people
    Given I assigned "Book the rehearsal room" to Lucia
    And Marco is neither the creator nor the assignee
    When Marco opens his tasks
    Then the task is not listed for him
    And he cannot read it by its id

  Scenario: The assignee cannot rewrite the task
    Given I assigned "Book the rehearsal room" to Lucia
    When Lucia changes the title, the due date, or the assignee
    Then the change is refused
    And the task keeps its title, due date and assignee

  Scenario: The creator withdraws a task
    Given I assigned "Book the rehearsal room" to Lucia
    When I withdraw the task
    Then it is no longer listed for Lucia or for me

  Scenario: Removing a bandmate does not erase the tasks already assigned
    Given I assigned "Book the rehearsal room" to Lucia
    When Lucia is removed from my bandmates
    Then the task is still readable by Lucia and by me
    And neither of us can create a new task for the other
