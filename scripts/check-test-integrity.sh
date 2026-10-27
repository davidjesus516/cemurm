#!/usr/bin/env bash
#
# check-test-integrity.sh -- ADR-006, with machine teeth.
#
# WHAT THIS IS FOR
# ADR-006 (docs/decisions.md) says a red characterization test is fixed in the
# SOURCE, never in the assertion, and that "editing a test to pass, loosening a
# threshold, or SKIPPING A CASE TO CLEAR A GATE is forbidden". Two of those
# three were enforceable by review and one was not enforceable at all: a
# `.skip`, a `.todo` or a `.only` is not a failing run, it is a suite that
# reports green while testing less. Nothing in the repository could see it.
#
# This script is that something.
#
# WHAT IT BLOCKS
#   .only   narrows the run. Every test outside the focused one silently stops
#           executing, and the run still reports green.
#   .skip   removes a case from the run with no failure anywhere.
#   .todo   marks a case unimplemented; Vitest reports it as skipped, not failed.
#
# Note on .only specifically: Vitest's `allowOnly` defaults to `!isCI`, so `.only`
# DOES fail on the CI runner today. That covers exactly one of these three, on
# one runner, through a default nobody in this repo chose or can see from the
# test file. `.skip` and `.todo` are unguarded by anything.
#
# KNOWN LIMITS, so this gate is not mistaken for full ADR-006 coverage. Both were
# measured against Vitest 5.0.2, not guessed:
#   * `test.skipIf(cond)` is a real API here and is NOT caught. The name does not
#     end at the modifier, so it is a different shape from the three this rule
#     targets. It is a deliberate, named, conditional skip, which is a weaker
#     thing to forbid than an unconditional `.skip` -- but it is a hole, and it
#     is named here rather than left to be discovered.
#   * `it.concurrent.only(...)` is a real API here and is NOT caught: the
#     modifier is not adjacent to the `it`. Same reasoning.
# The rule label deliberately names the three modifiers it actually catches rather
# than claiming "no silenced test", because a gate that overclaims its coverage is
# the exact defect this script exists to remove.
#
# The `xit` / `xdescribe` aliases are deliberately absent: measured as `undefined`
# on Vitest 5.0.2. Catching a spelling that does not exist would be theatre.
#
# HOW TO SCOPE AN INTENTIONAL EXCEPTION
# Do not widen this script. A skipped test is a finding to report (per ADR-006),
# not a condition to configure around. If a case genuinely cannot run on this
# platform, that is a real design question about the suite, not a grep exception.
#
# DEPENDENCIES
# bash and grep only. No package installs, no test runner, no build step. Same
# doctrine as check-visual-contract.sh: this gate must stay cheaper and more
# reliable than the thing it guards -- a check that needs the suite to run
# cannot report that the suite is lying about what it ran.
#
# USAGE
#   bash scripts/check-test-integrity.sh
#   ./scripts/check-test-integrity.sh
# Resolves every path from the script location, so it runs from any cwd.

set -euo pipefail

# ---------------------------------------------------------------------------
# PATH RESOLUTION  -- independent of the caller's working directory
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

SRC_DIR="src"

# Test files only. This is not a scan of the product tree: `foo.skip` on a
# domain object, a `.todo` key on a payload or a `.only` in a comment is not a
# test being silenced, and a gate that blocks CI on those gets bypassed. The
# file set is the boundary that makes the rule precise.
TEST_INCLUDES=(--include='*.test.js' --include='*.test.jsx' --include='*.ts.test.js'
  --include='*.spec.js' --include='*.spec.jsx' --include='*.ts.spec.js')

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

if [ ! -e "$SRC_DIR" ]; then
  printf 'FAIL  setup    expected path missing: %s\n' "$SRC_DIR" >&2
  printf 'FAIL  setup    run this from a CEMURM checkout, not a partial copy\n' >&2
  exit 1
fi

FINDINGS_MAX=10

# ---------------------------------------------------------------------------
# PATTERNS
# ---------------------------------------------------------------------------
# The test API is anchored, not bare `.skip`. A bare \.skip matches any object
# with a skip method and any payload key called `todo`, which in a domain tree
# full of orchestration objects is not a rare shape. Anchoring to the four
# Vitest/Jest entry points keeps the rule about tests.
#
# It is anchored on a LEADING non-identifier character rather than requiring a
# statement start: a test call is routinely preceded by `return`, `await`, `=>`,
# `(` or whitespace, and requiring line-start would miss the common shapes.
# A leading `.` is excluded so `test.only` is still matched while `my.it.skip`
# (a property chain on something else) is not the target of this rule.
TEST_API_PATTERN='(^|[^A-Za-z0-9_$.])(it|test|describe|suite)\.((only|skip|todo)\b)'
# Comment filter, same shape and same reasoning as check-visual-contract.sh
# rule 03: these files are ABOUT not silencing tests, so a maintainer will
# plausibly write "never use describe.skip" in a comment, and a gate that
# blocks CI on its own documentation is a gate that gets bypassed. The
# `^[^:]*:[0-9]+:` prefix is load-bearing -- grep -rnH emits
# "src/.../foo.test.js:42:// comment" and an anchor that ignores the filename
# never matches.
COMMENT_PATTERN='^[^:]*:[0-9]+:[[:space:]]*(//|/\*|\*|\*/|<!--|\{/\*)'

# ---------------------------------------------------------------------------
# OUTPUT
# ---------------------------------------------------------------------------
pass() { printf 'PASS  %-4s %-50s %s\n' "$1" "$2" "$3"; }
fail() { printf 'FAIL  %-4s %-50s %s\n' "$1" "$2" "$3"; }
note() { printf '        %s\n' "$1"; }

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

printf 'test integrity gate  repo: %s\n\n' "$REPO_ROOT"

# ---------------------------------------------------------------------------
# RULE 01 -- no silenced test
# ---------------------------------------------------------------------------
: >"$TMP_DIR/findings"
grep -rnHE "${TEST_INCLUDES[@]}" -e "$TEST_API_PATTERN" "$SRC_DIR" 2>/dev/null \
  | grep -vE -e "$COMMENT_PATTERN" >>"$TMP_DIR/findings" || true
count="$(grep -c '' "$TMP_DIR/findings" 2>/dev/null || true)"

if [ "$count" -eq 0 ]; then
  pass 01 "no .only/.skip/.todo in src/ tests" "0 occurrences"
  note "test files scanned: $(grep -rlE '' "${TEST_INCLUDES[@]}" "$SRC_DIR" 2>/dev/null | grep -c '' || true)"
  printf '\n'
  printf 'test integrity: OK  (1 rule checked, 0 failing)\n'
  exit 0
fi

fail 01 "no .only/.skip/.todo in src/ tests" "$count occurrence(s)"
show_findings "$TMP_DIR/findings"
note "ADR-006: a red test is fixed in the SOURCE, never in the assertion."
note "A skipped case is not a failing run -- it is a green run that tested less."
note "To fix this: delete the .only/.skip/.todo. Do not widen this script."
printf '\n'
printf 'test integrity: FAILED  (1 failing, 0 non-failing)\n'
exit 1