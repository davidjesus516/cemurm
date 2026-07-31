Feature: Analytics and Insights
  As a director, organizer, or active performer
  I want to see usage statistics and performance insights
  So that I can make data-driven decisions about my repertoire and events

  ──────────────────────────────────────────────
  PERSONAL PERFORMANCE ANALYTICS
  ──────────────────────────────────────────────

  Scenario: View songs most frequently added to setlists
    Given I have 30 songs in my repertoire
    And I have created 10 setlists over the past 3 months
    When I open "Analytics" in my profile
    Then I see a ranking of my most-used songs
    | Rank | Song | Times in Setlists |
    | 1 | "Amazing Grace" | 8 |
    | 2 | "Bohemian Rhapsody" | 6 |
    | 3 | "Yesterday" | 5 |
    And the top song is highlighted with a star

  Scenario: View my repertoire growth over time
    Given I added 2 songs per week for the last 8 weeks
    When I open "Repertoire Growth" chart
    Then I see a line graph showing songs added per week
    And the x-axis shows weeks and the y-axis shows cumulative song count
    And the peak growth week is highlighted

  Scenario: View my practice hours by instrument
    Given I track practice sessions
    When I open "Practice Analytics"
    Then I see total hours per instrument for the current month
    And the chart shows the trend compared to the previous month
    And "guitar" is my top practice instrument with 12 hours this month

  Scenario: View songs I never performed
    Given I have 40 songs in my repertoire
    When I open "Untouched Songs"
    Then I see songs that have never appeared in any setlist
    And each shows the date it was added to my repertoire
    And I can filter by genre or age ("added more than 6 months ago")

  ──────────────────────────────────────────────
  PERFORMANCE HISTORY
  ──────────────────────────────────────────────

  Scenario: Mark a gig performance and log setlist used
    Given I performed at "Church Sunday Service" on Sunday
    When I mark the setlist "Sunday Worship Set" as played
    Then the performance is recorded with date, venue, and setlist
    And each song in the setlist is marked as "performed at Church Sunday Service"
    And my performance count for the month increments by 1

  Scenario: View performance history timeline
    Given I have 12 performances in the past year
    When I open "Performance History"
    Then I see a chronological timeline of all gigs
    Each entry shows the date, venue, setlist name, and song count
    And I can filter by org, venue type, or month

  Scenario: View song popularity across multiple gigs
    Given I performed "Amazing Grace" at 5 gigs and "Wonderwall" at 2 gigs
    When I view song demand analytics
    Then "Amazing Grace" appears as my most-requested song
    And "Wonderwall" shows as a moderate-demand song
    And a popularity bar chart compares all songs

  Scenario: View average setlist duration over time
    Given I have tracked setlists for 6 months
    When I open "Duration Trends"
    Then I see the average setlist duration per month
    And I can compare the trend to see if my sets are getting longer or shorter

  ──────────────────────────────────────────────
  ORGANIZATION ANALYTICS (Org Admin View)
  ──────────────────────────────────────────────

  Scenario: Org admin views aggregate member activity
    Given I am an admin of "Academia Musical"
    When I open the organization analytics dashboard
    Then I see total members by branch (Madrid: 25, Lima: 18, Bogota: 12)
    And total active users this month (40 active, 15 inactive)
    And average member tenure in days
    And new members joined this month

  Scenario: Org admin views repertoire growth by branch
    Given "Academia Musical" has 3 branches
    When I open "Repertoire Analytics"
    Then I see songs added per branch (Madrid: 120, Lima: 85, Bogota: 45)
    And the org total is 250 system songs plus 30 org-specific additions
    And I can filter by date range to see growth trends per branch

  Scenario: Org admin views event participation metrics
    Given "Academia Musical" ran 4 events this semester
    When I open "Event Analytics"
    Then I see total participants per event
    And I see which events had the highest cross-branch participation
    And the most popular instrument groups per event

  Scenario: Org admin identifies branches that need attention
    Given "Sede Lima" has not created any setlists in 3 months
    When I open the analytics dashboard
    Then Sede Lima shows a warning flag: "Low activity — 7 days since last engagement"
    And I can tap to send a notification to the Lima branch admin

  ──────────────────────────────────────────────
  REPERTOIRE INSIGHTS
  ──────────────────────────────────────────────

  Scenario: View genre distribution of repertoire
    Given I have 50 songs in my repertoire tagged with genres
    When I open "Repertoire by Genre"
    Then I see a pie chart showing distribution
    And gospel: 30%, classical: 40%, folk: 20%, other: 10%
    And I can tap each segment to see the songs in that genre

  Scenario: View key distribution across repertoire
    Given I have songs in multiple keys
    When I open "Key Distribution"
    Then I see a bar chart showing which keys are most used
    And G major and C major are the most common keys in my library

  Scenario: Discover trending songs across the org
    Given I am an org admin for "Academia Musical"
    When I open "Trending in Academia"
    Then I see the 10 most-added songs across all branches this month
    And each song shows which branches added it

  Scenario: Identify gaps in the repertoire by instrument
    Given I have 30 guitar songs and only 5 piano songs
    When I open "Instrument Coverage"
    Then I see a chart showing instrument coverage
    And piano is highlighted as the weakest covered instrument
    And suggestions to search for more piano repertoire are offered

  Scenario: View most recent additions to repertoire
    Given I view "Recent Additions" analytics
    When I see the last 10 songs added
    Then the list is sorted by newest first
    And each shows who added it and when

  ──────────────────────────────────────────────
  EXPORT AND SHARE ANALYTICS
  ──────────────────────────────────────────────

  Scenario: View most-used export formats
    Given I have exported setlists in PDF and ChordPro formats
    When I open "Export Analytics"
    Then I see PDF: 12 exports, ChordPro: 5 exports, ABC: 2 exports
    And the most-used format for my org is PDF

  Scenario: View which setlists are exported most frequently
    Given I export different setlists for different events
    When I open export analytics
    Then "Friday Gig" appears as the most-exported setlist with 12 exports
    And the export frequency correlates with gig frequency

  Scenario: View audience engagement from shared setlists
    Given I shared 3 setlists publicly as QR codes
    When I open "Audience Insights"
    Then I see total scans for each setlist
    And the top-scanned setlist is "Sunday Worship" with 45 scans
    And geographic data (if available) shows where scans occurred

  ──────────────────────────────────────────────
  OFFLINE AND ENGAGEMENT METRICS
  ──────────────────────────────────────────────

  Scenario: View offline usage statistics
    Given I have used the app offline for performances at 3 gigs
    When I open "Offline Usage" analytics
    Then I see offline sessions count, offline songs cached, and offline duration
    And I see that 80% of my offline usage was during gigs

  Scenario: Daily active usage pattern
    Given I have been using the app for 2 weeks
    When I open "Usage Patterns"
    Then I see a heatmap of daily activity
    And I can see that weekdays at 8 AM and weekends at 7 PM are peak usage times

  Scenario: App session duration trends
    Given I have tracked sessions for the last month
    When I open "Session Analytics"
    Then I see average session duration per day
    And I can compare this week's average to last week's average
    And I see that my average session is longest on Sundays (gig preparation days)
