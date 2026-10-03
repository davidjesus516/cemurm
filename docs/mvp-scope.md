# CEMURM — MVP Scope & Milestones

## Timeline Overview

| Hito | Months | Focus              |
| ---- | ------ | ------------------ |
| 1    | 1–2    | Core Viewer + Auth |
| 2    | 3–4    | Stage Mode         |
| 3    | 5–6    | Collaboration      |
| 4    | 7–8    | Basic Community    |
| 5    | 9–10   | Integrations       |
| 6    | 11–12  | Beta Polish        |

---

## Feature → Hito Mapping

Every one of the 45 BDD features (`features/*.feature` — 713 scenarios) is assigned to a hito; two features are documented splits (see below). Assignments follow dependency logic: a feature ships in the same or a later hito than the features it depends on; prerequisites land early; tightly-coupled surfaces are grouped. `practice-mode` is the only feature split across hitos by *surface slice* — Hito 1 ships a thin practice-view slice, the full surface (metronome, auto-scroll, session tracking) is Hito 3. `song-lifecycle` is partially split by *scenario class*: Hito 1 covers the state-model scenarios (draft/ready/retired/deleted), and the version-history/rollback and duplicate/merge scenarios are deferred to Hito 3 — same feature file, two maturity tiers (see Hito 1 and Hito 3 notes).

### Hito 1 — Core Viewer + Auth
- `authentication-and-profiles`
- `repertoire-mgmt`
- `setlist-creation`
- `search-and-discovery`
- `song-lifecycle` (the song state model alone — draft/ready/retired/deleted; the heavyweight version-history and duplicate-merge scenarios are deferred to Hito 3)

### Hito 2 — Stage Mode
- `gigs-and-performance-history`
- `live-performance-mode`
- `pwa-updates-and-storage`
- `foot-pedal-hid`
- `offline-access` (offline mode)
- `personal-preferences-and-adaptations` (performer-specific Stage Mode adaptations)

### Hito 3 — Collaboration
- `shared-setlist-collaboration`
- `collaboration-bandmates`
- `collaborative-comments`
- `collections`
- `music-notation`
- `notifications` (collaboration-driven activity; first real consumers are Hito 3 invites/comments/sync events)
- `offline-edit-conflict-policy` (offline base + collaboration version history)
- `practice-mode` (full surface: metronome, auto-scroll, session tracking)
- `song-lifecycle` (Hito 3 picks up the version-history & rollback and duplicate-detection & merge scenarios deferred from Hito 1; Hito 1 covered only the state-model scenarios)

### Hito 4 — Basic Community
- `public-library-community`
- `community-moderation`
- `organizational-repertoire-model` (org/branch base for the org-surface features)
- `minors-and-guardian-consent` (org accounts + public-visibility boundaries)
- `music-theory` (transpose/key base present; advanced-harmony content view)
- `service-planning` (planning half of the service-week cluster)
- `rehearsal-workflow`

### Hito 5 — Integrations
- `midi-integration`
- `external-display`
- `obs-overlay`
- `external-autotagging`
- `in-app-feedback`
- `pdf-scan-charts`
- `external-integrations`
- `congregation-projection` (execution half of the service-week cluster)
- `published-plan-freeze`
- `substitutions-and-coverage`

### Hito 6 — Beta Polish
- `user-onboarding`
- `account-data-export-and-erasure`
- `offboarding-cascade`
- `analytics-and-insights`
- `export-and-sharing`
- `cross-organization-event-collaboration` (advanced cross-org coordination; depends on org + service + performance bases from Hito 4/5)

---

## Service-Week Cluster Rationale

The service-week cluster (`service-planning`, `rehearsal-workflow`, `substitutions-and-coverage`, `congregation-projection`, `published-plan-freeze`, ~77 scenarios) is one coherent surface but is split across Hito 4–5 rather than kept whole. Keeping all 77 scenarios in one 8-week hito alongside its existing scope would be unrealistic. The split follows the natural plan → execute dependency chain:

- **Hito 4 (planning):** `service-planning` + `rehearsal-workflow`. Building a service into blocks/assignments and running rehearsals only needs the org base, setlists, and chart-readiness states — all present by Hito 4.
- **Hito 5 (execution):** `published-plan-freeze`, `congregation-projection`, `substitutions-and-coverage`. These execute a finished plan: publishing a snapshot, projecting lyrics to a congregation display, and filling absences via notifications + member base.

Keeping them together in one hito would overload it; the split follows the plan → execute
dependency direction, which is the real constraint.

> **Correction (2026-09-30) — the projection/display dependency claim was wrong.** This section
> previously ended "…and the split honors … the Hito 5 external-display dependency for
> projection", asserting that `congregation-projection` *rides on the external-display surface*.
> `docs/master-plan.md` §2 flagged it as unverified and probably wrong. It is now settled: **the
> two surfaces are independent, by design and in code.**
>
> - **The Gherkin says so directly.** `features/external-display.feature:44` is the scenario
>   *"External display vs congregation projection are separate targets"*, whose final assertion is
>   that using the external display "does not reconnect or override the congregation projection
>   target". `features/congregation-projection.feature` likewise separates projection from the
>   audience phone view.
> - **The code confirms it.** There is no edge in either direction. `ExternalDisplay.jsx` imports
>   only `data/repositories/externalDisplay.js`; `Projection.jsx` imports only
>   `data/repositories/projection.js`. They have separate repositories, separate components
>   (`stage/components/ExternalDisplayView.jsx` vs `projection/components/SlideView.jsx`),
>   separate feature directories, and separate routes (`/external-display` vs
>   `/services/:id/projection` + `/projection/display`).
>
> What this means for sequencing: congregation-projection can be built and merged without the
> external-display surface, and vice versa. That is why treating the four Hito 5 branches as
> independent was the right call. Note this is the **opposite** of what the old sentence claimed,
> so the Hito 4/5 split rationale must be read as resting on the plan → execute ordering alone.

---

## Hito 1 — Core Viewer + Auth (Months 1–2)

**Implementation status: complete** — email/password auth (GoTrue), ChordPro parsing/rendering, song/setlist CRUD + search against hosted Supabase (data layer + read-through offline cache, PR #87), practice view, schema + owner-scoped RLS deployed (`supabase/migrations/`). Caveats: Google/GitHub OAuth pending; PWA runtime and full BDD scenario coverage tracked per feature on follow-up hitos.

### Objectives
- Build the foundational app shell with routing and authentication
- Implement ChordPro parser and renderer as the primary format
- Enable full CRUD for songs and basic setlist management
- Establish the Supabase backend and database schema

### Deliverables
- [x] React app with Vite, Tailwind, and React Router
- [x] Supabase Auth integration (email/password live; Google + GitHub OAuth pending — all external providers are disabled in `supabase/config.toml`)
- [x] ChordPro parser (text → structured data) and renderer (structured data → styled React components)
- [x] Song CRUD: create, read, update, delete songs (hosted Supabase — `src/lib/songs.js`)
- [x] Setlist CRUD: create setlists, add/remove/reorder songs (hosted Supabase — `src/lib/setlists.js`)
- [x] Basic search: filter songs by title, artist, genre (local filters — `src/lib/search.js`)
- [x] Basic practice view: render a song at the performer's chosen practice key and tempo (a thin slice of the practice-mode surface; the full metronome, auto-scroll, and session-tracking analytics are deferred to a later hito)
- [x] Responsive layout: works on desktop, tablet, and mobile
- [x] Database schema deployed with RLS policies (48 tables, 6 enums, 34 policies — `supabase/migrations/`)

### Demo Description
A user can sign up with email (Google/GitHub OAuth pending), create a song by pasting ChordPro text, see it rendered with chords highlighted above lyrics, add it to a setlist, reorder songs in the setlist, and search across their library.

### BDD coverage
Authentication and profile management are specified in `features/authentication-and-profiles.feature`; song and setlist CRUD are specified in `features/repertoire-mgmt.feature` and `features/setlist-creation.feature`; basic search is specified in `features/search-and-discovery.feature`; the song state model (draft/ready/retired/deleted) that underpins CRUD is specified in `features/song-lifecycle.feature`. Hito 1 covers only the state-model scenarios of that file — chart readiness (draft↔ready with the "missing lyrics / missing base key / no chord chart" validations and per-version readiness) and retire/archive/reactivate. The feature's version-history & rollback scenarios and its duplicate-detection & merge scenarios are **deferred to Hito 3** (they are collaboration-grade work — immutable version audit trails and merge lineage — outside Hito 1's "state model underpins CRUD" scope).

Hito 1's basic practice view (rendering a song at the performer's practice key/tempo) is a thin slice of the practice surface. The full surface — section-aware metronome, auto-scroll, and recording personal practice sessions that feed analytics — is specified in `features/practice-mode.feature` and is assigned to Hito 3, not part of Hito 1's deliverables.

### Estimated Team Effort
- 1 frontend developer (full-time, 8 weeks)
- 0.5 backend developer (part-time, 4 weeks — schema setup, RLS, auth config)

---

## Hito 2 — Stage Mode (Months 3–4)

**Implementation status: core complete.** Stage Mode (route + fullscreen UI + transpose + keyboard/touch) and offline access (service worker, IndexedDB read cache + offline write queue) are implemented against the hosted Supabase data layer. Foot pedal uses the WebHID API with default left=previous / right=next mapping persisted in `device_configs`; the settings/mapping-UI and long-press action scenarios are later milestones. Remaining: real-device HID testing (needs a physical pedal + `chrome://flags` HID) and browser-level offline QA.

### Objectives
- Create a performance-optimized fullscreen view for live use
- Implement real-time transposition for ChordPro songs
- Add touch, keyboard, and foot pedal navigation
- Enable offline access via Service Workers

### Deliverables
- [x] Stage Mode: fullscreen, high-contrast display with large text
- [x] Real-time transposition: transpose chords up/down by semitones
- [x] Touch navigation: swipe left/right to change songs in setlist
- [x] Keyboard navigation: arrow keys, Page Up/Down
- [x] USB foot pedal support (HID protocol)
- [x] Service worker: precache app shell + cached songs (SW app-shell + IndexedDB read-through)
- [x] IndexedDB offline store for songs and setlists
- [x] Background sync for writes made offline (client FIFO queue + drain on reconnect)

### BDD coverage
Gig planning and the performance-record write path are specified in `features/gigs-and-performance-history.feature` (gig lifecycle, venue reuse, played/skipped record, offline completion); the on-stage presentation consuming it is specified in `features/live-performance-mode.feature`. The PWA runtime that delivers this hito's service-worker and IndexedDB deliverables — background app updates that never interrupt the stage or practice surfaces, and storage management under quota pressure — is specified in `features/pwa-updates-and-storage.feature`. Offline access to repertoire and setlists is specified in `features/offline-access.feature`; per-performer personal key/capo/version adaptation is specified in `features/personal-preferences-and-adaptations.feature`.

### Demo Description
A musician loads a setlist, enters Stage Mode (fullscreen), swipes through songs on an iPad, transposes a song from G to A on the fly, and the app continues working when the venue Wi-Fi drops out.

### Estimated Team Effort
- 1 frontend developer (full-time, 8 weeks)

---

## Hito 3 — Collaboration (Months 5–6)

**Implementation status: complete** — band collaboration (shared setlists, bandmates, comments) and notifications shipped and archived: `openspec/changes/archive/2026-09-18-hito-3-band-collaboration/`, `openspec/changes/archive/2026-09-19-hito-3-notifications/`. Still outstanding from the Hito 3 feature list: MusicXML/ABC notation (`music-notation`), thematic collections, and the full practice-mode surface (metronome, auto-scroll, session tracking).

### Objectives
- Enable real-time collaboration on setlists between band members
- Add annotation/comment system on songs
- Introduce MusicXML support for full notation rendering
- Build thematic collections feature

### Deliverables
- [ ] Shared setlists: invite bandmates via link or email
- [ ] Real-time setlist sync via Supabase Realtime (WebSocket)
- [ ] Annotations: comments and notes on specific songs or timestamps
- [ ] MusicXML renderer using OpenSheetMusicDisplay
- [ ] ABC notation support via abcjs
- [ ] Collections: curate themed song sets (e.g., "Jazz Standards", "Wedding Set")
- [ ] Collection browsing and forking

### Demo Description
Two bandmates open the same setlist. One adds a song — it appears instantly on the other's screen. They leave annotations ("slower intro", "key change here"). A third member creates a "Holiday Set" collection that others can browse and copy songs from.

### BDD coverage
Real-time shared setlists are specified in `features/shared-setlist-collaboration.feature`; bandmate management in `features/collaboration-bandmates.feature`; annotations and comments in `features/collaborative-comments.feature`; themed collections and forking in `features/collections.feature`. Notation imports (MusicXML via OpenSheetMusicDisplay, ABC via abcjs, ChordPro) are specified in `features/music-notation.feature`. The activity feed and notification delivery that back Hito 3's invites and comments are specified in `features/notifications.feature`; the explicit same-field conflict resolution for offline collaborative edits is specified in `features/offline-edit-conflict-policy.feature`. The full practice surface (section-aware metronome, auto-scroll, and session recording) that Hito 1 only slices is specified in `features/practice-mode.feature`.

### Estimated Team Effort
- 1 frontend developer (full-time, 8 weeks)
- 0.25 backend developer (part-time, 4 weeks — Realtime setup, storage policies)

---

## Hito 4 — Basic Community (Months 7–8)

**Implementation status: complete** — public library (S4.1, PRs #125–#127), contributions/profiles/follows (S4.2, PRs #131, #136), community moderation (#138), org repertoire (#139), music theory (#137), minors & guardian consent, service planning, and rehearsal workflow are merged on main (migrations through `0019_rehearsal_workflow.sql`). Caveats: the URL-importer deliverable (MusicBrainz/LRCLIB metadata fetch) is not shipped — it rides the Hito 5 integrations surface.

### Objectives
- Build a public library of public domain and community-contributed songs
- Enable importing songs from URLs
- Create user profiles with public song libraries
- Implement basic reputation/engagement system

### Deliverables
- [ ] Public library: browsable catalog of public domain songs (bootstrapped from IMSLP/Wikifonia)
- [ ] URL importer: paste a URL to fetch song metadata (MusicBrainz, LRCLIB for lyrics)
- [ ] User profiles: public page showing user's songs, setlists, collections
- [ ] Follow/subscribe to other musicians
- [ ] Basic reputation: contribution count, collections curated
- [ ] Content reporting mechanism

### BDD coverage
The community surface is specified in `features/public-library-community.feature` (browse, contribute, follow, reputation, reporting); the actor side of its reporting contract — system-appointed community moderators, the moderation queue, keep/remove/escalate decisions, takedown propagation to linked copies, and appeals — is specified in `features/community-moderation.feature`. The hierarchical org/branch repertoire model that underpins the org-surface features is specified in `features/organizational-repertoire-model.feature`; org accounts for under-18 students with guardian consent and visibility restrictions are specified in `features/minors-and-guardian-consent.feature`. Advanced scale/mode/degree harmony views are specified in `features/music-theory.feature`. The planning half of the service-week cluster — structuring a service into blocks and running rehearsals against setlists — is specified in `features/service-planning.feature` and `features/rehearsal-workflow.feature`; the execution half (freeze, projection, substitution) lands in Hito 5.

### Demo Description
A new user browses the public library, finds "Amazing Grace" in ChordPro format, adds it to their setlist. They import a song from a URL, and the metadata (artist, key, BPM) is auto-filled. Other users can see their public profile and curated collections.

### Estimated Team Effort
- 1 frontend developer (full-time, 8 weeks)
- 0.5 backend developer (part-time, 4 weeks — import pipeline, indexing)

---

## Hito 5 — Integrations (Months 9–10)

**Implementation status: complete (verified 2026-10-02 against `main` = `e849738`; originally
2026-09-30 against `762a040`).** All ten
Hito 5 features are implemented and merged. Migrations `0021`–`0033` are on `main`, contiguous
with no gap, alongside the earlier `0023`–`0028` run:

| Capability | Migration | Landed in |
|---|---|---|
| `published-plan-freeze` | `0021_plan_freeze.sql` | #192, #193 |
| `congregation-projection` | `0022_projection.sql` | #181, #182, #186, #188, #189 |
| `substitutions-and-coverage` | `0023_substitutions.sql` | #147 |
| `midi-integration` | `0024_midi_program.sql` | #148 |
| `obs-overlay` | `0025_overlay_sessions.sql`, `0032_overlay_access_token.sql` | #155, #225 |
| `external-integrations` / `external-autotagging` | `0026_external_enrichment.sql` | #156 |
| `pdf-scan-charts` | `0027_pdf_chart_storage.sql` | #159 |
| import pipeline (feeds `external-display`) | `0028_import_pipeline.sql` | #165 |
| `in-app-feedback` | `0033_feedback.sql` | #190, #191, #228 |
| minors fail-closed (DOB step, guardian email) | `0029`, `0030`, `0031` | #203 |

> **Correction to the previous status line**, which said Hito 5 was "in progress" and that the
> plan-freeze chain (migrations `0020`–`0022`) was "NOT merged to main". That was true when written
> and is false now. The plan-freeze chain merged via #192/#193; the feedback migration was
> renumbered twice on its way in (`0020` → `0029` → `0033`, because `0029` was claimed by an
> unrelated change) and landed as `0033_feedback.sql` in #228. `0020_review_batch1.sql`,
> `0021_plan_freeze.sql` and `0022_projection.sql` are all on `main`; the `0020`–`0022` window is
> closed and the next free migration number is `0034`. Branch refs such as
> `origin/feat/hito5-plan-freeze` still exist and are still unmerged as *refs* — the work reached
> `main` by a different route, which is what the numbering trail records.

### Objectives
- Enable Web MIDI integration for program change commands
- Support external display output for dual-screen setups
- Build OBS overlay for streaming musicians

### Deliverables
- [ ] Web MIDI: send program change messages to hardware/software synths
- [ ] External display API: mirror Stage Mode to a second screen
- [ ] OBS Browser Source overlay: show current song, chords, and setlist position
- [ ] Spotify integration: fetch album art, BPM, and key for auto-tagging songs
- [ ] LRCLIB integration: auto-fetch synchronized lyrics

### BDD coverage
The integration surface is specified in `features/midi-integration.feature`, `features/external-display.feature`, and `features/obs-overlay.feature`. The foot pedal (Hito 2) hardware surface is specified in `features/foot-pedal-hid.feature`; thematic collection and shared-comment surfaces from Hito 3 are specified in `features/collections.feature` and `features/collaborative-comments.feature`. Spotify auto-tagging is specified in `features/external-autotagging.feature`; in-app feedback is specified in `features/in-app-feedback.feature`; PDF scan charts in `features/pdf-scan-charts.feature`. The broader import/export surface — MusicBrainz metadata enrichment, lyrics fetch, and export to stage apps — is specified in `features/external-integrations.feature`. The execution half of the service-week cluster — publishing a plan snapshot, projecting lyrics to a congregation display (**an independent surface from the personal external display**, see the correction in "Service-Week Cluster Rationale"), and covering absences with substitutes (via the Hito 3 notification base) — is specified in `features/published-plan-freeze.feature`, `features/congregation-projection.feature`, and `features/substitutions-and-coverage.feature`.

### Demo Description
A musician performing live connects a MIDI controller. When they switch songs in CEMURM, the app sends a program change message to their pedalboard. Their OBS stream shows a clean overlay of the current song title and chord progression.

### Estimated Team Effort
- 1 frontend developer (full-time, 8 weeks)
- 0.25 backend developer (part-time, 2 weeks — API integrations)

---

## Hito 6 — Beta Polish (Months 11–12)

**Implementation status: not started.**

### Objectives
- Optimize performance across all devices
- Polish UI/UX based on beta feedback
- Fix bugs and edge cases
- Prepare documentation for public launch

### Deliverables
- [ ] Performance audit: Lighthouse score > 90 on all metrics
- [ ] Accessibility audit: WCAG 2.1 AA compliance
- [ ] UI polish: animations, transitions, loading states
- [ ] Bug fix sprint from beta feedback
- [ ] Beta documentation: user guide, FAQ, keyboard shortcuts reference
- [ ] Onboarding flow: first-time user tutorial
- [ ] Error boundaries and graceful degradation
- [ ] Analytics dashboard (privacy-respecting, e.g., Plausible)

### BDD coverage
The first-time welcome flow is specified in `features/user-onboarding.feature`. Pre-release data-compliance surfaces — full account export/erasure and the org member offboarding cascade — are specified in `features/account-data-export-and-erasure.feature` and `features/offboarding-cascade.feature`. User-facing repertoire/practice analytics (most-used songs, repertoire growth, practice hours) that aggregate data produced in earlier hitos (setlists from Hito 1, practice sessions from Hito 3, gigs from Hito 2) are specified in `features/analytics-and-insights.feature` (distinct from the product-telemetry dashboard above). Setlist/repertoire export and sharing in printable and interoperable formats are specified in `features/export-and-sharing.feature`. The most advanced coordination surface — cross-organization events that preserve each org's repertoire privacy and ownership — is specified in `features/cross-organization-event-collaboration.feature`; it is last because it depends on the org model (Hito 4), service planning (Hito 4/5), shared-setlist collaboration (Hito 3), and repertoire ownership (Hito 1) being in place.

### Demo Description
A beta tester installs the PWA on their phone, goes through the onboarding tutorial, creates their first setlist, performs live with Stage Mode, and reports a bug via the in-app feedback form. The app scores 95+ on Lighthouse across Performance, Accessibility, Best Practices, and SEO.

### Estimated Team Effort
- 1 frontend developer (full-time, 8 weeks)
- 0.5 QA/design (part-time, 4 weeks — testing, feedback triage)
- 0.25 technical writer (part-time, 4 weeks — docs)

---

## Milestone Summary

| Hito | Duration | Key Milestone | Success Criteria |
|------|----------|---------------|-----------------|
| 1 | 2 months | Core Viewer | User can sign in, create songs, manage setlists |
| 2 | 2 months | Stage Mode | Performer can use app live, offline, with transposition |
| 3 | 2 months | Collaboration | Bandmates can share and annotate setlists in real-time |
| 4 | 2 months | Community | Public library exists, users can contribute and discover |
| 5 | 2 months | Integrations | MIDI control, external display, OBS overlay work |
| 6 | 2 months | Beta Ready | App is polished, documented, and ready for public beta |

---

## Progress Log

| Date | PR | Change | Status |
|------|----|--------|--------|
| 2026-09-14 | #82 | Hito 1 core: Supabase GoTrue auth behind unchanged auth surface | Merged |
| 2026-09-14 | #87 | Hito 2: Stage Mode (fullscreen, transpose, touch/keyboard/foot-pedal navigation) + offline-first (service worker, IndexedDB read-through cache + write queue) + data layer on hosted Supabase with RLS | Merged |
| 2026-09-18 | — | Hito 3: band collaboration (shared setlists, bandmates, comments) — archived `openspec/changes/archive/2026-09-18-hito-3-band-collaboration/` | Merged (archived) |
| 2026-09-19 | — | Hito 3: notifications — archived `openspec/changes/archive/2026-09-19-hito-3-notifications/` | Merged (archived) |
| 2026-09-19 | #131, #136 | Hito 4: S4.2 contributions, profiles, follows | Merged |
| 2026-09-20 | #125–#127 | Hito 4: S4.1 public library (browse/contribute + seed catalog) | Merged |
| 2026-09-20 | #137, #138, #139 | Hito 4: music theory, community moderation, org repertoire | Merged |
| 2026-09-20 | branch | Hito 4: minors & guardian consent, service planning, rehearsal workflow (merged via branches) | Merged |
| 2026-09-21 → 2026-09-24 | branch | Hito 5 backend + integrations: migrations `0023_substitutions`, `0024_midi_program`, `0025_overlay_sessions`, `0026_external_enrichment`, `0027_pdf_chart_storage`, `0028_import_pipeline` (merged via branches) | Merged |
| — | 3/10 chain | Hito 5: `feat/hito5-plan-freeze` in progress (PR 3/10, not merged) | Superseded — see row below |
| 2026-09-25 → 2026-09-29 | #192, #193 | Hito 5: plan-freeze chain merged — `0021_plan_freeze.sql` plus the freeze RPC wrappers and publish UI (the chain previously stuck at 3/10) | Merged |
| 2026-09-25 → 2026-09-29 | #181, #182, #186, #188, #189 | Hito 5: congregation projection merged — `0022_projection.sql` plus operator console, display, slides and entry point | Merged |
| 2026-09-25 → 2026-09-29 | #190, #191, #228 | Hito 5: in-app feedback merged — data layer, UI, and `0033_feedback.sql` after the `0020` → `0029` → `0033` renumbering | Merged |
| 2026-09-29 | #203, #225 | Hito 4/5 guardrails: minors fail-closed (`0029`–`0031`) and the OBS overlay access token (`0032`) | Merged |
| 2026-09-30 | #272 | `docs`: closed the `0020`–`0022` numbering question; next free migration number is `0034` | Merged |
| 2026-10-01 | #236, #273 | deps: Vite `^5.3.3`→`^6.4.3` and Vitest `^3.2.7`→`^5.0.2` moved as a pair (Vitest declares Vite as a peer), with the pairing rule documented in `AGENTS.md` | Merged |
| 2026-10-02 | #274, #275 | moderation wiring: my-cases query + system-admin appeal surface in the data layer, then decisions and appeals through the queue, case detail and own cases in the UI | Merged |
| 2026-10-02 | #276 | `docs`: merge-queue drain findings recorded — backlog items 10–14 plus `odd/tasks/merge-queue-drain-and-findings.md` | Merged |

### Planned vs. implemented (as of 2026-10-02, against `main` = `e849738`; originally 2026-09-30 against `762a040`)

> **Read the hito status lines with a caveat.** The per-hito paragraphs above were written when
> the data layer was a hosted Supabase project and say "shipped against hosted Supabase". That is
> a pre-localisation artifact: the project is **not** linked to a hosted project today and runs
> against the local stack (`docs/local-dev.md`). Those sentences describe the deliverable, not the
> current deployment, and the dates on which each hito merged are still correct.

- **Hito 1 — Core Viewer + Auth: complete.** Song/setlist CRUD and search run against hosted Supabase (no localStorage mocks); owner-scoped RLS covers auth, songs, setlists, and chart content. Remaining caveats: Google/GitHub OAuth providers disabled in `supabase/config.toml`.
- **Hito 2 — Stage Mode: core complete.** Stage Mode and offline access shipped in #87 (8/8 deliverables; `public/sw.js` + IndexedDB cache/queue live). Remaining caveats: real-device HID testing requires a physical foot pedal + `chrome://flags` HID; browser-level offline QA and PWA background-update UX are follow-up work under `pwa-updates-and-storage`.
- **Hito 3 — Collaboration: complete.** Band collaboration (shared setlists, bandmates, comments) and notifications shipped and archived (`openspec/changes/archive/2026-09-18-hito-3-band-collaboration/`, `2026-09-19-hito-3-notifications/`). Outstanding from the original feature list: MusicXML/ABC notation, thematic collections, and the full practice-mode surface.
- **Hito 4 — Basic Community: complete.** Public library (S4.1 #125–#127), contributions/profiles/follows (S4.2 #131/#136), music theory (#137), community moderation (#138), org repertoire (#139), minors & guardian consent, service planning, and rehearsal workflow are merged on main (migrations through `0019_rehearsal_workflow.sql`). The URL-importer deliverable is not shipped — it rides Hito 5's integrations surface.
- **Hito 5 — Integrations: complete.** All ten features are merged on `main`: migrations `0021`–`0033` (contiguous, no gap). Plan-freeze landed via #192/#193, congregation projection via #181/#182/#186/#188/#189, in-app feedback via #190/#191/#228 (as `0033_feedback.sql` after two renumberings), and the earlier `0023`–`0028` run via #147/#148/#155/#156/#159/#165. ODD execution records exist in `odd/tasks/hito5-*.md`; the one gap is `external-display`, which has no ODD record yet. Deliverable-level caveats: the Spotify/MusicBrainz/LRCLIB clients run against a deterministic **mock** until live flags are set, and the OBS overlay is token-gated with no deploy pipeline behind it.
- **Hito 6 — Beta Polish: not started.** No implementation for any of its six features. Planned for months 11–12; `docs/master-plan.md` §4 sequences it by privacy obligation first (`offboarding-cascade`, `account-data-export-and-erasure`).
