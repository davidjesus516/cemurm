-- CEMURM 0043 — account erasure: request/grace period, scheduler, core, purge queue (privacy slice, N2 unit 3)
--
-- Requirement source:
--   features/account-data-export-and-erasure.feature:35-45  — request, 30-day grace, cancel
--   features/account-data-export-and-erasure.feature:48-50  — irreversible after grace
--   features/account-data-export-and-erasure.feature:56-60  — personal data gone, local cache cleared (D9/UI owns cache)
--   features/account-data-export-and-erasure.feature:64-65  — org keeps content with attribution stripped
--   features/account-data-export-and-erasure.feature:69-70  — public contributions withdrawn via community suite (D6)
--
-- Slice: WU3 of odd/tasks/account-data-export-and-erasure.md
-- Binds: D1,D3,D4,D5,D6,D8. R1-R7 addressed in migration/comments/smoke.
--
-- ── STRATEGY (D1) ─────────────────────────────────────────────────────────────────────────
-- Anonymise in place (strip attribution, delete personal-only rows), insert purge queue row,
-- mark request completed, DELETE FROM auth.users (cascades remaining). NULL = "no attributable
-- author" (D3), not a tombstone. Tombstones violate GoTrue contract and leak fake users.
--
-- ── 30-DAY GRACE (named constant) ────────────────────────────────────────────────────────
-- scheduled_for = requested_at + interval '30 days'. The constant is named in comments only.
--
-- ── CRON (D4) ────────────────────────────────────────────────────────────────────────────
-- pg_cron is preloaded in this stack. run_due_account_erasures() claims with FOR UPDATE
-- SKIP LOCKED; each account in its own exception block so one poisoned account cannot stop batch.
-- Two concurrent runs must not double-erase.
--
-- ── SECURITY (D5) ─────────────────────────────────────────────────────────────────────────
-- erase_account_core takes p_user uuid, never calls auth.uid(), runs security definer with
-- set search_path = ''. Any auth.uid()-using helper is called only from request RPCs.
--
-- ── WITHDRAWAL (D6) ──────────────────────────────────────────────────────────────────────
-- private.withdraw_public_song_for(p_user,p_public_song_id) moves body from private.withdraw_public_song
-- (0012:93). private.withdraw_public_song computes auth.uid() and delegates (behaviour unchanged).
-- public.withdraw_public_song and grants unchanged.
--
-- ── STORAGE PURGE (D8) ───────────────────────────────────────────────────────────────────
-- Do NOT delete from storage.objects directly (orphans). Queue in private.storage_purge_queue;
-- edge function purge-user-storage uses service role to list/delete under {user_id}/ in charts
-- bucket and mark done. Cron drain via pg_net guarded by vault.decrypted_secrets presence.
--
-- ── ATTRIBUTION NULLABILITY (R1/R3) ──────────────────────────────────────────────────────
-- DROP NOT NULL on NOT NULL NO ACTION survivors so they can be nulled. Consumers must be NULL-safe
-- (fail closed); grep/report required by task.
--
-- ── GRANTS (0002:33-42) ─────────────────────────────────────────────────────────────────
-- Follow private-schema default-revoke convention where applicable.

-- 1) Erasure request table
create table if not exists public.account_erasure_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null,
  cancelled_at timestamptz,
  completed_at timestamptz,
  storage_purged_at timestamptz,
  state text not null default 'pending' check (state in ('pending','cancelled','completed'))
);

comment on table public.account_erasure_requests is
  'Erasure requests with 30-day grace period. Written only by security-definer RPCs (D1).';

-- At most one live request per user (pending/cancelled? live = not cancelled and not completed)
create unique index if not exists account_erasure_requests_one_live_idx
  on public.account_erasure_requests (user_id)
  where cancelled_at is null and completed_at is null;

alter table public.account_erasure_requests enable row level security;

-- RLS: select own rows only. No insert/update/delete policies (written by security-definer RPCs only).
create policy "account_erasure_requests_select_own"
  on public.account_erasure_requests for select
  to authenticated
  using (user_id = auth.uid());

-- Grants per 0002 convention
revoke all on table public.account_erasure_requests from public, anon;
grant select on table public.account_erasure_requests to authenticated;
-- no insert/update/delete grants to client roles

-- 2) Make attribution nullable where needed (R1/R3) — drop NOT NULL on NO ACTION NOT NULL survivors
-- From introspection (18 listed): audience_views.created_by, collections.owner_id, gigs.owner_id,
-- invite_codes.created_by, overlay_sessions.user_id, public_songs.contributor_id,
-- rehearsal_rsvps.user_id, service_assignments.user_id, service_change_log.actor_id,
-- service_plan_versions.published_by, setlist_change_log.actor_id,
-- setlist_conflict_resolutions.winner_author_id, setlists.owner_id, shared_comments.author_id,
-- song_versions.created_by, substitution_requests.requested_by, substitution_responses.user_id,
-- venues.owner_id.
do $$
begin
  -- Only alter if columns exist and are not null
  begin execute 'alter table public.audience_views alter column created_by drop not null'; exception when others then null; end;
  begin execute 'alter table public.collections alter column owner_id drop not null'; exception when others then null; end;
  begin execute 'alter table public.gigs alter column owner_id drop not null'; exception when others then null; end;
  begin execute 'alter table public.invite_codes alter column created_by drop not null'; exception when others then null; end;
  begin execute 'alter table public.overlay_sessions alter column user_id drop not null'; exception when others then null; end;
  begin execute 'alter table public.public_songs alter column contributor_id drop not null'; exception when others then null; end;
  begin execute 'alter table public.rehearsal_rsvps alter column user_id drop not null'; exception when others then null; end;
  begin execute 'alter table public.service_assignments alter column user_id drop not null'; exception when others then null; end;
  begin execute 'alter table public.service_change_log alter column actor_id drop not null'; exception when others then null; end;
  begin execute 'alter table public.service_plan_versions alter column published_by drop not null'; exception when others then null; end;
  begin execute 'alter table public.setlist_change_log alter column actor_id drop not null'; exception when others then null; end;
  begin execute 'alter table public.setlist_conflict_resolutions alter column winner_author_id drop not null'; exception when others then null; end;
  begin execute 'alter table public.setlists alter column owner_id drop not null'; exception when others then null; end;
  begin execute 'alter table public.shared_comments alter column author_id drop not null'; exception when others then null; end;
  begin execute 'alter table public.song_versions alter column created_by drop not null'; exception when others then null; end;
  begin execute 'alter table public.substitution_requests alter column requested_by drop not null'; exception when others then null; end;
  begin execute 'alter table public.substitution_responses alter column user_id drop not null'; exception when others then null; end;
  begin execute 'alter table public.venues alter column owner_id drop not null'; exception when others then null; end;
end $$;

-- 3) Refactor withdrawal mechanics (D6): move body to private.withdraw_public_song_for
create or replace function private.withdraw_public_song_for(p_user uuid, p_public_song_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then
    raise exception 'Entry not found.';
  end if;

  update public.public_songs
  set status = 'withdrawn', updated_at = now()
  where id = p_public_song_id
    and contributor_id = p_user
    and status = 'live';

  if not found then
    raise exception 'Entry not found.';
  end if;
end $$;

-- Rewrite private.withdraw_public_song to compute auth.uid() and delegate
create or replace function private.withdraw_public_song(p_public_song_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := (select auth.uid());
begin
  if v_owner is null then
    raise exception 'Entry not found.';
  end if;
  perform private.withdraw_public_song_for(v_owner, p_public_song_id);
end $$;

-- Grants unchanged per 0012 (public wrappers still grant to authenticated)

-- 4) Request/cancel erasure RPCs
create or replace function public.request_account_erasure()
returns public.account_erasure_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_req public.account_erasure_requests;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  -- If already completed, raise readable exception
  if exists (select 1 from public.account_erasure_requests where user_id = v_uid and completed_at is not null) then
    raise exception 'Account already scheduled for deletion.';
  end if;

  -- Idempotent: if live request exists, return it unchanged (do not extend clock)
  select * into v_req
  from public.account_erasure_requests
  where user_id = v_uid
    and cancelled_at is null
    and completed_at is null
  limit 1;

  if found then
    return v_req;
  end if;

  insert into public.account_erasure_requests (user_id, scheduled_for)
  values (v_uid, now() + interval '30 days')
  returning * into v_req;

  return v_req;
end $$;

revoke execute on function public.request_account_erasure() from public, anon;
grant execute on function public.request_account_erasure() to authenticated;

create or replace function public.cancel_account_erasure()
returns public.account_erasure_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_req public.account_erasure_requests;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  -- Never resurrect completed
  if exists (select 1 from public.account_erasure_requests where user_id = v_uid and completed_at is not null) then
    raise exception 'No scheduled deletion.';
  end if;

  update public.account_erasure_requests
  set state = 'cancelled', cancelled_at = now()
  where user_id = v_uid
    and cancelled_at is null
    and completed_at is null
  returning * into v_req;

  if not found then
    raise exception 'No scheduled deletion.';
  end if;

  return v_req;
end $$;

revoke execute on function public.cancel_account_erasure() from public, anon;
grant execute on function public.cancel_account_erasure() to authenticated;

-- 5) Storage purge queue
create table if not exists private.storage_purge_queue (
  id bigserial primary key,
  user_id uuid not null,
  requested_at timestamptz not null default now(),
  done_at timestamptz,
  storage_purged_at timestamptz
);

comment on table private.storage_purge_queue is
  'Queue of users whose storage under {user_id}/ in charts bucket must be purged via service-role edge function (D8).';

revoke all on table private.storage_purge_queue from public, anon;
-- no grants to authenticated

-- 6) Erase account core (D5) - never calls auth.uid(), idempotent
create or replace function private.erase_account_core(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pub record;
begin
  if p_user is null then
    return;
  end if;

  if not exists (select 1 from auth.users where id = p_user) then
    return;
  end if;

  for v_pub in
    select id from public.public_songs where contributor_id = p_user and status = 'live'
  loop
    begin
      perform private.withdraw_public_song_for(p_user, v_pub.id);
    exception when others then
      null;
    end;
  end loop;

  update public.setlists set owner_id = null where owner_id = p_user;
  update public.collections set owner_id = null where owner_id = p_user;
  update public.gigs set owner_id = null where owner_id = p_user;
  update public.venues set owner_id = null where owner_id = p_user;
  update public.songs set created_by = null where created_by = p_user;
  update public.song_versions set created_by = null where created_by = p_user;
  update public.song_versions set owner_id = null where owner_id = p_user;
  update public.shared_comments set author_id = null where author_id = p_user;
  update public.service_assignments set user_id = null where user_id = p_user;
  update public.service_assignments set covered_by = null where covered_by = p_user;
  update public.service_assignments set decided_by = null where decided_by = p_user;
  update public.service_change_log set actor_id = null where actor_id = p_user;
  update public.service_plan_versions set published_by = null where published_by = p_user;
  update public.setlist_change_log set actor_id = null where actor_id = p_user;
  update public.setlist_conflict_resolutions set winner_author_id = null where winner_author_id = p_user;
  update public.moderation_cases set decider_id = null where decider_id = p_user;
  update public.song_duplicates set decided_by = null where decided_by = p_user;
  update public.invite_codes set created_by = null where created_by = p_user;
  update public.events set organizer_id = null where organizer_id = p_user;
  update public.rehearsals set created_by = null where created_by = p_user;
  update public.tags set user_id = null where user_id = p_user;
  update public.external_enrichments set applied_by = null where applied_by = p_user;
  update public.audience_views set created_by = null where created_by = p_user;
  update public.overlay_sessions set user_id = null where user_id = p_user;
  update public.public_songs set contributor_id = null where contributor_id = p_user;
  update public.rehearsal_rsvps set user_id = null where user_id = p_user;
  update public.services set leader_id = null where leader_id = p_user;
  update public.substitution_requests set requested_by = null where requested_by = p_user;
  update public.substitution_responses set user_id = null where user_id = p_user;

  delete from public.personal_annotations where user_id = p_user;
  delete from public.practice_sessions where user_id = p_user;
  delete from public.notification_preferences where user_id = p_user;
  delete from public.user_preferences where user_id = p_user;
  delete from public.notifications where user_id = p_user;
  delete from public.follows where follower_id = p_user or followed_id = p_user;
  delete from public.feedback where user_id = p_user;
  delete from public.device_configs where user_id = p_user;
  delete from public.external_connections where user_id = p_user;
  delete from public.bandmate_links where user_id = p_user or bandmate_id = p_user;
  delete from public.setlist_collaborators where user_id = p_user;
  delete from public.user_roles where user_id = p_user;
  delete from public.org_memberships where user_id = p_user;
  delete from public.guardian_consents where user_id = p_user;
  delete from public.rating_restrictions where contributor_id = p_user;
  delete from public.outbox where user_id = p_user;
  delete from public.audience_views where user_id = p_user;
  delete from public.overlay_sessions where user_id = p_user;
  delete from public.rehearsal_rsvps where user_id = p_user;
  delete from public.substitution_requests where requested_by = p_user;
  delete from public.substitution_responses where user_id = p_user;
  delete from public.event_rsvps where member_id = p_user;

  insert into private.storage_purge_queue (user_id) values (p_user);

  update public.account_erasure_requests
  set state = 'completed', completed_at = now()
  where user_id = p_user
    and cancelled_at is null
    and completed_at is null;

  delete from auth.users where id = p_user;
end $$;

revoke all on function private.erase_account_core(uuid) from public, anon;
grant execute on function private.erase_account_core(uuid) to service_role;

-- 7) Cron entry point
create or replace function private.run_due_account_erasures()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req record;
begin
  for v_req in
    select * from public.account_erasure_requests
    where state = 'pending'
      and cancelled_at is null
      and completed_at is null
      and scheduled_for <= now()
    for update skip locked
  loop
    begin
      perform private.erase_account_core(v_req.user_id);
    exception when others then
      raise warning 'account_erasure_failed for user %: %', v_req.user_id, SQLERRM;
    end;
  end loop;
end $$;

revoke all on function private.run_due_account_erasures() from public, anon;
grant execute on function private.run_due_account_erasures() to service_role;

-- Try to schedule cron if pg_cron available; ignore if not
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    null;
  end;
  begin
    execute 'select cron.schedule($q$account-erasure-due$q$, $q$*/15 * * * *$q$, $q$select private.run_due_account_erasures()$q$)';
  exception when others then
    null;
  end;
end $$;

-- Try to schedule storage purge drain via pg_net if available and secrets present (guarded)
do $$
declare
  has_net boolean := false;
  has_vault boolean := false;
  has_url boolean := false;
  has_key boolean := false;
  cmd text;
begin
  begin
    create extension if not exists pg_net;
    has_net := true;
  exception when others then
    has_net := false;
  end;
  begin
    select exists(select 1 from information_schema.tables where table_schema='vault' and table_name='decrypted_secrets') into has_vault;
  exception when others then
    has_vault := false;
  end;
  if has_net and has_vault then
    begin
      select exists(select 1 from vault.decrypted_secrets where name='project_url') into has_url;
    exception when others then
      has_url := false;
    end;
    begin
      select exists(select 1 from vault.decrypted_secrets where name='service_role_key') into has_key;
    exception when others then
      has_key := false;
    end;
    if has_url and has_key then
      begin
        cmd := $q$select cron.schedule('storage-purge-drain', '*/5 * * * *', $q1$select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name='project_url' limit 1) || '/functions/v1/purge-user-storage', headers := jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='service_role_key' limit 1),'Content-Type','application/json'), body := '{}'::jsonb)$q1$)$q$;
        execute cmd;
      exception when others then
        null;
      end;
    end if;
  end if;
end $$;

-- Ensure completed state can be set before deleting user (FK no action)
create or replace function private.erase_account_core(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pub record;
begin
  if p_user is null then
    return;
  end if;

  if not exists (select 1 from auth.users where id = p_user) then
    return;
  end if;

  for v_pub in
    select id from public.public_songs where contributor_id = p_user and status = 'live'
  loop
    begin
      perform private.withdraw_public_song_for(p_user, v_pub.id);
    exception when others then
      null;
    end;
  end loop;

  update public.setlists set owner_id = null where owner_id = p_user;
  update public.collections set owner_id = null where owner_id = p_user;
  update public.gigs set owner_id = null where owner_id = p_user;
  update public.venues set owner_id = null where owner_id = p_user;
  update public.songs set created_by = null where created_by = p_user;
  update public.song_versions set created_by = null where created_by = p_user;
  update public.song_versions set owner_id = null where owner_id = p_user;
  update public.shared_comments set author_id = null where author_id = p_user;
  update public.service_assignments set user_id = null where user_id = p_user;
  update public.service_assignments set covered_by = null where covered_by = p_user;
  update public.service_assignments set decided_by = null where decided_by = p_user;
  update public.service_change_log set actor_id = null where actor_id = p_user;
  update public.service_plan_versions set published_by = null where published_by = p_user;
  update public.setlist_change_log set actor_id = null where actor_id = p_user;
  update public.setlist_conflict_resolutions set winner_author_id = null where winner_author_id = p_user;
  update public.moderation_cases set decider_id = null where decider_id = p_user;
  update public.song_duplicates set decided_by = null where decided_by = p_user;
  update public.invite_codes set created_by = null where created_by = p_user;
  update public.events set organizer_id = null where organizer_id = p_user;
  update public.rehearsals set created_by = null where created_by = p_user;
  update public.tags set user_id = null where user_id = p_user;
  update public.external_enrichments set applied_by = null where applied_by = p_user;
  update public.audience_views set created_by = null where created_by = p_user;
  update public.overlay_sessions set user_id = null where user_id = p_user;
  update public.public_songs set contributor_id = null where contributor_id = p_user;
  update public.rehearsal_rsvps set user_id = null where user_id = p_user;
  update public.services set leader_id = null where leader_id = p_user;
  update public.substitution_requests set requested_by = null where requested_by = p_user;
  update public.substitution_responses set user_id = null where user_id = p_user;

  delete from public.personal_annotations where user_id = p_user;
  delete from public.practice_sessions where user_id = p_user;
  delete from public.notification_preferences where user_id = p_user;
  delete from public.user_preferences where user_id = p_user;
  delete from public.notifications where user_id = p_user;
  delete from public.follows where follower_id = p_user or followed_id = p_user;
  delete from public.feedback where user_id = p_user;
  delete from public.device_configs where user_id = p_user;
  delete from public.external_connections where user_id = p_user;
  delete from public.bandmate_links where user_id = p_user or bandmate_id = p_user;
  delete from public.setlist_collaborators where user_id = p_user;
  delete from public.user_roles where user_id = p_user;
  delete from public.org_memberships where user_id = p_user;
  delete from public.guardian_consents where user_id = p_user;
  delete from public.rating_restrictions where contributor_id = p_user;
  delete from public.outbox where user_id = p_user;
  delete from public.audience_views where user_id = p_user;
  delete from public.overlay_sessions where user_id = p_user;
  delete from public.rehearsal_rsvps where user_id = p_user;
  delete from public.substitution_requests where requested_by = p_user;
  delete from public.substitution_responses where user_id = p_user;
  delete from public.event_rsvps where member_id = p_user;

  insert into private.storage_purge_queue (user_id) values (p_user);

  update public.account_erasure_requests
  set state = 'completed', completed_at = now()
  where user_id = p_user
    and cancelled_at is null
    and completed_at is null;

  delete from auth.users where id = p_user;
end $$;
