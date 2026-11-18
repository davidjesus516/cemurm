#!/usr/bin/env bash
#
# check-table-privileges.sh -- the ACL gate for schema `public`.
#
# WHAT THIS IS FOR
# RLS is tested here three ways (smoke scripts, E2E against a real stack, unit tests over the
# policy SQL). The ACL is tested by nothing, and the two are different layers: RLS decides which
# ROWS a statement may touch, the ACL decides which VERBS exist at all. Four verbs cannot be
# expressed as a policy at all:
#
#   TRUNCATE    evaluates no row predicate, so no policy is consulted. The ACL is the only
#               control that exists.
#   REFERENCES  lets a role attach a foreign key that depends on another table's rows.
#   TRIGGER     lets a role attach code that runs as the table owner.
#   (TRUNCATE is the destructive one; the other two are the ones nobody has ever looked at.)
#
# Supabase's default privileges grant `arwdDxtm` -- all seven -- on every NEW table in `public`
# to `anon`, `authenticated` and `service_role`. So the hole reopens by itself: migration 0048
# is born identical to 0002 unless its author remembers to name `authenticated` in a revoke.
# That is not a reviewer's job, it is a machine check.
#
# WHAT IT ENFORCES
#   01  `authenticated` holds no TRUNCATE, REFERENCES or TRIGGER on any `public` table.
#       No allowlist: there is no legitimate reason for a client role to hold any of the three,
#       and an allowlist of zero cannot rot.
#   02  `anon` holds no table privilege on any `public` table. Measured at 0 today; anon
#       reaches data through `security definer` RPCs, which run as their owner.
#   03  RATCHET: the count of `public` tables where `authenticated` holds DELETE may not grow.
#       Seeded at the measured value. Dozens legitimately DELETE their own rows and RLS narrows
#       each one, so the count may fall and never rise -- without an allowlist nobody maintains.
#   04  WARN ONLY: tables where `authenticated` holds UPDATE at table level rather than
#       columnarly. `feedback` (0046) is the pattern to copy; failing on it today would mean
#       auditing 28 tables at once.
#
# NOT ENFORCED: `service_role` (trusted, by design), functions, sequences, schemas, and
# column-level grants -- rule 04 counts the table-level ones only, because which columns need
# narrowing is a policy decision per table, not a gate.
#
# WHERE IT RUNS: `e2e.yml`, last step of the Chromium job. It needs a live catalog, so `ci.yml`
# (which never starts Supabase) cannot host it; there, `global-setup.js` has already run
# `supabase start` + `supabase db reset`, so the gate costs seconds. Last, not earlier: under
# `set -euo pipefail` a step that fails early marks the rest SKIPPED (#337).
#
# PRECONDITION: a freshly reset stack (`supabase db reset`). Without one this measures whatever
# the last developer left behind, not the schema the repository ships.
#
# DEPENDENCIES: bash, docker, and the `psql` already inside the db container. No installs.
#
# USAGE
#   bash scripts/check-table-privileges.sh
#   CEMURM_DB_CONTAINER=supabase_db_other bash scripts/check-table-privileges.sh

set -euo pipefail

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# The DELETE ratchet. Change this line ONLY downward, and only in a commit that also narrows
# the grants, so the evidence travels with the number. Measured on `main` at 44 migrations
# (2026-11-10): 23. `0047_public_table_privileges.sql` removed the fifth one
# (`account_erasure_requests`), and 22 is what a clean reset measured after it.
DELETE_RATCHET=22

# How many offending table names a failing rule prints before summarising. Same treatment as
# check-test-integrity.sh: the count is the finding, the list is context.
FINDINGS_MAX=10

CONFIG="$REPO_ROOT/supabase/config.toml"
if [ ! -f "$CONFIG" ]; then
  printf 'FAIL  setup    supabase/config.toml not found under %s\n' "$REPO_ROOT" >&2
  exit 1
fi

PROJECT_ID="$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' "$CONFIG" | head -1)"
CONTAINER="${CEMURM_DB_CONTAINER:-supabase_db_${PROJECT_ID:-cemurm}}"
DB_USER="${CEMURM_DB_USER:-postgres}"
DB_NAME="${CEMURM_DB_NAME:-postgres}"

if ! command -v docker >/dev/null 2>&1; then
  printf 'FAIL  setup    docker is not on PATH; this gate needs the local Supabase stack\n' >&2
  exit 1
fi

# The transport, shared by both readers below. stderr is folded into the value on purpose so a
# setup failure can print what actually failed; callers that need a number validate it separately
# (see psql_scalar), callers that want text use this directly.
psql_raw() {
  local sql="$1" out
  if ! out="$(docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
    -X -q -t -A -v ON_ERROR_STOP=1 -c "$sql" 2>&1)"; then
    printf 'FAIL  setup    could not query %s\n' "$CONTAINER" >&2
    printf '        %s\n' "$(printf '%s\n' "$out" | awk 'NR<=3' | tr '\n' ' ')" >&2
    printf "        Is the stack up? Run 'supabase db reset' first: this gate measures the\n" >&2
    printf '        schema the repository ships, not whatever the last session left behind.\n' >&2
    exit 1
  fi
  printf '%s\n' "$out"
}

# Counts only. Every caller feeds the value straight into `-eq` / `-le`, where a stray NOTICE or a
# docker warning would abort bash with "integer expression expected" and exit 2 -- still non-zero,
# but with none of the remediation text this gate is supposed to give. Refuse the value instead,
# in the same shape as every other setup failure. Text queries must use psql_raw: passing a table
# name through this validator would be a setup failure, not a finding.
psql_scalar() {
  local out
  out="$(psql_raw "$1")"
  case "$out" in
    ''|*[!0-9]*)
      printf 'FAIL  setup    %s did not return a number\n' "$CONTAINER" >&2
      printf '        %s\n' "$(printf '%s\n' "$out" | awk 'NR<=3' | tr '\n' ' ')" >&2
      exit 1
      ;;
  esac
  printf '%s\n' "$out"
}

# One shape for every rule: the table set is always the same 61 rows, so the scope of the count
# and the scope of the failure list cannot drift apart.
TABLES="from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p')"

has() { printf "has_table_privilege('%s', c.oid, '%s')" "$1" "$2"; }
# Same predicate with the verb as a row from a set, so the list can live in exactly one place.
has_set() { printf "has_table_privilege('%s', c.oid, v)" "$1"; }

ANY_ANON="($(has anon SELECT) or $(has anon INSERT) or $(has anon UPDATE) or $(has anon DELETE)
           or $(has anon TRUNCATE) or $(has anon REFERENCES) or $(has anon TRIGGER))"

# The three verbs that no policy can refuse. This array is the single source: the counting
# predicate and the failing detail are both generated from it, so a verb cannot be enforced
# without being printed, or printed without being enforced.
UNSAFE_VERBS="array['TRUNCATE','REFERENCES','TRIGGER']"
UNSAFE="exists (select 1 from unnest($UNSAFE_VERBS) v where $(has_set authenticated))"

TOTAL_TABLES="$(psql_scalar "select count(*) $TABLES")"

# A schema with no tables means the migrations were never applied, not that they are clean.
# The same fail-open the migrations gate used to have ("0 files scanned", exit 0): a gate that
# cannot see its input must not report success.
if [ "$TOTAL_TABLES" -le 0 ]; then
  printf 'FAIL  setup    no tables found in schema public on %s\n' "$CONTAINER" >&2
  printf "        Run 'supabase db reset' first: an empty catalog is not a clean one.\n" >&2
  exit 1
fi

UNSAFE_COUNT="$(psql_scalar "select count(*) $TABLES and $UNSAFE")"
ANON_COUNT="$(psql_scalar "select count(*) $TABLES and $ANY_ANON")"
DELETE_COUNT="$(psql_scalar "select count(*) $TABLES and $(has authenticated DELETE)")"
UPDATE_COUNT="$(psql_scalar "select count(*) $TABLES and $(has authenticated UPDATE)")"

pass() { printf 'PASS  %-4s %-46s %s\n' "$1" "$2" "$3"; }
fail() { printf 'FAIL  %-4s %-46s %s\n' "$1" "$2" "$3"; }
warn() { printf 'WARN  %-4s %-46s %s\n' "$1" "$2" "$3"; }
note() { printf '        %s\n' "$1"; }

printf 'table privilege gate  repo: %s\n' "$REPO_ROOT"
printf '  container: %s   schema: public   tables: %s\n\n' "$CONTAINER" "$TOTAL_TABLES"

FAILED=0

# --- 01 ---------------------------------------------------------------------
if [ "$UNSAFE_COUNT" -eq 0 ]; then
  pass 01 "authenticated: no TRUNCATE/REF/TRIGGER" "0 of $TOTAL_TABLES tables"
else
  FAILED=$((FAILED + 1))
  fail 01 "authenticated: no TRUNCATE/REF/TRIGGER" "$UNSAFE_COUNT of $TOTAL_TABLES tables"
  psql_raw "select c.relname || '  ' || coalesce(array_to_string(array(
        select v from unnest($UNSAFE_VERBS) v where $(has_set authenticated)), ','), '')
    $TABLES and $UNSAFE order by c.oid desc" \
    | awk -v max="$FINDINGS_MAX" -v total="$UNSAFE_COUNT" \
      'NR <= max { print } END { if (total > max) printf "... and %d more not shown\n", total - max }' \
    | while IFS= read -r line; do note "$line"; done
  note "RLS cannot refuse any of these three: they are ACL-only, by construction."
  note "Fix: revoke all on table public.<t> from public, anon, authenticated; then grant the"
  note "     minimum. Naming public and anon alone leaves authenticated holding everything."
fi

# --- 02 ---------------------------------------------------------------------
if [ "$ANON_COUNT" -eq 0 ]; then
  pass 02 "anon: no table privilege" "0 of $TOTAL_TABLES tables"
else
  FAILED=$((FAILED + 1))
  fail 02 "anon: no table privilege" "$ANON_COUNT of $TOTAL_TABLES tables"
  psql_raw "select c.relname $TABLES and $ANY_ANON order by c.oid desc" \
    | awk -v max="$FINDINGS_MAX" -v total="$ANON_COUNT" \
      'NR <= max { print } END { if (total > max) printf "... and %d more not shown\n", total - max }' \
    | while IFS= read -r line; do note "$line"; done
  note "anon reads through security-definer RPCs (overlay_state), not through table grants."
fi

# --- 03 ---------------------------------------------------------------------
if [ "$DELETE_COUNT" -le "$DELETE_RATCHET" ]; then
  pass 03 "authenticated DELETE ratchet" "$DELETE_COUNT of $DELETE_RATCHET (may not grow)"
  if [ "$DELETE_COUNT" -lt "$DELETE_RATCHET" ]; then
    note "Ratchet can be tightened: set DELETE_RATCHET=$DELETE_COUNT in the same commit."
  fi
else
  FAILED=$((FAILED + 1))
  fail 03 "authenticated DELETE ratchet" "$DELETE_COUNT > $DELETE_RATCHET (+$((DELETE_COUNT - DELETE_RATCHET)))"
  # Newest first: the table a change just added is the one the reader is looking for, and an
  # alphabetical cap of 10 would hide it behind nine names that legitimately hold DELETE.
  psql_raw "select c.relname $TABLES and $(has authenticated DELETE) order by c.oid desc" \
    | awk -v max="$FINDINGS_MAX" -v total="$DELETE_COUNT" \
      'NR <= max { print } END { if (total > max) printf "... and %d older tables not shown\n", total - max }' \
    | while IFS= read -r line; do note "$line"; done
  note "Newest first, capped at $FINDINGS_MAX names. The count is the finding, not the list:"
  note "$DELETE_RATCHET of these tables legitimately hold DELETE and RLS narrows each one."
  note "If a table this change added appears above, narrow it. DELETE_RATCHET only falls --"
  note "see the constant at the top of this file and the policy in AGENTS.md. Raising it is"
  note "not a remedy this gate offers; it is a decision that needs its own review."
fi

# --- 04 ---------------------------------------------------------------------
warn 04 "authenticated table-level UPDATE" "$UPDATE_COUNT tables (visibility only)"
note "Columnar UPDATE (feedback, 0046) is the shape to copy; this rule does not fail on it."

printf '\n'
if [ "$FAILED" -eq 0 ]; then
  printf 'table privileges: OK  (3 rules checked, 0 failing, 1 warning)\n'
  exit 0
fi

printf 'table privileges: FAILED  (%s failing)\n' "$FAILED"
exit 1
