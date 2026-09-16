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

---

## Estado de entrada

Este backlog se creó a partir de hallazgos de revisión de ingeniería post-Hito 2 (2026-09-15, tras merge de PR #88–#99). Ningún ítem bloquea el desarrollo actual; todos son candidatos a planificarse en su hito correspondiente según `docs/mvp-scope.md`. Prioridad sugerida: #5 (solo si entra CI), #4 (Hito 4), #3 (Hito 4/5), #1 (post-Hito 3), #2 y #6 (no hacer — re-evaluar con datos).