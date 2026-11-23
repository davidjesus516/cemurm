# Assignable Tasks Specification

## Purpose

A minimal way to hand one piece of work to one collaborator, from `features/assignable-tasks.feature`: assign a titled task with an optional due date to an active bandmate, let the assignee complete or reopen it, and let the creator withdraw it. The capability is deliberately one table and no projects, lists, comments, priorities or attachments.

## Requirements

### Requirement: Assignment is limited to active bandmates

A task MUST be creatable only by its creator, MUST name exactly one assignee, MUST NOT allow self-assignment, and MUST require an `active` `bandmate_links` edge between the two people in either direction.

#### Scenario: Assign to an active bandmate

- GIVEN "Lucia" is an active bandmate of mine
- WHEN I create "Book the rehearsal room" for her with no due date
- THEN she sees the task as assigned to her, I see it as assigned by me, and it is open

#### Scenario: A pending or absent bandmate is refused

- GIVEN "Pedro" is a pending invitation, not an active bandmate
- WHEN I try to assign him a task
- THEN the assignment is refused and no task is created

#### Scenario: Self-assignment is refused

- GIVEN I am creating a task
- WHEN I choose myself as the assignee
- THEN the assignment is refused and no task is created

### Requirement: Only the two parties can read a task

A task MUST be visible to its creator and its assignee and to nobody else, including members of a shared organization.

#### Scenario: A third party sees nothing

- GIVEN I assigned a task to Lucia
- AND Marco is neither party
- WHEN Marco opens his tasks
- THEN the task is not listed for him and cannot be read by its id

### Requirement: Completion belongs to the assignee

The assignee MUST be able to set `status` to `done` or back to `open`, and completion MUST record when it happened. The creator MUST NOT be able to complete or reopen the task, and the assignee MUST NOT be able to change the title, due date or assignee.

#### Scenario: The assignee completes the task

- GIVEN Lucia has a task assigned to her
- WHEN she marks it done
- THEN the task is done for both of us and the completion timestamp is recorded

#### Scenario: The creator cannot complete it, the assignee cannot rewrite it

- GIVEN I assigned a task to Lucia
- WHEN I mark it done, or Lucia changes its title, due date or assignee
- THEN the write is refused and the task keeps its fields and status

### Requirement: Withdrawal and lateness

The creator MUST be able to withdraw (delete) a task; the assignee and third parties MUST NOT. An open task whose due date is strictly before today MUST present as overdue, and completion MUST clear that presentation.

#### Scenario: The creator withdraws the task

- GIVEN I assigned a task to Lucia
- WHEN I withdraw it
- THEN it is no longer listed for her or for me

#### Scenario: An open task past its due date is overdue

- GIVEN a task is due "2026-11-30" and still open
- WHEN the current date is past "2026-11-30"
- THEN the task is marked overdue, and marking it done clears the mark

### Requirement: Removing a bandmate freezes, not erases

Removing the bandmate edge MUST leave existing tasks readable and completable by both parties, and MUST refuse any new assignment between the pair.

#### Scenario: Removal keeps the work that already exists

- GIVEN I assigned a task to Lucia
- WHEN Lucia is removed from my bandmates
- THEN the task remains readable by both of us, and a new assignment between us is refused
