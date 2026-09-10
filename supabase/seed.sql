-- CEMURM demo seed (dev-only; runs via `supabase db reset` as postgres, never via db push).
-- Deterministic UUIDs per design D8: users …0001/…0002, orgs …00a1/…00a2, branch …00b1;
-- every other row reuses the same 10000000-… pattern with a per-table suffix family so
-- reset → verify stays repeatable. Columns match supabase/migrations/0001_init.sql exactly
-- (48 tables; role/member_status values follow the enums; no invented tables or columns).

-- ── identities (password grant via GoTrue; email_confirmed_at set so tokens work)
-- Note: GoTrue v2 scans the token/phone columns as plain strings, so they get ''
-- (never NULL) or login fails with "converting NULL to string is unsupported".
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000001', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Demo","lastName":"User","displayName":"Demo User"}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'isolation@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000002', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Isolation","lastName":"User","displayName":"Isolation User"}', now(), now());

-- ── tenancy: orgs, branch, memberships ──
insert into organizations (id, name, org_type, status) values
  ('10000000-0000-0000-0000-0000000000a1', 'Demo Academy', 'Academy', 'active'),
  ('10000000-0000-0000-0000-0000000000a2', 'Isolation Org', 'Academy', 'active');

insert into branches (id, org_id, name, city, status) values
  ('10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000a1', 'Sede Centro', 'Madrid', 'active');

-- demo = org_owner in Demo Academy; isolation = org_member in Isolation Org (cross-org isolation proof)
insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_owner', 'active'),
  ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000a2',
   null, 'org_member', 'active');

-- ── repertoire: 2 demo-owned songs + 1 isolation-owned ──
insert into songs (id, org_id, branch_id, title, artist, genre, created_by) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Way Maker', 'Sinach', 'worship',
   '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Oceans (Where Feet May Fail)', 'Hillsong UNITED', 'worship',
   '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000a2',
   null, 'Isolation Anthem', 'Isolation Band', 'rock',
   '10000000-0000-0000-0000-000000000002');

-- ── setlist: demo owner + isolation as accepted view-only collaborator + 2 items ──
insert into setlists (id, org_id, branch_id, owner_id, name, visibility) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000001',
   'Demo Setlist', 'shared');

insert into setlist_collaborators (setlist_id, user_id, can_edit, accepted_at) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   false, now());

insert into setlist_items (id, setlist_id, song_id, position, agreed_key) values
  ('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 1, 'G'),
  ('30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002', 2, 'C');

-- ── per-user dev rows (demo) ──
insert into practice_sessions (id, user_id, song_id, instrument, started_at, ended_at) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'guitar',
   now() - interval '2 hours', now() - interval '118 minutes');

insert into personal_annotations (id, user_id, song_id, anchor, kind, value) values
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   '{"section":"Chorus","index":1}', 'note', 'Ring out the open A; watch the F#m voicing');

-- unread notification (read_at NULL)
insert into notifications (id, user_id, category, title, body, payload) values
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   'setlist', 'Collaborator accepted', 'Isolation User accepted the invite to Demo Setlist.',
   '{"setlist_id":"30000000-0000-0000-0000-000000000001"}');

insert into device_configs (id, user_id, device_id) values
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'dev-1');

-- outbox: one synced entry correlating the first setlist_item insert
insert into outbox (id, user_id, device_id, entity, entity_id, operation, payload, seq, state, synced_at) values
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'dev-1',
   'setlist_items', '30000000-0000-0000-0000-000000000002', 'insert',
   '{"id":"30000000-0000-0000-0000-000000000002","setlist_id":"30000000-0000-0000-0000-000000000001","song_id":"20000000-0000-0000-0000-000000000001","position":1}'::jsonb,
   1, 'synced', now());

-- ── scale catalog ──
insert into scale_catalog (id, name, aliases, intervals, cardinality) values
  ('50000000-0000-0000-0000-000000000001', 'Major', array['Ionian'], '{0,2,4,5,7,9,11}', 7);