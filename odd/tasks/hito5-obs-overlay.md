# Hito 5 — #66 OBS Overlay for Streaming (PR #149)

Feature: `features/obs-overlay.feature` (8 scenarios) · Issue #66 · Branch `feat/hito5-obs` (base: `feat/hito5-midi` `e3732de`) · Stack: stacked-to-main, PR base `main`, Closes #66.

## Objective

A clean OBS Browser Source overlay for live streaming: stable overlay URL that shows the current song title, chords (on operator override), and setlist position — chrome-free, annotation-free, and valid ONLY while the operator authorizes the stream session.

## Why server-backed (design decision)

External Display (#62) and Congregation Projection (#79) use client-only BroadcastChannel popups — they work because `window.open` lives in the SAME browser as the operator. An OBS Browser Source runs in a **separate Chromium (CEF) process**: BroadcastChannel and localStorage never cross browser instances. The overlay therefore needs a **server-backed session**:

- Operator's app writes the current performance snapshot to a Supabase row (`overlay_sessions`).
- The overlay is a PUBLIC URL (`/overlay/<sessionId>`) that polls a SECURITY DEFINER RPC `overlay_state(p_session_id)`.
- The unguessable session uuid IS the capability: `anon` may call the RPC but gets NOTHING without a valid, ACTIVE session id — even the owner gets nothing when the session is inactive. This satisfies "valid only while I authorize the stream session", "inactive outside my session / no leak", and "disabled mid-stream → immediately inactive, no further data pushed" without building an auth flow for a CEF source.

## Backend contract (0025 — `supabase/migrations/0025_overlay_sessions.sql`)

Table `public.overlay_sessions` — deny-by-default surface:

| column | type | notes |
| --- | --- | --- |
| `id` | uuid pk default `gen_random_uuid()` | session id = overlay URL token (capability) |
| `user_id` | uuid not null → auth.users | owner |
| `setlist_id` | uuid not null → public.setlists | bound performance |
| `status` | text not null default `'inactive'` | `'active'` \| `'inactive'` — enable/disable FLIP, never delete row |
| `mode` | text not null default `'title'` | `'title'` \| `'chords'` — operator override |
| `song_index` | int not null default 0 | 0-based position |
| `song_total` | int not null default 0 | setlist length (snapshot at enable/push) |
| `song_title` | text not null default `''` | snapshot |
| `song_key` | text not null default `''` | snapshot (decorative, from parsed chart) |
| `chart_body` | text not null default `''` | raw ChordPro body of the current song chart |
| `updated_at` | timestamptz default now() | |

- `unique (user_id, setlist_id)` → ONE stable row per setlist ⇒ **stable overlay URL across streams** (spec: "stable overlay URL"); enable/disable just flips `status`.
- RLS: enable, owner-only (`user_id = auth.uid()`) INSERT/UPDATE/DELETE; enable, owner-only SELECT (operator UI needs `id` back after upsert). No read surface for anyone else; `revoke all … from public, anon, authenticated` then grant narrowly.
- RPC `public.overlay_state(p_session_id uuid)` returns `table (active boolean, title text, key text, body text, song_index int, song_total int, mode text)`:
  - `security definer set search_path = ''`.
  - Session missing OR `status <> 'active'` → single row `(false, '', '', '', 0, 0, '')`. **Never returns song data when inactive** — "no leak", "immediately serves inactive".
  - Active → the snapshot fields.
  - **`grant execute … to anon`** (and `revoke … from public`) — the CEF source has no JWT. The uuid is the capability; inactive ⇒ no data regardless of caller.
- NOT transposing: overlay scope is "title, chords, setlist position" — the snapshot uses the chart as resolved by the stage (`song.body`), transpose is personal performance state and stays on the operator side.

## Client

- `src/lib/overlay.js` — data layer:
  - `enableOverlay(setlistId, snapshot)` → upsert (onConflict `user_id,setlist_id`) status active + snapshot; returns row `id`.
  - `disableOverlay(setlistId)` → update status `'inactive'`.
  - `setOverlayMode(setlistId, mode)` → update `mode` (`'title'`|`'chords'`).
  - `pushOverlayState(setlistId, snapshot)` → update song fields (only called while enabled; best-effort like MIDI — failures never block performance).
  - `getOverlaySession(setlistId)` → owner read (for URL copy after reload).
  - localStorage mirror `cemurm:obs:id:<setlistId>` → StageMode knows the session id immediately on reload and can show the URL without a round-trip. `loadOverlayId`/`saveOverlayId`.
  - `OVERLAY_URL = (id) => \`/overlay/${id}\``, `STATE_POLL_MS = 2000`.
- `src/components/overlay/OverlayView.jsx` — chrome-free audience view (dark bg):
  - Active: big song title, small key, compact `N / M` indicator (1-based: `song_index + 1` of `song_total`); `mode === 'chords'` ALSO renders the chart parsed via `parseChordPro(body)` — **comment sections are SKIPPED entirely** (unlike ExternalDisplayView which italicizes them: OBS spec says "performer annotations and control chrome never appear" and "personal annotations never leak"). Chords rendered over lyrics like ExternalDisplayView's chords-only lines.
  - Inactive: dark screen, subtle "Overlay inactive" text. NO song data.
- `src/pages/Overlay.jsx` — public route `/overlay/:sessionId` (NO auth guard):
  - Poll `overlay_state(sessionId)` every 2 s + immediately on mount; render `OverlayView`. Polling keeps CEF live state fresh; disable mid-stream reflects within one poll.
- `src/App.jsx` — add route `/overlay/:sessionId` → `Overlay.jsx` outside the guarded routes.
- StageMode integration (operator side):
  - Push effect: mirror the MIDI Program Change effect (keyed on `song.id`, skip-first render so OPENING stage mode doesn't write — actually harmless here but keep identical shape): on song change, IF overlay enabled for this setlist (local id present + last known active), `pushOverlayState` with `{ song_index: index, song_total: songs.length, song_title: song.title, song_key: parsed?.key ?? '', chart_body: song.body }`.
  - Enable flow: `enableOverlay` writes the CURRENT snapshot immediately (covers "enabled mid-setlist" and first render), saves local id.
  - New "Stream" panel in StageMode chrome: Enable/Disable toggle, mode switch (Title only / Title + chords), URL text + Copy when enabled ("OBS Browser Source URL"), status label (Broadcasting / Inactive). Copy via `navigator.clipboard` with a copied-feedback state; fallback to `document.execCommand('copy')` if clipboard API unavailable.
  - Disable mid-stream: `disableOverlay` → RPC returns inactive at next poll → URL serves inactive immediately (spec scenario 8).

## Tasks

| id | scope | check |
| --- | --- | --- |
| T1 | 0025 migration + `scripts/smoke/0025-obs.sql` | `supabase db reset` + smoke all PASS |
| T2 | `src/lib/overlay.js` | lint/build |
| T3 | `OverlayView.jsx` + `Overlay.jsx` page + route in `App.jsx` | lint/build; view manual |
| T4 | StageMode Stream panel + push effect | lint/build; manual |
| T5 | docs: `docs/database-schema-v2.md` overlay_sessions §; this task doc closed; Engram mirrors | review |

## Acceptance criteria

1. Enabling shows a stable `/overlay/<id>` URL; row persists across reloads (unique per setlist).
2. Anon/open URL renders inactive + NO song data when session inactive/unknown; owner-visible only.
3. Active URL shows title, updates on next/back, `N / M` indicator updates.
4. Mode override toggles chords on the overlay live.
5. Comments/annotations NEVER rendered on the overlay (parser sections of type `comment` skipped).
6. Disable mid-stream → overlay goes inactive at next poll; no further pushes.
7. `pnpm lint` zero warnings; `pnpm build` green; smoke 0025 all PASS.

## Delivery

- Work-unit commits per task (Conventional Commits, English): 0025+smoke → lib → view/page/route → stage integration → docs.
- Estimated authored lines > 400 ⇒ **size:exception documented** (chain precedent #147/#148 accepted by maintainer; slices remain one feature = one PR).
- Labels: none (chain pattern — no `type:*`/`status:approved` in this repo).

## Verification record

| task | check | evidence |
| --- | --- | --- |
| T1 | smoke 0025 | **20/20 PASS** (fresh `supabase db reset`, docker exec psql); commit `775c44b` |
| T2 | lint/build; contract readback | `e1dff6a`; `pnpm lint` 0 warnings; contract matches 0025 (lib readback) |
| T3 | lint/build; page/route readback | `9eff6f5`; `pnpm build` green; route top-level public `/overlay/:sessionId` (no AppLayout chrome) |
| T4 | lint/build; StageMode readback | `def75f4`; push effect keyed on song.id skip-first (MIDI mirror); save-default-disabled restore; panel default closed |
| T5 | docs round | schema §1.9 + §2.10.2 updated (deviation note); this doc closed |

Branch head: `def75f4` (docs commit follows) → PR #149 (base `main`, Closes #66, no labels — chain pattern).

Verified remaining: overlay client contract vs 0025 (columns, RPC name/signature, anon-only EXECUTE), parent re-ran `pnpm lint` (0/0) after writer delivery.