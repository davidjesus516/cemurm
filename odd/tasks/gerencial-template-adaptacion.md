# Gerencial Template Adaptación (Fase 2)

Adaptar los colores/clases de la plantilla importada (odd/tasks/gerencial-template-import.md,
Fase 1) al sistema visual CEMURM, resolviendo las 3 reglas enforcing del visual contract
SIN debilitar el gate. Branch: `feat/tw4-stack-foundation`. Merge: decisión humana.
Runner: `pnpm && pnpm test`. Base: Fase 1 importada tal cual (commits U1–U5).

## Specs

- **S1** (regla 01a / hex literals): los 40 color-literals del árbol de plantilla
  (Tiptap css, app.css/style-lyra inline, dashboards) quedan escritos con clases/tokens
  cem.* (bg/text/border según rol cem). Cero hex literals nuevos. Prohibido introducir
  tokens de color nuevos: solo la paleta cem existente (inventario validado por el r1/r5a
  del propio gate). Mapping rol→rol documentado en el Log.
- **S2** (regla 01b / contraste de clases no-cem): el techo de ocurrencias no-cem vuelve a
  pasar reescribiendo las clases semánticas shadcn que la plantilla trajo (bg-card,
  text-foreground, text-muted-foreground, text-primary...) a sus equivalentes cem.*
  directos (bg-cem-surface, text-cem-text, text-cem-secondary, bg-cem-amber...).
  Es reemplazo mecánico color→color equivalente; NO rediseño, NO cambio de jerarquía
  visual. Los 35 alias del bloque @theme (regla 04) se eliminan cuando quedan sin uso.
- **S3** (funcionalidad intacta): ningún cambio de comportamiento; si un reemplazo cambia
  algo más que el color efectivo, se anota en el Log y se retoma.
- **S4** (colores sin equivalente cem claro — p. ej. status colors de la plantilla):
  mapear al token cem más cercano (emerald/rose/sky/coral/amber según semántica) y
  documentar cada mapeo en el Log para revisión humana.
- **S5** (gate como autoridad): scripts/check-visual-contract.sh NO se debilita; las 12
  reglas deben pasar. Un false positivo legítimo del gate se arregla como bug del gate en
  un commit separado `fix(gate): <motivo>` con evidencia, nunca como relax de threshold.
- **S6** (músico intacto): src/features/stage/**, src/features/projection/**,
  src/features/landing/** y las rutas del músico quedan byte-idénticas; 404 tests +
  41 gherkin + typecheck + lint + build siguen pasando en la rama.

## Tasks

- V1 — S1: DONE c55ba93 — hex literals del árbol template reescritos a roles cem.
- V2 — S2: DONE 139ed74 — las clases shadcn (rol y paleta default) reescritas a cem.*;
  los 26 alias de rol eliminados del @theme. Cierra 01b y 04; 02 queda en 240/240
  (techo exacto, cero holgura, mismo conteo que main).
- V3 — S4: DONE 139ed74 — mapeos sin equivalente documentados en L3.
- V4 — S5: DONE 139ed74 — extensión de allowlist aprobada como decisión (c); sin cambio
  de thresholds. El techo de 01b bajó 5 → 0 al desaparecer sus últimas ocurrencias.
- V5 — S6: DONE — suite completa re-observada; evidencia en L5. La identidad literal
  de S6 no se cumplió: ver L7 (10 archivos, renames TW4 obligatorios).

## Log

- L1 (2026-10-16): origen: Fase 1 terminó con visual gate FAILED en 3 reglas
  (01a = 40 hits; 01b = 121 vs techo 5, 116 nuevas de la plantilla; 04 = 35 alias
  --color-* fuera de allowlist). El usuario ya autorizó esta fase
  ("primero lo pasamos exactamente como está, al terminar de instalarlo, hacemos los
  cambios") y el doc de import (S6) registró "no se debilita el gate". Fase 2 ejecuta
  esa misma instrucción sobre el gate.
- L2 (2026-10-16): decisión humana, opción (c): "mantener 9 keys status/chart +
  allowlist exacta; borrar los ~26 alias de rol; no tocar thresholds". El `@theme`
  declara 26 keys (17 leaves cem.* + 9 status/chart) y el allowlist de la regla 04
  queda pinneado a ese mismo set. La eliminación de los alias obliga al sweep de sus
  usos: 890 ocurrencias en ~120 archivos del árbol importado.
- L3 (2026-10-16): mapping rol→cem aplicado por reemplazo mecánico (sin rediseño):
  background→cem.base; card/popover/sidebar→cem.surface|elevated; primary→cem.amber;
  secondary→cem.elevated; muted/accent→cem.hover; muted-foreground→cem.secondary-elevated;
  border/input→cem.hover; ring→cem.secondary; foreground→cem.text. Paleta default de
  Tailwind: black→stage-bg (negro exacto), white→text (blanco del sistema),
  gray/neutral/zinc→secondary|secondary-elevated|hover, red→destructive,
  emerald→success. Los pares light/dark del template se colapsaron a un solo token:
  la app es dark-only.
- L4 (2026-10-16): incidente y reparación. El commit 8fe225e (cirugía del @theme con
  sed por rangos) borró también los 17 leaves cem.* y dejó una llave de más; el
  archivo se restauró desde c55ba93 y la cirugía se rehizo con edición precisa.
  Además se encontró en `projects-orders.tsx` un artefacto de una edición anterior
  (fragmento de tool-call pegado dentro de un comentario); se eliminó.
- L5 (2026-10-16): V5 — evidencia re-observada en `139ed74`:
  `pnpm test` 404/404 · `pnpm test:gherkin` 41/41 · `pnpm typecheck` exit 0 ·
  `pnpm lint` exit 0 · `pnpm build` ✓ (warning de chunk >500 kB pre-existente) ·
  `bash scripts/check-visual-contract.sh` → `visual contract: OK (12 rules checked,
  0 failing)`; 01b = 0 (techo 0), 02 = 240 (techo 240), 04 = 0, 05a PASS.
  `src/features/stage|projection|landing` sin cambios (S6). `main` intacto en 2f06b1f.
  Fuera del árbol template el sweep tocó dos scrims modales de superficie tier-1
  (`FeedbackForm.jsx` bg-black/50 y `SongDetail.jsx` bg-black/85 → `bg-cem-stage-bg`
  con la misma opacidad; negro exacto, cero cambio visual): son las ocurrencias
  toleradas por el techo de 01b, y sin ellas el techo no podía bajar a 0.
- L6 (2026-10-20): integración de `main` (54 commits, `2f06b1f` → `0b311e9`) antes
  del PR. Un solo conflicto, `pnpm-lock.yaml`: se tomó el lock de main y se
  re-resolvió con `pnpm install`, probando después `pnpm install --frozen-lockfile`.
  El merge heredó el parche CVE-2026-104844 de main para
  `postcss-selector-parser@6.1.4`; con Tailwind 4 ese paquete ya no existe en el
  árbol (0 ocurrencias en el lock resuelto), pnpm lo rechazó como parche sin uso y
  se retiraron la entrada de `pnpm-workspace.yaml` y el archivo. El código
  vulnerable no se distribuye en esta rama.
  Evidencia post-merge en `4133168`: `pnpm lint` 0 · `pnpm typecheck` 0 ·
  `scripts/check-test-integrity.sh` OK (23 archivos) · `pnpm test` 415/415 ·
  `pnpm test:gherkin` 44/44 · `pnpm build` ✓ · gate 12 reglas / 0 failing.
  `deno check 'supabase/functions/**/*.ts'` no se ejecutó localmente (Deno no
  instalado); la rama no toca `supabase/`.
  PR abierto: davidjesus516/cemurm#383 (431 archivos, +29.841/−968, reviewer
  solicitado). El commit `4133168` saca del índice 13 rutas de trabajo local en
  curso (UML generado amp-02/uc-04, `features/internal-operations-console.feature`
  y su cambio OpenSpec), que quedan untracked en el working tree.
- L7 (2026-10-20): auditoría pre-merge con dos verificadores read-only y correcciones
  aplicadas en la rama. Hallazgos y resolución:
  (a) `src/components/ui/chart.tsx` usaba `fill-cem-hover-foreground`, token
      inexistente: el sweep convirtió `fill-muted-foreground` en un nombre inventado y
      los ticks del chart perdían el fill. Corregido a
      `fill-cem-secondary-elevated`, el rol que L3 asigna a muted-foreground.
  (b) La regla 04 no era byte-idéntica: el parser convertía el primer guion en punto
      (`chart-1` → `chart.1`) y la allowlist guardaba `chart-1`; pasaba solo porque
      `grep -qx` interpretaba el path como regex y `.` matcheaba `-`. El parser ahora
      solo convierte el namespace `cem-` y el match usa `grep -qxF` contra un archivo
      (no un pipe): con `pipefail`, `grep -q` podía cerrar el pipe y `printf` morir
      con SIGPIPE, produciendo un FAIL falso e intermitente sobre la primera key.
      La allowlist (26 keys) coincide exacta con el `@theme` y r2 imprime `chart-1`.
  (c) `Tiptap.css` tenía cuatro referencias a tres tokens inexistentes
      (`--color-dark` ×2, `--color-bodytext`, `--color-darkborder`); las
      declaraciones se descartaban. Reemplazados por `cem-text` (texto) y
      `cem-hover` (borde). `--color-white` sí existía (default de Tailwind) y su
      reemplazo por `cem-text` es el mapeo L3, no un token perdido.
  (d) `reference.css` ya tenía su `@reference` (línea 14 en 8b7258d); la auditoría 1 se
      equivocó al decir que faltaba. El fallo real es la forma citada de
      `theme('colors.cem.*' / α)` en 7 lugares, que TW4 rechaza
      (`Could not resolve value for theme function`). Se pasaron a la forma sin
      comillas y el archivo compila con tailwindcss 4.3.3 (COMPILE OK, 29.800
      bytes). El primer intento agregó un `@reference` duplicado; el verificador
      lo detectó y se retiró. Es latente: DesignSystem no tiene ruta.
  (e) `skills/cemurm-visual-system/SKILL.md` decía que el token source era
      `tailwind.config.js` (borrado); ahora apunta al `@theme` de `src/app/index.css`.
  (f) S6: `stage` queda intacto (0 archivos), pero `projection` y `landing` tienen 10
      archivos con +14/−14: `outline-none`→`outline-hidden` y
      `backdrop-blur-sm`→`backdrop-blur-xs`, renames obligatorios de TW4 sin cambio
      visual. La frase "byte-idénticas" de L5 era falsa; se conserva como registro y
      se corrige acá.
  (g) Conteo del PR al momento de la auditoría (8b7258d): 431 archivos,
      +29.858/−968 (L6 decía +29.841). El tip crece con este commit.
  (h) Typecheck: `tsconfig.json` no incluye el árbol TS/TSX de la plantilla (171 de
      172 archivos fuera), así que `pnpm typecheck` verde no cubre ese código. Se
      corrigió el comentario del tsconfig y el follow-up quedó en
      `tw4-stack-foundation.md` L5; va como PR encadenado, no en esta rama.
  Deuda diferida, registrada: 9 utilidades del template sin CSS (18 usos), el par
  `secondary-elevated`/`hover` a 3.93:1 (la regla 05b ya lo reporta), `.test.tsx` fuera
  de Vitest y de `check-test-integrity.sh`, `msw`/`chance` importados sin declarar en la
  capa MSW muerta, y `handbook.html` generado y ya desfasado (1.850 líneas) antes de
  esta unidad. Evidencia: test nuevo `src/test/visual-contract-theme.test.js`
  (5/5; 4 tests RED antes de los fixes), gate 12 reglas / 0 failing, regla 04
  PASS, r2 con `chart-1`, `reference.css` compila.
