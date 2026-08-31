Feature: Practice Mode
  As a musician
  I want a personal practice surface with metronome and auto-scroll
  So that I can rehearse songs at my own key and tempo without affecting the shared arrangement

  ──────────────────────────────────────────────
  ENTERING PRACTICE MODE
  ──────────────────────────────────────────────

  Scenario: Open a song in practice mode from the repertoire
    Given Juan has a song "Canción Z" in his repertoire with base key G and base tempo 100 BPM
    And Juan practices "Canción Z" in D but the setlist stage key is G
    And Juan prefers to practice "Canción Z" at 70 BPM
    When Juan opens "Canción Z" in practice mode
    Then the practice view renders in D at 70 BPM
    And the song's shared metadata still shows base key G and base tempo 100 BPM
    And the stage key for the setlist remains G
    And when Juan views the song on the setlist in performance mode
    Then the stage view renders in G, with no preference overwritten by switching modes

  ──────────────────────────────────────────────
  PREFERENCE PRECEDENCE
  ──────────────────────────────────────────────

  Scenario: Per-song practice key beats context and global default
    Given Juan has a global practice offset of +1 semitone
    And the band context "Sunday Band" applies minus one semitone to practice
    And Juan has set an explicit practice key of D for "Canción Z"
    When Juan opens "Canción Z" in practice mode
    Then the practice view renders in D (the explicit per-song preference wins)

  Scenario: Band context applies when no per-song practice key is set
    Given Juan has a global practice offset of +1 semitone
    And the band context "Sunday Band" applies minus one semitone to practice
    And Juan has no per-song practice key set for "Canción W"
    When Juan opens "Canción W" in practice mode
    Then the practice view applies the band context offset minus one semitone (net 0)

  ──────────────────────────────────────────────
  PRACTICE KEY RENDERING
  ──────────────────────────────────────────────

  Scenario: Practice view transposes without creating a new version
    Given "Canción Z" has base key G major
    And Juan's practice preference for "Canción Z" is D major
    When Juan opens "Canción Z" in practice mode
    Then the practice view renders in D major (−5 semitones from base G)
    And the display shows "Practice key: D (−5 from base G)"
    And no new song version is created
    And the shared song metadata retains key G as the canonical key
    And the base ChordPro source on disk is unchanged

  ──────────────────────────────────────────────
  PRACTICE TEMPO + SPEED CONTROL
  ──────────────────────────────────────────────

  Scenario: Practice tempo preference is applied to metronome and auto-scroll
    Given "Canción Z" has base tempo 100 BPM
    And Juan prefers to practice "Canción Z" at 70 BPM
    When Juan opens "Canción Z" in practice mode
    Then the metronome uses 70 BPM
    And the auto-scroll scrolls at 70 BPM
    And the shared song metadata retains 100 BPM as the base tempo

  Scenario: Nudge tempo up and down during practice
    Given Juan is practicing "Canción Z" at 70 BPM
    When Juan nudges the tempo up by 5 BPM
    Then the metronome and auto-scroll use 75 BPM
    When Juan nudges the tempo down by 10 BPM
    Then the metronome and auto-scroll use 65 BPM
    And the base tempo in shared metadata remains 100 BPM

  Scenario: Tempo nudge stays within a sensible range
    Given Juan is practicing "Canción Z" at 45 BPM
    When Juan nudges the tempo down by 10 BPM
    Then the tempo is clamped at 40 BPM (the lower bound)
    When Juan nudges the tempo up to 220 BPM
    Then the tempo is clamped at 220 BPM (the upper bound)
    And shared metadata is never altered by nudging

  ──────────────────────────────────────────────
  METRONOME
  ──────────────────────────────────────────────

  Scenario: Start and stop the metronome
    Given Juan is in practice mode with "Canción Z"
    When Juan starts the metronome
    Then an audible click plays at the practice tempo
    When Juan stops the metronome
    Then the click stops

  Scenario: Metronome respects section meter and tempo changes
    Given "Canción Cambio" has a Bridge in 3/4 at 90 BPM inside a 4/4 song at 120 BPM
    And Juan is in practice mode with the metronome running
    When the metronome reaches the Bridge section
    Then the click switches to 90 BPM in 3/4 time
    And when the Bridge ends the click returns to 120 BPM in 4/4 time

  Scenario: Visual beat flash is available for accessibility
    Given Juan is in practice mode with the metronome running
    When Juan enables the visual beat flash option
    Then a visual indicator flashes on each beat alongside the audible click
    And the visual flash follows the same tempo and meter as the click

  ──────────────────────────────────────────────
  AUTO-SCROLL
  ──────────────────────────────────────────────

  Scenario: Auto-scroll scrolls lyrics at practice tempo
    Given Juan is in practice mode with "Canción Z" and auto-scroll enabled
    When Juan starts playback
    Then the lyrics scroll automatically at the practice tempo
    And each section (Verse, Chorus, Bridge) scrolls in sequence
    And this is the personal-practice variant of auto-scroll, distinct from the stage auto-scroll in live-performance-mode

  Scenario: Pause, resume, and manually override auto-scroll
    Given Juan is in practice mode with auto-scroll running
    When Juan pauses auto-scroll
    Then the scroll stops and the current position is preserved
    And when Juan resumes auto-scroll the scroll continues from the preserved position
    When Juan manually scrolls to a different section during auto-scroll
    Then the auto-scroll pauses and the user's manual position is respected
    And when Juan restarts playback the auto-scroll re-anchors at the current section and resumes

  ──────────────────────────────────────────────
  PRACTICE SESSION
  ──────────────────────────────────────────────

  Scenario: Starting the metronome begins a practice session
    Given Juan is in practice mode with "Canción Z"
    When Juan starts the metronome
    Then a practice session begins recording the start time and the instrument set in Juan's profile
    And starting the metronome is the single trigger that begins a session

  Scenario: Session records instrument and duration
    Given Juan started a practice session for "Canción Z" on guitar
    When Juan stops the session after 45 minutes
    Then a practice session record is saved with instrument "guitar" and duration 45 minutes
    And the session is personal to Juan and not visible to bandmates or the organization

  Scenario: Session records the overridden instrument when changed
    Given Juan's profile lists "guitar" as primary instrument
    And Juan is in practice mode
    When Juan starts a practice session and overrides the instrument to "piano"
    Then the session records instrument "piano"
    And Juan's profile primary instrument remains "guitar"

  Scenario: Practice session appears in analytics
    Given Juan completed a practice session on guitar for 45 minutes
    When Juan opens "Practice Analytics"
    Then the 45-minute guitar session appears in the practice hours by instrument data
    And the dashboard is owned by the analytics-and-insights feature — practice-mode defines only the write path

  ──────────────────────────────────────────────
  OFFLINE
  ──────────────────────────────────────────────

  Scenario: Practice mode rendering and metronome work fully offline
    Given Juan is offline
    When Juan opens "Canción Z" in practice mode
    Then the practice view renders with the correct transposition and practice tempo
    And the metronome and auto-scroll function with no connectivity

  Scenario: Completed practice sessions queue for sync when offline
    Given Juan is offline
    When Juan completes a practice session
    Then the session is saved locally with a "pending sync" flag
    And when Juan reconnects to the internet the session syncs to the server
    And the "pending sync" flag is cleared

  ──────────────────────────────────────────────
  FAILURE RESILIENCE
  ──────────────────────────────────────────────

  Scenario: Exiting practice mode mid-session does not lose data
    Given Juan is in a practice session
    When Juan exits practice mode without explicitly stopping the session
    Then the session is saved with the elapsed duration up to the exit point
    And no partial or corrupt session record is written
    And the session is retrievable in "Practice Analytics" after the exit

  ──────────────────────────────────────────────
  NON-GOALS
  ──────────────────────────────────────────────

  Scenario: Audio playback, recording, gamification, and shared practice are out of scope
    Given I am in practice mode
    When I look for additional practice features
    Then no audio playback engine, backing tracks, or audio file import is offered
    And no slow-down or loop functionality exists for audio
    And no recording feature captures my practice performance
    And no practice streaks, badges, or gamification elements exist — the analytics dashboard is the only consumption surface
    And no shared or real-time practice session feature exists — practice is always personal
    And no practice-mode-specific annotation feature exists — annotations are owned by collaborative-comments
