# CEMURM — UX Specification

> **Status:** Active (visual tokens pending designer — see design-system.md)  
> **Created:** 2026-09-06  
> **Complements:** design-system.md (visual identity) — this doc covers interaction, copy, and behavior that do NOT depend on final colors/fonts.  
> **UI string language:** English (matches feature specs; Spanish localization is a separate future effort)

---

## 1. Notification Content Matrix

Source: `features/notifications.feature` (26 scenarios). This matrix defines the EXACT copy, tone, emoji policy, actions, and deep-links for every notification event.

### Tone legend
- **INFO** — factual, neutral, no emoji, no personality
- **WARM** — friendly, may use 1 emoji max, action-oriented
- **CELEBRATORY** — joyful, emoji + tone allowed (achievements, milestones)
- **SERIOUS** — direct, no emoji, security/account matters
- **CALM** — error/recovery, reassuring, no alarm

### Emoji policy
| Category | Emoji? | Max count | Examples |
|----------|--------|-----------|----------|
| Setlist edits | ❌ Never | 0 | none |
| Invitations | ✅ 1 | 1 | 🎸, 🤝 |
| Events/reminders | ⚠️ Contextual | 1 | 📅 next to date, never body decoration |
| Achievements | ✅ 1 | 1 | 🎉, 🔥 |
| Streaks | ✅ 1 | 1 | 🔥 |
| System/security | ❌ Never | 0 | none |
| Errors/offline | ⚠️ Only if recovery | 1 | 🔌 for offline only |

### Matrix

| # | Event (feature ref) | Title (bold) | Body (1-2 lines) | Tone | Buttons | Deep-link | Timing |
|---|---------------------|--------------|------------------|------|---------|-----------|--------|
| 1 | Bandmate invite | `Carlos invited you to edit Acoustic Setlist` | `Join the band and help shape the setlist` | WARM | View · Decline | Collaboration invitation screen | Immediate |
| 2 | Org invite via code | `{Inviter} invited you to join {Org}` | `Role: {role} — accept from the invitation` | WARM | Join | Org join screen | Immediate |
| 3 | Invite declined | `{Name} declined your invitation` | `They won't join {Setlist}` | INFO | — | Setlist (member list) | Immediate |
| 4 | Invite accepted | `{Name} accepted your invitation` | `They're now in your bandmates list` | WARM | View | Bandmates tab | Immediate |
| 5 | Setlist reordered | `{Name} reordered songs in {Setlist}` | — | INFO | View | Setlist screen | Immediate |
| 6 | Song added to setlist | `{Name} added {Song} to {Setlist}` | `Key: {key} · Tempo: {bpm}` | INFO | View | Setlist → song highlighted | Immediate |
| 7 | Permission changed | `Your permissions on {Setlist} changed to {role}` | — | INFO | View | Setlist screen | Immediate |
| 8 | Removed from setlist | `You were removed from {Setlist}` | — | INFO | — | Notification center only | Immediate |
| 9 | New event | `New event: {Event}` | `{Days} days remaining — RSVP now` | WARM | RSVP | Event details | Immediate on publish |
| 10 | Event reminder (day before) | `{Event} is tomorrow at {time}` | `{Location}` | WARM | View | Event details | Scheduled: 24h before |
| 11 | Gig reminder (1h before) | `Your setlist starts in 1 hour — {Setlist}` | `Get ready for the show` | WARM | Open Performance Mode | Stage Mode, first song | Scheduled: 60min before |
| 12 | Performance order updated | `Performance order updated for {Event}` | — | INFO | View | Event details | Immediate |
| 13 | Proximity code expired | `Proximity code {code} expired` | `Generate a new one to keep inviting` | INFO | Generate New Code | Org settings | Immediate on expiry |
| 14 | Password reset requested | `A password reset was requested for your account` | `If this wasn't you, secure your account` | SERIOUS | Secure my account | Security settings | Immediate |
| 15 | Weekly digest | `Weekly Recap — {n} new songs, {m} setlists updated` | `See what changed this week` | WARM | View recap | Digest summary | Scheduled: Mon 9:00 AM |
| 16 | Streak achievement | `{n}-day practice streak!` | `Keep it going — every day counts` | CELEBRATORY | Practice | Practice mode | On streak milestone |
| 17 | First setlist created | `First setlist created! 🎉` | `Your repertoire journey starts now` | CELEBRATORY | View setlist | Setlist screen | On milestone |
| 18 | Re-engagement nudge | `Your band misses you 🎸` | `{n} updates since you were last here` | WARM | See updates | Activity feed | After 2+ days idle (max 1/week) |
| 19 | Offline reconnect summary | `You have {n} pending notifications` | `Grouped by type in your feed` | INFO | View | Activity feed (grouped) | On reconnect |

### Timing & delivery rules

1. **Immediate events** (1-9, 12-14): push in real time if online and permission granted.
2. **Scheduled events** (10-11, 15): computed server-side at the target time; delivered when the user is online.
3. **Quiet hours** (10 PM – 7 AM default, user-configurable): all pushes queue locally, badge increments, and upon app open the feed shows a banner: `Notifications paused during quiet hours`.
4. **Re-engagement nudges** (18): max one per week, never during quiet hours, never within 24h of any other push.
5. **Offline queue** (19): pushes received while offline are stored in IndexedDB; on reconnect they enter the feed in order and a single summary push fires.
6. **Digest** (15): only if user opted in; aggregates the week's activity.

### Deep-link behavior

Tapping a notification always opens the **most specific target**:

| Notification | Target |
|--------------|--------|
| Setlist event | Setlist screen, specific song highlighted + scrolled to position |
| Invitation | Collaboration invitation screen (accept/decline inline) |
| Event | Event details with RSVP state |
| Gig reminder | Stage Mode opened on first song of setlist |
| Achievement | The surface that produced it (practice mode, setlist, etc.) |
| Digest | Weekly recap view |

---

## 2. Microcopy Glossary

Canonical strings for repeated UI situations. Apply the tone from design-system.md §1.3.

### Actions & confirmations

| Context | Primary label | Secondary | Confirm dialog (if any) |
|---------|---------------|-----------|--------------------------|
| Create song | `Create Song` | `Cancel` | None (draft autosave) |
| Delete song | `Delete` | `Cancel` | `Delete "{title}"? This can't be undone.` |
| Delete setlist | `Delete` | `Cancel` | `Delete "{name}"? Songs can be re-added later.` |
| Remove bandmate | `Remove` | `Cancel` | `Remove {name}? They lose edit access immediately.` |
| Leave setlist | `Leave` | `Cancel` | `Leave "{name}"? You'll lose edit access.` |
| Transpose reset | `Reset` | — | None (one tap) — toast `Back to {original key}` |
| Offline save | `Save for offline` | — | Toast `Saved for offline` |

### Errors (CALM tone — never alarm, always path forward)

| Situation | String | Secondary action |
|-----------|--------|------------------|
| Network offline during sync | `You're offline — changes saved locally` | `Sync will retry automatically` |
| Sync failed | `Couldn't sync — will retry when online` | — |
| ChordPro parse error | `Some chords couldn't be read` | `Line {n}: {snippet}` |
| Fetch failed (online) | `Couldn't reach the server` | `Your songs are safe locally` + Retry |
| Permission denied | `You don't have edit access here` | `View only` |
| Form validation | `Fix the highlighted fields to continue` | — |
| Delete error | `Couldn't delete — try again` | — |

### Empty states

Consolidated (see design-system.md §7 for mascot treatment):

| Screen | Heading | Body | CTA |
|--------|---------|------|-----|
| Repertoire (no songs) | `No songs yet` | `Paste some ChordPro text and you're set` | `Create Your First Song` |
| Setlists (none) | `No setlists yet` | `Build one for your next gig or rehearsal` | `Build a Setlist` |
| Bandmates (none) | `No bandmates yet` | `Invite people to collaborate on setlists` | `Invite a Bandmate` |
| Search (no results) | `No matches for "{query}"` | `Try different keywords or check the title` | `Clear search` |
| Collections (none) | `No collections yet` | `Group songs by theme, style, or season` | `Create a Collection` |
| Activity feed (empty) | `All caught up` | `Activity from your band will appear here` | — |
| Offline (no cache) | `Nothing downloaded yet` | `Save songs for offline before your next gig` | `Browse repertoire` |

### Toasts (success feedback)

| Action | Toast | Duration |
|--------|-------|----------|
| Song saved | `Song saved` | 2s |
| Song deleted | `Song deleted` | 2s |
| Setlist reordered | `Order updated` | 1.5s |
| Transposed | `+2 semitones · Now in A` | 1.5s |
| Invite sent | `Invitation sent to {name}` | 2s |
| Offline saved | `Saved for offline` | 2s |
| Sync completed | `All changes synced` | 2s |

---

## 3. Component Behavior Spec (non-visual)

### Toast
- Max 3 concurrent; oldest dismisses first
- Auto-dismiss per duration table above; manual swipe dismiss always available
- Never blocks input; appears over content, not in a modal
- Success = emerald indicator dot; error = rose; info = sky (color tokens in design-system.md)

### Modal
- Open: focus moves to modal, background inert (aria-modal=true)
- Close: Esc, backdrop click, or Cancel — all equivalent
- Confirm dialogs require explicit confirmation; never auto-dismiss destructive actions
- Max width 480px; scrollable content; sticky footer with actions

### EmptyState
- Trigger: list/screen has zero items after load completes (never during loading)
- CTA visible only when the user has permission to act
- Mascot expression per design-system.md §7 table

### Streak / badge
- Streak counts consecutive days with ≥1 logged practice session OR ≥1 repertoire edit (configurable in settings)
- Streak resets after 2 missed days (grace: 1 day)
- 🔥 flame appears in practice screen header when streak ≥ 3
- Badge on Notifications tab: unread count, caps display at `9+`

### Celebration (confetti/mascot)
- Triggers: milestone events (design-system.md §8.1)
- Animation ≤ 3s, non-blocking, pointer-events pass-through after 300ms
- Settings toggle: `Show celebrations` (default on; off silences animations AND sounds)
- Sound: opt-in only, never plays in Stage Mode
- Never triggers during: Stage Mode, offline sync failure, modal dialogs

### Loading states
- Skeleton placeholders for lists; spinner only for full-screen transitions
- All loading UI ≤ 2s before timeout message: `Taking longer than expected — check your connection`

---

## 4. Onboarding Interaction Spec

### Flow (2.5 min target)

| Step | Interaction | Skippable? | Completion marks |
|------|-------------|-----------|------------------|
| Welcome (3 slides) | Swipe forward; `Get Started` on last | `Skip` on slide 1 | walkthrough_completed |
| Account creation | Email/Google/GitHub | No (required) | account_created |
| Profile setup | Instrument, skill level | Yes (`Later`) | profile_setup |
| Dashboard tour (4 steps) | Highlight ring + tooltip; `Skip Tour` | Yes | tour_completed |
| Celebration | Confetti + `You're all set!` | Auto-dismiss | onboarding_complete |

### Incomplete onboarding (returning user)

| State | Banner |
|-------|--------|
| Account created, profile incomplete | `Finish your setup — 2 minutes left` → resumes at profile step |
| Profile done, tour incomplete | `Take a quick tour of your dashboard` → resumes at tour step |
| Everything done | No banner; straight to dashboard |

### Feature highlights (post-update)

- New surface visible → edge highlight tooltip with 1-2 line explanation
- Shows exactly once per surface version; tracked in user preferences
- `Got it` dismiss button + auto-dismiss 5s

### Tooltip rules
- One tooltip on screen at a time (queue if multiple pending)
- Dismiss: tap outside, `Got it`, or 5s auto-timeout
- Never appears in Stage Mode; queued tooltips suppressed forever if surface used in Stage first? — NO: tooltips wait. If the user opens the surface only via Stage Mode, tag it `seen` without showing.

---

## 5. Stage Mode Interaction Spec (non-visual)

### Gesture & input map

| Input | Action |
|-------|--------|
| Swipe left | Next song |
| Swipe right | Previous song |
| Tap left/right edge (30% zones) | Previous/Next |
| Arrow keys (desktop) | Previous/Next |
| Page Up / Page Down | Previous/Next |
| Space | Pause/resume auto-scroll |
| Foot pedal (HID) | Next song (single press), Previous (long press) |
| Two-finger tap | Toggle control bar |
| 2-finger double-tap | Toggle transpose panel |

### Transition behavior
- Song change: fade 150ms (no slide — a stage slide feels like a crash)
- Section jump within song: instant, no animation
- Transpose change: instant re-render, 1s non-blocking toast with new key

### Crash recovery
- On restart, reopen last active song + setlist position (persisted to IndexedDB on every song change)
- If setlist unavailable (corrupt cache): fall back to `[No lyrics available]` chord-only view, never blank

### What NEVER appears in Stage Mode
- Mascot (Kutu) — zero personality
- Notifications, toasts, banners, badges
- Confetti, celebrations, animations beyond fades
- Settings, profile, navigation chrome

### Auto-scroll
- Tempo-controlled (BPM → scroll speed)
- Section-aware: scrolls to next section boundary, never mid-section
- Manual scroll resets timer for current section
- Disabled when chord-only view active

---

## 6. Accessibility baseline (color-independent)

| Area | Requirement |
|------|-------------|
| Focus | Visible focus ring (2px, offset 2px) on all interactive elements |
| Keyboard | Full app operable via keyboard; Stage Mode via arrows/space |
| Touch targets | ≥ 44×44px on mobile (48px preferred) |
| Motion | `prefers-reduced-motion` disables confetti, fades reduce to 0ms |
| Screen readers | All icons aria-hidden with text labels; modals announce on open; toasts announce politely |
| Text resize | UI survives 200% zoom without horizontal scroll (WCAG 1.4.4) |
| Orientation | Stage Mode locked landscape on narrow devices; daily UI scrolls freely |

---

*UX behavior is final where marked [non-visual]. Visual tokens (colors) and typography pending designer — see design-system.md §11 Open Decisions.*