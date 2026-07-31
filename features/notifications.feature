Feature: Notifications and Activity Feed
  As a user collaborating with my band or organization
  I want to receive timely notifications and view a consolidated activity feed
  So that I stay informed about changes, invitations, and events without missing anything

  ──────────────────────────────────────────────
  INVITATION NOTIFICATIONS
  ──────────────────────────────────────────────

  Scenario: Receive invitation notification as bandmate
    Given I am "Julian" and "Carlos" is the band leader
    When Carlos invites me to join "Acoustic Setlist"
    Then I receive a notification: "Carlos invited you to edit Acoustic Setlist"
    And the notification includes a "View" button
    And the notification includes a "Decline" button

  Scenario: Accept a bandmate invitation via notification
    Given I have a pending invitation from Carlos
    When I tap "View" on the notification
    Then I am taken to the collaboration invitation screen
    And I can accept the invitation
    And once accepted, I appear in Carlos's bandmate list

  Scenario: Decline a bandmate invitation via notification
    Given I have a pending invitation from Carlos
    When I tap "Decline" on the notification
    Then the notification is dismissed
    And Carlos receives a notification that I declined
    And I do not appear in the bandmate list or setlist access is denied

  Scenario: Invitation notification for organization membership
    Given I am receiving an invite to join "Academia Musical" via code
    When I open the notification
    Then it shows the org name, inviter name, and role to be assigned
    And I can join directly from the notification

  ──────────────────────────────────────────────
  SETLIST COLLABORATION NOTIFICATIONS
  ──────────────────────────────────────────────

  Scenario: Notification when a bandmate edits a setlist
    Given I co-edit a setlist "Friday Gig" with Julian
    When Julian reorders songs in the setlist
    Then I receive a push notification: "Julian reordered songs in Friday Gig"
    And my offline badge count increments

  Scenario: Notification when a bandmate adds a song
    Given "Friday Gig" is shared with me
    When Lucia adds "Song X" to the setlist
    Then I receive a notification: "Lucia added Song X to Friday Gig"
    And the notification shows the song's key and tempo if available

  Scenario: Notification when a bandmate changes permissions
    Given I am a bandmate on "Gala Set"
    When the owner changes my role from "edit" to "view only"
    Then I receive a notification: "Your permissions on Gala Set have changed to View Only"
    And my edit controls are disabled in the app

  Scenario: Notification when a bandmate is removed from a setlist
    Given I am a bandmate on "Rehearsal Setlist"
    When the owner removes me from the setlist
    Then I receive: "You have been removed from Rehearsal Setlist"
    And I no longer see the setlist in my collaboration list
    And I do not receive further notifications for it

  ──────────────────────────────────────────────
  EVENT NOTIFICATIONS
  ──────────────────────────────────────────────

  Scenario: Notification when a new event is created that user can participate in
    Given "Academia Musical" creates an event "Festival Primavera"
    And I am a member of the academy
    When the event is published
    Then I receive a notification: "New event: Festival Primavera — 3 days remaining"
    And I can RSVP directly from the notification

  Scenario: Reminder notification before an event
    Given I have RSVP'd "Yes" to "Festival Primavera" on Saturday at 7 PM
    When Friday at 10 AM arrives
    Then I receive a reminder notification: "Festival Primavera is tomorrow at 7 PM"
    And the notification includes the event location

  Scenario: Reminder notification 1 hour before a setlist performance
    Given I am performing in "Friday Gig" at 9 PM
    When 8 PM arrives on Friday
    Then I receive a notification: "Your setlist starts in 1 hour — Friday Gig"
    And the notification includes one-tap access to the setlist in Performance Mode

  Scenario: Notification when setlist changes for an event I participate in
    Given I am performing at "Festival Primavera"
    When the organizer updates the performance order
    Then I receive: "Performance order updated for Festival Primavera"
    And I see what changed in the event details

  ──────────────────────────────────────────────
  SYSTEM & ACCOUNT NOTIFICATIONS
  ──────────────────────────────────────────────

  Scenario: Notification when a pending bandmate is accepted
    Given I sent an invitation to "Marco" 2 days ago
    When Marco accepts the invitation
    Then I receive a notification: "Marco accepted your invitation"
    And Marco now appears in my bandmates list

  Scenario: Notification when a proximity code expires
    Given I generated a proximity code "CEM-7X2K9P" 25 hours ago
    When the code expires
    Then I receive a system notification: "Proximity code CEM-7X2K9P has expired"
    And the notification offers a "Generate New Code" action

  Scenario: Notification when password reset is requested for my account
    Given someone triggers a password reset for my email
    When the reset email is sent
    Then I receive a notification on my logged-in devices (if active)
    And the notification reads: "A password reset was requested for your account"
    If I did not request it, I can tap "Secure my account"

  Scenario: Weekly digest notification
    Given I have opted into weekly digest notifications
    When Monday at 9 AM arrives
    Then I receive a digest notification: "Weekly Recap — 3 new songs added, 2 setlists updated"
    And tapping opens a summary view of the week's changes

  ──────────────────────────────────────────────
  PUSH NOTIFICATION PREFERENCES
  ──────────────────────────────────────────────

  Scenario: User enables or disables push notifications globally
    Given I am in notification settings
    When I toggle the master push notifications switch to off
    Then I receive no push notifications from the app
    But I still see unread badges in the app itself
    When I toggle back to on
    Then push notifications resume immediately

  Scenario: Granular notification category preferences
    Given I want notifications only for setlist changes
    When I open notification preferences
    And I enable only "Setlist Collaboration"
    And I disable "Invitations", "Events", and "System"
    Then I receive push notifications only when setlists are edited by bandmates
    And I do not receive push for event reminders or invitations

  Scenario: Notification quiet hours / Do Not Disturb
    Given I set quiet hours from 10 PM to 7 AM
    When a bandmate edits a setlist at 11 PM
    Then I do not receive a push notification at that time
    When I open the app at 7:05 AM
    Then I see all accumulated notifications from the quiet period
    And the notification summary says "Notifications paused during quiet hours"

  Scenario: Notification channels on mobile OS are respected
    Given the OS notification settings for CEMURM are set to "Silent"
    When the app wants to send a setlist notification
    Then the OS suppresses the sound and vibration
    The notification still appears silently in the notification center

  ──────────────────────────────────────────────
  IN-APP ACTIVITY FEED
  ──────────────────────────────────────────────

  Scenario: In-app activity feed shows recent notifications
    Given I am on the in-app notification center
    When I open the feed
    Then I see all notifications in reverse chronological order
    And each notification shows the timestamp relative to now ("2m ago", "1h ago", etc.)

  Scenario: Mark a single notification as read
    Given I have 3 unread notifications
    When I swipe left on the oldest notification and tap "Mark as read"
    Then that notification's badge is removed
    And the remaining 2 notifications stay unread

  Scenario: Mark all notifications as read
    Given I have 5 unread notifications
    When I tap "Mark all as read"
    Then all 5 notifications are marked as read
    And the unread badge count resets to 0

  Scenario: Notifications are grouped by type in the feed
    Given I have 4 setlist notifications and 2 invitation notifications
    When I open the activity feed
    Then they are grouped under "Setlist Changes" and "Invitations"
    And each group shows the count of unread items

  Scenario: Filter activity feed by category
    Given I open the activity feed
    When I tap the "Invitations" filter
    Then only invitation-related notifications are displayed
    And I can switch to "Setlist Changes" or "Events" or "System"

  Scenario: Notification deep-link navigates to the right screen
    Given I receive a notification "Julian added Song X to Friday Gig"
    When I tap the notification
    Then the app opens the "Friday Gig" setlist
    And highlights Song X in the setlist
    And scrolls to the newly added song's position

  Scenario: Notification count badge on tab icons
    Given I have 3 unread notifications
    When I open the main tab bar
    Then the "Notifications" tab icon shows a badge with "3"
    When I mark one as read
    Then the badge updates to "2"
    When all are read
    Then the badge disappears

  ──────────────────────────────────────────────
  OFFLINE NOTIFICATION HANDLING
  ──────────────────────────────────────────────

  Scenario: Notifications are queued while offline
    Given I am offline
    When a bandmate edits a shared setlist
    Then the notification is queued locally
    And I see a badge with the pending count on my profile
    When I reconnect to the internet
    Then the queued notifications are delivered in order
    And the badge count is updated to reflect actual unread state

  Scenario: Offline notification summary when coming online
    Given I was offline for 4 hours
    During which I missed 8 notifications (3 setlist edits, 2 invitations, 3 system)
    When I reconnect to the internet
    Then I receive a summary notification: "You have 8 pending notifications"
    And the activity feed shows all 8 grouped by type
