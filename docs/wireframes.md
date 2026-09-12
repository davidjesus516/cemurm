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

*This document is the layout layer between design-system.md (visual) and ux-spec.md (behavior). Update it when routes, components, or screen regions change in `src/`.*