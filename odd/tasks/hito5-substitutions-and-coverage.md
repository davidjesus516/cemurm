# Hito 5 — Substitutions and Coverage (#81)

Feature: `features/substitutions-and-coverage.feature` (17 BDD scenarios).
Chain: stacked-to-main, PR #147. Delivery: auto-chain, size:exception documentado (slices >400 líneas aceptadas, práctica #143–#146).

## Objective

Cover missing musicians with substitutes who see the assignment in their own key,
instrument and preferred version — with request lifecycle, coverage status, leader
overrule, cross-org event scoping and offline acceptance.

## Problem

A band member's unavailability must open a substitution request with eligible
candidates, notify the leader, let candidates confirm first-wins, and give the
confirmed substitute a personal view of the assignment (key offset, transposing
instrument, preferred version, personal chord substitutions) without altering the
stored plan. Coverage must be visible, warn when uncovered, survive cancels,
reclaims and leader overrules, log to history, scope cross-org event substitutes,
and work offline.

## Why

Feature 5/10 of Hito 5 ("Integrations"), per `docs/mvp-scope.md` mapping and
`docs/database-schema-v2.md` §2.6: `service_assignments` absorbs substitution
coverage, `substitution_requests` drives the lifecycle. Blocking nothing downstream
in this chain.

## Scope (authorized)

- Backend migration `0023_substitutions.sql` on main `894845a`: per-candidate
  response table + definer RPC lifecycle + validate warning + notifications.
- Smoke `scripts/smoke/0023-substitutions.sql` (fresh reset, NOT idempotent).
- Data layer `src/lib/substitutions.js` + instrument/transposition helper +
  client-side chord-substitution application.
- Offline queue `src/lib/outbox.js` (local, flush on reconnect) — first offline
  surface of the app; BDD scenario 17.
- `src/pages/SubstitutionAssignment.jsx` (sub experience) + new route.
- `ServiceDetail.jsx` integration: coverage badges, unavailable/response/cancel/
  reclaim/overrule controls, send-to-candidates, warnings.
- Live validation: smoke SQL + E2E con JWT real + `pnpm lint` + `pnpm build`.

Out of scope: full offline-first sync engine (Hito 6), availability calendar
beyond the open-request signal, public repertoire sharing (export-and-sharing).

## Existing model (reuse, do not duplicate)

- `service_assignments` (0001): `part`, `is_substitute`, `covered_by`
  (substitute assignment, leader-overrulable), `decided_by`, `checkin_at`;
  `UNIQUE(block_id, user_id, part)` allows a second row for the substitute.
- `substitution_requests` (0001): `assignment_id`, `requested_by`, `scope`
  ('org'|'event'), `candidates uuid[]`, `status` ('open'|'covered'|'closed'),
  `created_at`, `resolved_at`.
- `profiles.instrument` (0006) — candidate eligibility by instrument.
- `notify_user` (0008) — definer, revoked from authenticated; callable only from
  inside definer RPCs (0009 trigger precedent).
- `preferences` (0010) — jsonb `default_version`, `transpose_offset`, per-song
  `overrides` — the "personal key offset" and "preferred version" of the BDD.
- `transpose.js` — `transposeChord`, `transposeKey`, `transposeParsed`,
  `initialSemitones`, `semitonesBetween`.
- `personal_annotations` (0001) — `kind='chord_substitution'`, value = target
  chord, anchor keys to concrete chart token.
- `events`/`event_participants` (0001) — cross-org event scope.
- `outbox` (0001) — schema-only; offline queue is client-owned (entity,
  operation, payload, seq, state contract).
- `validate_service_plan` (0018) — OR REPLACE in 0023, same signature; adds
  warning kind `substitution`.
- `service_change_log` (0018) — every lifecycle step logs action 'substitution'
  with part/sub/original/decider details.
- `private.is_org_member(uuid, org_id)` (0018) — membership guard.

## Design decisions

- **Unavailability IS the open request.** No new availability table: `Lucia marks
  herself unavailable` ⇒ one `substitution_requests` row (status 'open') for her
  assignment. Reclaim closes it. The uncovered warning derives from an open
  request without a confirmed substitute.
- **Per-candidate state**: new table `substitution_responses(request_id, user_id,
  status 'pending'|'accepted'|'declined', responded_at)`, PK (request_id,
  user_id). Documented deviation #50 beyond the 48-table contract (precedent:
  0006 profiles). `substitution_requests.candidates` keeps the eligibility
  snapshot; responses drive the state machine and first-wins.
- **Substitute row, not column flip**: a confirmed substitute gets their OWN
  `service_assignments` row (`is_substitute=true`, `covered_by=original`,
  `decided_by=leader|null`). Original row stays untouched — "stored plan is
  unchanged" in the BDD.
- **First-wins atomically**: `respond_substitution` row-locks the request
  (`select ... for update`); only `status='open'` accepts. Reject closes the
  request as 'covered' and notifies the remaining pending candidates
  "Position already covered". Declines only record the response.
- **Leader gate**: unavailability notifies the leader; `send_substitution_request`
  (leader-only) seeds pending responses + notifies candidates.
- **Notifications in-RPC** via `public.notify_user` inside definer RPCs (pattern
  de 0022); category 'system', payload deep-link route.
- **Cross-org scoped context**: `substitution_context` definer RPC returns ONLY
  the caller's assignment blocks + their setlist songs + event setlist when
  scope='event'. It never returns org repertoire. Outsider visibility is RLS-free
  by design: no new grants, one narrow RPC (projection precedent).
- **Client rendering total offset** = `prefs.transpose + overrides[song] +
  instrumentTransposition(profile.instrument)` (B♭ trumpet +2, F horn +7, E♭
  sax +9, concert 0). Plan/charts untouched — only the view transposes.
- **Version preference** = `preferences.jsonb.default_version` (already exists).
- **Chord substitutions** applied client-side per user over the parsed chart
  (personal_annotations is user-only by RLS).
- **Offline**: reutiliza el outbox existente (`src/lib/offlineQueue.js` IDB store
  'outbox' + `offlineSync.startOfflineSync` montado en main.jsx) — NO se crea un
  outbox localStorage nuevo. El accept offline se encola como op
  `respondSubstitution`; el drain lo reproduce en reconnect y lo descarta con
  notice cuando first-wins ya cubrió la posición (`SUPERSEDED_ERRORS` en
  offlineSync.js), en vez de parar la cola.

## Iteration log (backend, evidencia del smoke 32/32 PASS)

- Fixes del smoke: UUIDs de song_versions d2-d4 (36→32 hex); `:''var''` en
  strings psql NO interpola → `format('...%L', :'var')`; asserts de tablas
  revocadas / notificaciones bajo rol postgres; variable `\gset` = prefijo +
  nombre de COLUMNA (fixes `as id \gset subN_`, `as ctx \gset ctx_` → ctx_ctx);
  claims `request.jwt.claims` sin backslashes; assert RLS de canciones como
  authenticated b1 (postgres bypasea RLS).
- Fixes del migration:
  - `overrule_substitution`: `private.is_org_member` es session-bound (solo
    valida al propio caller) → substituido por query directa a
    `org_memberships(status='active')`.
  - `substitution_context`: record variable `r` colisionaba con alias de tabla
    `substitution_requests r` en el `not exists` → renombrado a `v_blk`;
    `jsonb_agg(distinct ... order by si.position)` inválido en canciones del
    evento → se quitó `distinct`.
  - `reclaim_assignment`: cerraba solo requests `status='open'`, pero tras un
    confirm el request está 'covered' → cierra `in ('open','covered')`.
- Reset protocol requerido: `sed -i '184s/^create function private.display_name_for/create or replace function private.display_name_for/' supabase/migrations/0019_rehearsal_workflow.sql` → `supabase db reset` → `git checkout -- supabase/migrations/0019_rehearsal_workflow.sql`.

## Tasks

### T1 — Migración 0023 (backend lifecycle)
`supabase/migrations/0023_substitutions.sql`
- `substitution_responses` table + indexes + RLS off (definer-only), grants none.
- Definer RPCs (all `security definer set search_path = ''`, guards first, execute
  only authenticated; revoke public/anon):
  - `mark_unavailable(p_assignment_id uuid)` → member marks unavailable ⇒ create
    open request (scope 'org'; candidates = org members with
    `profiles.instrument = assignment.part`, excluding actor, already-assigned
    same block, and anyone with their own open request); notify leader.
  - `send_substitution_request(p_request_id uuid)` → leader-only; seeds
    `substitution_responses` ('pending') + notifies candidates with assignment
    details payload.
  - `respond_substitution(p_request_id uuid, p_accept boolean)` → candidate-only;
    decline records response; accept: lock request, `status!='open'` →
    'Position already covered', insert substitute assignment row
    (is_substitute=true, covered_by=original, decided_by=null), request
    →'covered'+resolved_at, log service_change_log, notify original + pending
    candidates "Position already covered".
  - `cancel_substitution(p_request_id uuid)` → current substitute cancels ⇒
    delete own substitute row, request →'open', notify leader with remaining
    candidates.
  - `reclaim_assignment(p_assignment_id uuid)` → original member returns ⇒
    delete substitute row(s), request →'closed', notify both.
  - `overrule_substitution(p_service_id uuid, p_request_id uuid,
    p_substitute_id uuid)` → leader-only; leader records substitute with
    decided_by=leader, releases earlier confirms (delete their substitute rows),
    closes open requests, notifies released.
  - `substitution_context(p_service_id uuid)` → returns caller's assignment
    blocks/service + block setlist songs (charts + versions) + event setlist when
    scope='event'; scoped guards for member/substitute/pending candidate.
- `validate_service_plan` OR REPLACE (same signature) + block 5: open request on
  an assignment without confirmed substitute ⇒ warning `{kind:'substitution',
  message:'Bass part uncovered — Lucia absent'}`.
- Grants: `execute` RPCs to authenticated only.

### T2 — Smoke SQL 0023
`scripts/smoke/0023-substitutions.sql` (fresh reset, postgres psql)
Fixture: service with leader + blocks + assignments (Lucia bass, Juan guitar);
org members with instruments; outsider org for cross-org denial. Matrix:
- mark_unavailable as Lucia ⇒ request open + leader notification row.
- Candidates filtered by instrument (only bass players), exclude actor/busy.
- Leader send ⇒ pending responses + candidate notifications.
- Respond accept first-wins (Pedro) ⇒ substitute row + request covered;
  second accept rejected 'Position already covered'; pending others notified.
- Validate warning appears (kind substitution) and clears on confirm.
- cancel ⇒ reopen + leader notified with remaining candidates.
- reclaim ⇒ original restored, submitted row deleted, both notified.
- overrule ⇒ decided_by=leader, earlier confirm released.
- Cross-org: outsider RPC denied outside substitution_context; context returns
  only assigned songs.
- Notifications asserted via `public.notifications` count.

### T3 — Data layer + rendering helpers
`src/lib/substitutions.js` — rpc wrappers (markUnavailable, sendRequest, respond,
cancel, reclaim, overrule, getContext), normalization (request + responses +
candidate names), `instrumentTransposition(instrument)` util, `renderSemitones`
(total = prefs.transpose + overrides[song] + instrument). Tests none (no
framework; smoke/E2E cubren + demo node 17 asserts). Wire `src/lib/services.js`
only if needed for state refresh.
- NOTA (scope): `applyChordSubstitutions` NO se duplica — ChordProRenderer ya
  aplica chord substitutions vía annotations.buildSubstitutionMap/applySubstitution
  (D7); el módulo nuevo solo calcula el offset total para transposeParsed/el
  renderer. Misma decisión para el outbox (ver diseño offline).

### T4 — Offline queue (reuse, no new outbox)
Reutiliza `offlineQueue.js` (IDB 'outbox') + `offlineSync.js` (drain montado en
main.jsx): `respondSubstitution` registrado en WRITE_OPS y tratado como
superseded-error (first-wins): si el replay falla con 'Position already covered.',
se descarta la op + notice y la cola sigue. `respondSubstitutionOfflineAware`
online ⇒ rpc directa; offline ⇒ enqueueOp + flag; flush ⇒ rpc una vez.

### T5 — Sub experience page
`src/pages/SubstitutionAssignment.jsx` + route `/assignment/:assignmentId` in
`src/App.jsx`. Renders caller's assignment songs with: personal key offset,
instrument written pitch, preferred default version, chord substitutions; plan
unchanged. Reuse existing chart renderer/player, not new rendering engine.

### T6 — ServiceDetail integration
Coverage badges ("Covered by <name>" / "Uncovered"), per-assignment controls
(member: mark unavailable; candidate/leader: send, accept, decline; leader:
overrule; substitute: cancel; original: reclaim), warnings list honors new kind.
Offline-aware accept button. Notification deep-links land here/assignment page.

### T7 — Validación
- E2E live JWT (`scripts/e2e/...` pattern): login as a1 leader + members via
  real JWT; exercise mark_unavailable → send → accept → covered; reclaim; overrule;
  cross-org denial; all PASS.
- `pnpm lint` 0 warnings; `pnpm build` green.
- Commit work-units (Conventional Commits) en rama; push; PR #147 formato
  `feat(substitutions): ... (Hito 5 #81)` base main, Closes #81, size:exception
  en body. Engram mirror al cierre.

## Applicable checks

- Smoke SQL matrices postgres psql (docker exec supabase_db_cemurm).
- E2E JS con JWT real contra stack local.
- `pnpm lint` (zero warnings), `pnpm build`.
- UI visual: revisión manual del usuario (browser desktop no conectado; data layer
  validado live).

## Acceptance criteria

- 17/17 BDD escenarios cubiertos (mapeo escenario→RPC/view en task doc; smoke/E2E
  lo demuestra).
- Main no se toca hasta PR aprobado; rama desde 894845a.
- Sin nueva arquitectura de rendering; reuso de transpose.js/preferences/ChartViewer.
- size:exception documentado; forecast de líneas al cierre.

## Progress

- [x] T1 migración 0023 — `supabase/migrations/0023_substitutions.sql`; aplica en
  reset limpio (0001→0019+0023+seed); 10 RPCs definer + validate OR REPLACE.
- [x] T2 smoke 0023 — `scripts/smoke/0023-substitutions.sql`: **32 PASS / 0 FAIL**
  (T0 anon deny … T11 change_log); run: `docker exec -i supabase_db_cemurm psql -U
  postgres -d postgres -X -f - < scripts/smoke/0023-substitutions.sql`.
- [x] T3 data layer — `src/lib/substitutions.js` (wrappers RPC + flattenRequest/
  flattenContext + instrumentTransposition + renderSemitones + offline-aware
  accept); demo node 17 asserts OK; `pnpm lint` 0 warnings.
- [x] T4 offline — `offlineSync.js` WRITE_OPS + SUPERSEDED_ERRORS
  (`respondSubstitution` first-wins superseded, drop+notice en drain);
  `respondSubstitutionOfflineAware` online/offline branching.
- [x] T5 sub experience page — `src/pages/SubstitutionAssignment.jsx` + ruta
  `/assignment/:serviceId` en App.jsx; contexto por RPC (`instrument` añadido
  al JSON del RPC — el client NO lee profiles.instrument por col-grant 0006);
  render por bloque/song con renderSemitones + annotations + event setlist;
  lint/build verdes.
- [ ] T6 ServiceDetail integration
- [x] T6 ServiceDetail integration — `src/pages/ServiceDetail.jsx`: panel del líder
  (list_substitution_requests: Send request / responses / Overrule / status
  chips), call-sheet del miembro (Mark unavailable / I'm back / covered by /
  substituting link) + sección "Substitution offers" para candidates (Accept
  offline-aware / Decline); `substitution_context` extendido con
  request_id/request_status/covered_name por bloque; lint/build verdes, smoke
  32/32 tras el cambio de RPC.
- [ ] T7 validación + push + PR

(verificación evidence-only: cada T se marca solo con artefacto/outcome observado)