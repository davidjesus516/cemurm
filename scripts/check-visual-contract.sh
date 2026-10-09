#!/usr/bin/env bash
#
# check-visual-contract.sh -- enforcement gate for the CEMURM visual system.
#
# WHAT THIS IS FOR
# The visual system defines a small, deliberate token palette and a chrome-free
# projector surface. Those rules are only real if something refuses to let them
# drift. This script is that something. It runs in CI as the LAST step, after
# `pnpm build`, and it is runnable locally.
#
# HOW TO SET A RULE ENFORCING OR REPORT-ONLY
# Every rule is driven by ONE declaration in the RULE MODES block below. Set a
# rule's value to one of three modes and the runner changes behaviour with no
# other edit:
#
#   enforcing  A count above 0 fails the script (exit 1). Every finding is
#              listed with file and line. Use when the correct count is 0 today.
#   ratchet    A report-only rule with an enforced ceiling. The current count
#              is tolerated, but exceeding RATCHET_*_MAX fails. Use when the
#              rule is right in principle, false today, and the existing debt
#              must not grow. Lower the ceiling as the debt is paid down.
#   report     Printed with its count, never fails. Visibility only.
#
# The mode and the ceiling for a rule sit in the same block on purpose: a
# reviewer should never have to look in two places to learn whether a rule can
# fail. When a report-only or ratchet count reaches 0, promote that rule to
# `enforcing` and delete its ceiling. That promotion is the point of the count.
#
# SCOPE
# Colours are scanned in src/ only. The sanctioned home for a raw colour
# literal is the token declaration in tailwind.config.js and the token
# stylesheet the skill owns; neither is scanned, by design.
#
# DEPENDENCIES
# bash and grep only. No package installs, no test runner, no build step. This
# gate must stay cheaper and more reliable than the thing it guards.
#
# USAGE
#   bash scripts/check-visual-contract.sh
#   ./scripts/check-visual-contract.sh
#   pnpm check:visual
# Resolves every path from the script location, so it runs from any cwd.

set -euo pipefail

# ---------------------------------------------------------------------------
# RULE MODES  -- the single obvious declaration per rule
# ---------------------------------------------------------------------------
RULE_01A_RAW_COLOUR_LITERALS=enforcing
RULE_01B_TAILWIND_PALETTE=ratchet
RULE_02_DEAD_ACCENTS=ratchet
RULE_03_OVERLAY_CHROME=enforcing
RULE_04_PALETTE_GROWTH=enforcing
RULE_05A_TEXT_CONTRAST=enforcing
RULE_05B_PALETTE_CONTRAST=report
RULE_06_SECONDARY_ON_RAISED_FILL=enforcing
REPORT_STAGEMODE_CHROME=report
REPORT_CONFIG_TOKEN_COUNT=report

# ---------------------------------------------------------------------------
# RATCHET CEILINGS  -- measured baseline, may only fall
# ---------------------------------------------------------------------------
# Measured against the working tree on the branch this gate landed on. Re-run
# the script after lowering one; the printed count is the number to compare.
#
# 5 occurrences across 4 files, down from 92 (ceiling 82). Step 1 retired the
# stage/projection surface: 87 were bg-black, text-white/*, border-white/*,
# bg-white/* and ring-amber-500 on a projector or the musician's tablet, all
# remapped onto an existing token with the opacity modifier kept — cem.stage.bg
# (#000000) is Tailwind black exactly, and cem.amber (#f59e0b) is amber-500
# exactly. What is left is NOT a stage site:
#   * 4 modal scrims on tier-1 product surfaces -- bg-black/85 on
#     ReportDialog.jsx (x2) and SongDetail.jsx, bg-black/50 on FeedbackForm.jsx.
#     There is no scrim token, and adding one is palette growth, which rule 04
#     exists to prevent and which this unit deliberately did not do. Note the
#     stage surface's own scrim IS tokenised (StageMode.jsx uses
#     bg-cem-stage-bg/85) because cem.stage.bg already is black -- the blocker
#     for these four is the missing token in the cem namespace, not the value.
#   * 1 text-red-400 on the foot-pedal error line in StageMode.jsx. No token
#     equals Tailwind red-400 (#f87171): cem.rose is #f43f5e, so mapping it
#     would trade a rule-01b occurrence for a rule-02 one, and cem.amber is a
#     hue change to a live-performance surface. Both are worse than leaving it.
RATCHET_01B_MAX=5
# 234 occurrences across 36 files, as the Tailwind class form
# (cem-rose 167, cem-emerald 63, cem-sky 4, cem-coral 0). NOT zero: these four
# accents are declared in tailwind.config.js and used across the UI, they are
# simply no longer part of the intended palette. Retiring them is a source
# migration across 36 files, not a gate change, so this ceiling is what stops
# the palette from growing until that migration lands. Step 1 paid down 40 of
# them in features/services (Services.jsx 10, ServiceDetail.jsx 30): a hue
# cannot code three states over a one-accent palette, so the label carries the
# meaning and amber marks the one actionable state -- the shape already used by
# the moderation chain in fa7f20f. 38 files carried the accents at the previous
# ceiling; the two migrated files no longer do.
RATCHET_02_MAX=234

# ---------------------------------------------------------------------------
# RULE 05 PARAMETERS  -- the WCAG 2.x contrast matrix
# ---------------------------------------------------------------------------
# 4.5:1 is the AA contrast floor for normal-size text (WCAG 2.x SC 1.4.3). The
# same SC relaxes the floor to 3:1 for "large text" (>=18.66px bold or >=24px
# regular), and SC 1.4.11 sets 3:1 for non-text UI components. This gate uses
# the strict 4.5 figure for every pair on purpose. A token is not size-aware:
# the same cem.secondary is 14px body copy in one component and a large stage
# label in another, and a static config-level check cannot know which. Judging
# every pair at 3:1 would pass a regression that only ever shows up in small
# text. Over-strict on a large label is a cosmetic over-warning; too lax on
# 14px copy is an accessibility defect, and the first is cheap to relax later
# and the second is not. So: 4.5 everywhere.
CONTRAST_MIN=4.5
# The anchor token. cem.text is the body-copy foreground and the only row that
# is enforcing, because it passes today. It is also the checker's self-test: if
# this gate ever reports cem.text under the floor, the arithmetic is wrong, not
# the palette, and no other number in the matrix can be trusted. Read it first.
CONTRAST_ANCHOR_FG="text"
# The matrix axes. Space-separated token leaf names, not hex values: the values
# are parsed out of tailwind.config.js at run time, so editing a token makes
# this check follow the edit instead of reporting a stale table.
CONTRAST_FG_TOKENS="text secondary secondary-elevated amber emerald rose sky coral"
CONTRAST_BG_TOKENS="base surface elevated hover"

# ---------------------------------------------------------------------------
# RULE 06 PARAMETERS  -- cem.secondary is not legal on a raised fill
# ---------------------------------------------------------------------------
# Rule 05 measures the token PALETTE, which is the right place to learn that
# cem.secondary sits under the floor on cem.elevated. It cannot see the defect
# that actually shipped: 52 elements pairing that failing foreground with that
# background. Rule 06 is that pairing, checked on the source.
#
# The foreground side requires an UNPREFIXED text-cem-secondary. Two exclusions
# are deliberate, and both are holes a reader must know about rather than bugs:
#
#   1. A variant-scoped text colour -- placeholder:text-cem-secondary,
#      hover:text-cem-secondary -- is not this defect. A placeholder on a
#      bg-cem-surface input is 5.71:1 and passes; flagging it would force a
#      meaningless edit. (The disabled:bg-cem-elevated input pairing in
#      Auth.jsx, GuardianConsentRequired.jsx and SongForm.jsx is the residual
#      case: a disabled control, which SC 1.4.3 exempts as inactive.)
#   2. The trailing boundary rejects text-cem-secondary-elevated, so the remedy
#      token does not re-trip the rule that requires it. That single character
#      class is what makes the fix enforceable at 0.
#
# The background side enumerates the state prefixes that paint the ELEMENT'S OWN
# box, and deliberately omits file:, marker: and selection:. Those address a
# pseudo-element, so file:bg-cem-elevated puts elevated behind the
# ::file-selector-button while the element's own text keeps the colour its
# unprefixed text utility set -- a different element entirely. SongForm.jsx:355
# is the live example, and treating it as a violation would be a false positive
# that trains maintainers to ignore this rule. When a new element-scoped state
# prefix is introduced, add it here; the two prefixes actually in use today are
# hover: (87 sites) and disabled: (3).
CONTRAST_DEFECT_FG_PATTERN='(^|[^:[:alnum:]_-])text-cem-secondary(/[[:digit:]]{1,3})?([^[:alnum:]_-]|$)'
CONTRAST_DEFECT_BG_PATTERN='(^|[^:[:alnum:]_-])((focus-within|group-hover|group-focus|group-active|peer-hover|peer-focus|peer-active|hover|focus|active|disabled|checked):)*(bg-cem-(elevated|hover))(/[[:digit:]]{1,3})?([^[:alnum:]_-]|$)'

# ---------------------------------------------------------------------------
# ALLOWLISTS  -- named exceptions, each with a reason
# ---------------------------------------------------------------------------
# Rule 03: the projector surface must stay chrome-free. One exception exists.
# Format: <file>|<utility>. Keep the reason above the entry.
#
# OverlayView.jsx rounded-full on the "N / M" position chip (line 38). A
# bounded, data-bearing counter badge, not decorative furniture. It carries no
# shadow, no gradient and no backdrop filter, which are the three things that
# actually degrade through a projector and an H.264 encode. Removing it is a
# visual change on a live streaming surface and belongs in a deliberate design
# change, not in a gate.
OVERLAY_CHROME_ALLOWLIST=(
  "src/features/stage/components/OverlayView.jsx|rounded-full"
)

# Rule 04: the token palette may not silently grow. Every colour key that
# exists today is listed, so adding a fifth accent -- or renaming one -- fails
# the gate and becomes a deliberate, reviewable act. This is the current
# palette: 17 leaves (12 flat under cem, 5 under cem.stage).
TAILWIND_COLOUR_KEY_ALLOWLIST=(
  "cem.base"
  "cem.surface"
  "cem.elevated"
  "cem.hover"
  "cem.text"
  "cem.secondary"
  "cem.secondary-elevated"
  "cem.amber"
  "cem.coral"
  "cem.emerald"
  "cem.rose"
  "cem.sky"
  "cem.stage.bg"
  "cem.stage.chord"
  "cem.stage.lyric"
  "cem.stage.section"
  "cem.stage.dim"
)

# ---------------------------------------------------------------------------
# PATH RESOLUTION  -- independent of the caller's working directory
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

SRC_DIR="src"
TAILWIND_CONFIG="tailwind.config.js"
STAGEMODE_PAGE="src/features/stage/pages/StageMode.jsx"
OVERLAY_FILES=(
  "src/features/stage/pages/Overlay.jsx"
  "src/features/stage/components/OverlayView.jsx"
)

FINDINGS_MAX=10
SOURCE_INCLUDES=(--include='*.js' --include='*.jsx' --include='*.ts'
  --include='*.tsx' --include='*.css' --include='*.html')

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

for required in "$SRC_DIR" "$TAILWIND_CONFIG"; do
  if [ ! -e "$required" ]; then
    printf 'FAIL  setup    expected path missing: %s\n' "$required" >&2
    printf 'FAIL  setup    run this from a CEMURM checkout, not a partial copy\n' >&2
    exit 1
  fi
done

FAILURES=0
PASSED=0

# ---------------------------------------------------------------------------
# OUTPUT
# ---------------------------------------------------------------------------
pass() { printf 'PASS  %-4s %-50s %s\n' "$1" "$2" "$3"; }
fail() { printf 'FAIL  %-4s %-50s %s\n' "$1" "$2" "$3"; }
warn() { printf 'WARN  %-4s %-50s %s\n' "$1" "$2" "$3"; }
note() { printf '        %s\n' "$1"; }

# show_findings <findings-file>
# A failing or warning check must name the offending file and line.
show_findings() {
  local file="$1" total shown
  total="$(grep -c '' "$file" 2>/dev/null || true)"
  [ "$total" -gt 0 ] || return 0
  shown=0
  while IFS= read -r hit; do
    shown=$((shown + 1))
    if [ "$shown" -le "$FINDINGS_MAX" ]; then
      note "$hit"
    fi
  done <"$file"
  if [ "$total" -gt "$FINDINGS_MAX" ]; then
    note "... and $((total - FINDINGS_MAX)) more"
  fi
}

# scan <pattern> <path> -> writes findings, echoes the match count
scan() {
  local pattern="$1" target="$2" count
  : >"$TMP_DIR/findings"
  grep -rnoE "${SOURCE_INCLUDES[@]}" -e "$pattern" "$target" 2>/dev/null \
    >"$TMP_DIR/findings" || true
  count="$(grep -c '' "$TMP_DIR/findings" 2>/dev/null || true)"
  printf '%s' "$count"
}

# verify <id> <mode> <label> <count> [ceiling] -> 0 if not failing, 1 if failing
# The single dispatch point that turns a mode into pass / fail / warn. It also
# owns the FAILURES/PASSED accounting, so changing a mode can never silently
# stop the gate from failing.
verify() {
  local id="$1" mode="$2" label="$3" count="$4" ceiling="${5:-}"
  local noun="occurrences"
  [ "$count" -eq 1 ] && noun="occurrence"

  case "$mode" in
    enforcing)
      if [ "$count" -eq 0 ]; then
        pass "$id" "$label" "0 $noun"
        PASSED=$((PASSED + 1))
        return 0
      fi
      fail "$id" "$label" "$count $noun"
      show_findings "$TMP_DIR/findings"
      FAILURES=$((FAILURES + 1))
      return 1
      ;;
    ratchet)
      if [ "$count" -le "$ceiling" ]; then
        warn "$id" "$label" "$count $noun (ceiling $ceiling)"
        PASSED=$((PASSED + 1))
        return 0
      fi
      fail "$id" "$label" "$count $noun, over ceiling $ceiling by $((count - ceiling))"
      show_findings "$TMP_DIR/findings"
      # A ratchet overage is a delta against a baseline, not a short list, so the
      # first N findings are usually pre-existing debt and hide the new one.
      note "the $((count - ceiling)) new occurrence(s) are mixed in with the $ceiling already tolerated."
      note "narrow it down with the rule's own pattern, or diff against the commit that set the ceiling."
      FAILURES=$((FAILURES + 1))
      return 1
      ;;
    report)
      warn "$id" "$label" "$count $noun (report-only, does not fail)"
      PASSED=$((PASSED + 1))
      return 0
      ;;
    *)
      fail "$id" "$label" "unknown mode '$mode' in the RULE MODES block"
      FAILURES=$((FAILURES + 1))
      return 1
      ;;
  esac
}

printf 'visual contract gate  repo: %s\n\n' "$REPO_ROOT"

# ---------------------------------------------------------------------------
# RULE 01A -- no raw colour literals in src/
# ---------------------------------------------------------------------------
# Hex: 4, 6 and 8 digits, plus 3 digits containing at least one a-f. The
# 3-digit form deliberately requires a letter. src/ carries ~200 "#NN" work
# item references in comments (Hito 4 #151, Hito 5 #66, PR#2b); a 3-digit
# all-numeric token is indistinguishable from a ticket number, and a gate that
# blocks CI on `issue #151` is a gate that gets bypassed. Every real colour
# literal in this repo is 6 digits.
# Functions: rgb/rgba/hsl/hsla/oklch/oklab/lab/lch/hwb/color-mix, anchored on a
# non-word preceding character so identifiers ending in those letters are not
# false positives -- `optimisticCollab(` in src/data/repositories/setlists.js
# is the case that forced the anchor.
HEX_PATTERN='#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[a-fA-F][0-9a-fA-F]{2}\b|#[0-9][a-fA-F][0-9]\b|#[0-9]{2}[a-fA-F]\b'
FN_PATTERN='(^|[^A-Za-z0-9_-])(oklch|oklab|lab|lch|hwb|color-mix|rgba?|hsla?)\('
: >"$TMP_DIR/findings"
grep -rnoE "${SOURCE_INCLUDES[@]}" -e "$HEX_PATTERN" -e "$FN_PATTERN" \
  "$SRC_DIR" >"$TMP_DIR/findings" 2>/dev/null || true
count_01a="$(grep -c '' "$TMP_DIR/findings" 2>/dev/null || true)"
verify 01a "$RULE_01A_RAW_COLOUR_LITERALS" \
  "no raw colour literals in src/" "$count_01a" || true

# ---------------------------------------------------------------------------
# RULE 01B -- no Tailwind default-palette utilities in src/
# ---------------------------------------------------------------------------
# bg-black, text-white/70, border-white/20: hardcoded values wearing utility
# syntax. They bypass the token layer without tripping rule 01A.
PALETTE_PATTERN='(^|[^A-Za-z0-9_-])(bg|text|border|ring|fill|stroke|shadow|divide|outline|decoration|accent|caret|placeholder|from|via|to)-(black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-[0-9]{2,3})?(/[0-9]{1,3})?\b'
count_01b="$(scan "$PALETTE_PATTERN" "$SRC_DIR")"
verify 01b "$RULE_01B_TAILWIND_PALETTE" \
  "no Tailwind default-palette utilities in src/" "$count_01b" \
  "$RATCHET_01B_MAX" || true

# ---------------------------------------------------------------------------
# RULE 02 -- the four dead accents
# ---------------------------------------------------------------------------
# Both syntaxes count, because both are "use of the accent": the JS object form
# `cem.rose` and the Tailwind class form `cem-rose`. The class form is the one
# that actually appears in JSX, and it is the one a future migration will have
# to find.
DEAD_ACCENT_PATTERN='\bcem[-.](coral|emerald|rose|sky)\b'
count_02="$(scan "$DEAD_ACCENT_PATTERN" "$SRC_DIR")"
verify 02 "$RULE_02_DEAD_ACCENTS" \
  "no use of the four dead accents in src/" "$count_02" \
  "$RATCHET_02_MAX" || true

# ---------------------------------------------------------------------------
# RULE 03 -- the projector surface stays chrome-free
# ---------------------------------------------------------------------------
# No rounded*, shadow*, backdrop-* or gradient* in the OBS overlay files.
# Comment lines are filtered out, and that is the whole reason the rule is
# written this way: these files are ABOUT being chrome-free, so a future
# maintainer will very plausibly write "no rounded corners here" in a comment,
# and a gate that blocks CI on its own documentation gets bypassed. Filtering
# comments instead of scoping to `className` also means a class name held in a
# variable, or a className spread over several lines, is still caught.
# Allowlisted hits are printed, not silently dropped, so an exception is always
# visible in the CI log.
CHROME_PATTERN='(rounded|shadow|backdrop|gradient)'
# The `^[^:]*:[0-9]+:` prefix is load-bearing. grep -nH emits
# "src/.../Overlay.jsx:53:// comment" before this filter runs, so an anchor that
# ignores the filename never matches and every comment line survives. Keep the
# prefix in step with the grep flags above.
COMMENT_PATTERN='^[^:]*:[0-9]+:[[:space:]]*(//|/\*|\*|<!--|\{/\*)'
: >"$TMP_DIR/findings"
: >"$TMP_DIR/unexcused"
: >"$TMP_DIR/allowlisted"
for overlay in "${OVERLAY_FILES[@]}"; do
  if [ ! -e "$overlay" ]; then
    fail 03 "projector surface stays chrome-free" "expected file missing: $overlay"
    FAILURES=$((FAILURES + 1))
    continue
  fi
  # -H forces the filename prefix; without it grep omits it for a single file.
  # -o is deliberately NOT used: it would truncate the finding to the matched
  # span (`className="rounded`), which loses the utility suffix the allowlist
  # match needs and shows the reviewer a useless fragment.
  grep -nHE -e "$CHROME_PATTERN" "$overlay" 2>/dev/null \
    | grep -vE -e "$COMMENT_PATTERN" >>"$TMP_DIR/findings" || true
done
while IFS= read -r hit; do
  [ -n "$hit" ] || continue
  hit_file="${hit%%:*}"
  hit_rest="${hit#*:}"
  hit_line="${hit_rest%%:*}"
  hit_text="${hit_rest#*:}"
  excused=0
  for entry in "${OVERLAY_CHROME_ALLOWLIST[@]}"; do
    entry_file="${entry%%|*}"
    entry_token="${entry##*|}"
    if [ "$hit_file" = "$entry_file" ] \
      && printf '%s' "$hit_text" | grep -q -- "$entry_token"; then
      excused=1
      break
    fi
  done
  if [ "$excused" -eq 1 ]; then
    printf 'allowlisted: %s:%s: %s\n' "$hit_file" "$hit_line" "$entry_token" \
      >>"$TMP_DIR/allowlisted"
  else
    printf '%s:%s: %s\n' "$hit_file" "$hit_line" "$hit_text" \
      >>"$TMP_DIR/unexcused"
  fi
done <"$TMP_DIR/findings"
count_03="$(grep -c '' "$TMP_DIR/unexcused" 2>/dev/null || true)"
raw_03="$(grep -c '' "$TMP_DIR/findings" 2>/dev/null || true)"
allowed_03="$(grep -c '' "$TMP_DIR/allowlisted" 2>/dev/null || true)"
# verify decides pass/fail from RULE_03_OVERLAY_CHROME, exactly like every other
# rule, so flipping that declaration to `report` genuinely downgrades rule 03.
# It reads $TMP_DIR/findings for the failure listing, so hand it the unexcused
# set; the allowlisted hits are printed separately below, never silently
# dropped.
cp "$TMP_DIR/unexcused" "$TMP_DIR/findings"
verify 03 "$RULE_03_OVERLAY_CHROME" \
  "projector surface stays chrome-free" "$count_03" || true
note "overlay chrome: $raw_03 hit(s) in the OBS files, $allowed_03 allowlisted, $count_03 unexcused"
if [ "$allowed_03" -gt 0 ]; then
  while IFS= read -r line; do note "$line"; done <"$TMP_DIR/allowlisted"
fi

# ---------------------------------------------------------------------------
# RULE 04 -- the token palette may not silently grow
# ---------------------------------------------------------------------------
# Every colour key declared in tailwind.config.js must be allowlisted. Only keys
# whose value is a hex literal are collected, which makes the scan immune to
# the nesting: in this config every hex is a colour token, and a new namespace
# (a fifth accent, or a second scale) is caught as reliably as a new leaf.
: >"$TMP_DIR/keys"
: >"$TMP_DIR/findings"
# A key may be quoted and hyphenated -- JS requires quotes for any identifier
# that is not [A-Za-z0-9_], and cem.secondary-elevated is exactly that. Without
# the optional quotes and the hyphen, a quoted key is not merely missed by rule
# 04: rule 05 never reads its VALUE either, so the matrix prints n/a and 05a
# fails with "matrix is N scored cell(s) short" -- verified, not theorised. The
# quote characters are non-capturing, so BASH_REMATCH[1] and [2] keep the
# meaning they had before and the walk below needed no other change.
leaf_regex='^[[:space:]]*["'"'"'`]?([A-Za-z0-9_-]+)["'"'"'`]?[[:space:]]*:[[:space:]]*["'"'"'`]#'
# The value half of the same line, captured separately so the leaf and value
# regexes can stay independently anchored. Group 1 is the leaf name, group 2
# the quoted literal. Deliberately greedy up to the closing quote so a value
# rule 05 cannot read (a var() reference, a gradient, a non-hex function) still
# arrives intact and is reported as unreadable instead of being dropped.
leaf_value_regex='^[[:space:]]*["'"'"'`]?([A-Za-z0-9_-]+)["'"'"'`]?[[:space:]]*:[[:space:]]*["'"'"'`]([^"'"'"'`]*)["'"'"'`]'
ns_regex='^[[:space:]]*([A-Za-z0-9_]+)[[:space:]]*:[[:space:]]*\{'

# The dotted key path is accumulated in a plain string ("cem.", then
# "cem.stage.") and popped a segment at a time, rather than tracked in a bash
# array. An array is the obvious choice and it is wrong here: reading the array
# from inside a function during this loop observes it as empty, so every key
# resolved to a bare leaf name and the allowlist never matched. A string is
# also one fewer moving part to reason about in a gate.
prefix=""
in_colors=0
lineno=0
while IFS= read -r line; do
  lineno=$((lineno + 1))
  if [ "$in_colors" -eq 0 ]; then
    if [[ "$line" =~ colors:[[:space:]]*\{ ]]; then in_colors=1; fi
    continue
  fi
  # Rule 05 consumes the token VALUES from this same walk, so the nesting logic
  # that resolves "cem.stage.bg" to its value lives in exactly one place. This
  # match is deliberately SEPARATE from and independent of leaf_regex above:
  # leaf_regex only matches a value that begins with "#", so a token written as
  # 'rgb(148 163 184)' or var(--x) would be invisible to it. Matching on the
  # quoted value alone is what lets rule 05 see such a token and report it as
  # unreadable rather than silently dropping the cell. Both branches are needed:
  # one finds keys, the other finds values.
  if [[ "$line" =~ $leaf_value_regex ]]; then
    printf '%s\t%s\n' "${prefix}${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" \
      >>"$TMP_DIR/token_values"
  fi
  if [[ "$line" =~ $leaf_regex ]]; then
    leaf="${BASH_REMATCH[1]}"
    path="${prefix}${leaf}"
    printf '%s\n' "$path" >>"$TMP_DIR/keys"
    if ! printf '%s\n' "${TAILWIND_COLOUR_KEY_ALLOWLIST[@]}" | grep -qx -- "$path"; then
      printf '%s:%s: undeclared colour key "%s"\n' \
        "$TAILWIND_CONFIG" "$lineno" "$path" >>"$TMP_DIR/findings"
    fi
    continue
  fi
  if [[ "$line" =~ $ns_regex ]]; then
    prefix="${prefix}${BASH_REMATCH[1]}."
    continue
  fi
  if [ "${line//[^}]/}" != "$line" ] && [ -n "$prefix" ]; then
    prefix="${prefix%.*}."
  fi
done <"$TAILWIND_CONFIG"

count_04="$(grep -c '' "$TMP_DIR/findings" 2>/dev/null || true)"
verify 04 "$RULE_04_PALETTE_GROWTH" \
  "no undeclared colour keys in $TAILWIND_CONFIG" "$count_04" || true

# ---------------------------------------------------------------------------
# RULE 05 -- WCAG 2.x contrast for every foreground-on-background token pair
# ---------------------------------------------------------------------------
# The palette is specified as a set of tokens, and nothing in the config
# declares which token is legal text on which token as a surface. That is
# exactly the class of defect the token layer exists to prevent, so the gate
# measures it instead of trusting it.
#
# Values are read from $TMP_DIR/token_values, produced by rule 04's walk, so
# editing a hex in tailwind.config.js changes the number reported here on the
# next run. There is no second copy of the palette to drift.
#
# MODES. Split deliberately in two, not one rule with a mixed verdict:
#   05a anchor, cem.text on every background -- ENFORCING. It passes today, and
#        it is the checker's own self-test. cem.text is the body-copy
#        foreground; if it ever drops under the floor, the arithmetic is broken
#        and every other cell is noise, so this must be a hard failure rather
#        than a warning that scrolls past.
#   05b every other pair -- REPORT. The interesting finding is that 12 of 28
#        pairs are already under 4.5:1, and the real one is not the amber accent
#        but cem.secondary, which is body text at 2.96:1 on cem.hover. Making
#        this enforcing on day one fails CI over debt that predates the gate,
#        and a gate that is red on arrival gets deleted. Reported, it becomes a
#        measured baseline: a future token change that makes it worse is visible
#        in the diff of this output, and one that improves it is visible too.
#        When the count reaches 0, promote 05b to enforcing and it becomes a
#        regression guard for free -- that promotion is the point of the count.
#
# Threshold: CONTRAST_MIN, set in the parameters block, with the WCAG citation
# and the reason this gate holds the normal-text floor instead of the large-text
# 3:1 relaxation.
#
# AWK PORTABILITY. Ubuntu ships mawk by default and gawk is not guaranteed on the
# runner, so this uses only POSIX awk: no gensub(), no strtonum(), no \s, no
# arrays of arrays. Hex is decoded through an index() lookup on the digit
# alphabet, which is portable and avoids the leading-zero octal trap that would
# silently turn "#0f172a" into something else. exp/log stand in for the ^2.4
# sRGB transfer exponent; ^ is a POSIX operator, but the power() form is used
# for clarity. Nothing here writes to a file outside $TMP_DIR.
#
# THE -v FLAGS ARE LOAD-BEARING, and this was measured rather than assumed. The
# parameters are passed with -v BEFORE the program text, NOT as bare
# "name=value" operands after it. An assignment operand is applied when awk
# reaches it on the command line, which is after BEGIN has already run, so
# split(fgs, ...) inside BEGIN sees an empty string, the matrix silently scores
# 0 pairs, and the gate prints a clean PASS over a check that never ran. That
# is the worst possible failure for a contrast rule and it is invisible: no
# error, no warning, no crash. --assign has the same defect, and so does -v
# placed after the program text, which awk reads as an input filename. Only
# leading -v is applied before BEGIN.
#
# awk creates a redirected output file on its first write, so a category with
# zero findings would leave no file at all and every reader below would fail on
# a missing path. Pre-creating all four guarantees that "no findings" is an
# empty file rather than an absent one. awk's ">" truncates on first open, so
# this is not overwritten by stale content.
: >"$TMP_DIR/contrast_matrix"
: >"$TMP_DIR/contrast_findings"
: >"$TMP_DIR/contrast_skipped"
: >"$TMP_DIR/contrast_summary"
# -v flags lead the program text, per the note above.
awk -v min="$CONTRAST_MIN" \
  -v fgs="$CONTRAST_FG_TOKENS" \
  -v bgs="$CONTRAST_BG_TOKENS" \
  -v anchor="$CONTRAST_ANCHOR_FG" \
  -v matrix="$TMP_DIR/contrast_matrix" \
  -v failfile="$TMP_DIR/contrast_findings" \
  -v skipfile="$TMP_DIR/contrast_skipped" \
  -v summary="$TMP_DIR/contrast_summary" '
function hexdigit(c,   p) {
  # One hex character -> 0..15. Portable and correct for "0f"; a numeric cast
  # of "0f" would be 0, and that mistake makes every dark token look black.
  p = index("0123456789abcdef", tolower(c))
  return (p == 0) ? -1 : p - 1
}
function byte(h, i) {
  return hexdigit(substr(h, i, 1)) * 16 + hexdigit(substr(h, i + 1, 1))
}
function chan(v,   c) {
  # WCAG 2.x: c = v/255, then linear below 0.03928, else ((c+0.055)/1.055)^2.4
  c = v / 255
  if (c <= 0.03928) return c / 12.92
  # The (c + 0.055) / 1.055 sRGB offset is applied HERE, inside pow. Writing
  # pow(c, 2.4) instead silently drops it, and the error is not a crash: every
  # channel comes out too dark, the ratios come out too HIGH, and a palette
  # that genuinely fails the floor gets reported as passing. This is the exact
  # failure mode a contrast checker must not have, and it is why the matrix is
  # diffed against a hand-computed reference rather than trusted on first run.
  return pow((c + 0.055) / 1.055, 2.4)
}
function lum(h) {
  return 0.2126 * chan(byte(h, 2)) + 0.7152 * chan(byte(h, 4)) \
       + 0.0722 * chan(byte(h, 6))
}
function ratio(fg, bg,   lf, lb, t) {
  lf = lum(fg); lb = lum(bg)
  if (lf < lb) { t = lf; lf = lb; lb = t }
  # WCAG 2.x: (L1 + 0.05) / (L2 + 0.05), L1 the lighter of the two.
  return (lf + 0.05) / (lb + 0.05)
}
function pow(a, b) { return exp(b * log(a)) }
function normalise(h,   s, out, i, c) {
  # Accept #rgb and #rrggbb, with or without the leading hash, any case.
  # Returns "" for anything else, which the caller reports as unreadable. It
  # never guesses: an unreadable token is skipped loudly, never approximated.
  s = tolower(h)
  sub(/^#/, "", s)
  if (s ~ /^[0-9a-f][0-9a-f][0-9a-f]$/) {
    out = ""
    for (i = 1; i <= 3; i++) { c = substr(s, i, 1); out = out c c }
    return "#" out
  }
  if (s ~ /^[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]$/) return "#" s
  return ""
}
BEGIN {
  # TAB-separated input: the value is the rest of the line, so a token written
  # as "rgb(148 163 184)" arrives whole. On awk default field splitting the
  # value would be cut at the first space and the skip message would name a
  # colour the author never wrote.
  FS = "\t"
  min_ratio = min + 0
  nrows = split(fgs, FG, " ")
  ncols = split(bgs, BG, " ")
}
{
  # input is "path<TAB>rawvalue"; FS is set in BEGIN so a value with spaces
  # stays intact.
  path = $1
  raw = $2
  hex = normalise(raw)
  if (hex == "") {
    # Only a token the matrix actually consumes is worth a message; an
    # unreadable token outside the matrix belongs to rule 04, not to a
    # contrast gap. The leaf is compared against the axis names, not the
    # dotted paths: FG holds "text", the input path is "cem.text".
    leaf = path
    sub(/^cem\./, "", leaf)
    sub(/^stage\./, "", leaf)
    needed = 0
    for (i = 1; i <= nrows; i++) if (FG[i] == leaf) needed = 1
    for (i = 1; i <= ncols; i++) if (BG[i] == leaf) needed = 1
    if (needed) {
      shown = (raw == "") ? "empty" : raw
      printf "%s\tvalue is not a plain hex literal (%s); not scored\n", \
        path, shown > skipfile
    }
    next
  }
  TOKEN[path] = hex
}
END {
  # Header + the full matrix. Every pair is printed, not only the failures, so
  # the state of the palette is legible at a glance and a reader can see how
  # close a passing cell is to the floor. A cell under the floor gets a "*".
  line = sprintf("        %-10s", "fg \\ bg")
  for (c = 1; c <= ncols; c++) line = line sprintf("%10s", BG[c])
  print line > matrix
  below = 0
  anchor_below = 0
  pairs = 0
  unscored = 0
  for (r = 1; r <= nrows; r++) {
    line = sprintf("        %-10s", FG[r])
    for (c = 1; c <= ncols; c++) {
      if (!(("cem." FG[r]) in TOKEN) || !(("cem." BG[c]) in TOKEN)) {
        line = line sprintf("%10s", "n/a")
        unscored++
        continue
      }
      v = ratio(TOKEN["cem." FG[r]], TOKEN["cem." BG[c]])
      pairs++
      mark = (v < min_ratio) ? "*" : " "
      if (v < min_ratio) {
        below++
        if (FG[r] == anchor) anchor_below++
        # Findings are named with both hexes so a reviewer can verify the ratio
        # by hand without re-running the gate.
        printf "%s (%s) on %s (%s) = %.2f:1, under %.1f:1\n", \
          FG[r], TOKEN["cem." FG[r]], BG[c], TOKEN["cem." BG[c]], v, min_ratio > failfile
      }
      line = line sprintf("%9.2f%s", v, mark)
    }
    print line > matrix
  }
  close(matrix)
  printf "%d %d %d %d\n", below, anchor_below, pairs, unscored > summary
  close(summary)
  close(failfile)
  close(skipfile)
}
' "$TMP_DIR/token_values" || true

: >"$TMP_DIR/findings"
if [ -s "$TMP_DIR/contrast_skipped" ]; then
  # A token the matrix could not read is a hole in the coverage. It is reported
  # as WARN, never FAIL: an unreadable value is a config-authoring problem, and
  # guessing a colour to make a check pass would be worse than reporting it.
  while IFS= read -r skipped; do
    [ -n "$skipped" ] || continue
    warn 05a "unreadable token value, pair not scored" "$skipped"
  done <"$TMP_DIR/contrast_skipped"
fi

# The anchor is a subset of the findings, so it needs its own count. Reading
# both from the same findings file is what keeps 05a honest: it cannot report
# zero while 05b reports the same cell as failing, because they are the same
# number, filtered.
anchor_findings="$TMP_DIR/contrast_anchor"
: >"$anchor_findings"
if [ -s "$TMP_DIR/contrast_findings" ]; then
  grep -E "^${CONTRAST_ANCHOR_FG} " "$TMP_DIR/contrast_findings" \
    >"$anchor_findings" || true
fi
# An anchor that could not be READ is not a passing anchor. 05a counts only
# scored pairs, so if cem.text itself is unreadable the count is 0 and an
# enforcing rule would print PASS over a row that was never evaluated -- the
# same vacuous pass as the -v bug above, reached by a different route. Any
# unscored cell in the matrix is therefore injected into 05a's findings, so an
# incomplete matrix fails the enforcing rule instead of quietly shrinking.
if [ -s "$TMP_DIR/contrast_summary" ]; then
  read -r _below _anchor scored_pairs unscored_pairs <"$TMP_DIR/contrast_summary"
  if [ "${unscored_pairs:-0}" -gt 0 ]; then
    printf 'matrix is %s scored cell(s) short: the anchor row is incomplete, not passing\n' \
      "$unscored_pairs" >>"$anchor_findings"
  fi
fi

: >"$TMP_DIR/findings"
cp "$anchor_findings" "$TMP_DIR/findings"
verify 05a "$RULE_05A_TEXT_CONTRAST" \
  "cem.$CONTRAST_ANCHOR_FG clears $CONTRAST_MIN:1 on every background" \
  "$(grep -c '' "$anchor_findings" 2>/dev/null || true)" || true
if [ -s "$TMP_DIR/contrast_matrix" ]; then
  while IFS= read -r row; do note "$row"; done <"$TMP_DIR/contrast_matrix"
fi

# 05b counts every under-floor pair, anchor included, so the total below is
# visible in one number and matches the matrix the reader just saw.
: >"$TMP_DIR/findings"
cp "$TMP_DIR/contrast_findings" "$TMP_DIR/findings"
count_05b="$(grep -c '' "$TMP_DIR/contrast_findings" 2>/dev/null || true)"
verify 05b "$RULE_05B_PALETTE_CONTRAST" \
  "every fg/bg token pair clears $CONTRAST_MIN:1" "$count_05b" || true
if [ -s "$TMP_DIR/contrast_summary" ]; then
  read -r below_pairs _anchor_pairs scored_pairs unscored_pairs \
    <"$TMP_DIR/contrast_summary"
  note "contrast: $scored_pairs pair(s) scored, $below_pairs under $CONTRAST_MIN:1, ${unscored_pairs:-0} unscored"
  note "WCAG 2.x AA, normal text (SC 1.4.3). The 3:1 large-text relaxation is not used."
fi
if [ "$count_05b" -gt 0 ]; then
  show_findings "$TMP_DIR/contrast_findings"
  note "these are measured findings, not new debt: see odd/tasks/visual-system-macos.md 13."
  note "cem.secondary is the body-text one; the accents are deprioritised by rule 02."
fi

# ---------------------------------------------------------------------------
# RULE 06 -- no text-cem-secondary on an elevated or hover fill
# ---------------------------------------------------------------------------
# The measured defect: 52 elements paired cem.secondary (#94a3b8) with
# cem.elevated or cem.hover in the SAME className string, at 4.04:1 and
# 2.96:1. Both are under the 4.5:1 AA floor and none of them is large text, so
# the 3:1 relaxation does not apply to any of them. Fixed by moving 47 chips and
# labels to cem.secondary-elevated (5.38:1) and 5 real sentences to cem.text
# (9.90:1); the baseline is 0, so this is enforcing.
#
# MECHANISM. Two greps and a filter, reusing machinery this script already has
# rather than a parallel one:
#   * COMMENT_PATTERN, verbatim from rule 03. grep -rnH emits
#     "src/.../SlideView.jsx:38:<span ...>", so the `^[^:]*:[0-9]+:` prefix
#     still anchors to the same place for a recursive scan as it does for rule
#     03's per-file scan. A gate that flagged a comment explaining this rule
#     would be a gate that gets bypassed, and these files will document it.
#   * SOURCE_INCLUDES, so the file set cannot drift from rules 01a/01b/02.
# The two greps are a pipeline, not a combined alternation, because the rule is
# an AND: a line must carry an unprefixed text-cem-secondary AND a raised fill.
# One grep with both alternatives would be an OR and would report every
# secondary label in src/.
#
# KNOWN LIMITS, so a future reader does not mistake this for full coverage.
#   * Line granularity. A line is assumed to be one className string. In this
#     tree that holds: 0 of the 52 fixed sites had two className= on a line, and
#     the 3 lines repo-wide that do are not rule 06 sites. A line carrying two
#     different elements could in principle be a false positive.
#   * It cannot see a descendant. A text-cem-secondary inside a
#     bg-cem-elevated ancestor is a real defect this rule does not detect, and
#     the count of those is recorded, unresolved, in
#     odd/tasks/visual-system-macos.md 16. Treat 0 here as "no same-element
#     pairing", never as "the contrast defect is closed".
#   * Class names composed at runtime through variables that this grep cannot
#     resolve are out of scope, as they are for every rule in this script.
: >"$TMP_DIR/findings"
grep -rnHE "${SOURCE_INCLUDES[@]}" -e "$CONTRAST_DEFECT_FG_PATTERN" "$SRC_DIR" \
  2>/dev/null \
  | grep -E -e "$CONTRAST_DEFECT_BG_PATTERN" \
  | grep -vE -e "$COMMENT_PATTERN" >>"$TMP_DIR/findings" || true
count_06="$(grep -c '' "$TMP_DIR/findings" 2>/dev/null || true)"
verify 06 "$RULE_06_SECONDARY_ON_RAISED_FILL" \
  "no text-cem-secondary on an elevated/hover fill" "$count_06" || true
note "use text-cem-secondary-elevated (5.38:1) on a raised fill, or text-cem-text for sentences."

# ---------------------------------------------------------------------------
# REPORT-ONLY -- StageMode.jsx chrome
# ---------------------------------------------------------------------------
# The musician's tablet surface. Rounded corners and shadows are legitimate
# there (it is a touch target, not a projection), so it is explicitly out of
# rule 03's scope. Tracked so the count stays visible and can be ratcheted down
# separately from the projector surface.
stagemode_rounded=0
stagemode_shadow=0
if [ -e "$STAGEMODE_PAGE" ]; then
  stagemode_rounded="$(grep -cE 'rounded' "$STAGEMODE_PAGE" 2>/dev/null || true)"
  stagemode_shadow="$(grep -cE 'shadow' "$STAGEMODE_PAGE" 2>/dev/null || true)"
else
  note "expected file missing: $STAGEMODE_PAGE"
fi
: >"$TMP_DIR/findings"
verify r1 "$REPORT_STAGEMODE_CHROME" \
  "StageMode.jsx rounded* lines (out of rule 03 scope by design)" \
  "$stagemode_rounded" || true
note "StageMode.jsx: $stagemode_rounded rounded* line(s), $stagemode_shadow shadow* line(s)"

# ---------------------------------------------------------------------------
# REPORT-ONLY -- declared token count
# ---------------------------------------------------------------------------
# Distinct colour keys declared in tailwind.config.js. Paired with rule 04:
# rule 04 blocks a key that is not allowlisted, this reports the size of the
# palette so growth is visible in the log even when it is legitimate.
total_tokens="$(grep -c '' "$TMP_DIR/keys" 2>/dev/null || true)"
: >"$TMP_DIR/findings"
verify r2 "$REPORT_CONFIG_TOKEN_COUNT" \
  "distinct colour tokens in $TAILWIND_CONFIG" "$total_tokens" || true
note "token inventory: $(tr '\n' ' ' <"$TMP_DIR/keys")"

# ---------------------------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------------------------
printf '\n'
if [ "$FAILURES" -gt 0 ]; then
  printf 'visual contract: FAILED  (%s failing, %s non-failing)\n' \
    "$FAILURES" "$PASSED"
  exit 1
fi
printf 'visual contract: OK  (%s rules checked, 0 failing)\n' "$PASSED"
exit 0
