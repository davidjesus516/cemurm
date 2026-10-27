# TW4 Stack Foundation

Fase 0 de la adopción de la plantilla satnaing/shadcn-admin: migrar el stack del repo
a Tailwind 4 + TypeScript + React 19 para que la plantilla entre "tal cual".
Branch: `feat/tw4-stack-foundation` (desde main 2f06b1f). Merge: decisión humana.
Runner: `pnpm && pnpm test`. Fuente de plantilla: `/home/antony/Descargas/shadcndashboard-main`.

## Specs

- **S1** (stack Tailwind 4): Tailwind 4 vía `@tailwindcss/vite`. `postcss.config.js` y
  `autoprefixer` eliminados. Los tokens `cem.*` del `tailwind.config.js` migrados a
  `@theme` en CSS. El resultado visual del lado músico no debe cambiar.
- **S2** (visual gate): `scripts/check-visual-contract.sh` dejar de leer
  `tailwind.config.js` y leer los tokens de `@theme`; las 12 reglas mantienen
  verificación equivalente (hoy: 12 rules, 0 failing).
- **S3** (React 19): `react` y `react-dom` a ^19, `@types/react@19` +
  `@types/react-dom@19` en devDeps. `react-aria-components` debe seguir
  funcionando (compatibilidad React 19).
- **S4** (TypeScript): `tsconfig.json` con `strict` para archivos TS/TSX,
  `allowJs` conservado para el `.jsx` existente (conversión progresiva).
  `pnpm typecheck` pasa sin romper el baseline de los 4 archivos `@ts-check`.
- **S5** (lint TSX): ESLint con typescript-eslint; `pnpm lint` valida `.ts/.tsx`
  además de `.js/.jsx`, con `--max-warnings 0`.
- **S6** (no romper nada existente): al cerrar esta fase, `pnpm test`,
  `pnpm test:gherkin`, `pnpm typecheck`, `pnpm lint`, `pnpm build` y
  `bash scripts/check-visual-contract.sh` pasan en la rama. `main` sin cambios.
- **S7** (deps de plantilla para Fase 1 instaladas con la fase 0):
  `@base-ui/react`, `@tanstack/react-table`, `recharts`, `cmdk`, `vaul`,
  `sonner`, `lucide-react` (la elección exacta de instalación por fase 1).

## Tasks

- T1 — S1: DONE 39d22ad — tailwindcss 4.3.3 + @tailwindcss/vite; postcss/autoprefixer fuera.
- T2 — S1: DONE 39d22ad — tokens cem.* verbatim a @theme en src/app/index.css.
- T3 — S2: DONE 7d4983a — gate lee @theme de CSS; 12 rules equivalentes; SKILL.md sin referencias muertas.
- T4 — S3: DONE bc8f9bc — react/react-dom 19.3.1 + @types 19.3.0; cero roturas (404+41 verdes).
- T5 — S4/S5: DONE cb8de70 + 027290c — strict:true; typescript 6.0.3 (decisión L3) + typescript-eslint scoped; lint --ext js,jsx,ts,tsx exit 0.
- T6 — S7: DONE 681c1f2 — 7 deps de plantilla instaladas sin fallback.
- T7 — S6: DONE (orquestador, 2026-10-16) — suite completa re-observada inline: ver L4.

## Log

- L1 (2026-10-16): "vamos a cambiar las reglas, que necesitamos para instalar lo que nos hace falta para optimizar el trabajo con Tailwind 4 y typescript?" — decisión A: adoptar stack de la plantilla (React 19 + Tailwind 4 + TS). Condición del usuario: no romper main → rama aislada, gates verdes en rama, merge humano.
- L1b: template en `/home/antony/Descargas/shadcndashboard-main` se integrará "tal cual" (Fase 1) después de la base.
- L2 (2026-10-16): T1+T2 → 39d22ad; T3 → 7d4983a (gate lee @theme de src/app/index.css, 12 rules, 0 failing; SKILL.md y tailwind.config.js coherentemente actualizados). T4 → bc8f9bc: react/react-dom 19.3.1, @types/react(-dom) 19.3.0; react-aria-components ^1.7.0 compatible con React 19: 404 tests + 41 gherkin verdes, sin fix de call-sites; vendor chunk 238→318 kB raw (102 kB gzip, dentro del presupuesto 500 kB raw). T5 parcial → cb8de70: S4 (strict on, baseline @ts-check intacta — typecheck exit 0, 64 files listed > 1). T6 → 681c1f2: las 7 deps de plantilla existen con el nombre pedido (SIN fallback de versión: base-ui 1.9.0, react-table 9.3.1, recharts 3.10.1, cmdk 1.1.1, vaul 1.1.2, sonner 2.0.8, lucide-react 1.57.0).
- L2-S5 PENDING DECISION (2026-10-16): **typescript-eslint no carga con el root typescript 7.0.2.** Evidencia verificada: latest 8.71.2 (y canary 8.71.3-alpha.7) hace `require('typescript')` en parser y plugin y THROWEA al boot si major >= 7 (typescript-eslint#10940: soporte TS >=7.1 pendiente; TS 7.1 aún solo en insiders). El throw es eager vía `extends` de eslintrc — cualquier override cargado mata `pnpm lint` aunque no haya .ts bajo el override (el único .ts real es supabase/functions/send-guardian-consent/index.ts, Deno, fuera de todo gate por AGENTS.md). Intentos pnpm 11 side-by-side fallidos: scoped overrides (`pkg>typescript: 6.0.3") reescribía peer spec sin re-instanciar; `packageExtensions` (con y sin @version) checksum rebota pero no mergea dependencias. Opciones al orquestador: (A) downgrade devDep typescript 7.0.2 → 6.0.3 — herramienta única alineada, invalida el estado documentado TS-7 en AGENTS.md; (B) mantener 7.0.2 y diferir S5 hasta que typescript-eslint publique soporte TS >=7.1 — Fase 1 de la plantilla necesita S5 primero. Interacción que requiere el orquestador confirmada.
- L3 (2026-10-16): decisión humana, tomada y comunicada por el orquestador: **"(Recomendado) Downgrade typescript → 6.0.3"**. Tradeoff explícito: AGENTS.md "TypeScript is 7.0.2" queda stale y se actualiza DENTRO de esta unidad (sección Type checking, diff mínimo). Ejecutado: typescript 6.0.3.0 instalado (`pnpm add -D typescript@6.0.3`; react 19 / tailwind 4.3.3 intocados); `pnpm peers check` — "No peer dependency issues found" (las 7 advertencias no-met que existían desde la primera instalación de typescript-eslint bajo TS7 desaparecen con el downgrade). Wiring S5 aplicado según draft de la sesión anterior: .eslintrc.cjs override `files: ['src/**/*.ts', 'src/**/*.tsx']` con `plugin:@typescript-eslint/eslint-recommended + recommended` (no type-aware, sin project service), `@typescript-eslint/no-unused-vars` con la convención del repo `varsIgnorePattern: '^[A-Z_]'`, `ignorePatterns` + `'supabase'` (el único .ts real es el edge function Deno send-guardian-consent — fuera de todo gate por AGENTS.md), lint script `--ext js,jsx,ts,tsx`. Quirks de AGENTS.md RE-VERIFICADAS en 6.0.3 con probes (tsc --ignoreConfig): quirk catch — `error TS18046: 'e' is of type 'unknown'` sin cast, limpio con `/** @type {Error} */ (e)`; quirk em-dash — `error TS1127: Invalid character` en `[b] —` tras optional param. Persisten ambas: texto de AGENTS.md ajustado a "Both quirks re-verified on 6.0.3" (contenido sin cambios). Probe de S5: plugin carga, es 1 error en unused lowercase, 0 en uppercase; supabase ignorado (exit 0).
- L4 (2026-10-16): T7 — cierra S6. Orquestador re-observó la suite completa inline en rama: pnpm test 404/404, pnpm test:gherkin 41/41, typecheck exit 0, lint (--ext js,jsx,ts,tsx, max-warnings 0) exit 0, build ✓ (vendor 318.49 kB / 102.50 kB gzip, dentro del presupuesto 500 kB raw), visual contract 12 rules / 0 failing. Commits en rama: 39d22ad, 7d4983a, bc8f9bc, cb8de70, 681c1f2, 027290c, 9305130. main sin cambios. Fase 0 completa → Fase 1 (plantilla tal cual) next.
- L5 (2026-10-20): S4 — cobertura real del typecheck, corregida. `strict: true` está configurado, pero `include` solo cubre `src/domain, src/data, src/integrations, src/lib, src/offline`; el árbol TS/TSX de la plantilla (172 archivos en `src/components`, `src/views`, `src/layouts`, `src/api`, `src/context`, `src/hooks`, `src/routes`, `src/types`) queda fuera, salvo `src/lib/utils.ts`. `pnpm typecheck` exit 0 no cubre ese código. Probe con `tsc --ignoreConfig` sobre los 172: 506 errores; 429 de resolución (307 imports `@/...`, 116 `src/...`, 6 paquetes: `msw`, `chance`) y ~77 de tipos (41 implicit any, 21 TS2339, 7 por `@types/lodash` faltante, 6 TS7031, 2 TS2783). Follow-up F1 (PR encadenado, fuera de #383): agregar `paths` para `@/*` y `src/*`, declarar o borrar `msw`/`chance`, `@types/lodash`, y resolver los ~64 errores restantes. El comentario de `tsconfig.json` ya no afirma que no existen archivos TS/TSX.
- L6 (2026-10-20): F1 — cobertura TS/TSX cerrada en el PR encadenado. `paths` (`@/*` y `src/*` → `./src/*`) e `include` con `src/api`, `src/components`, `src/context`, `src/hooks`, `src/layouts`, `src/routes`, `src/types`, `src/views`. `baseUrl` NO se agregó: TS 6.0 lo marca deprecado (TS5101) y sin él los valores de `paths` necesitan `./` (TS5090). `npx tsc --noEmit --listFiles | grep -c` = **248** (172 TS/TSX + 76 JS); probe de cobertura: un `const __coverage_probe: number = "..."` inyectado en `src/components/ui/button.tsx` produjo TS2322 y se revirtió. Errores reales bajo la config del repo: **2**, ambos TS7016 por `react-syntax-highlighter` sin declaraciones, resueltos con `@types/react-syntax-highlighter`. El estimado 506/77 de L5 era un artefacto de `--ignoreConfig` (sin paths ni `skipLibCheck`), no el estado bajo la config real. Deps dev: `msw` 3.0.3 y `chance` 1.1.13 (isla de mocks `src/api/**`, sin importadores fuera de ella; se declaran en vez de borrar para mantener S1 verbatim), `@types/chance`, `@types/lodash`, `@types/react-syntax-highlighter`. Gates: typecheck 0, lint 0, integrity OK, 420/420, 44/44, build OK, visual 12/0; `pnpm install --frozen-lockfile` OK.
Commit 621e244.
