Feature: Foot Pedal Navigation (USB HID)
  As a performer
  I want to control Performance Mode with a USB foot pedal
  So that I can navigate songs hands-free while playing

  ──────────────────────────────────────────────
  CONNECTING THE PEDAL
  ──────────────────────────────────────────────

  Scenario: Pair a supported USB foot pedal
    Given I am on the performance settings screen
    When I plug a USB foot pedal and grant HID access
    Then the app detects the pedal and shows "Foot pedal connected"
    And the pedal is listed with its vendor and product name

  Scenario: Declining HID permission leaves the pedal unpaired
    Given a USB foot pedal is connected via USB
    When I deny the HID permission prompt
    Then the pedal stays unpaired
    And I see a hint that performance navigation still works by touch/keys

  Scenario: Reconnect the pedal after a disconnect
    Given a foot pedal was connected earlier
    When the pedal disconnects and reconnects
    Then the app re-pairs automatically on reconnect
    And the previously saved pedal mapping is restored

  ──────────────────────────────────────────────
  MAPPING PEDAL ACTIONS
  ──────────────────────────────────────────────

  Scenario: Map pedals to previous/next song
    Given I connected a two-switch foot pedal
    When I map the left switch to "Previous song" and the right switch to "Next song"
    Then pressing the right switch advances to the next song
    And pressing the left switch returns to the previous song

  Scenario: Assign a pedal to an action and persist it
    Given I have a foot pedal connected
    When I assign its switch to "Activate spotlight"
    Then the pedal switch performs that action during Performance Mode
    And the mapping is saved with the pedal so it persists across sessions

  Scenario: Change an existing pedal mapping
    Given my right pedal switch is mapped to "Next song"
    When I remap it to "Toggle chord-only view"
    Then the new action replaces the old one
    And the app acknowledges "Map updated"

  Scenario: Show which action a pedal is bound to
    Given I am mapping pedals
    When I inspect the pedal setup
    Then each switch shows its current action
    And unassigned switches are marked "Unassigned"

  ──────────────────────────────────────────────
  PEDAL BEHAVIOR IN PERFORMANCE MODE
  ──────────────────────────────────────────────

  Scenario: Foot pedal advances and returns without losing place
    Given I am on song 2 of 6 in Performance Mode
    When I press the "Next song" pedal
    Then the app advances to song 3
    And pressing "Previous song" returns me to song 2 with the setlist intact

  Scenario: Long-press pedal triggers a non-navigation action
    Given a left pedal switch is mapped to "Next song"
    When the user holds the left pedal switch for 2 seconds
    Then the held action (spotlight) fires instead of the short-press navigation
    And the short-press action remains available with a quick tap

  Scenario: Pedal inputs are debounced to avoid double-advance
    Given a foot pedal with a bouncy switch
    When the user taps "Next song" once
    Then only one song advance occurs
    And no duplicate transitions fire from the same press

  ──────────────────────────────────────────────
  ROBUSTNESS & DISCOVERY
  ──────────────────────────────────────────────

  Scenario: Performance Mode works with touch, keys, and pedal interchangeably
    Given a foot pedal is connected
    When the user navigates using a mix of pedal, swipe, and arrow keys
    Then every input advances the setlist correctly
    And the active song stays consistent across all three inputs

  Scenario: Pedal mapping is disabled when performance mode is closed
    Given a foot pedal is connected
    When I close Performance Mode
    Then foot pedal inputs no longer trigger actions
    And the app does not fire performance shortcuts in the background

  Scenario: Pedal mapping guide is available in help
    Given I am on the foot pedal setup
    When I open the help panel
    Then I see the documented default pedal map
    And a note that not all pedals expose the same number of switches
    And pedals only support the HID protocol, so controllers that need drivers are unsupported
