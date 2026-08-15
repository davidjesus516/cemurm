# CEMURM — Presentación técnica para revisión externa

**Versión:** 1.1 (primer contacto)
**Fecha:** 14 de agosto de 2026
**Audiencia:** Ingenieros senior, ajenos al proyecto (primer contacto)
**Propósito:** Presentar CEMURM desde cero y pedir una mirada técnica externa y honesta sobre la arquitectura propuesta, antes de comenzar la implementación.

---

## 1. Qué es CEMURM

CEMURM (Community-Centered Musical Repertories Manager) es una Progressive Web App para que músicos individuales, bandas y organizaciones musicales gestionen su repertorio, construyan setlists y colaboren con su comunidad. Es un "cuaderno de partituras digital" que vive en el teléfono, la tablet o la laptop y opera sin conexión.

**El problema que resuelve:** los músicos lidian con cuadernos de papel en la oscuridad, arreglos perdidos en hilos de email y aplicaciones que no entienden su flujo de trabajo real. CEMURM centraliza el repertorio y lo hace accesible en cualquier dispositivo, con o sin red — porque las salas de ensayo y los escenarios no siempre tienen Wi-Fi.

**La promesa:** funciones básicas gratuitas, offline-first y respeto a la propiedad del contenido del usuario.

---

## 2. Por qué les escribimos a ustedes

El proyecto está en un punto de decisión y queremos una **mirada fresca**: la nuestra está demasiado cerca del problema.

Les pedimos, con total honestidad y sin compromiso: **¿qué ven mal? ¿qué harían distinto? ¿qué se nos está escapando?**

Su valor para nosotros es doble:

1. **Experiencia**: han construido y operado sistemas reales; conocen los errores que solo se aprenden en producción.
2. **Distancia**: al ser ajenos al proyecto, pueden cuestionar supuestos que nosotros ya dimos por sentados.

No necesitan leer el código (no hay casi) ni conocer el dominio musical. La arquitectura propuesta está resumida aquí.

---

## 3. Dónde está el proyecto hoy

| Elemento | Estado |
|---|---|
| Documentación | `README.md`, `docs/technical-spec.md`, `docs/mvp-scope.md`, `docs/product-brief.md`, `docs/features-overview.md`, `docs/music-theory-model.md`, `docs/copyright-policy.md` |
| Especificación BDD | 23 archivos `.feature`, **420 escenarios** (Gherkin) |
| Código | Solo scaffold Vite mínimo (`src/` con App.jsx, main.jsx, index.css) |
| Dependencias | React 18.3, Vite 5.3, Tailwind 3.4 — sin dependencias de negocio instaladas |
| Git | 8 commits en `main` |

**Punto clave:** estamos en **fase de especificación, sin implementación real**. Todo el valor actual vive en los 420 escenarios BDD (el contrato de aceptación) y los documentos de diseño. Es el momento ideal para cuestionar decisiones de arquitectura: **nada de lo que se decida hoy está escrito en código todavía.**

---

## 4. Stack propuesto

| Capa | Tecnología |
|---|---|
| Frontend | React 18+ / Vite 5 / Tailwind 3 / React Router 6 / Zustand 4 — **TypeScript 5 strict mode obligatorio desde el día 1** |
| Notación | ChordPro (parser propio en JS ahora, Rust→WASM en fase 2), MusicXML (OpenSheetMusicDisplay), ABC (abcjs), PDF (PDF.js como fallback) |
| Backend | Supabase: PostgreSQL + Auth (JWT) + Storage + Realtime (WebSocket) |
| Archivos | Cloudflare R2 (S3-compatible, sin egress fees, solo URLs firmadas) |
| Offline | Workbox (precache + cache-first estáticos, network-first API, stale-while-revalidate imágenes), IndexedDB vía Dexie, Background Sync |
| APIs externas | LRCLIB (letras), MusicBrainz (metadatos), Spotify (arte/BPM/tonalidad) |
| Deployment | Vercel (frontend) + Supabase (backend) + Cloudflare R2 (storage) |

**Presupuesto free tier para la beta:** ~$0/mes estimado (Supabase 500 MB DB / 50k MAU / 1 GB storage; R2 10 GB / 10M ops; Vercel 100 GB / 100k invocations). Uso estimado < 20% de cada cuota.

**Roadmap:** 6 hitos de 2 meses (12 meses hasta beta pública): Core Viewer + Auth → Stage Mode → Colaboración → Biblioteca pública → Integraciones (MIDI, display externo, OBS) → Beta polish (WCAG 2.1 AA, Lighthouse > 90).

---

## 5. Decisiones ya tomadas

| # | Decisión | Justificación |
|---|---|---|
| D1 | TypeScript strict mode desde el día 1 | Contratos tipados para el dominio de teoría musical y transposición |
| D2 | PostgreSQL/Supabase sobre CockroachDB, Turso/SQLite (diferidos), MySQL/MongoDB/DynamoDB/Firestore (rechazados) | RLS nativo y modelo relacional esencial; análisis completo en §10 de technical-spec |
| D3 | Backend MVP: TypeScript en Supabase Edge Functions (Deno), tipo a tipo con el frontend | $0, sin cambio de lenguaje en el MVP; Rust/Axum diferido a fase 2 |
| D4 | R2 para archivos, solo URLs firmadas | Sin egress fees; seguridad por expiración |
| D5 | Modelo de teoría musical: **concreto-canónico** | La partitura concreta ("G — C — D") es la fuente de verdad; los grados (I—IV—V) son vista derivada. Evita derivar calidad de acorde desde el grado (la armonía modal no sigue reglas diatónicas) |
| D6 | Escalas y modos como **datos, no lógica** | Catálogo semitonado; agregar una escala no toca el motor |
| D7 | RLS en todas las tablas; JWT short-lived + refresh; CSP | Seguridad desde el MVP |
| D8 | Fases de escala definidas (Fase 0 MVP → Fase 4 >1M MAU) | Decisiones habilitadoras HOY: `tenant_id` en tablas core, módulos con fronteras limpias, API versionada, WASM en cliente |

---

## 6. Temas en debate — donde queremos su criterio

Estos son los puntos donde todavía no estamos seguros. Para cada uno incluimos **nuestra posición actual** y lo que nos gustaría validar.

### 6.1 Licencia: código abierto o propietario
**Posición:** README declara **Proprietary**; la política de copyright recomienda un modelo híbrido (contenido de usuario bajo ToS, contribuciones públicas bajo Creative Commons).
**En debate:** si el **código** debería abrirse con **AGPLv3** (network copyleft, cubre SaaS — a diferencia de GPL puro). El contenido comunitario (biblioteca pública) necesita contribuciones CC sí o sí, independientemente de la licencia del código.
**Qué queremos:** una recomendación explícita. ¿AGPLv3 para el código? ¿Cuándo es el momento correcto para abrir, si es que lo es?

### 6.2 Parser de ChordPro y temporización de la capa WASM
**Posición:** reemplazar nuestro parser propio por **ChordSheetJS** (librería madura: parsing, transposición, serialización) y reservar el parser propio solo si la capa **WASM (Rust → wasm-pack)** se activa en fase 2 para trabajo CPU-bound (transposición, parsing ligero de MusicXML), cargado dinámicamente con fallback JS.
**En debate:** ¿fase 2 es el momento correcto para WASM, o hay argumentos para moverlo al MVP? El MVP en JS puro es más simple pero el dominio musical es intensivo en cómputo.

### 6.3 Audio en vivo
**Posición:** **Tone.js + Web Audio API** con procesamiento WASM (aubio para detección de tempo, SoundTouch para pitch/tempo) para metrónomo, tempo y auto-scroll del modo escenario. **Fuera del MVP**, pero la capa de audio debe diseñarse hoy para no bloquearlo después.
**En debate:** ¿vale la pena el costo de diseño anticipado, o es YAGNI hasta que llegue?

### 6.4 Backend: Supabase como núcleo
**Posición:** Supabase (PostgreSQL + RLS + Auth + Realtime) como backend único del MVP, con Edge Functions en TypeScript (Deno). Un **worker Python dedicado solo para OMR/IA** (Audiveris/PyTorch) se mantiene como scope de fase 2 — con fronteras de módulo y API versionada que permitan agregarlo sin rediseñar.
**En debate:** ¿es razonable esta apuesta por un BaaS en fase 0? ¿Qué riesgos de lock-in ven y cómo los mitigarían?

### 6.5 Colaboración en tiempo real y CRDTs
**Posición:** para el MVP, **locking por canción + merge offline** (los escenarios BDD de colaboración lo permiten). Reconocemos que los **CRDTs (Yjs)** son "ignorables para el MVP pero NO parcheables después" — una decisión de arquitectura que se toma antes o se paga caro.
**En debate:** ¿cuándo iniciar Yjs? ¿Hay un punto medio (OT, sync simple) que recomienden?

### 6.6 Escala e infraestructura
**Posición:** fases de escala definidas (Fase 0 MVP → Fase 1 >5k MAU → Fase 2 >10k → Fase 3 >50k → Fase 4 >1M). **Redis diferido a >10k MAU** (rate-limiting con Upstash). **Plausible** para analítica respetuosa.
**En debate:** ¿los umbrales son razonables? ¿Qué recomiendan para **errores de cliente** (¿Sentry o alternativa?) y para monitoreo de Supabase/Edge Functions?

### 6.7 Derechos de autor y dominio público
**Posición:** prohibición de **scraping** de sitios de terceros (riesgo legal CFAA/TOS); biblioteca pública solo con dominio público verificado (IMSLP, Mutopia); proceso DMCA 512 con agente registrado.
**En debate:** detectamos una inconsistencia entre docs — technical-spec dice "pre-1927" para dominio público US y copyright-policy dice "life+70 US post-2022". ¿Qué riesgos legales/operativos ven en la estrategia general?

### 6.8 No-goals a validar
**Posición:** fuera de alcance hoy: **microtonalidad**, **análisis armónico automático** (la IA solo como sugerencia, nunca autoritativa), **OMR/escaneo con IA** (fase 2), **sistema numérico Nashville** como formato fuente (puerta abierta, solo con demanda real).
**En debate:** ¿qué más deberíamos declarar como no-goal ahora para no arrastrarlo después?

---

## 7. Cómo darnos su feedback

Lo más valioso para nosotros es su lectura global, aunque no respondan punto por punto. Idealmente:

- **Impresión general:** ¿qué les parece el alcance y el stack? ¿Qué es lo primero que cambiarían?
- **Por tema (6.1–6.8):** recomendación + riesgo que ven + costo/beneficio de la alternativa, o marcar con **OK** / **⚠️** (preocupación) / **❌** (en desacuerdo).
- **Lo que no está:** ¿qué pregunta importante no estamos haciendo?

Respondan como les sea más cómodo: comentarios inline sobre este documento, un doc aparte, o una videollamada para discutirlo.

**Plazo:** si el tiempo se los permite, idealmente dentro de las próximas 2–3 semanas. Con sus respuestas cerramos los temas en debate y actualizamos la especificación técnica antes de implementar el hito 1 (Core Viewer + Auth).

---

## 8. Referencias (opcional)

Si quieren profundizar, todo está en el repositorio:

- `docs/technical-spec.md` — especificación técnica completa (incluye análisis de alternativas de stack en §10 y fases de escala)
- `docs/mvp-scope.md` — alcance del MVP y hitos
- `docs/music-theory-model.md` — modelo de teoría musical (el dominio más complejo)
- `docs/copyright-policy.md` — política de copyright
- `features/` — 23 features BDD, 420 escenarios de comportamiento

---

*Historial: v1.0 (segunda ronda de revisión con el grupo técnico interno) → v1.1 (reescrito como presentación de primer contacto para revisión externa).*
