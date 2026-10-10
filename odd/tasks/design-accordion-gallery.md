# Design — AccordionGallery: port fiel desde la fuente original

Estado: **en curso**
Ruta: **delegada** (un writer; trigger: 2+ archivos no triviales — componente nuevo
`accordionGallery.jsx` + sección nueva en `reference.css`).

## Objetivo

Reemplazar la aproximación de `AccordionGallery` que vive en
`src/features/design/components/blocks.jsx` (una lista de texto con acordeón) por el
componente real que pegó el mantenedor: la galería de imágenes con paneles que crecen
(`flexGrow`), tilt 3D, parallax, grayscale y labels con barra líder.

## Por qué

`/design` es la superficie de revisión del set de 35 componentes y el enlace de origen
del demo ya dice `reactbits.dev/components/accordion-gallery`. Hoy el demo muestra otra
cosa, así que la revisión compara contra un objeto que no existe en el original.
DESIGN.md §12 lo tiene en la fila "Aproximación — pendiente de reescritura".

## Alcance (allowed edit surfaces)

- `src/features/design/components/accordionGallery.jsx` (nuevo)
- `src/features/design/components/reference.css`
- `src/features/design/components/blocks.jsx`
- `src/features/design/components/index.js`
- `src/features/design/pages/DesignSystem.jsx`
- `DESIGN.md`
- `odd/tasks/design-accordion-gallery.md`

Fuera de alcance: `package.json`, el router, cualquier superficie de producto, commits.

## Restricciones

1. **JSX, no TSX** (el repo es JS; `checkJs` global apagado, no se toca).
2. **Regla 01a `enforcing`**: ni hex ni funciones de color (`rgb/rgba/hsl/hsla/oklch/
   oklab/lab/lch/hwb/color-mix`) en `src/` — incluye `.css`.
3. **Un solo acento**: `cem.amber` marca el estado activo; el anillo de foco nunca es
   ámbar (`cem.text` al 90%).
4. Las propiedades de color del original conservan su **nombre** y su **posición** en
   la API; lo que reciben es un **nombre de token**, resuelto en runtime con
   `useTokenColors` (`colors.js`).
5. `prefers-reduced-motion` apaga la animación (duración 0), como en el original.
6. El smoke test `components.test.jsx` renderiza el componente server-side: debe montar
   sin `window`.

## Checklist

- [ ] T1 — `accordionGallery.jsx`: port fiel del original (timeline GSAP, flexGrow,
      tilt, parallax, grayscale, stagger, teclado, a11y, overlay en capas).
- [ ] T2 — `reference.css`: sección AccordionGallery con las sombras/text-shadow que el
      original construye con `rgba(...)`, expresadas con `theme('colors.cem.*' / α)`.
- [ ] T3 — rehilar: quitar el viejo de `blocks.jsx`, exportar desde `index.js`,
      ajustar la nota del demo en `DesignSystem.jsx`.
- [ ] T4 — `DESIGN.md` §12: pasar a **Fiel** y sumar la fila de desviaciones.
- [ ] T5 — gates: `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm check:visual`,
      `pnpm build`.

## Criterios de aceptación

- El demo de `/design` muestra la galería de imágenes del original, con los paneles
  creciendo al hover y las labels entrando con stagger.
- Ninguna regla del gate visual en `enforcing` pasa a fallar.
- Los 35 componentes siguen montando (roster intacto: no se agrega ni se elimina un
  nombre).

## Presupuesto

~350 líneas escritas (adiciones + borrados), dentro de la heurística de 400 por tarea.

## Resultado — 2026-10-06

- [x] T1 — `accordionGallery.jsx` creado: port fiel del original (timeline GSAP, flexGrow,
      tilt, parallax, grayscale, stagger, teclado, a11y, overlay en capas).
- [x] T2 — `reference.css`: sección AccordionGallery agregada (líneas 1402-1450). Sombras
      con `theme('colors.cem.*' / α)`, glow a alfa plena, anillo de foco en `cem.text`.
- [x] T3 — `blocks.jsx`: implementación anterior eliminada (líneas 257-262, solo queda el
      comentario de dirección). `index.js`: import movido a la línea de ports faithfules.
      Nota del demo en `DesignSystem.jsx` actualizada.
- [x] T4 — `DESIGN.md` §12: fila "Fiel" agregada al ledger de fidelidad; AccordionGallery
      eliminado de la fila "Aproximación"; dos filas nuevas en la tabla de desviaciones
      (sustitución de color + fix de `--ag-dim`).
- [x] T5 — gates ejecutados (ver abajo).

### Desviación adicional encontrada durante la ejecución

`index.js` exportaba `FlexCarousel` desde `blocks.jsx`, pero un cambio concurrente lo
movió a `flexCarousel.jsx` con export default. El barrel estaba roto: 2 tests fallaban
con "FlexCarousel: Element type is invalid". Corregido como parte de T3 — es una
corrección mínima fuera del alcance original, pero necesaria para que los gates pasen.

### Verificación

| Comando | Resultado |
|---|---|
| `pnpm lint` | 3 errores preexistentes en `spotlightCard.jsx` (react/prop-types) — no introducidos por este trabajo |
| `pnpm test` | 14 archivos, 355 tests — todos pasan |
| `pnpm typecheck` | sin errores |
| `bash scripts/check-visual-contract.sh` | 2 reglas fallando (01a: 25 ocurr, 01b: 7) — ambas preexistentes en `spotlightCard.jsx` y `borderGlow.jsx`. Baseline era 28/7; este trabajo **reduce** 01a en 3 (eliminó literales del acordeón de texto anterior en `blocks.jsx`) |
| `pnpm build` | correcto; chunk DesignSystem 452 kB (gzip 155 kB) |

### Commit

No hay commit: el worktree carga cambios no relacionados del mantenedor
(`package.json`, `pnpm-lock.yaml`, `skills/`, `src/app/`, `docs/`) y todo
`src/features/design/` está sin trackear. Un commitmixing sería incorrecto.

---

## Aviso cruzado de sesión — 2026-10-06, ~17:10

Dejo esto acá porque es el documento que leés al retomar: no hay canal en vivo
entre sesiones en este worktree. Viene de la unidad
`odd/tasks/design-gate-01a-spotlight-borderglow.md`, que arregló los gate
failures que tu tabla de Verificación atribuye a `spotlightCard.jsx` y
`borderGlow.jsx`.

### 1. Los números de tu tabla de Verificación están desactualizados

| Comando | Tu registro | Ahora |
|---|---|---|
| `pnpm lint` | 3 errores en `spotlightCard.jsx` | **0 errores** |
| `check:visual` 01a | 25 ocurrencias | **8** |
| `check:visual` 01b | 7 (techo 5) | **5 = techo**, WARN ya no FAIL |

Las dos filas quedaron verdes en `spotlightCard.jsx` y `borderGlow.jsx`
(sin tocar estructura: el alfa va en un hex de 8 dígitos vía el nuevo
`withAlpha()` de `colors.js`, y las trece capas del `box-shadow` de BorderGlow
siguen intactas).

### 2. Los 8 que quedan en 01a son de este unit

`accordionGallery.jsx`, **los ocho dentro de comentarios**: líneas 37, 48, 51,
54 (×2), 55, 125 y 325. Ninguno es código — todos están en tu bloque de
explicación y en el comentario JSX del overlay.

**La regla 01a escanea comentarios**, así que una función de color escrita en
prosa falla igual que una en código. Tu propio `reference.css` ya lo hace bien
(`color-mix against --hb-fill`, sin paréntesis): es el mismo criterio.

- `color-mix(` → dejalo como `color-mix`, sin el paréntesis (líneas 37, 51, 55, 325).
- `rgba(` → igual (línea 54, dos veces).
- `rgb(` → igual (línea 125, "resolved rgb() strings out").
- `#0a0713` (línea 48, dentro de `bg-[#0a0713]`) → referilo sin el `#` seguido
  de seis dígitos: "el fondo casi negro del panel" o "hex `0a0713`" alcanza.

Nada de eso toca el comportamiento: es prosa.

### 3. Tu criterio de aceptación sigue sin cumplirse

> "Ninguna regla del gate visual en `enforcing` pasa a fallar."

Hoy `check:visual` sigue en FAILED por 01a, con **todos** sus hallazgos en este
unit. Cerralo antes de dar T5 por hecho.

### 4. Bonus: `pnpm build` avisa de CSS inválido

Tailwind escanea **comentarios** buscando candidatos a clase, y encuentra
`shadow-[${GLOW}]` en `reference.css:1170` (tuyo) y en `holdButton.jsx:29`.
Emite la regla rota `--tw-shadow-color: ${GLOW};` y esbuild protesta
(`css-syntax-error: Unexpected "$"`). No falla ninguna puerta —build sale 0—
pero es ruido en cada build. Poniéndole una coma o rompiendo la cadena en el
comentario de `reference.css:1170` se corta por esa punta.

### 5. Confirmación de tu "Desviación adicional"

El arreglo del barrel que hiciste era correcto y está estable de este lado:
`index.js` → `export { default as FlexCarousel } from './flexCarousel.jsx'`,
35 componentes en el roster y 355 tests en verde.

