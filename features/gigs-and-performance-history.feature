Feature: Gigs and Performance History
  As a musician or band leader
  I want to plan single-organization gigs and record what was actually played
  So that my performance history stays truthful and feeds analytics and future gigs

  ──────────────────────────────────────────────
  GIG CREATION
  ──────────────────────────────────────────────

  Scenario: Create a gig with venue details and a linked setlist
    Given I have a setlist "Friday Gig Set" with "Song A", "Song B", and "Song C"
    When I create a gig called "Friday Gig" on Friday at 9 PM
    And I set the venue to "Café La Luna" with location "Calle Luna 3, Madrid" and type "bar"
    And I link the setlist "Friday Gig Set"
    Then the gig shows its name, its date and time, the venue with location and type, and the linked setlist

  Scenario: A gig references exactly one setlist at planning time
    Given I have the setlists "Friday Gig Set" and "Acoustic Set"
    When I create the gig "Friday Gig" and link the setlist "Friday Gig Set"
    Then the gig references exactly one setlist
    And the app offers no way to link a second setlist to the same gig
    And I can swap the linked setlist later by editing the gig before completion

  Scenario: The same setlist can serve multiple gigs
    Given I link the setlist "Sunday Worship Set" to the gig "Church Sunday Service"
    When I create a second gig "Youth Group Night" and link the same setlist
    Then both gigs reference "Sunday Worship Set"
    And editing one gig does not alter the setlist or the other gig

  ──────────────────────────────────────────────
  VENUE SUGGESTIONS
  ──────────────────────────────────────────────

  Scenario: Prior venues are offered as suggestions for reuse
    Given I have used the venues "Café La Luna" and "Parque El Retiro" before
    And "Parque El Retiro" is typed as type "outdoor"
    When I type "Caf" in the venue field of a new gig
    Then the app suggests "Café La Luna" with its stored location and type
    And selecting the suggestion reuses the saved venue details

  Scenario: Edit a gig to change its venue
    Given the gig "Friday Gig" is planned at the venue "Café La Luna"
    When I change the venue to "Centro Cultural Aurora"
    Then the gig shows "Centro Cultural Aurora" with its location and type
    And the change applies only to this gig, not to past or future gigs

  ──────────────────────────────────────────────
  GIG LIFECYCLE
  ──────────────────────────────────────────────

  Scenario: Confirm a planned gig
    Given I have a planned gig "Friday Gig"
    When I confirm it
    Then the gig status becomes "confirmed"
    And the date, time, venue, and setlist remain editable until completion

  Scenario: Edit a gig before completion, including its setlist
    Given the gig "Friday Gig" is confirmed with the setlist "Friday Gig Set"
    When I move it to Saturday at 8 PM
    And I change the venue to "Centro Cultural Aurora"
    And I link the setlist "Acoustic Set" instead
    Then the gig shows the new date, time, venue, and setlist
    And the previously linked setlist "Friday Gig Set" is unchanged

  Scenario: Cancel a gig before the show
    Given the gig "Friday Gig" is confirmed
    When I cancel it
    Then the gig status becomes "cancelled"
    And no performance record is written for the gig
    And no song earns a "played at Friday Gig" tag
    And I can re-open the cancelled gig to reschedule or complete it later

  ──────────────────────────────────────────────
  PERFORMANCE RECORD
  ──────────────────────────────────────────────

  Scenario: Completing a gig writes one performance record
    Given the gig "Friday Gig" is confirmed with setlist "Friday Gig Set"
    When the show ends
    And I mark the gig as completed
    Then the gig status becomes "completed"
    And exactly one performance record is created containing the date, the venue, and the songs actually played

  Scenario: Skipped songs are recorded separately
    Given the gig "Friday Gig" lists "Song A", "Song B", and "Song C"
    When I complete the gig having played only "Song A" and "Song B"
    Then the performance record lists "Song A" and "Song B" as played
    And "Song C" is recorded in the performance record as skipped

  Scenario: Songs played outside the setlist are recorded separately
    Given I played the encore "Song D" which is not in the setlist "Friday Gig Set"
    When I complete the gig "Friday Gig"
    Then "Song D" appears in the performance record as played outside the setlist
    And the setlist itself remains unchanged

  Scenario: Post-show flow writes the gig's performance record
    Given I performed the gig "Friday Gig" with the setlist "Friday Gig Set"
    When I mark the setlist as played from the post-show flow in Performance Mode
    Then the gig is completed and its single performance record is saved
    And the record is the same entity the gig owns — not a duplicate write

  ──────────────────────────────────────────────
  SONG HISTORY HANDOFF
  ──────────────────────────────────────────────

  Scenario: Played songs get "played at" tags and demand counts
    Given "Amazing Grace" was actually played at the gigs "Church Sunday Service" and "Youth Group Night"
    When I open "Amazing Grace" in my repertoire
    Then it shows a "played at Church Sunday Service" tag and a "played at Youth Group Night" tag
    And its demand count of 2 feeds the song-demand analytics
    And no "played" tag exists for a song that was skipped at any gig

  ──────────────────────────────────────────────
  NOTIFICATIONS DATA
  ──────────────────────────────────────────────

  Scenario: The gig record provides date, time, and location for reminders
    Given I am performing in the gig "Friday Gig" at 9 PM on Friday at the venue "Café La Luna"
    When the notifications feature reads the gig record
    Then it has the date and time for the one-hour-before reminder
    And it has the venue location for location delivery
    And the gig stays the data source — notification delivery itself is specified in the notifications feature

  ──────────────────────────────────────────────
  VISIBILITY
  ──────────────────────────────────────────────

  Scenario: Gig visibility follows the org and branch model
    Given Lucia is a member of "Sede Madrid" in "Academia Musical"
    And she creates the gig "Friday Gig"
    Then the gig is private to Lucia by default
    And Juan, a member of "Sede Madrid", does not see it
    When Lucia shares the gig to "Sede Madrid"
    Then Juan can open the gig and, once completed, its performance record
    And Pedro, a member of "Sede Lima", cannot open the gig

  ──────────────────────────────────────────────
  OFFLINE
  ──────────────────────────────────────────────

  Scenario: Create, edit, and complete a gig offline
    Given I am offline at the venue
    When I create the gig "Friday Gig" with venue "Café La Luna" and setlist "Friday Gig Set"
    And I complete it after the show
    Then the gig and its performance record are stored locally with a "pending sync" flag
    When I reconnect to the internet
    Then the gig and its performance record sync to the server
    And the "pending sync" flag is cleared

  ──────────────────────────────────────────────
  NON-GOALS
  ──────────────────────────────────────────────

  Scenario: Calendar sync, recurring series, and attendees are out of scope
    Given I am creating a gig
    When I look for automation and audience options
    Then no calendar-sync integration is offered
    And no recurring-series automation exists — each gig is created explicitly
    And the gig has no ticket, RSVP, or attendee management surface
    And venue data stops at name, location, and type — no geo-location or maps

  Scenario: Multi-org gigs are cross-organization events
    Given a gig belongs to a single organization
    When an admin tries to attach a second organization to the gig
    Then the gig rejects the action
    And the app directs multi-org collaboration to the cross-organization event feature