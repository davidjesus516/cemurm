-- CEMURM initial schema (44 entities) from docs/database-schema-v2.md §2 - ported verbatim

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

CREATE TABLE invite_codes (             -- A6: ONE table for org invites + proximity codes; kind drives the expiry default
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES organizations(id) ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'org_invite',  -- 'org_invite' (default 7 days) | 'proximity' (24 h)
  code        text NOT NULL UNIQUE,    -- 'ACAD-MAD-001'
  role        text NOT NULL,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  expires_at  timestamptz NOT NULL,    -- default: now() + interval '7 days' for org_invite; '24 hours' for proximity
  used_at     timestamptz
);

-- ══════════════════════ 2.2 ROLES ══════════════════════
CREATE TYPE role AS ENUM (
  'system_admin',          -- system-level repertoire, org lifecycle, moderator appointment
  'community_moderator',   -- system-appointed; public-library queue ONLY (never org/private)
  'org_owner', 'org_admin', 'branch_admin',   -- org hierarchy, per branch
  'instructor',            -- adds songs to own branch only
  'org_member', 'performer', 'substitute',    -- performer-level
  'event_coordinator', 'backstage_coordinator'-- cross-org event roles / concert staff
);

-- ══════════════════════ 2.3 REPERTOIRE ══════════════════════
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

-- ══════════════════════ 2.4 SETLISTS, ITEMS, COLLECTIONS ══════════════════════
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

-- ══════════════════════ 2.5 COMMENTARY AND ANNOTATIONS ══════════════════════
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

-- ══════════════════════ 2.6 EVENTS, GIGS, SERVICES, PERFORMANCE ══════════════════════
CREATE TYPE event_type AS ENUM ('mixed-group', 'sequence-only', 'full-program');  -- cross-organization-event-collaboration §128-139

CREATE TABLE events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           event_type NOT NULL,        -- ← column NOT SETTLED BY THE FEATURES — the suite only calls the single entity "event"
  name           text NOT NULL,              -- 'Festival Nacional', 'Symphony Night'
  status         text NOT NULL DEFAULT 'scheduled',  -- 'scheduled' | 'active' | 'concluded' (setlists → read-only archive)
  organizer_id   uuid REFERENCES auth.users(id),     -- event coordinator / concert organizer
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- A1: event metadata (name/date/participants) is readable by ANY org; setlist content gated by event_setlists.visibility.

CREATE TABLE event_participants (       -- org ↔ event edge; drives the per-event repertoire union
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slot_time   timestamptz,              -- sequence-only: organizer sees only this + duration
  slot_minutes integer,                 -- Church E: 30-minute slot; overrun warning when setlist > slot
  sequence    integer,                  -- organizer controls the sequence order
  PRIMARY KEY (event_id, org_id)
);

CREATE TABLE event_rsvps (              -- A5: per-member RSVP state; event reminders target yes + undecided (never explicit no)
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'undecided',   -- 'undecided' | 'yes' | 'no'
  responded_at timestamptz,
  UNIQUE (event_id, member_id)
);

CREATE TABLE event_setlists (           -- setlists that belong to the EVENT, not to any org (post-event ownership ambiguity → Open Decision D3)
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  org_id      uuid REFERENCES organizations(id),        -- org-private setlist within a sequence-only event
  group_name  text,                                     -- mixed-group: 'Group 1' of 3
  setlist_id  uuid NOT NULL REFERENCES setlists(id),    -- reuse the setlists table: same songs, per-org visibility
  sequence    integer,                                  -- organizer controls sequence order within the event
  visibility  text NOT NULL DEFAULT 'private'           -- 'private' | 'org' | 'event' | 'public' (booklet after finalize)
);
-- Sequence: event_setlists.(event_id, sequence). With per-org visibility per event type — RLS in §3.

-- NOTE: venues is defined before gigs here because gigs.venue_id REFERENCES venues(id);
-- in the doc (§2.6) venues appears AFTER gigs; swapped only for Postgres creation-order validity.
CREATE TABLE venues (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES auth.users(id),
  name       text NOT NULL,               -- 'Café La Luna'
  location   text,                        -- 'Calle Luna 3, Madrid'
  type       text                         -- 'bar' | 'outdoor' | ... (no geo/maps — explicit non-goal)
);

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
  scope       text NOT NULL DEFAULT 'org',    -- A3: 'org' plans → org members only; 'event' plans → cross-org allowed
  candidates  uuid[] NOT NULL,             -- eligible members (instrument match) — re-evaluated per request
  status      text NOT NULL DEFAULT 'open',    -- 'open' | 'covered' | 'closed' (first accept wins; cancels reopen)
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- ══════════════════════ 2.7 PRACTICE, REHEARSAL, COLLABORATION ══════════════════════
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
  org_id      uuid REFERENCES organizations(id),  -- NULL when scope='event' (A7)
  branch_id   uuid REFERENCES branches(id),
  event_id    uuid REFERENCES events(id),         -- A7: non-null for event-scoped (mixed-group) rehearsals
  scope       text NOT NULL DEFAULT 'org',        -- 'org' (branch RLS) | 'event' (event visibility matrix)
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
  invite_code_id uuid REFERENCES invite_codes(id),  -- A6: proximity codes ARE invite_codes (kind='proximity', 24 h)
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

-- ══════════════════════ 2.8 COMMUNITY & MODERATION ══════════════════════
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

CREATE TABLE dmca_notices (               -- entity #44: formal legal-log of takedown notices / counter-notices (DMCA §512(c)(3))
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                 text NOT NULL,               -- 'notice' | 'counter_notice'
  sender_name          text NOT NULL,               -- rightsholder / claimant (or the accused user on a counter-notice)
  sender_email         text NOT NULL,               -- contact for the notice (required statutory detail)
  recipient_email      text,                        -- designated DMCA agent email the notice was addressed to (NULL until registered)
  subject_public_song_id uuid REFERENCES public_songs(id),  -- the infringing content; NULL if it names off-platform / non-public content
  received_at          timestamptz NOT NULL DEFAULT now(), -- DMCA requires prompt action measured from receipt
  statutory_details    jsonb,                       -- the legal notice body: signed statement, identification of the work, good-faith + perjury declarations (copied verbatim, retained per §512(c)(3))
  case_id              uuid REFERENCES moderation_cases(id), -- set when a moderator opens a case from the notice
  status               text NOT NULL DEFAULT 'received'      -- 'received' | 'processing' | 'resolved'
);
CREATE INDEX idx_dmca_notices_status ON dmca_notices(status, received_at);

-- ══════════════════════ 2.9 DEVICES, HARDWARE, SYNC ══════════════════════
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

CREATE TABLE audience_views (             -- A8: anonymous by default; push binding ONLY via opt-in
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id   uuid NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE,      -- QR/embed token; expiry enforced on read
  expires_at   timestamptz NOT NULL,      -- 7-day default; owner revokes by deleting the row
  user_id      uuid REFERENCES auth.users(id),  -- NULL unless the viewer opts into "notify on update"
  push_token   text,                      -- push subscription ref, bound to user_id on opt-in; revocable
  created_by   uuid NOT NULL REFERENCES auth.users(id)  -- setlist owner/director
);

CREATE TABLE scale_catalog (              -- entity #43: extensible scale/mode catalog, data not logic
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,          -- 'Major', 'Dorian', 'Melodic Minor'
  aliases         text[],                 -- alternative names, e.g. 'Ionian' | 'Aeolian' | 'Hijaz'
  intervals       integer[] NOT NULL,     -- semitone offsets from root, e.g. Major = {0,2,4,5,7,9,11}
  parent_scale_id uuid REFERENCES scale_catalog(id),  -- NULL for root scales, populated for modes
  rotation        integer,                -- which rotation of the parent scale (0-based)
  cardinality     integer NOT NULL        -- number of notes in the scale
);