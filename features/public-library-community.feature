Feature: Public Library & Community
  As a musician
  I want to discover and contribute songs in a shared public library
  So that I can find new arrangements and share mine with the community

  ──────────────────────────────────────────────
  BROWSING THE PUBLIC LIBRARY
  ──────────────────────────────────────────────

  Scenario: Browse the public library catalog
    Given the public library is populated
    When I open the Public Library
    Then I can browse a catalog of community-contributed songs
    And each entry shows title, artist, genre, and contributor

  Scenario: Add a public song to my repertoire
    Given I find "Amazing Grace" in the public library
    When I add it to my repertoire
    Then a copy is added to my library where I can edit it
    And the original public entry and its contributor remain unchanged

  Scenario: Search the public library
    Given the public library contains many songs
    When I search it by title or genre
    Then matching public songs are returned
    And results include the contributor for attribution

  Scenario: Filter the public library by license status
    Given the public library mixes public domain and community songs
    When I filter by "public domain"
    Then only public domain songs are shown
    And licensed songs are hidden from that view

  ──────────────────────────────────────────────
  CONTRIBUTING SONGS
  ──────────────────────────────────────────────

  Scenario: Contribute a song to the public library
    Given I have a chart for "Song A" in ChordPro
    When I contribute it to the public library
    Then the song is published with me as the contributor
    And the entry records its source attribution and license

  Scenario: License confirmation is required before publishing
    Given I am about to contribute "Song A"
    When I confirm I hold the right to share it under the chosen license
    Then the contribution is accepted
    And without that confirmation the contribution is blocked

  Scenario: Contribution keeps lineage to the source arrangement
    Given I contributed a fork of a community arrangement
    When the new song is published
    Then the public entry records its lineage back to the source
    And other users can see it is a derivative

  Scenario: Edit my own public contribution
    Given I contributed "Song A" to the public library
    When I submit an updated chart
    Then the public entry is updated to the new version
    And the change history of the entry is preserved

  Scenario: Withdraw my own contribution
    Given I contributed "Song A" and no longer want it public
    When I withdraw it from the library
    Then the song is removed from the public catalog
    And copies already added to other users' repertoires remain theirs

  ──────────────────────────────────────────────
  FOLLOW & PROFILES
  ──────────────────────────────────────────────

  Scenario: View a contributor's public profile
    Given a musician has contributed several songs
    When I visit their public profile
    Then I see their published songs and curated collections
    And I do not see their private repertoire

  Scenario: Follow another musician
    Given I find a musician I like
    When I follow them
    Then their new public contributions appear in my discovery feed
    And I can unfollow them at any time

  Scenario: Follow and unfollow are reversible
    Given I follow a musician
    When I unfollow them
    Then their contributions stop appearing in my feed
    And my visible follower action is removed

  ──────────────────────────────────────────────
  REPUTATION & REPORTING
  ──────────────────────────────────────────────

  Scenario: Basic reputation reflects contribution activity
    Given a musician has contributed songs and curated collections
    When I view their profile
    Then a reputation summary shows their contribution and curation counts
    And the counts are derived from public, verifiable activity

  Scenario: Report an inappropriate public contribution
    Given a public song violates the content policy
    When I report it with a reason
    Then the report is queued for moderation
    And the song remains visible until a moderator reviews it

  Scenario: A reported contributor is rate-limited
    Given a contributor accumulates multiple confirmed violations
    When moderation confirms the violations
    Then the contributor's publishing is restricted
    And existing accepted contributions remain but no new ones are accepted

  ──────────────────────────────────────────────
  COMMUNITY CONSISTENCY
  ──────────────────────────────────────────────

  Scenario: Public song references stay live for subscribers
    Given I follow a contributor who added "Song A"
    When their public chart for "Song A" is updated
    Then the update is reflected in my copy only if I keep it linked
    And unlinked copies stay exactly as I last saved them
