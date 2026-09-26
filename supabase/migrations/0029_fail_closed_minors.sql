-- CEMURM 0029 — Fail-closed minors: an unknown date of birth is NOT adulthood
--
-- Slice: feat/auth-fail-closed-social — work unit 1 (server side only) of the
-- change "Auth — fail-closed minors + social signup + guardian email"
-- (odd/tasks/auth-fail-closed-social.md, tasks T1.1 + T1.2).
-- Business contract (features/minors-and-guardian-consent.feature):
--  · public-sharing gate (scenario 4): a KNOWN minor is still blocked with the
--    unchanged wording 'Guardian approval required for public sharing' until an
--    ACTIVE consent carries public_sharing_approved; NEW third state — a session
--    whose date of birth is unknown is blocked in the same gate with
--    'Complete your date of birth before publishing.'
--  · public-surface exclusion (scenario 6): minors never appear in public
--    profiles / suggested lists — profiles_select_search excludes them.
--    WIDENED HERE: a profile whose date of birth is UNKNOWN is excluded too.
--    Fail-closed intent: we do not expose a profile we cannot verify as an adult.
--  · consent record (scenario 3) and account activation (scenario 2) are
--    deliberately UNCHANGED — see section 5 for why that is not an oversight.
--
-- ⚠ THE DEFECT THIS MIGRATION CLOSES. 0017 made minor status a server-side fact:
-- the profiles_minor_flag trigger (0017 lines 48-66) derives is_minor from
-- date_of_birth, and 0017 line 71 grants `update (date_of_birth)` to
-- authenticated — but nothing anywhere ever WROTE that column. It stayed NULL for
-- every account, so private.session_is_minor() was permanently false and every
-- RLS guard 0017 shipped (the search exclusion, the publish gate, both consent
-- RPCs) was dead code. The only thing that ever locked a minor account was a
-- client-side boolean in GoTrue user_metadata that the account holder can edit
-- through updateUser(). 0017's private.profile_is_minor is fail-OPEN in itself
-- too: it coalesces a missing row to false, so "unknown" and "adult" were
-- indistinguishable. This migration makes UNKNOWN its own, blocked state at the
-- two points that decide PUBLIC exposure, and grandfathers the existing base
-- (section 6) so the change does not lock out accounts that predate the gate.
--
-- Conventions (0002/0012/0017 style): comment headers with a scenario map;
-- SECURITY DEFINER cores in `private` with `set search_path = ''` +
-- fully-qualified refs; REVOKE from public/anon THEN GRANT to authenticated +
-- service_role (grants AFTER policies — D6 order); policy-recursion contract —
-- a policy reaches cross-table state only through a `private` definer helper
-- (0002 lines 136-141 precedent), so profiles_select_search stays acyclic.
-- MIGRATIONS ARE IMMUTABLE: 0017 is left exactly as shipped. Every 0017 object
-- touched below is RECREATED (create or replace / drop policy if exists), never
-- edited in place, and the rest of 0017 is untouched by design.


-- ══════════════════════ 1. HELPERS — "KNOWN" AND "VERIFIED ADULT" ══════════════════════
-- Two new facts about a profile, both resolved the way 0002/0017 resolve state
-- from a policy: a SECURITY DEFINER helper in `private`, `stable`,
-- `set search_path = ''`, fully-qualified `public.` refs. Definer helpers are the
-- sanctioned way to break the profiles → profiles recursion, so
-- profiles_select_search (section 2) can ask these questions without a policy cycle.
--
-- profile_dob_known: a row exists AND its date_of_birth is not null. This is the
-- raw fact — "has this account declared a birth date at all" — with NO judgement
-- about what the date says. Used by the publish gate (section 3), which must
-- distinguish "declared" from "declared and adult".
--
-- profile_not_verified_adult: TRUE iff we CANNOT prove adulthood — no row at all,
-- OR date_of_birth IS NULL, OR is_minor is true. This is the 0017
-- private.profile_is_minor inversion: 0017 fail-opens on a missing row (coalesce
-- to false, "not a minor"), which is exactly the hole. Fail-closed here: a missing
-- row is NOT an adult, because "we cannot prove it" and "it is proven adult" are
-- different states and only one of them may reach a public surface.

create or replace function private.profile_dob_known(p_user_id uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.date_of_birth is not null
  );
$$;

create or replace function private.profile_not_verified_adult(p_user_id uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
  select coalesce(
    (select p.date_of_birth is null or p.is_minor from public.profiles p where p.id = p_user_id),
    true
  );
$$;

-- private-schema default-revoke convention (0002 lines 33-42, 0017 lines 144-151):
-- lock the entry points, then open them for authenticated + service_role.
revoke execute on function private.profile_dob_known(uuid) from public, anon;
revoke execute on function private.profile_not_verified_adult(uuid) from public, anon;
grant execute on function private.profile_dob_known(uuid) to authenticated, service_role;
grant execute on function private.profile_not_verified_adult(uuid) to authenticated, service_role;

-- ══════════════════════ 2. PUBLIC-SURFACE EXCLUSION — NOW FAIL-CLOSED (scenario 6) ══════════════════════
-- Recreates the 0017 policy (lines 160-163) with ONE change: the using clause
-- excludes private.profile_not_verified_adult(id) instead of
-- private.profile_is_minor(id). Everything else is 0017's shape — same name, same
-- `for select to authenticated`, same `(select auth.uid()) is not null` initPlan
-- guard, same definer-helper resolution (no policy cycle).
--
-- Consequence, stated plainly: an UNKNOWN date of birth is now also excluded from
-- public search. That is the fail-closed intent — we do not expose a profile we
-- cannot verify as an adult, and a NULL birth date is precisely unverifiable. The
-- cost is that a brand-new account is invisible to other users until it declares
-- a birth date, which is the intended trade (WU2 adds the app step that asks).
--
-- Unchanged by design: profiles_select_self (0006 lines 67-70) still returns the
-- row to its owner, so an unknown-dob account can always read and complete its own
-- profile. Instructor scoping to org participation still holds via owner-only RLS
-- on annotations/practice (scenario 5).
drop policy if exists profiles_select_search on public.profiles;
create policy profiles_select_search on public.profiles
  for select to authenticated
  using ((select auth.uid()) is not null and not private.profile_not_verified_adult(id));

-- ══════════════════════ 3. PUBLISH GUARD — MINOR + UNKNOWN-DOB GATE (scenario 4) ══════════════════════
-- Recreates the 0012 core as 0017 shipped it (0017 lines 171-241) — initPlan guard,
-- license confirmation, license vocabulary, ownership, one-live-entry, lineage —
-- with ONE change: the guard block at the end gains a second, distinct branch.
-- Postgres has no partial override, so the whole body is re-declared here; the
-- diff against 0017 is the added branch and nothing else.
--
-- Branch order is a contract, not a style choice: a known minor hits the guardian
-- message first (the consent flow is the correct answer for them), and only a
-- session that is NOT a known minor falls through to the unknown-dob message.
-- A user with no birth date therefore cannot be mistaken for a minor here — the
-- same reason section 5 leaves the consent RPCs alone.
create or replace function private.publish_song_to_library(
  p_song_id uuid,
  p_license text,
  p_license_confirmed boolean,
  p_lineage_public_song_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_owner    uuid := (select auth.uid());
  v_entry_id uuid;
begin
  -- initPlan guard (0002 line 130 shape): no session → no publish
  if v_owner is null then
    raise exception 'Song not found.';
  end if;

  -- license gate: confirmation is non-negotiable (scenario 6)
  if p_license_confirmed is distinct from true then
    raise exception 'License confirmation required before publishing.';
  end if;

  -- filterable license vocabulary (0001 line 442)
  if p_license is null or p_license not in ('public-domain', 'CC-BY-4.0', 'proprietary') then
    raise exception 'Unsupported license.';
  end if;

  -- ownership: publish your OWN song only (created_by = auth.uid())
  if not exists (
    select 1 from public.songs
    where id = p_song_id
      and created_by = v_owner
      and is_deleted = false
  ) then
    raise exception 'Song not found.';
  end if;

  -- one live entry per song (no duplicate publishes)
  if exists (
    select 1 from public.public_songs
    where song_id = p_song_id and status = 'live'
  ) then
    raise exception 'Song already published.';
  end if;

  -- optional lineage must point at a live source entry (scenario 7)
  if p_lineage_public_song_id is not null
     and not exists (
       select 1 from public.public_songs
       where id = p_lineage_public_song_id and status = 'live'
     ) then
    raise exception 'Lineage source not found.';
  end if;

  -- minors: an ACTIVE guardian consent with public-sharing approval is required;
  -- revocation flips this check back off immediately (scenario: revoking restricts).
  if private.session_is_minor() and not exists (
    select 1 from public.guardian_consents gc
    where gc.user_id = v_owner and gc.status = 'active' and gc.public_sharing_approved
  ) then
    raise exception 'Guardian approval required for public sharing';
  end if;

  -- fail-closed (0029): an UNKNOWN date of birth is not proof of adulthood, so
  -- public sharing stays blocked until the account declares one. Deliberately
  -- ordered AFTER the minor branch so a known minor still reads the guardian
  -- message, not this one — the consent path is the right answer for them.
  if not private.profile_dob_known((select auth.uid())) then
    raise exception 'Complete your date of birth before publishing.';
  end if;

  insert into public.public_songs
    (song_id, contributor_id, license, license_confirmed, lineage, status)
  values
    (p_song_id, v_owner, p_license, true, p_lineage_public_song_id, 'live')
  returning id into v_entry_id;

  return v_entry_id;
end $$;

-- Re-issue the 0012/0017 private-core grants (0017 lines 246-247): recreating the
-- function may drop grants, so the lock is re-declared then re-opened for
-- authenticated only (the public wrapper — still the 0012 object, NOT recreated —
-- keeps its own grants).
revoke execute on function private.publish_song_to_library(uuid, text, boolean, uuid) from public, anon;
grant execute on function private.publish_song_to_library(uuid, text, boolean, uuid) to authenticated;

-- ══════════════════════ 4. DELIBERATE NON-CHANGE — THE CONSENT RPCs STAY FAIL-OPEN ══════════════════════
-- NOT recreated in this migration, ON PURPOSE:
--   · private.record_guardian_consent      (0017 lines 259-313, guard at line 284)
--   · private.approve_guardian_public_sharing (0017 lines 318-351, guard at 332)
--   · private.session_is_minor()            (0017 lines 131-134)
--   · private.profile_is_minor()           (0017 lines 126-129)
-- and likewise their public wrappers (0017 lines 304-313, 347-351). All four keep
-- the KNOWN-minor predicate, exactly as shipped.
--
-- Why. Those guards are phrased as "this action is only needed for minors", not
-- "this action needs proof of adulthood":
--     if not private.session_is_minor() then
--       raise exception 'Consent is only required for minors.';
--     end if;
-- Fail-closing THAT predicate would be a functional bug, not extra safety. An
-- account with an unknown date of birth would satisfy it, so the first thing the
-- app would do with such a user is offer guardian consent — asking a stranger to
-- consent for an adult, or worse, letting anyone self-declare a guardian and
-- mint a real guardian_consents row. Unknown is blocked from PUBLIC exposure
-- (sections 2 and 3); it is never treated as a claim of minority. Consent is only
-- ever required of someone we can positively identify as a minor.
--
-- The two directions are therefore disjoint on purpose:
--   public exposure  → fail-closed  (unknown ⇒ excluded, blocked)
--   consent required → known-minor (unknown ⇒ "not a minor", no flow)

-- ══════════════════════ 5. GRANDFATHER — ONE-TIME BACKFILL OF THE EXISTING BASE ══════════════════════
-- Idempotent by construction: the WHERE matches nothing on a second run.
--
-- Existing accounts are demo accounts created before the date-of-birth gate
-- existed, so they are all NULL and — under the fail-closed rule above — would all
-- vanish from public search and be unable to publish. Backfill them to a
-- verifiably-adult date (2002-10-10 ⇒ 23 in 2026) so this compliance change does
-- not lock out the base the rest of the product is developed against.
--
-- Accepted risk, recorded here deliberately: a pre-existing minor account is
-- treated as an adult forever. That is the accepted cost of the grandfather and
-- is the one thing this migration knowingly trades away.
--
-- is_minor is NEVER written here. The profiles_minor_flag trigger (0017 lines
-- 48-66) is its only legal writer, and this UPDATE targets date_of_birth, so the
-- trigger fires and recomputes is_minor to false from the same formula every other
-- path uses. Writing is_minor directly would be a second writer and the whole
-- reason the minor flag can be trusted.
update public.profiles
set date_of_birth = date '2002-10-10'
where date_of_birth is null;
