# Proposal: the public OBS overlay URL is authenticated by the row's PRIMARY KEY, and there is no way to revoke it

> Change: `fix-overlay-session-capability`
> Finding: verified against the live local database, not only against the migration files —
> the anon-executable surface in the app schemas is exactly three functions
> (`public.approve_guardian_sharing`, `public.revoke_guardian_consent`,
> `public.overlay_state`) and the `private` schema has zero. All three are
> `security definer` with `search_path = ''`. The layering is already right; **only the
> value that is presented as the bearer is wrong.**
> Status: **implemented.** All four gates green. The migration and the smoke test are
> written but **not applied to the database** — the maintainer reserved that step.
> Branch: `fix/overlay-session-capability`, cut from `main` (`bfaf6e8`).

## Intent

`overlay_state` authenticated its caller by matching `overlay_sessions.id` — the table's
**primary key** — and in return handed out `song_title`, `song_key` and the full
`chart_body`, the unpublished ChordPro of whatever song is playing.

Make the bearer a dedicated secret instead of an identifier, and add the revocation lever
that the identifier could never provide.

## Problem

### 1. The primary key is structurally exposed, not secret

The repository states in its own code that the value is everywhere:

| Exposure | Location |
|---|---|
| a URL path segment consumed by an OBS Browser Source | `src/data/repositories/overlay.js:28` — ``OVERLAY_URL = (sessionId) => `/overlay/${sessionId}` `` |
| a route parameter | `src/app/router.jsx:85` — `path: '/overlay/:sessionId'` |
| mirrored into `localStorage` | `src/data/repositories/overlay.js:15,30,33-47` — `cemurm:obs:id:<setlistId>` |
| handed straight to the RPC | `src/features/stage/pages/Overlay.jsx:33-35` — `supabase.rpc('overlay_state', { p_session_id: sessionId })` |

An identifier that lives in a URL bar, a route table and a browser's localStorage is not
an unguessable bearer. It is a primary key.

### 2. The same repository already solved this twice, on a sibling table

`0017_minors_guardian_consent.sql` adds `revocation_token`; `0020_review_batch1.sql` adds
`sharing_approval_token`. Both are dedicated `uuid` columns that exist **solely to be the
secret**, while the row's `id` stays an ordinary identifier. The pattern, the rationale
and the naming are already established in this codebase. The overlay simply never got it.

### 3. There was no way to revoke a leaked URL without killing the stream

This is the part that is not hypothetical hardening.

- Revoking by `status` is not a separate action: `status` **is** the token window, so
  disabling a leaked session means the stream visibly goes dark.
- Revoking by rotating the `id` is impossible: `enableOverlay` upserts with
  `{ onConflict: 'user_id,setlist_id' }`, so a new `id` would fight the stable-URL
  contract that `features/obs-overlay.feature:13` requires ("the app exposes a stable
  overlay URL for OBS").

So a URL leaked to a chat room, a screenshot, or a browser history entry had exactly one
remedy, and it took the show down. A dedicated token column is what makes the third
option exist.

### 4. The Gherkin already permitted the change

`features/obs-overlay.feature` requires that the URL be *"valid only while I authorize the
stream session"* and never says the URL must contain the primary key. **Nothing in the
specification is weakened by this change**; two scenarios are added, for the two things
the spec did not settle: that the URL is not the row's identifier, and that the secret is
rotatable.

## Scope

### In scope

- `access_token uuid not null default gen_random_uuid()` on `public.overlay_sessions`.
- `overlay_state(p_session_id uuid)` → `overlay_state(p_access_token uuid)`, matching on
  `access_token`. The id-based door is gone, not deprecated.
- The client mirror, the route param, and the RPC argument.
- `rotateOverlayToken(setlistId)` — the capability that does not exist today.
- Two Gherkin scenarios, the smoke test, and the correction of the design record that
  currently asserts the old rule.

### Out of scope

- **The RLS policies from 0025.** Unchanged, still deny-by-default. Only the RPC's lookup
  key moves; anon still holds no table grant, so the RPC remains its only path.
- **`overlay_state`'s response contract.** Same columns, same empty row
  `(false, '', '', '', 0, 0, '')` for unknown / NULL / inactive, no exception and no
  oracle. Unchanged.
- **A UI control for rotation.** The data-layer export is the decided deliverable. See
  *Frozen decisions* 5 — this is a real gap, stated rather than hidden.
- **Any index on `access_token`.** See *Frozen decisions* 6.
- Realtime, expiry timestamps, per-viewer sessions, signed URLs.

## Capabilities

### New capabilities

None.

### Modified capabilities

None. The repository has no `openspec/specs/obs-overlay/` and this change does not create
one: the capability the Gherkin specifies (a public overlay URL, valid only while the
operator authorizes the session) does not change shape — it changes the value it is keyed
on. Opening a spec file for "a secret column exists" would be a worse record than none.

## Approach

One principle: **the thing that is presented to an untrusted caller is dedicated to being
the credential, and the identifier it happens to be derived from is not.**

- Copy the 0017/0020 pattern rather than inventing a third shape for the same problem.
- Match on `access_token`; do not keep the old signature "for compatibility". A second
  entry point that accepts the id is the vulnerability, kept alive by inertia.
- Rotate **inside** the row. One row per `(user_id, setlist_id)` is still the stable-URL
  contract; the token moves, the row does not.
- Change the localStorage prefix so a mirror written by the id-based version is ignored
  rather than handed to the RPC as a token. A stale value must take the existing
  `?? (await getOverlaySession(...))` fallback path, not silently address a row.
- Keep `id` for the owner-side writes (`disableOverlay`, `setOverlayMode`,
  `pushOverlayState`): those are authenticated owner operations where RLS is the gate, and
  the id is the right key. They now resolve it from the DB row instead of the mirror.

## Affected areas

| Area | Impact | Description |
|---|---|---|
| `supabase/migrations/0032_overlay_access_token.sql` | New | the column, and `overlay_state` re-keyed on it |
| `scripts/smoke/0032-overlay-access-token.sql` | New | 22 assertions; token grants, **pk does not**, inactive, rotation |
| `src/data/repositories/overlay.js` | Modified | `loadOverlayToken`/`saveOverlayToken` (prefix `cemurm:obs:token:`), `OVERLAY_URL(token)`, `enableOverlay` → `{ id, accessToken }`, `getOverlaySession` selects `access_token`, new `rotateOverlayToken` |
| `src/features/stage/pages/Overlay.jsx` | Modified | `p_access_token`, param `token` |
| `src/app/router.jsx` | Modified | `/overlay/:token` + comment |
| `src/features/stage/pages/StageMode.jsx` | Modified | **dependent call site** — consumes `enableOverlay`/`OVERLAY_URL`/`loadOverlayId`; state renamed to `overlayToken` |
| `src/features/stage/components/OverlayView.jsx` | Modified | one stale `:sessionId` in a header comment |
| `features/obs-overlay.feature` | Modified | +2 scenarios (8 → 10); none edited |
| `odd/tasks/hito5-obs-overlay.md` | Modified | the 0025 design record asserted the old rule in three places; corrected with the original reasoning kept |
| `docs/database-schema-v2.md` | **Not touched** | still says "the unguessable session uuid IS the capability" (§1.9 note, line 121; §2.10.2, line 780). **Left stale and reported** — see *Verification*. |

## Verification — actual results, not intentions

| Gate | Result |
|---|---|
| `pnpm test` | **235 passed** (7 files). Unchanged from `main`: the suite guards `src/domain/**` and `src/integrations/spotify.js` only, and none of those files are touched. |
| `pnpm typecheck` | **exit 0.** `overlay.js` has no `// @ts-check` pragma and is not in the baseline; see *Verification gaps*. |
| `pnpm lint` | **exit 0**, 0 warnings. |
| `pnpm build` | **exit 0**, `dist/assets/index-pr5_ZEXj.js` 855.33 kB. |
| `checkJs` baseline | **48 files** — alive, unchanged. |

**The red-to-green evidence is SQL, and it has not been executed.** The strongest assertion
in `scripts/smoke/0032-overlay-access-token.sql` is the inverse of the old behaviour:
with the row **active and its token valid**, calling `overlay_state(<primary key>)` must
return the empty row. Under 0025 that exact call returned the song title, key and the full
ChordPro body. It is written; **it has not been run**, because the maintainer reserved
`supabase db reset` and the migration application.

**Not verified, stated plainly.**

- The migration has never been applied. `create or replace` is relied upon to swap the
  `(uuid)` signature in place (PostgreSQL keys functions on name + argument *types*), and
  that reasoning is worth re-reading: if a reviewer disagrees, the fallback is an explicit
  `drop function public.overlay_state(uuid);` before the create.
- `access_token` is **not indexed**, so the RPC's lookup is a sequential scan where the
  old `s.id = …` used the primary-key index. Harmless at this table's size (one row per
  user × setlist), a real cost if the table ever grows. Follow-up, not folded in:
  `create unique index overlay_sessions_access_token_idx on public.overlay_sessions (access_token);`
- No Gherkin scenario is executed by any gate — there is no jsdom and no testing-library
  in this repository, so `features/*.feature` is product truth that nothing runs.
- No browser check: the OBS Browser Source round trip is manual.

## Rollback

One migration, one repository module, one page, one route, one dependent call site, one
comment, two feature scenarios and three doc corrections. Reverting restores the
id-based door, so the migration is the only ordering constraint: revert the client and the
migration together, or the overlay serves nothing at all (the RPC would be gone, or the
client would send `p_access_token` to a function that expects `p_session_id`). Row data is
untouched by the revert — dropping the column discards the tokens, and re-enabling the
overlay mints a new one from the column default.

## Frozen decisions

1. **The id-based door is removed, not deprecated.** No second signature, no compatibility
   shim, no feature flag. A second entry point that accepts the primary key is the
   vulnerability, and keeping it "for compatibility" would leave the finding unfixed while
   the commit message claims otherwise.
2. **The Gherkin is conformed to, never weakened.** No existing scenario of
   `obs-overlay.feature` was touched. The two new scenarios make the contract stricter
   (the URL is *not* the identifier; the secret is rotatable) and neither contradicts an
   existing one.
3. **The bearer is a dedicated column, not a derived one.** No `hash(access_token)`, no
   token-in-URL-with-a-signature, no signed URL. The repo already made this choice twice
   (0017, 0020) and a third mechanism is a third thing to audit.
4. **`id` stays in the client for owner-side writes.** `disableOverlay`, `setOverlayMode`
   and `pushOverlayState` are authenticated owner operations; RLS is the gate and the
   primary key is the correct key for them. They resolve it from the DB row rather than
   from `localStorage`, which removes the stale-mirror hazard instead of routing around it.
5. **No UI control for rotation, and that is a real gap.** The Gherkin scenario for
   rotation specifies a capability the Stage Mode panel does not yet expose; an operator
   cannot rotate from the UI today, only through the repository export. Wiring a button
   was not in the decided design, and the entry rule (`docs/engineering-review-backlog.md:5`)
   keeps unrequested UI out. Declared here rather than shipped quietly.
6. **No index on `access_token`, and it was a deliberate omission.** The design named the
   exact `alter table` statement, and a unique index is a decision with its own
   consequences (rotation collisions, concurrent-insert failure modes). It is recorded above
   as a follow-up instead of being added unasked.
7. **The `create or replace` mechanism is the mechanism, and it is documented in the
   migration.** Both signatures are `(uuid)`, so the body is replaced in place under the
   same OID, 0025's grants stay attached, and no id-accepting function survives. The
   migration says this in a comment rather than leaving it as folklore.
8. **`docs/database-schema-v2.md` was deliberately NOT updated.** It makes the same false
   claim as the 0025 design record, and it is the schema's design origin — a document that
   is wrong about the live schema is worth fixing. But it was not in this change's scope,
   and silently widening a security PR's diff into a 900-line schema document is how
   reviews get lost. **Reported as a known-stale claim, with its two line numbers.**
