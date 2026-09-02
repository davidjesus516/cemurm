# CEMURM Feature Suite — Overview

The BDD specification layer for CEMURM (Community-Centered Musical Repertories Manager): **42 feature files, 656 scenarios** covering the full product surface — from authentication and repertoire management to the complete service week (lifecycle → rehearsal → service → substitution → projection), cross-organization events, per-user musical preferences, the personal practice surface, the community moderation workflow, the PWA update and storage lifecycle, the advanced music theory model (scales, modes, degrees), plus the data-governance and resilience surface: offline edit conflict policy, member offboarding cascade, published plan freeze, minor accounts and guardian consent, and account data export and erasure.

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
| Minor Accounts and Guardian Consent | 10 | Under-18 accounts with guardian consent | Guardian consent, visibility restriction, org-only participation without public exposure |
| Notifications and Activity Feed | 29 | Stay informed in collaboration | Invites, setlist/event alerts, preferences, offline queue |
| Export and Sharing | 23 | Multi-format export + audience sharing | PDF/ChordPro/MusicXML/ABC, QR, audience view, batch ZIP |
| Account Data Export and Erasure | 11 | Data portability + permanent erasure | Full account export, permanent deletion, dependent-content handoff, no silent loss |
| Analytics and Insights | 23 | Data-driven repertoire/event decisions | Personal/org analytics, performance history, engagement |
| Search and Discovery | 22 | Find & explore repertoire | Filters, tags, recommendations, offline search |
| Song Lifecycle | 22 | Song states: draft → ready → retired → deleted | Chart completeness, version history, rollback, retire, duplicates, merge |
| Organizational Repertoire Model | 21 | Hierarchical shared catalog | System/org/branch levels, roles, events, access control |
| Congregation Projection | 19 | Lyrics-only display for the audience | Slide control, transitions, high contrast, projection rights |
| External Integrations and Import | 17 | Bring songs in, send setlists out | MusicBrainz/LRCLIB, OnSong/Planning Center, metadata-only URL, no scraping |
| MIDI Integration | 11 | Control external gear live | Web MIDI, per-song program change, setlist MIDI maps |
| External Display | 11 | Mirror performance to a 2nd screen | Audience-facing view, sync, transpose, offline |
| OBS Overlay | 8 | Clean overlay for streaming | Browser Source URL, title/chords/position, privacy scope |
| Public Library & Community | 16 | Discover + contribute shared songs | Browse, contribute, follow, reputation, reporting |
| Community Moderation | 18 | Actor side of public-library reporting | System moderator role, queue & consolidation, keep/remove/escalate, takedown propagation, appeals, offline report intake |
| PDF Scan Charts | 9 | Store songs as PDF scans | PDF hosting, performance rendering, offline, limits |
| In-App Feedback | 8 | Report bugs/feedback in-app | Bug/general forms, consent, offline queue |
| External Auto-Tagging | 9 | Enrich songs from Spotify | Album art/BPM/key suggestions, provenance |
| Live Performance Mode | 18 | Focused on-stage presentation | Chords/lyrics, navigation, capo/transpose, crash recovery |
| Gigs and Performance History | 18 | Single-org gig + actual-played record | Gig creation, venue reuse, planned→completed lifecycle, played/skipped record, visibility, offline |
| Practice Mode | 20 | Personal practice surface with metronome + auto-scroll | Practice key/tempo projections, precedence, section-aware metronome, auto-scroll, session tracking, offline |
| Service Planning | 17 | Structure the service into blocks | Blocks, musician assignment, call sheet, check-in |
| Published Plan Freeze | 9 | Publishing freezes the executed plan | Freeze boundary, no mid-service drift, member rehearses the published version |
| Substitutions and Coverage | 17 | Cover missing musicians | Sub requests, projection for subs, coverage status, cross-org |
| Cross-Organization Event Collaboration | 16 | Cross-org events with privacy preserved | 3 event types, visibility matrix, orchestral concerts |
| Rehearsal Workflow | 16 | Plan and run rehearsals | Agenda, readiness flags, timebox, outcomes, carry-over |
| User Onboarding | 16 | Guided first-run | Walkthrough, org setup, tours, completion tracking |
| Member Offboarding Cascade | 10 | Clean, coordinated member departure | End org access, preserve personal/public content, transfer/remove coordinated, nothing silently deleted |
| Collaboration — Bandmate Management | 15 | Coordinate via shared repertoire/setlists | Invites, proximity codes (offline), edge cases |
| Shared Setlist Collaboration | 15 | Real-time joint setlist planning | Conflict/locking, offline merge, ownership, version history |
| Offline Edit Conflict Policy | 10 | Deterministic resolution of same-field offline edits | Later-write wins, superseded history, notification, SAME-FIELD vs whole-entity scope |
| Collaborative Comments | 13 | Shared commentary attached to songs | Section-anchored comments, threading, per-version, mentions, offline queue |
| Collections | 14 | Curate + reuse themed song sets | Thematic grouping, fork with lineage, setlist/block fill, sharing |
| Foot Pedal HID | 13 | Hands-free pedal navigation | USB HID pairing, pedal mapping, navigation, robustness |
| Setlist Creation | 4 | Plan gig order | Build, reorder, duplicate, duration |
| Repertoire Management | 4 | Song library CRUD | Add/search/edit/soft-delete |
| Music Notation File Support | 3 | Import/view notation files | ChordPro, MusicXML (OSMD), ABC (abcjs) |
| Music Theory Model | 30 | Advanced scales, modes, degrees | Scale/mode declaration, degree view (derived), modulation, spelling, progression catalog, non-goals |
| Offline Access | 3 | Perform without connectivity | Cached repertoire, pending-sync edits, offline proximity |
| PWA Updates and Storage | 18 | Safe app-update + storage lifecycle for an offline-first PWA | Background update/install, update prompt, no interruption of live use, tooltips after update, offline-write safety, failure handling, storage usage, quota eviction, non-goals |

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
- **Gigs and performance history** — the gig is the single-org performance event: date/time/venue, exactly one linked setlist, and a planned → confirmed → completed/cancelled lifecycle. Completion writes ONE performance record of what was actually played (skipped and off-setlist songs separated) — the write path behind live-performance-mode's post-show "played at" tags and the analytics performance/demand data; gig date/time/location feed the notification reminders; the gig carries the DECISION (which songs actually played) and never creates song versions. Multi-org events stay a separate entity (`cross-organization-event-collaboration`).
- **Practice mode** — the personal practice projection of the same song, distinct from stage rendering. Practice key and tempo are PROJECTIONS of the canonical arrangement (per preferences in `personal-preferences-and-adaptations`), never new versions; practice auto-scroll is the personal variant of the stage flow in `live-performance-mode` and respects per-section meter/tempo from `music-theory`; practice sessions write the "practice hours by instrument" data consumed by the dashboard in `analytics-and-insights`. Sessions are personal and offline-first.
- **Transpose / per-user rendering** — hub is `personal-preferences-and-adaptations`; on-stage transpose lives in `live-performance-mode`; primary instrument/skill level comes from profiles and onboarding.
- **Orchestral / transposing instruments** — dedicated section in `personal-preferences-and-adaptations` (B-flat trumpet renders a whole step up, score stays concert pitch); orchestral event framing in `cross-organization-event-collaboration` and `organizational-repertoire-model`.
- **Collaboration / conflict** — conflict toast, per-song locking, offline merge (`shared-setlist-collaboration`); leader-resolved version/key conflicts (`personal-preferences-and-adaptations`); invite lifecycle (`collaboration-bandmates`).
- **Three render targets** — performer device with chords (`live-performance-mode`), audience phone view with titles only (`export-and-sharing`), congregation display controlled by the operator (`congregation-projection`).
- **Projection rights** — licensing gates the congregation display (`congregation-projection`), following the licensing model in `docs/copyright-policy.md`; imports never scrape chord sites (`external-integrations`).
- **Community moderation** — the actor side of `public-library-community`'s report surface. Community moderators are appointed at the system level (per the `organizational-repertoire-model` role conventions), and org admins get no community moderation powers. Public-library owns the reporter surface (browse, contribute, follow, reputation, reporting); `community-moderation` owns the moderation queue, the keep/remove/escalate decision, reporter+contributor notification, appeals, and takedown propagation to linked copies. Outcomes are delivered through the `notifications` feature, and community moderation never touches org or private repertoire.
- **PWA updates and storage** — the offline-first runtime lifecycle. New app versions install in the background via the service worker and activate on the next app load, never mid-session and never during an active stage or practice session (the no-interruption contract with `live-performance-mode` and `practice-mode`; crash recovery stays owned by `live-performance-mode`). Offline write queues survive updates and keep their sync contract with `offline-access` — queue survival is asserted here, sync mechanics stay owned there. Storage management covers the bulk derived caches (cached PDF scans from `pdf-scan-charts`, cached exports from `export-and-sharing`, whose per-file deletion stays valid) — near-quota eviction is limited to that bulk content and never touches user-authored data.
- **Offline edit conflicts** — `offline-edit-conflict-policy` owns the deterministic rule (later-write wins for same-field edits, superseded edit stays in history, loser notified) that complements the offline-merge story in `shared-setlist-collaboration`; the merge mechanics live there, the explicit conflict-decision policy lives here.
- **Account and data governance** — `member-offboarding` ends org access without touching personal or public content; `account-data-export-and-erasure` gives every user a portable copy or a permanent delete with dependent-content handoff; `minor-accounts-and-guardian-consent` keeps under-18 accounts visibility-restricted within the org. These rely on the identity/org model in `authentication-user-profiles` and `organizational-repertoire-model` and deliver outcomes through `notifications`.
- **Published plan freeze** — `published-plan-freeze` ties the executed plan to the published snapshot: a member rehearses and plays exactly the version that was published, complementing the block/assignment structure in `service-planning` and the rehearsal outcomes in `rehearsal-workflow`.

## Reading order by goal

- **Understand the product's spine:** Personal Preferences → Organizational Repertoire Model → Setlist Creation → Gigs and Performance History → Live Performance Mode.
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
