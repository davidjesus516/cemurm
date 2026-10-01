# overlay-session-capability — the OBS overlay URL is keyed on a dedicated token, not the row's primary key

> Feature: `features/obs-overlay.feature` (8 → 10 scenarios) · Issue: security finding,
> verified against the live local database · Branch: `fix/overlay-session-capability`
> (base: `main` @ `bfaf6e8`) · Single work-unit commit, not pushed.
> Capability record: `openspec/changes/fix-overlay-session-capability/proposal.md`.
> Supersedes the capability decision in `odd/tasks/hito5-obs-overlay.md` (0025, PR #149).

## Objective

`public.overlay_state(p_session_id uuid)` is a `security definer` RPC granted to `anon`.
It authenticated the caller by matching `overlay_sessions.id` — the table's **primary
key** — and returned `song_title`, `song_key` and the full `chart_body`, the unpublished
ChordPro of whatever song is playing.

Move the bearer onto a dedicated `access_token` column, so the primary key stops being a
credential and a leaked overlay URL becomes revocable **without ending the stream**.

## Problem / Why

Three findings, in increasing order of how much they actually cost.

**1. The primary key is a structurally exposed identifier, not a secret.** The repository
says so itself, in four places: a URL path segment consumed by an OBS Browser Source
(`src/data/repositories/overlay.js:28`), a route parameter
(`src/app/router.jsx:85` — `/overlay/:sessionId`), a `localStorage` mirror
(`cemurm:obs:id:<setlistId>`, `overlay.js:15,30,33-47`), and the value handed straight to
`supabase.rpc` (`src/features/stage/pages/Overlay.jsx:33-35`).

**2. The same repository already solves this twice, on a sibling table.**
`0017_minors_guardian_consent.sql` adds `revocation_token`; `0020_review_batch1.sql` adds
`sharing_approval_token`. Both are dedicated columns that exist **solely** to be the
secret, while the row's `id` stays an ordinary identifier. The overlay never got the
pattern the rest of the schema already uses.

**3. There was no way to revoke a leaked URL without killing the show.** This is the part
that is not hypothetical hardening:

- Revoking via `status` is not a separate action — `status` **is** the token window, so
  disabling a leaked session means the stream visibly goes dark.
- Revoking via a new `id` is impossible: `enableOverlay` upserts with
  `{ onConflict: 'user_id,setlist_id' }`, so a new `id` would fight the stable-URL
  contract required by `features/obs-overlay.feature:13`.

A dedicated token column is what makes the third option exist: rotate the token, the old
URL is dead at its next poll, the row, the setlist binding and the stream carry on.

**The layering was already correct.** Verified against the live database, not just the
migrations: the anon-executable surface in the app schemas is exactly three functions —
`public.approve_guardian_sharing`, `public.revoke_guardian_consent`,
`public.overlay_state` — and the `private` schema has zero. All three are
`security definer` with `search_path = ''`. This change is only about **which value is
the bearer**.

## Scope

- `supabase/migrations/0032_overlay_access_token.sql` (new).
- `scripts/smoke/0032-overlay-access-token.sql` (new).
- `src/data/repositories/overlay.js`, `src/features/stage/pages/Overlay.jsx`,
  `src/app/router.jsx`, and the dependent `src/features/stage/pages/StageMode.jsx`.
- `features/obs-overlay.feature` +2 scenarios.
- `odd/tasks/hito5-obs-overlay.md` — the 0025 design record asserted the old rule in three
  places and is corrected without deleting the original reasoning.

Out of scope, and deliberately: the 0025 **RLS policies** (untouched, still
deny-by-default, anon still holds no table grant); `overlay_state`'s **response contract**
(same columns, same empty row for unknown / NULL / inactive, no exception, no oracle); a
**UI control** for rotation; any **index** on the new column.

## Migration number

`0032` is the next genuinely free number. `0029` is already claimed **twice** by unrelated
in-flight work (`0029_feedback.sql` on the m2-feedback branches,
`0029_fail_closed_minors.sql` on the guardian branches), and `0030_date_of_birth_step.sql`
and `0031_guardian_consent_email.sql` are claimed too. Checked with
`git branch -r | xargs -I{} git ls-tree --name-only {} -- supabase/migrations/`.

## Tasks

- [x] T1 — `0032_overlay_access_token.sql`: `access_token uuid not null default
      gen_random_uuid()`, and `overlay_state` re-keyed on it.
- [x] T2 — `scripts/smoke/0032-overlay-access-token.sql`, 22 assertions.
- [x] T3 — `overlay.js`: token mirror (renamed prefix + helpers), `OVERLAY_URL(token)`,
      `enableOverlay` → `{ id, accessToken }`, `getOverlaySession` selects `access_token`,
      **new** `rotateOverlayToken(setlistId)`.
- [x] T4 — `Overlay.jsx` + `router.jsx` + the dependent `StageMode.jsx` call site.
- [x] T5 — Gherkin +2 scenarios; `odd/tasks/hito5-obs-overlay.md` corrected in its three
      decision points; proposal + this record.
- [x] T6 — All four gates run locally (typecheck is **not** in CI).

## Acceptance criteria

- [x] `overlay_state` accepts `p_access_token` only. **No id-accepting entry point
      survives** — the old signature is replaced, not shadowed.
- [x] An unknown, `NULL` or inactive token returns the single empty row
      `(false, '', '', '', 0, 0, '')`. No exception, no oracle.
- [x] `security definer set search_path = ''` and `execute to anon` only, with
      `revoke … from public, authenticated` re-asserted.
- [x] The 0025 RLS policies and table grants are unchanged; `id` remains the primary key
      and is an ordinary identifier.
- [x] `rotateOverlayToken(setlistId)` issues a fresh token for the caller's own row and
      returns it, with the same auth + error shape as `enableOverlay`.
- [x] A `localStorage` mirror written by the id-based version is **ignored**, not used as a
      token (prefix `cemurm:obs:token:`), and a missing mirror takes the existing
      `getOverlaySession` fallback rather than addressing a row.
- [x] No existing Gherkin scenario edited. No characterization assertion touched — none of
      the seven suite files is in this change's diff.
- [x] All four gates exit 0.

## Checks

- **TDD: not applicable.** The characterization suite guards `src/domain/**` and
  `src/integrations/spotify.js`; this change touches neither. `pnpm test` is 235 passed,
  identical to `main`.
- **No repository-layer test was written, on purpose.** There are zero tests under
  `src/data/repositories/` today (`ls src/data/repositories/*.test.js` → no such file) and
  the suite runs in the `node` environment with no jsdom and no testing-library. Adding the
  first Supabase-mocking harness here would be inventing a convention nobody made. The
  right test surfaces for this unit are the SQL smoke test and the Gherkin.
- Functional: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`.
- Manual, not run: `supabase db reset` + the smoke test (see the gap below).

## Verification evidence — actual results

| Gate | Observed output |
|---|---|
| `pnpm test` | `Test Files 7 passed (7)` / `Tests 235 passed (235)`, 4.34 s, exit 0 |
| `pnpm typecheck` | `tsc --noEmit`, no output, exit 0 |
| `pnpm lint` | `eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`, no output, exit 0 |
| `pnpm build` | `✓ built in 19.18s`, `dist/assets/index-pr5_ZEXj.js` 855.33 kB, exit 0 (pre-existing >500 kB chunk warning only) |
| `checkJs` baseline | `npx tsc --noEmit --listFiles \| grep -c 'cemurm/src/'` → **48** — alive, unchanged |

## Gaps — what was NOT verified, and why

1. **The migration has never been applied.** The maintainer explicitly forbade
   `supabase db reset` and reserved the database, so `0032` is written and reviewed but
   **unexecuted**. The smoke test that would prove it has the same status.
2. **`access_token` is not indexed.** The RPC lookup is a sequential scan where the old
   `s.id = …` used the primary-key index. Harmless at this table's size (one row per user ×
   setlist) and a real cost if it grows. The design named the exact `alter table`
   statement, so the index is recorded as a follow-up rather than added unasked:
   `create unique index overlay_sessions_access_token_idx on public.overlay_sessions (access_token);`
3. **`create or replace` is relied upon to remove the old door.** PostgreSQL keys
   functions on name + argument *types*, and both signatures are `(uuid)`, so the body is
   swapped in place under the same OID and 0025's grants stay attached. That reasoning is
   stated in the migration comment rather than left as folklore; a reviewer who disagrees
   has the one-line `drop function public.overlay_state(uuid);` fallback.
4. **No Gherkin scenario is executed by any gate.** `features/*.feature` is product truth
   that nothing runs in this repository.
5. **No browser check.** The OBS Browser Source round trip (enable → copy URL → the CEF
   source rendering) is manual.

## Deviations from the plan (all reported, none silent)

1. **`src/features/stage/pages/StageMode.jsx` was changed although the plan did not list
   it.** It consumes `enableOverlay` (destructuring `id`), `OVERLAY_URL(id)` and
   `loadOverlayId`, so renaming the mirror and the return shape breaks it. Leaving it
   untouched would have shipped a green build with a Stream panel that shows a URL the RPC
   will reject. In-memory state renamed `overlaySessionId` → `overlayToken`.
2. **`src/features/stage/components/OverlayView.jsx` — one comment.** Its header still
   said `/overlay/:sessionId`.
3. **Owner-side writes now resolve the row id from the DB, not from `localStorage`.**
   `disableOverlay` / `setOverlayMode` / `pushOverlayState` keep using `id` (they are
   authenticated owner operations and the id is the right key for them), but the mirror
   no longer holds an id, so they read `getOverlaySession(setlistId)?.id`. Cost: one extra
   indexed read per song change while the overlay is enabled, immediately before the
   UPDATE that already costs a round trip. Benefit: a stale local value can never address
   the wrong row, which is the property the rename was for.
4. **No UI control for rotation — a real, declared gap.** The Gherkin scenario for
   rotation specifies something the Stage Mode panel does not yet expose; today an operator
   can rotate only through the repository export. Wiring a button was not in the decided
   design and the entry rule (`docs/engineering-review-backlog.md:5`) keeps unrequested UI
   out.
5. **`docs/database-schema-v2.md` was left stale on purpose.** Lines 121 and 780 still
   assert "the unguessable session uuid IS the capability". It is now false. It was not in
   scope, and widening a security diff into a 900-line schema document is how reviews get
   lost — so it is **reported here with its line numbers** rather than fixed quietly.
6. **`odd/tasks/hito5-obs-overlay.md` client section was annotated, not rewritten.** The
   top-of-file banner plus a note at the head of the Client section carry the correction;
   the six lines describing what PR #149 shipped are the historical record and stay.

## Operational note for whoever applies 0032

Existing rows are backfilled with a **fresh** token by the column default, so any OBS
Browser Source still pointed at a pre-0032 `id`-based URL goes inactive after the
migration. That is the revoke lever working, not a regression. The operator re-copies the
URL from the Stage Mode Stream panel, which now reads the token from the DB row on load.

## Next step

Apply the migration and run the smoke test, in that order:

```bash
supabase db reset
docker exec -i supabase_db_cemurm psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f - < scripts/smoke/0032-overlay-access-token.sql
```

Expect **22 PASS / 0 FAIL**. The assertion to read first is *"0032 anon RPC: the PRIMARY
key does NOT grant access (empty row)"* — with the row active and its token valid, that
call returned the song title, key and full ChordPro body under 0025. It returns the empty
row now, and nothing else in this change would produce that.

Nothing here is merged. The maintainer merges.
