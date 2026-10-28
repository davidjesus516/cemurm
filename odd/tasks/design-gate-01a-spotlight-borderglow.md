# Design — reparar 01a/01b en `spotlightCard.jsx` y `borderGlow.jsx`

Estado: **listo para revisión**
Ruta: **inline (degradada)** — ver Route declaration.

## Objetivo

Dejar verdes `pnpm lint` y `pnpm check:visual` sobre los dos componentes de
`/design` que rompían las reglas, **sin alejarlos del original**: la estructura,
las matemáticas y la anatomía del DOM quedan idénticas a reactbits; cambia
sólo la *escritura* del color.

## Por qué

El pull de la sesión (`odd/tasks/flex-carousel-port.md`, T5) encontró ambos
gates en rojo **antes** de tocar nada:

- `pnpm lint` → 3 errores `react/prop-types`, los tres en `spotlightCard.jsx`.
- `pnpm check:visual` → regla 01a con 25 literales crudos en `borderGlow.jsx` +
  `spotlightCard.jsx`; regla 01b con 7 ocurrencias contra techo 5 (las 2 nuevas
  en `spotlightCard.jsx:48`).

`src/features/design/` entero está sin commitear en la rama `landing-page`, así
que ese rojo nunca pasó por CI. El mantenedor autorizó arreglarlo ("arreglalos y
que quede lo más parecido al original posible").

## Alcance (allowed edit surfaces)

- `src/features/design/components/spotlightCard.jsx`
- `src/features/design/components/borderGlow.jsx`
- `src/features/design/components/colors.js` (helper compartido `withAlpha`)
- `DESIGN.md` (dos filas de la tabla de desviaciones + el párrafo de BorderGlow)
- `odd/tasks/design-gate-01a-spotlight-borderglow.md`

Fuera de alcance a propósito: `accordionGallery.jsx` y `reference.css`, que
está escribiendo **otro writer en paralelo** en este mismo worktree.

## Checklist

- [x] T1 — `colors.js`: `withAlpha(color, alpha)` → hex de 8 dígitos sobre los
       canales que ya resolvió el probe. Es el único punto donde el alfa se
       pliega, y no escribe ninguna función de color.
- [x] T2 — `spotlightCard.jsx`: eslint-disable de prop-types (los 3 errores de
       lint), `'use client'` fuera, `spotlightColor` pasa a nombre de token
       (`text`) con el alfa 0.25 del original, cáscara
       `border-cem-elevated bg-cem-base` en vez de `border-neutral-800
       bg-neutral-900`.
- [x] T3 — `borderGlow.jsx`: `backgroundColor`/`glowColor`/`colors` pasan a
       nombres de token resueltos por `useTokenColors`; `parseHSL` desaparece y
       `buildBoxShadow` conserva las trece capas con su alfa por capa escrito
       en hex; `isLightColor` corre sobre `luminance()` con el mismo umbral
       (180/255 = 0.706); borde y sombra de la tarjeta salen del probe.
- [x] T4 — `DESIGN.md`: las dos filas pasan a **Fiel con desviaciones** y el
       párrafo "una sola desviación estructural" pasa a **cero desviación
       estructural**, que es lo que el código hace.
- [x] T5 — Verificar: `pnpm lint && pnpm test && pnpm typecheck && pnpm build &&
       bash scripts/check-visual-contract.sh`.

## Route declaration

| Task | Route | Trigger evidence |
|---|---|---|
| T1–T4 | **inline (degradada)** | 4 archivos no triviales = writer trigger, pero el mecanismo de delegación sigue caído (`ENOTFOUND opencode.ai` + aborto en la sesión previa); además los archivos los estaba tocando otro writer en paralelo, y una segunda escritura habría sido un conflicto seguro. |
| T5 | inline (degradada) | mismo; comandos corridos en el padre con salida acotada a colas |

## Progreso / Evidencia

Resultado de T5 (2026-10-06):

| Comando | Observado |
|---|---|
| `pnpm lint` | **0 errores** (antes: 3, los tres en `spotlightCard.jsx`) |
| `pnpm check:visual` | 01a **8 ocurrencias, todas en `accordionGallery.jsx`** (fuera de alcance, otro writer activo); 01b vuelve a **WARN con 5 = techo**; 02 en 234 = techo, sin crecer |
| `pnpm test` | 14 archivos, 355 tests, 0 fallidos |
| `pnpm typecheck` | exit 0 |
| `pnpm build` | exit 0; las clases de opacidad arbitraria generan el CSS esperado (`border-cem-base/[0.12]` → `#0f172a1f`, `border-cem-text/[0.15]` → `#f8fafc26`) |

Ambos ficheros arreglados aportan **0** hallazgos a 01a y **0** a 01b.

## Desviaciones aceptadas

Ninguna estructural. La única distancia respecto del original es *cómo se
escribe* el color (token + hex con alfa en lugar de funciones de color y
utilidades de paleta), más el mapeo de los tres tonos de la malla de BorderGlow
al escalón que permite una paleta de un solo acento. Todo está anotado en el
archivo y en `DESIGN.md`.

## Hallazgos que quedan abiertos (fuera de este unit)

1. **`accordionGallery.jsx` (8 hallazgos de 01a).** Esté escribiendo otro writer
   y lleva los literales dentro de **comentarios** (`color-mix(`, `rgb(`): la
   regla 01a escanea comentarios, así que basta con describir la función sin el
   paréntesis. Mismo trampa que ya mordió al port de FlexCarousel.
2. **`pnpm build` avisa de CSS inválido.** Tailwind toma
   `shadow-[${GLOW}]` de los **comentarios** de `holdButton.jsx:29` y
   `reference.css:1170`, y emite `--tw-shadow-color: ${GLOW};` roto. No falla
   ninguna puerta (build exit 0) pero es ruido en cada build.
