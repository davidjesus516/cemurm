-- CEMURM 0007 — shared_comments author writes: edit / resolve / soft-delete (closes the 0006 UPDATE gap)
--
-- PR#3-4 of hito-3-band-collaboration (chained slices; base = main b55013b, after PR#3-1/2/3 merged).
-- 0006 (lines 197–260) re-opened shared_comments with ONLY select + insert policies and
-- `grant select, insert` to authenticated — every UPDATE-class write (edit, resolve, soft-delete)
-- hit 42501 and the client mapped it to "No access." (comments.js header; apply-progress Batch 5
-- deviation). This file closes that gap with ZERO client changes: comments.js already sends exactly
-- the columns granted below — edit → body+updated_at, resolve → resolved+updated_at, soft-delete
-- → deleted+updated_at (src/lib/comments.js editComment/resolveComment/deleteComment). Unblocks the
-- 3 gated collaborative-comments scenarios — R5 "Edit my own comment" (author-only), R7 "Resolve a
-- comment after the change is applied" (ANY scoped member; schema-v2 line 739: "resolve by anyone
-- in scope") and R8 "Delete my own comment" (soft-delete) — plus their offline replays (R11,
-- tasks.md 3.2: drained ops re-run the same UPDATEs and now pass RLS).
--
-- Pattern follows 0002/0004/0006 exactly: D6 order — RLS enable re-declared → revokes → policies
-- → grants (0002 lines 57–59 and 127–130; 0004 lines 34–39; 0006 lines 205–260); every policy
-- guarded by the initPlan "(select auth.uid()) is not null" (0002 lines 127–130); scope via the
-- same nested single-relation EXISTS chain song → setlist_items → setlists → (owner OR accepted
-- setlist_collaborators), NO joins (D8, acyclic policy graph; 0006 lines 211–258, 0004 lines
-- 83–85). The new helper is SECURITY DEFINER with empty search_path + fully-qualified refs
-- (0002 lines 26–30) and execute revoked from public/anon/authenticated — trigger-only entry
-- (0002 lines 33–39; 0006 lines 53–54 and 292–293).
--
-- ⚠ The resolve-vs-edit split: PostgreSQL RLS UPDATE policies are ROW-scoped (they cannot see
-- which columns a statement writes) and column grants are role-wide (they cannot split body/deleted
-- for the author from resolved for any member on the same table). Two permissive UPDATE policies
-- OR the row scopes — but BOTH stay inside the SAME 3-hop scope chain as the 0006 select/insert
-- policies, so the migration never widens the read/write universe (nothing weakened); the
-- author-write guard trigger (1.4) then re-asserts the COLUMN contract. 0006's accepted-wrinkle
-- precedent (lines 188–190) does NOT apply here: the collaborative-comments spec itself requires
-- author-only edits and deletes (R5/R8 scenarios), so a silent member-writable body/deleted would
-- violate the spec outright, not merely a design nicety.
--
-- Sections: 1.1 RLS + revoke re-declared (D6 order) · 1.2 author-scoped UPDATE (edit + soft-delete,
-- R5/R8) · 1.3 member-scoped resolve UPDATE (R7) · 1.4 author-write guard trigger (column-level
-- contract: identity immutability + author-only body/deleted) · 1.5 column-capped grants, NO grant
-- delete (explicit soft-delete-only decision — the client delete path is the deleted=true UPDATE).

-- ══════════════════════ 1.1 RLS + REVOKE RE-DECLARED (D6 ORDER) ══════════════════════
-- Idempotent re-declarations of the 0006 state (0004 lines 34–39 precedent: "RLS enable is
-- idempotent — re-declared here so the migration stands alone and the contract is explicit");
-- the revoke re-ships the 0002 deny-by-default lock (0002 lines 57–59, 85) before the targeted
-- grants below (D6 order). anon stays locked out everywhere; service_role untouched (revoke list
-- excludes it, 0006 line 209 shape).
alter table public.shared_comments enable row level security;
revoke all on table public.shared_comments from anon, authenticated;

-- ══════════════════════ 1.2 AUTHOR-SCOPED UPDATE — EDIT + SOFT-DELETE (R5/R8) ══════════════════════
-- Row visible to its author only (author_id = session) INSIDE the same 3-hop scope chain as the
-- 0006 select/insert policies (D8) — a removed member loses write with read, nothing is weakened.
-- WITH CHECK pins author_id to the session (0006 insert shape, lines 235–258) so this path cannot
-- re-point authorship. Covers editComment (body) and deleteComment (deleted=true soft-delete) —
-- both are author-only per the spec scenarios.
drop policy if exists shared_comments_update_author on public.shared_comments;
create policy shared_comments_update_author on public.shared_comments
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and public.shared_comments.author_id = (select auth.uid())
    and exists (
      select 1 from public.setlist_items i
      where i.song_id = public.shared_comments.song_id
        and exists (
          select 1 from public.setlists s
          where s.id = i.setlist_id
            and (
              s.owner_id = (select auth.uid())
              or exists (
                select 1 from public.setlist_collaborators c
                where c.setlist_id = s.id
                  and c.user_id = (select auth.uid())
                  and c.accepted_at is not null
              )
            )
        )
    )
  )
  with check (
    (select auth.uid()) is not null
    and public.shared_comments.author_id = (select auth.uid())
    and exists (
      select 1 from public.setlist_items i
      where i.song_id = public.shared_comments.song_id
        and exists (
          select 1 from public.setlists s
          where s.id = i.setlist_id
            and (
              s.owner_id = (select auth.uid())
              or exists (
                select 1 from public.setlist_collaborators c
                where c.setlist_id = s.id
                  and c.user_id = (select auth.uid())
                  and c.accepted_at is not null
              )
            )
        )
    )
  );

-- ══════════════════════ 1.3 MEMBER-SCOPED RESOLVE UPDATE (R7, schema-v2 line 739) ══════════════════════
-- "resolve by anyone in scope": the R7 scenario has a BANDMATE resolve the LEADER's comment, so
-- resolve cannot be author-scoped. Row partition is explicit — OTHER members' comments
-- (author_id <> session) — while own-comment resolve flows through 1.2 (the author), so the two
-- policies are disjoint and the OR never widens anything. Permissive UPDATE policies admit every
-- scoped member to update these rows, so 1.4's trigger re-asserts the column contract that row
-- policies cannot see (body/deleted author-only). Identity/scope columns (song_id, version_id,
-- anchor, parent_id, author_id) are OUTSIDE the update column grant (1.5) — the API surface cannot
-- re-point scope or authorship — and new.author_id is additionally frozen by the trigger (1.4)
-- because THIS policy's with check cannot reference the pre-update row.
drop policy if exists shared_comments_update_resolve_scoped on public.shared_comments;
create policy shared_comments_update_resolve_scoped on public.shared_comments
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and public.shared_comments.author_id <> (select auth.uid())
    and exists (
      select 1 from public.setlist_items i
      where i.song_id = public.shared_comments.song_id
        and exists (
          select 1 from public.setlists s
          where s.id = i.setlist_id
            and (
              s.owner_id = (select auth.uid())
              or exists (
                select 1 from public.setlist_collaborators c
                where c.setlist_id = s.id
                  and c.user_id = (select auth.uid())
                  and c.accepted_at is not null
              )
            )
        )
    )
  )
  with check (
    (select auth.uid()) is not null
    and public.shared_comments.author_id <> (select auth.uid())
    and exists (
      select 1 from public.setlist_items i
      where i.song_id = public.shared_comments.song_id
        and exists (
          select 1 from public.setlists s
          where s.id = i.setlist_id
            and (
              s.owner_id = (select auth.uid())
              or exists (
                select 1 from public.setlist_collaborators c
                where c.setlist_id = s.id
                  and c.user_id = (select auth.uid())
                  and c.accepted_at is not null
              )
            )
        )
    )
  );

-- ══════════════════════ 1.4 AUTHOR-WRITE GUARD TRIGGER (COLUMN-LEVEL CONTRACT) ══════════════════════
-- RLS cannot express "author may set body/deleted, any scoped member may set resolved" on one
-- table (row-scoped policies + role-wide column grants), so this BEFORE UPDATE trigger is the
-- column check: (a) identity immutability for EVERYONE — 1.2's with check pins author_id only on
-- the author path and 1.3's with check cannot reference the pre-update row, so the trigger freezes
-- author_id across both (no privilege escalation: nobody re-points authorship); (b) body/deleted
-- guarded to the author — a scoped member resolving may touch resolved/updated_at only, never
-- draft content (R5/R8). SECURITY DEFINER + empty search_path + fully-qualified refs (0002 lines
-- 26–30); session-bound via auth.uid() so service_role/admin (auth.uid() NULL) bypass unchanged —
-- migrations/seed hard deletes stay possible. Execute revoked: trigger-only entry (0002 lines
-- 33–39; 0006 lines 53–54, 292–293).
create function public.guard_shared_comments_author_write() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  session_uid uuid := (select auth.uid());
begin
  if session_uid is not null then
    if new.author_id is distinct from old.author_id then
      raise exception 'shared_comments author_id is immutable';
    end if;
    if session_uid <> old.author_id
       and (new.body is distinct from old.body or new.deleted is distinct from old.deleted) then
      raise exception 'only the comment author may edit or delete it';
    end if;
  end if;
  return new;
end $$;

revoke all on function public.guard_shared_comments_author_write() from public, anon, authenticated;

create trigger shared_comments_author_write_guard
  before update on public.shared_comments
  for each row execute function public.guard_shared_comments_author_write();

-- ══════════════════════ 1.5 GRANTS AFTER POLICIES (D6 ORDER) ══════════════════════
-- Re-open select+insert (the 1.1 revoke re-declared the lock; net state identical to 0006) and add
-- a COLUMN-CAPPED update grant — EXACTLY the mutable set the client writes (profiles precedent,
-- 0006 lines 174–177): body/deleted (author ops, R5/R8), resolved (member op, R7), updated_at
-- (written by every op; 0001 line 222 has no comments updated_at trigger — the client stamps it,
-- comments.js). Identity/scope columns (song_id, version_id, anchor, parent_id, author_id) stay
-- ungranted → the API surface cannot re-point scope or authorship (1.2 with check + 1.4 trigger
-- backstop). Grant delete is intentionally WITHHELD — explicit soft-delete-only decision: the
-- client delete path is the deleted=true UPDATE (comments.js deleteComment; spec R8 — "comments
-- are soft-deleted; history kept", 0001 line 220), so hard DELETE stays service-role only.
-- Matching a client delete path that does not exist would widen the surface for no feature.
grant select, insert on table public.shared_comments to authenticated;
grant update (body, deleted, resolved, updated_at) on table public.shared_comments to authenticated;