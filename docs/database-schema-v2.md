# CEMURM — Database Schema v2 (Proposal)

Status: **DRAFT — supersedes `docs/technical-spec.md` §4 if approved.** Written against the 37-feature/607-scenario Gherkin suite (`features/*.feature`), not against the tech-spec's own §4, which covers ~5 tables and an owner-only RLS model that cannot express the org/branch/public visibility the suite demands.

Conventions: PostgreSQL 15 (Supabase). UUID PKs (`gen_random_uuid()`), `TIMESTAMPTZ` time columns, `jsonb` for flexible/personal data, native enums for small closed domains, FKs with `ON DELETE` rules chosen per relationship. All rich text (charts, lyrics) stored as text / object storage — no binary blobs in the DB. Object storage (Supabase Storage / R2) holds chart files and avatars; tables only store object keys. No test framework, no implementation — this is a data model contract.

---

## 1. Entity inventory

42 entities grouped by domain. "Requires" cites the `.feature` file(s) whose scenarios cannot be served without storing the entity. Visibility = the scope the entity anchors to for RLS (see §3). One entity — **event** — requires an EXTRA column (3 event types) the specs do not settle; marked accordingly (resolved 2026-09-01: one `events` table + `type` — see §4 D2).

### 1.1 Tenancy spine

| # | Entity | Purpose | Requires | Visibility scope |
|---|--------|---------|----------|------------------|
| 1 | `organizations` | Registered org (church, academy, orchestra); root of the tenant hierarchy | organizational-repertoire-model, authentication-and-profiles, user-onboarding | system |
| 2 | `branches` | Sub-unit of an org (Sede Madrid / Lima / Bogota); independent repertoire visibility | organizational-repertoire-model, search-and-discovery, gigs-and-performance-history | branch (under org) |
| 3 | `org_memberships` | User ↔ org/branch membership with role and lifetime ("former" state survives membership end) | organizational-repertoire-model, authentication-and-profiles, notifications | system (cross-org identity), per-role at org/branch |
| 4 | `roles` | Closed role set across system/org/branch levels: system_admin, community_moderator (system-appointed), org_owner, org_admin, branch_admin, instructor, org_member, performer, substitute, backstage_coordinator, event_coordinator | organizational-repertoire-model, community-moderation, cross-organization-event-collaboration, service-planning | system |
| 5 | `users` | Global identity over `auth.users` (profile: display name, avatar, primary instrument, skill level, vocal range manual preference, public profile for the community) | authentication-and-profiles, public-library-community, personal-preferences-and-adaptations | system (cross-org), public |
| 6 | `org_invite_codes` | Org/band invite codes with expiration (default 7 days; proximity codes 24 h) | user-onboarding, authentication-and-profiles, export-and-sharing, collaboration-bandmates | per-org / ephemeral |

`users.id` = `auth.users.id`; org/branch roles live in `org_memberships`, not on `users` (mirrors tech-spec §4's own note). The org/branch tree comes from `organizational-repertoire-model` ("Sede Lima has its own organization under Academia Musical" — the spec is ambiguous on whether branches belong to one org exclusively; see Open Decisions D1).

### 1.2 Repertoire core

| # | Entity | Purpose | Requires | Visibility scope |
|---|--------|---------|----------|------------------|
| 7 | `songs` | Work-level placeholder for a tune ("Imagine" merges two duplicates into one song) | repertoire-mgmt, song-lifecycle, organizational-repertoire-model, music-theory | branch (sub-scoped: branch → org → system) |
| 8 | `song_versions` | A concrete arrangement of a song (chords + lyrics + format + file object). Readiness ("ready"/"draft") is tracked PER VERSION, not per song. The append-only audit trail | song-lifecycle, personal-preferences-and-adaptations, collaborative-comments, organizational-repertoire-model, music-notation, pdf-scan-charts, rehearsal-workflow | same scope as owning song, PLUS per-version owner (version owner alone may rebase) |
| 9 | `tags` | Categorical + user-created tags (genre, "piano", "wedding-intro") used for search/browse filters | search-and-discovery, analytics-and-insights | org (catalog) / user (custom) |
| 10 | `song_duplicates` | Flagged possible-duplicate groups and merge/unmerge decisions with lineage | song-lifecycle, external-integrations | branch (scope of the involved songs) |
| 11 | `external_enrichments` | Provenance cache of auto-filled metadata (Spotify album art/BPM/key, MusicBrainz, LRCLIB) — source, suggested vs. applied, never silently overriding declared keys | external-autotagging, external-integrations | per-user action records; applied values live on the song |

### 1.3 Setlists and collections

| # | Entity | Purpose | Requires | Visibility scope |
|---|--------|---------|----------|------------------|
| 12 | `setlists` | Ordered song list with OWNER, per-setlist access control (per-collaborator edit/view), share links, activity/version history, MIDI map, and "shared with audience" flag | setlist-creation, shared-setlist-collaboration, midi-integration, export-and-sharing | user → shared (collaborators) → public (audience link) |
| 13 | `setlist_items` | Song-in-setlist with position, chosen version, AGREED key, vocal parts, per-song MIDI program, explicit-key flag (precedence over context) | setlist-creation, shared-setlist-collaboration, personal-preferences-and-adaptations, midi-integration, rehearsal-workflow | inherits setlist scope |
| 14 | `collections` | Curated themed song sets (Wedding Set, Christmas Carols), forkable with lineage to source, shareable view-only | collections | user → org-shared → public |
| 15 | `collection_songs` | Ordered song membership in a collection (references the same song records a fork inherits) | collections, service-planning | inherits collection scope |

### 1.4 Commentary and annotations

| # | Entity | Purpose | Requires | Visibility scope |
|---|--------|---------|----------|------------------|
| 16 | `shared_comments` | Collaborative threaded comments on song/setlist, per-version, section-anchored, mentions (@Lucia), resolved/deleted/edited history | collaborative-comments | arrangement/setlist scope (band-visible) |
| 17 | `personal_annotations` | Per-user private overlays: text at a timestamp/measure, chord substitutions ("Bm → Dmaj7") — NEVER rendered to band/projection/overlay | personal-preferences-and-adaptations, collaborative-comments, congregation-projection, obs-overlay | user only |

Personal chord substitutions are keyed to the CONCRETE chart chord (music-theory: substitutions "move correctly when Pedro transposes" — anchored to the chord token, not a position index).

### 1.5 Events, gigs, services, performance

| # | Entity | Purpose | Requires | Visibility scope |
|---|--------|---------|----------|------------------|
| 18 | `events` | Multi-org collaboration container. **Spec conflict: 3 event types**, each with its own visibility matrix (mixed-group / sequence-only / full-program) | cross-organization-event-collaboration, organizational-repertoire-model, notifications | cross-org (all participants), per-type matrix |
| 19 | `gigs` | Single-org performance, exactly one linked setlist, planned → confirmed → completed/cancelled; NOT an event (explicit non-goal: multi-org gigs are events) | gigs-and-performance-history | user default → shareable to branch |
| 20 | `venues` | Reused venue details (name, location, type: bar/outdoor/…) — no geo/maps (explicit non-goal) | gigs-and-performance-history | user |
| 21 | `performances` | ONE record per completed gig: date, venue, songs actually played vs. skipped vs. played off-setlist; feeds "played at" tags, demand counts, rebase suggestions, analytics | gigs-and-performance-history, live-performance-mode, analytics-and-insights, personal-preferences-and-adaptations | follows gig scope |
| 22 | `services` | Service (Sunday 10am) composed of ordered blocks; becomes read-only after completion | service-planning | org/branch |
| 23 | `service_blocks` | Ordered blocks within a service, own time budget (min), own block setlist; song swap during service logged with decider | service-planning | inherits service scope |
| 24 | `service_assignments` | Musician ↔ block (with part); absorbs substitution coverage (covered by / uncovered, substitute records, leader overrule, cross-org substitute scoped to the assignment) | service-planning, substitutions-and-coverage | org/branch; cross-org for event substitutes |
| 25 | `substitution_requests` | Unavailability → request → candidate list → accept (first wins) → assignment/lifecycle | substitutions-and-coverage, rehearsal-workflow | org/branch |

### 1.6 Practice, rehearsal, collaboration

| # | Entity | Purpose | Requires | Visibility scope |
|---|--------|---------|----------|------------------|
| 26 | `practice_sessions` | Personal practice record (start time, instrument — per-session override allowed, duration, song); feeds "practice hours by instrument" analytics; offline-queued | practice-mode, analytics-and-insights | user only |
| 27 | `rehearsals` | Agenda from a setlist (+ songs not in setlist), members per song, duration estimate, timebox, per-song outcome (Polished / Needs work), carry-over to next agenda, notes linked back to the song | rehearsal-workflow | org/branch |
| 28 | `bandmate_links` | User-to-user collaboration edges (active/pending/declined), proxied by one-time proximity codes (24 h expiry) — the "band" concept referred to by setlist sharing | collaboration-bandmates, shared-setlist-collaboration, export-and-sharing | user pair |
| 29 | `notifications` | Per-user notification feed: invites, setlist changes, event reminders, system alerts; categories + read state; offline-queued delivery; page/feature-scoped push preferences (per-user table) | notifications, collaboration-bandmates, community-moderation | user |
| 30 | `notification_preferences` | Per-user push rules: master switch, category toggles, quiet hours (10 PM–7 AM), digest opt-in | notifications | user |

### 1.7 Community, moderation, discovery

| # | Entity | Purpose | Requires | Visibility scope |
|---|--------|---------|----------|------------------|
| 31 | `public_songs` | Community-contributed song in the public library: contributor/attribution, license confirmation (CC-BY-4.0 default), lineage to source arrangement, linked-copy semantics (subscription updates vs. standalone copies) | public-library-community, community-moderation, external-integrations | public |
| 32 | `follows` | User ↔ contributor edge feeding the discovery feed; reputation counts derive from public activity (contributions + curated collections) | public-library-community | user pair |
| 33 | `reports` | Content reports (reason category: copyright / offensive / spam-duplicate / wrong-metadata; reporter identity hidden from contributor); consolidated into moderation cases; offline report intake | public-library-community, community-moderation | public → moderator |
| 34 | `moderation_cases` | Consolidated case per reported public entry (report grouping, counts), keep/remove/escalate decision with decider + date + reason (remove is appeal-only reversible), appeal assignment to a DIFFERENT moderator, reinstatement, takedown propagation to linked copies | community-moderation, public-library-community, notifications | system (moderator) |
| 35 | `rating_restrictions` | Contributor rate-limiting after confirmed violations | public-library-community, community-moderation | system |

### 1.8 Devices, hardware, sync, integrations

| # | Entity | Purpose | Requires | Visibility scope |
|---|--------|---------|----------|------------------|
| 36 | `device_configs` | Per-device-bound preferences: MIDI output selection, foot-pedal switch→action maps (persist across sessions / reconnect), external-display mode ("Lyrics"/"Chords") and transpose | foot-pedal-hid, midi-integration, external-display | user (device-scoped) |
| 37 | `midi_maps` | Setlist-level program-change mapping (song ↔ PC value), duplicated with setlists, never altered by transpose/capo | midi-integration | user (setlist-scoped) |
| 38 | `outbox` | Transactional offline-sync queue: entity, operation, payload (jsonb), pending flag, ordering, per-entity resync on conflict | offline-access, shared-setlist-collaboration, community-moderation, pwa-updates-and-storage, in-app-feedback | user (client-owned) |
| 39 | `chart_files` | Stored chart/scan objects (Cloudflare R2 / Supabase Storage keys): ChordPro text, MusicXML, ABC, PDF scans (versioned, soft-deleted, oversized rejection, size limits) | pdf-scan-charts, export-and-sharing, music-notation, pwa-updates-and-storage | same scope as owning version/file |
| 40 | `external_connections` | Third-party integrations (Spotify enrichment, Planning Center, MusicBrainz, LRCLIB, meta-imports), re-vocable per user | external-integrations, external-autotagging, search-and-discovery | user |
| 41 | `audience_views` | Audience-side setlist exposure: QR/embed links with tokens, expiry, simplified lyric-only view, push on setlist update | export-and-sharing, congregation-projection, notifications | public (expiring link) |
| 42 | `scale_catalog` | Extensible scale/mode catalog (major…melodic-minor modes) — addable by system director without code change; songs declare tonic + scale | music-theory, personal-preferences-and-adaptations | system |

### 1.9 Entities in scope of the task but NOT proposed (YAGNI)

| Entity | Reason not to store |
|--------|---------------------|
| `song_analysis` (degree/progression data) | music-theory is explicit: the concrete chart is canonical, degree views and progressions are DERIVED at render time; storing them would duplicate truth |
| `projection_sessions` / `overlay_sessions` | Pure client/runtime state (which display is showing which slide) — realtime surface, not persistent rows |
| `export_records` | Export history + per-file deletion is local Cache-API/IndexedDB state (`pwa-updates-and-storage`); the server stores nothing |
| `search_history` / `saved_searches` | Client-side convenience per `search-and-discovery` (local accessibility); no shared data |
| `user_vocal_ranges` (periodized) | `personal-preferences-and-adaptations` stores a manual range preference; the observed range history is derivable from performance records — recompute, don't persist |
| `duplicate detection results` | The heuristic result is reviewable client-side; only confirmed decisions are stored (as `song_duplicates`) |

---

## 2. Proposed schema v2

Postgres 15 + Supabase conventions. `uuid` PKs (except `auth.users`-backed tables), `timestamptz`, `jsonb` where the shape is per-user/per-device, native enums for closed domains. Every core row carries `org_id` + `branch_id` (nullable) — the RLS scope columns; the tech-spec's single `tenant_id` is replaced by this pair because owner-org ≠ branch-scope.

```sql
-- ══════════════════════ 2.1 TENANCY ══════════════════════
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  org_type   text,                     -- 'Academy' | 'Church' | 'Orchestra' | ...
  logo_url   text,
  status     text NOT NULL DEFAULT 'active',  -- 'active' | 'disbanded' | 'archived' (org record archived, NOT deleted)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE branches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name       text NOT NULL,            -- 'Sede Centro', 'Sede Lima', ...
  city       text,
  status     text NOT NULL DEFAULT 'active',  -- 'archived' keeps data visible
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_branches_org ON branches(org_id);

CREATE TYPE member_status AS ENUM ('active', 'former', 'pending');

CREATE TABLE org_memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id   uuid REFERENCES branches(id) ON DELETE SET NULL,  -- unassigned when branch archived
  role        text NOT NULL,           -- enum in 2.2; system roles live on a join
  status      member_status NOT NULL DEFAULT 'active',
  joined_at   timestamptz NOT NULL DEFAULT now(),
  left_at     timestamptz,             -- "former" members keep read-only history
  UNIQUE (user_id, org_id, branch_id)
);
CREATE INDEX idx_memberships_user ON org_memberships(user_id);
CREATE INDEX idx_memberships_org   ON org_memberships(org_id);
CREATE INDEX idx_memberships_branch ON org_memberships(branch_id);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    text NOT NULL,               -- 'system_admin' | 'community_moderator' (system-appointed per community-moderation)
  PRIMARY KEY (user_id, role)
);

CREATE TABLE org_invite_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES organizations(id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE,    -- 'ACAD-MAD-001'
  role        text NOT NULL,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  expires_at  timestamptz NOT NULL,    -- default: now() + interval '7 days' (proximity codes: 24 h)
  used_at     timestamptz
);
```

### 2.2 Roles

Closed role set per `organizational-repertoire-model` + `community-moderation` + `cross-organization-event-collaboration` + `service-planning`:

```sql
CREATE TYPE role AS ENUM (
  'system_admin',          -- system-level repertoire, org lifecycle, moderator appointment
  'community_moderator',   -- system-appointed; public-library queue ONLY (never org/private)
  'org_owner', 'org_admin', 'branch_admin',   -- org hierarchy, per branch
  'instructor',            -- adds songs to own branch only
  'org_member', 'performer', 'substitute',    -- performer-level
  'event_coordinator', 'backstage_coordinator'-- cross-org event roles / concert staff
);
```

`org_memberships.role` uses it; `user_roles.role` too. A user may hold several simultaneously ("Ana admin of Sede Madrid AND performer in Sede Lima").

### 2.3 Repertoire

```sql
CREATE TABLE songs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES organizations(id),   -- NULL ⇒ system-level song
  branch_id   uuid REFERENCES branches(id),        -- NULL ⇒ org/system level (promote/demote by changing these)
  title       text NOT NULL,
  artist      text,
  genre       text,
  source      text,                               -- 'Imported from OnSong' | 'Playlist' | 'Spotify-MusicBrainz-LRCLIB'…
  source_org_id uuid REFERENCES organizations(id),-- provenance badge for system-level additions
  is_deleted  boolean NOT NULL DEFAULT false,     -- soft-delete (restore keeps prior state)
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- "Level" is DERIVED: branch-level = branch_id NOT NULL; org-level = branch_id NULL AND org_id NOT NULL;
-- system-level = org_id NULL. Promote/demote = UPDATE the pair (organizational-repertoire-model scenarios).

CREATE TYPE chart_format AS ENUM ('chordpro', 'musicxml', 'abc', 'pdf');

CREATE TABLE chart_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id     uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  format      chart_format NOT NULL,
  object_key  text NOT NULL,             -- R2/Storage key; text charts may inline instead
  content     text,                      -- inline ChordPro/ABC text (or NULL for PDF/MusicXML object)
  size_bytes  integer NOT NULL,
  soft_deleted boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE song_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id           uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  name              text NOT NULL,            -- 'Original (artist)' | 'Pedro's arrangement' | 'Canción W (Pedro's changes)'
  number            integer NOT NULL,         -- v1, v2, ... append-only
  chart_file_id     uuid REFERENCES chart_files(id),   -- version's chart payload
  base_key          text,                     -- declared key context 'G major' | 'E Phrygian dominant' (extensible scale catalog)
  base_tempo        integer,                  -- BPM; declared, never guessed (music-theory non-goal)
  duration_seconds  integer,                  -- declared base duration (D5: default); derived estimate from section_context meter/tempo overrides when present
  section_context   jsonb NOT NULL DEFAULT '[]',  -- per-section {name, key, meter, tempo}
  is_ready          boolean NOT NULL DEFAULT false, -- readiness PER VERSION — same song, two versions, two states
  lineage_source    uuid REFERENCES song_versions(id), -- fork source (personal forks, imported arrangements)
  metadata          jsonb NOT NULL DEFAULT '{}', -- BPM/album-art suggestions with provenance; manual vs auto-filled provenance (external-autotagging)
  owner_id          uuid REFERENCES auth.users(id),  -- version owner = ONLY user who may rebase (personal-preferences)
  created_by        uuid NOT NULL REFERENCES auth.users(id), -- recorded in diff/history
  created_at        timestamptz NOT NULL DEFAULT now(),      -- immutable audit trail + timestamp for diffs
  change_note       text                  -- 'Changed chorus chords' — recorded per entry
);
CREATE INDEX idx_versions_song ON song_versions(song_id, number DESC);

CREATE TABLE tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid REFERENCES organizations(id),
  user_id    uuid REFERENCES auth.users(id),        -- user-created custom tags
  name       text NOT NULL,
  UNIQUE (org_id, name), UNIQUE (user_id, name)
);
CREATE TABLE song_tags (
  song_id  uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  tag_id   uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (song_id, tag_id)
);

CREATE TABLE song_duplicates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_ids       uuid[] NOT NULL,              -- 'Imagine' + 'Imagine (John Lennon)' (both local + imported, dedupe group)
  canonical_id   uuid REFERENCES songs(id),    -- set on merge; merge source recorded
  merged_from    uuid REFERENCES songs(id),
  decided_by     uuid REFERENCES auth.users(id),  -- decider (song-lifecycle merge audit trail)
  unmerge_ok     boolean NOT NULL DEFAULT false,  -- merge is reversible; setlist refs re-target
  decided_at     timestamptz
);

CREATE TABLE external_enrichments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id     uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  source      text NOT NULL,               -- 'spotify' | 'musicbrainz' | 'lrclib'
  field       text NOT NULL,               -- 'bpm' | 'key' | 'album_art' | 'lyrics' | 'genre' | 'year'
  value       jsonb NOT NULL,
  state       text NOT NULL DEFAULT 'suggested',  -- 'suggested' | 'applied' | 'discarded'
  applied_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()   -- provenance in song change history
);
```

### 2.4 Setlists, items, collections

```sql
CREATE TABLE setlists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organizations(id),
  branch_id       uuid REFERENCES branches(id),
  owner_id        uuid NOT NULL REFERENCES auth.users(id),
  name            text NOT NULL,
  visibility      text NOT NULL DEFAULT 'private',
  -- 'private' (user) | 'shared' (per-collaborator rights) | 'org' | 'branch' | 'public' (audience QR/embed)
  is_event_setlist boolean NOT NULL DEFAULT false,  -- belongs to an event, not to a single org (post-event → read-only archive)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_setlists_owner ON setlists(owner_id);

CREATE TABLE setlist_collaborators (
  setlist_id  uuid NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_edit    boolean NOT NULL DEFAULT true,   -- Julian=edit / Lucia=view-only (owner controls permissions)
  invited_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,                     -- view-only until accept (shared-setlist-collaboration)
  PRIMARY KEY (setlist_id, user_id)
);

CREATE TABLE setlist_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id     uuid NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  song_id        uuid NOT NULL REFERENCES songs(id) ON DELETE RESTRICT,   -- merge re-targets; retire keeps past setlists rendering
  version_id     uuid REFERENCES song_versions(id),  -- chosen version (could be NULL: picker default)
  position       integer NOT NULL,
  agreed_key     text,                        -- explicit agreed key → precedence over context (code-level rule, not schema)
  vocal_parts    jsonb NOT NULL DEFAULT '[]', -- [{"part":"Melody","user_id":...},{"part":"Harmony",...}]
  midi_program   integer,                     -- per-song program change (NULL ⇒ send nothing)
  notes          text,
  UNIQUE (setlist_id, position)
);
CREATE INDEX idx_setlist_items_orders ON setlist_items(setlist_id, position);

CREATE TABLE collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id),
  org_id      uuid REFERENCES organizations(id),
  name        text NOT NULL,
  description text,
  fork_of     uuid REFERENCES collections(id),   -- lineage to source (fork records lineage back)
  visibility  text NOT NULL DEFAULT 'private',   -- 'private' | 'shared' (view-only) | 'org' | 'public'
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE collection_songs (
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  song_id       uuid NOT NULL REFERENCES songs(id) ON DELETE RESTRICT,  -- removals flag, never delete the song
  position      integer NOT NULL,
  PRIMARY KEY (collection_id, song_id)
);
```

### 2.5 Commentary and annotations

```sql
CREATE TABLE shared_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id     uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  version_id  uuid REFERENCES song_versions(id),   -- comment attaches to a specific version (v2-only)
  anchor      jsonb,                               -- structural anchor {section: 'Chorus', index: 2}; OPTION 'note' may use positional {type:'measure'|'timestamp'} (D4)
  parent_id   uuid REFERENCES shared_comments(id), -- threading; NULL = root
  author_id   uuid NOT NULL REFERENCES auth.users(id),
  body        text NOT NULL,
  resolved    boolean NOT NULL DEFAULT false,
  deleted     boolean NOT NULL DEFAULT false,      -- comments are soft-deleted; history kept
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);
CREATE INDEX idx_comments_song ON shared_comments(song_id, version_id);

CREATE TABLE personal_annotations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id     uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  anchor      jsonb NOT NULL,                -- structural {section:'Chorus', index:2}; chord_substitution keys to concrete chord token (D4); 'note' may use positional measure/timestamp
  kind        text NOT NULL,                 -- 'note' (text) | 'chord_substitution'
  value       text NOT NULL,                 -- note body, or 'Dmaj7' (substitution target — concrete-key keyed)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);
CREATE INDEX idx_personal_annotations ON personal_annotations(user_id, song_id);
```

### 2.6 Events, gigs, services, performance records

```sql
CREATE TYPE event_type AS ENUM ('mixed-group', 'sequence-only', 'full-program');  -- cross-organization-event-collaboration §128-139

CREATE TABLE events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           event_type NOT NULL,        -- ← column NOT SETTLED BY THE FEATURES — the suite only calls the single entity "event"
  name           text NOT NULL,              -- 'Festival Nacional', 'Symphony Night'
  status         text NOT NULL DEFAULT 'scheduled',  -- 'scheduled' | 'active' | 'concluded' (setlists → read-only archive)
  organizer_id   uuid REFERENCES auth.users(id),     -- event coordinator / concert organizer
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE event_participants (       -- org ↔ event edge; drives the per-event repertoire union
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slot_time   timestamptz,              -- sequence-only: organizer sees only this + duration
  slot_minutes integer,                 -- Church E: 30-minute slot; overrun warning when setlist > slot
  sequence    integer,                  -- organizer controls the sequence order
  PRIMARY KEY (event_id, org_id)
);

CREATE TABLE event_setlists (           -- setlists that belong to the EVENT, not to any org (post-event ownership ambiguity → Open Decision D3)
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  org_id      uuid REFERENCES organizations(id),        -- org-private setlist within a sequence-only event
  group_name  text,                                     -- mixed-group: 'Group 1' of 3
  setlist_id  uuid NOT NULL REFERENCES setlists(id),    -- reuse the setlists table: same songs, per-org visibility
  visibility  text NOT NULL DEFAULT 'private'           -- 'private' | 'org' | 'event' | 'public' (booklet after finalize)
);
-- Sequence: event_setlists.(event_id, sequence). With per-org visibility per event type — RLS in §3.

CREATE TABLE gigs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),   -- single org ONLY (multi-org = event, explicit non-goal)
  branch_id   uuid REFERENCES branches(id),
  owner_id    uuid NOT NULL REFERENCES auth.users(id),
  name        text NOT NULL,
  venue_id    uuid REFERENCES venues(id),
  scheduled_at timestamptz NOT NULL,        -- date/time source for the 1-hour-before reminder (notifications)
  setlist_id  uuid REFERENCES setlists(id), -- exactly one; swappable until completion
  status      text NOT NULL DEFAULT 'planned',  -- 'planned' | 'confirmed' | 'completed' | 'cancelled'
  shared_to_branch boolean NOT NULL DEFAULT false,  -- gig private to owner until explicitly shared (visibility scenario)
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE venues (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES auth.users(id),
  name       text NOT NULL,               -- 'Café La Luna'
  location   text,                        -- 'Calle Luna 3, Madrid'
  type       text                         -- 'bar' | 'outdoor' | ... (no geo/maps — explicit non-goal)
);

CREATE TYPE play_state AS ENUM ('played', 'skipped', 'off_setlist');

CREATE TABLE performances (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id      uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,  -- exactly ONE per completed gig
  venue_id    uuid REFERENCES venues(id),
  performed_at timestamptz NOT NULL
);
CREATE TABLE performance_items (        -- what was ACTUALLY played; skipped/off-setlist separated
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id uuid NOT NULL REFERENCES performances(id) ON DELETE CASCADE,
  song_id        uuid NOT NULL REFERENCES songs(id),
  version_id     uuid REFERENCES song_versions(id),
  state          play_state NOT NULL,
  position       integer
);
-- Song demand = COUNT(distinct performance) per song; feeds "played at" tags, demand counts, rebase analytics.

CREATE TABLE services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  branch_id   uuid REFERENCES branches(id),
  name        text NOT NULL,               -- 'Sunday 10am'
  status      text NOT NULL DEFAULT 'draft',   -- 'draft' | 'published' | 'completed' (→ read-only)
  leader_id   uuid REFERENCES auth.users(id),  -- only the service leader can edit the plan (read-only for members until published)
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE service_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name        text NOT NULL,               -- 'Opening', 'Worship', 'Offering', ...
  position    integer NOT NULL,
  time_budget integer,                     -- minutes; block overrun warns
  setlist_id  uuid REFERENCES setlists(id),-- a setlist fills a block (independent per block)
  UNIQUE (service_id, position)
);

CREATE TABLE service_assignments (         -- musician ↔ block (part, coverage)
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  block_id    uuid REFERENCES service_blocks(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  part        text NOT NULL,               -- 'bass' — substitution candidates filter by instrument
  is_substitute boolean NOT NULL DEFAULT false,
  covered_by  uuid REFERENCES auth.users(id),   -- substitute assignment (leader-overrulable)
  decided_by  uuid REFERENCES auth.users(id),   -- leader decider for overrule/substitution
  checkin_at  timestamptz,                 -- day-of check-in (queued when offline)
  UNIQUE (block_id, user_id, part)
);

CREATE TABLE substitution_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES service_assignments(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  candidates  uuid[] NOT NULL,             -- eligible members (instrument match) — re-evaluated per request
  status      text NOT NULL DEFAULT 'open',    -- 'open' | 'covered' | 'closed' (first accept wins; cancels reopen)
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
```

### 2.7 Practice, rehearsal, collaboration, notifications

```sql
CREATE TABLE practice_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id     uuid REFERENCES songs(id),
  version_id  uuid REFERENCES song_versions(id),
  instrument  text NOT NULL,               -- profile primary; per-session override allowed
  started_at  timestamptz NOT NULL,        -- metronome start is the single trigger
  ended_at    timestamptz,                 -- duration derived; exit-mid-session keeps elapsed
  offline_sync uuid                        -- outbox correlation id (see §2.9)
);
CREATE INDEX idx_practice_user ON practice_sessions(user_id, started_at);

CREATE TABLE rehearsals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  branch_id   uuid REFERENCES branches(id),
  name        text NOT NULL,               -- 'Saturday Service Rehearsal'
  setlist_id  uuid REFERENCES setlists(id),-- agenda mirrors a setlist; extra songs allowed
  timebox_minutes integer,                 -- overrun warning; trim-to-review keeps agenda intact
  status      text NOT NULL DEFAULT 'planned',  -- 'planned' | 'published' | 'completed'
  planned_for timestamptz,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rehearsal_items (             -- per-song: outcome, run count, notes, carry-over
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rehearsal_id  uuid NOT NULL REFERENCES rehearsals(id) ON DELETE CASCADE,
  song_id       uuid NOT NULL REFERENCES songs(id),
  version_id    uuid REFERENCES song_versions(id),
  outcome       text,                      -- 'polished' | 'needs_work' | 'quick_review'
  run_count     integer DEFAULT 0,
  notes         text,                      -- attaches back to the song's rehearsal history (not chart content)
  carry_over_to uuid REFERENCES rehearsals(id),  -- "Carried over: needs work" into the next agenda
  UNIQUE (rehearsal_id, song_id)
);

CREATE TABLE bandmate_links (             -- the "band" edge
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bandmate_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending',  -- 'pending' | 'active' | 'declined'
  proximity_code uuid,                     -- one-time; expires 24 h
  created_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  PRIMARY KEY (user_id, bandmate_id)
);

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category   text NOT NULL,               -- 'invitation' | 'setlist' | 'event' | 'system'
  title      text NOT NULL,
  body       text,
  payload    jsonb,                       -- deep-link target {setlist_id, song_id, section} — notification deep-links to the right screen
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at NULLS FIRST, created_at DESC);

CREATE TABLE notification_preferences (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled    boolean NOT NULL DEFAULT true,
  categories      jsonb NOT NULL DEFAULT '{}',   -- per-category toggle; quiet hours honored during offline queue delivery
  quiet_start_at  time,                   -- 10 PM
  quiet_end_at    time,                   -- 7 AM
  weekly_digest   boolean NOT NULL DEFAULT false
);
```

### 2.8 Community & moderation

```sql
CREATE TABLE public_songs (               -- public-library entries (system-level READ, community WRITE)
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id       uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  contributor_id uuid NOT NULL REFERENCES auth.users(id), -- attribution badge
  license       text NOT NULL DEFAULT 'CC-BY-4.0',  -- 'public-domain' | 'CC-BY-4.0' | 'proprietary' (filterable)
  license_confirmed boolean NOT NULL DEFAULT false,  -- contribution/import blocked until true
  lineage       uuid REFERENCES public_songs(id),    -- derivative lineage visibly recorded
  linked_copies uuid[],                    -- user copies that stay linked (subscribe to upstream updates); others are standalone
  status        text NOT NULL DEFAULT 'live',   -- 'live' | 'removed' | 'withdrawn' (withdrawn: copies remain theirs)
  updated_at    timestamptz NOT NULL DEFAULT now()   -- linked-copy subscribers see the update
);
CREATE INDEX idx_public_songs_license ON public_songs(status, license);

CREATE TABLE follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id)
);

CREATE TYPE report_reason AS ENUM ('copyright_violation', 'offensive_content', 'spam_duplicate', 'wrong_metadata');

CREATE TABLE reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_song_id uuid NOT NULL REFERENCES public_songs(id) ON DELETE CASCADE,
  reporter_id   uuid NOT NULL,            -- identity hidden from contributor; visible ONLY to moderators
  reason        report_reason NOT NULL,
  status        text NOT NULL DEFAULT 'pending',   -- 'pending' | 'consolidated' | 'closed'
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (public_song_id, reason, reporter_id)     -- cannot file the same grounds twice
);

CREATE TABLE moderation_cases (           -- one consolidatable case per public entry
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_song_id uuid NOT NULL REFERENCES public_songs(id) ON DELETE CASCADE,
  reason_counts jsonb NOT NULL,           -- {copyright_violation: 3, offensive_content: 1} — grouped reporter counts
  grounds       text[] NOT NULL,          -- already-decided grounds never re-queue
  decision      text,                     -- 'keep' | 'remove' | 'escalate'
  decider_id    uuid REFERENCES auth.users(id),
  appeal_of     uuid REFERENCES moderation_cases(id),   -- appeal reviewed by a DIFFERENT moderator (enforced app-side)
  decided_at    timestamptz,
  notes         text
);
CREATE INDEX idx_cases_status ON moderation_cases(public_song_id) WHERE decision IS NULL;

CREATE TABLE rating_restrictions (        -- contributor rate-limited after CONFIRMED violations
  contributor_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restricted_until timestamptz,
  confirmed_violations integer NOT NULL DEFAULT 0
);
```

### 2.9 Devices, hardware, sync (the offline queue)

```sql
CREATE TABLE device_configs (             -- per-device BOUND to the client device UUID
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id     text NOT NULL,            -- client-generated stable device identifier
  midi_output   text,                     -- selected Web MIDI output; persisted across sessions
  pedal_switches jsonb NOT NULL DEFAULT '{}',   -- {"left": "previous_song", "right": "next_song"} — saved with the pedal, restored on reconnect
  display_mode  text NOT NULL DEFAULT 'lyrics', -- 'lyrics' | 'chords' (external display)
  UNIQUE (user_id, device_id)
);

CREATE TABLE midi_maps (                  -- setlist-level program-change map; duplicated with the setlist
  setlist_id uuid NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  song_id    uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  program    integer NOT NULL,            -- Program Change value (0-127)
  PRIMARY KEY (setlist_id, song_id)
);

CREATE TABLE outbox (                     -- transactional write queue (client-owned, offline-first)
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id     text NOT NULL,
  entity        text NOT NULL,            -- 'setlist_items' | 'gigs' | 'comments' | 'reports' | 'practice_sessions' ...
  entity_id     uuid,
  operation     text NOT NULL,            -- 'insert' | 'update' | 'delete'
  payload       jsonb NOT NULL,           -- full row payload for server-side revalidation
  seq           bigint NOT NULL,          -- monotonic per device — replay order preserved
  state         text NOT NULL DEFAULT 'pending',  -- 'pending' | 'syncing' | 'synced' | 'conflict'
  created_at    timestamptz NOT NULL DEFAULT now(),
  synced_at     timestamptz,
  UNIQUE (device_id, seq)
);
CREATE INDEX idx_outbox_pending ON outbox(user_id, state) WHERE state = 'pending';
-- Offline merge contract bounded, not invented: conflict resolution re-validates the payload against
-- server RLS (org-permissions check on reconnect) and re-applies; documented decision-log limbo (see D5).
```

### 2.10 Realtime layer touchpoints (no over-design)

Three places the future realtime layer plugs in — schema already carries the ids/payloads it needs, nothing more:

1. **Shared setlist edits** (`setlist_items`, `setlist_collaborators`) — Supabase Realtime subscription on `setlist_id`; the conflict toast ("Julian is editing Song B") is client-layer advisory state expressed as a lock, not a DB row (`shared-setlist-collaboration`). `setlist_collaborators.can_edit` is the authority the realtime filter consults.
2. **Live performance / projection sync** (`performances`, `service_blocks`, `audience_views`) — operator device and display follow the same row (slide index + current song) via a realtime channel; the persistent side is `service_blocks` + `outbox`. `obs-overlay` sessions map to `audience_views`-style expiring tokens.
3. **Offline merge on reconnect** — `outbox.seq` gives deterministic replay order; an edge function re-runs each `payload` against RLS and returns a `conflict` state for items the UI then surfaces (conflict resolution screen). This is the actual offline merge contract the suite needs — per-entity semantic merge rules are app logic, not schema.

---

## 3. RLS visibility matrix

The core deliverable. Matrix uses the scope columns from §2 (`org_id`, `branch_id`, `owner_id`, `visibility`) plus `auth.uid()` and role lookups. Scope column "scoped by" = which columns / relations the policy must traverse.

### 3.1 Matrix

| Object type | Readable by | Writable by | Scoped by | Feature citation |
|---|---|---|---|---|
| `organizations` | system admins + members of the org | system admin (create/disband, archive); org owner (profile edit) | `id` | organizational-repertoire-model "Org disbanded — repertoire transfer"; authentication-and-profiles org profile scenarios |
| `branches` | members of the org (visibility per branch) | org owner/admin (add/archive branch) | `org_id`, `id` | organizational-repertoire-model branch scenarios; authentication-and-profiles "Add a new branch" |
| `org_memberships` | the user themselves + org admins (member lists, tenure analytics) | user joins via invite code (role org_member); org roles granted by admins/owner | `user_id`, `org_id` | authentication-and-profiles "register with org invite code"; analytics-and-insights "total members by branch"; organizational-repertoire-model "Member leaves an org" (status → former, read-only history) |
| system-level roles (`user_roles` with `system_admin`/`community_moderator`) | the role holder | system admin only | `user_id`, role | community-moderation "appointed at the system level"; organizational-repertoire-model system scenarios |
| `songs` (branch-scoped) | branch members; org admins; org members when shared up; system songs readable by all orgs | branch admins/instructors (own branch only); version owner | `branch_id` = user's membership branch (or ancestor org/system level) | organizational-repertoire-model "visible to Madrid admins and instructors… NOT visible to Lima", "Pedro cannot add to Madrid"; search-and-discovery "filter by source" |
| `songs` (org/system level) | all org members (org level) / all orgs (system level) | owning org only (system-level songs are NOT writable by other orgs) | `org_id` NULL logic, `source_org_id` | organizational-repertoire-model "only Org A can edit its version", "adds the arrangement to the system repertoire… all 3 branches", "system admin removes an org's song" (demote to private copy) |
| `song_versions` | same as owning song | version owner / org-write authorized users; wheel: rollback is a NEW version, history immutable | song scope + `owner_id` | song-lifecycle version history & rollback; personal-preferences "Only the version owner can rebase" |
| `chart_files` | same as owning song/version | same writers as version | song scope | pdf-scan-charts (file object lifecycle); song-lifecycle soft-delete |
| `setlists` (private) | owner + explicitly invited collaborators | owner; collaborators per `can_edit`; invited until accepted → view-only | `owner_id`, `setlist_collaborators` | shared-setlist-collaboration "view but not edit until they accept"; "Lucia view only"; transfer ownership (+ activity log) |
| `setlists` (org/branch/event) | org/branch members; event participants; post-event read-only for everyone who had access | org/branch admins; event coordinators; owner | `org_id`/`branch_id`, event link, `visibility` | organizational-repertoire-model "event setlist persists… read-only historical"; cross-organization events |
| `setlist_items` | same as the setlist | same as the setlist | inherited via `setlist_id` | setlist-creation; shared-setlist-collaboration reorder/lock/conflict |
| `collections` (private) | owner only | owner only | `owner_id` | collections "Private Set"… "I retain the only edit rights" |
| `collections` (shared) | invited/bandmates | owner only (view-only for others) | `owner_id`, share edges | collections "bandmates can view it but not modify it" |
| `collection_songs` | inherited from collection | collection owner | `collection_id` | collections fork/add/remove |
| `shared_comments` | band/arrangement-scope: exactly the users who can see the arrangement/setlist | comment author (edit/delete own); any scoped member (post); resolve by anyone in scope | song/setlist scope | collaborative-comments "visibility follows the setlist/arrangement scope", "a member from another org cannot see it", "cannot comment on a song I do not have access to" |
| `personal_annotations` | user only — never band, projection, overlay | user only | `user_id` | personal-preferences "stored on Juan's profile only"; congregation-projection / obs-overlay "never leak to the display" |
| `events` | participants + their orgs (per event type matrix); AMBIGUOUS for non-participants | creator/event coordinator (visibility per type) | event participant edges + `type` | cross-organization-event-collaboration "Visibility matrix for cross-org event types" |
| `event_setlists` | mixed-group: group members (union of their churches' repertoires); sequence-only: org itself + organizer sees only slot/duration/summary; full-program: organizer sees all + approves, orgs see full program after finalize; backstage coordinator reads all, edits none | event coordinator (mixed-group group edits); org directors (own org setlist); organizer approves/reorders slots only | event + type + org | cross-organization-event-collaboration scenarios 1-3 (detailed per-type below) |
| `gigs` | owner by default; branch when shared | owner; branch members readonly when shared; leader edits until completed | `owner_id`, `shared_to_branch` | gigs-and-performance-history "private to Lucia by default… not seen by Juan", "shared to Sede Madrid", "Pedro (Sede Lima) cannot open" |
| `venues` | owner (suggestions come from the user's own history) | owner | `owner_id` | gigs "Prior venues are offered as suggestions for reuse" |
| `performances` / `performance_items` | follows gig scope (read after shared/completed); org analytics see aggregate, not per-user rows | gig owner writes exactly ONE record on completion (post-show flow is the only write path) | gig scope | gigs "creating a gig… completes writes the performance record"; analytics org views |
| `services` / `service_blocks` | org/branch members (published plans; read-only for members until published); completed → read-only historical | service leader (draft plan); leader logs swaps/check-ins | `org_id`/`branch_id` + `leader_id` | service-planning "Plan is read-only for members until published", "Only the service leader can edit", "Completed service becomes a read-only record" |
| `service_assignments` | org members see their own blocks; leaders see all | leader assigns; substitute accepts (first wins); leader overrides | `org_id` + `decided_by` | service-planning; substitutions-and-coverage lifecycle |
| `substitution_requests` | requesting leader + eligible candidates (instrument match) + the substitute | leader creates; candidates accept/decline | org scope + instrument match (app-enforced candidate list) | substitutions-and-coverage "lists band members who play bass" |
| `practice_sessions` | user only | user only | `user_id` | practice-mode "personal to Juan and not visible to bandmates or the organization" |
| `rehearsals` / `rehearsal_items` | org/branch members | leader creates/publishes; members mark outcomes/notes on assigned songs | `org_id`/`branch_id` | rehearsal-workflow agenda publish + offline notes |
| `bandmate_links` | the two users | each user (self) | `user_id` pair | collaboration-bandmates add/accept/decline |
| `notifications` | owner user only | system writes (edge functions); user marks read | `user_id` | notifications feed scenarios |
| `notification_preferences` | owner only | owner | `user_id` | notifications "User enables or disables push", quiet hours |
| `public_songs` | everyone (anonymous/public browse) | contributor (own entry) + community moderator (remove/keep after confirmed violation); contributor withdraw restores own entries | `contributor_id` + moderator role | public-library-community; community-moderation "Covers the public library only" |
| `follows` | follower + followed (public profile shows counts) | follower | `follower_id` | public-library-community follow/unfollow |
| `reports` | moderator + reporter (simplified own-status); contributor NEVER sees identity | any user files; reporter cannot re-file same grounds | `reporter_id` hidden, moderator visibility | community-moderation "identity hidden from the contributor" |
| `moderation_cases` | system moderators + system admins (escalate path) | moderator (keep/remove; escalate) — decision immutable, appeal-only | `decider_id`, escalation | community-moderation queue/keep/remove/escalate/appeals |
| `rating_restrictions` | moderator/system admin | system moderation writes after confirmed violations | role | public-library-community rate-limit |
| `device_configs` | owner user (this device) only | owner user | `user_id` + `device_id` | foot-pedal-hid "mapping is saved with the pedal so it persists across sessions"; midi-integration |
| `midi_maps` | setlist scope, owner/collaborators | setlist editor; maps duplicate with the setlist, never alter via transpose | setlist scope | midi-integration "mapping is saved with the setlist"; "duplicate carries the same MIDI mappings" |
| `outbox` | owning user/device only (client-owned) | owning user's client; server edge re-validates RLS on replay | `user_id` + `device_id` | offline-access; pwa-updates-and-storage queue-survival contract |
| `external_connections` | owner user | owner user; disconnect revokes future enrichment | `user_id` | external-integrations revoke; external-autotagging "Disconnect from Spotify" |
| `audience_views` | anyone with the expiring token (QR/embed link) — no auth required | setlist owner generates/revokes | token + expiry | export-and-sharing audience QR, 7-day link expiry |
| `scale_catalog` | all users (rendered key contexts) | system director (org-level admin per organizational-repertoire-model conventions) | system | music-theory "catalog is extensible data… added by the system director" |

### 3.2 Ambiguities in the features (marked AMBIGUOUS — exact questions)

Product-owner resolutions 2026-09-01: event ownership → §4 D3; promote/edit of system songs → §4 D1/D7; chart content model → §4 D6; duration source → §4 D5; annotation/anchor model → §4 D4. Still open: non-participant read of event setlists, venue reuse scope, cross-org substitutes on org-private plans, takedown-flag surfacing, notification RSVP scope, proximity-vs-invite code sharing, cross-org rehearsals, anonymous audience tokens.

| Row | Question |
|---|---|
| `events` + `event_setlists` | Can a non-participating org EVER read an event's setlist (e.g. org B excluded from "Gala Primavera")? Scenario only says its songs are excluded from the picker — nothing says B cannot see the event at all. |
| `songs` (org-level) | When Org A promotes a song to the system repertoire, who may edit "the arrangement" at system level? "Only Org A can edit its version" implies system-writable blocks non-owners — but the scenario only covers versions; a later direct edit by another org is never tested. |
| `gigs` | After Lucia shares her gig to Sede Madrid, may other members edit the setlist inside the gig, or share it onward (re-share)? Feature tests only "can open the gig and, once completed, its performance record". |
| `venue` reuse | Venue suggestions are personal ("my venues"). If a branch-level gig reuses a venue, does the venue become branch-visible? Feature is silent. |
| `service_assignments` + substitutes | May a substitute from another ORG (cross-org event coverage) be assigned to an org-private service plan, or only to event plans? substitutions scenario says the substitute "sees only the assigned songs and the event setlist" — implies event-only, but the request model isn't scoped. |
| `public_songs` (linked copies) | After takedown, "linked copy loses its link and is flagged as unlinked" — flagged WHERE, for whom? No scenario states the flag is surfaced to the copy owner. |
| `notifications` | Are org-level event reminders delivered only to RSVP'd members ("I have RSVP'd 'Yes'") or to all org members? Scenario 3 says "I am a member of the academy" (no RSVP mention). |
| `proximity_code` | Expiry is 24 h (bandmates) — org invite codes default 7 days. Are proximity codes reused as org-invite codes in offline onboarding? user-onboarding "configurable expiration (default: 7 days)" vs. bandmates "expires after 24 hours" — two different codes for two different flows, but the schema must decide whether they share a table. |
| `rehearsals` | May a rehearsal span multiple orgs (cross-org rehearsal in mixed-group events)? rehearsal-workflow is silent; cross-org events impose their own visibility. |
| `audience_views` | The features say audience "receives push notification for setlist update" — requires an expiring token → user binding, but export-and-sharing's QR is anonymous. Which audience rows bind to which user (if any)? |

### 3.3 RLS policy sketches

Three representative cases, using Supabase/Postgres policy syntax with a `is_org_member(user_id, org_id)` helper (returns user's role within an org via `org_memberships`) and `user_branch_ids(user_id)` (set of branch ids the user belongs to). Full helper SQL is out of scope — the three policies are the contract:

#### (a) Branch-scoped song — readable by branch members, writable by the branch/instructor/admin of that branch

```sql
-- Songs anchored to a branch: visible to members of THAT branch (plus org admins), written by branch instructors/admins.
CREATE POLICY "branch songs read by own branch"
  ON songs FOR SELECT
  USING (
    is_org_member(auth.uid(), songs.org_id)
    AND (
      songs.branch_id IS NULL
      OR songs.branch_id IN (user_branch_ids(auth.uid()))
      OR session_role_in(auth.uid(), songs.org_id, '{org_admin,org_owner,branch_admin}'::text[])
    )
  );

CREATE POLICY "branch songs written by branch staff"
  ON songs FOR INSERT WITH CHECK (
    songs.branch_id IN (user_branch_ids(auth.uid()))
    AND session_role_in(auth.uid(), songs.org_id, '{org_admin,' 'branch_admin,' 'instructor}'::text[])
  );
```
_Source: organizational-repertoire-model "visible to Madrid admins and instructors / NOT visible to Lima or Bogota by default"; the invite-code join in authentication-and-profiles assigns branch membership as the write-scope basis._

#### (b) Shared setlist with collaborators — per-collaborator edit/view

```sql
-- Readable by owner + accepted collaborators; editable only by owner and collaborators with can_edit.
CREATE POLICY "shared setlist read by collaborators"
  ON setlists FOR SELECT
  USING (
    setlists.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM setlist_collaborators c
      WHERE c.setlist_id = setlists.id
        AND c.user_id = auth.uid()
        AND c.accepted_at IS NOT NULL   -- "view but not edit until they accept"
    )
  );

CREATE POLICY "shared setlist write by edit-capable collaborators"
  ON setlists FOR UPDATE
  USING (
    setlists.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM setlist_collaborators c
      WHERE c.setlist_id = setlists.id
        AND c.user_id = auth.uid()
        AND c.can_edit = true
        AND c.accepted_at IS NOT NULL
    )
  );
```
_Source: shared-setlist-collaboration "Julian can edit, Lucia view only", "view but not edit until they accept"; items inherit via `setlist_id` (setlist_item policies fold the same EXISTS check)._

#### (c) System-level repertoire song — readable by all branches, writable only by system admins

```sql
-- A system-level song (org_id IS NULL) is on the read path for every org member of any org…
CREATE POLICY "system songs readable by all orgs"
  ON songs FOR SELECT
  USING (
    songs.org_id IS NULL
    AND EXISTS (
      SELECT 1 FROM org_memberships m WHERE m.user_id = auth.uid()
    )
  );

-- …but only system_admin may write it. Writes flow through a service-role edge function that
-- checks the JWT role claim; RLS expresses the exclusion for direct client writes.
CREATE POLICY "system songs never direct-writable"
  ON songs FOR INSERT WITH CHECK (false);  -- system-level inserts happen via service role only
CREATE POLICY "system songs updated by system admin only"
  ON songs FOR UPDATE
  USING (
    songs.org_id IS NULL
    AND (auth.jwt() ->> 'role') = 'system_admin'
  );
```
_Source: organizational-repertoire-model "System-level song available across all branches", "system repertoire remains unchanged", "system admin removes an org's song from the system level". Org A's promotion keeps `source_org_id` so the ownership badge survives without write access._

---

## 4. Open schema decisions (RESOLVED 2026-09-01)

All seven resolved by the product owner. Schema §2 already reflects the chosen option unless noted; a conflict that would change §2 is called out inline.

| # | Question | Why it matters | Options | Resolution |
|---|----------|----------------|---------|------------|
| **D1** | **Single-tenant now vs. multi-tenant from day one?** | tech-spec §4/§10.9.1 mandates `tenant_id` on every core table and says partitioning is future work. The suite's org/branch/system/persona hierarchy makes per-row tenant scoping richer than one column, and 5-col RLS (org+role joins) is heavier than a single constant. | (1) Full multi-tenant now: org_id+branch_id everywhere (this doc) — matches the 37 files but costs RLS complexity per table. (2) MVP single-tenant: one org + one branch constant; all org/branch columns exist but are defaults — future sharding needs a migration, not a rewrite. (3) Org-only tenancy: branch_id nullable, branches as a filtered view — small MVs, breaks cross-branch isolation tests immediately. | **(1) Full multi-tenant now.** §2 stands as written; RLS complexity accepted as the price of branch/org isolation the 37 files actually require. |
| **D2** | **What exactly IS an event?** | `cross-organization-event-collaboration` uses ONE entity with 3 types + visibility matrices; `organizational-repertoire-model` also has "events" (cross-branch, partial/full collaboration) which look like the same entity at org size; `gigs-and-performance-history` excludes multi-org entirely. The `event_type` column proposed here is required by the features but unspecified — no scenario ever sets it. | (1) One `events` table + `type` + participants (this doc). (2) Two entities: org-level "event" vs. cross-org "event" — clean separation, but the org-level event (cross-branch) has no type vocabulary and would degenerate to `type='mixed-group'`. (3) Event-as-setlist-scope only: no separate event table, only a `setlists.scope='event'` flag + participant edges — fewer tables, but loses the slot sequence + slot-time budget that `sequence-only` visibility requires. | **(1) One `events` table + `type` + participants.** §2 stands; the degenerate org-level event is accepted as `type='mixed-group'`. `event_type` remains an open product question: the features name the types but no scenario sets one. |
| **D3** | **Who owns an event setlist after the event ends?** | "The setlist belongs to the event, not to any single church" vs. "each participating church can reference the setlist in their historical records" vs. org-repertoire "Only Org A members can edit Song 2 after the event" vs. "setlist persists… read-only historical mode". The features never define post-event write capability (only read access). | (1) Event-owned, read-only for all participants (this doc) — the safest reading of "belongs to the event"; forks of the event setlist become personal/org copies. (2) Copy-on-close into each org's private repertoire (per-org snapshots) — matches "reference in their historical records" but duplicates rows. (3) Event-owned with org-level write on own songs post-event — matches org-repertoire permission preservation but contradicts "no single church owns the setlist". | **(1) Event-owned, read-only for all participants.** §2 stands. "Historical reference" is served by forks/copies at the org's own choice, never by post-event writes into the event entity. |
| **D4** | **What is an annotation anchored to?** | `personal-preferences-and-adaptations` anchors personal annotations to "measure 8"; `collaborative-comments` anchors shared comments to "the second chorus" and PER VERSION; `music-theory` anchors personal chord substitutions to the concrete chord token while transposition keeps them moving with the song. No feature states what happens when the arrangement's sections/measures shift between versions. | (1) Structural anchor: {section, index} (stable) — survives minor chart edits, breaks if sections are reordered. (2) Text-token anchor: matches the exact chord string (stable under transpose, must be re-anchored on chart edits). (3) Positional anchor: measure/timestamp (matches the scenario literally) — breaks on any content shift; needs re-anchor rules. | **(1) Structural anchor: {section, index}.** §2's `shared_comments.anchor` and `personal_annotations.anchor` are already structural; the `measure/timestamp` variant stays available for free-text personal notes (positional), while chord substitutions remain text-token keyed per music-theory. |
| **D5** | **Song duration: stored or derived?** | `setlist-creation` sums "song durations" for setlist totals; `rehearsal-workflow` estimates agenda duration from song lengths; `service-planning` warns on block overrun; `export-and-sharing` puts durations in exports; `gigs` validates slots. The features never say where duration comes from (metadata field? per-section from music-theory?). | (1) Declared base duration per version (simple integer seconds), section durations override for practice/projection. (2) Derived from section time signatures + tempo (music-theory owns section meter/tempo) — no storage, but requires every song to declare them (many lack it). (3) Both: declared default overridable by derived estimate — matches reality, costs a column + a computed fallback. | **(3) Both — declared default overridable by derived estimate.** `song_versions.duration_seconds` added (declared base); when a version declares `section_context` meter/tempo, the estimate overrides for setlist/rehearsal/service totals. Songs with neither report duration as unknown rather than guessed. |
| **D6** | **What is a chart, really — inline text vs. stored object?** | `music-notation`/`pdf-scan-charts`/`export-and-sharing` treat charts as uploadable/replaceable FILES; `music-theory` treats the chart as inline concrete text that must be parsed + transposable; `congregation-projection` edits a typo and creates a VERSION. tech-spec §4 stores `content TEXT` OR `file_url` — never both. | (1) Two paths per version: inline `content` OR `chart_file` object (this doc, mirrors tech-spec). (2) All charts are stored objects with a `content` extraction field — uniform but forces a storage round-trip for a ChordPro line-edit. (3) Text formats inline only, PDF/MusicXML always objects (constraint by format) — clean, but MusicXML preview via OSMD wants the file bytes anyway. | **(1) Two paths per version: inline `content` OR `chart_file` object.** §2 stands. MusicXML preview reads the chart_file object bytes directly. |
| **D7** | **Do system-level songs sit in the same `songs` table, or a separate system table?** | organizational-repertoire-model treats system repertoire as a distinct catalog ("system remains unchanged", promote/demote between levels) while search-and-discovery filters by "source (system vs org vs private)". One table with a level flag (this doc) vs. two tables changes every org-level join and the promote/demote migration. | (1) Single `songs` table, level derived from nullable org_id/branch_id (this doc) — promote/demote is an UPDATE, all joins stay. (2) Two tables (`system_songs` + `songs` with system FK) — clean level separation, promote/demote becomes a copy + re-point, setlist references must survive it (song-lifecycle merge re-targets them). (3) Level as an enum column incl. "private" variants — simplest, but makes "private" a level rather than a scope and breaks the ancestor-visible RLS rule. | **(1) Single `songs` table, level derived from nullable org_id/branch_id.** §2 stands as written; promote/demote stays an UPDATE, all joins stay intact. |

---

## 5. Replacement note

If approved, this doc replaces `docs/technical-spec.md` §4 (PostgreSQL schema + RLS block). The mapping is direct: §1 supersedes the current 5-table sketch, §2 is the DDL contract (the tech-spec's `tenant_id` column becomes the `org_id`+`branch_id` scope pair; its `annotations` table splits into `shared_comments` + `personal_annotations`), §3 supplies the RLS that §4's "Similar policies for setlists, annotations, collections" hand-waves past, and §4 carries forward the tech-spec's own §10.9.1 "every core table carries a tenant identifier" requirement in a form the 37 features can actually enforce. Nothing else in technical-spec.md is touched: §3 (stack) and §10 (decisions) remain authoritative, and §4's `users` note (profiles are cross-tenant identity) is preserved unchanged.