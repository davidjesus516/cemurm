# CEMURM Feature Suite — Overview

The BDD specification layer for CEMURM (Community-Centered Musical Repertories Manager): **23 feature files, 420 scenarios** covering the full product surface — from authentication and repertoire management to the complete service week (lifecycle → rehearsal → service → substitution → projection), cross-organization events, per-user musical preferences, and the advanced music theory model (scales, modes, degrees).

The suite's deepest domain is **Personal Preferences and Adaptations**: it owns the canonical-chart vs. personal-rendering model that ties together keys, versions, transpose, vocal range, and conflict resolution across the other features.

## Quick path

1. Start with `personal-preferences-and-adaptations.feature` — it defines the domain's core model.
2. Read `organizational-repertoire-model.feature` — the hierarchical catalog everything else builds on.
3. Browse the rest by concern (table below) as you work on a feature area.
4. To verify a change: implement against the scenarios, then mark the feature as the acceptance contract.

## Feature map

| Feature | Scenarios | Core intent | Key areas |
|---|---|---|---|
| Personal Preferences and Adaptations | 39 | Canonical chart, personal rendering | Transpose/capo, versions, rebase, vocal range, conflicts |
| Authentication and User Profiles | 31 | Secure auth + profile management | Registration, sessions/tokens, org profile, offline auth |
| Notifications and Activity Feed | 29 | Stay informed in collaboration | Invites, setlist/event alerts, preferences, offline queue |
| Export and Sharing | 23 | Multi-format export + audience sharing | PDF/ChordPro/MusicXML/ABC, QR, audience view, batch ZIP |
| Analytics and Insights | 23 | Data-driven repertoire/event decisions | Personal/org analytics, performance history, engagement |
| Search and Discovery | 22 | Find & explore repertoire | Filters, tags, recommendations, offline search |
| Song Lifecycle | 22 | Song states: draft → ready → retired → deleted | Chart completeness, version history, rollback, retire, duplicates, merge |
| Organizational Repertoire Model | 21 | Hierarchical shared catalog | System/org/branch levels, roles, events, access control |
| Congregation Projection | 19 | Lyrics-only display for the audience | Slide control, transitions, high contrast, projection rights |
| External Integrations and Import | 18 | Bring songs in, send setlists out | MusicBrainz/LRCLIB, OnSong/Planning Center, metadata-only URL, no scraping |
| Live Performance Mode | 17 | Focused on-stage presentation | Chords/lyrics, navigation, capo/transpose, crash recovery |
| Service Planning | 17 | Structure the service into blocks | Blocks, musician assignment, call sheet, check-in |
| Substitutions and Coverage | 17 | Cover missing musicians | Sub requests, projection for subs, coverage status, cross-org |
| Cross-Organization Event Collaboration | 16 | Cross-org events with privacy preserved | 3 event types, visibility matrix, orchestral concerts |
| Rehearsal Workflow | 16 | Plan and run rehearsals | Agenda, readiness flags, timebox, outcomes, carry-over |
| User Onboarding | 16 | Guided first-run | Walkthrough, org setup, tours, completion tracking |
| Collaboration — Bandmate Management | 15 | Coordinate via shared repertoire/setlists | Invites, proximity codes (offline), edge cases |
| Shared Setlist Collaboration | 15 | Real-time joint setlist planning | Conflict/locking, offline merge, ownership, version history |
| Setlist Creation | 4 | Plan gig order | Build, reorder, duplicate, duration |
| Repertoire Management | 4 | Song library CRUD | Add/search/edit/soft-delete |
| Music Notation File Support | 3 | Import/view notation files | ChordPro, MusicXML (OSMD), ABC (abcjs) |
| Music Theory Model | 30 | Advanced scales, modes, degrees | Scale/mode declaration, degree view (derived), modulation, spelling, progression catalog, non-goals |
| Offline Access | 3 | Perform without connectivity | Cached repertoire, pending-sync edits, offline proximity |

## The core domain model

**Canonical vs. personal rendering.** The shared arrangement (version) stays canonical; each performer projects it through their own preferences (key offset, capo, annotations). This one split drives most of the suite:

| Layer | Lives in | New version? |
|---|---|---|
| Work (song) | Organizational Repertoire Model | No |
| Version / Arrangement | Organizational Repertoire Model + forks | Yes, with lineage |
| Personal preference (key, capo) | Personal Preferences and Adaptations | No — projection |
| Personal annotations | Personal Preferences and Adaptations | No — overlay |
| Setlist item (agreed key + version) | Setlist Creation / Shared Setlist Collab | Decision, not version |

**Songs move through states** — `draft → ready → retired → deleted` — with readiness (chart completeness) tracked per version (`song-lifecycle`); a ready chart is not the same as a polished performance, which is a rehearsal outcome (`rehearsal-workflow`).

**The service week** flows in dependency order: `song-lifecycle` (is it playable?) → `rehearsal-workflow` (is it tight?) → `service-planning` (blocks, assignments, call sheet) → `substitutions-and-coverage` (who covers the gaps) → `congregation-projection` (lyrics-only display for the audience).

**Key cross-feature relationships:**

- **Versions/arrangements** — org-level arrangements (`organizational-repertoire-model`), per-user version defaults and forks (`personal-preferences-and-adaptations`), per-org arrangements for overlapping repertoire in cross-org events.
- **Setlists and agreed keys** — base setlist ops (`setlist-creation`), real-time collaboration (`shared-setlist-collaboration`), agreed key vs. per-user projection (`personal-preferences-and-adaptations`), performance rendering (`live-performance-mode`).
- **Transpose / per-user rendering** — hub is `personal-preferences-and-adaptations`; on-stage transpose lives in `live-performance-mode`; primary instrument/skill level comes from profiles and onboarding.
- **Orchestral / transposing instruments** — dedicated section in `personal-preferences-and-adaptations` (B-flat trumpet renders a whole step up, score stays concert pitch); orchestral event framing in `cross-organization-event-collaboration` and `organizational-repertoire-model`.
- **Collaboration / conflict** — conflict toast, per-song locking, offline merge (`shared-setlist-collaboration`); leader-resolved version/key conflicts (`personal-preferences-and-adaptations`); invite lifecycle (`collaboration-bandmates`).
- **Three render targets** — performer device with chords (`live-performance-mode`), audience phone view with titles only (`export-and-sharing`), congregation display controlled by the operator (`congregation-projection`).
- **Projection rights** — licensing gates the congregation display (`congregation-projection`), following the licensing model in `docs/copyright-policy.md`; imports never scrape chord sites (`external-integrations`).

## Reading order by goal

- **Understand the product's spine:** Personal Preferences → Organizational Repertoire Model → Setlist Creation → Live Performance Mode.
- **Design the service week:** Song Lifecycle → Rehearsal Workflow → Service Planning → Substitutions and Coverage → Congregation Projection.
- **Design a collaboration flow:** Shared Setlist Collaboration + Notifications + Bandmate Management.
- **Design an organization/scale flow:** Organizational Repertoire Model + Cross-Organization Event Collaboration + Analytics.
- **Work on a specific screen:** start with that feature file, then follow its cross-feature references above.

## Checklist for feature work

- [ ] The scenario's `Given` keys/ranges are mathematically consistent (semitone arithmetic).
- [ ] Personal preference scenarios respect the precedence rule: explicit item key > context > global default.
- [ ] Any new "version" is justified as a structural change — transposition alone is a preference, not a version.
- [ ] Conflict scenarios record a decider and stay reversible.
- [ ] Offline variants exist where a scenario touches collaboration or performance.

## Next step

Implement against the features: pick the area that matters for the current slice, use its scenarios as the acceptance contract, and keep the canonical-vs-personal split intact across features.
