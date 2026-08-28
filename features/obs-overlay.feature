Feature: OBS Overlay for Streaming
  As a musician who streams live
  I want a clean OBS Browser Source overlay
  So that my stream shows the current song and chords without my control interface

  ──────────────────────────────────────────────
  ENABLING THE OVERLAY
  ──────────────────────────────────────────────

  Scenario: Enable the OBS overlay
    Given I am streaming my performance
    When I enable the OBS Browser Source overlay
    Then the app exposes a stable overlay URL for OBS
    And the URL is valid only while I authorize the stream session

  Scenario: The overlay URL is bound to the current performance
    Given I enabled the overlay for setlist "Friday Gig"
    When someone opens the overlay URL outside my session
    Then the overlay shows nothing or an "inactive" state
    And no song data leaks outside the authorized stream

  ──────────────────────────────────────────────
  OVERLAY CONTENT
  ──────────────────────────────────────────────

  Scenario: Overlay shows the current song title
    Given the overlay is active during "Song A"
    When the viewer watches the stream
    Then the overlay displays the song title prominently
    And it updates when I advance to another song

  Scenario: Overlay shows the current chord chart on demand
    Given the overlay is active
    When the override switches the overlay from "title only" to "chords"
    Then the current chord chart renders on the overlay
    And performer annotations and control chrome never appear

  Scenario: Overlay reflects the screen position in the setlist
    Given I am performing song 3 of 6
    When the viewer sees the overlay
    Then a compact "3 / 6" indicator is shown
    And advancing to song 4 updates the indicator

  ──────────────────────────────────────────────
  OVERLAY PRIVACY & SCOPE
  ──────────────────────────────────────────────

  Scenario: Personal annotations never leak to the overlay
    Given I have a personal annotation on "Song A"
    And the overlay is showing "Song A"
    Then the annotation is not rendered on the overlay
    And only content I allow for the audience is shown

  Scenario: Overlay follows the setlist, not the operator's private notes
    Given I have private margin notes in performance mode
    When the overlay is active
    Then the notes are excluded
    And the overlay shows only title, chords, and setlist position

  Scenario: The overlay can be disabled mid-stream
    Given the overlay is broadcasting
    When I disable the overlay during the stream
    Then the Browser Source URL immediately serves an inactive state
    And no further song data is pushed to that URL
