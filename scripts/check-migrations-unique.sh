#!/usr/bin/env bash
#
# check-migrations-unique.sh -- every migration version appears exactly once.
#
# WHAT THIS IS FOR
# `supabase db reset` (and `supabase start`, which replays migrations) records
# each applied file in `supabase_migrations.schema_migrations`, keyed by the
# numeric version prefix of the filename. Two files sharing a prefix are not a
# warning: the first INSERT succeeds, the second dies with
#
#   ERROR: duplicate key value violates unique constraint "schema_migrations_pkey"
#   Key (version)=(0035) already exists.
#
# and the whole reset aborts. That takes down the E2E suite (global-setup runs
# `supabase start`) and all of scripts/smoke/*.sql, which require a fresh reset
# first. Nothing in the repository could see it: the failure only appears at
# runtime, in a database, on a machine that was actually reset.
#
# It happened once already. AGENTS.md warns about it twice -- "A number free on
# `main` is not free for you" and "It was free when I looked was true twice and
# false both times" -- and it landed anyway (#376 added
# 0035_fix_migration_chain_rls.sql beside the existing 0035_projection.sql on
# 2026-10-15). A rule in prose did not hold; this is the machine check.
#
# Cheap by construction: filenames and sort/uniq only, no network, no database,
# no install. Deliberately not a "no gaps" check -- gaps are legal (turfs are
# abandoned, numbers are burned), duplicates are not.
#
# Usage: bash scripts/check-migrations-unique.sh [migrations-dir]

set -euo pipefail

migrations_dir="${1:-supabase/migrations}"

if [ ! -d "$migrations_dir" ]; then
  echo "FAIL: migrations directory not found: $migrations_dir" >&2
  exit 1
fi

shopt -s nullglob
files=("$migrations_dir"/*.sql)
shopt -u nullglob

if [ "${#files[@]}" -eq 0 ]; then
  echo "FAIL: no .sql migrations found in $migrations_dir" >&2
  exit 1
fi

versions=()
for f in "${files[@]}"; do
  base="${f##*/}"
  version="${base%%_*}"
  case "$version" in
    [0-9][0-9][0-9][0-9]) ;;
    *)
      echo "FAIL: $base does not begin with a 4-digit version (e.g. 0001_)." >&2
      echo "      Postgres keys schema_migrations by that prefix, so it must exist." >&2
      exit 1
      ;;
  esac
  versions+=("$version")
done

duplicates="$(printf '%s\n' "${versions[@]}" | sort | uniq -d)"

if [ -n "$duplicates" ]; then
  echo "FAIL: duplicate migration version(s) in $migrations_dir" >&2
  echo >&2
  while IFS= read -r v; do
    [ -n "$v" ] || continue
    echo "  version $v is claimed by:" >&2
    for f in "${files[@]}"; do
      case "${f##*/}" in
        "${v}"_*) echo "    ${f##*/}" >&2 ;;
      esac
    done
  done <<< "$duplicates"
  cat >&2 <<'EOF'

supabase_migrations.schema_migrations is keyed by version, so two files sharing
a prefix abort `supabase db reset` / `supabase start` with a duplicate-key
error -- which takes down E2E and the smoke suite, not just this check.

Fix: renumber the NEWER file to the next free slot, then re-check every branch
for a collision before you push:

  git branch -r | xargs -I{} git ls-tree --name-only {} -- supabase/migrations/

A slot is consumed when the PR carrying it LANDS, not when it is picked.
EOF
  exit 1
fi

echo "OK: ${#files[@]} migrations in $migrations_dir, all versions unique"
