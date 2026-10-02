# Engineering Review — Backlog Findings

> Fecha: 2026-09-15 · Estado: evaluados, pendientes de planificación
> Fuente: revisión de ingeniería del estado post-Hito 2 (monorepo SPA Vite/React + Supabase hosted, `pnpm`, sin CI).
> Regla de entrada: cada ítem se implementa solo cuando su hito/feature BDD lo requiere — YAGNI activo.

## 1. TypeScript migration (classes/interfaces at minimum)

- **Evaluación**: el codebase es JS/JSX plano (131 módulos). Migrar a TS completo es un cambio de todo el árbol sin valor de usuario directo; el coste es alto justo antes de Hito 3 (colaboración). El mínimo viable pedido (classes/interfaces) solo tiene sentido en librerías de dominio: `src/lib/{transpose,annotations,songs,setlists}.js` son los candidatos naturales ya que concentran lógica pura con invariantes (tonalidades, anclas, versiones).
- **Decisión**: NO ahora. Re-evaluar al cierre de Hito 3 o si `docs/technical-spec.md` lo exige. Si se hace: JSDoc + `checkJs` primero (cero coste de build), luego tipos en `lib/` de dominio solamente.
- **No hacer**: convertir pages/components/hooks a TS sin necesidad; el contrato de repo es JSX.

## 2. Microservices split for 50+ concurrent users

- **Evaluación**: 50 usuarios concurrentes sobre Supabase hosted (Postgres + GoTrue + Realtime) no justifica microservicios — la PWA es client-heavy, casi todo el estado vive en el navegador e IndexedDB; la API es CRUD fino sobre RLS. Un split añadiría orquestación, operación y latencia sin concurrencia que lo demande.
- **Decisión**: NO. Mantener SPA + Supabase. Revisar solo si la medición muestra >~500 concurrentes reales o un hot path específico (p. ej. Realtime por setlist compartido en Hito 3 con cientos de suscriptores). En ese caso: subir recursos de Supabase / particionar Realtime, no microservicios.

## 3. Cloudflare R2 buckets implementation

- **Evaluación**: R2 (u Object Storage equivalente) aplica cuando existan archivos de usuario grandes: PDF scans (`pdf-scan-charts`, Hito 5), exports (`export-and-sharing`, Hito 6), imports URL (Hito 4). Hoy no hay assets binarios fuera del bundle. La tabla `outbox` y la capa offline no tocan almacenamiento de objetos.
- **Decisión**: DIFERIR al hito que introduzca binarios (Hito 4/5). Diseño a preparar entonces: bucket privado + presigned URLs vía edge function (o Supabase Storage, más integrado), políticas RLS como delimitador de autorización, sin claves en el cliente.

## 4. API rate limiting

- **Evaluación**: hoy toda la API es Supabase PostgREST — el rate limiting lo pone el plan de Supabase (gateway). La superficie expuesta que merece límites propios es la futura API pública (Hito 4: biblioteca pública, perfiles) y cualquier endpoint sin auth. No existe backend propio donde instalar límites.
- **Decisión**: DIFERIR a Hito 4 (primera superficie no autenticada/consultable). Implementación esperada: gateway/edge level (Cloudflare o Supabase platform limits) + validación en edge functions si se añaden; nunca en el cliente.

## 5. GitHub secret-keys usage

- **Evaluación**: hoy NO hay CI ni despliegue (no existe `.github/workflows` con jobs de build; el único workflow es el runner de lint-and-build de formato PR? — verificar). No se necesitan secrets de GitHub mientras no haya pipeline. Los secretos reales (Supabase URL/anon key) son públicos por diseño (PWA cliente); la service_role y claves de entorno viven en `.env.local` gitignored y `supabase/config.toml`.
- **Decisión**: ACCIÓN PENDIENTE solo cuando exista CI/CD (Hito 3+): usar GitHub Secrets para cualquier token de despliegue; GitGuardian ya corre y pasa (escaneo activo en PRs). Regla: jamás committed de service_role / factor de despliegue; rotar si se filtra.

## 6. Container/image builds

- **Evaluación**: la app es una SPA estática (Vite → `dist/`). Un container no aporta nada al despliegue actual (CDN/static hosting es lo apropiado). Contenedores solo tendrían sentido para un backend propio o edge functions autocontenidas (no existen hoy — todo es Supabase).
- **Decisión**: NO construir imágenes para la app. Si en Hito 5/6 aparece servicio auxiliar (import pipeline, worker), evaluar ahí: imagen liviana + registry + CI. Para el PWA: static hosting (Cloudflare Pages / Netlify / Supabase hosting) con build en CI.

## 7. La vista de grados no renderiza ningún numeral

> Añadido 2026-09-28. **Defecto medido, no hipótesis**: leído en la app corriendo, no deducido.

- **Evaluación**: con la vista de grados activada el renderizador pinta el **acorde concreto** atenuado y **ningún numeral**, para todos los acordes, tanto a offset +2 como a offset 0. `resolveDegree('C major', 'G')` devuelve `null`, y `G` en Do mayor es grado 5 sin ambigüedad posible. La fila del catálogo está presente y correcta (`Major` = `{0,2,4,5,7,9,11}`, `integer[]`) y `authenticated` tiene SELECT sobre `scale_catalog`, **así que los datos no son el bloqueo**. La causa raíz **no está pineada** y no se adivina aquí.
- **Dos mecanismos, medidos por separado**:
  1. `buildDegreeMap` keyea el mapa por el acorde **concreto** (`Dm`) mientras el renderizador busca el **traspuesto** (`Em`). Con cualquier offset distinto de cero el lookup no puede pegar. Esto explica el fallo a offset no-cero y **no** el de offset cero.
  2. El fallo a offset cero es independiente y sigue sin explicar.
- **Consecuencia sobre `fix-degree-quality-derivation` (#217)**: `qualityForDegree` está aguas abajo de un mapa que nunca se puebla, así que **arreglarlo no cambia nada observable en la app**. El escenario *"Degree quality derives from the scale"* no puede pasar en la app corriendo diga lo que diga el fix. #217 es correcto y útil a nivel de módulo, pero **no es demostrable en browser** hasta que esto se arregle.
- **Decisión**: planificar. Cumple la regla de entrada del backlog — `features/music-theory.feature:65,72` lo requieren, así que no es YAGNI. Orden: primero el mecanismo (1), que es el barato y el que explica la mitad del fallo; después la causa del offset cero, que es la que hay que **investigar de verdad** porque no está identificada. Los fixtures de `test/music-theory-fixtures` (#226) dejan el caso listo para verificar sin inventar datos.
- **Trampa de verificación**: la cuenta demo del seed trae `transpose_offset = 2, capo = 1` en `user_preferences`, así que cualquiera que entre como `demo@cemurm.app` está siempre en offset no-cero. Eso es lo que ocultó el mecanismo (1) de las primeras lecturas. Cualquiera que mida esto tiene que ponerlo en 0 explícitamente y **restaurarlo después**.

## 8. Numeración de migrations: 0029 está reclamado dos veces

> Añadido 2026-09-28. Encontrado al numerar `0032_overlay_access_token.sql`.

- **Evaluación**: `0029` está tomado por dos cambios **sin relación**: `0029_feedback.sql` en los cuatro branches de `m2-feedback` (`feat/m2-feedback-data{,-v2}`, `feat/m2-feedback-ui{,-v2}`) y `0029_fail_closed_minors.sql` en los branches de guardian (`origin/fix/fail-closed-minors`, `origin/feat/guardian-consent-db`, `origin/feat/guardian-email`). `0030` y `0031` también están ocupados. El AGENTS.md advierte de esta carrera y ya se materializó.
- **Por qué importa**: `supabase db reset` ejecuta los `.sql` **por orden de nombre**, así que dos archivos con el mismo prefijo de versión tienen un **orden relativo arbitrario**, y el ledger de migraciones se keyea por ese número. Si ambos aterrizan, uno puede no aplicarse o aplicarse en el orden que no le toca.
- **Defecto secundario en la misma área**: `0029_feedback.sql` (#190) llega **sin smoke test**, siendo la única migration desde 0022 que no lo trae. La convención se sostiene sin excepción desde ahí.
- **Decisión**: planificar. Renumerar una de las dos antes de que aterrice, y agregar el smoke que falta. No es urgente mientras ninguna de las dos haya aterrizado; es urgente en cuanto la primera lo haga.
- **Relacionado**: `supabase_migrations.schema_migrations` está **vacía** en la base local aunque el schema refleja las 27 migrations de `main` (verificado objeto por objeto, 0019→0028, sin drift). El CLI no puede responder qué está aplicado porque no hay ledger. No bloquea nada del flujo actual (`db reset` + smoke), pero cualquier herramienta que pregunte "qué falta" recibe una respuesta falsa.

## 9. El ruleset bloquea los pushes al upstream — requiere una cuenta con `admin`

> Añadido 2026-09-28. **Bloquea toda la cola de landing.** Los 23 PRs abiertos entran por fork
> mientras esto siga así. No es una molestia: es un commit que no se puede subir.

- **Evaluación**: el ruleset se llama `PR`, id `24085467`, `target: branch`, `conditions.ref_name`
  `include: ["~ALL"]`, `enforcement: active`, `bypass_actors: []`. Exige
  **`GitGuardian Security Checks`** con **`do_not_enforce_on_create: false`**. Un commit recién
  pusheado **no tiene check todavía**, así que no puede satisfacer el requisito y el push se
  rechaza. Medido: un push a `feat/m2-feedback-data-v2` volvió
  `push declined due to repository rule violations`, y el permiso `push` de esa cuenta es `true` —
  sólo `admin` es `false`, así que **no es un problema de permisos**.
- **El escáner sí funciona.** `GitGuardian Security Checks` aparece `completed/success` en los
  commits de los PRs #185, #182 y #181, con el nombre exacto que el ruleset exige. O sea el requisito
  es satisfacible **en un pull request**. Lo que no es satisfacible es en un push.
- **El repositorio NO está congelado, y esto primero se afirmó mal**: se afirmó que
  nadie había pusheado desde que el ruleset existe, **muestreando** seis branches. Falso. Enumerando todos los
  refs hay commits **posteriores** al ruleset: `17:41 docs/minor-compliance-debt-plan`,
  `17:40 feat/guardian-consent-db`, `17:35 feat/jsdoc-libs-v2-base`, `17:27 docs/resend-guardian-consent`,
  `17:26 feat/jsdoc-libs-s11-core-misc`, `17:23 feat/guardian-email`. El mecanismo por el que esos
  pushes pasan y el mío no **no está determinado** y no se especula aquí: `bypass_actors` está
  vacío, lo que significaría que nadie lo saltea, incluidos owner y admins, y sin embargo esos seis
  commits aterrizaron.
- **Corrección a una receta dada antes**: `do_not_enforce_on_create: true` **no** desbloquea esto.
  Sólo deja de exigir el check en la *creación* de branch. Un commit nuevo no tiene check de ninguna
  de las dos formas, así que los pushes a branches existentes siguen rechazados. Para los pushes hay
  dos salidas y **ninguna** es el ajuste de un solo booleano.
- **Decisión — requiere una cuenta con `admin`**, y es la primera recomendación de prioridad de todo
  este backlog:
  1. **Mover el requisito de `target: branch` a `target: pull_request`** (recomendado). Los pushes
     vuelven a funcionar y **cada PR sigue pasando por el escáner**, que es lo que la regla quería
     conseguir. Es la opción que preserva la intención de seguridad.
  2. Quitar `required_status_checks` del ruleset de ramas. Más laxa: deja de exigir escaneo.
  - Antes de cualquiera de las dos, conviene reconciliar por qué los seis pushes de arriba pasaron:
    si la causa es que el owner tiene un bypass efectivo que la API no reporta, el arreglo correcto es
    **declararlo explícitamente** en `bypass_actors`, que es auditable, en vez de dejarlo implícito.
- **Nota de proceso**: la primera vez que se redactó este diagnóstico se generalizó desde una muestra
  de seis branches y se afirmó que el repo estaba congelado. Era falso, y la forma de evitarlo es la
  misma que en el resto del trabajo: **enumerar, no muestrear.**

---

## 10. El `include` de `tsconfig.json` no puede alcanzar ningún `.jsx`

> Añadido 2026-10-01. Encontrado al portar la cadena de moderación (#274/#275). **La línea base de tipos cubre cero UI.**

- **Evaluación**: `"include": ["src/domain", "src/data", "src/integrations", "src/lib", "src/offline"]`. `src/features` **no está**. Los 54 ficheros `.jsx` de `src/` no entran nunca en el programa de TypeScript, así que un `// @ts-check` sobre cualquiera de ellos es **inerte** y `tsc` sale con `0` igualmente.
- **Cómo se probó, no se presupuso**: se añadió `const __probe = notDefinedAnywhere` a un `.jsx` con pragma y se corrió `npx tsc --noEmit` → `exit 0`, `0` errores. El pragma no está activo. Retirada la sonda, `0/0` otra vez. La primera afirmación de esta sesión fue la contraria ("el pragma ESTÁ ACTIVO") y la sonda la refutó; por eso el hallazgo existe.
- **Por qué importa**: `AGENTS.md` afirma que el pragma por fichero "es el mecanismo entero" para ampliar la baseline. Es cierto para `.js` bajo los cinco directorios incluidos y **falso para los 54 JSX**. Un fichero nuevo de UI puede llevar pragma, salir verde, y no estar comprobado nunca.
- **Defecto de verificación en la misma área**: `npx tsc --noEmit --listFiles | grep -c '/src/'` **no** prueba que un fichero concreto se esté comprobando. `--listFiles` lista el *programa*; añadir un pragma a un fichero ya incluido deja el conteo idéntico (siguió en 60). El conteo prueba que el programa está vivo, nada más. La única prueba real es una **sonda**: inyectar un error deliberado, confirmar que `tsc` lo reporta, retirarlo.
- **Decisión — requiere una decisión explícita, ninguna de las dos es automática**: (a) **aceptar y documentar** que la baseline es solo de dominio/datos/infra y que la UI no tiene tipos, corrigiendo el texto de `AGENTS.md` para que deje de prometer lo que no hace; o (b) **cambiar el `include` deliberadamente**, con recuento medido de errores préalable. La opción (b) no es "poner `checkJs: true`": `AGENTS.md` lo prohíbe por razones medidas, y esas razones hay que **re-argumentar con los números actuales**, no anular. Empezar por (a) cuesta una línea y elimina la mentira; (b) es trabajo de verdad.
- **No hacer**: añadir pragmas a `.jsx` creyendo que funcionan. Es el peor de los tres estados: parece cobertura y no la hay.

## 11. El CI de `main` está rojo *y* ciego desde `6ee10f0`

> Añadido 2026-10-01. Encontrado al drenar la cola. **El rojo se ve; la ceguera es lo que no se ve.**

- **Evaluación**: desde el merge de #199 (`6ee10f0`), el workflow aborta en `bash scripts/check-visual-contract.sh`. Al abortar, `pnpm test` y `pnpm build` quedan `skipped` y **no se ejecutan**. Los errores que CI no puede mostrar son exactamente los que el gate aborta antes de descubrir.
- **Defecto independiente y mayor**: **`pnpm typecheck` no está en CI en absoluto**. `ci.yml` corre install → lint → gate visual → test → build. Los errores de tipo viajan detrás de un check verde, y el finding #10 demuestra que además verde de `tsc` local tiene su propia trampilla.
- **Por qué importa**: mientras tanto, los gates locales son **la verificación de registro**, no una comodidad. Eso es legítimo pero hay que decirlo: un PR puede estar verde en local y ciego en CI, y con el gate visual abortando, el ciego es el estado normal, no la excepción.
- **Decisión**: (a) añadir `pnpm typecheck` al workflow — es una línea y cierra el agujero más grave; (b) decidir si el gate visual debe seguir abortando el pipeline antes de test y build, o solo reportar. Que un ratchet de deuda conocida rompa el CI entero oculta todos los demás fallos, que es el efecto observado desde hace varios merges.

## 12. La cláusula 6 de `AGENTS.md` ("pedir revisor siempre") es inalcanzable

> Añadido 2026-10-01. **Estructuralmente imposible, no un descuido de ejecución.**

- **Evaluación**: `gh pr edit <n> --add-reviewer davidjesus516` sobre un PR **autorizado por** davidjesus516 sale `0`, imprime la URL, y **no crea nada**. Medido: #273 (propio) → `reviewRequests: []`; #194 (autor `Antony-F Figueroa`) → `reviewRequests: ["davidjesus516"]`, y ese sí notifica.
- **Por qué importa**: combinado con `require_last_push_approval: true` del ruleset activo, un PR propio **no tiene ninguna vía de aprobación dentro de la plataforma** — solo `--admin`. La cláusula 6 dice "notifica, no esperes en silencio", y su mecanismo **reporta éxito sin accomplishir nada**. Es peor que no tenerla: genera la sensación de que se ha notificado.
- **Decisión — requiere al mantenedor**: (a) **corregir la cláusula** para que describa el mecanismo real (un PR propio no se auto-revisa; hay que pedir revisión fuera de banda o aceptar `--admin` con la aprobación verbal como registro), o (b) **establecer otro canal de notificación** (comment en el PR mencionando a quien debe mirar, que sí es un disparador real). Lo que no es admisible es dejarla como está: es una directiva que no se puede cumplir.

## 13. Deuda del gate visual: tres ratchets fallando en `main`

> Añadido 2026-10-01. Medido en `main` @ `84a48f2`. **No es deuda de un PR: es deuda acumulada.**

- **Evaluación**: `scripts/check-visual-contract.sh` falla en tres reglas sobre `main`: `01b` (utilities de la paleta Tailwind por defecto) 92 ocurrencias contra techo 82, **+10**; `02` (los cuatro acentos muertos: `coral`, `emerald`, `rose`, `sky`) 274 contra 252, **+22**; `06` (`text-cem-secondary` sobre relleno elevado) 1 ocurrencia.
- **Por qué importa**: son **ratchets**, no umbrales. Subir el techo los convertiría en decorativos: la función de un ratchet es la de no dejar crecer la deuda, y mover el techo es exactamente no dejarla crecer. Además, con el CI abortando aquí (finding #11), esta deuda **es** la razón del rojo permanente, así que arreglar esto y el CI son el mismo problema en dos caras.
- **Decisión — plan, no arreglo puntual**: reducir en pasos medidos y bajando los techos **a medida que baje el número**, nunca antes. El orden natural es `02` (los acentos muertos no tienen sustituto — la paleta es monocromo + un ámbar, así que un tono no puede codificar tres estados; el significado lo lleva la etiqueta), luego `01b`, luego `06`. Los tres tienen ya el remedio escrito en los comentarios del propio script.
- **No hacer**: migrar esta deuda dentro de un PR de reparación de merges. Cada PR de código solo debe **no empeorarla**, y la cadena #274/#275 se verificó exactamente con ese criterio: mismas cifras que `main`.

## 14. El `node_modules` del checkout principal está desfasado respecto al lockfile

> Añadido 2026-10-01. No es un defecto de código: es un entorno que miente.

- **Evaluación**: el `node_modules` del checkout principal tiene **vite 5.4.21 / vitest 3.2.7**, mientras el lockfile de `main` después de #236 exige vite `^6.4.3` / vitest `^5.0.2`.
- **Por qué importa**: es exactamente la trampa que `AGENTS.md` documenta tras #236, instalada en el directorio de trabajo. Cualquier gate corrido ahí da verde **probando las versiones viejas** — y un bump de major puede cambiar el bundle sin que ninguna puerta lo note.
- **Decisión**: `pnpm install --frozen-lockfile` en el checkout principal. No se hizo sin el visto bueno del mantenedor porque muta su entorno de trabajo. Mentre tanto, **cualquier verificación de dependencias va contra un worktree con su propio `node_modules`**, nunca con symlink al del repo.

## Estado de entrada

Este backlog se creó a partir de hallazgos de revisión de ingeniería post-Hito 2 (2026-09-15, tras merge de PR #88–#99). Ningún ítem bloquea el desarrollo actual; todos son candidatos a planificarse en su hito correspondiente según `docs/mvp-scope.md`. Prioridad sugerida: #5 (solo si entra CI), #4 (Hito 4), #3 (Hito 4/5), #1 (post-Hito 3), #2 y #6 (no hacer — re-evaluar con datos).

**Los ítems 7 y 8 son de otra clase**: no son decisiones estratégicas sino **defectos medidos** el
2026-09-28, agregados durante la serie de hallazgos de music-theory y la verificación en browser que
los acompaña. Ambos cumplen la regla de entrada igual que los demás (el Gherkin los requiere), y su
prioridad real es más alta que la de los ítems de Hito 4: **#7 hace que un escenario BDD especificado
no pueda pasar en la app, y #8 puede romper un `supabase db reset`.** #7 tiene fixtures listos para
verificar sin inventar datos en `test/music-theory-fixtures` (#226).

**Los ítems 10 a 14 son también defectos medidos**, agregados el 2026-10-01 al drenar la cola de
merges, y se leen como un bloque porque comparten una misma raíz: **una puerta que dice pasar sin
comprobar lo que dice comprobar.** #10 es la más grave de todas — la línea base de tipos cubre
cero UI y el pragma que `AGENTS.md` presenta como el mecanismo no funciona en 54 ficheros, con
`exit 0`. #11 es la segunda: el CI está rojo *y* ciego, `pnpm typecheck` no está en él, y el rojo lo
causa #13. #12 es una directiva de `AGENTS.md` estructuralmente inalcanzable. #14 no es un defecto de
código sino un entorno que miente.

Orden sugerido, por lo que desbloquea y no por severidad: **#11(a)** (una línea, añade
`pnpm typecheck`), **#14** (desbloquea la verificación local honesta), **#10(a)** (corregir el texto de
`AGENTS.md` para que deje de prometer cobertura de UI — una línea, y elimina la mentira), **#13**
(el rojo permanente del CI), y después **#12** y la decisión de fondo de **#10(b)**, que son las dos
que necesitan una decisión de producto y no solo una corrección.

El registro de ejecución completo —incluidos los errores de proceso que costaron tiempo, para que no se repitan— está en `odd/tasks/merge-queue-drain-and-findings.md`.
