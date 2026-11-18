# F1 Membership Admin — handoff de sesión

## Goal
Entregar la cadena F1 (Membership Admin) re-partida en PRs encadenados de ≤400 líneas, corregida contra sus specs (S1–S6), y verificada contra una base de datos real — no solo contra los gates de JS.

**Estado: la cadena está abierta, verificada y esperando review de `davidjesus516`.** Lo único pendiente de esta sesión es la review nativa (bloqueada por config de modelo) y el merge.

## La cadena F1

| PR | Contenido | Base | Líneas |
|----|-----------|------|--------|
| **#523** | `supabase/migrations/0021_identity_account_lifecycle.sql` + conteos de docs | `main` | 353+ / 2- |
| **#530** | `features/organization-members.feature` (13 escenarios) + `src/data/repositories/orgMembers.js` | `feat/f1-pr1-migration` | 280+ / 2- |
| **#531** | `src/features/orgs/pages/OrganizationMembers.jsx` + su ruta | `feat/f1-pr2-repository-v3` | 400+ |
| **#532** | `src/features/settings/pages/AccountSettings.jsx` + su ruta + este registro ODD | `feat/f1-pr3-page-v3` | 179+ |

Cerrados como superseded: #524, #525, #526 (v1) y #527, #528, #529 (v2). La v2 estaba construida sobre un PR1 que no compilaba.

**Merge en orden: #523 → #530 → #531 → #532.** Cada base es la slice anterior, así que el orden es load-bearing.

Rama local al cerrar: `feat/f1-pr4-settings-v3`, limpia.

## Qué encontró la revisión de calidad (y qué se corrigió)

La primera entrega pasó todos los gates de JS y aun así estaba rota en cinco puntos:

| # | Defecto | Corrección |
|---|---------|-----------|
| 1 | `change_member_role_core` admitía solo `org_owner` → contradecía S2 (un `org_admin` puede cambiar roles `instructor`/`branch_admin`/`member`) | se acepta `org_admin` además de `org_owner`; `org_owner` nunca es tocable |
| 2 | `remove_org_member_core` con el mismo gate → contradecía S3 | idem |
| 3 | El BDD pedía `status "removed"` y la migración escribía `former` | **el esquema manda**: `org_memberships.status` es el enum `member_status(active, former, pending)`. `'removed'` no existe y falla en runtime; `org_leave` (0016:450) ya escribe `'former'`. El BDD se corrigió a `former` |
| 4 | La UI gateaba los controles en `isOwner` → el camino de `org_admin` era inalcanzable desde el producto | `canManage = isOwner || isAdmin`; las filas `org_owner` no renderizan los controles |
| 5 | `v_is_admin` se usaba en ambos cores sin declararse → `SQLSTATE 42601`: la migración no compilaba, `supabase db reset` y E2E no podían arrancar | declarada en ambos bloques `DECLARE` |

**El defecto 5 es el que importa como lección**: `lint`, `typecheck`, `test` y `build` no parsean SQL. El único gate que lo caza es `supabase db reset`. Por eso E2E Chromium estaba rojo en #523 mientras todo lo demás estaba verde.

## Verificación (sobre la cadena final)

```
pnpm lint                              clean
pnpm typecheck                         clean
pnpm test                              31 files / 517 passed
pnpm test:gherkin                      5 files / 44 passed
pnpm build                             ok
scripts/check-visual-contract.sh       12 rules, 0 failing
scripts/check-doc-counts.sh            45 migrations, 22 smokes, 49 features, 789 scenarios, 0047 free
scripts/check-test-integrity.sh        1 rule, 0 failing
scripts/check-migrations-unique.sh     45 migrations, all versions unique
scripts/check-migrations-destructive.mjs  0 destructive
scripts/hooks/pre-tool-guard.selftest.mjs  79 checks passed
./node_modules/.bin/supabase db reset  aplica 0001→0049 limpio
```

**Probe psql de 7 asserts sobre la DB corriendo → 7 PASS / 0 FAIL:**

1. `org_admin` cambia el rol de un miembro.
2. `org_admin` no puede modificar un `org_owner`.
3. La remoción deja `status='former'` con `left_at`.
4. `org_admin` no puede remover un `org_owner`.
5. Un outsider recibe `not authorized`.
6. `anon` no tiene `EXECUTE` sobre los RPCs.
7. El `admin_audit_log` registra las mutaciones.

El probe vive en `/tmp/f1-verify.sql` (efímero — rearmarlo si hace falta; los fixtures usan UUIDs `a0000000-…` / `b0000000-…` y `organizations` NO tiene columna `owner_id`).

## Pendiente: la review nativa (bloqueada por config humana)

- Lineage: **`review-d72a044f0aec422e`**
- Workspace root: `/home/antony/Documentos/GitHub/cemurm`
- START ya se hizo: tier `medium`, 3 lentes (`review-risk`, `review-readability`, `review-reliability`), 9 archivos, 1216 líneas, correction budget 200.
- El capture falló con `pi-host-relay-transport-failure`: **no hay modelo configurado para `review-risk`** en el routing global (`/home/antony/.pi/gentle-ai/models.json`, luego `subagents.json` y el frontmatter del agente).

Ese archivo es humano-controlado; las herramientas de modelo no lo pueden editar.

**Para retomar:**
1. El humano asigna modelo a `review-risk`, `review-readability` y `review-reliability`.
2. `gentle_review status` con `lineageId=review-d72a044f0aec422e` y `workspaceRoot=/home/antony/Documentos/GitHub/cemurm`.
3. Tomar **solo** el `collectBinding` de UN slot que el STATUS re-ofrezca. Nunca reconstruir el binding desde la transcripción.
4. Si el slot es materialize: primer capture SIN `reviewerRunAcknowledged` (devuelve forecast — relatarlo losslessly al humano), después repetir **el mismo** binding con `reviewerRunAcknowledged=true`.
5. Seguir el `next_transition` que devuelva.

## Reglas de este entorno (aprendidas a la fuerza)

| Regla | Detalle |
|-------|---------|
| `git push --force-with-lease` y `git reset --hard` | **BLOQUEADOS** como destructivos. Una branch ya pusheada que necesita cambio = branch **nueva** + PR nuevo + cerrar el viejo. De ahí las tres generaciones de la cadena (v1, v2, v3) |
| `supabase` no está en PATH | usar `./node_modules/.bin/supabase` |
| El binario de gentle-ai faltaba | `node scripts/install-gentle-ai.mjs` desde `/home/antony/.pi/agent/npm/node_modules/gentle-pi` |
| RDD está ON | antes de cualquier `push` o `gh pr create`: `gentle_review assess` con `{"baseRef":"<base>","committedOnly":true}`. Si la candidate está sucia por untracked, mover los untracked fuera del repo o commitearlos primero — si no, el assess falla con `untracked files require an explicit declaration` |
| Ningún gate JS parsea SQL | `supabase db reset` es el único que prueba una migración |
| Los enums son hechos del esquema | consultar `pg_enum` antes de cambiar un status en código o en prosa |
| E2E solo corre con base `main` | las slices apiladas nunca ejercitan la migración y pueden verse verdes arrastrando una rota |
| El presupuesto de PR cuenta líneas netas vs base | mover el registro ODD de 51 líneas fuera de PR1 lo bajó de 406 a 353 |

## Otros frentes abiertos

- **#459** (audience view, de davidjesus516): ya revieweado y **aprobado** por mí tras re-correr su smoke (40 PASS / 0 FAIL). Falta su rebase + merge.
- **#518** (visual tokens, mío): abierto esperando review de `davidjesus516`. **No puedo auto-aprobar** — la ruleset exige `require_last_push_approval`.
- **#519–#522** (docs educación F0): abiertos, sin mergear.

## Archivos de esta feature

- `supabase/migrations/0021_identity_account_lifecycle.sql` — la migración (PR1/#523)
- `features/organization-members.feature` — 13 escenarios BDD (PR2/#530)
- `src/data/repositories/orgMembers.js` — wrappers RPC delgados con mapeo de errores (PR2/#530)
- `src/features/orgs/pages/OrganizationMembers.jsx` — roster admin, 398 líneas (PR3/#531)
- `src/features/settings/pages/AccountSettings.jsx` — vista read-only de estado de cuenta (PR4/#532)
- `src/app/router.jsx` — las dos rutas nuevas, partida entre PR3 y PR4 para que cada slice compile sola
- `odd/tasks/f1-membership-admin.md` — el registro ODD con el log L1–L9
- `AGENTS.md:186`, `docs/master-plan.md:118-119` — los conteos: 45 migraciones, 49 features, 789 escenarios

## Log

**L1** (assistant): Se abre el handoff. La cadena F1 está abierta, verificada y esperando review.

**L2** (assistant): Se documentan los cinco defectos de la revisión de calidad y sus correcciones, la verificación completa (gates + probe 7/7 sobre DB real), el bloqueo de la review nativa y las reglas del entorno.
