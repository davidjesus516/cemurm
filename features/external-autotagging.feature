Feature: External Auto-Tagging (Spotify)
  As a musician
  I want to enrich my own songs with album art, BPM, and key from Spotify
  So that my repertoire entries carry richer metadata without manual typing

  ──────────────────────────────────────────────
  ENRICHING A SONG
  ──────────────────────────────────────────────

  Scenario: Auto-fill a song's metadata from a Spotify match
    Given I have a song "Song A" with a title and artist
    When I ask the app to look it up on Spotify
    Then the app suggests album art, BPM, and key from the best match
    And I can preview the suggested values before applying

  Scenario: A poor match is not applied silently
    Given a song title matches nothing confidently on Spotify
    When I run the enrichment
    Then the app shows "No confident match — refine title or artist"
    And it does not write any metadata on its own

  Scenario: Rejecting a suggestion leaves the song unchanged
    Given the app suggests BPM 120 and key A for "Song A"
    When I choose "Discard" instead of "Apply"
    Then no metadata is written to the song
    And the song keeps its original metadata

  ──────────────────────────────────────────────
  APPLYING SUGGESTIONS
  ──────────────────────────────────────────────

  Scenario: Apply BPM and album art from the suggestion
    Given I accepted Spotify's match for "Song A"
    When the suggested BPM and album art are applied
    Then the song's metadata is updated
    And the applied values record a Spotify source for provenance

  Scenario: Auto-detected key is a suggestion, not the song's declared key
    Given the app suggests key E for "Song A" from Spotify
    When I apply it
    Then it is stored as suggested metadata
    And it does not override an explicit key declared on the chart

  Scenario: The key suggestion follows the equal-spelling model
    Given an explicit key on the chart is written in its preferred spelling
    When a Spotify key suggestion is applied
    Then the stored value still renders in the chart's canonical spelling
    And the two key sources never silently conflict

  ──────────────────────────────────────────────
  METADATA HYGIENE
  ──────────────────────────────────────────────

  Scenario: A song enriched from Spotify stays offline-first
    Given I enriched "Song A" and it is cached
    When I go offline
    Then the applied album art, BPM, and key remain available
    And no new Spotify call is made while offline

  Scenario: Disconnect from Spotify stops future enrichment
    Given I no longer want Spotify enrichment
    When I revoke the integration in settings
    Then no new songs can be enriched from Spotify
    And already-applied metadata remains on the songs

  Scenario: Enrichment adds provenance to the edited metadata
    Given "Song A" was enriched via Spotify
    When a bandmate edits its metadata later
    Then the change history shows the values were auto-filled from Spotify
    And manually corrected values are clearly marked as manual
