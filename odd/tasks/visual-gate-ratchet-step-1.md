# Visual gate ratchet, step 1 — pay down rules 01b, 02 and 06 until the gate is green

Feature record for backlog item #13 (`docs/engineering-review-backlog.md`).

## Objective

Make `bash scripts/check-visual-contract.sh` pass on `main` by paying measured
debt in all three failing ratchets at once, and lower every ceiling to the number
actually achieved. A gate that is red on arrival gets deleted or bypassed, and this
gate has been red on `main` since `6ee10f0` — which is why `test` and `build` are
`skipped` in CI (finding #11).

## Problem

`main` @ `e849738` fails three rules:

| Rule | Count | Ceiling | Over by |
|---|---|---|---|
| `01b` Tailwind default-palette utilities | 92 | 82 | 10 |
| `02` dead accents `coral`/`emerald`/`rose`/`sky` | 274 | 252 | 22 |
| `06` `text-cem-secondary` on a raised fill | 1 | enforcing (0) | 1 |

Fixing only one rule leaves the gate red, so all three ship in this unit.

### The growth is measured, not assumed

The ceiling was set at `319da53` with 252 occurrences
(`cem-rose 177, cem-emerald 68, cem-sky 7, cem-coral 0`). At `e849738` the same
breakdown is `195 / 72 / 7 / 0`. The +22 accumulated across six commits adding
+1 to +5 each; the most recent, `fa7f20f`, is `+2/-2` — net zero. The ratchet
reported cumulative regrowth correctly and was ignored until it failed.

## Why the order is 02, then 01b, then 06

Recorded in backlog #13. `02` has no token substitute, so it is the real source
migration. `01b` turns out to be mostly a **token bypass**, not a design debt:
86 of its 92 occurrences are in stage/projection surfaces, and the remedy already
exists in `tailwind.config.js`.

## Scope

### T1 — rule 01b: stage/projection surfaces (86 of 92)

`bg-black` resolves to `#000000` and `cem.stage.bg` is `#000000`.
`ring-amber-500` resolves to `#f59e0b` and `cem.amber` is `#f59e0b`.
Both are exact. The `cem.stage.*` namespace exists for precisely this surface.

Mapping, preserving the opacity modifier:

| Before | After | Pixel |
|---|---|---|
| `bg-black` | `bg-cem-stage-bg` | identical (`#000000`) |
| `text-white` | `text-cem-stage-lyric` | **not identical** — `#ffffff` vs `#f8fafc`, ΔR 7/255 |
| `text-white/NN` | `text-cem-stage-lyric/NN` | same alpha, same base delta |
| `bg-white/NN` | `bg-cem-stage-lyric/NN` | same alpha, same base delta |
| `border-white/NN` | `border-cem-stage-lyric/NN` | same alpha, same base delta |
| `ring-amber-500` | `ring-cem-amber` | identical (`#f59e0b`) |

Files: `src/features/stage/pages/StageMode.jsx` (42 lines),
`src/features/stage/components/OverlayView.jsx` (7),
`src/features/stage/components/ExternalDisplayView.jsx` (6),
plus `src/features/projection/pages/Projection.jsx` and
`src/features/projection/components/SlideView.jsx`.

`text-white` → `text-cem-stage-lyric` is the one deliberate deviation: `#f8fafc`
on `#000000` instead of `#ffffff`. It is the project's own off-white and the
change is ≤2.7% on the red channel. Recorded here rather than described as
identical, because it is not.

Do NOT add rounded corners, shadows, backdrop filters or gradients while editing.
`OverlayView.jsx` and `Overlay.jsx` are tier 3b, chrome-free; rule 03 enforces it.

### T2 — rule 02: `features/services` (40 of 274)

`Services.jsx` (10) and `ServiceDetail.jsx` (30). Confirmed by the maintainer as
the scope of this step.

The three accents encode three states: `rose` = error, `emerald` = success,
`sky` = info. The palette is a dark ramp plus ONE amber, so a hue cannot carry
three states. Remedy, following the precedent set in the moderation chain (#275):
**the label carries the meaning, amber marks the one actionable state.**

Concretely, for the recurring shapes in these two files:

- Inline field error, `text-xs text-cem-rose` → the message in `text-cem-text`,
  the field marked with amber (`border-cem-amber` / `ring-cem-amber`) which is
  the actionable state.
- Error alert box, `bg-cem-rose/10 ... text-cem-rose` → `bg-cem-elevated` fill,
  `text-cem-text` sentence, amber left rule or amber label to mark it as an error
  rather than neutral information.
- Success/informational chips, `bg-cem-emerald/10 text-cem-emerald` and
  `bg-cem-sky/10 text-cem-sky` → neutral chip on `bg-cem-elevated` with
  `text-cem-text`, the state carried by the existing label text.

Keep every `role="alert"` / `role="status"` and every `aria-*` attribute. Do not
remove accessibility semantics while removing a colour.

### T3 — rule 06: one occurrence

`src/features/auth/pages/DateOfBirthRequired.jsx:101` pairs `bg-cem-elevated`
with `text-cem-secondary` (4.04:1, under the 4.5:1 floor). It is prose, not a
chip, so the remedy is `text-cem-text` (9.90:1) — the token the gate itself
names for sentences.

### T4 — lower the ceilings to the measured result

In `scripts/check-visual-contract.sh`, set `RATCHET_01B_MAX` and
`RATCHET_02_MAX` to the counts the gate actually prints after T1-T3, and rewrite
the comment above each to state the new measured composition and why it is not
zero. Expected landing zones: `01b` ≈ 4 (the modal scrims), `02` = 234.

The modal scrims (`bg-black/85` on `ReportDialog.jsx`, `SongDetail.jsx`;
`bg-black/50` on `FeedbackForm.jsx`) are deliberately left: there is no scrim
token, and growing the palette to add one is a design decision this unit does not
make. They are named in the ceiling comment instead.

**Never raise a ceiling.** If a number does not come down, report it; do not move
the ceiling to make the gate pass.

## Constraints

- Conventional Commits, no AI attribution.
- JSX, not TSX. Tailwind only.
- No new files in `src/`. No palette growth, no `tailwind.config.js` change.
- A failing gate is fixed at its source. Never weaken a check to go green.
- Docs and code in the same commit.

## Authorized scope

`src/features/stage/pages/StageMode.jsx`,
`src/features/stage/components/OverlayView.jsx`,
`src/features/stage/components/ExternalDisplayView.jsx`,
`src/features/projection/pages/Projection.jsx`,
`src/features/projection/components/SlideView.jsx`,
`src/features/services/pages/Services.jsx`,
`src/features/services/pages/ServiceDetail.jsx`,
`src/features/auth/pages/DateOfBirthRequired.jsx`,
`scripts/check-visual-contract.sh`.

Anything outside that list is out of scope: report it, do not edit it.

## Acceptance criteria

1. `bash scripts/check-visual-contract.sh` exits 0: `visual contract: OK`.
2. `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm build` all exit 0.
3. Type baseline still alive: `npx tsc --noEmit --listFiles | grep -c '<worktree>/src/'` > 1
   (was 60). Grep for this worktree's own directory, not `cemurm/src/`, which
   returns 0 outside a checkout named `cemurm`.
4. Every ceiling equals the count the gate prints, and no ceiling increased.
5. The built CSS resolves each migrated utility to the value recorded in T1.
6. `git diff --stat` stays under 400 changed lines.

## TDD mode

Not applicable and not enabled. There is no unit-test surface for Tailwind class
strings; the verification of record is the visual gate plus the full gate set plus
the CSS comparison in T5. `pnpm test` must stay green regardless.

## Verification

Run in this order, from the worktree root:

```bash
bash scripts/check-visual-contract.sh
pnpm lint
pnpm test
pnpm typecheck
pnpm build
npx tsc --noEmit --listFiles | grep -cE '/visual-ratchet/src/'
```

Then compare the built CSS against the table in T1: for each migrated utility,
the new selector must resolve to the recorded colour, and the old selector must no
longer be emitted unless it still has an unmigrated site.

## Progress

Worked in `cemurm-worktrees/visual-ratchet`, a detached worktree at `e849738`
(`origin/main`) with its own real `node_modules` — vite 6.4.3 / vitest 5.0.2,
`node_modules` verified a real directory and not a symlink.

- [x] T1 stage/projection token migration — 87 occurrences remapped across
      `StageMode.jsx` (67), `OverlayView.jsx` (10), `ExternalDisplayView.jsx`
      (8), `SlideView.jsx` (1) and `Projection.jsx` (1). Colours only: no
      radius, shadow, backdrop filter or gradient added anywhere, so rule 03
      and the tier-3b chrome-free rule are untouched by construction.
- [x] T2 `features/services` dead-accent migration — 40 occurrences
      (`Services.jsx` 10, `ServiceDetail.jsx` 30), following the `fa7f20f`
      precedent. Every `role="alert"` / `role="status"` / `aria-*` kept; none
      added, none removed.
- [x] T3 rule 06 single occurrence — `DateOfBirthRequired.jsx:101` prose box
      `text-cem-secondary` → `text-cem-text`.
- [x] T4 ceilings lowered to measured counts — `RATCHET_01B_MAX` 82 → 5,
      `RATCHET_02_MAX` 252 → 234. Neither raised.
- [x] T5 full verification recorded below

### Measured counts

| Rule | Before | After | Ceiling now |
|---|---|---|---|
| `01b` default-palette utilities | 92 | **5** | 5 |
| `02` dead accents | 274 | **234** | 234 |
| `06` secondary on raised fill | 1 | **0** | enforcing |

Rule 06 is `enforcing`, so reaching 0 turns the rule green outright rather than
lowering a number.

`01b` residual, all of it outside the migrated surface:

| Site | Utility | Why it stays |
|---|---|---|
| `ReportDialog.jsx:48`, `:70` | `bg-black/85` | modal scrim, tier-1 surface, no scrim token |
| `SongDetail.jsx:1098` | `bg-black/85` | same |
| `FeedbackForm.jsx:226` | `bg-black/50` | same |
| `StageMode.jsx:663` | `text-red-400` | foot-pedal error; no token is `#f87171` |

`StageMode.jsx` also carries its own modal scrim (`bg-black/85`, the finish-gig
dialog). **That one was migrated** to `bg-cem-stage-bg/85`: `cem.stage.bg` is
already `#000000`, so it is pixel-identical and stays on the palette tier 3a is
allowed to use. The four above are blocked on a *missing token in the `cem`
namespace*, not on the value — which is why they stayed. The record's T4 named
only four scrims in three files; the landing zone of ~4 holds only because this
fifth one was token-mappable.

### T1 rendering proof — built CSS, before vs after

Captured from `dist/assets/index-*.css` on both sides. Alpha bytes are identical
in every row; the only difference is the base colour of the off-whites, which is
the deviation T1 already documented and is **not** described as identical.

| Utility | before | after | |
|---|---|---|---|
| `bg-black` | `rgb(0 0 0 / var(--tw-bg-opacity, 1))` | `bg-cem-stage-bg` → `rgb(0 0 0 / var(--tw-bg-opacity, 1))` | identical |
| `bg-black/85` | `#000000d9` | `bg-cem-stage-bg/85` → `#000000d9` | identical |
| `ring-amber-500` | `rgb(245 158 11 / var(--tw-ring-opacity, 1))` | `ring-cem-amber` → `rgb(245 158 11 / var(--tw-ring-opacity, 1))` | identical |
| `text-white` | `rgb(255 255 255 / …)` | `text-cem-stage-lyric` → `rgb(248 250 252 / …)` | **not identical** (ΔR 7/255) |
| `text-white/40` | `#fff6` | `#f8fafc66` | same alpha |
| `text-white/50` | `#ffffff80` | `#f8fafc80` | same alpha |
| `text-white/60` | `#fff9` | `#f8fafc99` | same alpha |
| `text-white/70` | `#ffffffb3` | `#f8fafcb3` | same alpha |
| `text-white/80` | `#fffc` | `#f8fafccc` | same alpha |
| `bg-white/10` | `#ffffff1a` | `#f8fafc1a` | same alpha |
| `bg-white/30` | `#ffffff4d` | `#f8fafc4d` | same alpha |
| `border-white/10` | `#ffffff1a` | `#f8fafc1a` | same alpha |
| `border-white/20` | `#fff3` | `#f8fafc33` | same alpha |

Old selectors are no longer emitted at all — `.bg-black`, `.text-white`,
`.text-white/{40,50,60,70,80}`, `.bg-white/{10,30}`,
`.border-white/{10,20}` and `.focus\:ring-amber-500:focus` each return **0**
matches in the built CSS. The only `bg-black/*` rules that survive are
`bg-black/50` and `bg-black/85`, which have their own unmigrated sites.

CSS bundle 32,303 B → 32,172 B (−131 B).

### T2 decisions worth recording

- `SERVICE_STATUS_STYLES`: all three statuses are now the same neutral chip. The
  badge renders the status verbatim, so the label carries it. The three keys are
  kept because `ServiceStatusBadge` looks a status up by name and falls back to
  `draft`; the fallback now names the constant directly.
- `WARNING_DOT` collapsed from a 4-entry kind→hue map to one amber constant.
  All four `validate_service_plan` kinds are things the leader must act on, and
  the message beside the dot renders the kind verbatim.
- Substitution status chips: `open` and `pending` keep amber (the states still
  awaiting action); `covered` / `closed` / `accepted` / `declined` became the
  neutral chip. Status vocabularies were checked against the schema, not
  assumed — `substitution_requests.status` is `'open' | 'covered' | 'closed'`
  (`0001_init.sql:361`), `substitution_responses.status` is
  `'pending' | 'accepted' | 'declined'` (`0023_substitutions.sql:34`).
- Destructive labels (`dangerBtn` "Delete", the "Remove" link) took
  `text-cem-amber`. They are otherwise identical to `miniBtnClass` — same
  border, same padding — so neutralising them would have made Delete
  indistinguishable from Edit.
- Error boxes took `border-l-2 border-cem-amber bg-cem-elevated` with a
  `text-cem-text` sentence: an amber left rule so the box reads as an error
  rather than neutral information. Inline `text-xs` error lines became
  `text-cem-text` per the T2 table.
- **No ARIA was added.** The rule was "do not remove semantics", not "invent
  some": several of these async error boxes arguably want `role="alert"` and did
  not have it before this unit either. That is a separate improvement, recorded
  here rather than smuggled into a colour migration.

### Verification — observed in this worktree

| Command | Result |
|---|---|
| `bash scripts/check-visual-contract.sh` | **exit 0** — `visual contract: OK  (10 rules checked, 0 failing)` |
| `pnpm lint` | **exit 0** — no output |
| `pnpm test` | **exit 0** — 9 files, 307/307 passed, 322 ms |
| `pnpm typecheck` | **exit 0** — no output |
| `pnpm build` | **exit 0** — built in 2.31 s; >500 kB chunk warning pre-existed |
| `npx tsc --noEmit --listFiles \| grep -cE '/visual-ratchet/src/'` | **60** — baseline alive, unchanged from `main` |

Grepping `cemurm/src/` in this worktree returns **0** and that is the known
trap, not a dead baseline: the checkout is not named `cemurm`. Use the worktree's
own directory name.

`git diff --stat`: 9 files, 143 insertions, 112 deletions — **255 changed
lines**, under the 400 ceiling. Reconciled against `git diff --numstat` after an
independent recount; an earlier draft of this line said 142/254.

### Out of scope, found and not touched

- `features/services/pages/SubstitutionAssignment.jsx:104` still holds 2
  `cem-rose`. It is in `features/services` but is not one of the two files T2
  scoped, and it is not in the authorized list.
- `DateOfBirthRequired.jsx` still holds 8 dead-accent occurrences (lines 26,
  110 ×2, 120 ×2, …). It is in the authorized list but only for T3; migrating
  its accents would have landed rule 02 on 226 rather than the recorded 234.
- Every other file carrying dead accents is untouched by design — that is the
  remaining ratchet work for a later step.

## Next step

Step 2, next largest cluster: `RehearsalDetail.jsx` (26), `SongDetail.jsx` (22),
`Settings.jsx` (20), `StageMode.jsx` (15), `SetlistDetail.jsx` (15). The scrim
token is a design decision to take once, deliberately, if those four are ever to
be retired.
