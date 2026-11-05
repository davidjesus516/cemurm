#!/usr/bin/env bash
#
# Fail when a count stated in AGENTS.md or docs/master-plan.md disagrees with the tree.
#
# Those two files tell the next agent how many migrations and smoke scripts exist and which
# number is free. The numbers have been wrong every time anybody re-counted them -- five times
# in AGENTS.md alone -- because a number in prose is not a gate. `check-migrations-unique.sh`
# exists for the same reason: a stated rule that nothing verifies gets violated, and the
# violation is discovered by whoever happens to re-count.
#
# Bash + grep only, matching the other gates: no install step, no network, so it can run in CI
# without delaying `pnpm test` or `pnpm build`.
#
# Every check prints one line. Exit 0 when the documents agree with the tree, 1 when they do
# not, naming the claim, the documented number and the measured one.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

shopt -s nullglob

fail=0

# chk <claim> <documented> <measured>
chk() {
  if [ "$2" = "$3" ]; then
    printf 'ok    %-28s %s\n' "$1" "$3"
  else
    printf 'FAIL  %-28s documented %s, measured %s\n' "$1" "${2:-<none>}" "$3"
    fail=1
  fi
}

# The last number in the first line FILE matches with PATTERN.
#
# Last, not first: a row like `**47**, 747 scenarios` carries two numbers, and the one the
# claim is about is the second. Patterns that hold a single number are unaffected.
doc_num() {
  local file=$1 pattern=$2
  { grep -m1 -oE "$pattern" "$file" || true; } | grep -oE '[0-9]+' | tail -1
}

# --- measured ---------------------------------------------------------------

migrations=$(printf '%s\n' supabase/migrations/*.sql | wc -l)
smokes=$(printf '%s\n' scripts/smoke/*.sql | wc -l)
features=$(printf '%s\n' features/*.feature | wc -l)
scenarios=$({ grep -hcE '^[[:space:]]*(Scenario|Scenario Outline):' features/*.feature || true; } | awk '{n+=$1} END {print n+0}')

# The lowest number no migration file claims. 0021 and 0022 are free by design and stay
# reserved, so they are skipped rather than reported as the next slot.
next_free() {
  local n padded
  for ((n = 1; n < 10000; n++)); do
    [ "$n" -eq 21 ] && continue
    [ "$n" -eq 22 ] && continue
    padded=$(printf '%04d' "$n")
    local matches=(supabase/migrations/"${padded}"_*.sql)
    if [ ${#matches[@]} -eq 0 ]; then
      printf '%s' "$padded"
      return 0
    fi
  done
  printf '????'
}

free=$(next_free)

# --- AGENTS.md --------------------------------------------------------------

agents=AGENTS.md

chk "AGENTS.md migrations" \
  "$(doc_num "$agents" 'Migrations: \*\*[0-9]+ files on')" "$migrations"
chk "AGENTS.md next free migration" \
  "$(doc_num "$agents" 'next free number is `[0-9]+`')" "$free"
chk "AGENTS.md smoke scripts" \
  "$(doc_num "$agents" 'scripts/smoke/\*\.sql` — \*\*[0-9]+ files')" "$smokes"
chk "AGENTS.md feature files" \
  "$(doc_num "$agents" 'Product truth\. [0-9]+ `\.feature` files')" "$features"
chk "AGENTS.md scenarios" \
  "$(doc_num "$agents" '[0-9]+ scenarios\. The source of what to build')" "$scenarios"

# --- docs/master-plan.md ----------------------------------------------------
# §0 is introduced as the table that was "verified, not read from prose", so the same numbers
# live twice. Correcting one copy and not the other is how the two came to disagree.

plan=docs/master-plan.md

chk "master-plan migrations" \
  "$(doc_num "$plan" 'Migrations on `main` \| \*\*[0-9]+ files')" "$migrations"
chk "master-plan next free migration" \
  "$(doc_num "$plan" 'Next free migration number \| \*\*`[0-9]+`')" "$free"
chk "master-plan smoke scripts" \
  "$(doc_num "$plan" 'Smoke scripts on `main` \| \*\*[0-9]+')" "$smokes"
chk "master-plan feature files" \
  "$(doc_num "$plan" 'Feature files \| \*\*[0-9]+')" "$features"
chk "master-plan scenarios" \
  "$(doc_num "$plan" 'Feature files \| \*\*[0-9]+\*\*, [0-9]+ scenarios')" "$scenarios"

if [ "$fail" -ne 0 ]; then
  printf '\nA document states a count the tree does not have.\n'
  printf 'Fix the document, not this script: the tree is the fact and the prose is a copy.\n'
  exit 1
fi

printf '\ndoc counts: OK (%s migrations, %s smokes, %s features, %s scenarios, %s free)\n' \
  "$migrations" "$smokes" "$features" "$scenarios" "$free"
