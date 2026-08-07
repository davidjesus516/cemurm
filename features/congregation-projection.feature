Feature: Congregation Projection
  As a service operator
  I want a lyrics-only display for the congregation, controlled from my device
  So that everyone can sing along while the band sees chords on their own screens

  ──────────────────────────────────────────────
  PROJECTION SESSION
  ──────────────────────────────────────────────

  Scenario: Start projection from the service plan
    Given the "Worship" block lists "Song A", "Song B", and "Song C"
    When I start projection on the congregation display
    Then the display shows the first song's title slide
    And the display follows the "Worship" block order

  Scenario: Congregation display is lyrics only
    Given I am projecting "Song A"
    When the operator views the same song on their device
    Then the congregation display shows lyrics and slide titles
    And it does not show chords, keys, rehearsal notes, or controls

  Scenario: Projection and audience phone view are separate targets
    Given a congregation member opened the QR audience view on their phone
    And the operator starts projection on the screen
    When the operator changes the song
    Then the screen shows the new song
    And the phone audience view still lists the setlist without following the operator

  Scenario: Operator controls slides from their device
    Given the projection is running on the screen
    When the operator taps "Next" on their device
    Then the screen advances one slide
    And the operator's device shows the same slide index

  Scenario: Multiple displays run in sync
    Given a venue has a projector and a TV
    When the operator starts projection
    Then both displays show the same slide
    And a temporary "connection lost" indicator appears if one display drops

  ──────────────────────────────────────────────
  SLIDE CONTROL & CONTENT
  ──────────────────────────────────────────────

  Scenario: Slides follow the lyric sections
    Given "Song A" has sections Verse 1, Chorus, Verse 2, Chorus, Bridge
    When projection reaches the song
    Then the display shows one slide per section in order

  Scenario: Advance and back through slides
    Given the display is showing Verse 1 of "Song A"
    When the operator presses "Next" and then "Back"
    Then the display returns to Verse 1
    And the slide index matches the operator's device

  Scenario: Bible verse slide between songs
    Given the service plan includes a scripture reading after "Song A"
    When the operator inserts the scripture slide
    Then the display shows the verse text centered
    And the next song starts after the operator advances

  Scenario: Custom announcement slide
    Given the operator adds an announcement slide
    When the announcement is shown
    Then the display shows the custom text
    And the slide is stored with the service plan

  Scenario: Next song begins with a title slide
    Given the display finished "Song A"
    When the operator advances to "Song B"
    Then the display shows "Song B" as a title slide
    And lyrics appear on the next advance

  Scenario: Live typo fix updates the displayed slide
    Given the congregation sees "Halelujah" due to a typo
    When the operator fixes the lyric text on their device
    Then the displayed slide updates to "Hallelujah"
    And the chart edit creates a version entry (editor, timestamp, "Fixed lyric typo")

  ──────────────────────────────────────────────
  ACCESSIBILITY & READABILITY
  ──────────────────────────────────────────────

  Scenario: High-contrast projection mode
    Given the venue lighting is bright
    When the operator enables high contrast mode
    Then the display uses a high-contrast palette (light text on dark background)
    And the palette is color-blind-safe

  Scenario: Font scale adapts to the venue
    Given a large venue with a distant screen
    When the operator increases the font scale
    Then the lyrics render larger without breaking line layout
    And the setting persists for the next service

  ──────────────────────────────────────────────
  RIGHTS & LICENSING
  ──────────────────────────────────────────────

  Scenario: Song without projection rights is blocked
    Given "Song C" is licensed as "Proprietary (private only)"
    When the operator tries to project "Song C"
    Then the display shows "Not licensed for public projection"
    And the block is logged for the operator

  Scenario: Licensed organization projects approved songs
    Given the organization has a projection license
    And "Song A" and "Song B" are covered by that license
    When the operator starts projection
    Then "Song A" and "Song B" project normally
    And "Song C" (not covered) remains blocked

  Scenario: Personal annotations never leak to the display
    Given Juan has a personal annotation on "Song A"
    When the congregation display shows "Song A"
    Then the annotation is not rendered
    And personal chord substitutions are not rendered either

  ──────────────────────────────────────────────
  ROBUSTNESS & OFFLINE
  ──────────────────────────────────────────────

  Scenario: Projection keeps running offline
    Given the venue has no internet
    When the operator starts projection
    Then the display renders all cached slides without errors
    And the operator can navigate normally

  Scenario: Display reconnects and resumes at the last slide
    Given the projector display lost connection during "Song B"
    When the display reconnects
    Then it resumes at the last shown slide
    And no manual resync is needed

  Scenario: Operator app recovers from a crash
    Given the operator app crashed while the display showed "Song A"
    When the operator reopens the app
    Then the app resumes the projection at the same slide
    And the display is not left on a stale screen
