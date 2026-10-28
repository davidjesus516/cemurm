# CEMURM Security Reference

One document for the rules that were previously scattered across `AGENTS.md` prose, migration
comments, and `docs/local-dev.md`: how a user authenticates, what the database actually enforces,
where the secrets live, and what the file-upload limits really are. Every claim below cites the
file it comes from, so nothing has to be taken on trust.

**Authority order when sources disagree:**

1. `supabase/migrations/` — what the database actually enforces.
2. Code under `src/` — what the browser actually does.
3. Prose (`AGENTS.md`, `docs/*.md`) — summaries. Known-stale entries are listed in
   [§7 Known contradictions](#7-known-contradictions-and-stale-sources); do not cite them as rules.

## Quick path

| Question | Answer | Section |
|---|---|---|
| Who authenticates the user, and how? | Local GoTrue via `supabase-js` | [§1](#1-authentication) |
| What stops one user reading another's rows? | RLS — the client-side gate | [§2](#2-authorization--rls-is-the-client-side-gate) |
| Who can read a PDF chart? | Only its owner, through 1-hour signed URLs | [§3](#3-storage--charts-bucket) |
| Which env vars are secret? | None of them — `VITE_*` ships to the browser | [§4](#4-secrets-and-environment) |
| Can a provider call crash the app? | No — providers never throw | [§5](#5-provider-error-contract) |

---

## 1. Authentication

| Aspect | Implementation |
|---|---|
| Provider | GoTrue (Supabase Auth) inside the **local** stack — `docs/local-dev.md:3` |
| Endpoint | `http://127.0.0.1:54321` (`docs/local-dev.md`, Environment variables) |
| Client | `src/data/supabase.js` — `createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })` |
| Missing config | `src/data/supabase.js:7-9` **throws** without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — there is no silent degraded mode |
| Sign-in / sign-up / session | `src/data/repositories/auth.js` — `signIn` → `supabase.auth.signInWithPassword` (line 141), plus `signUp`, `signOut`, `getSession`, `getCurrentUser` |
| UI | `src/features/auth/pages/Auth.jsx` |
| Route guards | `src/app/providers/AuthGuards.jsx` (`RequireAuth`) wired in `src/app/router.jsx` |

**Deliberate unauthenticated routes.** `/guardian/confirm` and `/guardian/revoke` sit outside
`RequireAuth` because a parent never has (and never will have) a CEMURM account — the router
comments this at `src/app/router.jsx:124`, and `docs/local-dev.md:111` explains that the Edge
Function `supabase/functions/send-guardian-consent` is only a courier: all access-control rules
still live in the database, and the handler derives the account from the JWT `sub`, never from the
request body (`docs/local-dev.md`, verify_jwt paragraph).

### Seed identities

`supabase/seed.sql` (idempotent, `on conflict do nothing`) creates three confirmed users, **all
with password `password1234`** — this is a local dev fixture, never a production pattern:

| UUID suffix | Email | Fixture role |
|---|---|---|
| `10000000-…-0001` | `demo@cemurm.app` | org owner; owns the demo setlist and songs |
| `10000000-…-0002` | `isolation@cemurm.app` | outsider; **accepted** view-only collaborator |
| `10000000-…-0003` | `outsider@cemurm.app` | outsider; **pending** collaborator (`accepted_at IS NULL`) |

Documented in the `AGENTS.md` seed table. `docs/local-dev.md:29` still says "two confirmed users" —
stale; there are three. Seed gotchas live in `AGENTS.md` (GoTrue v2 needs `''`, never `NULL`, in the
token/phone columns; `profiles` rows come from the `0006` trigger, so the seed only `UPDATE`s them).

---

## 2. Authorization — RLS is the client-side gate

**There is no API server.** The browser talks to PostgREST, Storage and RPCs directly with the anon
key plus the user's JWT, so Row Level Security *is* the application's authorization layer — not a
backup for one. `AGENTS.md` states it as "RLS is the client-side gate".

### Deny-by-default baseline

`supabase/migrations/0002_rls_core.sql` enables RLS on **all** public tables with **no policies and
no grants yet**, and performs an explicit per-table `revoke` from `anon`/`authenticated` *before*
any policy or grant lands (design decisions D5/D6 in that file's header; 59 `revoke` statements).
A table with no policy returns zero rows — access is opt-in, per operation, per role.

The `SECURITY DEFINER` helpers are hardened the same way: `private.is_org_member`,
`private.user_branch_ids`, `private.session_role_in` (`0002:14-39`) and
`private.session_owns_setlist` (`0002:142-149`) use an empty `search_path`, have `execute` revoked
from `public`/`anon`, and each **binds the caller-supplied `user_id` to `auth.uid()`** (tenancy
guard R3-001), so passing a victim's UUID returns nothing.

### What the policies cover

| Area | Migration | Shape |
|---|---|---|
| Owner-scoped core (48 tables, 34 policies) | `0002_rls_core.sql` | `owner_id`/`created_by = auth.uid()` |
| Chart content | `0003_chart_content_rls.sql` | `chart_files` scoped through the parent song's ownership (`exists (select 1 from public.songs …)`); `song_versions` via `owner_id = auth.uid()` |
| Gigs, venues, performances, preferences | `0004_gig_and_preferences_rls.sql` | owner-scoped CRUD |
| Collaboration | `0006_band_collaboration.sql` | `setlist_collaborators_update_self` lets the **invitee** accept their own row (line 192); `shared_comments` uses a 3-hop `exists` scope — song → setlist → owner **or accepted collaborator** (line 212); `bandmate_links`/`invite_codes` pair-scoped |
| Comment authorship | `0007_comment_author_writes.sql` | only the author updates their comment |
| Org/branch-scoped reads | `0016_org_repertoire_model.sql` | `branches_select_member`, `songs_select_org` / `songs_select_branch`, `org_memberships_select_org_admin` via the `private.*` helpers |
| Services, rehearsals | `0018_service_planning.sql`, `0019_rehearsal_workflow.sql` | org-member/leader-scoped; `status <> 'completed'` keeps completed plans read-only |
| Overlay sessions | `0025_overlay_sessions.sql`, `0032_overlay_access_token.sql` | owner lifecycle only; the public read path is an RPC, not a table grant |
| Storage objects | `0027_pdf_chart_storage.sql` | see [§3](#3-storage--charts-bucket) |

### ⚠ The design-target trap (read this before trusting a doc)

**`docs/database-schema-v2.md` §3.1 — the org/branch visibility matrix — is a DESIGN TARGET, not a
description of live policies. Do not read it as "what the database enforces."** Its own status
note (line 798) says only the owner-scoped subset was live when written and that the matrix below
is "the design target for later hitos, not yet implemented", while the document header (line 3)
says `Status: **IMPLEMENTED**` for schema v2 as a whole. Both statements are in the same file.

Two corrections, both verified against migrations:

- **The matrix as a whole is not live.** Rows describing cross-org event visibility, setlist
  visibility states, and read-only-after-completion history are targets. Migrations `0016`, `0018`
  and `0019` have since landed *some* org/branch-scoped policies (see the table above), so the
  matrix is partially, unevenly realised — never assume a row exists; grep
  `supabase/migrations/` for the policy.
- **"Implemented RLS is owner-scoped only" (`AGENTS.md`) is now stale as a blanket claim.**
  Owner-scoped is the *baseline* and still covers most tables, but org/branch/member-scoped
  policies are live for `branches`, `org_memberships`, `songs`, `events*`, `services*` and
  `rehearsals*`.

### Deliberate `anon` exceptions

`anon` is locked out of every table. These RPCs are the only `to anon` grants, and each is
token-gated rather than trust-gated:

- `public.confirm_guardian_consent_by_token`, `public.revoke_guardian_consent`
  (`0017_minors_guardian_consent.sql:439`, `0020_review_batch1.sql:392`) — a parent holds a
  capability token, not an account.
- `public.overlay_state(uuid)` (`0025_overlay_sessions.sql:123`, re-keyed by
  `0032_overlay_access_token.sql:119`) — an OBS Browser Source carries no JWT, so the dedicated
  `access_token` column is the bearer. **The row's primary key is not the capability** (the
  `0032` header explains why: the id is a URL path segment mirrored into localStorage). Rotate the
  token to revoke a leaked overlay URL without stopping the stream.

---

## 3. Storage — `charts` bucket

Rules, all from `supabase/migrations/0027_pdf_chart_storage.sql` unless noted:

1. **The bucket is private.** `insert into storage.buckets (id, name, public) values ('charts',
   'charts', false)` (line 33). The migration header is explicit: "`public` may NEVER be flipped;
   direct object reads go through `createSignedUrl`."
2. **Owner-folder RLS.** Object keys are `${auth.uid()}/${uuid}.pdf`, so the **first path segment
   IS the RLS boundary**: every one of the four policies checks
   `(storage.foldername(name))[1] = (select auth.uid())::text` (lines 41-79). Inserts additionally
   require a non-null `auth.uid()` and the `uid/%` prefix — nothing anonymous ever lands there.
3. **Reads are 1-hour signed URLs only.** `signedPdfUrl(path, expiresInSeconds = 3600)` in
   `src/data/repositories/pdfCharts.js:89` calls `createSignedUrl`. There is no public URL, no
   permanent link, and no bucket-level read.
4. **The 10 MB PDF cap is APP-SIDE ONLY.** `PDF_MAX_BYTES = 10 * 1024 * 1024` and
   `validatePdfFile()` live in `src/data/repositories/pdfCharts.js:23,42` and run *before* upload
   (`src/data/repositories/songs.js:440,564` writes the `chart_files` row only after validation).
   The database does **not** enforce it: `chart_files.size_bytes` is `integer NOT NULL` with no
   `CHECK` (`0001_init.sql:95`), so the DB deliberately accepts oversized rows. The only
   server-side ceiling is the stack-wide storage limit `file_size_limit = "50MiB"`
   (`supabase/config.toml:117`). Server-side trigger validation is **deliberately deferred** and
   documented as a limitation in the `0027` header (lines 24-29).

**Consequence to remember:** any code path that reaches Storage without calling `validatePdfFile`
can push a file up to 50 MiB. The 10 MB contract is enforced by convention at the call sites, not
by the schema.

---

## 4. Secrets and environment

`.env.local` at the repo root is gitignored (`.gitignore`: `.env`, `.env.local`, `.env.*.local`).

| Variable | Required | Public? | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | yes | **public** | Local API `http://127.0.0.1:54321` |
| `VITE_SUPABASE_ANON_KEY` | yes | **public by design** | Safe only because RLS (§2) gates every row |
| `VITE_SPOTIFY_CLIENT_ID` | no | **public** | Absent → deterministic mock |
| `VITE_SPOTIFY_CLIENT_SECRET` | no | **public** | See warning below |
| `VITE_MUSICBRAINZ_LIVE` | no | public (boolean) | Absent → mock |
| `VITE_LRCLIB_LIVE` | no | public (boolean) | Absent → mock |

**The `VITE_` prefix is the classification rule: every `VITE_*` variable is inlined into the
browser bundle and is therefore public.** There is no private frontend environment variable.

- `VITE_SPOTIFY_CLIENT_SECRET` is a Spotify *client credentials* secret read at
  `src/integrations/spotify.js:177`. It is **not** protected by being in `.env.local` — anyone
  with the built bundle can read it. Treat it as public, scope it to the Spotify app's own limits,
  and rotate it if abused. Hiding it would require a server-side proxy; the app is client-only
  today (`docs/local-dev.md` notes the same limitation for OAuth callbacks).
- The **one real server secret** is the Resend API key, stored in `vault.decrypted_secrets` and read
  only by `private.read_resend_api_key()`, which is `grant`ed to `service_role` and revoked from
  `public`/`anon`/`authenticated` (`0031_guardian_consent_email.sql:355-358`). It is deliberately
  **not** a `VITE_` variable (`docs/local-dev.md`: "not in a `VITE_` variable (that ships to every
  browser)"). With no key the local stack still works: the Edge Function answers
  `503 {"error":"email_not_configured"}` and sends nothing — there is no mock send.

**Default = mock, no silent fallback.** Optional provider flags are opt-in booleans, and a failure
in live mode never falls back to mock data — see §5.

---

## 5. Provider error contract

Import/enrichment provider clients (`src/integrations/*.js`) follow one shape, stated in the
`spotify.js` header (lines 17-19) and enforced identically in `musicbrainz.js:128` and
`lrclib.js:93`:

- **They never throw.** Every call resolves to a value:
  `{ ok: true, match: … }` / `{ ok: true, match: null }` (no confident match — nothing written) or
  `{ ok: false, error: 'offline' | 'unavailable' }`.
- **`offline` is the `isOnline()` gate** (`spotify.js:165-169`), checked *first*, before mock or
  live mode. `unavailable` is any real-API failure a `catch` converted into a value
  (`ProviderError` typedef, `spotify.js:24-29`).
- **Callers branch on `ok` + `error`**, never on exceptions — the union is a literal-discriminated
  type precisely so `if (result.ok)` narrows (`spotify.js:63-69`).

**Default = mock, no silent fallback:**

- Spotify: real client-credentials flow only when `isSpotifyConfigured()`; otherwise the mock
  (`spotify.js:189-199`). `searchMockProvider` never touches the network.
- MusicBrainz / LRCLIB: live only behind `VITE_MUSICBRAINZ_LIVE` / `VITE_LRCLIB_LIVE`
  (`musicbrainz.js:116`, `lrclib.js`). In live mode an offline or HTTP/CORS failure returns
  `{ ok: false, error: … }` — it does **not** quietly return mock results. `docs/local-dev.md`:
  "NO silent mock fallback (mock ↦ live would silently change results in production)."

Why it matters for security-adjacent correctness: a silent fallback would let a production incident
disguise itself as successful data, which is exactly the class of bug that never gets reported.

---

## 6. Security checklist

Tailored to this repo — run it before claiming a change is safe.

**Schema / RLS**

- [ ] Any new table has `alter table … enable row level security` **and** an explicit deny-by-default
      posture (revoke before grant), following `0002_rls_core.sql` D5/D6.
- [ ] Every new policy is `to authenticated` unless an anon exception is justified in the
      migration header (guardian tokens and `overlay_state` are the only precedents).
- [ ] New `SECURITY DEFINER` helpers bind the supplied `user_id` to `auth.uid()`, use
      `search_path = ''`, and revoke `execute` from `public`/`anon`.
- [ ] A new migration number is checked against every open branch, not just `main`.
- [ ] You are not citing `docs/database-schema-v2.md` §3.1 as evidence of what is live ([§2](#2-authorization--rls-is-the-client-side-gate)).

**Storage / uploads**

- [ ] The `charts` bucket is still `public = false`; no policy grants bucket-wide read.
- [ ] New object keys keep `${auth.uid()}/…` as the first path segment — the RLS boundary depends on it.
- [ ] Uploads call `validatePdfFile` before any row write; the 10 MB cap is not enforced by the DB.
- [ ] Reads go through `signedPdfUrl` (3600 s), never a permanent URL.

**Secrets / env**

- [ ] No new `VITE_*` variable holds anything you would not publish with the bundle.
- [ ] `.env.local` stays gitignored; nothing from it is committed, printed in a doc, or pasted into
      an ODD record.
- [ ] Server secrets (Resend) live in `vault.decrypted_secrets` with `service_role`-only `execute`.
- [ ] Provider flags still default to mock, and a live-mode failure still returns
      `{ ok: false, error }` instead of falling back.

**Auth / routes**

- [ ] New routes that render user data are inside `RequireAuth`; any route outside it has a comment
      naming its capability-token justification (guardian, overlay).
- [ ] Edge Functions derive identity from the JWT `sub`, never from the request body, and keep
      `verify_jwt` enabled.
- [ ] Seed credentials (`password1234`) are unchanged and still confined to `supabase/seed.sql`.

---

## 7. Known contradictions and stale sources

Recorded so a reader does not propagate them. Fixing them is out of scope for this document.

| Source | Claim | Reality |
|---|---|---|
| `AGENTS.md` (Env paragraph) | client is `src/lib/supabase.js` | It is `src/data/supabase.js`; `src/lib/` holds only `storage.js` |
| `docs/local-dev.md:29` | "two confirmed users" | `supabase/seed.sql` creates three |
| `docs/local-dev.md` | `src/lib/spotify.js`, `musicbrainz.js`, `lrclib.js`, `planningcenter.js`, `importers/urlImport.js` | These live under `src/integrations/` |
| `docs/local-dev.md:3` | "owner-scoped RLS" as the whole story | Org/branch-scoped policies exist (`0016`, `0018`, `0019`) |
| `AGENTS.md` | "implemented RLS is owner-scoped only" | Baseline yes; blanket claim is stale for the tables listed in §2 |
| `docs/database-schema-v2.md:3` | `Status: IMPLEMENTED` | True for the DDL; §3.1's matrix is explicitly a target (line 798) |
| `0027_pdf_chart_storage.sql:24` | app guard is `src/lib/pdfCharts.js` | It is `src/data/repositories/pdfCharts.js` |
| `README.md:14` | hosted project `kspnacfcietqikbufcka.supabase.co` | Stale; `docs/local-dev.md` is authoritative — local only |

## Next step

For *why* these shapes were chosen (JSX not TSX, RLS instead of API routes, local-not-hosted), see
[`docs/decisions.md`](decisions.md).
