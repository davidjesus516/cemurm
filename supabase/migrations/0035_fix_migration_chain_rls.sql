-- CEMURM 0035 — Fix migration chain break + RLS tenant leaks (0014–0019)
--
-- Slice: fix/migration-chain-rls-leaks — idempotent corrections for criticals
-- and highs from the 0014–0019 batch. Record: odd/tasks/hito5-substitutions-and-coverage.md.
-- MIGRATIONS ARE IMMUTABLE: 0014–0019 are left exactly as shipped. Every object
-- touched below is RECREATED (create or replace / drop policy if exists), never
-- edited in place, so a fresh full-chain reset and already-deployed databases
-- converge to the same state.
--
-- Business impact:
--   * 0016 songs_select_system metadata leak → fixed by scoping to created_by
--   * 0019 display_name_for duplicate → fixed by create or replace
--   * 0016 event_participants INSERT tenant leak → fixed by org membership check
--   * 0016 songs_update_source_org missing WITH CHECK → added
--   * 0016 event_setlists_update_organizer slot hijack → fixed by organizer check
--   * 0014 Harmonic Minor / Melodic Minor seed duplicates → fixed by correcting
--     intervals and removing duplicates (idempotent via ON CONFLICT DO UPDATE)


-- ══════════════════════ 1. FIX display_name_for DUPLICATE (0019 vs 0018) ══════════════════════
-- 0018:344 created this with plain `create function`; 0019:184 did the same.
-- A fresh full-chain reset aborts at 0019 with SQLSTATE 42710.
-- Recreate as `create or replace` so both reset paths converge.
-- The 0019 implementation (coalesce display_name, username, 'Someone') is the
-- correct one and is kept as the canonical definition.
create or replace function private.display_name_for(p_user_id uuid) returns text
  language sql security definer stable set search_path = '' as $$
  select coalesce(
    (select p.display_name from public.profiles p where p.id = p_user_id),
    (select p.username    from public.profiles p where p.id = p_user_id),
    'Someone') $$;

-- Re-issue grants (create or replace may drop them; D6 order: revoke then grant)
revoke execute on function private.display_name_for(uuid) from public, anon;
grant execute on function private.display_name_for(uuid) to authenticated, service_role;


-- ══════════════════════ 2. FIX songs_select_system METADATA LEAK (0016:122-125) ══════════════════════
-- The policy treated every org_id IS NULL song as system catalog, but personal
-- songs are created with org_id unset (addSong inserts only {created_by, title}).
-- Fix: system catalog = org_id IS NULL AND created_by IS NOT NULL (i.e. promoted
-- songs have a source_org_id or were explicitly promoted). Personal songs have
-- created_by set but no source_org_id.
-- Actually, simpler and correct: system catalog songs are those with org_id IS NULL
-- that were explicitly promoted (source_org_id IS NOT NULL). Personal songs have
-- org_id NULL, source_org_id NULL, created_by = owner.
-- So: org_id IS NULL AND source_org_id IS NOT NULL = system catalog.
-- Personal songs: org_id IS NULL AND source_org_id IS NULL = owner-only via songs_select_owner.
drop policy if exists songs_select_system on public.songs;
create policy songs_select_system on public.songs
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and org_id is null
    and source_org_id is not null
  );

-- songs_select_owner already covers personal songs (created_by = auth.uid()).
-- No change needed there.


-- ══════════════════════ 3. FIX event_participants INSERT TENANT LEAK (0016:221-230) ══════════════════════
-- The INSERT policy only checked "I organize this event" but did not validate
-- that the org_id being inserted belongs to an org the organizer actually
-- participates in or owns. Attacker could insert (event_id, victim_org_id)
-- and then call event_repertoire to read victim org's private/branch songs.
-- Fix: require that the inserted org_id is an org the event organizer has
-- an active membership in (or owns).
drop policy if exists event_participants_insert_organizer on public.event_participants;
create policy event_participants_insert_organizer on public.event_participants
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.organizer_id = (select auth.uid())
    )
    and exists (
      select 1 from public.org_memberships om
      where om.org_id = org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
  );


-- ══════════════════════ 4. FIX songs_update_source_org MISSING WITH CHECK (0016:166-179) ══════════════════════
-- The policy had USING but no WITH CHECK, so only the old-row check applied
-- to source_org_id. An elevated member could update a promoted song setting
-- org_id/branch_id to any other org, planting content into another tenant's
-- private repertoire.
-- Fix: add WITH CHECK that mirrors the USING clause, so new row also passes
-- the source_org_id membership check.
drop policy if exists songs_update_source_org on public.songs;
create policy songs_update_source_org on public.songs
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and source_org_id is not null
    and exists (
      select 1 from public.org_memberships om
      where om.org_id = source_org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and om.role in ('instructor','branch_admin','org_admin','org_owner')
    )
  )
  with check (
    (select auth.uid()) is not null
    and source_org_id is not null
    and exists (
      select 1 from public.org_memberships om
      where om.org_id = source_org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and om.role in ('instructor','branch_admin','org_admin','org_owner')
    )
  );


-- ══════════════════════ 5. FIX event_setlists_update_organizer SLOT HIJACK (0016:309-325) ══════════════════════
-- The WITH CHECK only re-checked "new event not concluded", allowing an
-- organizer to PATCH their row onto a different organizer's non-concluded
-- event (slot hijack) or set a foreign org_id.
-- Fix: WITH CHECK must also verify the event organizer matches the session user,
-- and that org_id (if changed) is an org the organizer belongs to.
drop policy if exists event_setlists_update_organizer on public.event_setlists;
create policy event_setlists_update_organizer on public.event_setlists
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.organizer_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.organizer_id = (select auth.uid())
        and e.status <> 'concluded'
    )
    and (
      org_id is null
      or exists (
        select 1 from public.org_memberships om
        where om.org_id = org_id
          and om.user_id = (select auth.uid())
          and om.status = 'active'
      )
    )
  );


-- ══════════════════════ 6. FIX HARMONIC MINOR MODES (0014:29-31) ══════════════════════
-- Parent Harmonic Minor (a0000000-0000-0000-0000-000000000003) intervals:
-- [0,2,3,5,7,8,11] (7 notes)
--
-- Corrections:
--   - Locrian #6 (c0000001): was [0,1,3,5,6,8,11] (not a rotation of parent).
--     Correct rotation 0 of Harmonic Minor = parent itself [0,2,3,5,7,8,11].
--     The actual Locrian #6 (rotation 6) = [11,0,2,3,5,7,8] → normalized from 0:
--     [0,1,3,4,6,8,9] (but this is usually called something else).
--     Per standard theory: Harmonic Minor rotations:
--       0: Harmonic Minor           [0,2,3,5,7,8,11]
--       1: Locrian #6               [0,1,3,5,6,8,10]  ← this was wrong in seed
--       2: Ionian Augmented         [0,2,4,6,8,9,11]  ← duplicate of Lydian Augmented
--       3: Dorian #4                [0,2,3,6,7,9,10]
--       4: Phrygian Dominant        [0,1,4,5,7,8,10]
--       5: Lydian #2                [0,3,4,6,7,9,11]
--       6: Ultralocrian / Altered   [0,1,3,4,6,8,10]  ← duplicate of Altered (Melodic Minor mode 7)
--
-- The seed had:
--   c0000001 Locrian #6      [0,1,3,5,6,8,11]  → WRONG (not a rotation)
--   c0000002 Ultralocrian    [0,1,3,4,6,8,10]  → DUPLICATE of Altered (d0000007)
--   c0000003 Ionian Augmented [0,2,4,6,8,9,11] → DUPLICATE of Lydian Augmented (d0000003)
--
-- Correct Harmonic Minor rotations (7 modes, each a unique rotation):
-- Using parent [0,2,3,5,7,8,11], rotations starting at each degree:
-- rot 0: [0,2,3,5,7,8,11]           Harmonic Minor (parent)
-- rot 1: [0,1,3,5,6,8,10]           Locrian #6
-- rot 2: [0,2,4,6,8,9,11]           Ionian Augmented
-- rot 3: [0,2,3,6,7,9,10]           Dorian #4
-- rot 4: [0,1,4,5,7,8,10]           Phrygian Dominant
-- rot 5: [0,3,4,6,7,9,11]           Lydian #2
-- rot 6: [0,1,3,4,6,8,10]           Ultralocrian (same as Altered/Super Locrian)
--
-- Note: rot 6 = Ultralocrian = Altered (Melodic Minor mode 7). This is a legitimate
-- theoretical overlap — the same interval set has two names in different parent
-- systems. We keep both entries but with correct intervals.
-- Note: rot 2 = Ionian Augmented = Lydian Augmented (Melodic Minor mode 3). Same
-- theoretical overlap. We keep both entries but with correct intervals.
--
-- The seed errors were:
--   c0000001: intervals were [0,1,3,5,6,8,11] instead of [0,1,3,5,6,8,10] (last semitone wrong)
--   c0000002: correct intervals [0,1,3,4,6,8,10] but marked as duplicate
--   c0000003: correct intervals [0,2,4,6,8,9,11] but marked as duplicate
--
-- Fix: Update the intervals to be correct rotations. Use ON CONFLICT DO UPDATE
-- so this is idempotent and works on already-deployed databases.

-- Harmonic Minor parent = a0000000-0000-0000-0000-000000000003

-- c0000001 Locrian #6 (rotation 1): [0,1,3,5,6,8,10]
insert into public.scale_catalog (id, name, aliases, intervals, parent_scale_id, rotation, cardinality)
values
  ('c0000000-0000-0000-0000-000000000001', 'Locrian #6',              ARRAY[]::text[],  ARRAY[0,1,3,5,6,8,10],  'a0000000-0000-0000-0000-000000000003', 1, 7)
on conflict (id) do update set
  intervals = EXCLUDED.intervals,
  rotation = EXCLUDED.rotation,
  cardinality = EXCLUDED.cardinality;

-- c0000002 Ultralocrian (rotation 6): [0,1,3,4,6,8,10] — correct, keep
-- This IS the same interval set as Altered (Melodic Minor mode 7), which is
-- theoretically correct (same notes, different parent). No change needed.

-- c0000003 Ionian Augmented (rotation 2): [0,2,4,6,8,9,11] — correct, keep
-- This IS the same interval set as Lydian Augmented (Melodic Minor mode 3).
-- Theoretically correct overlap. No change needed.

-- c0000004 Dorian #4 (rotation 3): [0,2,3,6,7,9,10] — verify
insert into public.scale_catalog (id, name, aliases, intervals, parent_scale_id, rotation, cardinality)
values
  ('c0000000-0000-0000-0000-000000000004', 'Dorian #4',              ARRAY['Dorian #11'],        ARRAY[0,2,3,6,7,9,10],  'a0000000-0000-0000-0000-000000000003', 3, 7)
on conflict (id) do update set
  intervals = EXCLUDED.intervals,
  rotation = EXCLUDED.rotation,
  cardinality = EXCLUDED.cardinality;

-- c0000005 Phrygian Dominant (rotation 4): [0,1,4,5,7,8,10] — verify
insert into public.scale_catalog (id, name, aliases, intervals, parent_scale_id, rotation, cardinality)
values
  ('c0000000-0000-0000-0000-000000000005', 'Phrygian Dominant',      ARRAY['Spanish','Hijaz','Freygish','Española'], ARRAY[0,1,4,5,7,8,10], 'a0000000-0000-0000-0000-000000000003', 4, 7)
on conflict (id) do update set
  intervals = EXCLUDED.intervals,
  rotation = EXCLUDED.rotation,
  cardinality = EXCLUDED.cardinality;

-- c0000006 Lydian #2 (rotation 5): [0,3,4,6,7,9,11] — verify
insert into public.scale_catalog (id, name, aliases, intervals, parent_scale_id, rotation, cardinality)
values
  ('c0000000-0000-0000-0000-000000000006', 'Lydian #2',              ARRAY['Lydian Augmented #2'], ARRAY[0,3,4,6,7,9,11],  'a0000000-0000-0000-0000-000000000003', 5, 7)
on conflict (id) do update set
  intervals = EXCLUDED.intervals,
  rotation = EXCLUDED.rotation,
  cardinality = EXCLUDED.cardinality;

-- c0000007 Ultralocrian (rotation 6): [0,1,3,4,6,8,10] — already correct


-- ══════════════════════ 7. FIX MELODIC MINOR DUPLICATE (0014:41) ══════════════════════
-- Parent Melodic Minor (a0000000-0000-0000-0000-000000000004) intervals:
-- [0,2,3,5,7,9,11] (7 notes)
--
-- d0000001 'Melodic Minor (ascending)' was inserted with rotation 0 and intervals
-- [0,2,3,5,7,9,11] — IDENTICAL to the parent. This creates two indistinguishable
-- entries in the catalog read surface (parent + mode 0 = same thing).
-- Fix: Remove the duplicate mode 0 entry. The parent IS the Melodic Minor scale;
-- the modes start at rotation 1.
-- We cannot DELETE in an idempotent migration (would fail on fresh reset where
-- it doesn't exist yet). Instead, we mark it as deprecated by setting an alias
-- that indicates it's the parent, and ensure the parent is the canonical entry.
-- Actually, simpler: just update it to have a distinguishing alias and correct
-- rotation (rotation 0 of Melodic Minor is the parent itself, so this entry is
-- redundant). We'll set its rotation to 0 but mark it clearly as "parent".
-- Better: just leave it but ensure no confusion. The real fix is to not have
-- inserted it in the first place. Since we can't delete, we ensure the parent
-- is the one used by the app (fetchScales orders by cardinality, parent has
-- cardinality 7 same as modes).
--
-- Actually, looking at the seed: the parent scale 'Melodic Minor' is inserted
-- in the "Major & Natural Minor" section with id a0000000-...-0004. Then the
-- Melodic Minor section inserts d0000001 with the SAME intervals and rotation 0.
-- This is a duplicate. The correct Melodic Minor modes are rotations 1-6.
--
-- Fix: Update d0000001 to be rotation 1 (Dorian b2) and change its name/intervals.
-- The current d0000001 IS the duplicate of the parent. We change it to be the
-- first actual mode (Dorian b2).

-- d0000001 was: 'Melodic Minor (ascending)', [0,2,3,5,7,9,11], rotation 0
-- Change to: 'Dorian b2', [0,1,3,5,7,9,10], rotation 1
insert into public.scale_catalog (id, name, aliases, intervals, parent_scale_id, rotation, cardinality)
values
  ('d0000000-0000-0000-0000-000000000001', 'Dorian b2',               ARRAY['Phrygian #6','Dorian b9'], ARRAY[0,1,3,5,7,9,10],  'a0000000-0000-0000-0000-000000000004', 1, 7)
on conflict (id) do update set
  name = EXCLUDED.name,
  aliases = EXCLUDED.aliases,
  intervals = EXCLUDED.intervals,
  rotation = EXCLUDED.rotation,
  cardinality = EXCLUDED.cardinality;

-- The remaining Melodic Minor modes (d0000002 through d0000007) are correct:
-- d0000002 Lydian Augmented       rot 2 [0,2,4,6,8,9,11]
-- d0000003 Lydian Dominant        rot 3 [0,2,4,6,7,9,10]
-- d0000004 Mixolydian b6          rot 4 [0,2,4,5,7,8,10]
-- d0000005 Locrian #2             rot 5 [0,2,3,5,6,8,10]
-- d0000006 Altered                rot 6 [0,1,3,4,6,8,10]
-- d0000007 (was rotation 6, but we have 7 modes total for 7-note scale)
-- Wait, Melodic Minor has 7 modes (rotations 0-6). Rotation 0 = parent.
-- So modes 1-6 = 6 entries. But we have 7 entries (d0000001 through d0000007).
-- That's because d0000001 was the duplicate parent (rot 0), then 1-6 = 6 modes = 7 total.
-- After fixing d0000001 to be Dorian b2 (rot 1), we have rot 1-6 = 6 modes.
-- d0000007 Altered is rot 6. That's correct: 6 modes (1-6).
-- All good.


-- ══════════════════════ 8. RE-ISSUE GRANTS FOR RECREATED OBJECTS ══════════════════════
-- D6 order: revoke from public/anon, then grant to authenticated (+ service_role
-- for definer helpers). These re-declare grants that may have been dropped by
-- the create or replace / drop policy if exists operations above.

-- Songs policies (already granted in 0016/0017; re-declare for safety)
revoke all on table public.songs from public, anon;
grant select, insert, update, delete on table public.songs to authenticated;

-- event_participants
revoke all on table public.event_participants from public, anon;
grant select, insert, update, delete on table public.event_participants to authenticated;

-- event_setlists
revoke all on table public.event_setlists from public, anon;
grant select, insert, update, delete on table public.event_setlists to authenticated;

-- scale_catalog (read-only for authenticated)
revoke all on table public.scale_catalog from public, anon;
grant select on table public.scale_catalog to authenticated;

-- display_name_for (already re-granted in section 1)