Feature: Authentication and User Profiles
  As a user of CEMURM
  I want to securely register, log in, and manage my profile
  So that I can access my repertoire and collaborate with my community

  ──────────────────────────────────────────────
  REGISTRATION
  ──────────────────────────────────────────────

  Scenario: Register a new personal account
    Given I open the app for the first time
    When I choose "Create Account"
    And I provide email "maria@example.com", display name "Maria", and password "Secure123!"
    And I confirm the password
    Then my account is created
    And I am assigned the default role "performer"
    And I am logged in automatically

  Scenario: Register with an organization (academy branch)
    Given I have an organization invitation code "ACAD-MAD-001"
    When I register with the code
    And I provide email, name, and password
    Then my account is created with role "org_member"
    And I am assigned to "Academia Madrid - Sede Centro"
    And I receive a welcome message with next steps

  Scenario: Email is required and validated on registration
    When I register with email "invalid-email"
    Then the registration form shows "Enter a valid email address"
    And the account is not created

  Scenario: Password strength validation
    When I register with password "123"
    Then the form shows "Password must be at least 8 characters with uppercase, lowercase, and a number"
    When I enter password "StrongP@ss1"
    Then the password strength indicator shows a green checkmark
    And registration can proceed

  Scenario: Email is already registered
    Given "maria@example.com" already has an account
    When a new user tries to register with "maria@example.com"
    Then the form shows "An account with this email already exists"
    And offers a "Log in instead" link

  ──────────────────────────────────────────────
  LOGIN & LOGOUT
  ──────────────────────────────────────────────

  Scenario: Log in with email and password
    Given I have a registered account
    When I enter my email and password
    And I tap "Log In"
    Then I am authenticated and redirected to the dashboard
    And my session token is stored securely

  Scenario: Log in with biometric after initial setup
    Given I have enrolled my fingerprint on the device
    When I log in for the first time with email and password
    Then I am prompted to enable biometric login
    When I enroll and confirm
    Then subsequent logins can use fingerprint

  Scenario: Log out from the current session
    Given I am logged in
    When I tap "Log Out"
    Then my session token is invalidated
    And I am redirected to the login screen
    And cached data remains on the device for offline access

  Scenario: Log out from all devices
    Given I am logged in on my phone and tablet
    When I tap "Log out everywhere" in the settings
    Then all active sessions are revoked
    And I must sign in again on each device

  Scenario: Failed login attempt shows rate limiting
    Given I have failed 3 login attempts
    When I attempt a 4th failed login
    Then the form shows "Too many attempts — try again in 1 minute"
    And the login button is temporarily disabled

  Scenario: Account lockout after excessive failed attempts
    Given I have failed 10 login attempts
    When I attempt another login
    Then the account is temporarily locked for 15 minutes
    And I receive a notification "Account locked — try again later"

  ──────────────────────────────────────────────
  PASSWORD RECOVERY
  ──────────────────────────────────────────────

  Scenario: Request password reset via email
    Given I have a registered account
    When I tap "Forgot Password"
    And I enter my email "maria@example.com"
    Then a reset email is sent to "maria@example.com"
    And the email contains a one-time reset link valid for 1 hour

  Scenario: Reset password with a valid reset link
    Given I received a password reset email
    When I tap the reset link within 1 hour
    Then I am shown a "Create new password" screen
    And I enter a new password that meets strength requirements
    When I confirm the new password
    Then my password is updated
    And I am logged in with the new password

  Scenario: Expired reset link shows an error
    Given I received a reset link 2 hours ago
    When I tap the reset link
    Then the app shows "This reset link has expired"
    And I am prompted to request a new reset email

  Scenario: Reset link already used shows an error
    Given I have already used a reset link successfully
    When I try to use the same link again
    Then the app shows "This reset link has already been used"

  ──────────────────────────────────────────────
  PROFILE MANAGEMENT
  ──────────────────────────────────────────────

  Scenario: Edit display name and avatar
    Given I am logged in
    When I navigate to "My Profile"
    And I change my display name to "Maria Guitar"
    And I upload a new avatar photo
    Then the display name updates across all devices
    And the avatar is synced to my cloud profile

  Scenario: Set default instrument and skill level
    Given I am on my profile edit screen
    When I set my primary instrument to "guitar"
    And I set my skill level to "intermediate"
    Then this information is used for setlist and repertoire recommendations

  Scenario: Link social authentication providers
    Given I registered with email and password
    When I navigate to "Connected Accounts"
    And I tap "Connect Google"
    Then a Google sign-in flow opens
    When I approve the connection
    Then Google is added as a linked auth provider
    And I can now log in with either email/password or Google

  Scenario: Delete my account
    Given I am logged in
    When I navigate to settings and select "Delete Account"
    Then I am warned that deleting is permanent
    And all my data (repertoire, setlists, activity) is scheduled for deletion
    After a 30-day grace period, the account is permanently removed
    During the grace period I can cancel the deletion

  Scenario: Deactivate account temporarily
    Given I want a break from the app but not permanent deletion
    When I deactivate my account
    Then my profile is hidden from collaborators
    And I can reactivate it anytime by logging in with my credentials

  ──────────────────────────────────────────────
  ORGANIZATION PROFILE MANAGEMENT
  ──────────────────────────────────────────────

  Scenario: Organization admin updates org profile
    Given I am an org admin for "Academia Centro"
    When I update the org name to "Academia Centro Music School"
    And I upload a new org logo
    And I update the org address and phone
    Then all org members see the updated profile
    And the changes apply immediately across all branches

  Scenario: Add a new branch/sede to the organization
    Given "Academia Centro" currently has 1 branch in Madrid
    When the admin adds a new branch "Lima"
    Then "Lima" appears in the organization structure
    And the admin can assign branch admins for Lima
    And Lima members see Lima-specific repertoire and settings

  Scenario: Transfer organization ownership
    Given I am the owner of "Academia Norte"
    When I transfer ownership to "Laura" (another org admin)
    Then Laura becomes the new owner
    And I retain admin access but lose ownership controls
    And the transfer is recorded in the activity log

  Scenario: Remove a branch from the organization
    Given "Academia Centro" has a branch "Sede Sur"
    When the admin removes "Sede Sur"
    Then "Sede Sur" is archived (not deleted)
    And former Sede Sur members become unassigned
    And the org's shared repertoire and setlists remain intact

  ──────────────────────────────────────────────
  SESSION & TOKEN MANAGEMENT
  ──────────────────────────────────────────────

  Scenario: Session persists across app restarts
    Given I am logged in
    When I close the app completely
    And I reopen the app
    Then I am still logged in
    And I am redirected directly to the dashboard

  Scenario: Session expires after inactivity
    Given I have been inactive for 30 minutes
    When I reopen the app
    Then I am prompted to re-authenticate
    And biometric login is available if enrolled

  Scenario: Refresh token is used automatically
    Given my access token has expired
    When I make an API request
    Then the app uses the refresh token to obtain a new access token
    And I remain logged in without interruption

  Scenario: Refresh token expires — requires full re-authentication
    Given my refresh token has expired (30 days since last login)
    When I open the app
    Then I am redirected to the login screen
    And must enter my email and password again

  ──────────────────────────────────────────────
  OFFLINE AUTH
  ──────────────────────────────────────────────

  Scenario: Access cached content while offline with valid local session
    Given I am logged in and have a valid cached session
    When I lose internet connection
    Then I can still browse my cached repertoire and setlists
    And biometric login works offline if previously enrolled

  Scenario: Offline session grace period
    Given my access token expired while offline
    When I try to perform an action that requires authentication
    Then the app uses the cached session for up to 24 hours
    After 24 hours offline, I am prompted to reconnect to refresh the session

  Scenario: Offline mode cannot create new org invitations
    Given I am offline and on the bandmates screen
    When I try to invite a new bandmate
    Then the invite is queued locally with a pending sync flag
    And the bandmate receives the pending invitation when the app reconnects
