-- CEMURM 0041 — gig shared-to-branch read access (privacy slice, N2 unit 2)
--
-- Requirement source:
--   features/gigs-and-performance-history.feature:128-135
--     "Gig visibility follows the org and branch model" — Lucia creates the gig
--     private to herself, shares it to "Sede Madrid"; Juan, a member of
--     "Sede Madrid", can open the gig and, once completed, its performance
--     record; Pedro, a member of "Sede Lima", cannot open the gig.
--   features/offboarding-cascade.feature:33-37
--     "Owned gig records stay hers and remain read-only for the org" — after the
--     owner leaves, the gig and its performance record stay with her AND org
--     members keep read-only access to the completed gig.
--   The 128-135 coverage is marked deferred in openspec/specs/gigs/spec.md:5
--   ("deferred, org model is Hito 4"). Hito 4 landed; that deferral is now the
--   only gap, because shared_to_branch (0001:300) is written by the client
--   (src/data/repositories/gigs.js:439, :540) and read by nothing at all — its
--   single appearance in supabase/migrations/ before this file is the column
--   definition itself.
--
-- The rule (D1): a COMPLETED gig that its owner shared to a branch is readable by
-- the ACTIVE members of that branch. The scope is the BRANCH, not the org — the
-- scenario asserts that Pedro, active member of "Sede Lima" in the SAME org, must
-- see nothing, and an org-wide is_org_member check fails exactly that assertion.
-- The shape mirrors the songs_select_branch precedent (0016:137-144):
-- `branch_id = any(private.user_branch_ids((select auth.uid())))`.
-- private.user_branch_ids (0002:20-24) aggregates branch ids of ACTIVE
-- memberships only, so a former member is excluded with no extra status check
-- here; a redundant one would be dead weight, and the smoke asserts the former
-- member reads 0 rows.
--
-- Three tables, not one (D2). The requirement pairs "the gig AND its performance
-- record" (:37) with "once completed, its performance record" (:134). A read path
-- that returns the performance row but not its items would render an empty
-- setlist, which reads as a bug rather than as privacy. So performances
-- (performances.gig_id → gigs, one hop) and performance_items
-- (performance_items.performance_id → performances → gigs, two hops) get the same
-- hop, in the nested single-relation EXISTS shape 0004 already uses for their
-- owner policies — no joins, so the policy graph stays acyclic.
--
-- Fail closed (D3): branch_id IS NULL grants NO member read. The sharing action in
-- the scenario always names a branch target ("shares the gig to Sede Madrid"), so
-- an org-wide fallback for a branch-less gig would widen access past what the spec
-- asks for. A shared, completed, branch-less gig stays owner-only.
--
-- Read-only is structural (D4): only `for select` policies are added here. INSERT,
-- UPDATE and DELETE stay owner-only, so "read-only for members" is enforced by the
-- absence of a write policy — not by a convention somebody could forget.
--
-- Additive (D5): 0001/0004/0016 are immutable. Every policy below is recreated
-- with `drop policy if exists` + `create policy`, so a fresh full-chain reset and
-- an already-deployed database converge to the same state. The existing owner
-- policies are left untouched: RLS is permissive-OR, so owners keep every right
-- they had — before and after leaving the org, because owner_id does not depend on
-- membership.
--
-- No new GRANT is needed: 0004:290 already granted select, insert, update, delete
-- on these three tables to authenticated. The smoke asserts
-- has_table_privilege('authenticated', ..., 'select') as a permanent guard, since
-- the policies above are inert without that grant.

-- ══════════════════════ gigs — branch-scoped read of a shared completed gig ══════════════════════
drop policy if exists gigs_select_org_shared on public.gigs;
create policy gigs_select_org_shared on public.gigs
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and shared_to_branch
    and status = 'completed'
    and branch_id is not null
    and branch_id = any(private.user_branch_ids((select auth.uid())))
  );

-- ══════════════════════ performances — one hop: performances.gig_id → gigs ══════════════════════
-- The gig predicate is repeated on the hop instead of deferring to the gigs
-- policy, so the intent of this policy is readable on its own and cannot be
-- weakened by a later change to gigs_select_org_shared.
drop policy if exists performances_select_org_shared on public.performances;
create policy performances_select_org_shared on public.performances
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.gigs g
      where g.id = public.performances.gig_id
        and g.shared_to_branch
        and g.status = 'completed'
        and g.branch_id is not null
        and g.branch_id = any(private.user_branch_ids((select auth.uid())))
    )
  );

-- ══════════════════════ performance_items — two hops: performance_id → performances → gigs ══════
-- Same nested single-relation exists as performance_items_select_owner (0004:147-160);
-- the inner hop repeats the gig check, so an item can only be read through a
-- performance that itself belongs to the shared completed gig.
drop policy if exists performance_items_select_org_shared on public.performance_items;
create policy performance_items_select_org_shared on public.performance_items
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.performances p
      where p.id = public.performance_items.performance_id
        and exists (
          select 1 from public.gigs g
          where g.id = p.gig_id
            and g.shared_to_branch
            and g.status = 'completed'
            and g.branch_id is not null
            and g.branch_id = any(private.user_branch_ids((select auth.uid())))
        )
    )
  );
