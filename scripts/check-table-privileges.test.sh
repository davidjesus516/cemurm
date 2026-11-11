#!/usr/bin/env bash
#
# check-table-privileges.test.sh -- DB-free regression test for check-table-privileges.sh.
#
# WHY THIS EXISTS
# The ACL gate's value is its verdict: does rule 01 fail when a role holds TRUNCATE, does rule 03
# fail when the ratchet grows, does a broken setup fail CLOSED instead of reporting a clean schema
# it never saw. Its own SQL needs a live catalog, so before this file nothing tested any of that:
# a gate that silently always passed would look identical to a gate that works.
#
# HOW
# `docker` is stubbed and put first on PATH. The stub reads the SQL the gate would have sent and
# answers from environment variables -- so the whole verdict path runs in milliseconds, on a
# machine with no Docker daemon, no Supabase stack and no Postgres. The gate itself is never
# modified for the test; each case copies it into a throwaway "repository" whose
# supabase/config.toml the gate reads for the project id.
#
# The stub is deliberately strict: SQL it does not recognise returns a non-number, and the gate
# then fails setup with "did not return a number". A new query added to the gate without a stub
# branch therefore announces itself here instead of quietly falling through to a default.
#
# USAGE
#   bash scripts/check-table-privileges.test.sh

set -uo pipefail

FAILED=0
CHECKED=0

ok() {
  CHECKED=$((CHECKED + 1))
  printf 'ok    %s\n' "$1"
}

bad() {
  CHECKED=$((CHECKED + 1))
  FAILED=$((FAILED + 1))
  printf 'FAIL  %s\n' "$1" >&2
  [ -n "${2:-}" ] && printf '        %s\n' "$2" >&2
  return 0
}

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
GATE="$SCRIPT_DIR/check-table-privileges.sh"

if [ ! -f "$GATE" ]; then
  printf 'FAIL  setup    %s not found\n' "$GATE" >&2
  exit 1
fi

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

# --- the stub ---------------------------------------------------------------
mkdir -p "$SCRATCH/bin"
cat > "$SCRATCH/bin/docker" <<'STUB'
#!/usr/bin/env bash
# Stand-in for `docker exec -i <container> psql -U .. -d .. -X -q -t -A -v ON_ERROR_STOP=1 -c SQL`
sql=""
prev=""
for a in "$@"; do
  [ "$prev" = "-c" ] && sql="$a"
  prev="$a"
done

if [ "${STUB_FAIL:-0}" = "1" ]; then
  printf 'Cannot connect to the Docker daemon\n' >&2
  exit 1
fi

if [[ "$sql" == *"count(*)"* ]]; then
  if   [[ "$sql" == *"array['TRUNCATE','REFERENCES','TRIGGER']"* ]]; then printf '%s\n' "${STUB_UNSAFE:-0}"
  elif [[ "$sql" == *"'anon'"*   ]]; then printf '%s\n' "${STUB_ANON:-0}"
  elif [[ "$sql" == *"'DELETE'"* ]]; then printf '%s\n' "${STUB_DELETE:-22}"
  elif [[ "$sql" == *"'UPDATE'"* ]]; then printf '%s\n' "${STUB_UPDATE:-27}"
  else printf '%s\n' "${STUB_TOTAL:-61}"
  fi
elif [[ "$sql" == *"relname"* ]]; then
  [ -n "${STUB_DETAIL:-}" ] && printf '%s\n' "$STUB_DETAIL"
else
  printf 'unmodelled query: %s\n' "$sql"
fi

# Every branch above returns 0 on purpose: an empty result is a valid answer, and the gate reads
# a non-zero psql exit as "could not query", which is a different (setup) failure.
exit 0
STUB
chmod +x "$SCRATCH/bin/docker"

# --- a throwaway repository the gate believes it lives in -------------------
make_repo() {
  local dir="$1"
  mkdir -p "$dir/scripts" "$dir/supabase"
  cp "$GATE" "$dir/scripts/check-table-privileges.sh"
  printf 'project_id = "cemurm"\n' > "$dir/supabase/config.toml"
}

REPO="$SCRATCH/repo"
make_repo "$REPO"

# A PATH with the tools a fake run needs and, on purpose, no docker at all.
NODOCKER="$SCRATCH/bin-nodocker"
mkdir -p "$NODOCKER"
for tool in bash sed head awk tr dirname; do
  resolved="$(command -v "$tool" 2>/dev/null)" && ln -s "$resolved" "$NODOCKER/$tool"
done
if [ -e "$NODOCKER/docker" ]; then
  bad "test sandbox: docker must be absent from $NODOCKER"
fi

# --- runner -----------------------------------------------------------------
OUT=""
CODE=0
run_gate() {
  local path="$1"
  shift
  OUT="$(env PATH="$path" "$@" bash "$REPO/scripts/check-table-privileges.sh" 2>&1)"
  CODE=$?
}

expect_exit() { # $1 = wanted code, $2 = case name
  if [ "$CODE" -eq "$1" ]; then
    ok "$2 (exit $1)"
  else
    bad "$2: expected exit $1, got $CODE" "$(printf '%s\n' "$OUT" | tail -4 | tr '\n' ' ')"
  fi
}

expect_out() { # $1 = fixed string, $2 = case name
  if printf '%s' "$OUT" | grep -Fq -- "$1"; then
    ok "$2: output names $(printf '%q' "$1")"
  else
    bad "$2: output does not contain '$1'" "$(printf '%s\n' "$OUT" | tail -4 | tr '\n' ' ')"
  fi
}

STUBPATH="$SCRATCH/bin:$PATH"

# --- 01 clean ---------------------------------------------------------------
run_gate "$STUBPATH"
expect_exit 0 "clean schema passes"
expect_out "PASS  01" "clean schema"
expect_out "PASS  02" "clean schema"
expect_out "PASS  03" "clean schema"
expect_out "WARN  04" "clean schema"
expect_out "table privileges: OK" "clean schema"

# --- 02 a role holding an ACL-only verb -------------------------------------
run_gate "$STUBPATH" STUB_UNSAFE=1 STUB_DELETE=23 \
  STUB_DETAIL='zz_probe_acl  TRUNCATE,REFERENCES,TRIGGER'
expect_exit 1 "unsafe verb fails the gate"
expect_out "FAIL  01" "unsafe verb"
expect_out "authenticated: no TRUNCATE/REF/TRIGGER" "unsafe verb"
expect_out "zz_probe_acl  TRUNCATE,REFERENCES,TRIGGER" "unsafe verb prints the offending table and its verbs"

# --- 03 anon holding table privileges ---------------------------------------
run_gate "$STUBPATH" STUB_ANON=2 STUB_DETAIL=$'zz_a\nzz_b'
expect_exit 1 "anon grants fail the gate"
expect_out "FAIL  02" "anon grants"
expect_out "2 of 61 tables" "anon grants"

# --- 04 the DELETE ratchet --------------------------------------------------
run_gate "$STUBPATH" STUB_DELETE=23
expect_exit 1 "ratchet above the line fails"
expect_out "23 > 22" "ratchet above the line"

run_gate "$STUBPATH" STUB_DELETE=22
expect_exit 0 "ratchet at the line passes"
expect_out "22 of 22" "ratchet at the line"

run_gate "$STUBPATH" STUB_DELETE=21
expect_exit 0 "ratchet below the line passes"
expect_out "Ratchet can be tightened" "ratchet below the line"

# --- 05 findings are capped, the count is the finding -----------------------
LIST="$(printf 'zz%02d\n' 1 2 3 4 5 6 7 8 9 10 11 12)"
run_gate "$STUBPATH" STUB_UNSAFE=12 STUB_DETAIL="$LIST"
expect_exit 1 "many offenders fail"
expect_out "12 of 61 tables" "many offenders keep the count"
expect_out "zz10" "many offenders print up to the cap"
expect_out "... and 2 more not shown" "many offenders summarise the rest"
if printf '%s' "$OUT" | grep -Fq "zz11"; then
  bad "findings cap: eleventh name should be hidden"
else
  ok "findings cap: names past the cap are hidden"
fi

# --- 06 setup failures fail CLOSED ------------------------------------------
run_gate "$STUBPATH" STUB_TOTAL=0
expect_exit 1 "empty catalog fails closed"
expect_out "no tables found" "empty catalog"

run_gate "$STUBPATH" STUB_TOTAL=not-a-number
expect_exit 1 "a non-numeric count fails closed"
expect_out "did not return a number" "a non-numeric count"

run_gate "$STUBPATH" STUB_FAIL=1
expect_exit 1 "an unreachable database fails closed"
expect_out "could not query" "an unreachable database"

run_gate "$NODOCKER"
expect_exit 1 "missing docker fails closed"
expect_out "docker is not on PATH" "missing docker"

NOCONFIG="$SCRATCH/repo-no-config"
mkdir -p "$NOCONFIG/scripts"
cp "$GATE" "$NOCONFIG/scripts/check-table-privileges.sh"
OUT="$(bash "$NOCONFIG/scripts/check-table-privileges.sh" 2>&1)"
CODE=$?
expect_exit 1 "missing supabase/config.toml fails closed"
expect_out "supabase/config.toml not found" "missing supabase/config.toml"

# --- 07 invariants that keep the rules honest -------------------------------
# The three ACL-only verbs are enforced from one array, so the count and the failing detail can
# never name different sets. Pinned here because the stub above matches on that exact literal.
if grep -Fq "array['TRUNCATE','REFERENCES','TRIGGER']" "$GATE"; then
  ok "static: the unsafe-verb set is declared once"
else
  bad "static: UNSAFE_VERBS array literal not found"
fi

if grep -Fq "relkind in ('r', 'p')" "$GATE"; then
  ok "static: partitioned tables are in scope"
else
  bad "static: relkind filter does not include partitioned tables"
fi

if grep -Fq "order by c.oid desc" "$GATE"; then
  ok "static: findings list newest tables first"
else
  bad "static: findings are not ordered newest-first"
fi

text_queries="$(grep -c 'psql_raw "select c.relname' "$GATE" || true)"
if [ "${text_queries:-0}" -ge 3 ]; then
  ok "static: every findings list is fetched as text, not as a scalar"
else
  bad "static: expected 3 text detail queries, found ${text_queries:-0}"
fi

# --- result -----------------------------------------------------------------
printf '\n'
if [ "$FAILED" -eq 0 ]; then
  printf 'gate selftest: OK  (%d checks)\n' "$CHECKED"
  exit 0
fi
printf 'gate selftest: FAILED  (%d of %d checks failed)\n' "$FAILED" "$CHECKED" >&2
exit 1
