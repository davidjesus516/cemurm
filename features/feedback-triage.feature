Feature: Feedback Triage
  As a system administrator
  I want to review and triage in-app feedback
  So that bugs and suggestions are tracked and acted on

  Background:
    Given I am signed in to CEMURM

  @access
  Scenario: Regular user cannot access feedback triage
    Given I do not have the system_admin role
    When I navigate to the feedback triage page
    Then I see an access denied state

  @access
  Scenario: System admin can access feedback triage
    Given I have the system_admin role
    When I navigate to the feedback triage page
    Then I see the feedback inbox ordered by "newest first"

  @inbox
  Scenario: Inbox shows key information per item
    Given there is at least one feedback submission
    When I view the feedback inbox
    Then each row shows kind, status, message preview, screen, submitter context and created_at

  @filters
  Scenario: Filter by kind
    Given there are "Bug report" and "General feedback" items
    When I filter by "Bug report"
    Then only "Bug report" items are displayed

  @filters
  Scenario: Filter by status
    Given there are items with status "new", "triaged" and "closed"
    When I filter by "new"
    Then only "new" items are displayed

  @filters
  Scenario: Clear filters
    Given I have active filters
    When I clear them
    Then all feedback matching default view is shown

  @detail
  Scenario: View full feedback details
    Given I am viewing an item in the inbox
    When I open its detail panel
    Then I see full message, kind, screen, diagnostics if consented, user context, status, timestamps and GitHub link if exists

  @triage
  Scenario: Mark item as triaged
    Given an item with status "new"
    When I change its status to "triaged"
    Then the status updates and updated_at/updated_by are recorded

  @triage
  Scenario: Mark item as closed
    Given an item with status "triaged"
    When I change its status to "closed"
    Then the status updates and updated_at/updated_by are recorded

  @triage
  Scenario: Reopen a closed item
    Given an item with status "closed"
    When I change its status to "triaged"
    Then the status updates accordingly

  @github
  Scenario: Promote a feedback item to a GitHub issue
    Given an item with status "new" and no linked GitHub issue
    When I click "Promote to GitHub Issue"
    Then a GitHub issue is created with relevant context
    And the item is linked with github_issue_number and github_issue_url
    And the item status becomes "triaged"

  @github
  Scenario: View existing GitHub issue
    Given an item already promoted to GitHub issue #123
    When I view its detail panel
    Then I see a link to "https://github.com/davidjesus516/cemurm/issues/123"
    And the "Promote to GitHub Issue" action is hidden

  @safety
  Scenario: Diagnostics only shown if present and consented
    Given a bug report submitted without diagnostics consent
    When I view its details
    Then no diagnostics section is shown
