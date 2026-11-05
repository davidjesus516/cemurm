# Feedback Triage Specification

## ADDED Requirements

### Requirement: System admin access only
The system SHALL restrict access to the feedback triage interface to users with the `system_admin` role in `public.user_roles`.

#### Scenario: Regular user cannot access feedback triage
- **GIVEN** I am signed in as a regular user without the `system_admin` role
- **WHEN** I navigate to the feedback triage page
- **THEN** I see an access denied state

#### Scenario: System admin can access feedback triage
- **GIVEN** I am signed in as a system_admin
- **WHEN** I navigate to the feedback triage page
- **THEN** I see the feedback inbox ordered by newest first

### Requirement: Feedback inbox
The system SHALL display an inbox of all in-app feedback submissions ordered by `created_at` descending by default.

#### Scenario: Inbox shows key information per item
- **GIVEN** there is at least one feedback submission
- **WHEN** I view the feedback inbox
- **THEN** each row shows kind, status, message preview, screen, submitter context and created_at

### Requirement: Filtering
The system SHALL allow filtering the inbox by kind and status.

#### Scenario: Filter by kind
- **GIVEN** there are "Bug report" and "General feedback" items
- **WHEN** I filter by "Bug report"
- **THEN** only "Bug report" items are displayed

#### Scenario: Filter by status
- **GIVEN** there are items with status "new", "triaged" and "closed"
- **WHEN** I filter by "new"
- **THEN** only "new" items are displayed

#### Scenario: Clear filters
- **GIVEN** I have active filters
- **WHEN** I clear them
- **THEN** all feedback matching default view is shown

### Requirement: Feedback detail view
The system SHALL show full details of a feedback item in a detail panel.

#### Scenario: View full feedback details
- **GIVEN** I am viewing an item in the inbox
- **WHEN** I open its detail panel
- **THEN** I see full message, kind, screen, diagnostics if consented, user context, status, timestamps and GitHub link if exists

### Requirement: Triage status changes
The system SHALL allow system_admin to update feedback status between `new`, `triaged`, and `closed`, recording audit information.

#### Scenario: Mark item as triaged
- **GIVEN** an item with status "new"
- **WHEN** I change its status to "triaged"
- **THEN** the status updates and updated_at/updated_by are recorded

#### Scenario: Mark item as closed
- **GIVEN** an item with status "triaged"
- **WHEN** I change its status to "closed"
- **THEN** the status updates and updated_at/updated_by are recorded

#### Scenario: Reopen a closed item
- **GIVEN** an item with status "closed"
- **WHEN** I change its status to "triaged"
- **THEN** the status updates accordingly

### Requirement: Promote to GitHub Issue
The system SHALL allow promoting a feedback item to a GitHub issue via a server-side Edge Function, linking the issue back to the feedback item.

#### Scenario: Promote a feedback item to a GitHub issue
- **GIVEN** an item with status "new" and no linked GitHub issue
- **WHEN** I click "Promote to GitHub Issue"
- **THEN** a GitHub issue is created with relevant context
- **AND** the item is linked with github_issue_number and github_issue_url
- **AND** the item status becomes "triaged"

#### Scenario: View existing GitHub issue
- **GIVEN** an item already promoted to GitHub issue #123
- **WHEN** I view its detail panel
- **THEN** I see a link to "https://github.com/davidjesus516/cemurm/issues/123"
- **AND** the "Promote to GitHub Issue" action is hidden

### Requirement: Diagnostics privacy
The system SHALL only display diagnostics when they are present on the feedback item (respecting client consent).

#### Scenario: Diagnostics only shown if present and consented
- **GIVEN** a bug report submitted without diagnostics consent
- **WHEN** I view its details
- **THEN** no diagnostics section is shown
