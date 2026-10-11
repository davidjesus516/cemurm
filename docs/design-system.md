# CEMURM — Design System

> **Status:** PARTIALLY SUPERSEDED, 2026-09-28. The **visual rules** below were replaced by
> `skills/cemurm-visual-system/SKILL.md` and its three references, enforced in CI by
> `scripts/check-visual-contract.sh`. The **brand voice, mascot, notification behaviour,
> onboarding, empty states and celebration triggers remain current** and are still cited by
> `docs/ux-spec.md` and `docs/wireframes.md` by section number.
>
> **Do not delete this file.** It carries live cross-references from `README.md`,
> `docs/ux-spec.md` and `docs/wireframes.md` — **14** in total as of 2026-09-30 (1 + 8 + 5; the
> earlier figure of eleven undercounted them) — and it is the only record of the mascot and the
> voice.
>
> **Created:** 2026-09-06
> **Updated:** 2026-09-30 (supersession banner added 2026-09-28 in #238; cross-reference count
> corrected 2026-09-30)
> **Superseded in part by:** `skills/cemurm-visual-system/`, merged as `5547150` (PR #235)

## Which sections are dead, and by what

| Section | Status | Authority now lives in |
|---|---|---|
| 1 Brand identity, tone, voice | **Current** | This document. `ux-spec.md:82` applies 1.3 by number |
| 2 Color palette, the token table | **Current** | The values are the live `cem-*` tokens in `tailwind.config.js` |
| 2 Color usage rules | **Superseded** | `SKILL.md` rule 2: one accent, full saturation on the logo mark, the primary CTA and the active state only |
| 3 Mascot "Kutu" | **Current** | This document. `ux-spec.md:110,153` cite section 7 for mascot treatment |
| 4 Typography, Inter | **Current** | This document, plus the display mono now required. See 4.1 |
| 4 Typography, the type scale | **Superseded** | `assets/tokens.css` in the skill. Every spacing and radius value there is a project decision, not an Apple value: Apple publishes none |
| 5-8 Notification, onboarding, empty states, celebration | **Current** | This document. `wireframes.md` cites section 7 |
| 9 Dark mode vs light mode | **Describes an unimplemented feature** | Nothing. See the note at the top of section 9 |
| 10 Implementation priority | **Stale** | Milestone status moved to `docs/master-plan.md` |
| 11 Open decisions | **Stale** | Entries annotated individually below |

The visual direction is now **the macOS / Apple design language**, keeping this project's colour
essence: a dark ramp plus **one** amber accent. Two earlier rules were deliberately replaced: the
mandate of `border-radius: 0` became continuous radii scaled to component size, and the accent
moved off the performance surface onto the logo, the primary CTA and the active state.
---

## 1. Brand Identity

### 1.1 What CEMURM Is (Design Perspective)

CEMURM is a **professional tool with community soul**. It lives at the intersection of:

- **Utility** — musicians need it to WORK, reliably, on stage, offline
- **Community** — it connects bands, academies, worship teams
- **Creativity** — it's about music, not spreadsheets

The design must feel like a **well-organized music binder** that happens to be digital: familiar, trustworthy, no learning curve for the core task. Playful moments are welcome, but the default mode is "this tool respects my time."

### 1.2 Brand Tone

| Dimension | Position | Notes |
|-----------|----------|-------|
| Professional ↔ Playful | **60/40 professional** | Default is clean and functional. Playful appears in celebrations, onboarding, empty states |
| Serious ↔ Warm | **70/30 warm** | Not cold/clinical. Friendly microcopy, warm colors, mascot moments |
| Minimal ↔ Expressive | **65/35 minimal** | Clean layouts. Expression through color accents, mascot, and animations — not through clutter |
| Tech ↔ Human | **55/45 human** | Technical capability wrapped in human language. "Your setlist is ready" not "Setlist loaded" |

### 1.3 Voice & Microcopy Guidelines

**Principles:**
1. **Say what it does, not what it is.** → "Add your first song" not "Create new repertoire entry"
2. **Celebrate milestones.** → "First setlist created! 🎉" is earned. Don't celebrate every click.
3. **Recover gracefully.** → "Can't reach the server — your songs are safe locally" not "Error 503"
4. **Never blame the user.** → "That link seems expired" not "Invalid URL"
5. **Keep it short.** → If it fits in a toast, it doesn't need a modal.

**Tone by context:**

| Context | Tone | Example |
|---------|------|---------|
| Stage Mode | **Zero personality** | Just chords, lyrics, controls. No mascot, no celebration, no noise |
| Daily use (editing, browsing) | **Warm professional** | Clean UI, helpful tooltips, subtle color accents |
| Onboarding | **Friendly guide** | Mascot appears, step-by-step, celebratory completion |
| Empty states | **Encouraging** | "No songs yet — paste some ChordPro and you're set" + mascot |
| Errors | **Calm & clear** | "Something went wrong. Your changes are saved locally" |
| Celebrations | **Joyful** | Confetti animation, mascot cheers, warm amber glow |
| Notifications | **Contextual hybrid** | See §5 below |

---

## 2. Color Palette — "Slate & Ember"

### 2.1 Rationale

CEMURM has a dual-surface problem: **Stage Mode** (dark, high-contrast, zero-distraction for live performance) and **Daily Use** (editing, browsing, collaboration). The palette must work in both modes natively, not as a bolted-on dark theme.

Dark-first design solves this: the default is already Stage Mode-ready, and a light variant covers daily use on bright screens.

**Amber as the hero color** evokes stage lighting, warmth, and energy — without being childish. It's the color of a spotlight hitting a performer.

### 2.2 Core Palette

#### Backgrounds (Dark Mode — Primary)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-base` | `#0f172a` | App background, Stage Mode |
| `bg-surface` | `#1e293b` | Cards, modals, sidebar |
| `bg-surface-elevated` | `#334155` | Dropdowns, popovers, tooltips |
| `bg-surface-hover` | `#475569` | Hover states on interactive surfaces |

#### Backgrounds (Light Mode — Secondary)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-base-light` | `#f8fafc` | App background in light mode |
| `bg-surface-light` | `#ffffff` | Cards, modals |
| `bg-surface-elevated-light` | `#f1f5f9` | Dropdowns, hover states |

#### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#f8fafc` | Headings, primary content (dark mode) |
| `text-secondary` | `#94a3b8` | Labels, metadata, descriptions |
| `text-primary-light` | `#0f172a` | Headings (light mode) |
| `text-secondary-light` | `#64748b` | Labels (light mode) |

#### Accents

| Token | Hex | Usage | Personality |
|-------|-----|-------|-------------|
| `accent-amber` | `#f59e0b` | Primary CTA, active states, links, key signature highlights | Hero color — stage light, warmth |
| `accent-coral` | `#f97316` | Secondary CTA, streaks, achievements, mascot highlights | Energy, celebration |
| `accent-emerald` | `#10b981` | Success states, online indicators, completed actions | Growth, go |
| `accent-rose` | `#f43f5e` | Errors, destructive actions, warnings | Attention, danger |
| `accent-sky` | `#0ea5e9` | Info, links, collaborative indicators | Trust, calm |

#### Stage Mode Specific

| Token | Hex | Usage |
|-------|-----|-------|
| `stage-bg` | `#000000` | Pure black — maximizes contrast on any screen |
| `stage-chord` | `#f59e0b` | Chord symbols — amber on black = highest readability |
| `stage-lyric` | `#f8fafc` | Lyrics — pure white for distance reading |
| `stage-section` | `#94a3b8` | Section labels (Verse, Chorus) — dimmed but visible |
| `stage-dim` | `#1e293b` | Dimmed text in spotlight mode |

### 2.3 Color Usage Rules

1. **Amber is the hero, not the background.** Use sparingly — CTAs, active states, chord highlights. If everything is amber, nothing stands out.
2. **Coral is for celebration only.** Streaks, achievements, mascot expressions. Never for errors or warnings.
3. **Dark mode is the default.** Light mode exists for bright environments, not as the primary design target.
4. **Stage Mode uses pure black.** No slate, no surfaces — just content on #000000.
5. **Contrast ratio minimum 4.5:1** for all text on backgrounds (WCAG AA). Stage Mode exceeds this at 21:1.

### 2.4 Tailwind Config Mapping

```js
// tailwind.config.js additions
module.exports = {
  theme: {
    extend: {
      colors: {
        cem: {
          base: '#0f172a',
          surface: '#1e293b',
          elevated: '#334155',
          hover: '#475569',
          amber: '#f59e0b',
          coral: '#f97316',
          emerald: '#10b981',
          rose: '#f43f5e',
          sky: '#0ea5e9',
          stage: {
            bg: '#000000',
            chord: '#f59e0b',
            lyric: '#f8fafc',
            section: '#94a3b8',
            dim: '#1e293b',
          },
        },
      },
    },
  },
}
```

---

## 3. Mascot — Ring-Tailed Lemur (working name "Kutu")

### 3.1 Decision

**✅ APPROVED: Ring-Tailed Lemur** (*Lemur catta*) — species and character are final. **Name pending decision** — "Kutu" is the working name (CEMURM ≈ Lemur mnemonic).

> **⚠️ Artwork status:** the current design in `docs/mascot-concepts.html` is approved as a **placeholder only**. The species/personality are final; the illustration must be replaced with a final design per §3.5 — tracked in [#34](https://github.com/davidjesus516/cemurm/issues/34).

Species chosen over Jovian/Indri lemur for higher cuteness factor, cultural recognition (King Julien / Penguins of Madagascar), and more expressive facial range for mascot emotions.

| Criterion | Ring-Tailed Lemur (chosen) | Jovian/Indri Lemur |
|-----------|--------------------------|-------------------|
| **Cultural recognition** | King Julien, Zoboomafoo — instantly recognizable | Zoboomafoo only — less universal |
| **Cuteness** | Very high — round face, big eyes | More imposing, less "mascot-friendly" |
| **Expressiveness** | Extremely flexible face, wide mouth range | Rigid facial structure, limited emotions |
| **Size fit** | Small, fits in UI naturally | Very large, harder to scale to icons |
| **Icon readability** | Clear silhouette at 16px (tail stripes, ear tufts) | Harder to distinguish at small sizes |

### 3.2 Character Profile

| Attribute | Value |
|-----------|-------|
| **Name** | "Kutu" (working name — pending decision) |
| **Species** | Ring-tailed lemur (*Lemur catta*) |
| **Personality** | Curious, helpful, slightly mischievous, deeply loyal |
| **Role in app** | Guide (onboarding), cheerleader (celebrations), calm companion (errors) |
| **Voice** | Doesn't speak — communicates through expressions, gestures, and musical notes |
| **Signature trait** | Holds a tiny guitar/ukulele. Tail curls into a treble clef when happy |
| **Key visual features** | Black-and-white ringed tail (iconic), round face, amber/gold eyes (ties to palette), white face patches, grey body |

### 3.3 Expression Map

| Emotion | Context | Expression |
|---------|---------|------------|
| **Happy** | Successful action, task complete | Big smile, tail up, strumming guitar |
| **Thinking** | Loading, processing | Head tilt, one paw on chin, musical notes floating |
| **Celebrating** | Milestone reached (first setlist, 10 songs) | Jumping, confetti, guitar in air |
| **Surprised** | New feature discovered, unexpected result | Wide eyes, mouth O, ears perked |
| **Sleeping** | Idle state, no activity | Curled up with tail over face, ZZZ |
| **Encouraging** | Empty state, first-time prompt | Waving, pointing at action button, warm smile |
| **Concerned** | Error, warning | Eyebrows up, holding guitar protectively |
| **Listening** | Audio/playback mode | Eyes closed, head bobbing, headphones on |

### 3.4 Where Kutu Appears (and Doesn't)

| Surface | Kutu present? | Treatment |
|---------|--------------|-----------|
| **Stage Mode** | ❌ NEVER | Zero personality on stage — pure utility |
| **Onboarding** | ✅ Yes — protagonist | Guides through welcome, celebrates completion |
| **Empty states** | ✅ Yes — encouraging | Points to the action, shows personality |
| **Celebrations** | ✅ Yes — full expression | Confetti, jumping, maximum personality |
| **Errors** | ✅ Yes — calm companion | Subtle, doesn't alarm, shows recovery path |
| **Daily UI (chords, setlists)** | ❌ No | Clean, professional, no mascot clutter |
| **Settings/Profile** | ❌ No | Functional screens stay functional |
| **Notifications** | ⚠️ Small icon only | Tiny Kutu face in notification avatar, not full illustration |

### 3.5 Illustration Style

- **Line weight:** 2-3px, consistent
- **Style:** Flat with subtle gradients (not photorealistic, not too cartoony)
- **Color mapping (ties to palette):**
  - Body: `#64748b` (slate-500) — neutral grey
  - Face patches: `#f8fafc` (slate-50) — white
  - Eyes: `#f59e0b` (amber-500) — **the hero color lives in Kutu's eyes**
  - Tail rings: alternating `#0f172a` (base) and `#f8fafc` (white) — the brand's dark/light duality in the tail
  - Nose/ears: `#334155` (slate-700) — dark accents
- **Key ring-tailed features to always show:**
  - Black-and-white striped tail (THE iconic feature — never simplify to a plain tail)
  - Round face with white eye patches
  - Small pointed ears with white tufts
  - Amber/gold eyes (unique to Kutu, ties to brand)
- **Size variants:** 16px (notification avatar), 48px (empty state), 120px (onboarding), 200px (celebration hero)
- **Silhouette test:** Must be recognizable as "Kutu" at 16px using only the tail stripes + ear shape

---

## 4. Typography

### 4.1 Font Choice: Inter — plus a display monospace (added 2026-09-28)

**Added by the visual contract:** Inter is no longer the only family. A **technical monospace** is
now also the brand display face, self-hosted, latin subset only. Inter covers UI and data, but a
product that reads as an instrument for working musicians needs a display face with a technical
register, and reusing one family for both roles is what makes a system read as generic. The same
family also serves the mono/data role, which fixes SongDetail silently falling back to DejaVu.
Self-host both; no Google Fonts link; `font-display: swap` with a `size-adjust` fallback to keep
CLS at zero. Why that family and not another is in
`skills/cemurm-visual-system/references/apple-macos-visual-language.md`.

**Why Inter:**
- **Legible at every size** — critical for Stage Mode (large text at distance) and mobile (small text in lists)
- **Tabular numbers** — BPM, timestamps, and setlist numbers align perfectly
- **Free, open-source** — no licensing issues
- **Excellent weight range** — 100-900 for all UI needs
- **Already familiar** — used by Figma, Linear, many dev tools — users trust it

**Rejected alternatives:**
- Plus Jakarta Sans: warmer but worse legibility at small sizes
- DM Sans: friendly but poor tabular number support
- System fonts: inconsistent cross-platform rendering for a PWA

### 4.2 Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display` | 36px / 2.25rem | 700 | 1.2 | Hero text, celebration screens |
| `h1` | 28px / 1.75rem | 700 | 1.3 | Page titles |
| `h2` | 22px / 1.375rem | 600 | 1.4 | Section headers |
| `h3` | 18px / 1.125rem | 600 | 1.4 | Card titles |
| `body` | 16px / 1rem | 400 | 1.5 | Default text |
| `body-sm` | 14px / 0.875rem | 400 | 1.5 | Secondary content, labels |
| `caption` | 12px / 0.75rem | 400 | 1.4 | Timestamps, metadata |
| `stage-chord` | 24-32px | 600 | 1.0 | Chord symbols in Stage Mode |
| `stage-lyric` | 20-28px | 400 | 1.6 | Lyrics in Stage Mode |
| `bpm` | 14px | 500 | 1.0 | BPM display (tabular figures) |

### 4.3 Stage Mode Typography Rules

1. **Minimum chord size:** 24px (readable at arm's length on a tablet)
2. **Minimum lyric size:** 20px (readable at arm's length)
3. **Line height for lyrics:** 1.6-1.8 (generous spacing for quick scanning)
4. **Font weight for chords:** 600 (bold enough to distinguish from lyrics at a glance)
5. **Section labels:** Uppercase, letter-spacing 0.1em, 50% opacity of lyric color

---

## 5. Notification UX — "Duolingo-Style Hybrid"

### 5.1 Philosophy

Notifications in CEMURM serve two masters:
1. **Information** — "Julian added Song X to Friday Gig" (factual, no fluff)
2. **Motivation** — "You've practiced 5 days in a row! 🎵" (emotional, encouraging)

The rule: **the notification style matches the event type**, not a global setting.

### 5.2 Notification Tone Matrix

| Event Category | Tone | Style | Example |
|----------------|------|-------|---------|
| **Setlist edits** | Informative | Factual, no emoji, clean | "Julian reordered songs in Friday Gig" |
| **Invitations** | Warm | Friendly, action-oriented | "Carlos invited you to edit Acoustic Setlist" + [Accept] [Decline] |
| **Achievements** | Celebratory | Emoji, warm, encouraging | "First setlist created! 🎉 Your repertoire journey starts now" |
| **Streaks** | Motivational | Duolingo-style nudge | "5 days practicing! Don't break the streak 🔥" |
| **Reminders** | Calm, helpful | Factual with context | "Festival Primavera is tomorrow at 7 PM" |
| **System/Security** | Neutral, serious | Direct, no personality | "A password reset was requested for your account" |
| **Errors** | Calm, clear | No alarm, solution-oriented | " couldn't sync — will retry when online" |

### 5.3 Notification Anatomy

```
┌─────────────────────────────────────────────┐
│ [Kutu 32px]  Julian added Song X    2m ago │
│              to Friday Gig                  │
│                                             │
│              [View Setlist]                 │
└─────────────────────────────────────────────┘
```

**Components:**
- **Avatar:** 32px Kutu face (expression matches tone — happy for celebrations, neutral for info)
- **Title:** Bold, 14px, one line max
- **Body:** Regular, 13px, two lines max
- **Timestamp:** Caption, 12px, relative time
- **Actions:** 1-2 buttons max, styled with accent colors
- **No banner images** — text-only for speed and offline reliability

### 5.4 Push Notification Patterns

| Pattern | When | Duolingo Equivalent |
|---------|------|-------------------|
| **Streak flame** 🔥 | Consecutive days of practice/activity | "5 day streak!" |
| **Encouragement nudge** | User hasn't opened app in 2+ days | "Your band misses you 🎸" |
| **Milestone celebration** | First song, 10th song, 5th setlist | Confetti in-app + push |
| **Social proof** | "3 bandmates updated Friday Gig" | Activity-driven re-engagement |
| **Smart reminder** | Before a gig (1 day, 1 hour) | Contextual, not nagging |

### 5.5 Quiet Hours & Preferences

- **Global toggle:** On/Off for all push
- **Category toggles:** Invitations, Setlist Changes, Events, Achievements, System
- **Quiet hours:** User-defined DND window (notifications queued, delivered on open)
- **OS-level:** Respect native notification settings (silent, badge-only, etc.)

---

## 6. Onboarding Flow

### 6.1 First-Time Experience

**3-slide welcome → Account creation → Profile setup → Dashboard tour → Celebration**

| Step | Content | Kutu Role | Duration |
|------|---------|-----------|----------|
| Slide 1 | "Your repertoire, organized" — show song list mockup | Waves hello | 3s read |
| Slide 2 | "Setlists for every gig" — show setlist builder | Holds up setlist | 3s read |
| Slide 3 | "Collaborate with your band" — show shared edit | High-fives | 3s read |
| Account | Email / Google / GitHub signup | Steps aside, small icon | 30s |
| Profile | Instrument, skill level, name | Points at form | 30s |
| Tour | 4-step dashboard highlight | Guides with pointer | 60s |
| Celebration | Confetti + "You're all set!" | Jumps, strums guitar | 5s |

**Total: ~2.5 minutes** from install to personalized dashboard.

### 6.2 Returning User

- **Completed onboarding:** Skip straight to dashboard. No replay.
- **Incomplete onboarding:** Banner at top: "Finish your setup — 2 minutes left" with resume button.
- **Post-update:** Feature highlight tooltip on first visit to new surface. Kutu explains briefly, then never again.

### 6.3 Contextual Tooltips

| Trigger | Tooltip | Dismiss |
|---------|---------|---------|
| First visit to Setlists tab | "Tap here to build your first setlist" pointing at Create button | Tap or 5s auto-dismiss |
| First song created | "Great start! Add it to a setlist to prepare for your next gig" | Tap or 5s auto-dismiss |
| First time in Stage Mode | "Swipe or use arrow keys to navigate songs" | Tap once, never show again |

**Rule:** Each tooltip shows **exactly once**. Track completion in user preferences.

---

## 7. Empty States

Every empty state follows the same pattern:

```
┌─────────────────────────────────────┐
│                                     │
│         [Kutu illustration]         │
│         (context-appropriate        │
│          expression + pose)         │
│                                     │
│      No songs yet                   │
│      Paste some ChordPro text       │
│      and you're all set.            │
│                                     │
│      [Create Your First Song]       │
│                                     │
└─────────────────────────────────────┘
```

| Empty State | Kutu Expression | CTA |
|-------------|----------------|-----|
| No songs | Encouraging wave, pointing | "Create Your First Song" |
| No setlists | Holding empty setlist, shrug | "Build a Setlist" |
| No bandmates | Sitting alone, looking at phone | "Invite a Bandmate" |
| No search results | Looking through magnifying glass | "Try different keywords" |
| Offline mode | Headphones on, relaxed | "You're offline — cached songs available" |

---

## 8. Celebration System

### 8.1 Trigger Events

| Event | Animation | Kutu Action |
|-------|-----------|-------------|
| First song created | Confetti burst (amber + coral particles) | Jumps, strums guitar |
| First setlist created | Confetti + glow pulse | Full celebration pose |
| 10 songs added | Subtle sparkle | Smiles, thumbs up |
| 7-day practice streak | Flame icon animation 🔥 | Head-bobbing to music |
| First collaboration | Two Kutus high-five | Animated high-five |
| Onboarding complete | Full-screen confetti + confetti rain | Maximum joy pose |

### 8.2 Celebration Rules

1. **Earned, not constant.** Celebrate milestones, not every save.
2. **Respectful of context.** Never celebrate during Stage Mode or when user is mid-task.
3. **Skip option.** "Don't show celebrations" in settings for users who prefer minimal.
4. **Animation budget:** 2-3 seconds max. No blocking interactions.
5. **Sound optional.** A short chime accompanies celebration. Muted by default, opt-in.

---

## 9. Dark Mode vs Light Mode

> **The light-mode column below describes a feature that does not exist.** Verified 2026-09-28:
> there is no theme toggle anywhere in `src/`, `tailwind.config.js` declares zero light or dark
> variants, and `src/app/index.css` hardcodes `color-scheme: dark`. Settings has no Appearance
> section. The row "Toggle: Settings -> Appearance -> Dark/Light/System" is aspirational, and so is
> the "Light mode accent shifts" decision in section 11. Kept here because deleting the table would
> remove the record of what was once intended, and because dark-first is still the real rule.

| Aspect | Dark Mode (Default) | Light Mode |
|--------|-------------------|------------|
| **When** | Stage Mode, low-light environments, evening use | Bright environments, projector displays |
| **Background** | `#0f172a` | `#f8fafc` |
| **Surfaces** | `#1e293b` | `#ffffff` |
| **Text** | `#f8fafc` / `#94a3b8` | `#0f172a` / `#64748b` |
| **Accents** | Same amber/coral/emerald | Same — accents don't change |
| **Stage Mode** | Pure black `#000000` | Not available (Stage Mode is always dark) |
| **Toggle** | Settings → Appearance → Dark/Light/System | System default respected |

**Rule:** The palette is designed dark-first. Light mode is an inversion, not a separate design. All accent colors remain unchanged.

---

## 10. Implementation Priority

> **Stale, 2026-09-28.** These phases are historical. Current sequencing lives in
> `docs/master-plan.md`, and `AGENTS.md` deliberately does not carry milestone status. The "Now
> (Hito 1)" rows below describe a project state that no longer exists.

| Phase | What to implement | When |
|-------|------------------|------|
| **Now (Hito 1)** | Tailwind config with `cem.*` tokens, Inter font, basic component library (Button, Card, Modal, Toast), dark mode base | Month 1-2 |
| **Hito 1** | Empty states with Kutu illustrations (SVG), onboarding 3-slide flow | Month 1-2 |
| **Hito 2** | Stage Mode: pure black, chord/lyric typography rules, high-contrast controls | Month 3-4 |
| **Hito 3** | Notification push system, celebration animations, streak system | Month 5-6 |
| **Hito 6** | Light mode polish, accessibility audit, animation refinement | Month 11-12 |

---

## 11. Open Decisions

| Decision | Status | Notes |
|----------|--------|-------|
| Color palette | ✅ Approved — "Slate & Ember" | Finalized by group decision, no longer pending designer |
| Mascot species | ✅ Approved — Ring-tailed lemur | *Lemur catta* — King Julien recognition, highest expressiveness |
| Mascot name | ⏳ Pending decision | "Kutu" used as working name (CEMURM ≈ Lemur mnemonic) |
| Mascot artwork | ⚠️ Placeholder | Concept/name approved; current art is placeholder until final design — [#34](https://github.com/davidjesus516/cemurm/issues/34) |
| Typography | ✅ Approved — Inter | Finalized by group decision, no longer pending designer |
| Notification tone | ✅ Approved — Hybrid contextual | Informativo para edits, motivacional para logros |
| Light mode | ❌ Never built | Approved on paper, never implemented. No theme toggle in `src/`, no light tokens in the config. Dark-only is the real rule |
| Celebration sound | ❌ Undecided | Short chime? Musical note? Silent? |
| Light mode accent shifts | ❌ Moot | Moot if light mode is never built. See section 9 |ds? |

---

*This document was the single source of truth for CEMURM's visual identity. As of 2026-09-28 that role belongs to `skills/cemurm-visual-system/SKILL.md` for visual rules; this file remains the source of truth for voice and mascot. Update it as decisions are finalized.*
