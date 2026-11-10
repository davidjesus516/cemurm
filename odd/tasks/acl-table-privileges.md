# Table privileges — the public schema ACL gate (#428, #429)

## 1. Objective

Close the ACL hole #428 diagnosed and ship the gate #429 defined, as one unit. Maintainer
instruction, verbatim: *"si, recuerda no excederte del limite de lineas de codigo"*.

## 2. Problem

Supabase's default privileges grant `arwdDxtm` (all seven verbs) to `anon`, `authenticated` and
`service_role` on **every new table** in `public`, so `revoke all on table public.x from public,
anon;` removes nothing from `authenticated` — the role was never named — and the `grant select`
that follows only re-affirms what it already held. Measured on `main` at 44 migrations, after
`supabase db reset`, schema `public`, 61 tables:

| Role | select | insert | update | delete | TRUNCATE | REFERENCES | TRIGGER |
|---|---|---|---|---|---|---|---|
| `authenticated` | 48 | 31 | 28 | 23 | **2** | **2** | **2** |
| `anon` | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

`account_erasure_requests` (0043) and `overlay_sessions` (0025) carried the full inherited grant.
RLS cannot substitute: TRUNCATE evaluates no row predicate, so no policy is consulted, and
REFERENCES/TRIGGER are outside policies by construction. Not exploitable through PostgREST today —
defence in depth against a `security definer` function, a maintenance script or a restored dump.

## 3. What shipped

| Surface | Change |
|---|---|
| `supabase/migrations/0047_public_table_privileges.sql` | Names `authenticated` in the revoke for the two tables and re-grants the minimum: `select` on `account_erasure_requests`; `select, insert, update, delete` on `overlay_sessions` (the four 0025 granted on purpose). |
| `scripts/check-table-privileges.sh` | New gate, bash + the container's own `psql`. 01: no TRUNCATE/REFERENCES/TRIGGER for `authenticated`. 02: no table privilege for `anon`. 03: DELETE ratchet, may only fall. 04: warn on table-level UPDATE. Fails closed on an unreachable container, a missing `config.toml`, or an empty schema. |
| `.github/workflows/e2e.yml` | Gate runs as the **last** step of the Chromium job: `global-setup.js` has already started and reset the stack, and a step that fails early marks the rest SKIPPED (#337). |
| `AGENTS.md` | The gate, its rules, where it runs and why; migration inventory moves to 45 files / next free `0048`. |
| `scripts/smoke/0043-account-erasure.sql` | Removed three stray lines captured from a terminal session (`EOF`, `echo "---"`, a `wc -l` with another machine's path). They errored on every run. |

## 4. Verification

RED first: before 0047, on a fresh 44-migration reset, `check-table-privileges.sh` printed
`FAIL 01  2 of 61` and exited 1. The condition #429 names as its acceptance test — a new table
carrying `grant truncate … to authenticated` — failed rules 01, 02 (anon inherited the default
too) and 03 at once, exiting 1.

GREEN after 0047, on a fresh reset: `PASS 01 0/61`, `PASS 02 0/61`, `PASS 03 22 of 22`,
`WARN 04 27 tables`, exit 0. Read back from `pg_class`: `account_erasure_requests` =
`authenticated=r`; `overlay_sessions` = `authenticated=arwd`; `anon` absent from both. Only those
two moved — the per-verb totals fell by exactly one insert, one update and one delete.

The narrowed grants change no behaviour: all four entry points are `security definer` and run as
the owner. `scripts/smoke/0043-account-erasure.sql` on a fresh reset gives identical results with
and without 0047 (8 PASS / 3 FAIL both times — see §5).

**Independent verification** (`gentle-ai-verify`, baseline `b2ce413`): pass on all four claims and
on the behaviour invariant, zero blockers. It drove the rule logic with a stubbed `docker` to
confirm the ratchet boundary (22 pass, 23 fail, 21 pass with a tighten hint), proved rule 01's
three verbs are all live by applying the same predicates to `service_role` (61/61/61) against
`authenticated` (0/0/0), and confirmed the failure path exits 1 with no summary. Its two in-scope
advisories are closed here: the gate reported **green on an empty schema** (`0 of 0`, exit 0 — the
same fail-open the migrations gate used to have), now an explicit `FAIL setup`; and partitioned
tables were invisible to `relkind = 'r'`, now `in ('r', 'p')`.

## 5. Findings

**`scripts/smoke/0043-account-erasure.sql` fails 3 of its 12 assertions on `main`**, before this
branch: the second `request_account_erasure()` call, "run_due_account_erasures erases nothing when
not due", and the second `erase_account_core` call. It declares "expects 11 PASS / 0 FAIL". Worse,
it exits **0** with failing assertions — `tmp_assert` raises a NOTICE and the script reaches the
end — so a green exit from a smoke script means nothing today. Reported, not fixed here.

## 6. Follow-ups

- **Default privileges** (a new table born narrow rather than caught after the fact) was considered
  and left out: it would change assumptions across 59 tables and require every migration to grant
  explicitly. A maintainer decision, not a side effect.
- The verifier's DB-free regression test (`scripts/check-table-privileges.test.sh`, stubbed
  `docker`) is the natural next unit. It is not here: it would push this PR past its line budget.
- No `if: always()` on the gate step: when Playwright fails the PR is red anyway.
- Rule 04 warns because 27 tables hold table-level UPDATE; `feedback` (0046) is the shape to copy.
  The DELETE ratchet sits at 22 and falls as tables are narrowed.
