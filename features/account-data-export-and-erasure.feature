Feature: Account Data Export and Erasure
  As any user
  I want to export my full account data or erase it permanently
  So that I keep a portable copy of my data and can leave the platform on my terms

  ──────────────────────────────────────────────
  FULL ACCOUNT EXPORT
  ──────────────────────────────────────────────

  Scenario: Request a full account export
    Given I am logged in
    When I open "Export my data" in settings
    Then the app generates a bundle with my full account data
    And the bundle contains a JSON file and a readable summary of the same data
  Scenario: The export covers repertoire and versions
    Given I have songs with multiple versions and charts
    When I export my data
    Then the bundle includes every song, version, and chart I authored
    And the version change history with dates and editors
  Scenario: The export covers activity and preferences
    Given I have comments, annotations, collections, practice sessions, and performance records
    When I export my data
    Then the bundle includes my comments, annotations, and collections
    And my practice history, performance records, and notification preferences
  Scenario: The export bundle is portable
    Given I downloaded my export bundle
    When I open it on another device or in another tool
    Then the JSON file documents every included record in a standard form
    And the bundle can be re-imported into a fresh CEMURM account

  ──────────────────────────────────────────────
  ERASURE REQUEST
  ──────────────────────────────────────────────

  Scenario: Requesting erasure starts a 30-day grace period
    Given I am logged in
    When I select "Delete my account permanently"
    Then I am warned that the deletion is permanent
    And all my personal data is scheduled for deletion after 30 days
    And I can still take an export during the grace period
  Scenario: Cancelling during the grace period keeps everything
    Given my deletion is scheduled and the grace period is running
    When I cancel the deletion
    Then my account and data are retained exactly as they were
    And no scheduled deletion runs
  Scenario: After the grace period erasure is irreversible
    Given the 30-day grace period ended without cancellation
    When the deletion runs
    Then my account and personal data are permanently removed
    And I cannot log in again or restore the old account

  ──────────────────────────────────────────────
  WHAT REMAINS AFTER ERASURE
  ──────────────────────────────────────────────

  Scenario: Personal data is removed
    Given my deletion ran
    When the account cleanup runs
    Then my personal annotations, practice sessions, and notification preferences are gone
    And the local cache and pending offline writes are cleared with the account
  Scenario: Org-owned content remains with attribution stripped
    Given I authored songs and setlists used by my org
    When my deletion completes
    Then the org keeps its songs, setlists, and history
    And author attribution to me is stripped from those records
  Scenario: Public contributions follow the community withdrawal path
    Given I had public library contributions when I deleted my account
    When the deletion runs
    Then my public entries are withdrawn using the community suite's withdrawal behavior
    And the takedown mechanics stay owned by that suite — this feature only guarantees they run on erasure
  Scenario: An export taken before deletion remains usable
    Given I downloaded my export bundle during the grace period
    When the deletion completes
    Then the bundle stays readable on my device
    And I can re-import it into a new account later