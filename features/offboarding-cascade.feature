Feature: Member Offboarding Cascade
  As an organization admin
  I want a leaving member's org access to end without touching their personal or public content
  So that leaving is clean, coordinated, and nothing is silently deleted

  ──────────────────────────────────────────────
  LEAVING THE ORG
  ──────────────────────────────────────────────

  Scenario: Leaving transitions the membership to "former"
    Given Sofia is an active member of "Academia Centro"
    When Sofia leaves the org
    Then her membership status becomes "former"
  Scenario: Nothing is deleted when a member leaves
    Given Sofia owns songs, versions, setlists, and practice sessions of her own
    When she leaves "Academia Centro"
    Then none of her personal content is deleted or hidden from her
    And removal happens only through an explicit deletion request

  ──────────────────────────────────────────────
  PERSONAL CONTENT AFTER LEAVING
  ──────────────────────────────────────────────

  Scenario: Personal annotations stay visible to the former member only
    Given Sofia added personal chord substitutions to "Song A" in the org repertoire
    When Sofia leaves the org
    Then her annotations stay visible and editable to her alone
  Scenario: A personal fork stays owned but leaves the org repertoire
    Given Sofia created the version "Canción W (Sofia's changes)" as a fork
    When Sofia leaves the org
    Then she keeps full ownership of the fork including the right to rebase
    And the fork is no longer listed for other org members
  Scenario: Owned gig records stay hers and remain read-only for the org
    Given Sofia completed the gig "Friday Gig" and shared it to the branch
    When Sofia leaves the org
    Then the gig and its performance record stay with her
    And org members keep read-only access to the completed gig

  ──────────────────────────────────────────────
  ORG COORDINATION
  ──────────────────────────────────────────────

  Scenario: Pending substitution requests are auto-cancelled
    Given Sofia's bass part has an open substitution request for the "Sunday 10am" service
    When Sofia leaves the org
    Then the request closes as cancelled
    And the leader is notified: "Sofia left — bass part uncovered"
  Scenario: A former member cannot be re-assigned
    Given Sofia's membership status is "former" in "Academia Centro"
    When the leader tries to assign Sofia to a service block
    Then the assignment is rejected with "Sofia is no longer a member"
    And she is excluded from new substitution candidate lists
  Scenario: Owned shared setlists are handed off to the org before leaving
    Given Sofia owns the shared setlist "Sunday Jam" used by the org
    When Sofia starts the leaving flow
    Then she transfers ownership to an active member before the leaving completes
    And the setlist stays with the org under its new owner

  ──────────────────────────────────────────────
  COMMUNITY CONTRIBUTIONS
  ──────────────────────────────────────────────

  Scenario: Public contributions keep attribution after leaving
    Given Sofia contributed "Song B" to the public library
    When she leaves "Academia Centro"
    Then the public entry keeps her as the contributor with attribution
  Scenario: A former member can still withdraw a public contribution
    Given Sofia left the org and contributed "Song B" publicly
    When she withdraws it from the library
    Then the song is removed from the public catalog, and copies already added by other users remain theirs