Feature: Community Moderation
  As a system-appointed community moderator
  I want to review reports on public-library entries and decide keep, remove, or escalate
  So that the shared public library stays compliant and trustworthy

  ──────────────────────────────────────────────
  MODERATOR ROLE & ACCESS
  ──────────────────────────────────────────────

  Scenario: Community moderators are appointed at the system level
    Given the system admin appoints Marta as a community moderator
    When Marta opens the moderation queue
    Then Marta sees the pending reports for the public library
    And her moderation tools apply across the public library regardless of organization

  Scenario: Org admins do not get community moderation powers
    Given Carlota is an admin of the organization "Academia Musical"
    And Carlota is not appointed as a community moderator
    When Carlota opens the admin dashboard
    Then she sees no community moderation queue
    And her admin power is limited to her own organization's repertoire

  Scenario: The moderation queue covers the public library only
    Given Marta is a community moderator
    And an organization is preparing a private review of its own repertoire
    When Marta opens the moderation queue
    Then the queue shows only public-library entries
    And no entry from an organization's private or org-level repertoire appears

  ──────────────────────────────────────────────
  REPORT INTAKE (REPORTER SIDE)
  ──────────────────────────────────────────────

  Scenario: Any user can report a public-library entry with a reason category
    Given Juan finds a public entry that appears to violate copyright
    When Juan reports it with the reason category "copyright violation"
    Then the report is queued for moderation
    And the same entry can also be reported for "offensive content", "spam/duplicate", or "wrong metadata"
    And the entry remains visible until a moderator reviews it

  Scenario: The reporter gets a confirmation that the report is queued
    Given Juan has submitted a report on a public entry
    When Juan closes the report dialog
    Then Juan sees a confirmation that the report is queued for moderation
    And Juan cannot file another report for the same grounds on the same entry

  Scenario: The reporter's identity is hidden from the contributor
    Given Lucia reports a public entry contributed by Carlos
    When the report enters the moderation queue
    Then Carlos never learns who filed the report
    And only the moderator sees the reporter identity

  ──────────────────────────────────────────────
  QUEUE & CONSOLIDATION
  ──────────────────────────────────────────────

  Scenario: Pending reports group by entry with reasons and reporter counts
    Given multiple users report the same public entry
    When Marta opens the moderation queue
    Then pending reports appear grouped by entry
    And each group lists the reason categories and the count of reporters
    And all reports on the same entry consolidate into one moderatable case

  Scenario: Already-decided entries do not re-enter the queue for the same grounds
    Given a public entry was already reviewed and kept
    When another report arrives for the same entry on the same grounds
    Then the report does not create a new moderation case
    And the entry is not re-queued for those grounds

  ──────────────────────────────────────────────
  DECISION: KEEP
  ──────────────────────────────────────────────

  Scenario: A "keep" decision closes the case and notifies the reporter
    Given a public song was reported but found to be compliant
    When Marta reviews the entry and decides to keep it
    Then the entry remains public unchanged
    And the report is closed
    And the reporter is notified of the outcome

  ──────────────────────────────────────────────
  DECISION: REMOVE
  ──────────────────────────────────────────────

  Scenario: A confirmed violation removes the entry and notifies both parties
    Given a public entry is reported for a confirmed copyright violation
    When Marta reviews it and decides to remove it
    Then the entry is removed from the public library
    And the contributor is notified with the reason
    And the reporter is notified of the outcome
    And the decision records decider Marta, the date, and the reason
    And that decision is not editable later — it is reversed only through appeal

  ──────────────────────────────────────────────
  DECISION: ESCALATE
  ──────────────────────────────────────────────

  Scenario: Complex licensing matters escalate to a system admin
    Given a public entry is reported for a complex copyright or licensing issue
    When Marta cannot resolve the grounds confidently
    Then Marta escalates the case to a system admin
    And the case leaves the moderator-only queue until the system admin decides

  ──────────────────────────────────────────────
  TAKEDOWN PROPAGATION
  ──────────────────────────────────────────────

  Scenario: Removing a public entry breaks only linked copies
    Given Carlos forked a public entry and kept it linked
    And Maria imported the same public entry as her own standalone copy
    When the public entry is removed
    Then Carlos's linked copy loses its link and is flagged as unlinked
    And Maria's standalone copy is not touched — it remains her own data
    And Carlos's forked copy keeps its content but loses the upstream link and provenance badge

  ──────────────────────────────────────────────
  APPEALS
  ──────────────────────────────────────────────

  Scenario: An appeal is reviewed by a different moderator, never the original decider
    Given Carlos's public entry was removed by Marta
    And Carlos files an appeal with a reason
    When the appeal is assigned for review
    Then a different moderator or a system admin reviews it
    And the original decider Marta never reviews her own appeal

  Scenario: A successful appeal reinstates the entry with its prior history
    Given an appeal against a removal is upheld
    When the reviewing moderator decides to reinstate
    Then the entry is restored to the public library with its previous history
    And the contributor and the reporter are both notified of the reinstatement

  Scenario: An unsuccessful appeal is final at the in-app level
    Given a reviewing moderator upholds the removal after appeal
    When Carlos asks for another in-app review
    Then no further in-app appeal level is offered

  ──────────────────────────────────────────────
  OFFLINE (REPORTER SIDE)
  ──────────────────────────────────────────────

  Scenario: Filing a report works offline and queues for sync
    Given Juan is offline
    When Juan reports a public entry
    Then the report is saved locally with a "pending sync" flag
    And when Juan reconnects the report syncs to the moderation queue
    And the "pending sync" flag is cleared

  Scenario: Moderation decisions are online-only
    Given Marta is offline
    When Marta tries to open the moderation queue and decide a case
    Then Marta cannot process decisions while offline — decisions require a connection
    And pending cases remain untouched until she is back online

  ──────────────────────────────────────────────
  NON-GOALS
  ──────────────────────────────────────────────

  Scenario: No automation, voting, legal machinery, auto-ban, or cross-org moderation
    Given a moderator reviews the moderation feature set
    When the moderator looks for additional enforcement options
    Then no auto-removal bot or content-scanning automation exists
    And no public-vote moderation exists — decisions are made by moderators
    And no built-in legal-process or DMCA-integration machinery is offered
    And a report alone never auto-bans a user — restriction follows confirmed violations
    And community moderation never touches org or private repertoire — each org manages its own
