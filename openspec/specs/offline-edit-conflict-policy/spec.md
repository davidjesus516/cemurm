# Offline Edit Conflict Policy Specification

## Purpose

The equal-timestamp tie-break for offline conflicting writes, and the recording of the applied rule. Source of truth: `features/offline-edit-conflict-policy.feature:47-51` — *"Equal timestamps use the recorded tie-break rule"*, which requires both that the app applies a recorded tie-break rule and that the applied rule is stored with the resolution so every device reaches the same result.

This capability spec covers **only** that tie-break requirement. The rest of `features/offline-edit-conflict-policy.feature` — same-field resolution by the later write (`:10-30`), identical-edit determinism (`:42-46`), conflict surfacing (`:57-72`) and setlist-item replay (`:78-119`) — is specified elsewhere and is not part of this capability's delta yet. Those scenarios are not restated here.

## Requirements

### Requirement: Equal-timestamp conflicts resolve by a recorded tie-break rule

Offline conflicting writes MUST first be ordered by their primary key, the queued timestamp: the write with the later `queuedAt` wins, exactly as the shipped rule already does. This primary order MUST remain unchanged.

When two conflicting writes carry the **same** timestamp, a deterministic secondary order MUST decide the winner, and the same pair MUST resolve to the same winner regardless of the order in which the operations are processed. The **applied rule** MUST be stored with the resolution, so every device can verify it reached the same result. Because the tie-break decision must be computable from data both devices already hold, it MUST NOT require a coordination round-trip.

**The rule identity is a decision, not a Gherkin fact.** `features/offline-edit-conflict-policy.feature:47-51` names *the recorded tie-break rule* and constrains it to determinism; it deliberately does **not** name which rule that is. The rule adopted for this capability is recorded here, so a maintainer can overrule it in one place:

> **Adopted decision:** the secondary order is the per-operation `opKey` uuid compared as a lowercased string; the greater key wins. It is stored in `public.setlist_conflict_resolutions` (migration `0037_offline_tie_break.sql`) and arbitrated server-side by the `apply_setlist_item_op` RPC, with a client mirror in `reconcileSetlistOp`. The key is a genuine total order with no authorship semantics: the offline queue mints it at enqueue (`newOpKey()` in `src/offline/queue.js`), so `(queuedAt, opKey)` orders any two operations.

#### Scenario: Equal timestamps resolve by the recorded rule regardless of drain order

- GIVEN two conflicting writes on "Song A" carry the same timestamp
- WHEN the resolution runs on two devices that process the pair in opposite orders
- THEN both devices apply the same winner under the recorded tie-break rule

#### Scenario: The applied rule is stored with the resolution

- GIVEN an equal-timestamp conflict on "Song A" has been resolved
- WHEN the resolution is recorded
- THEN the applied rule is stored with the resolution so every device can verify it reached the same result

#### Scenario: Replaying the same pair twice reaches the same winner

- GIVEN the same conflicting pair on "Song A" is reconciled twice
- WHEN the outcome of each reconciliation is compared
- THEN both reconciliations select the same winner

#### Scenario: A later timestamp still wins on the primary order

- GIVEN two conflicting writes on "Song A" carry different timestamps
- WHEN the resolution runs
- THEN the write with the later timestamp wins on the primary order and the tie-break rule is not consulted
