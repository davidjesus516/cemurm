Feature: Live Performance Mode
  As a performer on stage
  I want a dedicated full-screen performance view
  So that I can focus on playing and not on the app interface

  ──────────────────────────────────────────────
  SONG PRESENTATION
  ──────────────────────────────────────────────

  Scenario: Open performance mode with a setlist
    Given I have a setlist "Friday Gig"
    When I open Performance Mode
    Then the first song of the setlist is displayed full-screen
    And the UI shows only lyrics, chords, and minimal controls

  Scenario: Display chords above lyrics in performance view
    Given I am viewing "Bohemian Rhapsody" in performance mode
    And the song has chords annotated at verse positions
    Then chords are displayed in bold color above the relevant lyric line
    And the lyrics flow below the chords in a readable rhythm

  Scenario: Auto-scroll lyrics in sync with the song
    Given I am in performance mode with auto-scroll enabled
    And the song has a defined tempo of 80 BPM
    When I trigger playback from the first section
    Then the lyrics scroll automatically at the correct timing
    And I can see each section (Verse, Chorus, Bridge) in advance

  Scenario: Manual scroll to a specific song section
    Given I am mid-song in performance mode
    When I swipe up or tap the section navigator
    Then the view jumps to the next section immediately
    And the auto-scroll timer resets for the new section

  ──────────────────────────────────────────────
  SETLIST NAVIGATION DURING PERFORMANCE
  ──────────────────────────────────────────────

  Scenario: Transition to the next song in the setlist
    Given I am viewing song 3 of 6 in the performance setlist
    When I tap "Next" or use the foot pedal gesture
    Then the app transitions to song 4
    And a subtle transition animation plays (fade or slide)

  Scenario: Go back to the previous song
    Given I am on song 4 of 6
    When I accidentally play the wrong song
    And I tap "Previous" or use the foot pedal gesture
    Then the app returns to song 3
    And I do not lose my place in the setlist

  Scenario: Skip a song and return to it later
    Given I am on song 2 of 6
    When I skip song 3 entirely
    And I tap "Next" twice
    Then I land on song 4
    And I can tap "Previous" to return to song 3 later

  Scenario: Jump to a specific song mid-performance
    Given I am on song 1 of 8
    When I open the mini setlist navigator
    And I tap song 6
    Then the app transitions to song 6
    And the navigator closes automatically

  ──────────────────────────────────────────────
  PERFORMANCE CONTROLS
  ──────────────────────────────────────────────

  Scenario: Toggle capo/transpose during a performance
    Given I am performing "Wonderwall" in standard tuning
    When I tap the transpose button and set capo to 2
    Then the displayed chords shift up a whole step
    And the lyrics remain unchanged
    And the change persists for the rest of the performance

  Scenario: Adjust tempo in real time during performance
    Given a song has a base tempo of 100 BPM
    When I tap the tempo up button twice
    Then the display shows 104 BPM
    And the auto-scroll speed adjusts proportionally

  Scenario: Toggle chord-only view during performance
    Given I am viewing lyrics with chords
    When I toggle chord-only mode
    Then only chord names are displayed without lyrics
    And I can tap again to restore the full view

  Scenario: Spotlight / dim lyrics for audience focus
    Given I am on stage and want the audience to focus on a vocal part
    When I activate spotlight mode
    Then the current lyric line is highlighted
    And all other text dims significantly

  ──────────────────────────────────────────────
  OFFLINE & ROBUSTNESS
  ──────────────────────────────────────────────

  Scenario: Performance mode works fully offline
    Given I have the setlist cached locally
    When I lose internet connection on stage
    Then I can still navigate between songs
    And lyrics and chords render without errors
    And I can still use transpose and tempo controls

  Scenario: Handle missing lyrics gracefully in performance
    Given I have a song without lyrics in the setlist
    When I navigate to that song in performance mode
    Then the app shows "[No lyrics available]"
    And I can still display the chord chart alone

  Scenario: Recover from a crash during performance
    Given I was using performance mode with song 4 of 6 active
    When the app crashes and restarts
    Then the app reopens to the last active song (song 4)
    And the setlist position is preserved

  ──────────────────────────────────────────────
  PERFORMANCE ANALYTICS (POST-SHOW)
  ──────────────────────────────────────────────

  Scenario: Record which songs were played in a gig
    Given I completed a gig using setlist "Friday Gig"
    When I mark the setlist as "played" after the show
    Then each song shows a "played at Fri Gig" tag
    And the performance history is updated for each song

  Scenario: View song demand across multiple gigs
    Given I have performed "Song A" in 5 gigs and "Song B" in 2 gigs
    When I open performance history
    Then "Song A" appears as a high-demand song
    And "Song B" appears as a moderate-demand song
    And I see a count of performances per song
