Feature: External Display Output
  As a performer with a dual-screen setup
  I want to mirror Performance Mode to a second display
  So that I can see my charts on one screen and share a clean view on another

  ──────────────────────────────────────────────
  CONNECTING A SECOND DISPLAY
  ──────────────────────────────────────────────

  Scenario: Request a second display for performance
    Given I am in Performance Mode
    When I open the display output menu and request a second screen
    Then the app opens a full-screen presentation on the second display
    And the primary device keeps the full setlist navigator and controls

  Scenario: No second screen available falls back to a preview
    Given only the primary display is connected
    When I request the external display
    Then the app shows a preview window on the same screen
    And labels it "External display preview"

  Scenario: Disconnect the second display during the show
    Given the external display is active
    When the second screen disconnects mid-show
    Then the primary device continues with all controls intact
    And the app offers to re-open the external display when it reconnects

  ──────────────────────────────────────────────
  WHAT THE EXTERNAL DISPLAY SHOWS
  ──────────────────────────────────────────────

  Scenario: External display shows a clean audience-facing view
    Given the external display is active on "Song A"
    When the audience looks at the screen
    Then it shows the current song title and lyrics
    And it does not show the app chrome, controls, or performer annotations

  Scenario: External display follows the current song
    Given the external display is showing song 2
    When I advance to song 3 on the primary device
    Then the external display updates to song 3 in sync
    And the transition matches the performance on the primary device

  Scenario: External display vs congregation projection are separate targets
    Given I have both an operator-led congregation projection and a personal external display
    When I use the external display during my own performance
    Then the external display follows my performance view
    And it does not reconnect or override the congregation projection target

  ──────────────────────────────────────────────
  DISPLAY CONTROL & PREFERENCES
  ──────────────────────────────────────────────

  Scenario: Choose what the external display shows
    Given the external display is active
    When I switch its mode from "Lyrics" to "Chords"
    Then the external screen renders chord charts instead of lyrics
    And the primary device control for that mode updates

  Scenario: Apply the performer's personal transpose to the external display
    Given I have a personal transpose offset of +2
    When the external display shows "Song A"
    Then the chords appear transposed by +2
    And the canonical arrangement on disk stays unchanged

  Scenario: External display settings persist for the next gig
    Given I configured an external display for "Friday Gig"
    When I open the same setlist next week
    Then the external display settings are restored
    And I can re-launch the second screen with one tap

  ──────────────────────────────────────────────
  OFFLINE & ROBUSTNESS
  ──────────────────────────────────────────────

  Scenario: External display works offline
    Given I have the setlist cached and the external display connected
    When I lose connectivity mid-show
    Then the second display keeps showing the current song
    And both displays continue in sync without network

  Scenario: External display recovers after the performance app restarts
    Given the app restarted after a crash during performance
    When I re-enter Performance Mode
    Then I am prompted to re-launch the external display on the second screen
    And the last active song is shown again
