Feature: Rehearsal Workflow
  As a band or ministry leader
  I want to plan and run rehearsals against our setlists
  So that we arrive at the service or event ready to play

  ──────────────────────────────────────────────
  AGENDA CREATION
  ──────────────────────────────────────────────

  Scenario: Build a rehearsal agenda from a setlist
    Given the setlist "Saturday Service" contains "Song A", "Song B", and "Song C" in order
    When I create a rehearsal "Saturday Service Rehearsal" from that setlist
    Then the agenda lists "Song A", "Song B", and "Song C" in the same order
    And each song carries its agreed key from the setlist

  Scenario: Agenda flags chart readiness per song
    Given "Song A" is "ready" and "Song C" is "draft" (missing chorus)
    When the rehearsal agenda is generated
    Then "Song A" is marked "Ready to play"
    And "Song C" is flagged "Needs chart work before rehearsal"

  Scenario: Agenda lists the members needed per song
    Given "Song A" needs vocals (Juan), guitar (Pedro), and bass (Lucia)
    When I open the rehearsal agenda
    Then each song shows its required parts and assigned members
    And members not assigned to a song are marked "optional"

  Scenario: Rehearsal can include songs not yet in the setlist
    Given I am prepping "New Song" for next month's service
    When I add "New Song" to the rehearsal agenda without adding it to the setlist
    Then the agenda includes "New Song" with a "Not in setlist" tag
    And the setlist "Saturday Service" is unchanged

  Scenario: Publishing the agenda notifies the band
    Given the rehearsal agenda has 4 assigned members
    When I publish the agenda
    Then each assigned member receives an invitation with the agenda
    And the agenda shows who has confirmed and who has not

  ──────────────────────────────────────────────
  DURATION & TIMEBOX
  ──────────────────────────────────────────────

  Scenario: Agenda estimates rehearsal duration from song lengths
    Given the agenda contains songs of 5:00, 4:30, and 6:00
    When I view the agenda summary
    Then the estimated duration shows 15 minutes and 30 seconds

  Scenario: Overrun warning when songs exceed the rehearsal timebox
    Given the rehearsal timebox is 20 minutes
    And the agenda's estimated duration is 24 minutes
    When the agenda is generated
    Then the app warns "Estimated 24 minutes — exceeds your 20-minute timebox"
    And offers "Trim songs" and "Extend timebox"

  Scenario: Trimming a song keeps the rest of the agenda intact
    Given the agenda overruns by 4 minutes
    When I mark "Song C" as "Quick review only"
    Then the estimated duration drops by "Song C"'s full slot
    And "Song A" and "Song B" keep their full time slots

  ──────────────────────────────────────────────
  RUNNING THE REHEARSAL
  ──────────────────────────────────────────────

  Scenario: Marking a run-through outcome per song
    Given I run "Song A" twice during rehearsal
    When I mark the outcome of "Song A"
    Then the song is recorded as "Polished"
    And the run count is stored with the rehearsal record

  Scenario: Song that needs work appears in the next agenda
    Given I marked "Song B" as "Needs work" in the rehearsal
    When the next rehearsal agenda is generated
    Then "Song B" is listed again with the tag "Carried over: needs work"
    And its previous notes are attached

  Scenario: Rehearsal notes attach back to the song
    Given during rehearsal I note "Pedro enters on verse 2, not the chorus" for "Song A"
    When I open "Song A" in the library
    Then the note is visible in the song's rehearsal history
    And the note is not part of the chart content

  Scenario: Chart edit during rehearsal creates a version
    Given I fix a wrong chord on "Song A" during rehearsal
    When I save the chart
    Then the chart edit creates a new version entry (editor, timestamp, "Fixed chorus chord")
    And the song's readiness state is unchanged

  Scenario: Agreed key can be changed during rehearsal by the leader
    Given the setlist agrees "Song B" in G
    When the band leader changes the agreed key to A during rehearsal
    Then the setlist item records agreed key A
    And the change is logged with the leader as decider
    And each member's projection updates on their own device

  Scenario: Ready chart does not mean polished performance
    Given "Song C" has a complete chart (ready) but the band ran it twice and it is rough
    When the rehearsal record is closed
    Then "Song C" is marked "Ready to play (chart) — needs work (performance)"
    And the next agenda still carries it over

  ──────────────────────────────────────────────
  ABSENCE & COVERAGE
  ──────────────────────────────────────────────

  Scenario: Absent member's parts are flagged on the agenda
    Given Lucia is absent from the rehearsal
    When the agenda is generated
    Then "Song A" shows "Bass part uncovered — Lucia absent"
    And the app links to the substitution flow

  ──────────────────────────────────────────────
  OFFLINE & SYNC
  ──────────────────────────────────────────────

  Scenario: Rehearsal notes survive offline
    Given I am at rehearsal with no connection
    When I mark outcomes and add notes
    Then the changes are stored locally with a pending sync flag
    When I reconnect
    Then the notes and outcomes sync and appear in the song and rehearsal records
