# CEMURM — Live Engine: idea y estructura

**Versión:** 0.1 (borrador de discusión)
**Estado:** idea documentada — sin implementación ni decisión bloqueante tomada
**Propósito:** plasmar la idea y estructura de la capa de presentación en vivo / sesión distribuida (el "Live Engine"), para discutirla con los docs existentes antes de especiar o implementar cualquier cosa.

---

## 1. Idea central

CEMURM no se diseña como "una app que hace streaming", sino como una **plataforma de sincronización de experiencias musicales distribuidas**. El streaming es _una_ de sus capacidades, no su naturaleza.

Una misma sesión (una presentación en vivo, un ensayo, una proyección compartida) es consumida por **vistas distintas** desde el **mismo estado y reloj**:

- Director (controla la sesión)
- Músico (guitarra, piano, bajo — su partitura)
- Cantante (su letra)
- Proyección (pantalla pública)
- Streaming (público remoto)

Todos comparten una **SESIÓN** (estado + reloj) y un **TIMELINE DE EVENTOS**, pero ninguna necesita recibir la misma interfaz ni la misma carga.

---

## 2. La separación fundamental: CONTROL BUS vs MEDIA BUS

No usar un único mecanismo para transportarlo todo. Son tres problemas distintos que deben sincronizarse:

1. **Contenido visual** → músicos, cantante, director, proyector, público, streaming.
2. **Control / sincronización** → canción actual, compás, página, reproducción, cambios, cues.
3. **Audio / video en tiempo real** → solo si CEMURM transporta medios.

```
CEMURM SESSION
        │
┌───────┴────────┐
│                │
CONTROL BUS    MEDIA BUS
│                ├── Audio
│                ├── Video
│                └── Streaming
├── Song changed
├── Page changed
├── Beat
├── Cue
├── Play / Pause / Stop / Next
└── Tempo
```

**Control Bus** transporta comandos/eventos ligeros.
**Media Bus** transporta audio/video/streaming, y tiene requisitos y arquitectura propios.

---

## 3. Mensajería por eventos, no por estado completo

No se reenvía la canción entera cada vez que algo cambia. Se envían **eventos** y cada dispositivo decide qué mostrar:

```json
{
  "type": "song.change",
  "songId": "abc123",
  "version": 4,
  "position": 0,
  "serverTime": 1787160000000
}
```

Cada vista (director, músico, cantante, proyección, streaming) interpreta el mismo evento de forma diferente.

---

## 4. Session Clock (reloj de sesión)

**No confiar en `Date.now()`** y esperar que todos los dispositivos estén sincronizados. Se necesita un reloj de sesión con corrección de offset por dispositivo:

```
Server clock
     │
     ▼
Session clock
     │
     ├── device A offset
     ├── device B offset
     ├── device C offset
     └── projector offset
```

Cada dispositivo calcula:

```
localTime + clockOffset = sessionTime
```

Un comando puede decir `START AT sessionTime = 18:32:15.500`, y cada dispositivo dispara `playback.start(18:32:15.500)` en su propio reloj corregido. Más robusto que "PLAY" (que llega cuando llega).

---

## 5. Timeline de eventos / motor de cues

La canción se modela como un **timeline** con eventos marcados en el tiempo:

```json
{ "time": 0,    "action": "song.start" }
{ "time": 15.2, "action": "lyrics.next" }
{ "time": 32.7, "action": "projection.scene", "scene": "chorus" }
{ "time": 45.0, "action": "lighting.cue", "cue": "blue" }
```

Un mismo evento dispara consumidores distintos en cada vista:

```
chorus.start
   ├── Singer     → muestra letra
   ├── Guitar     → cambia página
   ├── Projector  → cambia visual
   ├── Three.js   → inicia animación
   ├── Audio      → reproduce sección
   └── Director   → actualiza timeline
```

Esto convierte a CEMURM en un **motor de sincronización de una actuación**.

---

## 6. Archivo de audio / video

### Audio

Caso en vivo con sincronización precisa: **no** transmitir el audio continuamente por red (latencia + jitter + buffer + decodificación + latencia de salida por dispositivo = deriva). Mejor:

1. **Distribuir las pistas previamente** (click, backing, piano, bajo, guitarra, voz + metadata) a cada dispositivo que las necesite.
2. Durante la actuación transmitir **solo el reloj y los comandos** (`PLAY at T`).

```
CEMURM ── "PLAY at T=12345" ──▶ Guitar / Singer / Projector
                                   │ local audio / local UI
```

### Video / streaming

No intentar que CEMURM haga todo el encoding desde el navegador (no convertirse en OBS). El streaming de video se delega a un **pipeline externo** (RTMP / SRT / WebRTC / CDN) y CEMURM orquesta o se integra con él.

Para distribución masiva (1 cámara → muchos espectadores) no se usa 1 conexión WebRTC por espectador; se necesita un media server / CDN.

---

## 7. Transporte: WebSocket vs WebRTC DataChannel

Para comandos de sincronización en red **local** (Router/AP sin Internet) bastan latencias bajas:

- **WebSocket** contra un Session Server central — recomendado para empezar: más fácil de controlar el estado (hub central).
- **WebRTC DataChannel** — para comunicación P2P directa entre dispositivos, protegida (DTLS). Interesante, pero no arrancar con arquitectura P2P completa.

```
Session Server
     │
┌────┼────┐
▼    ▼    ▼
Singer Guitar Projector
```

---

## 8. Vistas por rol (ejemplos)

Todas en la misma sesión, ninguna recibe la misma interfaz:

- **Director** → estado de sesión, canción, página, tempo, integrantes, controles (`Anterior`/`SIGUIENTE`, `SYNC ALL`).
- **Guitarrista** → su partitura/acordes (ej. `G D7 G`, "Página 2").
- **Cantante** → su letra (`Amazing grace, how sweet...`).
- **Proyección** → letra/visualización de pantalla pública (cubierta por `congregation-projection.feature` y `live-performance-mode.feature`).
- **Streaming** → cámara + letra sincronizada para público remoto.

---

## 9. Prueba antes de construir (prototipo de latencia)

Antes de construir el sistema completo, un prototipo descartable:

```
Laptop/Tablet (Director) ── Wi-Fi ──▶ Phone (Singer) / Tablet (Guitar) / Laptop (Projector)
```

Tests:
1. Director `NEXT` → todos cambian instantáneamente.
2. Director `PAGE 3` → todos cambian.
3. `PLAY` → todos inician una pista local.
4. `TIMELINE EVENT` → todos ejecutan una acción simultánea.
5. Three.js `CHORUS` → transición visual.

Medir: P50/P95/P99 latency, jitter, clock drift, eventos caídos, CPU, GPU, batería.

Esto valida la viabilidad de la red local antes de especiar o implementar del todo.

---

## 10. Estructura propuesta

```
CEMURM
    │
┌───┴───────────────┐
│                   │
NORMAL APP      LIVE ENGINE
React/JS        Session Clock
                Event Scheduler
                Sync Engine
                    │
           ┌────────┼────────┐
           ▼        ▼        ▼
        Lyrics   Audio   Visuals
           │        │        │
           │        │     Three.js (opcional)
           └────────┴────────┘
                    │
              WebSocket / WebRTC
                    │
      ┌─────────────┼─────────────┐
      ▼             ▼             ▼
   Singer       Guitar       Projector
```

**Normal App** = la app de gestión (repertorio, setlists, offline) — lo que ya cubren los docs y features actuales.

**Live Engine** = la capa de sesión en vivo (reloj, scheduler de eventos, motor de sync) — lo que nace de esta idea.

---

## 11. Relación con los docs existentes

La idea del Live Engine es **complementaria** a lo ya decidido. No contradice ni reemplaza:

| Tema | Ya decidido en repo | Live Engine |
|---|---|---|
| Backend | Supabase (PostgreSQL + RLS + Auth + **Realtime/WebSocket**) | El Control Bus puede vivir sobre Realtime o sobre un Session Server WS propio — decisión abierta |
| Audio en vivo | Tone.js + Web Audio API, WASM en fase 2 (§6.3) | Coincide: el patrón "pistas locales + comandos" asume Web Audio |
| Colaboración realtime | Locking + merge offline para MVP; Yjs diferido (§6.5) | El Control Bus es cosa distinta a los CRDTs de edición de partituras |
| Proyección | `congregation-projection.feature` (sesión operada, slides, multi-display) | Es la mitad "proyector" del Live Engine |
| Modo escenario | `live-performance-mode.feature` (auto-scroll por BPM, pedal, transpose) | Implica un playback clock — pariente del Session Clock |
| Audiencia remota | `audience_views` (QR/embed, vista de letra, push al actualizar el setlist) | Puente público del Live Engine (ver §12, decisión 1) |
| Configuración por dispositivo | `device_configs` (MIDI, pedal, display externo) | Estado por dispositivo que el Control Bus orquesta |
| Sincronización offline | `outbox` (cola de escritura transaccional), `notifications` (feed por usuario) | Base de sync del en vivo desde el esquema v2 |

**Gaps** que el Live Engine añade y **ningún doc cubre hoy**:
- Session Clock con offset por dispositivo.
- Protocolo director→músico (follow / cues).
- Timeline de eventos multi-consumidor.
- Decisión WS vs WebRTC vs Supabase Realtime para el Control Bus.
- Audio pre-distribuido local (descarga previa de pistas).
- Integración de streaming externo (RTMP/SRT/WebRTC/CDN).
- Visuales opcionales (Three.js) — fuera del MVP, sin bloquearlo.

---

## 12. Decisiones abiertas (para discutir)

1. **Transporte del Control Bus:** ¿Supabase Realtime (ya decidido para colaboración) o un Session Server WebSocket propio dedicado al en vivo? La entidad `audience_views` ya asume **Supabase Realtime** para el push al público (vista anónima de setlist, opt-in de notificación al actualizar). (§10 del technical-spec ya advierte que la capa realtime "no se parchea después"; esta decisión debe cerrarse antes de implementar colaboración.)
2. **Alcance del Live Engine en el MVP:** ¿prototipo de latencia primero (sección 9) antes de especificar?
3. **Audio:** ¿CEMURM transporta algo de audio en el MVP, o solo se adhiere al patrón pistas-locales-desde el inicio?
4. **Visuales Three.js:** ¿se declara no-goal del MVP o se deja la puerta abierta desde el diseño del evento?
5. **Idioma de este doc y destino final:** ¿vive en `docs/propuestas/`, o debe fusionarse en `docs/technical-spec.md` como sección formal del Live Engine?

---

*Historial: v0.1 — borrador inicial a partir de una propuesta externa revisada contra los docs y el estado real del repo.*
