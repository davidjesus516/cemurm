# Proposal: An internal operations console at `/dashboard`

> Change: `add-internal-operations-console`
> Feature: `features/internal-operations-console.feature` (new, 29 scenarios)
> Status: proposed. Scope confirmed by the maintainer: **internal operations
> console**, gated to `system_admin` + `community_moderator`.

## Intent

Give staff work a place of its own. Today `/moderation` is the only staff
surface that is a page; `promote_song` / `demote_song` are system_admin-only
RPCs with **no caller in `src/`**; and submitted feedback has no reader at all.
The console collects them behind one shell with its own navigation, so the
member app keeps the member navigation and staff stop navigating through it.

## Problem

**Three concrete gaps, each verified, not assumed.**

1. **Feedback has no triage surface, by a decision that anticipated this one.**
   `supabase/migrations/0033_feedback.sql` says outright: *"Scope decision:
   SUBMIT-ONLY. The BDD file has no staff/moderator scenarios, so there is no
   client triage surface ... the owner reads them via service_role/SQL console
   or **a future triage surface**."* Its only read policy is
   `feedback_select_self` (`user_id = auth.uid()`), so an administrator reading
   the table today gets **their own rows and nothing else**. The row shape
   already carries `status text not null default 'new' check (status in ('new',
   'triaged', 'closed'))` — **a column with no writer anywhere.**

2. **Repertoire promotion is backend-complete and client-invisible.**
   `0016_org_repertoire_model.sql` gates `promote_song` / `demote_song` on
   `private.session_has_system_role('system_admin')` (`:81`, `:104`), and
   `src/data/repositories/orgRepertoire.js` exports matching
   `promoteSong` / `demoteSong`. Grep finds **no caller**: the capability ships
   and is unreachable.

3. **There is no admin-wide member listing.** `src/data/repositories/profiles.js`
   exports exactly `searchProfiles(query, { excludeUserId })`, `resolveById`,
   `getProfile`. All three are self- or lookup-scoped; none enumerates members.

**And the navigation conflict is real, not cosmetic.** `src/app/AppLayout.jsx`
renders `CardNav` — a floating top bar (~420 lines, `features/design/
components/cardNav.jsx`) whose GSAP timeline opens three link cards plus a user
strip, carrying 13 destinations. A left rail is a **different paradigm**, not a
different skin. Mounting one inside `AppLayout` would leave every signed-in user
with two primary navigations at once.

## Scope

### In scope

- **The console's access model**: `system_admin` and `community_moderator`,
  read through the same `isSystemAdmin` / `isModerator` pair `useModeration`
  already uses, with the system-administrator sections **absent** (not
  disabled) for a moderator — the tiering `0020` already establishes.
- **Its own shell and sidebar** at `/dashboard`, outside `AppLayout`, so
  `CardNav` is untouched.
- **The sidebar's behaviour**: collapse to an icon rail, persisted across
  reload, keyboard toggle, mobile drawer, single active marker, focus return,
  reduced-motion path.
- **The sections**, each traced to a scenario: moderation (re-presenting
  existing data), repertoire promotion (existing RPCs), feedback triage (new
  policy + writer), member directory (new read path), system health.
- `openspec/specs/internal-operations-console/spec.md` — the capability.

### Out of scope

- **Any change to `CardNav` or `AppLayout`.** The member navigation is
  deliberately left exactly as merged in #357. If the console needs a link back
  to the member app, it gets one **inside its own sidebar**, not by editing the
  bar.
- **The template's stack.** React 19, Tailwind 4, `@base-ui/react`,
  `lucide-react`, the `@/` alias and `FullLayout` are all rejected — see
  Approach. No e-commerce, blog, tickets, notes, icons, auth or
  frontend-pages surface from the template is ported; the console has no use
  for them and the entry rule (`docs/engineering-review-backlog.md:5`) does not
  authorize them.
- **Signals/telemetry** (`docs/mvp-scope.md:315`, the privacy-respecting
  Plausible-style dashboard). Different audience, different feature; explicitly
  not this one.
- **`features/analytics-and-insights.feature`.** Its "org admin view" is member-
  and org-facing analytics for `org_admin`, and this console is gated to system
  roles. Adjacent, not the same, and not absorbed here.

## Capabilities

### New capabilities

- `internal-operations-console` — the repository has no
  `openspec/specs/internal-operations-console/` today, so this change creates it.

### Modified capabilities

- None. `0033_feedback.sql`'s RLS is **extended, not redefined**: the
  submit-self and select-self policies stay, and a system-administrator read is
  added beside them.

## Approach

**The template is a behaviour reference, not a source.** Four measurements
decide this, and the first two are already recorded in the repository:

1. **React 19 cannot load here.** `src/features/design/components/listBox.jsx`
   records why: *"a component package that peer-requires React >=19 ... cannot
   load in this repo — React 18.3.1 + Tailwind 3.4.19 — because a React 19 `use`
   import evaluated under React 18 fails at module load ... which is what turned
   three design test files red."* The template pins `react ^19.2.5`.
2. **Tailwind 4 ships a second theme**, which is palette growth — exactly what
   rule 04 of `scripts/check-visual-contract.sh` exists to prevent. The
   template is Tailwind 4 (`@tailwindcss/postcss`, `tw-animate-css`).
3. **The dependency names do not exist here.** The template's `sidebar.tsx`
   imports `@base-ui/react/merge-props`, `@base-ui/react/use-render`,
   `class-variance-authority`, `@/lib/utils`, `@/hooks/use-mobile` and
   `lucide-react`. This repo has none of them — it uses `@hugeicons/react` for
   icons and has no `@/` alias in `vite.config.js` or `tsconfig.json`.
4. **A previous attempt proved the failure mode.** An untracked
   `src/ui/primitives/` (22 files, never committed) was a direct port of these
   components, and it carried **84 lint errors in 22 files and four hard
   crashes**: every component called an **undefined `join()`** helper; `sheet.jsx`
   assigned `RAC.DialogContent` / `RAC.DialogOverlay` / `RAC.DialogClose`, and
   `context-menu.jsx` rendered `<MenuSeparator>` — and a runtime probe of
   `react-aria-components` confirms **none of those four exports exist** (300
   exports, `DialogContent`/`DialogOverlay`/`DialogClose`/`MenuSeparator` all
   absent), so all four were `undefined` in JSX. It also used `ring-cem-ring`
   and `text-cem-sm`, which are **not tokens in `tailwind.config.js`** — Tailwind
   3 silently emits nothing, so keyboard focus had no visible ring.

**What replaces copy-and-paste.** Three dependencies, chosen because they are
compatible with **React 18 and Tailwind 3**: `class-variance-authority`, `clsx`
and `tailwind-merge`. They carry no React peer above 18 and no Tailwind peer, so
none of the four constraints above applies. In plain JS with JSDoc, in
`src/ui/` under the existing post-relocation layout — **JSX, not TSX** (the
template is entirely `.tsx`).

**The helper that was actually missing.** `clsx` + `tailwind-merge` compose into
one exported `cn()` in a new `src/ui/cn.js`, **with its own colocated
`cn.test.js`**. That is the specific hole the dead `join()` left: the attempt
called a function nobody had written, in 22 files, and nothing caught it because
no test existed. Writing the helper first, with a test, is the whole difference.

**One dialect, stated plainly.** `src/features/design/components/` styles with
BEM classes plus `cem-*` tokens (`listBox.jsx`). The console's sidebar uses
`cva` variants plus `cn()`. Both resolve to the **same token layer** in
`tailwind.config.js`, which is what keeps rule 01a and rule 04 green; the
difference is class composition, not colour. This is a second composition
dialect and it is called out here rather than discovered later in review.

**Tier, because the dashboard straddles two.** Per
`skills/cemurm-visual-system/SKILL.md`, the console's chrome (nav, settings,
dialogs, forms) is **Tier 1** and its tables and lists are **Tier 2** —
*"Partial; no material, no decorative shadow."* The template's sidebar violates
both: `group-data-[state=collapsed]:hover:shadow-xl`, the `inset` variant's
`rounded-xl shadow-sm ring-1`, and `rounded-xl` against a radius scale that has
no such step. Each is adapted at apply time rather than pasted — the same
correction the dead `button.jsx` already acknowledged in its own header
(*"rounded-xl becomes rounded-lg: visual-system rule 03"*) without applying it
consistently.

**Route placement is a decision, and it is this one.** `/dashboard` is
registered **inside `RequireAuth` and inside `RequireGuardianConsent`**, as a
sibling of the member routes and **outside `AppLayout`** — no `CardNav`, no
member footer. Inside the guardian guard because a signed-in account without
active consent must not reach a new surface by a fresh URL; the lock is
route-independent by design. This is the one structural choice a reviewer is
most likely to want changed, so it is stated as a choice.

**Slicing, because this is far past 400 lines.** `AGENTS.md` caps a PR at ~400
changed lines and the precedent is chained `-prN-` slices.

| Slice | Contents | Backend |
|---|---|---|
| PR1 | `cn()` + its test, the three dependencies, the access gate, the console shell, the sidebar and its behaviours | none |
| PR2 | Moderation section (re-presents `getModerationQueue` / `getReportedEntries` / `decideCase`) | none |
| PR3 | Repertoire promotion (wires the unreachable `promoteSong` / `demoteSong`) | none |
| PR4 | Feedback triage — **the migration**: system-admin read policy + the `status` writer | `0038_*` |
| PR5 | Member directory — admin-wide read path + its policy | `0039_*` |
| PR6 | System health | none |

**Migration numbering is a constraint, not a choice.** The tree holds `0001`–`0037`
with `0021` and `0022` absent; the high-water mark is `0037`, so PR4 takes
`0038`. Before the name is fixed, every open branch must be checked —
`git branch -r | xargs -I{} git ls-tree --name-only {} -- supabase/migrations/` —
because a number free on `main` is not free for a branch (the same trap that
moved the feedback migration `0020` → `0029` → `0033`). **`AGENTS.md` is stale
here**: it says 33 files and "the next free number is 0034".

**PR1 is the user-visible unblock and the smallest honest first step.** The
sidebar is what was asked for first, and it needs no migration, no policy and no
new data path — so it can land and be reviewed on its own.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/ui/cn.js` | New | `cn()` over `clsx` + `tailwind-merge` — the helper the dead attempt called but never had |
| `src/ui/cn.test.js` | New | colocated; `tailwind-merge` conflict resolution asserted, not just concatenation |
| `src/features/dashboard/pages/Dashboard.jsx` | New | the console shell: sidebar + content outlet |
| `src/features/dashboard/components/Sidebar*.jsx` | New | the sidebar ported to `cva` + `cn()` + `cem-*` tokens |
| `src/features/dashboard/useConsoleRole.js` | New | resolves the staff tier via `isModerator` / `isSystemAdmin` |
| `src/app/router.jsx` | Modified | `/dashboard` registered inside `RequireAuth` + `RequireGuardianConsent`, outside `AppLayout` |
| `src/features/dashboard/**` | New | one directory per section, added by later slices |
| `supabase/migrations/0038_*.sql` | New | feedback triage policy + status writer (PR4) |
| `supabase/migrations/0039_*.sql` | New | member directory read path (PR5) |
| `package.json` | Modified | `class-variance-authority`, `clsx`, `tailwind-merge` — React 18 / Tailwind 3 compatible |
| `openspec/specs/internal-operations-console/spec.md` | New | the capability spec |

## Verification

- `pnpm test && pnpm typecheck && pnpm lint && pnpm build` — the four gates
  `AGENTS.md` names. `pnpm lint` matters more than usual here: the dead attempt's
  84 errors were **entirely** in the ported files, so a green lint is direct
  evidence this port is cleaner than the one it replaces.
- `bash scripts/check-visual-contract.sh` — the sidebar is the first new
  component to touch Tier 1 chrome since `CardNav`, so rule 01a (no raw colour
  literals), rule 04 (no palette growth) and rule 07 must stay green. **Rule 03
  does not cover it**: the sidebar is a product surface, not a projector one.
- `node -e` probes against `react-aria-components` — the four absent exports are
  the specific trap the dead attempt fell into, and a probe is cheaper than
  rediscovering it in the browser.
- **Manual, and this half carries the claim**: collapse, reload, confirm the rail
  is still collapsed; narrow the viewport past the breakpoint and confirm the
  drawer; Escape and confirm focus returns to the toggle; Tab and confirm focus
  does not land behind a closed drawer; set reduced motion and confirm the width
  changes without travel. A unit test can assert a class string; only a browser
  asserts that focus went somewhere visible.
- **Each section is verified by its own slice**, and every [needs backend]
  scenario in the feature file stays **unverified until its migration lands**.
  A section rendered against a policy that filters everything out looks correct
  and reads nothing; that is the failure mode PR4 and PR5 exist to close, and it
  is why they are separate slices with smokes.
- New migrations ship with `scripts/smoke/` files, run the documented way
  (`AGENTS.md`: fresh `supabase db reset` first, single run only, `-v
  ON_ERROR_STOP=1`).

## Rollback

**PR1–PR3 and PR6 revert cleanly** — new files plus one router block, no schema
and no policy touched.

**PR4 and PR5 do not.** A `feedback` row already marked `triaged` loses its
triage record if the read policy and the writer are dropped together. The
pattern that keeps them revertible is the one `fix-offline-tie-break` chose: the
reader is `system_admin`-only, so the blast radius of a revert is staff tooling,
never member data. Revert the client and leave the policy in place if a later
change needs it gone.

**The console is additive throughout.** Nothing member-facing is removed,
renamed or re-gated, so a revert cannot strand a member on a route that no
longer exists.

## Frozen decisions

1. **`CardNav` and `AppLayout` are not modified.** The member bar was rewritten
   in #357 and carries ~420 lines of reviewed timeline, focus and interrupt
   behaviour. The console sits outside it rather than inside it; a left rail and
   a floating top bar are different paradigms, and a signed-in user must not get
   both at once.
2. **The template is a behaviour reference; its stack is rejected.**
   React 19 (fails to load under React 18 — recorded in `listBox.jsx`), Tailwind
   4 (a second theme, rule 04), `@base-ui/react` / `lucide-react` / the `@/`
   alias (not present here), and its `.tsx` sources (this repo is JSX). Only
   `class-variance-authority`, `clsx` and `tailwind-merge` are adopted.
3. **The helper is written and tested before it is used.** The dead attempt's
   22 files all called an undefined `join()`. `src/ui/cn.js` ships **with**
   `cn.test.js` in the same PR, and the test asserts `tailwind-merge` conflict
   resolution rather than string concatenation.
4. **The two staff tiers are not collapsed.** `community_moderator` and
   `system_admin` see different consoles — `0020` already makes escalated cases
   `system_admin`-only and `community-moderation.feature` states that org admins
   get no community moderation powers. A moderator's sections are **absent, and
   a direct URL does not render them**; disabled controls would leak the
   existence and the shape of staff tooling.
5. **`0033`'s submit-only decision is extended, not reversed.** The
   insert-self and select-self policies stay exactly as they are; the triage
   read is **added** and restricted to `system_admin`. A community moderator
   must not read other members' feedback, and the feature file asserts that
   negatively in its own scenario.
6. **The `status` column is honoured, not worked around.** It already exists
   with its three states and no writer; this change supplies the writer rather
   than adding a parallel column.
7. **`analytics-and-insights.feature` is not absorbed.** That capability is
   member- and `org_admin`-facing; this console is staff-facing. Different
   audience, different gate, so different change.
8. **PR1 ships none of the [needs backend] scenarios.** The sidebar needs no
   migration, and shipping it first keeps the first PR inside the 400-line cap
   and reviewable on its own.
