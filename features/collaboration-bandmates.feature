Feature: Collaboration — Bandmate Management
  As a musician
  I want to add bandmates to my shared repertoire and setlists
  So that we can coordinate performances and share arrangements

  ──────────────────────────────────────────────
  ONLINE FLOWS
  ──────────────────────────────────────────────

  Scenario: Search and add a bandmate by username (online)
    Given I am logged in
    And I am on the bandmates management screen
    When I search for username "julian.guitar"
    Then I see a suggestion for user "Julian" with username "julian.guitar"
    When I tap "Add to Band"
    And Julian accepts the invitation
    Then Julian appears as a bandmate in my collaboration list
    And the shared setlists are visible to Julian

  Scenario: Search and add a bandmate by email (online)
    Given I am logged in
    And I am on the bandmates management screen
    When I search for email "mateo@band.com"
    Then I see a user result for Mateo with email "mateo@band.com"
    When I tap "Invite"
    Then Mateo receives an invitation notification
    And Mateo appears as a "pending" bandmate until accepted

  Scenario: Add a bandmate by unique user ID (online)
    Given I am logged in
    And I have a bandmate's unique user ID "USR-8a7f3c"
    When I navigate to the "Add by ID" option
    And I enter "USR-8a7f3c"
    Then the app resolves the user and shows their profile
    When I confirm the invitation
    Then the user is added as a bandmate

  Scenario: Invitation pending — bandmate accepts online
    Given I have invited "Lucia" as a bandmate
    And Lucia's status is "pending"
    When Lucia opens the app
    And Lucia accepts the invitation
    Then Lucia's status changes to "active"
    And shared setlists sync to Lucia's device

  Scenario: Invitation pending — bandmate declines online
    Given I have invited "Lucia" as a bandmate
    When Lucia declines the invitation
    Then Lucia's status becomes "declined"
    And I receive a notification that Lucia declined

  ──────────────────────────────────────────────
  OFFLINE FLOWS — Proximity / Pending Mode
  ──────────────────────────────────────────────

  Scenario: Both bandmates offline — generate a shareable proximity code
    Given I am logged in
    And I have bandmate "Marco" nearby (both offline)
    When I tap "Add nearby bandmate"
    Then the app generates a one-time proximity code "CEM-7X2K9P"
    And I share the code with Marco

  Scenario: Bandmate accepts proximity code while still offline
    Given Marco received the proximity code "CEM-7X2K9P"
    And Marco opens the app (still offline)
    When Marco enters the code "CEM-7X2K9P"
    Then Marco is added as a "pending" bandmate
    And the app queues the sync for when connectivity is restored

  Scenario: Proximity sync completes when both go online
    Given Marco and I both added each other as pending bandmates via proximity code
    When Marco connects to the internet
    And I connect to the internet
    Then the pending invitations are exchanged
    And both of us see each other as active bandmates
    And all shared setlists sync bidirectionally

  Scenario: Pending bandmate goes online after long offline period
    Given I shared a setlist with a pending bandmate "Ana"
    And Ana was offline for 3 weeks
    When Ana comes online and accepts the invitation
    Then Ana receives the full setlist history
    And the app shows a "synced 14 items" summary

  ──────────────────────────────────────────────
  EDGE CASES & VALIDATION
  ──────────────────────────────────────────────

  Scenario: Cannot add yourself as a bandmate
    Given I am logged in
    When I search for my own username
    Then the result is excluded from the list
    And I see a message "You cannot add yourself"

  Scenario: Cannot add a non-existent user
    Given I search for username "nonexistent.user.99"
    Then no results are found
    And I see "No user found with that username"

  Scenario: Cannot add a bandmate who already exists
    Given "Julian" is already an active bandmate
    When I search for "julian.guitar"
    Then I see Julian in the results
    And the "Add" button is disabled with label "Already in band"

  Scenario: Proximity code expires after 24 hours
    Given I generated a proximity code "CEM-7X2K9P"
    When 25 hours pass
    Then the code "CEM-7X2K9P" is no longer valid
    And I must generate a new code to add the bandmate

  Scenario: Inviting offline bandmate while other bandmate is already active
    Given I have one active bandmate "Julian" and one pending "Marco" (offline)
    When I create a shared setlist
    Then Julian sees the setlist immediately
    And Marco receives a pending notification for the setlist
    When Marco comes online
    Then Marco sees the setlist synced

  Scenario: Bandmate revoked — pending invitation auto-cancelled
    Given I invited "Lucia" but then removed her from bandmates
    When Lucia tries to accept the invitation
    Then the app shows "This invitation is no longer valid"
