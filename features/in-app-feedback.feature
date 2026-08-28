Feature: In-App Feedback and Bug Reporting
  As a beta user
  I want to send feedback or report a bug from inside the app
  So that I can report issues without leaving CEMURM

  ──────────────────────────────────────────────
  SUBMITTING FEEDBACK
  ──────────────────────────────────────────────

  Scenario: Open the in-app feedback form
    Given I have the app open
    When I open the feedback button from the main menu
    Then a feedback form appears
    And I can choose between "Bug report" and "General feedback"

  Scenario: Submit general feedback
    Given I am on the feedback form
    When I choose "General feedback" and write "I love the setlist view"
    Then my feedback is submitted with my account
    And I see a confirmation "Thanks, your feedback was sent"

  Scenario: Submit a bug report with a description
    Given I am on the feedback form
    When I choose "Bug report"
    And I describe the problem and which screen it happened on
    Then the bug report is submitted with the screen context
    And I can attach a screenshot before sending

  Scenario: Submit feedback while logged out lists issues instead
    Given I am not logged in
    When I open the feedback form
    Then the app shows the public issue tracker URL instead of a live form
    And explains I must be signed in to attach account context

  ──────────────────────────────────────────────
  CONSENT & CONTEXT
  ──────────────────────────────────────────────

  Scenario: Explicit consent before attaching diagnostic data
    Given I am about to submit a bug report
    When the app asks if it may attach device info and logs
    Then my report includes diagnostics only after I consent
    And without consent the report sends without device details

  Scenario: A reported bug can defer an action
    Given I found a crashing bug and reported it
    When I submit the report
    Then I am not interrupted with a blocking action
    And the app keeps working after the report is sent

  ──────────────────────────────────────────────
  SUBMISSION STATE
  ──────────────────────────────────────────────

  Scenario: Feedback queues offline and sends on reconnect
    Given I am offline
    When I submit a bug report
    Then the report is saved locally with a "pending" flag
    And it sends automatically once I reconnect

  Scenario: Feedback submission failure is surfaced
    Given the feedback service is unreachable
    When I submit a report
    Then the app shows "Could not send, retry or copy your text"
    And my draft text is not lost
