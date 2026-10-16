# CEMURM — Wireframes & Layout Specification

> **Status:** Active
> **Created:** 2026-09-12
> **Complements:** design-system.md (visual identity) and ux-spec.md (behavior) — this doc covers **layout/disposition**: where items go and how they are arranged. Color and typography belong to design-system.md; interaction, copy, and component behavior belong to ux-spec.md. Both are referenced here by section, never re-specified.
> **Scope:** reflects the current **Hito 1** implementation — every screen maps to a real route in `src/App.jsx` and uses only components that exist in `src/components/`. Screens planned for later hitos (Stage Mode, onboarding, notifications, collections, profiles) are out of scope until implemented. Thin stubs are called out as such.

---

## 1. Conventions

- **One screen per route.** The route table in `src/App.jsx` is the source of truth: `/`, `/songs`, `/songs/:id`, `/songs/:id/practice`, `/setlists`, `/setlists/:id`, `/auth`, `*`.
- **Wireframe level.** Regions, order, alignment, and a spacing scale — not pixel-perfect grids.
- **Spacing scale (Tailwind 4/6/8):**

  | Token | Size | Use |
  |-------|------|-----|
  | `2` | 8px | Inline gaps between chips/badges, tight button clusters |
  | `4` | 16px | Card/row padding (`px-4`, `py-3`), page gutters (`px-4`), form-field gaps |
  | `6` | 24px | Gaps between major regions (header → filter → list, header → chart) |
  | `8` | 32px | Main-content vertical padding (`py-8`), large empty-state padding (`p-8`) |

- **Color/typography references** use the `cem.*` Tailwind classes (tailwind.config.js, = design-system.md §2.2 tokens) and design-system.md type tokens (§4.2). This doc assumes tokens, it does not restate them.

---

## 2. App Shell

Shared chrome for every screen (`src/components/layout/AppLayout.jsx`): a horizontal top header, a single content column, a footer. No sidebar.

```
┌────────────────────────────────────────────────────────────────┐
│ HEADER  bg-cem-surface · max-w-7xl · px-4 · py-4               │
│  CEMURM (brand, left)      Home  Repertoire  Setlists          │
│                                            │ displayName · Log │
│                                            │ Out (or Sign In) │
├────────────────────────────────────────────────────────────────┤
│ MAIN  flex-1 · max-w-7xl · w-full · px-4 · py-8                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │                    <Outlet /> — screen                 │  │
│   └────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────┤
│ FOOTER  bg-cem-surface · border-t · border-cem-elevated        │
│         text-xs · text-cem-secondary · centered · py-4         │
└────────────────────────────────────────────────────────────────┘
```

**Zone map:**

| Region | Content |
|--------|---------|
| Header left | Brand — `NavLink` to `/`, `text-xl font-bold text-cem-text`. CEMURM wordmark only |
| Header center/right | Nav — `Home` `/`, `Repertoire` `/songs`, `Setlists` `/setlists` (`flex gap-4`, `text-sm font-medium`; active = `text-cem-amber`, inactive = `text-cem-secondary hover:text-cem-text`). Right cluster `gap-4`; signed-in: `displayName` + `Log Out`, separated from nav by `border-l border-cem-elevated pl-4`; signed-out: single `Sign In` `NavLink` to `/auth` |
| Main | `flex-1` keeps the footer pinned on short viewports. All screens render here |
| Footer | One-line legal/tagline, centered |

**Layout rules**

- Container: header, main, and footer share `max-w-7xl mx-auto` (1280px) with `px-4` gutters at every breakpoint.
- No sidebar and **no responsive hamburger**: one horizontal header row at all widths. Short nav labels (Home / Repertoire / Setlists) are chosen to fit narrow screens in place.
- Route guards (`src/components/auth/AuthGuards.jsx`) do not render layout — they either render `<Outlet />` or issue a redirect:
  - `RequireAuth` wraps `/songs*` and `/setlists*`; signed-out users are redirected to `/auth` with `state.from` preserved.
  - `RedirectIfAuthed` wraps `/auth`; signed-in users bounce to `state.from` or `/`.
- Content column width by screen type: list screens use the full 7xl column; detail screens cap themselves (`max-w-2xl`, `max-w-3xl`, `max-w-md` — see each screen).

---

## 3. Screens

### 3.1 Home — `/` (stub)

**Purpose:** Landing/dashboard. Today it is a welcome stub — no dashboard widgets, no navigation cards.

```
┌──────────────────────────────────────────────┐
│  Welcome to CEMURM            (h1, 2xl bold) │
│  Community-Centered Musical Repertories      │
│  Manager — your tool for organizing          │
│  repertoires, building setlists, and         │
│  performing live.          (body, secondary) │
│                                              │
│  (no further regions — dashboard planned in  │
│   later hitos)                               │
└──────────────────────────────────────────────┘
```

**Layout rules:** Single stacked block left-aligned in the content column. No zones, no actions, no responsive behavior beyond the 7xl container cap. **Stub — the design-system.md/ux-spec.md dashboard surface does not exist yet; do not wireframe regions for it.**

**Empty/loading states:** None (static content; no data dependency).

---

### 3.2 Repertoire — `/songs`

**Purpose:** Browse, search, filter, and manage the song list. **Row list, not cards** — the implemented choice is a divided full-width list inside one bordered surface.

```
┌──────────────────────────────────────────────────────────────┐
│ Repertoire (h1)                                   [Add Song] │  header row
│ [ Active | Retired ]  segmented toggle (fit-content)         │
│                                                              │
│ [Search by title or chord…] [All keys ▾] [Tempo range]  (n)  │  filter row (wraps)
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Title link    [ready]  matched chord: G, C · C · 120 BPM │ │
│ │               3:05 · ♫        [Edit] [Retire] [Delete]   │ │  ← one row
│ ├──────────────────────────────────────────────────────────┤ │
│ │ Next row…                                                │ │
│ └──────────────────────────────────────────────────────────┘ │
│ (inline New/Edit SongForm card renders here, above the list) │
└──────────────────────────────────────────────────────────────┘
```

**Zone map:**

| Zone | Content |
|------|---------|
| Header row | H1 `Repertoire` (left) · `Add Song` solid amber button (right) — hidden while the form or edit mode is open |
| Toggle | `Active` / `Retired` segmented control (`border border-cem-elevated p-0.5`, active segment = `bg-cem-amber text-cem-base`), `mt-4`; `Retired` view = `Retire` filters list, hides filters |
| Filter row | `mt-3`, wraps (`flex flex-wrap gap-2`), only in Active view: search input `max-w-md`, key `<select>` (`All keys`), tempo input `w-44` (`Tempo range, e.g. 70-100`), key-count badge `bg-cem-amber/10` when a key filter is set |
| List | `ul` container: `divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm`, `mt-4` |
| Inline form | `SongForm` (`components/songs/SongForm.jsx`) renders as a bordered card below the toggle, above the list, for both New and Edit |

**Item anatomy (row, `px-4 py-3`, `flex justify-between`):**

- **Left column** — one metadata line, then an optional readiness line:
  1. Title — `Link` to `/songs/:id`, `text-sm font-medium`, hover = `text-cem-amber`
  2. Status badge — caption pill (`ready` emerald / `draft` amber / `retired` elevated), `ml-2`
  3. Matched-chord badge — amber-tinted, only while a search query is active: `matched chord: G, C`
  4. Metadata spans (`text-xs text-cem-secondary`, `ml-2` each, in order): **key → BPM → duration** (`3:05`) → `♫` chord-chart marker (`text-cem-amber`, only when `hasChordChart`)
  5. Readiness reason (`text-xs text-cem-amber`, `mt-0.5` below the line) — draft songs only
- **Right column** (`shrink-0`, `gap-2`, `text-xs` links):
  - Active view: `Edit` (amber) · `Retire` (secondary) · `Delete` (rose)
  - Retired view: `Reactivate` (emerald) · `Delete` (rose)
  - `Delete` is always present, always rightmost, always `text-cem-rose`

**Layout rules**

- Filter row stacks below `md`: search input takes full width (`max-w-md`), key/tempo inputs sit beneath on the same wrap row. Above `md` everything is one row, left-aligned.
- Rows: title + badges wrap internally on narrow screens; the right action column never wraps.
- Touch targets (ux-spec §6): `py-3` + content height ≈ the 44px minimum zone; the compact text-link actions rely on that row zone today — explicit hit-area expansion is an open item (§5).

**Empty/loading states**

- **Loading:** the list region shows a plain `Loading repertoire…` text line today. Target per ux-spec §3: skeleton placeholder in the list region; ≤2s then `Taking longer than expected — check your connection`.
- **No songs (active view)** — WHERE: list region, after load with zero items. Copy target (ux-spec §2): heading `No songs yet`, body `Paste some ChordPro text and you're set`, CTA `Create Your First Song`, rendered per EmptyState anatomy (design-system §7 — Kutu + heading + body + CTA). **Today: single text line (stub).**
- **No results** (filters active) — heading `No matches for "{query}"`, body `Try different keywords or check the title`, CTA `Clear search`. Today: `No results — try adjusting your filters.` (stub).
- **No retired songs** — plain text: `No retired songs.`

---

### 3.3 Song Detail — `/songs/:id`

**Purpose:** Read/own one song: header metadata, chord chart, edit the ChordPro source, enter practice.

```
┌──────────────────────────────────────────────────┐
│ ← Back to repertoire        (link, amber)         │
│                                                  │
│ Title (h1)                       [Practice]       │
│ C · 120 BPM    [ready]           [Edit chart]     │
│ (draft readiness reason)         [Retire]         │
│                                                  │
│ ┌─ Transition history (bg-cem-elevated) ────────┐ │
│ │ "Transition history" caption · rows of         │ │
│ │ Draft ← New · date (reason)                   │ │
│ └────────────────────────────────────────────────┘ │
│                                                  │
│ CHART CARD (ChordProRenderer) / edit form /      │
│ "no chart" empty state                           │
│   {title} (h2)   artist · Key: C                 │
│   VERSE 1 (uppercase caption)                    │
│      C           Em                              │
│      Imagine there's no heaven                    │
└──────────────────────────────────────────────────┘
```

**Zone map:**

| Zone | Content |
|------|---------|
| Back link | `← Back to repertoire`, amber, top-left |
| Header row | `mt-3`, `flex justify-between gap-4`. Left: h1 title + metadata line `text-sm text-cem-secondary` (`Key · BPM`, or `No key or BPM set`) + status badge, draft reason inline. Right: `flex gap-2` action cluster |
| Action cluster | `Practice` (emerald-bordered link → `/songs/:id/practice`) · `Edit chart` (bordered) — both shown only when the song has a body and is neither retired nor being edited; `Retire` (bordered) / `Reactivate` (emerald-bordered), mutually exclusive by status |
| Transition history | `mt-4` collapsed card (`bg-cem-elevated px-3 py-2`), visible only when `transitionHistory` exists; newest first |
| Body region | `mt-6`. Three mutually exclusive states: **chart card** (`ChordProRenderer`), **edit form**, or **no-chart empty state** |
| Chord chart card | `rounded-lg border border-cem-elevated bg-cem-surface p-6`: chart title (h2, from `{title}` directive) → artist · `Key: X` line (`text-sm text-cem-secondary`) → sections: section labels (uppercase caption), comments (italic), lyric lines with chords rendered above lyric text (`text-sm font-bold text-cem-amber` chord over `text-cem-text` lyric) |
| Edit form | Label `ChordPro text` + textarea (`rows=12`, `font-mono`) → `Save chart` (amber solid) + `Cancel` (bordered); `Saving…` disabled state |
| No-chart empty state | Centered block (`border-dashed border-cem-elevated bg-cem-surface p-8`): heading `No chord chart yet`, body `Paste ChordPro text to see chords rendered above the lyrics.`, CTA `Add ChordPro text` (amber solid) — the **practice entry point is absent here by design** (Practice link is gated on `song.body`) |

**Layout rules**

- Content column capped at `max-w-2xl`, centered; full width below that cap.
- Practice entry point lives **in the header action cluster**, not in the chart body — one consistent location per screen.
- Not-found state: rose error block + `← Back to repertoire` link, then nothing else.

**Empty/loading states**

- **Loading:** plain `Loading song…` text (stub; skeleton target per ux-spec §3).
- **Not found:** `Song not found.` rose banner — where: full content region, before anything else.
- **No chart:** empty-state block above (EmptyState anatomy per design-system §7 once extracted; today inline markup).

---

### 3.4 Practice — `/songs/:id/practice`

**Purpose:** Focused practice surface: transpose the chart on the fly, nudge tempo, no edit chrome.

```
┌──────────────────────────────────────────────────┐
│ ← Back to song            (link, amber)          │
│                                                  │
│ ┌─ Controls bar (bg-cem-surface, bordered) ─────┐ │
│ │ Key [−]  A  [+] reset    BPM [−] 96 [+] reset │ │
│ │                          (…+2 semitones from  │ │
│ │                           original — ml-auto) │ │
│ └────────────────────────────────────────────────┘ │
│                                                  │
│ CHART CARD (ChordProRenderer, transposed)         │
└──────────────────────────────────────────────────┘
```

**Zone map:**

| Zone | Content |
|------|---------|
| Back link | `← Back to song`, amber, top-left |
| Controls bar | `mt-3`, `rounded-lg border border-cem-elevated bg-cem-surface px-4 py-3`, `flex flex-wrap gap-4`. Key stepper: caption `Key` · `−` button · display (bold amber, `min-w-[3rem]` centered) · `+` button · `reset` link (only while transposed). Tempo stepper (only when `song.bpm`): caption `BPM` · `−` · display · `+` · `reset`. Offset note (`+2 semitones from original`, `text-xs`, `ml-auto`) right-aligned while transposed |
| Chart body | `mt-4` — same `ChordProRenderer` card as §3.3, fed the transposed parse |

**Layout rules**

- Content column capped at `max-w-3xl` (wider than Song Detail — practice is the reading surface), centered.
- Stepper controls stay paired (label–buttons–value); the bar wraps below `md`.
- Transpose/tempo offsets never render as the original key/BPM — the display is always the *current* value; `reset` appears only when an offset is applied (ux-spec copy: toast `+2 semitones · Now in A` on transpose, §2).

**Empty/loading states**

- **Loading:** `Loading…` text (stub).
- **Not found:** rose banner + `← Back to repertoire`.
- **No chart:** `This song has no chord chart yet.` + `← Edit song` link — a minimal inline state, not the EmptyState anatomy (kept small because the route is only reachable from a song with a chart).
- Per ux-spec §5, this surface is the ancestor of Stage Mode — no mascot, no celebration here, ever.

---

### 3.5 Setlists — `/setlists`

**Purpose:** List, create, duplicate, and delete setlists.

```
┌──────────────────────────────────────────────────┐
│ Setlists (h1)                        [New Setlist]│  header row
│ (inline create form: [name input] [Create][Cancel])│
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Friday Gig    3 songs · ~12m                 │ │
│ │ Song A · Song B · Song C        [Duplicate]  │ │
│ │                                  [Delete]    │ │
│ ├──────────────────────────────────────────────┤ │
│ │ Next row…                                    │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Zone map:**

| Zone | Content |
|------|---------|
| Header row | H1 `Setlists` (left) · `New Setlist` solid amber button (right), hidden while form open |
| Create form | Inline under header (`mt-4`, `flex gap-2`): name input `max-w-sm` (`Setlist name (e.g. Friday Gig)`), `Create` (amber, disabled while busy/empty), `Cancel` (bordered) |
| List | Same container recipe as §3.2: `divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm`, `mt-4` |

**Item anatomy (row, `px-4 py-3`, `flex justify-between gap-4`):**

- **Left column** (`min-w-0`):
  1. Name — `Link` to `/setlists/:id`, `text-sm font-medium`, hover = amber; inline meta span next to it (`text-xs text-cem-secondary`): `{n} songs · {durationLabel}`
  2. Preview line — `mt-0.5 truncate text-xs text-cem-secondary`, song titles joined with `·`, only when the setlist has songs
- **Right column** (`shrink-0 gap-3`, `text-xs` links): `Duplicate` (amber) · `Delete` (rose, rightmost)

**Layout rules**

- Full 7xl column; rows behave like §3.2 (wrap internally, action column never wraps).
- Error banner (rose) renders above the list, below the form, when a mutation fails.

**Empty/loading states**

- **Loading:** `Loading setlists…` text (stub; skeleton target per ux-spec §3).
- **No setlists** — WHERE: list region after load. Copy target (ux-spec §2): heading `No setlists yet`, body `Build one for your next gig or rehearsal`, CTA `Build a Setlist`, EmptyState anatomy (design-system §7). Today: `No setlists yet. Create your first one above.` (stub).

---

### 3.6 Setlist Detail — `/setlists/:id`

**Purpose:** View and edit one setlist: order, members, add/remove songs, rename.

```
┌──────────────────────────────────────────────────┐
│ ← Back to setlists            (link, amber)      │
│                                                  │
│ Friday Gig (h1, inline-renamable)     [Rename]    │
│ Estimated duration: 12:30 · 3 songs               │
│                                                  │
│ [Add Song]  (amber, toggles picker)              │
│ ┌─ picker panel (open state) ──────────────────┐ │
│ │ "Add from repertoire" (h2, caption)          │ │
│ │ Song X · C            [Add]                 │ │
│ │ Song Y (draft — chart incomplete)  [Add]    │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ order list ─────────────────────────────────┐ │
│ │ 1. Song A · C · 3:05   [↑ top][↑][↓] Remove │ │
│ │ 2. Song B · G · 4:10   [↑ top][↑][↓] Remove │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Zone map:**

| Zone | Content |
|------|---------|
| Back link | `← Back to setlists`, amber, top-left |
| Header row | `mt-3`, `flex justify-between gap-4`: h1 name (or inline rename form: name input + `Save` + `Cancel`, editting state) · `Rename` bordered button (hidden while renaming). Meta line `mt-2 text-sm text-cem-secondary`: `Estimated duration: {durationLabel} · {n} songs` (or `Unknown durations · {n} songs`) |
| Add entry | `Add Song` amber button `mt-4`, toggles the picker (`Hide picker` while open) |
| Picker panel | Open state only: card (`rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-sm`), `Add from repertoire` heading, rows of available songs (`divide-y divide-cem-elevated`): title (`text-sm font-medium`) + key (`text-xs secondary`) + draft note `(draft — chart incomplete)` (`text-cem-amber`) · `Add` bordered button right. Empty picker state: `No more songs in your repertoire.` |
| Order list | `ol` container recipe as §3.2/§3.5, `mt-4`, one row per item in setlist order |

**Item anatomy (order row, `px-4 py-3`, `flex justify-between`):**

- **Left column** (`flex items-center gap-3`): index number (`w-5 text-right text-xs text-cem-secondary`) · title (`text-sm font-medium`) + inline meta (`text-xs secondary`): `key · duration`, only when the song resolves (missing → `(missing song)`)
- **Right column** (`shrink-0 flex items-center gap-2`), in order: `↑ top` and `↑` (bordered `text-xs`, disabled at index 0) · `↓` (disabled at last index) · `Remove` (`text-cem-rose`, `ml-1`)

**Layout rules**

- Content column capped at `max-w-2xl`, centered.
- Reorder affordance is **per-row button cluster**, not drag-and-drop (Hito 1). The cluster is 4 controls wide — it stays right-aligned and does not wrap.
- Not-found state: rose banner + `← Back to setlists`.

**Empty/loading states**

- **Loading:** `Loading setlist…` text (stub).
- **Not found:** `Setlist not found.` rose banner.
- **Empty setlist** — WHERE: order-list region when `itemIds` is empty. Copy is a plain line today: `No songs in this setlist yet. Add one above.` (Kutu-free maintenance state; EmptyState anatomy optional here — the `Add Song` button above already carries the CTA).

---

### 3.7 Auth — `/auth`

**Purpose:** Sign in / create account. Two modes on one screen, toggled below the card.

```
┌──────────────────────────────────────────────────┐
│                  Sign In (h1, centered column)    │
│                  Welcome back — sign in to        │
│                  continue. (body-sm, centered)    │
│                                                  │
│  ┌─────────────── form card ───────────────────┐ │
│  │ (form error banner — rose, role=alert)      │ │
│  │ [First name] [Last name]   (sign-up only,   │ │
│  │                             2-col grid)     │ │
│  │ [Display name]             (sign-up only)   │ │
│  │ [Email]                                    │ │
│  │ [Password]                                 │ │
│  │ [Confirm password]         (sign-up only)   │ │
│  │ inline field error text below each invalid  │ │
│  │ [          Sign In / Create Account       ] │ │
│  │   (w-full amber button)                     │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│            New to CEMURM? Create an account       │
│            (centered, amber toggle link)          │
└──────────────────────────────────────────────────┘
```

**Zone map:**

| Zone | Content |
|------|---------|
| Heading | H1 `Sign In` / `Create Account`; subtitle `body-sm text-cem-secondary` (`Welcome back — sign in to continue.` / `Join CEMURM to manage your repertoire and setlists.`) |
| Form card | `mt-6 rounded-lg bg-cem-surface p-6 shadow`, `space-y-4`. Sign-up adds, in order: first/last name 2-col grid → display name → email → password → confirm password. Sign-in: email → password. Labels above inputs; inline `text-xs text-cem-rose` error text under invalid fields; `aria-invalid` on error (ux-spec §6) |
| Submit | `w-full bg-cem-amber` primary; busy state swaps label (`Signing in…` / `Creating account…`), disabled |
| Toggle | `mt-4 text-center text-sm`: `New to CEMURM? Create an account` / `Already have an account? Sign in` — amber link, switches mode and clears errors |

**Layout rules**

- Column capped at `max-w-md`, centered — the narrowest content column in the app; the card is the only bordered surface on this screen.
- Fields stack vertically (labels above inputs, `space-y-4`); the sign-up first/last row is a fixed 2-col grid at all widths today (collapse-to-1-col below a narrow breakpoint is an open item, §5).
- Form error (`role="alert"`) renders at the top of the card, above the fields.
- Route behavior: `RedirectIfAuthed` bounces signed-in users off this screen; successful submit navigates to `state.from` (default `/`).

**Empty/loading states**

- Not applicable (no data list). Submit failure = form-error banner, not an empty state.
- Auth-guard loading (`RequireAuth`/`RedirectIfAuthed`) renders **nothing** while the session resolves (ux-spec §3 full-screen spinner target — today blank; open item §5).

---

### 3.8 Not Found — `*`

**Purpose:** Catch-all for unknown routes.

```
┌──────────────────────────────────────┐
│  404 (h1)                            │
│  Page not found. (body, secondary)   │
└──────────────────────────────────────┘
```

**Layout rules:** Minimal stacked block, left-aligned in the shell content column. No back link, no search, no actions. Renders inside the shell with the standard header/footer.

**Empty/loading states:** None.

---

## 4. Shared Layout Rules

**Component inventory (what actually exists in `src/components/`):**

| Component | File | Layout role |
|-----------|------|-------------|
| `AppLayout` | `components/layout/AppLayout.jsx` | §2 shell — header, main, footer |
| `AuthGuards` | `components/auth/AuthGuards.jsx` | Route-level redirects; renders children untouched |
| `ChordProRenderer` | `components/notation/ChordProRenderer.jsx` | The chart card body in §3.3 and §3.4 |
| `SongForm` | `components/songs/SongForm.jsx` | Inline add/edit card in §3.2 |

- `StatusBadge` is duplicated inline in `Songs.jsx` and `SongDetail.jsx` — not yet a shared component. Wireframes treat it as a caption pill (emerald/amber/elevated), not a layout element.
- Primitive components that design-system.md/ux-spec.md define but **the code has not extracted yet**: `Button`, `Card`, `Modal`, `Toast`, `EmptyState`, `Skeleton`. Screens use inline markup today; their arrangement is what this doc specifies, and their behavior lives in ux-spec.md §3 (Modal ≤480px, Toast ≤3, EmptyState trigger after load completes).

**Action-button placement convention**

- **Page-level primary CTA**: top-right of the screen's header row (Add Song, New Setlist, Setlist-Detail Add Song). Solid `bg-cem-amber`. Not sticky at any breakpoint today (sticky behavior is an open item, §5).
- **Secondary actions** (Edit chart, Retire, Rename, Duplicate, Add-row): bordered (`border-cem-elevated`) or text links, amber/secondary text.
- **Destructive actions** (Delete, Remove): always `text-cem-rose`; always the rightmost item in their cluster; never rendered in the primary amber style. Confirmation today is `window.confirm`; the ux-spec §3 Modal (max 480px, sticky footer, explicit confirm) is the target once `Modal` exists.
- **Contextual/entry actions**: emerald-bordered for "actionable positive" entry points (Practice, Reactivate).

**List containers (repertoire, setlists, setlist order, picker):** `rounded-lg border border-cem-elevated bg-cem-surface shadow-sm` + `divide-y divide-cem-elevated`; rows `px-4 py-3`; a `shrink-0` right action column; title links `text-sm font-medium` with amber hover. One container per screen — no nested card grids.

**Touch targets (ux-spec §6):** ≥44×44px on mobile. Rows provide the vertical zone (`py-3` plus content height); compact text/bordered actions inside them reach it only approximately today — flagged, not resolved (§5).

---

## 5. Not Specified

Deliberately open — wireframe level only, and anything that belongs to the other two docs:

- **Pixel-perfect grids and exact breakpoint tokens** beyond the `md` (768px) stack point; a designer pass owns this.
- **Sticky/fixed action bars** on mobile (whether the page CTA or a bottom bar pins while scrolling) — not implemented today; ux-spec.md §3 behavior (toasts/modal layering) will constrain whichever choice lands.
- **Touch hit-area expansion** mechanics for the compact row actions (padding-only vs. invisible hit-box) — pending the 44px touch audit.
- **Responsive nav collapse** (hamburger / drawer) if labels ever stop fitting the header row.
- **Auth sign-up name grid**: fixed 2-col today; stacking below a narrow breakpoint is a candidate, not a decision.
- **EmptyState component extraction**: all empty/loading states are specified by copy (ux-spec §2) and anatomy (design-system §7) but implemented as plain text today; their final zones move with the component.
- **Animation/transitions** — owned by ux-spec.md; this doc only fixes the resting layout.
- **Future-routes layout** (dashboard components on `/`, Stage Mode, onboarding, collections, profiles) — out of scope until those routes exist in `src/App.jsx`.

---

## 6. Pantallas de la ampliación institucional — especificación, no implementación

> **Status: proposed. None of these routes exist.** This section is a wireframe-level specification written so that BDD and layout can be argued about before a migration is written. It follows the same recipe as §3 and refers to the same shared rules in §4.
>
> **Change:** `openspec/changes/ampliar-alcance-institucional` · **Data model:** `docs/database-schema-ampliacion.md`
>
> **Two corrections to this document's own header, because they are load-bearing here.** §1 names `src/App.jsx` as the source of truth for routes; that file **no longer exists** (post-relocation, the router is `src/app/router.jsx`, `AGENTS.md`). And §3 specifies **8 screens against 26 live routes** — this section does not fix that gap, and neither does pretending §6 is current. What §6 does is add the routes the amplification needs on top of both.

**Conventions carried from §4 unchanged:** one container per screen, never a nested card grid; primary CTA top-right of the header row in `bg-cem-amber`; destructive actions `text-cem-rose` and always rightmost; rows `px-4 py-3` with `divide-y divide-cem-elevated`.

### 6.0 The five families and their dependencies

| Family | Routes | Actor | Depends on |
|---|---|---|---|
| **C1 Identidad** | `/organization/members` · `/settings/accounts` | org_owner, org_admin · system_admin | — (unblocks everything) |
| **C2 Formación** | `/education` · `/education/courses/:id` · `/education/work` · `/education/progress` | instructor · student | C1 |
| **C3 Eventos** | `/events` · `/events/:id` | organizer · member | C1 |
| **C4 Inventario** | `/inventory` · `/inventory/:id` · `/inventory/loans` · `/inventory/types` | org_admin · member | C1 |
| **C5 Analítica** | `/analytics` | org_admin, instructor | C2, C3 |

**C1 goes first and this is not a preference.** `org_memberships` is `grant select` only today (`0016:552`); C2's enrollment, C3's event participant lists and C4's asset ownership all need to *read* a roster that today can only be produced by SQL. A `/education` screen with an empty roster is not a smaller task, it is a blocked one.

---

### 6.1 Members — `/organization/members`

**Purpose:** List an organization's members, invite, change role, and deactivate. This is the screen that today has no backend at all.

```
┌──────────────────────────────────────────────────────────┐
│ Members (h1)                         [Add member]        │  header row
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Ana Reyes   guitar     Branch: Centro              │ │
│ │ active                    [Change role] [Remove]    │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Luis Prado  piano      All branches  (former)      │ │
│ │                                        [Reactivate]  │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Zone map:**

| Zone | Content |
|---|---|
| Header row | H1 `Members` (left) · `Add member` solid amber (right), hidden while form open |
| Add-member form | Inline under header (`mt-4`, `flex gap-2`): user email, branch select, role select, `Invite` (amber, disabled while busy), `Cancel` (bordered) |
| List | §4 list container, `mt-4` |

**Item anatomy** — mirrors §3.5's setlist row exactly: name link `text-sm font-medium`, `instrument` as a `text-xs text-cem-secondary` meta span, `branch` as a second meta span, `status` as a `StatusBadge` caption pill (emerald `active`, elevated `former`). Right column `shrink-0 gap-3 text-xs`: `Change role` (amber link) · `Remove` (rose, rightmost).

**Layout rules**

- **A `former` member renders read-only.** No role change, no remove — only `Reactivate`, emerald-bordered per §4's contextual-action convention. This is not styling: `org_remove_member` sets `status = 'former'` and the RPC refuses a second call, so the button would be a lie if it rendered enabled.
- **Self-removal is not rendered at all.** `org_remove_member` and `org_set_member_role` both raise on the actor targeting themselves (the SOD guard). A control that always fails is worse than an absent one.
- **Remove confirms.** `window.confirm` today, the ux-spec §3 Modal as the target — same as §4's destructive-actions rule.

**Empty/loading states** — `Loading members…`; empty: heading `No members yet`, body `Add someone to start building the roster`, CTA `Add member`.

---

### 6.2 Account status — `/settings/accounts`

**Purpose:** System-admin-only view of every account and its lifecycle status. **This is a different screen from Members on purpose**: membership is per-organization and delegated; account status is platform-wide and not.

```
┌──────────────────────────────────────────────────────────┐
│ Accounts (h1)                                            │  header row
│ [status filter: all ▾]                                   │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Ana Reyes   ana@…   joined 2026-08-14   [suspended]  │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Luis Prado  luis@…  joined 2026-07-02   [deactivated]│ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Zone map:**

| Zone | Content |
|---|---|
| Header row | H1 `Accounts` only — **no primary CTA.** Creating an account needs a server-side admin call, which is Hito 7's first Edge Function; until it exists there is no honest button to draw |
| Filter row | Status filter select (`all` / `active` / `suspended` / `deactivated`), `mt-4` |
| List | §4 list container |

**Item anatomy** — email link (left, `truncate`), `joined` date as `text-xs text-cem-secondary` (this is why `profiles.created_at` is in the migration), status `StatusBadge`, right column `Suspend` / `Reactivate` / `Deactivate` (text links, rose for the destructive one).

**Layout rules**

- **The actor's own row renders without action buttons**, for the same reason §6.1's does: `set_account_status` raises when `p_user_id = auth.uid()`.
- `joined` is always shown, even when empty — it is the reason this screen exists separate from Members, and hiding it removes the only thing that distinguishes a person who has been here since March from one added yesterday.

---

### 6.3 Learning path — `/education`

**Purpose:** The student's courses and, within each, the ordered exercises with their state. **This is the four-state surface the 46 existing BDD scenarios already describe**: `Pending`, `In progress`, `Locked`, `Completed`.

```
┌──────────────────────────────────────────────────────────┐
│ Guitar Fundamentals                     [Add exercise]  │  header row
│ guitar · Branch: Centro                                 │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 1  Verse of Canción Z              [ Completed ]    │ │
│ │    finished 12 Oct                                 │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ 2  Chorus of Canción Z            [ In progress ]   │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ 3  Bridge of Canción Cambio        [ Locked ]       │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Zone map:**

| Zone | Content |
|---|---|
| Header row | Course title (h1) + `instrument · branch` meta line · `Add exercise` (amber, **instructor only** — a student never sees it, and the row is not rendered for them rather than disabled) |
| Exercise list | §4 list container. Rows are **not** clickable when `Locked` |

**Item anatomy** — position number (`text-xs text-cem-secondary`, fixed-width so the list aligns), title, status pill right-aligned. Below the title and only when `Completed`: `finished {date}`, `text-xs text-cem-secondary`.

**Layout rules — the four states are color, and color alone is not enough**

R10 of the education audit is a hard CI failure waiting to happen: the visual gate's rule 04 enforces a closed 17-leaf palette and `cem.emerald` and `cem.rose` are on rule 02's retirement list. **A "locked" row in rose and a "completed" row in emerald is not available**, so this specification encodes the states as **ramp step + amber + weight + icon**, which is what the audit's R10 prescribes:

| State | Token | Weight | Icon |
|---|---|---|---|
| `Completed` | ramp step (not emerald) | medium | check |
| `In progress` | **amber** | medium | — |
| `Locked` | ramp step (not rose) | normal | lock |
| `Pending` | elevated | normal | — |

Amber means exactly one thing here — *this is where you are now* — which is the single use Hard Rule 2 licenses it for.

**Empty/loading states** — `Loading your courses…`; empty: heading `No courses yet`, body `You are not enrolled in any course`, and **no CTA** — enrolment is a precondition set by an admin (`education-bdd.md` treats it as `Given Lucia is enrolled in …`, not a designed flow). Drawing a `Join course` button would invent a flow the BDD explicitly declines to specify.

---

### 6.4 Course detail — `/education/courses/:id`

**Purpose:** Authoring surface. Reorder exercises, add one aimed at a real song section, publish the course.

```
┌──────────────────────────────────────────────────────────┐
│ Guitar Fundamentals                        [Publish]     │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 1  Verse of Canción Z              [song · section]  │ │
│ │                                  [↑] [↓] [Remove]    │ │
│ └──────────────────────────────────────────────────────┘ │
│ [Add exercise]                                           │
└──────────────────────────────────────────────────────────┘
```

**Zone map:** header row with H1 and `Publish` (amber, **only while `status = 'draft'`**); exercise list as §6.3 but each row gains an action cluster (`↑` `↓` bordered, `Remove` rose rightmost); an `Add exercise` form that opens inline.

**Layout rules**

- Reorder is `↑`/`↓` buttons, **not drag-and-drop**. §3.5's setlist uses an order control but this one has a semantic difference: `position` is `unique (course_id, position)` in the schema, so a swap writes two rows atomically. Drag would imply the UI holds the order, and it doesn't.
- `Publish` is absent on a published course rather than disabled — a published course's `position` values are referenced by `education_progress`, and reordering after publication is a different decision this screen does not make.
- The exercise form's song field opens the existing repertoire search (`§3.2`), and picking a song reveals a **section picker derived from that song's current chart**. That is R9's honest surface: the anchor is name-keyed, so a renamed section orphans it — the form must show the section name it stored, and the exercise keeps pointing at the same section when the chart changes.

---

### 6.5 Assigned work — `/education/work`

**Purpose:** What an instructor handed out, and who finished. **The negative assertion is the design**: an instructor sees *which exercises a student completed and when* — and not practice sessions, durations, streak, XP, daily goal, or the student's private notes. Two existing scenarios assert exactly that, so the screen must not offer a place for those values even if the backend later returns them.

```
┌──────────────────────────────────────────────────────────┐
│ Assigned work                             [Assign work]  │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Lucia Moreau    4 of 6 completed    last: 11 Oct     │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Sofia Reyes     2 of 6 completed    last: 09 Oct     │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Layout rules**

- The row shows a **count and a date. Nothing else.** No score, no notes, no attempts column — those exist in `education_progress` and are reachable through `notes` if the grant ever opens them (D8), but the screen is specified so that adding a column is a visible decision rather than an accident.
- `Assign work` opens a student picker, and the picker lists **only enrolled students** of that course. R4 of the audit: `profiles_select_search` excludes minors (`0017:161-163`), so a teacher roster query returns zero rows for every minor student. **Until minor consent is designed (D1), this picker is incomplete and the screen must not imply otherwise** — the empty state names the reason rather than saying "no students".

---

### 6.6 Events — `/events` and `/events/:id`

**Purpose:** List events and, within one, its participating organizations, its setlists, and per-member attendance. **Zero migration** — the tables, RLS and grants already exist; this is the screen that was never built.

```
┌──────────────────────────────────────────────────────────┐
│ Viernes de Comunidad                        [New event] │
│ sequence-only · 12 Nov · 3 organizations                │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Attendance        yes 18   no 4   undecided 3       │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Setlists          (n) — read-only after the event   │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Zone map:** header row with H1, `type · date · organizations` meta line; **attendance band** (three counts, not a chart — see below); setlist list reusing §3.5's container.

**Layout rules**

- **Attendance is three numbers, not a breakdown.** `event_rsvps` carries `undecided | yes | no` and the schema's own comment records the rule: reminders target `yes` + `undecided`, **never an explicit `no`** (`0001:260`). A chart that visually ranked or colored a `no` would contradict a decision already made in the schema. Render the three counts with equal weight and let `undecided` be the actionable one.
- **After the event, setlists are read-only for everyone.** D3 was resolved as *event-owned, read-only for all participants* (`database-schema-v2.md` §D3, resolution of 2026-09-01). No participant gets an edit affordance, not because the UI hides one, but because no policy permits it.
- The event's own `type` cannot be drawn yet: `0001:243` marks it *"NOT SETTLED BY THE FEATURES"* and the enum holds collaboration types rather than event kinds. **The meta line is specified with a placeholder** until D3 lands; it is not a decision this wireframe can make.

---

### 6.7 Inventory — `/inventory`, `/inventory/:id`, `/inventory/loans`

**Purpose:** Register physical assets, lend them, and see who has what.

```
┌──────────────────────────────────────────────────────────┐
│ Inventory                        [Add asset] [Types]     │
│ [status filter: all ▾] [branch: all ▾]                  │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Mesa de sonido XLR   audio      Branch: Lima         │ │
│ │ SN-0042                       [available] [Lend]     │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Bajo eléctrico         instrument  Branch: Lima      │ │
│ │ SN-0007                    [loaned → Luis, due 20]   │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Item anatomy** — label link, `serial` as `text-xs text-cem-secondary` (never the primary identifier — a serial is not unique across an org, and `assets_org_label_unique` is on `label`), status pill, and for a `loaned` asset the holder and due date in place of the action buttons.

**Layout rules**

- **`Lend` is absent on an asset that is not `available`.** The `asset_loans_one_open_per_asset` partial unique index already guarantees one open loan; rendering the button would invite a write that the database rejects.
- **The loans screen (`/inventory/loans`) is the only place `condition_out`/`condition_in` are entered**, and they are two separate fields in two separate moments. A single "condition" field would make "it was already broken" unrepresentable, which is the one thing worth representing.
- **The `Types` screen is admin-only.** `asset_types.specs_schema` drives the add-asset form's technical fields; letting any member edit it means the form's required fields change under them.
- **Branch scope is decided by data, not by this spec.** If inventory turns out to be org-wide rather than per-branch, the branch filter disappears and `assets.branch_id` goes NULL — the schema supports both and the wireframe cannot choose. Flagged in `database-schema-ampliacion.md` §6.2.

---

### 6.8 Analytics — `/analytics`

**Purpose:** Reporting **per module**, which is the actual requirement (#2). The existing `analytics-and-insights.feature` is *personal* repertoire analytics and is a different screen; this one reports on an organization.

```
┌──────────────────────────────────────────────────────────┐
│ Analytics                          [module: All ▾] [⤓]    │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Repertoire    184 songs · 12 added this month        │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Events         6 this quarter · 3 upcoming          │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Formation     4 courses · 22 students enrolled      │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Zone map:** header row with H1, module filter, and an export button (`⤓`); one band per module, each a row with a headline figure and a `text-xs text-cem-secondary` detail line.

**Layout rules**

- **Rows, not charts.** The one place this document would have reached for a chart is exactly the place it must not: R11 of the audit notes `api.max_rows = 1000` (`supabase/config.toml:18`), and a ranking over `education_events` truncates silently on page one. A figure with no axis cannot silently truncate into a wrong ranking.
- **Export is in the header, not per module**, because a report that can disagree with its own export is worse than no report.
- The module list is **not enumerated here**: it follows the contexts, and C5's scope is a rewrite of an existing `.feature`. Specifying a fixed module list would freeze a product decision this wireframe does not own.

---

### 6.9 What §6 does not specify

- **Pixel grids and breakpoint tokens** beyond `md` — §5's rule applies unchanged.
- **Every modal, toast and empty-state trigger** — `ux-spec.md` owns behavior; §6 specifies arrangement only, as §3 does.
- **The offline rendering of any of these screens.** Stage Mode has an offline contract (`public/sw.js` + IndexedDB) and none of these have one. `education_progress` is last-write-wins *because* of the offline queue, but a screen that renders offline and a screen that doesn't are different specifications.
- **The `→ organization` nav entry's position.** `CardNav` groups the 13 existing links; where a sixth "organization" group lands is a nav decision, not a wireframe one.

---

*Added 2026-10-13 for `openspec/changes/ampliar-alcance-institucional`. Wireframe level, proposed, unimplemented. Data model in `docs/database-schema-ampliacion.md`; open decisions D1–D9 there gate which of these screens can be built at all.*

*This document is the layout layer between design-system.md (visual) and ux-spec.md (behavior). Update it when routes, components, or screen regions change in `src/`.*