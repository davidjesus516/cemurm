Feature: Search and Discovery
  As a musician looking for new material
  I want powerful search and discovery tools
  So that I can find the right songs quickly and explore new repertoire

  ──────────────────────────────────────────────
  BASIC SEARCH
  ──────────────────────────────────────────────

  Scenario: Search songs by free-text query
    Given I have songs titled "Amazing Grace", "Grace of My Mind", and "Amazing Day"
    When I search for "Amazing"
    Then I see both "Amazing Grace" and "Amazing Day" in the results
    And "Grace of My Mind" is excluded

  Scenario: Search chords by chord name
    Given I have two songs with G major chords
    When I search for chord "G major"
    Then both songs appear in the results
    And each result is tagged with the matching chord

  Scenario: Search by key signature
    Given I have songs in C major, G major, and D major
    When I filter by key "G major"
    Then only the songs in G major are displayed
    And a count badge shows "2 songs in G major"

  Scenario: Search by tempo range
    Given I have songs ranging from 60 BPM to 180 BPM
    When I set the tempo range from 70 to 100 BPM
    Then only songs within that range appear in the results

  ──────────────────────────────────────────────
  ADVANCED FILTERS
  ──────────────────────────────────────────────

  Scenario: Combine multiple filters
    Given I have songs across multiple genres and keys
    When I filter by genre "gospel" AND key "Bb major" AND tempo 80-120 BPM
    Then only songs matching ALL three filters are shown
    If no songs match, I see "No results — try adjusting your filters"

  Scenario: Filter by instrumentation
    Given I have songs with different instrumentation tags
    When I filter by "guitar" as the primary instrument
    Then only songs tagged with guitar appear
    And I can see the instrumentation tags on each result card

  Scenario: Filter by date added or last played
    Given I have songs added at different dates
    When I select "Added in the last 30 days"
    Then only songs added within that time window appear

  Scenario: Filter by repertoire source (system vs org vs private)
    Given I have songs from the system repertoire, my org repertoire, and private imports
    When I filter by "Org: Academia Central"
    Then only songs whose source is Academia Central appear
    And system-wide songs appear when I select "System Repertoire"

  Scenario: Clear all filters
    Given I have applied 3 active filters
    When I tap "Clear all filters"
    Then all filters are reset
    And the full repertoire list is displayed again

  ──────────────────────────────────────────────
  FOLDER & TAG BROWSING
  ──────────────────────────────────────────────

  Scenario: Browse songs by genre category
    Given songs are tagged with genres: "rock", "worship", "classical", "folk"
    When I open the "Genres" browser
    Then each genre shows a cover image and song count
    When I tap "worship"
    Then I see all worship-tagged songs sorted by last played

  Scenario: Create custom tags
    Given I am organizing songs for a specific gig
    When I create a tag "wedding-intro"
    And I assign it to 3 songs
    Then those 3 songs are accessible via the "wedding-intro" tag
    And the tag appears in my custom tags list

  Scenario: Tag a song with multiple tags
    Given I have a song "River Flows in You"
    When I tag it with "piano", "slow", "wedding", "classical"
    Then searching for any of those 4 tags finds the song
    And the song appears in all 4 tag browse views

  Scenario: Remove a tag from a song
    Given "River Flows in You" is tagged with "wedding"
    When I remove the "wedding" tag
    Then the song no longer appears in the wedding tag browse
    And remaining tags ("piano", "slow", "classical") are still attached

  ──────────────────────────────────────────────
  DISCOVERY & RECOMMENDATIONS
  ──────────────────────────────────────────────

  Scenario: Discover songs used in recent setlists
    Given I have created 5 setlists over the past month
    And several songs appeared across multiple setlists
    When I open the "Trending in Your Repertoire" section
    Then I see the most-used songs ranked by frequency
    And each song shows how many setlists it appeared in

  Scenario: Discover songs from bandmates' repertoires
    Given I have 3 active bandmates: Julian, Lucia, Marco
    When I open "Discover from My Band"
    Then I see songs from Julian, Lucia, and Marco's repertoires
    That are not yet in MY repertoire
    And each song shows which bandmate owns it

  Scenario: Receive suggestions based on listening history
    Given I frequently play songs in the key of C major and tempo range 100-130 BPM
    When I open "Recommended for You"
    Then I see songs matching those patterns that I have not yet added
    And the recommendations refresh weekly

  Scenario: Discover songs from external APIs (MusicBrainz, Spotify)
    Given I enable external discovery in my settings
    When I search for "Blinding Lights"
    Then the app queries MusicBrainz and Spotify
    And shows results with cover art, metadata, and a "Preview on Spotify" link
    And a one-tap import option is available for each result

  ──────────────────────────────────────────────
  SEARCH HISTORY & SAVED SEARCHES
  ──────────────────────────────────────────────

  Scenario: Search queries are saved to history
    Given I have performed 5 searches this week
    When I open the search bar
    Then I see my recent search queries as suggestions
    And I can tap any previous query to re-run it

  Scenario: Save a frequent search as a shortcut
    Given I frequently search for genre "jazz" AND key "Eb major"
    When I save this filter combination as "Jazz Eb"
    Then a shortcut button "Jazz Eb" appears in the search bar
    And tapping it instantly runs the saved filter

  Scenario: Delete a search from history
    Given I have a search "old-then-query" in my history
    When I swipe left on it and tap "Delete"
    Then "old-then-query" is removed from search history
    And other searches remain unaffected

  ──────────────────────────────────────────────
  OFFLINE SEARCH
  ──────────────────────────────────────────────

  Scenario: Search cached repertoire while offline
    Given I have 50 cached songs downloaded for offline use
    When I lose internet connection
    And I search for "Imagine"
    Then the search operates on cached songs only
    And I see a banner "Showing cached results only — online for full library"

  Scenario: Offline search returns limited results
    Given I search for "A" while offline
    And my cached library has 50 songs
    Then results are limited to the 50 cached songs
    And I do NOT see suggestions to expand the search online
