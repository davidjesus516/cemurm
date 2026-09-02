# CEMURM — MVP Scope & Milestones

## Timeline Overview

| Hito | Months | Focus |
|------|--------|-------|
| 1 | 1–2 | Core Viewer + Auth |
| 2 | 3–4 | Stage Mode |
| 3 | 5–6 | Collaboration |
| 4 | 7–8 | Basic Community |
| 5 | 9–10 | Integrations |
| 6 | 11–12 | Beta Polish |

---

## Feature → Hito Mapping

Every one of the 42 BDD features (`features/*.feature`) is assigned to exactly one hito. Assignments follow dependency logic: a feature ships in the same or a later hito than the features it depends on; prerequisites land early; tightly-coupled surfaces are grouped. `practice-mode` is the only split feature — Hito 1 ships a thin practice-view slice, the full surface (metronome, auto-scroll, session tracking) is Hito 3.

### Hito 1 — Core Viewer + Auth
- `authentication-and-profiles`
- `repertoire-mgmt`
- `setlist-creation`
- `search-and-discovery`
- `song-lifecycle` (song state model underpins Hito 1 CRUD)

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
- **Hito 5 (execution):** `published-plan-freeze`, `congregation-projection`, `substitutions-and-coverage`. These execute a finished plan: publishing a snapshot, projecting lyrics to a congregation display (which rides on the external-display surface from Hito 5), and filling absences via notifications + member base.

Keeping them together in one hito would overload it; the split honors the dependency direction and the Hito 5 external-display dependency for projection.

---

## Hito 1 — Core Viewer + Auth (Months 1–2)

### Objectives
- Build the foundational app shell with routing and authentication
- Implement ChordPro parser and renderer as the primary format
- Enable full CRUD for songs and basic setlist management
- Establish the Supabase backend and database schema

### Deliverables
- [ ] React app with Vite, Tailwind, and React Router
- [ ] Supabase Auth integration (email/password + Google OAuth + GitHub OAuth)
- [ ] ChordPro parser (text → structured data) and renderer (structured data → styled React components)
- [ ] Song CRUD: create, read, update, delete songs
- [ ] Setlist CRUD: create setlists, add/remove/reorder songs
- [ ] Basic search: filter songs by title, artist, genre
- [ ] Basic practice view: render a song at the performer's chosen practice key and tempo (a thin slice of the practice-mode surface; the full metronome, auto-scroll, and session-tracking analytics are deferred to a later hito)
- [ ] Responsive layout: works on desktop, tablet, and mobile
- [ ] Database schema deployed with RLS policies

### Demo Description
A user can sign up with email or Google, create a song by pasting ChordPro text, see it rendered with chords highlighted above lyrics, add it to a setlist, reorder songs in the setlist, and search across their library.

### BDD coverage
Authentication and profile management are specified in `features/authentication-and-profiles.feature`; song and setlist CRUD are specified in `features/repertoire-mgmt.feature` and `features/setlist-creation.feature`; basic search is specified in `features/search-and-discovery.feature`; the song state model (draft/ready/retired/deleted) that underpins CRUD is specified in `features/song-lifecycle.feature`.

Hito 1's basic practice view (rendering a song at the performer's practice key/tempo) is a thin slice of the practice surface. The full surface — section-aware metronome, auto-scroll, and recording personal practice sessions that feed analytics — is specified in `features/practice-mode.feature` and is assigned to Hito 3, not part of Hito 1's deliverables.

### Estimated Team Effort
- 1 frontend developer (full-time, 8 weeks)
- 0.5 backend developer (part-time, 4 weeks — schema setup, RLS, auth config)

---

## Hito 2 — Stage Mode (Months 3–4)

### Objectives
- Create a performance-optimized fullscreen view for live use
- Implement real-time transposition for ChordPro songs
- Add touch, keyboard, and foot pedal navigation
- Enable offline access via Service Workers

### Deliverables
- [ ] Stage Mode: fullscreen, high-contrast display with large text
- [ ] Real-time transposition: transpose chords up/down by semitones
- [ ] Touch navigation: swipe left/right to change songs in setlist
- [ ] Keyboard navigation: arrow keys, Page Up/Down
- [ ] USB foot pedal support (HID protocol)
- [ ] Workbox service worker: precache app shell + cached songs
- [ ] IndexedDB offline store for songs and setlists
- [ ] Background sync for writes made offline

### BDD coverage
Gig planning and the performance-record write path are specified in `features/gigs-and-performance-history.feature` (gig lifecycle, venue reuse, played/skipped record, offline completion); the on-stage presentation consuming it is specified in `features/live-performance-mode.feature`. The PWA runtime that delivers this hito's service-worker and IndexedDB deliverables — background app updates that never interrupt the stage or practice surfaces, and storage management under quota pressure — is specified in `features/pwa-updates-and-storage.feature`. Offline access to repertoire and setlists is specified in `features/offline-access.feature`; per-performer personal key/capo/version adaptation is specified in `features/personal-preferences-and-adaptations.feature`.

### Demo Description
A musician loads a setlist, enters Stage Mode (fullscreen), swipes through songs on an iPad, transposes a song from G to A on the fly, and the app continues working when the venue Wi-Fi drops out.

### Estimated Team Effort
- 1 frontend developer (full-time, 8 weeks)

---

## Hito 3 — Collaboration (Months 5–6)

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
The integration surface is specified in `features/midi-integration.feature`, `features/external-display.feature`, and `features/obs-overlay.feature`. The foot pedal (Hito 2) hardware surface is specified in `features/foot-pedal-hid.feature`; thematic collection and shared-comment surfaces from Hito 3 are specified in `features/collections.feature` and `features/collaborative-comments.feature`. Spotify auto-tagging is specified in `features/external-autotagging.feature`; in-app feedback is specified in `features/in-app-feedback.feature`; PDF scan charts in `features/pdf-scan-charts.feature`. The broader import/export surface — MusicBrainz metadata enrichment, lyrics fetch, and export to stage apps — is specified in `features/external-integrations.feature`. The execution half of the service-week cluster — publishing a plan snapshot, projecting lyrics to a congregation display (riding the Hito 5 external-display surface), and covering absences with substitutes (via the Hito 3 notification base) — is specified in `features/published-plan-freeze.feature`, `features/congregation-projection.feature`, and `features/substitutions-and-coverage.feature`.

### Demo Description
A musician performing live connects a MIDI controller. When they switch songs in CEMURM, the app sends a program change message to their pedalboard. Their OBS stream shows a clean overlay of the current song title and chord progression.

### Estimated Team Effort
- 1 frontend developer (full-time, 8 weeks)
- 0.25 backend developer (part-time, 2 weeks — API integrations)

---

## Hito 6 — Beta Polish (Months 11–12)

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
