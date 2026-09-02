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
Hito 1's basic practice view (rendering a song at the performer's practice key/tempo) is a thin slice of the practice surface. The full surface — section-aware metronome, auto-scroll, and recording personal practice sessions that feed analytics — is specified in `features/practice-mode.feature` and is deferred to a later hito, not part of Hito 1's deliverables.

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
Gig planning and the performance-record write path are specified in `features/gigs-and-performance-history.feature` (gig lifecycle, venue reuse, played/skipped record, offline completion); the on-stage presentation consuming it is specified in `features/live-performance-mode.feature`. The PWA runtime that delivers this hito's service-worker and IndexedDB deliverables — background app updates that never interrupt the stage or practice surfaces, and storage management under quota pressure — is specified in `features/pwa-updates-and-storage.feature`.

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
The community surface is specified in `features/public-library-community.feature` (browse, contribute, follow, reputation, reporting); the actor side of its reporting contract — system-appointed community moderators, the moderation queue, keep/remove/escalate decisions, takedown propagation to linked copies, and appeals — is specified in `features/community-moderation.feature`.

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
The integration surface is specified in `features/midi-integration.feature`, `features/external-display.feature`, and `features/obs-overlay.feature`. The foot pedal (Hito 2) hardware surface is specified in `features/foot-pedal-hid.feature`; thematic collection and shared-comment surfaces from Hito 3 are specified in `features/collections.feature` and `features/collaborative-comments.feature`. Spotify auto-tagging is specified in `features/external-autotagging.feature`; in-app feedback is specified in `features/in-app-feedback.feature`; PDF scan charts in `features/pdf-scan-charts.feature`.

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
