Feature: External Integrations and Import
  As a user
  I want to bring songs and setlists in from the tools I already use, and export to stage apps
  So that I don't have to re-enter data manually and my library stays the single source of truth

  ──────────────────────────────────────────────
  METADATA ENRICHMENT
  ──────────────────────────────────────────────

  Scenario: Auto-complete song metadata from MusicBrainz
    Given I start adding a song titled "Smells Like Teen Spirit"
    When I trigger a MusicBrainz lookup
    Then the title, artist, year, and genre are pre-filled
    And I can accept or reject the suggested metadata

  Scenario: Fetch lyrics from LRCLIB
    Given I have a song without lyrics
    When I fetch lyrics via LRCLIB
    Then the lyrics are attached to the song
    And the source is credited as LRCLIB

  ──────────────────────────────────────────────
  FILE IMPORT
  ──────────────────────────────────────────────

  Scenario: Import an OnSong library file
    Given I have an OnSong file with sections and chords
    When I import the file
    Then the song is created with sections, chords, and lyrics mapped correctly
    And the source is recorded as "Imported from OnSong"

  Scenario: Batch import multiple song files
    Given I have 5 ChordPro files
    When I import them as a batch
    Then 5 songs are created in one review queue
    And I can approve or discard each import before it lands in the library

  Scenario: Malformed file fails without partial import
    Given I upload a corrupt ChordPro file
    When the parser processes it
    Then the import is rejected with "Could not parse this file"
    And no partial song is created

  Scenario: Imported arrangement keeps lineage
    Given I import "Song D" as a new arrangement
    When the song is created
    Then the version records "Imported from OnSong" as its lineage source
    And I am recorded as its owner

  ──────────────────────────────────────────────
  IMPORT PIPELINE — DEDUPE & LICENSE
  ──────────────────────────────────────────────

  Scenario: Imported song flagged as possible duplicate
    Given my library already contains "Amazing Grace"
    When I import a file for "Amazing Grace (traditional)"
    Then both are flagged as "possible duplicates"
    And I can merge or keep them separate before the import completes

  Scenario: Imported metadata conflicts with existing metadata
    Given my library has "Song X" with year 1998
    When an import proposes year 2001 for the same song
    Then the app asks which value wins
    And the chosen value is recorded with the import source

  Scenario: License confirmation is required on import
    Given I import a song with lyrics from another tool
    When the song is created
    Then the import asks me to confirm a license
    And public contributions default to CC-BY-4.0
    And I can choose "Proprietary (private only)" instead

  Scenario: Imported content carries source attribution
    Given I imported "Song D" from OnSong
    When I open the song detail
    Then the song shows the source "Imported from OnSong"
    And the license is displayed next to it

  ──────────────────────────────────────────────
  PLANNING CENTER INTEGRATION
  ──────────────────────────────────────────────

  Scenario: Connect a Planning Center account
    Given I use Planning Center for service planning
    When I connect my Planning Center account
    Then CEMURM can read my plans with my authorization
    And I can revoke the connection at any time

  Scenario: Import a plan from Planning Center
    Given my Planning Center account has the plan "Sunday 10am" with 4 songs
    When I import the plan
    Then a setlist "Sunday 10am (from Planning Center)" is created with the 4 songs in order
    And songs already in my library link to their existing charts
    And songs without charts are flagged "Missing chart — add or import"

  Scenario: Revoking the connection stops future imports
    Given I connected my Planning Center account
    When I revoke access
    Then CEMURM no longer reads my Planning Center plans
    And previously imported setlists remain in my library

  ──────────────────────────────────────────────
  URL & METADATA-ONLY IMPORT
  ──────────────────────────────────────────────

  Scenario: URL import fetches metadata only
    Given I paste a link to a song page
    When I choose "Import from URL"
    Then the app pre-fills title and artist from public metadata
    And it does not download the page's content
    And I paste or type the chart and lyrics myself

  Scenario: Scraping-based sources are not supported
    Given I paste a link from a chord site
    When I choose "Import from URL"
    Then the app does not fetch the page content
    And it explains "We don't import content from chord sites — paste your own chart"
    And offers the metadata-only prefill instead

  ──────────────────────────────────────────────
  EXPORT TO STAGE APPS
  ──────────────────────────────────────────────

  Scenario: Export a setlist for OnSong
    Given I have a setlist "Friday Gig" with 5 songs
    When I export it for OnSong
    Then the file uses OnSong's format
    And it contains the songs in order with their charts and agreed keys

  Scenario: Export to Planning Center pushes songs into a plan
    Given I have a setlist "Sunday 10am" ready
    When I export it to Planning Center
    Then the songs are added to the chosen plan in order
    And the export includes agreed keys
    And it does not include personal projections or annotations
