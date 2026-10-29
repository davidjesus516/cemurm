# Internal Operations Console Specification

## Purpose

A staff-only console at `/dashboard` for `system_admin` and `community_moderator`
accounts, from `features/internal-operations-console.feature` (29 scenarios).
It gives staff work a shell of its own — its own sidebar, no member navigation —
and collects the five surfaces that are currently either scattered through the
member app or unreachable: moderation, repertoire promotion, feedback triage,
the member directory, and system health.

Three of those five already have a backend and no client. Two do not have a
backend at all, and their scenarios are marked so in the feature file.

**This spec covers the whole capability, including slices that land in later
PRs.** A requirement here is not a claim that the code exists; it is what the
console MUST do when its slice ships.

## Frozen Decisions

1. **Staff roles are read, never invented.** Access resolves from
   `public.user_roles` (`0001:44` — `'system_admin' | 'community_moderator'`),
   through the same `isSystemAdmin` / `isModerator` pair `useModeration` uses.
   No new role, no new column, no client-side role list.
2. **The two tiers are distinct consoles.** `system_admin` sections MUST be
   absent from a `community_moderator`'s console, and MUST NOT render when the
   route is requested directly. `0020` already makes escalated moderation cases
   `system_admin`-only, and `community-moderation.feature` states that org
   admins hold no community moderation powers.
3. **The console owns its shell.** It renders outside `AppLayout`: no `CardNav`,
   no member footer. `AppLayout` and `CardNav` are not modified by this
   capability.
4. **The console is inside both auth guards.** It registers inside
   `RequireAuth` and inside `RequireGuardianConsent`, as a sibling of the member
   routes. A guardian-consent lock is route-independent by design, and a new URL
   MUST NOT be a way around it.
5. **The class-composition dialect is `cva` + `cn()` over `cem-*` tokens.**
   A second composition dialect beside the BEM classes in
   `src/features/design/components/` is accepted deliberately; both resolve to
   the single token layer in `tailwind.config.js`. No new colour, and no raw
   colour literal, is introduced.
6. **`0033`'s submit-only decision is extended, not reversed.** The
   insert-self and select-self feedback policies are unchanged. A
   `system_admin`-only read is added beside them; a `community_moderator` MUST
   NOT read another member's feedback.
7. **The console's chrome is Tier 1 and its tables are Tier 2**
   (`skills/cemurm-visual-system/SKILL.md`). Tier 2 means no material and no
   decorative shadow, so the template's `shadow-xl` on hover and its
   `inset`-variant `rounded-xl shadow-sm ring-1` MUST be adapted, not ported.
8. **Every console failure is stated in place.** A failed query renders its
   message on that section and MUST NOT blank the console.

## Requirements

### Requirement: Staff access to the console

The system MUST render the console only for a signed-in account whose
`public.user_roles` row carries `system_admin` or `community_moderator`, and
MUST deny it to every other account and to signed-out visitors.

#### Scenario: A system administrator reaches the console

- GIVEN I am signed in and `user_roles` has my id with role `system_admin`
- WHEN I navigate to `/dashboard`
- THEN the console renders with its own sidebar
- AND the member navigation bar is not rendered
- AND I can reach the member app destinations from the console's sidebar

#### Scenario: A community moderator reaches a narrower console

- GIVEN I am signed in and `user_roles` has my id with role `community_moderator`
- WHEN I navigate to `/dashboard`
- THEN the console renders with the sections my tier may use
- AND the `system_admin` sections are absent from my navigation
- AND requesting a `system_admin` section URL directly does not render it

#### Scenario: An ordinary member cannot reach the console

- GIVEN I am signed in with no row in `user_roles`
- WHEN I navigate to `/dashboard`
- THEN the console does not render
- AND I am returned to the member app

#### Scenario: A signed-out visitor cannot reach the console

- GIVEN I am not signed in
- WHEN I navigate to `/dashboard`
- THEN I am redirected to sign in

#### Scenario: A guardian-locked account stays locked

- GIVEN I am signed in with no staff role
- AND my guardian consent is not active
- WHEN I navigate to `/dashboard`
- THEN I am held at the guardian consent lock, as on any other member route

### Requirement: A console shell separate from the member app

The console MUST render its own shell outside `AppLayout`, and the sidebar MUST
be the only primary navigation on screen while it is open.

#### Scenario: The member bar is absent

- GIVEN I am in the console
- THEN the member navigation bar is not rendered
- AND the console's sidebar is the only primary navigation
- AND the content area's width does not depend on the member bar's height

### Requirement: The sidebar collapses to an icon rail

The sidebar MUST support an expanded state and an icon-rail state, and the
chosen state MUST survive a reload.

#### Scenario: Collapse to the icon rail

- GIVEN I am in the console with the sidebar expanded
- WHEN I toggle the sidebar
- THEN it narrows to an icon rail
- AND each icon retains an accessible name
- AND label text is hidden rather than reflowed

#### Scenario: The collapsed state survives a reload

- GIVEN I have collapsed the sidebar
- WHEN I reload the console
- THEN the sidebar is still collapsed

#### Scenario: The keyboard toggles the sidebar

- GIVEN I am in the console
- WHEN I press the sidebar toggle shortcut
- THEN the sidebar toggles
- AND the shortcut MUST NOT be captured while focus is in a text field

### Requirement: The sidebar becomes a drawer on a narrow viewport

Below the console's mobile breakpoint the sidebar MUST NOT occupy the content
area permanently, and MUST be openable as a drawer whose dismissal behaves like
every other overlay in this app.

#### Scenario: Drawer on a narrow viewport

- GIVEN the viewport is narrower than the console's mobile breakpoint
- WHEN I open the console
- THEN the sidebar is not permanently on screen
- AND I can open it as a drawer over the content

#### Scenario: Choosing a destination closes the drawer

- GIVEN the sidebar is open as a drawer
- WHEN I choose a destination
- THEN the drawer closes
- AND the destination renders

#### Scenario: Escape closes the drawer and focus returns

- GIVEN the sidebar is open as a drawer
- WHEN I press Escape
- THEN the drawer closes
- AND focus returns to the control that opened it
- AND the next Tab does not land behind the closed drawer

### Requirement: The active section is marked exactly once

The sidebar MUST mark the current section with the project's single accent, and
MUST NOT mark an entry while a deeper unrelated route is open.

#### Scenario: The active section is marked

- GIVEN I am in the console
- WHEN I open a section
- THEN its navigation entry is marked with the accent
- AND exactly one entry is marked

#### Scenario: A sibling route does not stay marked

- GIVEN the console has a parent route and a child route
- WHEN the child route is open
- THEN the parent entry is not marked in place of the child
- AND `/dashboard` itself is not marked on every console path

### Requirement: The console respects reduced motion

When the operating system requests reduced motion, the sidebar MUST change
state without travel.

#### Scenario: Reduced motion

- GIVEN my system requests reduced motion
- WHEN I open and close the sidebar
- THEN the rail changes width without travel
- AND nothing animates on two axes at once

### Requirement: Moderation from the console

The console MUST present the same moderation queue the member-facing page
presents, honouring the existing two-tier decision rules.

#### Scenario: A moderator works the queue

- GIVEN I am a community moderator with open cases
- WHEN I open the Moderation section
- THEN I see the same queue the member-facing page shows
- AND I can decide an open case

#### Scenario: Escalated cases stay system-administrator only

- GIVEN a case has been escalated
- WHEN I open the Moderation section as a community moderator
- THEN the case is not decidable by me
- AND as a system administrator I can decide it

#### Scenario: Decisions are online-only

- GIVEN I am offline
- WHEN I open the Moderation section
- THEN decisions are unavailable
- AND the console states that rather than failing silently

### Requirement: Repertoire promotion

A `system_admin` MUST be able to promote an organization song to the system
repertoire and demote it back, using the RPCs `0016` already gates on
`system_admin`. An organization owner MUST NOT be able to do either.

#### Scenario: Promote an organization song

- GIVEN I am a system administrator
- AND an organization song is eligible for promotion
- WHEN I promote it from the console
- THEN the song belongs to the system repertoire

#### Scenario: Demote a promoted song

- GIVEN I am a system administrator
- AND a song was promoted from an organization
- WHEN I demote it
- THEN the song returns to its source organization

#### Scenario: An organization owner cannot promote

- GIVEN I am an `org_owner` but not a system administrator
- WHEN I open the Repertoire section
- THEN I cannot promote or demote a song

### Requirement: Feedback triage

A `system_admin` MUST be able to read submitted feedback from other members and
move it through `new` → `triaged` → `closed`, attributing the change. This
requirement **extends** `0033_feedback.sql`, whose header names a *"future
triage surface"* and whose `status` column currently has no writer.

#### Scenario: Read submitted feedback

- GIVEN feedback rows exist from other members
- WHEN I open the Feedback section as a system administrator
- THEN I see those rows, newest first
- AND each shows its kind and its submission time

#### Scenario: A moderator cannot read feedback

- GIVEN I am a community moderator
- WHEN I open the console
- THEN the Feedback section is absent
- AND reading the `feedback` table returns only my own rows

#### Scenario: Triage and close a row

- GIVEN I am a system administrator viewing submitted feedback
- WHEN I mark a row `triaged`
- THEN its stored status is `triaged`
- AND the change carries my id and a timestamp
- WHEN I close it
- THEN its stored status is `closed`
- AND the row is still readable rather than deleted

#### Scenario: Diagnostics follow the reporter's consent

- GIVEN a row was submitted without diagnostics consent
- WHEN I open it
- THEN no device information and no captured errors are shown
- AND a row submitted with consent shows them

### Requirement: Member directory

A `system_admin` MUST be able to search members and see their system role. The
directory MUST NOT expose date of birth, guardian contact details, or
authentication identifiers beyond the display identity.

#### Scenario: Search members

- GIVEN I am a system administrator
- WHEN I search the directory for a display name
- THEN matching members are listed
- AND each result shows its system role when one exists

#### Scenario: Private fields are not exposed

- GIVEN I am viewing the member directory
- THEN no member's date of birth is shown
- AND no guardian contact details are shown

#### Scenario: A moderator cannot browse the directory

- GIVEN I am a community moderator
- WHEN I open the console
- THEN the Member directory section is absent

### Requirement: System health

A `system_admin` MUST be able to review chart storage consumption from the
console.

#### Scenario: Review storage use

- GIVEN I am a system administrator
- WHEN I open the System section
- THEN I see chart storage consumption
- AND I see how many rows the storage bucket holds

### Requirement: The console states its own failures

A failed query MUST render its message on the section that failed, and MUST NOT
blank the console.

#### Scenario: A section fails

- GIVEN a console query fails
- WHEN the section renders
- THEN the failure is stated on that section
- AND the rest of the console still renders
