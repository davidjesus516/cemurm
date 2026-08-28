Feature: MIDI Integration (Program Change)
  As a performer using external gear
  I want CEMURM to send MIDI program change messages
  So that switching songs in performance also switches my pedalboard or synth patches

  ──────────────────────────────────────────────
  CONNECTING MIDI
  ──────────────────────────────────────────────

  Scenario: Connect a Web MIDI device
    Given I am on the performance settings screen
    When I grant Web MIDI access
    Then the app lists the available MIDI input and output devices
    And I can select the output device that should receive program changes

  Scenario: Denying MIDI permission leaves integrations disabled
    Given MIDI support is available in the browser
    When I deny the MIDI permission prompt
    Then no MIDI output is configured
    And performance mode continues working without MIDI

  Scenario: No MIDI support in the browser degrades gracefully
    Given the browser does not support Web MIDI
    When I open the MIDI settings
    Then the app shows "MIDI is not supported in this browser"
    And the MIDI section is disabled without breaking performance mode

  ──────────────────────────────────────────────
  PROGRAM CHANGE BEHAVIOR
  ──────────────────────────────────────────────

  Scenario: Send a program change when advancing songs
    Given I configured an output device and mapped song 3 to Program Change 45
    When I advance from song 2 to song 3 in performance mode
    Then the app sends a Program Change (CC) message with value 45 to the output device
    And the pedalboard switches to the patch for song 3

  Scenario: Map a program change to a song
    Given I have a setlist with "Song A" and "Song B"
    When I assign Program Change 12 to "Song A"
    Then "Song A" retains its MIDI program mapping
    And the mapping is saved with the setlist

  Scenario: Songs without a mapping send no program change
    Given "Song B" has no MIDI program mapped
    When I advance to "Song B" in performance mode
    Then no program change is sent
    And the last program change is not repeated

  Scenario: Return to a previous song re-sends its program change
    Given "Song A" maps to Program Change 12 and "Song B" maps to 20
    When I go back from "Song B" to "Song A"
    Then the app sends Program Change 12 again
    So that the gear returns to the correct patch

  ──────────────────────────────────────────────
  MIDI SETLIST PLANNING
  ──────────────────────────────────────────────

  Scenario: Define MIDI programs when building a setlist
    Given I am editing setlist "Friday Gig"
    When I open MIDI mapping for the setlist
    Then I can assign a program change per song
    And unassigned songs are marked "No patch"

  Scenario: A setlist-level MIDI map is reused across gigs
    Given I built a MIDI map for setlist "Friday Gig"
    When I duplicate the setlist
    Then the duplicate carries the same MIDI mappings
    And I can edit them without affecting the original

  ──────────────────────────────────────────────
  ROBUSTNESS & SCOPE
  ──────────────────────────────────────────────

  Scenario: MIDI is not required for offline performance
    Given I am performing offline
    When my instrument patches are stored on the synth itself
    Then MIDI program changes are optional and their absence does not block playback

  Scenario: Transposing or capo does not alter the MIDI program mapping
    Given "Song A" maps to Program Change 12
    When I transpose "Song A" during the performance
    Then the program change for the song stays 12
    And only the rendered chords change, not the MIDI mapping
