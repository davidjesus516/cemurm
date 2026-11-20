# F1 Membership Admin — handoff de sesión

## Goal
Entregar la cadena F1 (Membership Admin) re-partida en PRs encadenados de ≤400 líneas, corregida contra sus specs (S1–S6), y verificada contra una base de datos real — no solo contra los gates de JS.

**Estado: backend mergeado (migración, BDD, repository, registro de cuarentena). UI re-partida: PR3 se re-levanta como #537 y PR4 vuelve con este slice. La review nativa quedó cuarantinada (no corrió) y el smoke de 0021 está verificado en 21/21.**

## La cadena F1

| PR | Contenido | Base | Líneas | Estado |
|----|-----------|------|--------|--------|
| **#523** | `supabase/migrations/0021_identity_account_lifecycle.sql` + conteos | `main` | 385+ / 2- | **MERGED** (incluye los 4 fixes posteriores) |
| **#530** | `features/organization-members.feature` (13 escenarios) + `src/data/repositories/orgMembers.js` | `main` | 320+ | **MERGED** |
| **#531** | `src/features/orgs/pages/OrganizationMembers.jsx` + su ruta | `feat/f1-pr2-repository-v3` | 400+ | **CLOSED sin mergear** — el contenido se re-levanta como #537 |
| **#537** | `src/features/orgs/pages/OrganizationMembers.jsx` + `orgRoles.js` + su ruta (re-levanta limpia, sin PR4 mezclado) | `main` | 435+ | **abierto**, reviewer `davidjesus516` |
| **este PR** | `src/features/settings/pages/AccountSettings.jsx` + su ruta + los dos registros ODD | `feat/f1-pr3-page-v3-clean` | ~320+ | abierto, reviewer `davidjesus516` |

Cerrados como superseded: #524–#526 (v1), #527–#529 (v2), #531 y #532.

**Por qué PR4 volvió:** #532 se mergeó en su base vieja (`feat/f1-pr3-page-v3`), que después se cerró; esa branch se borró y su contenido quedó huérfano — no llegó a `main`. Este slice lo recupera sobre la base limpia de #537.

### PRs hermanos (otra sesión de trabajo, misma feature)

| PR | Contenido | Base | Líneas | Estado |
|----|-----------|------|--------|--------|
| **#533** | `scripts/smoke/0021-identity-account-lifecycle.sql` + `odd/tasks/f1-0021-smoke.md` + doctrina de "next free" | `main` | 360+ / 22- | abierto, reviewer `davidjesus516` — **verificado 21 PASS / 0 FAIL** |
| **#535** | asserts extra para los 4 fixes de la review | `test/f1-0021-smoke` | 86+ / 1- | abierto, reviewer `davidjesus516` |
| **#534** | registro de cuarentena del lineage de review atascado | `main` | 124+ | **MERGED** |

**Merge en orden:** #533 → #535 (encadenados entre sí), y por separado #537 → este PR. Ningún par de PRs abiertos toca la misma línea de los docs: #530 movió los conteos de features/escenarios, #533/#535 mueven el conteo de smokes y la doctrina de "next free".

## Los ocho defectos que la revisión fue encontrando

La primera entrega pasó todos los gates de JS y aun así estaba rota:

| # | Defecto | Corrección |
|---|---------|-----------|
| 1 | `change_member_role_core` admitía solo `org_owner` → contradecía S2 | acepta `org_admin` también |
| 2 | `remove_org_member_core` con el mismo gate → contradecía S3 | idem |
| 3 | El BDD pedía `status "removed"` y la migración escribía `former` | **el esquema manda**: `org_memberships.status` es el enum `member_status(active, former, pending)`. `'removed'` no existe y falla en runtime; `org_leave` (0016:450) ya escribe `'former'`. El BDD se corrigió a `former` |
| 4 | La UI gateaba los controles en `isOwner` → el camino de `org_admin` era inalcanzable | `canManage = isOwner || isAdmin`; las filas `org_owner` no renderizan los controles |
| 5 | `v_is_admin` se usaba sin declararse → `SQLSTATE 42601`: la migración no compilaba, `supabase db reset` y E2E no podían arrancar | declarada en ambos bloques `DECLARE` |
| 6 | `actor_id NOT NULL` contradecía el FK `ON DELETE SET NULL` de 0043 | `actor_id` nullable |
| 7 | El `grant insert, update` sobre `org_memberships` dejaba a cualquier cliente firmado escribir la tabla, salteando los cores y el audit trail | `revoke insert, update`; los RPCs son SECURITY DEFINER y no lo necesitan. Las policies quedan como defensa en profundidad |
| 8 | El `on conflict (user_id, org_id, branch_id)` nunca disparaba para membresías de nivel org (NULL ≠ NULL) | reactivate-or-insert explícito, con índice único parcial `(user_id, org_id) where branch_id is null` |

**La lección que importa:** `lint`, `typecheck`, `test` y `build` no parsean SQL. El único gate que caza un `SQLSTATE` es `supabase db reset`. Por eso E2E Chromium estaba rojo en #523 mientras todo lo demás estaba verde.

## Verificación

Sobre el tip de la cadena (este slice) y sobre el tip del smoke (#535):

```
pnpm lint                              clean
pnpm typecheck                         clean
pnpm test                              34 files / 531 passed
pnpm build                             ok
scripts/check-doc-counts.sh            46 migrations, 23 smokes, 49 features, 789 scenarios, 0047 free
scripts/check-visual-contract.sh       12 rules checked, 0 failing
```

(El conteo de migraciones subió a 46 y los smokes a 23 porque **#459** (audience view) ya está mergeado en `main` y trajo su propia migración 0049 y su smoke.)

**Smoke `scripts/smoke/0021-identity-account-lifecycle.sql` sobre la DB corriendo → 21 PASS / 0 FAIL**, tal como declara el archivo. Cubre las 19 asserts de la matriz de permisos (org_admin puede re-rolear y remover instructor/branch_admin/member; ninguno de los dos puede tocar un org_owner; un no-miembro es rechazado; la remoción deja `former` con `left_at`; seis filas de audit y ninguna escrita por un rechazo) más las 4 asserts nuevas: el cambio de rol conserva la branch, org_admin no puede promover a org_owner por el camino del cambio de rol, re-agregar a un ex-miembro deja exactamente una fila activa, y `authenticated` no puede insertar directo en `org_memberships`.

Como el resto de los smokes del repo, **no es idempotente**: corre una vez sobre un `supabase db reset` fresco. Una segunda corrida sobre la misma DB da 3 FAIL espurios (`pre1`, `13`, `15`) por estado sucio — no es una regresión.

## Dos decisiones abiertas para el maintainer

### 1. La doctrina de "next free" cambió de 0047 a 0022 (en #533)

`scripts/check-doc-counts.sh` tenía hardcodeados `0021` **y** `0022` como saltados en `next_free()`, por la teoría de que ambos estaban reservados a propósito. `0021` quedó reclamado por #523 (ya mergeado), así que el gate estaba verde porque coincidía con una prosa que ya era falsa. #533 saca los dos casos especiales: `next_free()` ahora reporta el slot libre más bajo real, **`0022`**, y `AGENTS.md` + `docs/master-plan.md` lo dicen.

**Esto cambia la doctrina del repo** y #533 pide explícitamente el visto bueno del maintainer antes de mergear.

Dato técnico para esa decisión: `AGENTS.md` (línea 224) todavía dice que 0021 y 0022 *"were kept deliberately, so claim one only knowing why the two are reserved"*. Con 0021 ya ocupado, la pregunta abierta es si **0022 sigue reservado a propósito** — si la reserva era para ambos juntos, entonces el "next free" para uso general debería seguir siendo 0047 y lo que corresponde es reportar 0022 como *reservado*, no como *libre*. #533 eligió lo segundo.

### 2. La review nativa no corrió — y no es un PASS

- Lineage: **`review-d72a044f0aec422e`** — START ok (tier medium, 3 lentes: risk/readability/reliability, 9 archivos, 1216 líneas, correction budget 200).
- El capture falló con `pi-host-relay-transport-failure`: **no hay modelo configurado para `review-risk`** en el routing global. Ese archivo (`/home/antony/.pi/gentle-ai/models.json`) no existe en esta máquina — el directorio tiene `agent-status/`, `runtime-guardrails.json` y `scratch/`, y ningún routing. Es configuración humana, fuera del repo; no se inventó.
- **Cuarentena** (registrada en #534): `gentle-ai review abandon --lineage review-d72a044f0aec422e --reason operator_disposition --actor codebuff --expected-revision sha256:93c317b0…` → `committed`; el store quedó en `review-transactions/quarantine/review-d72a044f0aec422e-333050936` y `review status` volvió a `clean`.
- **Lo que NO es:** las tres lentes no produjeron nada (`captured_lens_results: []`, `findings_present: false`). **Esto no es una review y no es un PASS.** Los ocho defectos de arriba salieron de leer el código y de correr la DB, no del transporte de review.
- **Para correrla de verdad:** asignar un modelo a `review-risk`, `review-readability` y `review-reliability` en el routing, y arrancar un lineage nuevo (el anterior está en cuarentena, no se puede reusar).

## Reglas de este entorno (aprendidas a la fuerza)

| Regla | Detalle |
|-------|---------|
| `git push --force-with-lease` y `git reset --hard` | **BLOQUEADOS** como destructivos. Una branch ya pusheada que necesita cambio = branch **nueva** + PR nuevo + cerrar el viejo. De ahí las tres generaciones de la cadena (v1, v2, v3) |
| `supabase` no está en PATH | usar `./node_modules/.bin/supabase` |
| El binario de gentle-ai faltaba | `node scripts/install-gentle-ai.mjs` desde `/home/antony/.pi/agent/npm/node_modules/gentle-pi` |
| RDD está ON | antes de cualquier `push` o `gh pr create`: `gentle_review assess` con `{"baseRef":"<base>","committedOnly":true}`. Si la candidate está sucia por untracked, mover los untracked fuera del repo o commitearlos primero — si no, el assess falla con `untracked files require an explicit declaration` |
| `git checkout <ref> -- .` sobreescribe el worktree completo | stages todo lo que difiere y **borra** cualquier edición local no commiteada. No usarlo para "traer un archivo": usar `git show <ref>:<path> > <path>` |
| Ningún gate JS parsea SQL | `supabase db reset` es el único que prueba una migración |
| Los smokes no son idempotentes | un `supabase db reset` antes de cada corrida; una segunda corrida da FAIL espurios |
| Los enums son hechos del esquema | consultar `pg_enum` antes de cambiar un status en código o en prosa |
| E2E solo corre con base `main` | las slices apiladas nunca ejercitan la migración y pueden verse verdes arrastrando una rota |
| El presupuesto de PR cuenta líneas netas vs base | mover el registro ODD de 51 líneas fuera de PR1 lo bajó de 406 a 353 |

## Otros frentes abiertos

- **#459** (audience view, de davidjesus516): ya revieweado y **aprobado** por mí tras re-correr su smoke (40 PASS / 0 FAIL). Falta su rebase + merge.
- **#518** (visual tokens, mío): abierto esperando review de `davidjesus516`. **No puedo auto-aprobar** — la ruleset exige `require_last_push_approval`.
- **#519–#522** (docs educación F0): abiertos, sin mergear.

## Archivos de esta feature

- `supabase/migrations/0021_identity_account_lifecycle.sql` — la migración (mergeado en main vía #523)
- `scripts/smoke/0021-identity-account-lifecycle.sql` — el smoke de la matriz de permisos (#533/#535)
- `features/organization-members.feature` — 13 escenarios BDD (#530)
- `src/data/repositories/orgMembers.js` — wrappers RPC delgados con mapeo de errores (#530)
- `src/features/orgs/pages/OrganizationMembers.jsx` — roster admin, 398 líneas (#531)
- `src/features/settings/pages/AccountSettings.jsx` — vista read-only de estado de cuenta (#532)
- `src/app/router.jsx` — las dos rutas nuevas, partida entre #531 y #532 para que cada slice compile sola
- `odd/tasks/f1-membership-admin.md` — el registro ODD del feature, con el log L1–L9 (#532)
- `odd/tasks/f1-membership-admin-handoff.md` — este documento (#532)
- `odd/tasks/f1-0021-smoke.md` — el registro de ejecución del smoke (#533)
- `AGENTS.md:186`, `docs/master-plan.md:118-119` — los conteos

## Log

**L1** (assistant): Se abre el handoff. La cadena F1 está abierta, verificada y esperando review.

**L2** (assistant): Se documentan los cinco defectos de la revisión de calidad y sus correcciones, la verificación completa (gates + probe 7/7 sobre DB real), el bloqueo de la review nativa y las reglas del entorno.

**L3** (assistant): Actualización — otra sesión de trabajo encontró 4 defectos más en 0021 (#6–#8 de la tabla, más el de `actor_id`), los corrigió en `4466da0`, y #523 quedó **mergeado**. El lineage `review-d72a044f0aec422e` fue **cuarantinado** con registro honesto en #534: la review nativa no corrió y no es un PASS. Se agregaron #533 (smoke de la matriz de permisos) y #535 (asserts de los 4 fixes).

**L4** (assistant): Verificación de esta sesión sobre lo que nadie había corrido: el smoke nuevo `0021-identity-account-lifecycle.sql` sobre un `supabase db reset` fresco → **21 PASS / 0 FAIL**, tal como declara el archivo. Gates en verde sobre ambos tips (#532 y #535). Confirmado que #530 y #533/#535 no tocan la misma línea de los docs. Reviewer `davidjesus516` re-solicitado donde faltaba (#531, #532, #534).

**L5** (assistant): Se actualiza el handoff para reflejar el estado real: #523 mergeado, lineage en cuarentena, smoke verificado, y la doctrina de "next free" 0047→0022 explícitamente marcada como decisión pendiente del maintainer.

**L6** (assistant): Reconciliación final. #530, #534 y #459 quedaron mergeados; #531 se cerró sin mergear y #532 se mergeó en su base vieja, que después se cerró y se borró — **su contenido quedó huérfano y F1 había perdido la UI entera en `main`**. PR3 se re-levanta como #537 desde `feat/f1-pr3-page-v3-clean` (limpio, sin PR4 mezclado). Este slice recupera PR4 (AccountSettings + su ruta + los dos registros ODD) sobre esa base limpia, con el fix `5656241` incluido y el handoff refrescado (4459751). Gates del tip: lint, typecheck, 34 archivos / 531 tests, build, doc counts (46 migraciones, 23 smokes, 49 features, 789 scenarios) y visual contract 12/12.

**L7** (assistant): Se corrige una equivocación propia: un `git checkout <ref> -- .` sobreescribió el worktree completo y un commit ajeno quedó staged sobre la branch de verificación del smoke. Se revirtió sin `reset --hard` (`reset --soft` + `reset` mixto + restore puntual) y la regla queda anotada en la tabla de reglas de este handoff.
