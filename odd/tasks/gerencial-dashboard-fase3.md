# Gerencial Dashboard Fase 3 — datos reales sobre el template completo

Cablear el template gerencial ya importado (Fases 1–2, PR #383) a datos reales de
CEMURM sin recortar su esquema, estructura ni visual. Branch:
`feat/tw4-stack-foundation-pr3-admin`. Base: `feat/tw4-stack-foundation-pr2-typecheck`
(F1). Merge: decisión humana. Runner: `pnpm && pnpm test`.

**Estado (2026-10-20):** T1–T7 completos y gates verdes. Rama pusheada al fork.
El PR a `main` queda pendiente de que mergeen #383 y F1, porque este branch se
apoya en F1.

## Specs

- **S1** (template completo): las 25 vistas y todas las rutas del template quedan
  montadas en `/dashboard` — dashboard, blog (5), notes, tickets (2), pages (3),
  icons, auth (4 + error/maintenance). No se elimina ninguna. La verificación
  contra la fuente (`/home/antony/Descargas/shadcndashboard-main/src`) da 0
  archivos faltantes en la copia importada.
- **S2** (acceso gerencial): `/dashboard` vive dentro de `RequireAuth` y
  `RequireGuardianConsent`; además, `RequireOrgOwner` exige una membresía activa
  en `org_memberships` con rol `org_owner` (solo owner; `org_admin`,
  `branch_admin`, `instructor` y `system_admin` no pasan). Sin acceso → `/`.
  Fail-closed: una lectura que falla no concede acceso.
- **S3** (dashboard real): el home `/dashboard` deja de usar arrays hardcodeados y
  lee conteos/listas de los repositorios existentes (`songs`, `setlists`, `gigs`,
  `venues`, `rehearsals`, `bandmates`, `orgRepertoire`, `profiles`). Se conserva
  la estructura de cards y grillas del template; sólo cambian labels y datos.
  **Límite declarado:** esos repositorios son owner-scoped (`songs.created_by`,
  `setlists.owner_id`, `gigs.owner_id`), así que el home muestra los números del
  gerente autenticado, no un rollup de toda la organización. Un rollup org-wide
  requiere queries RLS nuevas y queda fuera de esta fase.
- **S4** (perfil real): `/dashboard/pages/user-profile` lee
  `profiles.getProfile` y `orgRepertoire.getMyOrganizations` en vez de datos
  demo.
- **S5** (tablas reales): `/dashboard/pages/tables` lista canciones y setlists
  reales del usuario con las mismas primitivas de tabla del template.
- **S6** (pantallas sin dominio): blog, notes, tickets, icons y el auth del
  template quedan como pantallas demo visuales. No fingen persistencia: no
  escriben en Supabase y muestran una marca de "demo" donde el template ya
  mostraba datos falsos. No se inventan tablas ni RPCs.
- **S7** (tema): `ThemeProvider` se monta en el subtree `/dashboard` para que el
  toggle del template tenga efecto; `defaultTheme="dark"` porque la paleta cem
  es un ramp oscuro.
- **S8** (músico intacto): `src/features/stage/**`, `projection/**`,
  `landing/**` y las rutas del músico no cambian. Gates: typecheck, lint, test,
  gherkin, build, visual.

## Tasks

- T1 — S2: ✅ `b234254` — guard `RequireGerencial` + montaje del subtree dentro de los guards; superseded por `RequireOrgOwner` y el mount `/dashboard` en `f612277` (merge del padre).
- T2 — S7: ✅ `b234254` — `ThemeProvider` en el subtree admin.
- T3 — S3: ✅ `f198bb9` — home con métricas y listas reales.
- T4 — S4: ✅ `ed64a3b` — perfil real (identidad + organizaciones), sin escrituras falsas.
- T5 — S5: ✅ `da00f4a` — tables reales (canciones + setlists).
- T6 — S6: ✅ `1623e7f` — demos explícitas, sin red ni escrituras falsas.
- T7 — S8: ✅ `841e44b` — docs + gates + evidencia.

## Log

- L1 (2026-10-20): pedido del usuario, verbatim: "si, quiero que se replique el
  esquema estructura y visual del dashboard que pase, TODO". Decisión de alcance
  elegida por el usuario: "Template completo en /admin: se quedan las 25 vistas
  del template (dashboard, blog, notes, tickets, pages, icons, auth). Se cablean
  a datos CEMURM donde exista equivalencia; las que no tengan dominio quedan como
  pantallas demo hasta definirlas."
- L2 (2026-10-20): conflicto detectado y resuelto. En el working tree hay un WIP
  sin commitear (`features/internal-operations-console.feature` +
  `openspec/changes/add-internal-operations-console/`) que propone un console
  staff en `/dashboard` con 5 secciones y excluye blog/tickets/notes. El usuario
  eligió el template completo en `/admin`; ese WIP no se toca en esta rama.
- L3 (2026-10-20): completitud contra la fuente verificada con `comm` sobre las
  listas de archivos de `src/views`, `src/layouts`, `src/components`,
  `src/routes`, `src/context`, `src/hooks`, `src/types` y `src/api`: 0 archivos
  de la fuente faltantes. Los 10 archivos extra de la copia son hooks CEMURM
  preexistentes (`useActiveOrgName`, `useBandmates`, `useGigs`, `useMidi`,
  `useModeration`, `useNotifications`, `usePlanningCenter`, `usePreferences`,
  `useSetlists`, `useSongs`).
- L4 (2026-10-20): T1/T2 cerrados en `b234254` (guard gerencial + ThemeProvider).
  Verificación en navegador real: signed-out → `/auth`; demo@ (org_owner) →
  `/admin` renderiza el template; isolation@ (org_member) → `/`. T3 cablea el
  home con `useAdminOverview`: canciones, setlists, gigs + venues, ensayos,
  bandmates, organizaciones y perfil. Verificación con demo@: 9 canciones, 1
  setlist, 2 eventos, 1 banda, 1 organización, 0 ensayos; chart "9 new this
  period" / "1 setlist created"; tabla de eventos con las 2 filas reales e IDs
  únicos; 0 errores de consola. Gates: `pnpm typecheck` 0, `pnpm lint` 0,
  `pnpm test` 425/425.
- L5 (2026-10-20): T4 reemplaza el formulario falso del template (estado local,
  "Save Changes" sin persistencia) por un perfil real. `useAdminProfile` lee
  `profiles.getProfile` y `orgRepertoire.getMyOrganizations`; el header muestra
  nombre, @username, rol y organización reales, y las tarjetas "Personal
  Information" / "Organizations" listan las membresías con rol, sede, estado y
  fecha de ingreso. Se elimina el modal de edición y la dirección inventada.
  `profiles.js` ahora expone `avatarUrl` (columna que el select ya traía).
  Verificado con demo@: Demo User, @demo, Owner · Demo Academy, membresía
  Active; 0 errores de consola. Gates: typecheck 0, lint 0, test 425/425.
- L6 (2026-10-20): T5 reemplaza los dos datasets falsos del template
  (`EmployeeData` y `PerformersData`) por filas reales. `useAdminTables` lee
  `songs.listSongs` y `setlists.listSetlists`: el basic table muestra setlists
  (nombre, cantidad de canciones, visibilidad y fecha), y las variantes hover,
  striped, checkbox y TanStack muestran canciones (título, artista, tonalidad,
  BPM y estado). `table-data.ts` queda sólo con el tipo `PerformerRow`
  compartido; los menús Add/Edit/Delete y el botón de borrar se reemplazan por
  un enlace real a `/songs/:id` o `/setlists/:id`. El DataTable conserva
  búsqueda, orden, paginación y export CSV. Verificado con demo@: Demo Setlist
  (2 songs, Shared), 9 canciones reales (Way Maker, Oceans, Amazing Grace…),
  sin datos de empleados ni acciones falsas, 0 errores de consola. Gates:
  typecheck 0, lint 0.
- L7 (2026-10-20): T6 convierte las pantallas sin dominio en demos explícitas.
  Los módulos mock del template llamaban a `/api/...` contra un worker MSW que
  nunca se inicia, así que blog, notes y tickets cargaban vacíos. Se reemplazan
  por contenido estático en `src/demo/content.ts` (6 posts con comentarios, 4
  notas, 6 tickets) y los tres contextos pasan a estado local: sin red, sin
  Supabase y sin `chance`/MSW en runtime. `DemoNotice` marca blog (5 vistas),
  notes, tickets (2) e icons; `BlankLayout` marca las pantallas auth y excluye
  `/admin/auth/404`. El `TicketProvider` se monta una vez alrededor del layout
  admin para que un ticket creado en `/admin/apps/tickets/create` siga en la
  lista al navegar (el template dependía de la caché global de SWR). Verificado
  con demo@: blog con 6 posts, detalle con comentarios, notes con 4 notas y alta
  en memoria, tickets con 6 y alta que sobrevive al cambio de ruta (7 en la
  lista), auth con aviso; 0 errores de consola.
  Además se corrigió la navegación del subtree: el template enlazaba con rutas
  absolutas (`/`, `/apps/...`, `/pages/...`) que escapaban de `/admin`. Se
  agregó `toAdminPath` (con test) y se aplicó al sidebar, breadcrumb, logo y
  menú del header; se corrigieron el slug del blog detail y la ruta del error, y
  se convirtieron los triggers anidados de Base UI (`asChild` inválido) a
  `render={<Button/>}` en 10 puntos, eliminando los errores de hidratación.
  Límite conocido: el sheet del avatar conserva la identidad demo del template
  (Cameron) y su "Log Out" lleva a la pantalla auth marcada como demo, no al
  signOut real; no es una de las pantallas de S6 y queda como deuda visual.
  Gates: typecheck 0, lint 0, test 427/427; sidebar con 17 links internos, 0
  fuera de `/admin`; logout demo verificado a `/admin/auth/auth2/login` sin
  errores de consola.
- L8 (2026-10-20): T7 cierra la fase con los gates completos sobre `a57c029`
  (T6 + docs). `pnpm typecheck` 0; `pnpm lint` 0; `pnpm test` 427/427 en 21
  archivos; `pnpm test:gherkin` 44/44 en 5 archivos; `pnpm build` 0 con el
  warning preexistente de chunks >500 kB (iconify 917 kB);
  `scripts/check-visual-contract.sh` 12 reglas con 0 failing (los warnings son
  report-only y preexistentes); `scripts/check-test-integrity.sh` 0 sobre 26
  archivos. No se tocó `src/features/stage/**`, `projection/**`, `landing/**`
  ni ninguna ruta del músico.
  Límites declarados: el home sigue owner-scoped (S3); el sheet del avatar
  conserva la identidad demo del template; el sidebar mantiene los enlaces
  externos del template a demos no importadas (ecommerce, kanban, charts,
  theme pages), que no son rutas locales. Entrega: rama pusheada al fork; PR a
  `main` después de #383 y F1.
