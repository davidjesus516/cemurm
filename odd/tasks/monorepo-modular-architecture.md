# odd/tasks/monorepo-modular-architecture.md

## Specs

1. **Arquitectura decidida** — Modular vía Monorepo/Turborepo (Opción B del plan)
2. **Objetivo** — Separar comunidad y ERP/LMS en un monorepo compartiendo tipos y utilidades, manteniendo despliegues independientes
3. **Stack** — Node/TypeScript/React 19 + Vite 6 + Tailwind, Supabase PostgreSQL + RLS
4. **Prioridad** — Evitar deuda técnica a largo plazo; permitir vender ERP como SaaS independiente

### Tareas (one per line: ID, linked S#, route, commit)

- T1: Configurar monorepo (S1, plan, initialize)
- T2: Crear paquetes shared-auth, shared-types, shared-ui (S1–S3, setup)
- T3: Migrar configuración CI a Turborepo pipelines (S1, CI)
- T4: Implementar Fase 1 — Proveedor identidad JWT en comunidad (S1–S3, core)
- T5: Implementar Fase 2 — Endpoints esenciales API comunidad → ERP (S1–S3)
- T6: Implementar Fase 3 — MVP ERP/LMS con base de datos aislada (S3–S6, ERP)
- T7: Implementar Fase 4 — CI/CD independiente despliegue (S3–S6, deploy)

## Log

L1: User request: elegir arquitectura modular vs monolito — votado Opción 1 (modular) por matriz de decisión.

L2: Deliberación técnica: stack existente (Node/TS/React) encaja natural con Turborepo+pnpm-workspace.

L3: Fase 1–4 plan definido (1 semana preparación core, 1 semana entorno, 4 semanas MVP ERP, 1 semana despliegue).

L4: Decisión ejecutada: inicializar turborepo.json, estructura apps/ y packages/, verificar compatibilidad Vite/Vitest.