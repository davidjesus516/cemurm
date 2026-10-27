# Proposal: A former member must not be able to respond to a substitution request

> Change: `fix-respond-member-guard`
> Source: **finding 1** of the offboarding-cascade record
> (`odd/tasks/offboarding-cascade.md` §"Findings to carry forward"), seeded on 2026-10-14 during
> WU1. Status: proposed → implemented in this change.
> BDD: `features/offboarding-cascade.feature:52` requires former members to be excluded
> "from new substitution candidate lists" — which the DB already enforces at generation time
> (`0023:92`, `m.status = 'active'`). The finding is the *response* side: nothing re-checks
> membership when a candidate responds. The `.feature` file is deliberately **not** edited: the
> scenario's promise is about candidate lists, and the array freezing the old members is a
> documented 0038 boundary. This change closes the hole without contradicting any scenario.

## Problem

`public.respond_substitution` (`0023:219-326`) gates a response on exactly two things: the caller
must appear in the **request's frozen `candidates` array**, and the request must still be `open`.
The array is computed once at request creation from then-active members. If a listed member leaves
the org afterwards (the `0038` cascade auto-cancels **her own** requests, but requests raised by
*others* keep their frozen arrays untouched, by design), she stays a listable candidate on an open
request. Confirming then inserts a `service_assignments` substitute row and covers the part —
a former member of the org serving on the service plan, reachable only through a permission check
the leave was supposed to have closed.

The decline path has the same gate and is reachable by the same road, so both legs must be guarded.

The guard cannot be org-scoped. `features/substitutions-and-coverage.feature`'s cross-org event
coverage — exercised by `scripts/smoke/0023-substitutions.sql` **T10** and by the event-scope branch
of `substitution_candidates` (`0023:57-70`) — legitimately lets a member of a *participating* org
cover a part on a service of the organizing org. A guard hard-coded to the service's org would
break that existing, specified behaviour. The scope has to be the **request's scope**: the
service's org, or every org participating in the event the block's setlist belongs to.

## Approach

`0045_respond_member_guard.sql` recreates `respond_substitution` verbatim from `0023`, with one
addition before the frozen-candidates check: the responder must hold an **active** membership in at
least one org of the request's scope, computed exactly like `substitution_candidates`' scope
(org id, widened to every `event_participants` org when the block's setlist belongs to an event).
Missing membership raises the static literal
`'You are no longer an active member of this organization.'` — phrased after
`overrule_substitution`'s existing literal ('The chosen substitute is not an active member of this
organization.'), since both are membership rejections on the same surface.

The guard runs before the candidates check, so a former member in a stale array receives the
membership rejection — the honest message — rather than a generic candidate mismatch.

Client side, the literal joins `USER_ERRORS` in `src/data/repositories/substitutions.js`, so the
rejection surfaces verbatim (the same seam `offboarding-cascade` slice 4 established for the
assignee guard) and the offline drain classifies it as a permanent rejection
(`src/domain/offline/drainFailure.js` case 7: an unmapped human sentence from a repository is a
client guard that replays identically — quarantine on first failure, no retry loop).

## Delta spec

### Requirement: A substitution response requires an active membership in the request's scope

The system MUST reject a substitution response — accept **and** decline — when the responder holds
no active membership in the request's scope. The request's scope is the service's org; when the
block's setlist belongs to a cross-org event, the scope is every org participating in that event.
The frozen candidates array is evidence of past eligibility, never evidence of present permission.

The rejection MUST be the literal `You are no longer an active member of this organization.`
and MUST precede any state change: no substitute assignment, no `substitution_responses` row
beyond the pending rows `send_substitution_request` already creates, no request state change, no
change log entry.

#### Scenario: A former member in a frozen candidates array is refused

- GIVEN an open substitution request whose frozen candidates array contains a member who has since
  left the org
- WHEN she attempts to accept
- THEN the response is refused with `You are no longer an active member of this organization.`
- AND nothing is written

#### Scenario: The former member is refused on the decline path too

- GIVEN the same membership state
- WHEN she attempts to decline
- THEN the same literal is refused and nothing is written

#### Scenario: A member of another org is not a member of the scope

- GIVEN an org-scoped request and a candidate injected from an org outside the scope
- WHEN he attempts to accept
- THEN he is refused with the same literal — being an active member of *an* org is not being an
  active member of *the request's scope*

#### Scenario: A cross-org event participant still covers

- GIVEN an event-scoped request whose block's setlist belongs to an event with the substitute's org
  as participant
- WHEN the substitute attempts to accept
- THEN the accept succeeds (maintained behaviour: 0023's T10)

#### Scenario: Restoring the membership restores the ability

- GIVEN a former member in a frozen array
- AND her membership is active again
- WHEN she accepts
- THEN the accept succeeds

## Out of scope

- `mark_unavailable`, `cancel_substitution`, `reclaim_assignment`, `overrule_substitution`
  (boundary: `overrule` already carries its own active-member literal).
- The frozen-`candidates` arrays themselves — untouched, per the 0038 record.
- `features/offboarding-cascade.feature` edits — none needed; see the Problem note.
