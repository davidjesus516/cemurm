# ACL gate: DB-free regression test + the detail-query bug it caught

Branch `fix/acl-gate-followup`, stacked on `fix/acl-table-privileges` (#451) because #451 cannot
merge without a human approval. No runner: bash plus a stubbed `docker`.

## 1. Objective

Give `scripts/check-table-privileges.sh` a regression test that runs in `ci.yml` with no Supabase
stack, and fix the defect found while writing it.

## 2. Problem

The gate needs a live catalog, so it lives in `e2e.yml` and **nothing in `ci.yml` could see it**. A
gate that silently always passed was indistinguishable from a gate that worked — the same hole
`.only` was, one layer down.

Writing the test surfaced a real bug: `psql_scalar` was used for both counts and the failing rule's
table list, and its numeric guard rejected the list. On a failing rule the gate printed
`FAIL setup … did not return a number` followed by the finding, hiding the rule verdict behind a
setup error. The guard is right (a non-numeric count would abort bash with "integer expression
expected", exit 2, no remediation text); it was applied to the wrong queries.

## 3. What shipped

- `psql_raw` (transport, no validation) and `psql_scalar` (counts only, refuses non-numbers); the
  three findings lists now use `psql_raw`.
- `UNSAFE_VERBS="array['TRUNCATE','REFERENCES','TRIGGER']"` as the single source of the three
  ACL-only verbs: the counting predicate and the printed verb list are both generated from it.
- `FINDINGS_MAX` now applies to rules 01, 02 and 03 alike, and the list is ordered `c.oid desc` so
  the table a change just added appears first instead of behind nine that legitimately hold DELETE.
- Rule 03 no longer offers "raise `DELETE_RATCHET`" as an action: the ratchet only falls, and
  raising it is a separate decision with its own review.
- `scripts/check-table-privileges.test.sh` — 38 checks, `docker` stubbed and first on `PATH`:
  clean pass; unsafe verb; anon grants; ratchet at 21/22/23; findings cap and its hidden tail;
  empty catalog; non-numeric count; unreachable database; no `docker`; no `config.toml`; plus
  static invariants (verb array, `relkind in ('r', 'p')`, newest-first ordering, all three lists
  fetched as text).
- `ci.yml` runs the selftest right after `check-test-integrity.sh`; `AGENTS.md` documents the step
  and the now-three gates-guard-the-guards.

## 4. Verification

- `bash scripts/check-table-privileges.test.sh` → `gate selftest: OK (38 checks)`, exit 0.
- **The test fails on the bug it was written for**: a copy of the gate with the three detail
  queries switched back to `psql_scalar` → `FAILED (2 of 38 checks failed)`, exit 1.
- Live gate on a clean reset: `table privileges: OK (3 rules, 0 failing, 1 warning)`, exit 0.
- Probe table `public.zz_probe_acl` (created to prove the RED shape, then dropped): the failing run
  prints `zz_probe_acl  TRUNCATE,REFERENCES,TRIGGER` under `FAIL 01`, then `FAIL 02`, then
  `FAIL 03 23 > 22` with the probe listed first. Exit 1. Catalog back to 61 tables.
- `check-doc-counts.sh` OK (45/0048/22/48/776), `check-test-integrity.sh` OK (32 files),
  `pre-tool-guard.selftest.mjs` 79 checks, `ci.yml` parses, both scripts pass `bash -n`.

## 5. Notes

- The stub is strict on purpose: SQL it does not model returns a non-number, so the gate fails
  setup and a new query added without a stub branch announces itself.
- Left alone: smoke-0043 (next unit), default privileges (maintainer decision), `if: always()`.

Risk: none — the gate, its test and two docs; no runtime code, no schema, no contract.
