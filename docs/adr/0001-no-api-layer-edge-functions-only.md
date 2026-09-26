# ADR 0001 — No application API layer; Supabase Edge Functions only

- **Status**: accepted
- **Date**: 2026-09-26
- **Deciders**: product owner
- **Context**: `docs/engineering-review-backlog.md:23-26`, `docs/local-dev.md:93`, `docs/technical-spec.md:441`

## Context

CEMURM has no application server. Every database read and write goes from the browser directly
to Supabase PostgREST through `@supabase/supabase-js`, and authorization is enforced by
Postgres Row Level Security policies. There is no `api/` directory, no Express/Fastify/Nest
process, and no code path where the client calls a domain API of ours.

This is a deliberate architecture, not an unfinished migration. The engineering review of
2026-09-15 evaluated and rejected a microservices split, and recorded that the API surface is
"CRUD fino sobre RLS" — a thin CRUD over row policies, not domain logic.

The decision has consequences that are easy to discover late, so they are written down here.

## Consequences we accept

**1. There is nowhere to put rate limiting.** Our own backlog records this: *"No existe backend
propio donde instalar límites."* Today the only rate limiting is whatever the Supabase gateway
applies. Any unauthenticated surface — the public library, profiles — inherits platform limits
rather than limits we chose.

**2. Real OAuth is impossible until an edge function exists.** Planning Center requires a server
callback to complete its authorization code flow. A client-only app cannot receive one, so
`src/lib/planningcenter.js` ships as a mock with no server path. Google and GitHub sign-in are
disabled for the same reason (`supabase/config.toml`, all 23 providers `enabled = false`).

**3. No server-side business logic is possible.** Anything that must run authoritatively —
recomputing a derived value, validating a cross-entity invariant, sanitizing input the client
sent — has to be either an RLS policy, a `SECURITY DEFINER` Postgres function, or it does not
exist. This is why the repository has a heavy investment in RPCs
(`private.validate_service_plan`, `public.move_setlist_items`, `public.substitution_candidates`)
and why the schema carries logic that a conventional backend would hold.

**4. The server-side `outbox` table has no drain.** The `outbox` table
(`supabase/migrations/0001_init.sql:521-535`) is designed with `seq`, `state`, and
`UNIQUE(device_id, seq)` for a transactional write queue, but the only drainer is client-side
(`src/lib/offlineSync.js`, bound to the `online` event). Cross-device sync is therefore not
real: a write made offline on a tablet is replayed by that tablet when it reconnects, and there
is no server process that could reconcile two devices.

## Decision

**We do not add an application API layer, and we do not add a general backend.**

When a capability genuinely cannot be implemented from the browser, it becomes a **Supabase Edge
Function** — Deno, deployed alongside the database, in the same repository, with the same review
and deploy cycle as a migration. Not a separate service, not a container.

Edge functions are permitted for exactly three cases:

1. **OAuth callbacks** — anything requiring a server-side redirect receiver (Planning Center,
   and Google/GitHub if we enable them).
2. **Anything requiring a secret** — any path that touches `service_role`. Never in the client.
3. **Server-side drain of the `outbox`** — the single highest-value case, because it is what
   would make cross-device sync true rather than aspirational.

The route is Supabase's own, `/functions/v1/<name>`. **We do not invent an `/api/` prefix.** A
fake abstraction over PostgREST would add a layer that can only forward requests, and would make
the real security boundary — RLS — harder to see rather than easier.

## What this decision is not

It is not a claim that edge functions scale. It is a claim that the *only* three capabilities we
cannot build from the client are the three above, and that each is small enough to live next to
the database instead of becoming a service.

If measurement ever shows a need this cannot serve, the trigger to revisit is already written
down: `docs/engineering-review-backlog.md:16` sets the bar at **more than ~500 real concurrent
users, or a measured hot path** — and the prescribed response is to scale Supabase or partition
Realtime, *not* to split into microservices.

## Revisit trigger

Revisit when any of these becomes true:

- A second unauthenticated surface needs limits we control.
- A capability requires a secret and cannot be expressed as an RLS policy or a Postgres function.
- Offline writes need reconciliation across devices.
- Concurrent authenticated users exceed ~500 in measurement, not in projection.

## Consequences of the decision

- `src/data/` is the only module permitted to import the Supabase client. Enforced, not
  documented — see the ESLint `no-restricted-imports` rule and the `dependency-cruiser` policy.
- Schema logic stays in Postgres. New invariants belong in migrations and RPCs, not in a future
  service nobody has agreed to build.
- The "no own backend" line in the backlog stands, and this ADR is the reason it is safe to
  repeat.
