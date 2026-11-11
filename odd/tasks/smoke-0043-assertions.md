# Smoke 0043: three assertions that could never pass, and a file that could not fail

Branch `fix/smoke-0043-assertions`, stacked on `fix/acl-table-privileges` (#451) because #451 waits
on a human approval. Manual tier: no runner, one fresh `supabase db reset` per run.

## 1. Objective

Make `scripts/smoke/0043-account-erasure.sql` honest: 11 assertions that actually assert, and a
non-zero exit when one fails.

## 2. Problem

On `main` the file reported 8 PASS / 3 FAIL while declaring "expects 11 PASS / 0 FAIL", and
**exited 0** — `tmp_assert` raises a NOTICE, and reaching the end of the file is a successful
`psql`. Two separate defects, and the second is why the first survived:

| # | Assertion | Why it could never pass |
|---|---|---|
| 2 | "second call returns same row and does not move scheduled_for" | counted `count(*) = 1` over a `union all` of two calls — always 2 rows |
| 4 | "run_due_account_erasures erases nothing when not due" | `run_due_account_erasures() is null` — the function returns `void`, and `void` is never NULL |
| 9 | "second erase_account_core call raises nothing" | same `is null` on a `void` return |

None of the three was a product bug: `request_account_erasure()` is idempotent by design and
`run_due_account_erasures()` filters `scheduled_for <= now()`. The product was right and the
assertions were wrong, which is the case where fixing the assertion is the honest repair — the
opposite of the rule against weakening a characterization test.

## 3. What shipped

- Assertion 2 now asserts the invariant it names: one row in `account_erasure_requests`, and two
  further calls return the same `scheduled_for`.
- Assertions 4 and 9 call the `void` function as a statement and assert its side effects; #4 also
  asserts the request is still `pending`, #9 also asserts `storage_purge_queue` did not grow a
  second row — "changes nothing" needs an observable.
- `\set ON_ERROR_STOP on` at the top of the file, so it does not depend on the caller remembering
  the flag AGENTS.md tells them to pass.
- `tmp_smoke_asserts` + a closing `DO` block: raises unless exactly the declared 11 assertions ran
  **and** all passed. A run that loses an assertion is a failing run, not a shorter green one.
- `grant insert on tmp_smoke_asserts to authenticated` — `tmp_assert` stays invoker-rights and the
  file asserts as `authenticated`, so the record has to be writable by that role.
- `AGENTS.md`: the `expects N PASS / 0 FAIL` line was decorative until now; `0043` is the
  reference shape. The other 21 files still exit 0 on failure.

## 4. Verification

One fresh `supabase db reset` before **every** run (the file commits its writes).

- Before: `EXIT=0`, `8 PASS / 3 FAIL` — the three above.
- After: `EXIT=0`, `11 PASS / 0 FAIL`, closing line `smoke 0043: 11 of 11 assertions passed`.
- Negative A (one assertion forced false, `owner_id is null` → `is not null`), run **without**
  `-v ON_ERROR_STOP`: `EXIT=3`, `[FAIL] 6 songs and setlists remain…`, then
  `ERROR: smoke 0043: 1 of 11 assertions failed`.
- Negative B (assertion 7 deleted, so 10 run instead of 11), same invocation: `EXIT=3`,
  `ERROR: smoke 0043: expected 11 assertions, 10 ran`.
- Catalog back to a clean reset after the last run; the local stack carries nothing from these.

## 5. Notes

- The mutation copies lived in `/tmp`, never in the workspace, and were not committed.
- Not touched: the other 21 smoke files (same preamble defect, needs its own pass), and the
  `scripts/smoke/` ↔ migration-number mismatch documented in AGENTS.md.

Risk: none — a manual smoke script and docs; no migration, no runtime code, no CI path.
