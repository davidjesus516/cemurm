# Account Data Export and Erasure Specification

## Purpose

N2 privacy obligations: export the full account data in a portable form, and erase the account after a cancellable 30-day grace period with correct retention of org-owned content and attribution stripping. Source of truth: `features/account-data-export-and-erasure.feature`.

## Requirements

### Requirement: Full account export
The system MUST generate a complete, portable export of a logged-in user's data on demand from Settings ("Export my data"). The bundle MUST contain a JSON document and a human-readable Markdown summary of the same data. The export MUST cover repertoire (songs, versions, charts, tags), collections, setlists and setlist items, annotations, comments, practice sessions, performance/gig activity as present, preferences (user and notification), and memberships. The JSON document MUST be versioned with `schema_version = "cemurm.account-export/1"` and include `exported_at` and account metadata. The export MUST be usable on another device or tool and re-importable into a fresh CEMURM account.

#### Scenario: Request a full account export
- GIVEN I am logged in
- WHEN I open "Export my data" in settings
- THEN the app generates a bundle with my full account data
- AND the bundle contains a JSON file and a readable summary of the same data

#### Scenario: The export covers repertoire and versions
- GIVEN I have songs with multiple versions and charts
- WHEN I export my data
- THEN the bundle includes every song, version, and chart I authored
- AND the version change history with dates and editors

#### Scenario: The export covers activity and preferences
- GIVEN I have comments, annotations, collections, practice sessions, and performance records
- WHEN I export my data
- THEN the bundle includes my comments, annotations, and collections
- AND my practice history, performance records, and notification preferences

#### Scenario: The export bundle is portable
- GIVEN I downloaded my export bundle
- WHEN I open it on another device or in another tool
- THEN the JSON file documents every included record in a standard form
- AND the bundle can be re-imported into a fresh CEMURM account

### Requirement: Erasure request with 30-day grace period
The system MUST allow a logged-in user to request permanent deletion from Settings ("Delete my account permanently"). Requesting erasure MUST start a 30-day grace period, warn that deletion is permanent, schedule all personal data for deletion after 30 days, and keep export available during the grace period. The user MUST be able to cancel during the grace period and cancellation MUST retain the account and data exactly as they were with no deletion scheduled.

#### Scenario: Requesting erasure starts a 30-day grace period
- GIVEN I am logged in
- WHEN I select "Delete my account permanently"
- THEN I am warned that the deletion is permanent
- AND all my personal data is scheduled for deletion after 30 days
- AND I can still take an export during the grace period

#### Scenario: Cancelling during the grace period keeps everything
- GIVEN my deletion is scheduled and the grace period is running
- WHEN I cancel the deletion
- THEN my account and data are retained exactly as they were
- AND no scheduled deletion runs

#### Scenario: After the grace period erasure is irreversible
- GIVEN the 30-day grace period ended without cancellation
- WHEN the deletion runs
- THEN my account and personal data are permanently removed
- AND I cannot log in again or restore the old account

### Requirement: Post-erasure retention and attribution stripping
When erasure runs after the grace period, the system MUST remove personal data (personal annotations, practice sessions, notification preferences) and clear local cache and pending offline writes with the account. Org-owned content the user authored (songs, setlists, and history) MUST remain in the org, but author attribution to the deleted user MUST be stripped. Public library contributions MUST follow the community suite's withdrawal behavior via the existing withdrawal path. An export bundle downloaded during the grace period MUST remain readable on the user's device and re-importable into a new account after deletion.

#### Scenario: Personal data is removed
- GIVEN my deletion ran
- WHEN the account cleanup runs
- THEN my personal annotations, practice sessions, and notification preferences are gone
- AND the local cache and pending offline writes are cleared with the account

#### Scenario: Org-owned content remains with attribution stripped
- GIVEN I authored songs and setlists used by my org
- WHEN my deletion completes
- THEN the org keeps its songs, setlists, and history
- AND author attribution to me is stripped from those records

#### Scenario: Public contributions follow the community withdrawal path
- GIVEN I had public library contributions when I deleted my account
- WHEN the deletion runs
- THEN my public entries are withdrawn using the community suite's withdrawal behavior
- AND the takedown mechanics stay owned by that suite — this feature only guarantees they run on erasure

#### Scenario: An export taken before deletion remains usable
- GIVEN I downloaded my export bundle during the grace period
- WHEN the deletion completes
- THEN the bundle stays readable on my device
- AND I can re-import it into a new account later

### Requirement: Re-import into a fresh account
A valid export bundle (schema_version `cemurm.account-export/1`) MUST be re-importable into a fresh account. Identity fields from the donor document MUST be ignored; all imported rows MUST be owned by the importing user. IDs MUST be remapped to avoid collisions. Charts imported without blob storage MUST preserve content but have no storage object key. Setlist items referencing songs not present in the import MUST be skipped and counted. Re-import MUST be append-on-second-run (documented behavior) and must not transfer ownership from other users.

#### Scenario: Re-import into a fresh account
- GIVEN I have a valid export bundle
- WHEN I import it into a fresh CEMURM account
- THEN the core working set (songs, versions, charts, setlists, collections, annotations, preferences) is restored under the new account
- AND the import is readable on that device
