# Acta de decisiones — Expansión institucional y educativa nativa

> **Fecha:** 2026-11-14  
> **Participantes:** Propietario del producto (Antony), Agente EDUCACIÓN  
> **Contexto:** Revisión del alcance de 21 requerimientos contra arquitectura actual (ADR-011 vigente, 67 escenarios BDD, 0 migraciones education_*). Decisión: construir nativamente en CEMURM, superseding ADR-011.  
> **Registro relacionado:** ADR-012 en `docs/decisions.md` (fuente de verdad arquitectónica).

---

## Decisiones de negocio (B1–B8)

| ID | Tema | Decisión | Justificación | Impacto en alcance |
|---|---|---|---|---|
| **B1** | **Objetivo de la matrícula** | **Oferta** (curso + período académico + grupo + sede + instructor opcional) | Cumple "misma asignatura en distintos períodos" y "una persona en varias cátedras". Matrícula directa al curso no lo permite. | +1 tabla `education_course_offerings` + `academic_periods`; reescribe 21 escenarios de `education-enrollment.feature` |
| **B2** | **Gamificación (XP, racha, objetivo diario)** | **Conservar** en esta expansión | 20 escenarios en `education-student-progress.feature` ya la especifican; el diferencial musical (ejercicio anclado a canción) la hace valiosa. | `education_progress` + `education_events` (ledger) + RPCs `education_xp_total`, `education_streak` se construyen |
| **B3** | **Evaluaciones y calificaciones formales** | **Incluir ahora** | La academia lo necesita para historial y reportes; posponerlo crearía deuda y requeriría otra ronda de decisiones. | Requiere `admin_audit_log` (C1/Hito 7), consentimiento menores (B4), tabla `education_evaluations` + `education_grades` |
| **B4** | **Menores y consentimiento educativo** | **Flujo con tutores/autorización** — extender `guardian_consents` | `profiles_select_search` ya excluye menores (0 filas en selector). `guardian_consents` hoy solo tiene `public_sharing_approved`. Sin esto, no hay matrícula de menores ni observaciones lícitas. | Nuevo permiso `educational_data_access` en `guardian_consents`; flujo de invitación/aceptación tutor |
| **B5** | **Visibilidad de observaciones pedagógicas** | **Configurable por organización** (mínimo: autor + staff académico; opcional: alumno) | Algunas academias quieren transparencia total, otras protegen notas internas. Hardcodear una opción obliga a migración posterior. | Columna `visibility_config` en `organizations` o tabla `org_module_settings`; RLS parametrizable |
| **B6** | **Actividades institucionales** | **Extender `events`** con columnas opcionales (tipo académico, salón, recurrencia) | `events` ya tiene participación multi-org, visibilidad, secuencia. Nueva tabla duplicaría calendario y políticas. | `events` gana `academic_type`, `space_id`, `recurrence_rule`, `session_number`; políticas existentes se extienden |
| **B7** | **Activación de módulos** | **On por defecto**; `org_owner` puede deshabilitar por organización | Reduce fricción: la academia ve todo al crear la org. Las agrupaciones musicales apagan lo que no usan. | Tabla `organization_modules` (`org_id`, `module_key`, `enabled`, `disabled_at`, `disabled_by`); default `true` |
| **B8** | **Materiales educativos — storage** | **Reutilizar bucket `charts`** con RLS org-scoped | `charts` ya existe, es privado, soporta PDF/MusicXML. Cambiar RLS de user-scoped a org-scoped es menor que crear bucket nuevo. | Migración de RLS en `storage.objects` para `charts`; políticas por `org_id` en path |

---

## Decisiones técnicas (T1–T8) — aceptadas sin objeción

| ID | Tema | Decisión |
|---|---|---|
| **T1** | Espacios (aulas/salones) | Nueva tabla `spaces` org-scoped. `venues` es owner-scoped y `gigs` depende de eso. |
| **T2** | Sesiones de clase | Nueva tabla `education_sessions`. `rehearsals` es ensayo con setlist, no clase con alumnos/salón. |
| **T3** | Mutaciones de membresía | RPC `SECURITY DEFINER`: `add_org_member`, `change_member_role`, `remove_org_member`. `org_memberships` hoy solo tiene `grant select`. |
| **T4** | Mutaciones de matrícula | RPC `SECURITY DEFINER`: `enroll_student`, `withdraw_student`. BDD prohíbe auto-matrícula. |
| **T5** | Enforcement de módulos | En UI/rutas + guard en RPC. **No** en RLS (evita duplicar autorización org + módulo). |
| **T6** | Numeración de migraciones | Próximo libre `0047`. **Recontar al implementar** — PR #451 abierto reclama `0047_public_table_privileges.sql`. |
| **T7** | Anclaje ejercicio → canción/sección | **Opcional** (`target_song_id`, `target_version_id`, `anchor jsonb` nullable). No todo material es musical. |
| **T8** | Offline | Outbox + `client_uuid` idempotency si se mantiene ledger XP. Progreso y matrícula por outbox. |

---

## Consecuencias en el plan de fases (F0–F8)

| Fase | Contenido | Decisiones que la afectan |
|---|---|---|
| **F0 — Registro** | ADR-012, supersede ADR-011, reescritura `roadmap-ampliacion.md` §5, OpenSpec `education-institutional-modules`, corrección encabezados | B1–B8, T1–T8 |
| **F1 — Membresía administrable** | BDD `organization-members.feature`; RPC T3; panel `/organization/members` | T3 (prerequisito de toda matrícula) |
| **F2 — Activación de módulos** | BDD `module-activation.feature`; tabla `organization_modules`; gating nav/rutas | B7 (default `true`), T5 |
| **F3 — Estructura, oferta, matrícula, gamificación, evaluaciones** | BDD `education-structure.feature` + reescritura matrícula; `academic_periods`, `education_courses`, `education_course_offerings`, `education_enrollments`, `education_progress`, `education_events`, `education_evaluations`, `education_grades`; RPC T4 | B1 (oferta), B2 (gamificación), B3 (eval.), B4 (menores), T4, T7, T8 |
| **F4 — Sesiones y espacios** | BDD `education-sessions.feature`; `spaces`; `events` extendido; conflictos de horario | B6 (extender events), T1, T2 |
| **F5 — Materiales** | BDD `education-materials.feature`; bucket `charts` RLS org-scoped | B8, T8 |
| **F6 — Seguimiento y observaciones** | BDD `education-followup.feature`; `education_observations` con visibilidad configurable | B5 |
| **F7 — Inventario** | BDD `inventory-assets.feature`, `inventory-loans.feature`; `inventory_asset_types`, `inventory_assets`, `inventory_loans`; movimientos | T1 (spaces para ubicación) |
| **F8 — Reportes institucionales** | Reescritura `analytics-and-insights.feature` (personal → institucional) | F3–F7 completos |

---

## Tablas netas resultantes (13 núcleo + 3 condicionales)

| # | Tabla | Fase | Justificación |
|---|---|---|---|
| 1 | `organization_modules` | F2 | Activación por org (B7) |
| 2 | `academic_periods` | F3 | Períodos reutilizables, ciclo de vida (B1) |
| 3 | `education_courses` | F3 | Currículo propio de la org (BDD 13 esc.) |
| 4 | `education_course_offerings` | F3 | Oferta = curso + período + grupo + sede + instructor (B1) |
| 5 | `education_enrollments` | F3 | Matrícula a oferta, rol por curso, estado (BDD 21 esc. reescritos) |
| 6 | `education_sessions` | F4 | Clase fechada con salón e instructor (T2) |
| 7 | `education_materials` | F5 | Documentos, enlaces, métodos por curso/oferta/sesión (B8) |
| 8 | `education_exercises` | F3 | Ejercicio asignado, ancla opcional a canción/sección (BDD 13 esc., T7) |
| 9 | `education_progress` | F3 | Estado ejercicio×alumno, last-write-wins (BDD 20 esc., B2) |
| 10 | `education_events` | F3 | Ledger XP append-only + `client_uuid` (B2, T8) |
| 11 | `education_observations` | F6 | Seguimiento pedagógico con autor/visibilidad (B5) |
| 12 | `education_evaluations` | F3 | Evaluación formal (examen, trabajo) (B3) |
| 13 | `education_grades` | F3 | Calificación por evaluación×alumno, auditoría (B3) |
| — | `spaces` | F4 | Aulas/salones org-scoped, capacidad, equipamiento (T1, B6) |
| — | `inventory_asset_types` | F7 | Catálogo instrumentos/equipos (alcance 20) |
| — | `inventory_assets` | F7 | Activo físico con sede, estado, condición (alcance 20) |
| — | `inventory_loans` | F7 | Préstamo, devolución, vencimiento, evento/sesión (alcance 21) |
| **Condicional** | `inventory_movements` | F7 | Solo si hay transferencias entre sedes (requisito 21) |
| **Condicional** | `education_subjects` | F3 | Solo si catálogo de asignaturas se comparte entre cursos (B1 detalle) |
| **Condicional** | `org_module_settings` | F2 | Solo si B5 necesita persistencia separada de `organizations` |

---

## Decisiones resueltas (D1–D5)

| ID | Tema | Decisión | Fase |
|---|---|----------|------|
| **D1** | Flujo de consentimiento tutor | **A (simple)**: columna booleana `educational_data_access` + `expires_at` en `guardian_consents`. Revocable por el tutor desde la UI. Sin tabla extra. | F3/F6 |
| **D2** | `recurrence_rule` format | **C (tabla propia)**: `recurrence_patterns(freq, interval, weekdays[], end_date)`. Más fácil de consultar y de generar UI. | F4 |
| **D3** | Visibilidad de observaciones pedagógicas | **C (por observación)**: columna `visibility` en `education_observations` con enum `staff_only | student_and_staff`. El docente elige al crear cada observación. | F6 |
| **D4** | Migración de paths `charts` bucket | **C (bucket nuevo)**: bucket `education_materials` (org-scoped); `charts` queda intacto como user-scoped para lo musical. Cero migración de paths. | F5 |
| **D5** | `module_key` valores permitidos | `education`, `sessions`, `materials`, `observations`, `inventory` — todos `enabled=true` por defecto. `org_owner` puede deshabilitar por organización. | F2–F7 |

---

## Próximos pasos inmediatos

1. **F1 — PR BDD membresía + RPCs**: bloquea todo lo demás.
2. **Confirmar numeración de migraciones** (T6) antes de F1 — PR #451 reclama `0047`. Recontar al implementar.
3. **F2 — Module Activation**: tabla `organization_modules` con los 5 `module_key` de D5. Decisión D5 ya tomada.
4. **F3 — Academic Core**: requiere F1 (membership RPCs) y F2 (module gating). D1 ya tomado. D4 (bucket nuevo) no afecta a F3.

---

## Próximos pasos inmediatos

1. **Crear GitHub Milestones** para F0–F8 (ver propuesta abajo).
2. **F0 — PR de documentación**: ADR-012 ya escrito; roadmap §5; OpenSpec change; corrección encabezados.
3. **F1 — PR BDD membresía + RPCs**: bloquea todo lo demás.
4. **Confirmar numeración de migraciones** (T6) antes de F1.

---

## Propuesta de GitHub Milestones

| Milestone | Título | Fases | Issues estimados |
|---|---|---|---|
| `M0: Docs & Decisions` | Registro formal y roadmap | F0 | 4–5 |
| `M1: Membership Admin` | Membresía administrable + RPCs | F1 | 6–8 |
| `M2: Module Activation` | Activación por organización | F2 | 4–5 |
| `M3: Academic Core` | Estructura, oferta, matrícula, gamificación, evaluaciones | F3 | 15–18 |
| `M4: Sessions & Spaces` | Clases, salones, eventos extendidos | F4 | 8–10 |
| `M5: Materials` | Documentos, bucket charts RLS | F5 | 5–6 |
| `M6: Follow-up` | Observaciones, visibilidad configurable | F6 | 5–6 |
| `M7: Inventory` | Activos, préstamos, movimientos | F7 | 10–12 |
| `M8: Institutional Reports` | Dashboards, transcripciones | F8 | 4–6 |

**Total estimado:** 61–76 issues → ~23–25 PRs de ≤400 líneas (coincide con estimación del informe).

---

## Referencias

- ADR-012: `docs/decisions.md` (línea 400+)
- Informe de auditoría completo: conversación del 2026-11-14 (sección A–I)
- BDD existente: `features/education-*.feature` (67 escenarios)
- Roadmap anterior (obsoleto): `docs/roadmap-ampliacion.md` §5
- Esquema propuesto anterior: `docs/database-schema-ampliacion.md` §4 (5 tablas) y §6 (inventario)