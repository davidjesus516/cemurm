# User Onboarding Specification

## Purpose

First-time experience from `features/user-onboarding.feature` (16 scenarios): pre-auth welcome walkthrough, organization setup and invite redemption, tutorial hints and guided tours, and completion progress. Source of truth is that feature file; where the build cannot back a scenario with real data or a real write path, the delta spec names the limitation instead of claiming the scenario. Hito 6 N3, ODD `odd/tasks/hito6-n3-product-slice.md` T4–T5.

## Requirements

### Requirement: Welcome walkthrough before sign-in

The system MUST show a 3-slide welcome walkthrough to a visitor with no prior session, with the topics "Manage your repertoire", "Build setlists for gigs" and "Collaborate with your band", forward navigation and a "Get Started" action on the last slide. Skip MUST mark the walkthrough complete and continue to sign-up; a returning user MUST NOT see it again.

#### Scenario: First-time user sees welcome walkthrough
- GIVEN a visitor with no prior session
- WHEN the app opens
- THEN a 3-slide walkthrough with those topics is shown and "Get Started" appears on the last slide.

#### Scenario: User can skip walkthrough and start manually
- GIVEN the visitor is on slide 1
- WHEN "Skip" is tapped
- THEN the walkthrough is marked complete and sign-up is shown.

#### Scenario: Returning user skips walkthrough
- GIVEN onboarding was previously completed
- WHEN the app opens
- THEN the walkthrough does not appear and the dashboard is shown.

### Requirement: Account creation with invite handoff

The system MUST offer email sign-up from the walkthrough and MUST carry a typed invite code entered before sign-in into the setup step. Google sign-up is a declared gap of this build (no OAuth client configured); the invite-code handoff uses `localStorage` because no account exists yet.

#### Scenario: New user creates account during onboarding
- GIVEN the visitor tapped "Get Started"
- WHEN the sign-up form is shown
- THEN email sign-up and an optional invite-code field are available; the code survives navigation to setup.

### Requirement: Organization creation and branches

Any authenticated user MUST be able to create a NEW organization with a primary branch and become its active `org_owner` through the `0051` `SECURITY DEFINER` RPC — authenticated has no direct INSERT grant on `organizations`/`branches`. An active owner/admin of an existing org MUST be able to add further branches through the same migration's `add_org_branch`, which re-checks authority via `private.session_role_in`. Every write MUST emit an `admin_audit_log` row. Assigning a dedicated branch contact admin is a declared gap; the branch row and its city are created.

#### Scenario: New org admin creates an organization
- GIVEN an authenticated user with just an account
- WHEN name "Mi Academia Musical", type "Academy", primary branch "Sede Centro" and city "Madrid" are submitted
- THEN the org, branch and active `org_owner` membership exist and setup advances to the profile step.

#### Scenario: Org admin invites additional branches
- GIVEN the user owns an org with one branch
- WHEN "Sede Lima" with a city is submitted
- THEN the branch exists in the org and the write is audited.

### Requirement: Invite-code generation and redemption

An owner/admin MUST be able to mint an `org_invite` code with a configurable expiry (default 7 days). A new user MUST be able to redeem a live code during registration: the `0050` `SECURITY DEFINER` RPC atomically joins the org as `org_member` on the oldest active branch, consumes the code, re-checks the creator's authority at redemption, and returns only `org_id`, `org_name`, `role`, `branch_id` and `branch_name`. Every rejection path MUST return the same generic message so the RPC is not a code oracle.

#### Scenario: Org invite code is generated for the admin
- GIVEN the user owns an org
- WHEN an invite code with a 7-day default expiry is created
- THEN the code is stored as own-row RLS data and shareable.

#### Scenario: New user joins via organization invite code
- GIVEN a live code for "Mi Academia Musical"
- WHEN it is redeemed
- THEN an active `org_member` membership on "Sede Centro" exists, the code is consumed, and setup advances.

### Requirement: Instrument and skill profile

The setup wizard MUST persist a primary instrument to `profiles.instrument` and a skill level to `preferences.onboarding.skillLevel`. Recommendation of matching songs and setlists is a declared gap — no recommendation engine exists in this build.

#### Scenario: New user chooses their primary instrument
- GIVEN the user is on the profile step
- WHEN "guitar" and "intermediate" are saved
- THEN the values are persisted and setup advances.

### Requirement: Tutorial hints and guided tour

A first-visit setlist hint and a performance-mode hint MUST be mounted as route-level decorators (the target pages are not edited) and MUST NOT reappear once dismissed. A 4-step dashboard tour with step 1–4 instructions MUST be available on first login and re-openable from a help control. The setlist hint is a page-level banner rather than an element-anchored pointer, the performance hint is not version-gated, and tour step 4's "Performance mode" target has no route — all three are declared gaps of this build.

#### Scenario: Contextual tooltip is shown on first visit to setlists
- GIVEN a first-time logged-in user
- WHEN the Setlists route is opened
- THEN the hint is shown and is not shown again after dismissal.

#### Scenario: Guided tour of the dashboard on first login
- GIVEN org setup is complete
- WHEN the dashboard is opened
- THEN a 4-step tour is shown and completion or "Skip Tour" marks it complete.

#### Scenario: Help button re-opens the tour at any time
- GIVEN onboarding is complete
- WHEN the help control is used
- THEN the tour restarts from step 1.

#### Scenario: Tooltip is shown for new features after update
- GIVEN onboarding is complete
- WHEN Performance Mode is first opened
- THEN a hint is shown; version-gating to a specific update is a declared gap.

### Requirement: Completion progress and resume

Onboarding flags MUST be stored in `user_preferences.preferences.onboarding`; a completed account/org/instrument/tour sequence MUST read as 100% complete, and an incomplete sequence MUST show a resume banner on the dashboard. The completion control navigates to the dashboard; a checklist UI and celebration animation are declared gaps.

#### Scenario: Onboarding progress is tracked
- GIVEN all four steps are done
- WHEN progress is read
- THEN it is 100% complete.

#### Scenario: Returning user has incomplete onboarding flagged
- GIVEN registration happened days ago without setup
- WHEN the app opens
- THEN a resume banner is shown and tapping it continues at the last incomplete step.
