# Analytics and Insights Specification

## Purpose

Usage and performance insight surfaces from `features/analytics-and-insights.feature` (23 scenarios): personal/performance analytics, org admin and repertoire insights, export/share analytics, and offline/engagement metrics. Source of truth is that feature file. This build derives every displayed number from real RLS-scoped data; where no backing source exists the surface renders an explicit **"Not tracked yet"** card and the scenario is a declared gap — no number is fabricated and no migration was added for this slice. Hito 6 N3, ODD `odd/tasks/hito6-n3-product-slice.md` T6–T8.

## Requirements

### Requirement: Personal repertoire and performance analytics

The system MUST derive, from the signed-in user's own songs, setlists and completed gigs: a most-used-song ranking, a weekly repertoire-growth line (cumulative with the peak week highlighted), untouched songs with their add date and genre/age filters, song popularity across gigs, and average setlist duration per month. Marking a gig as played MUST reuse the existing `completeGig` write path and MUST create exactly one performance with its played items from the linked setlist. The performance history timeline MUST be filterable by org, venue type, venue and month; venue type comes from `venues[].type` and month from the performance date.

#### Scenario: View songs most frequently added to setlists
- GIVEN the user's repertoire and setlists
- WHEN "Analytics" is opened
- THEN a ranking of most-used songs is shown with the top song highlighted.

#### Scenario: View my repertoire growth over time
- GIVEN songs added across weeks
- WHEN "Repertoire Growth" is opened
- THEN a weekly cumulative line chart with a highlighted peak week is shown.

#### Scenario: View songs I never performed
- GIVEN the user's repertoire
- WHEN "Untouched Songs" is opened
- THEN songs absent from every setlist are listed with add date and genre/age filters.

#### Scenario: Mark a gig performance and log setlist used
- GIVEN a completed gig with a linked setlist
- WHEN the setlist is marked as played
- THEN one performance with its played items is recorded via `completeGig`.

#### Scenario: View performance history timeline
- GIVEN completed gigs
- WHEN "Performance History" is opened
- THEN a chronological timeline with date, venue, setlist and song count is shown, filterable by org, venue type and month.

#### Scenario: View song popularity across multiple gigs
- GIVEN songs performed at several gigs
- WHEN song demand is opened
- THEN a popularity bar chart compares all songs.

#### Scenario: View average setlist duration over time
- GIVEN setlists across months
- WHEN "Duration Trends" is opened
- THEN the monthly average duration trend is shown.

### Requirement: Practice analytics is a declared gap

No practice-session table records hours by instrument, so "Practice Analytics" MUST render a "Not tracked yet" card instead of a number. This scenario is out of this build; the card is the honest state.

#### Scenario: View my practice hours by instrument
- GIVEN no practice-hour data source
- WHEN "Practice Analytics" is opened
- THEN a "Not tracked yet" notice is shown.

### Requirement: Organization and repertoire insights

The org dashboard MUST report members per branch, average member tenure and members joined this month from the RLS-visible `org_memberships`, and songs per branch from RLS-visible songs, with an inclusive from/to date filter on `songs.createdAt`. Repertoire insight surfaces MUST show genre and key distribution, most-added trending songs, and most recent additions. The dashboard MUST label visible counts honestly (it cannot claim org-wide totals RLS does not expose). Active/inactive member activity, event participation, cross-branch event metrics, a "days since last engagement" warning and instrument-coverage scoring have no backing source in this build and MUST render "Not tracked yet" cards.

#### Scenario: Org admin views aggregate member activity
- GIVEN the signed-in admin's visible memberships
- WHEN the org dashboard is opened
- THEN members by branch, tenure and joins-this-month are shown; active/inactive counts are "Not tracked yet".

#### Scenario: Org admin views repertoire growth by branch
- GIVEN visible songs and branches
- WHEN "Repertoire Analytics" is opened
- THEN songs per branch are shown with an inclusive date-range filter.

#### Scenario: Org admin views event participation metrics
- GIVEN no event-attendance data source
- WHEN "Event Analytics" is opened
- THEN a "Not tracked yet" notice is shown.

#### Scenario: Org admin identifies branches that need attention
- GIVEN no last-engagement timestamp
- WHEN the dashboard is opened
- THEN branch counts are visible and the low-activity warning is "Not tracked yet".

#### Scenario: View genre distribution of repertoire
- GIVEN tagged songs
- WHEN "Repertoire by Genre" is opened
- THEN a distribution chart is shown.

#### Scenario: View key distribution across repertoire
- GIVEN songs in multiple keys
- WHEN "Key Distribution" is opened
- THEN a key-frequency chart is shown.

#### Scenario: Discover trending songs across the org
- GIVEN RLS-visible org songs
- WHEN "Trending" is opened
- THEN the most-added songs are shown.

#### Scenario: Identify gaps in the repertoire by instrument
- GIVEN no instrument-coverage source
- WHEN "Instrument Coverage" is opened
- THEN a "Not tracked yet" notice is shown.

#### Scenario: View most recent additions to repertoire
- GIVEN visible songs with create dates
- WHEN "Recent Additions" is opened
- THEN the newest songs are listed.

### Requirement: Export/share and engagement metrics are declared gaps

Export history is local KV metadata with no format/audience-scan counters, and there is no geo column, activity timestamp or session-duration record. The engagement surface MUST show the one honest live signal it has — the offline pending-write count normalized by `engagementAnalytics` — and MUST render "Not tracked yet" cards for export-format frequency, most-exported setlists, audience scans and geographic data, offline session duration, daily activity heatmap and session-duration trends.

#### Scenario: View most-used export formats
- GIVEN no per-format export counter
- WHEN "Export Analytics" is opened
- THEN a "Not tracked yet" notice is shown.

#### Scenario: View which setlists are exported most frequently
- GIVEN no per-setlist export counter
- WHEN export analytics is opened
- THEN a "Not tracked yet" notice is shown.

#### Scenario: View audience engagement from shared setlists
- GIVEN no audience-scan counter or geo column
- WHEN "Audience Insights" is opened
- THEN a "Not tracked yet" notice is shown.

#### Scenario: View offline usage statistics
- GIVEN only a pending-write count is recorded
- WHEN "Offline Usage" is opened
- THEN the live pending count is shown and session count/duration are "Not tracked yet".

#### Scenario: Daily active usage pattern
- GIVEN no activity timestamp
- WHEN "Usage Patterns" is opened
- THEN a "Not tracked yet" notice is shown.

#### Scenario: App session duration trends
- GIVEN no session-duration record
- WHEN "Session Analytics" is opened
- THEN a "Not tracked yet" notice is shown.
