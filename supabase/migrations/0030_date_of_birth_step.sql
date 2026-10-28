-- CEMURM 0030 — Date-of-birth step: one validated write path for the age fact
--
-- Slice: fix/fail-closed-minors — the server half of the date-of-birth step.
-- Supersedes the age gate that 0017 described but never enforced; see
-- odd/tasks/minors-fail-closed-db.md for the record.
--
-- ⚠ 0017's OWN COMMENTS ARE NOW WRONG, and it is worth saying so in the file
-- that supersedes them rather than only in a later commit. 0017 lines 8, 38
-- and 70 all say the app "learns minor status via user_metadata". That was
-- true of the code 0017 shipped and it is false now: the age facts come from
-- public.my_age_status() below, because user_metadata is writable by the
-- account holder through GoTrue updateUser(). A reader who opens 0017 first
-- meets the retired claim with nothing contradicting it, and 0017 is still
-- the file that defines guardian_consents.
--
-- Business contract (features/minors-and-guardian-consent.feature):
--  · signup age gate (scenario 1): 0017 kept the age DECLARATION in GoTrue
--    user_metadata and left profiles.date_of_birth with no writer at all
--    (0029 header). This migration gives the column its single, validated
--    writer: public.set_date_of_birth. Declaring a date is what releases the
--    app — the client asks for it in the date-of-birth step
--    (src/features/auth/pages/DateOfBirthRequired.jsx, rendered by
--    src/app/providers/AuthGuards.jsx) and a declared MINOR date hands the
--    same user straight to the existing guardian screen (scenario 2, unchanged
--    behaviour).
--  · account activation (scenario 2): unknown is still unknown — nothing here
--    unlocks an account on its own. The dob gate and the guardian gate stay
--    independent: a dob only replaces the FIRST question ("are you an adult or
--    a minor?"), never the second.
--  · public-sharing gate (scenario 4) and public-surface exclusion
--    (scenario 6) are NOT recreated here — 0029 already made unknown a blocked
--    state there and nothing in this migration changes what they do.
--  · consent record (scenario 3) and lifecycle (scenarios 5/7/8/9): untouched.
--    The trigger's minor→adult archive (0017 lines 53-57) still has exactly one
--    trigger to it, and the no-escalation rule in section 2 is what keeps a
--    client from ever reaching that archive by re-declaring their age.
--
-- ⚠ THE DEFECT THIS MIGRATION CLOSES. 0017 line 71 granted
-- `update (date_of_birth) on table public.profiles to authenticated` — a RAW,
-- UNVALIDATED column write. It was a live bypass, not a leftover: any account
-- holder could `update profiles set date_of_birth = <adult date> where id =
-- auth.uid()`, the profiles_minor_flag trigger would honestly recompute
-- is_minor to false, and the account would be an adult with no guardian, no
-- search exclusion and no publish gate. Worse, a minor who had an ACTIVE
-- consent would ALSO trip 0017 lines 53-57 and have that consent ARCHIVED —
-- i.e. the escalation would not just unlock the account, it would destroy the
-- record that the account was ever supervised. WU1 (0029) made an unknown dob
-- a blocked state on the READ side; this migration closes the WRITE side so the
-- blocked state cannot be skipped by simply writing the column.
--
-- Conventions (0002/0012/0017/0029 style): comment headers with a scenario map;
-- SECURITY DEFINER cores in `private` with `set search_path = ''` +
-- fully-qualified refs; thin public wrappers (0012 lines 116-125, 0017 lines
-- 304-313); REVOKE from public/anon THEN GRANT to authenticated; grants AFTER
-- policies (D6 order).
-- MIGRATIONS ARE IMMUTABLE: 0017 and 0029 are left exactly as shipped. The
-- 0017 column grant is REMOVED here by revoking the privilege, never by
-- editing the historical migration.


-- ══════════════════════ 1. CLOSE THE DIRECT WRITE PATH ══════════════════════
-- Undoes the 0017 line 71 column grant. After this statement an authenticated
-- client has NO privilege on profiles.date_of_birth at all: PostgREST PATCH
-- cannot reach the column, and the only way to declare or correct a birth date
-- is public.set_date_of_birth (section 2), which validates the value and
-- refuses escalation.
--
-- The 0006 column-level grants on profiles (display_name, username,
-- avatar_url, instrument) are deliberately NOT touched — the app still writes
-- those columns directly. Only the age fact is owned by the RPC.
revoke update (date_of_birth) on table public.profiles from authenticated;


-- ══════════════════════ 2. set_date_of_birth — THE ONLY WRITER (besides the trigger) ══════════════════════
-- Two functions, 0012/0017 shape: a plpgsql core in `private` holding every
-- rule, and a one-line `public` wrapper that is the only client entry point.
-- The wrapper is SECURITY DEFINER with `search_path = ''` like every other
-- wrapper in the repo, so the client never needs execute on the private core.
create or replace function private.set_date_of_birth_core(p_date_of_birth date)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor         uuid := (select auth.uid());
  v_is_minor      boolean;
  v_would_be_adult boolean;
begin
  -- 1. initPlan guard (0002 line 130 shape): no session, no declaration.
  if v_actor is null then
    raise exception 'Sign in to set your date of birth.';
  end if;

  -- 2. unknown is not a declaration. Under D2 (fail-closed) a NULL date is the
  --    blocked state, so "set it to null" must not be reachable: the client has
  --    to supply a real date, which is the only way out of the step.
  if p_date_of_birth is null then
    raise exception 'Enter your date of birth.';
  end if;

  -- 3. a birth date cannot be in the future (not "born yesterday").
  if p_date_of_birth > current_date then
    raise exception 'Date of birth cannot be in the future.';
  end if;

  -- 4. lower bound. Rejects absurd input AND bounds the trigger's arithmetic
  --    (0017 line 51 compares against current_date - interval '18 years').
  if p_date_of_birth < date '1900-01-01' then
    raise exception 'Date of birth must be after 1900.';
  end if;

  -- Load the caller's own row. Two facts come from it: whether the account is
  -- currently a minor (rule 5) and whether a profile exists at all (rule 7).
  select p.is_minor into v_is_minor
    from public.profiles p
   where p.id = v_actor;

  if not found then
    raise exception 'Profile not found.';
  end if;

  -- 5. ⚠ NO-ESCALATION — THE CRITICAL RULE. This is the reason this function
  --    cannot be a blind upsert. A MINOR may correct their date to any OTHER
  --    MINOR date, and an ADULT may correct a typo to any ADULT date, but a
  --    minor can never re-declare themselves as an adult. Without this rule the
  --    RPC would be exactly the bypass section 1 removed: the trigger would
  --    recompute is_minor to false (it derives it from the date we just wrote)
  --    and 0017 lines 53-57 would ARCHIVE the minor's active guardian consent
  --    on the way out. An account holder could self-approve by "correcting"
  --    their birthday once, and the audit trail of their supervision would be
  --    deleted by the same act. The direction adult → minor is NOT blocked:
  --    someone who declared 18+ by mistake and then told the truth should be
  --    allowed to say so — that direction only ever adds restrictions.
  v_would_be_adult := p_date_of_birth <= (current_date - interval '18 years');
  if v_is_minor and v_would_be_adult then
    raise exception 'A minor account cannot declare an adult date of birth.';
  end if;

  -- 6. Write ONLY the date. is_minor is deliberately absent from the column
  --    list: the profiles_minor_flag trigger (0017 lines 48-66) is its only
  --    legal writer and this UPDATE OF date_of_birth fires it, so the flag is
  --    recomputed from the same formula every other path uses. Writing the flag
  --    here would be a second writer and would defeat the reason it can be
  --    trusted.
  update public.profiles
     set date_of_birth = p_date_of_birth
   where id = v_actor;

  -- 7. never silently succeed on a row that does not exist.
  if not found then
    raise exception 'Profile not found.';
  end if;
end $$;

-- ── 2.1 public wrapper — the client entry point (0012 lines 116-125 pattern) ──
create or replace function public.set_date_of_birth(p_date_of_birth date)
returns void
language sql security definer set search_path = '' as $$
  select private.set_date_of_birth_core(p_date_of_birth);
$$;

-- private-schema default-revoke convention (0002 lines 33-42, 0017 lines
-- 144-151, 0029 lines 79-84): lock the entry points, then open them. The
-- client needs the public wrapper only; the core stays unexecutable from
-- outside so the rules cannot be bypassed by calling it directly. authed only
-- (repo convention) — anon has no business declaring an age.
revoke execute on function private.set_date_of_birth_core(date) from public, anon;
revoke execute on function public.set_date_of_birth(date) from public, anon;
grant execute on function private.set_date_of_birth_core(date) to authenticated;
grant execute on function public.set_date_of_birth(date) to authenticated;


-- ══════════════════════ 3. my_age_status — TWO BOOLEANS, NEVER THE DATE ══════════════════════
-- The client cannot SELECT date_of_birth or is_minor (0017 shipped no select
-- grant for either, and this migration does not add one). It still has to
-- decide which of the two gate screens to render, so it gets the smallest
-- answer that answers that question: "have I declared a date?" and "am I a
-- known minor?".
--
-- Privacy posture, stated explicitly: the client learns TWO BOOLEANS and never
-- the birth date itself. That is precisely why this is an RPC and not
-- `grant select (date_of_birth) on public.profiles to authenticated` — a column
-- grant would put the value in every PostgREST response, the browser's network
-- tab, and any XSS surface, whereas the value here exists only inside the
-- statement. 0017's intent ("birth dates stay server-side", lines 37-38, 68-70)
-- is preserved by this function, not weakened: the app asks "may I proceed?"
-- and the database decides.
--
-- SECURITY DEFINER is what makes it possible to answer at all, and it is
-- tightly bounded by construction: no parameter to abuse, the read is
-- hard-scoped to auth.uid(), and the return type is two booleans, so there is
-- nothing to exfiltrate through it.
create or replace function public.my_age_status()
returns table (dob_known boolean, is_minor boolean)
language plpgsql security definer stable set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  -- no session, no status (a logged-out caller gets nothing to infer from)
  if v_actor is null then
    raise exception 'Sign in to check your age status.';
  end if;

  -- Always exactly one row. A missing profile row is NOT an adult: both
  -- booleans are false, which is the same fail-closed answer 0029's
  -- private.profile_not_verified_adult gives for a missing row, and the client
  -- renders the date-of-birth step for it.
  return query
    select
      exists (
        select 1 from public.profiles p
         where p.id = v_actor and p.date_of_birth is not null
      ),
      coalesce((select p.is_minor from public.profiles p where p.id = v_actor), false);
end $$;

-- same lock-then-open order as section 2.1 (D6: revokes before grants).
revoke execute on function public.my_age_status() from public, anon;
grant execute on function public.my_age_status() to authenticated;
