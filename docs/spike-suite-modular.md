# Spike Suite Modular — Documento completo

**Rama**: `spike/suite-modular` | **Milestone**: #7 | **Duración**: 3 semanas (hasta 2026-10-30) | **Base**: `main`

---

## §1 Objetivo

Validar 3 núcleos críticos antes de comprometer Fase 1, cada uno respondiendo una pregunta clave con un criterio PASS medible en hardware real.

| Spike | Capa | Pregunta clave | Criterio PASS |
|-------|------|----------------|---------------|
| **S1** | 2A | ¿Es viable la latencia de audio round-trip para interpretación en vivo? | Latencia round-trip p99 ≤ 5 ms en iPad 8th / Android mid / Win laptop |
| **S2** | 3A | ¿Soporta el sync P2P failover y roaming sin interrupción de audio? | Failover < 1s, roaming < 2s, cero audio underruns bajo 10% packet loss |
| **S3** | 1B | ¿Renderiza Verovio WASM partituras reales con paridad visual y rendimiento? | Verovio WASM renderiza 5 partituras reales, transposición < 200 ms, mem < 150 MB |

> **Todos los tests corren en hardware físico. No emuladores.**

---

## §2 Estructura de directorios

```
spike/
├── audio-core/          # S1: CMake + oboe + cpal + bench Node
├── p2p-sync/            # S2: CMake + flatbuffers + chaos scripts
├── musicxml-layout/     # S3: Verovio WASM + Vitest visual regression
├── hardware/            # Scripts aprovisionamiento runners (Ansible/SSH)
├── results/             # CSV, gráficos, informes (git-lfs + GH Actions artifacts)
├── docs/
│   └── spike-suite-modular.md  # Este documento
├── README.md            # Quickstart
└── generate_report.sh   # Informe consolidado Gate G2
```

---

## §3 Los tres spikes

### S1 — Audio Core (capa 2A)

Build del ejemplo RhythmGame de oboe (Google) en 4 plataformas con CMake: Android (NDK), iOS (Xcode), macOS (Xcode), Windows (MSVC 2022).

Scripts:
- `build_android.sh`, `build_ios.sh`, `build_macos.sh`, `build_windows.sh` — clonan oboe v1.8.0 y compilan el target `RhythmGame`.
- `run_loopback_test.sh` — click 44.1 kHz → salida analógica → entrada → mide delta con `jack_iodelay`/`audiolatency`; 1000 iteraciones por dispositivo; CSV con p50/p95/p99.
- `run_interruption_tests.sh` — background→foreground, screen lock, call interruption; mide recovery time y artefactos.
- `generate_config_doc.sh` — rellena `audio-platform-config.md` con parámetros por plataforma y placeholders desde los CSVs.

Condicionante: requiere Focusrite 2i2 + cable TRS-TRS loopback y los 4 dispositivos físicos. Sin hardware no se mide latencia real.

### S2 — P2P Sync (capa 3A)

mDNS discovery + elección de líder, heartbeat UDP 20 ms con flatbuffers, inyección de caos con netem (10% loss), roaming AP primario → secundario, failover de maestro.

Scripts:
- `test_discovery.sh` — 3 nodos, verifica que todos se detecten mutuamente (N×(N−1) descubrimientos esperados).
- `test_heartbeat.sh` — maestro + 2 esclavos, calcula clock drift entre maestro y esclavos (target ≤ 0,5 ms).
- `test_failover.sh` — mata maestro con SIGKILL, mide tiempo hasta nuevo heartbeat estable (target < 1 s).

Falta: `CMakeLists.txt` en `spike/p2p-sync/` para que los targets `discovery_test`, `heartbeat_test`, `failover_test` compilen. Corrible en localhost sin hardware extra.

### S3 — MusicXML Layout (capa 1B)

Verovio WASM custom build (módulos musicxml, layout, transpose, mei), integración en PWA, corpus de 5 partituras, benchmarks, paridad visual vs PDF, stress 50 páginas.

Scripts y tests:
- `build_verovio_wasm.sh` — clona Verovio v4.4.0, compila con Emscripten 3.1.50, verifica < 3 MB gzipped.
- `package.json` — vitest scripts: `test:corpus-load`, `test:perf`, `test:visual-parity`, `test:stress`.
- `vite.config.ts` — Vite con COOP/COEP headers (requerido por WASM multihilo/shared array buffer).
- `tests/corpus-load.test.ts` — carga 5 partituras sin crashes.
- `tests/perf.test.ts` — first paint < 500 ms p99, reflow < 300 ms p99, transposición ±6 st < 200 ms p99.
- `tests/visual-parity.test.ts` — pixel-diff ≤ 2% vs PDFs de referencia (MuseScore headless).
- `tests/stress.test.ts` — 50 páginas, memoria < 150 MB, 60 fps.

Faltas: carpeta `spike/musicxml-layout/corpus/` con las 5 partituras; `visual-parity.test.ts` usa APIs de navegador no disponibles en Vitest node environment y el `diffPercent` está hardcodeado.

---

## §4 Hardware requerido (4 perfiles)

| Perfil | Dispositivo | OS | Uso |
|--------|-------------|-----|-----|
| Orquesta (baseline) | iPad 8th gen (A12) | iOS 17+ | S1, S2, S3 |
| Rock/BYOD Android | Samsung Galaxy A53 / Pixel 6a | Android 12+ | S1, S2, S3 |
| Rock/BYOD Windows | Laptop i5-8250U / Ryzen 5 3500U | Win10 21H2 / Win11 | S1, S2, S3 |
| Red / Caos | 2× Ubiquiti U6-Lite (AP primario + secundario) | — | S2.3, S2.4 |
| Instrumentación | Focusrite 2i2 + cable TRS-TRS (loopback) | — | S1.2 |

Los runners self-hosted para CI deben etiquetarse: `spike-ios`, `spike-android`, `spike-windows`, `spike-macos`, `spike-linux-router`.

---

## §5 Quickstart por spike

### S1 — Audio Core

```bash
cd spike/audio-core
# 1. Compilar oboe RhythmGame example en 4 plataformas
# 2. Implementar loopback test (issue #320)
# 3. Correr 1000 iteraciones por dispositivo (issue #321)
# 4. Probar interrupciones (issue #322)
# 5. Documentar config óptima (issue #323)
```
Entregable: `spike/results/audio-core-latency.csv`, `audio-interruptions.csv`, `audio-platform-config.md`

### S2 — P2P Sync

```bash
cd spike/p2p-sync
# 1. mDNS discovery + leader election (issue #324)
# 2. Heartbeat UDP 20ms + flatbuffers (issue #325)
# 3. Inyectar netem 10% loss (issue #326)
# 4. Roaming AP primario → secundario (issue #327)
# 5. Failover maestro (issue #328)
# 6. Integración S1+S2 (issue #329)
```
Entregable: `spike/results/p2p-*.csv`, `integration-s1-s2.csv`

### S3 — MusicXML Layout

```bash
cd spike/musicxml-layout
# 1. Compilar Verovio WASM custom (issue #330)
# 2. Integrar en PWA + cargar corpus 5 partituras (issue #331)
# 3. Benchmarks: first paint, reflow, transposición (issue #332)
# 4. Visual parity vs PDF (issue #333)
# 5. Stress 50 páginas (issue #334)
```
Entregable: `spike/results/musicxml-*.csv`, screenshots diff

---

## §6 Cronograma y gates

| Semana | Lunes–Miércoles | Jueves | Viernes |
|--------|-----------------|--------|---------|
| **1** | Ejecución S1.1–S1.3, S2.1–S2.2, S3.1–S3.2 | S1.4, S2.3, S3.3 | S1.5, S2.4, S3.4 |
| **2** | **G1 Revisión** (día 5) → ¿algún spike bloqueado? | S2.5, S3.5 | **Integración S1+S2** (S2.6) |
| **3** | Ejecución final completa | **G2 Decisión** (día 10) → Go/Partial/No-Go | Informe consolidado + presentación |

### Gate G1 (día 5)

¿Algún spike FAIL duro? → Re-plan o kill ese spike.

### Gate G2 (día 10)

¿Todos PASS? → Go Fase 1. ¿Parciales? → Scope Fase 1 = solo módulos PASS.

### Gate G3 (día 15)

Comité aprueba presupuesto Fase 1 con estimaciones validadas.

---

## §7 Estimación Fase 1 (post-spike)

| Módulo | Spike | Esfuerzo Fase 1 (semanas) | Riesgo residual | Dependencias |
|--------|-------|---------------------------|-----------------|--------------|
| Audio Core (2A) | S1 | TBD | TBD | S2 (sync) |
| P2P Sync (3A) | S2 | TBD | TBD | S1 (clock) |
| MusicXML Layout (1B) | S3 | TBD | TBD | Verovio upstream |
| PDF Engine (1A) | — | TBD | TBD | Pdfium / PDFKit |
| WebSockets/SSE (3B) | — | TBD | TBD | Go/Node backend |
| DRM (4A/4B) | — | **Fase 2** | — | — |

Rellenar tras G2 con datos reales de `spike/results/`.

---

## §8 Definition of Done global (Cierre Spike)

- [ ] 3 informes S1/S2/S3 en `spike/results/` con raw data adjunto
- [ ] G2 resuelto (Go / Partial Go / No-Go) con acta firmada
- [ ] Estimación Fase 1 rellena en este documento §7
- [ ] Known issues triados: `blocker` / `workaround` / `deferred`
- [ ] Hardware devuelto / inventariado
- [ ] PR `spike/suite-modular` → `main` con *squash* solo de resultados + doc actualizado

---

## §9 Riesgos conocidos (del doc spike)

| Spike | Riesgo | Mitigación |
|-------|--------|------------|
| S1 | WASAPI Exclusive bloqueado en algunos OEM Windows | Probar modo shared como fallback; documentar |
| S1 | Android OBoE HAL buggy en dispositivos específicos | Lista negra conocida; probar 2+ dispositivos Android |
| S2 | mDNS no cruza VLANs | Requerir mDNS reflector en red gestionada |
| S2 | Leader election split-brain con 20+ nodos | Validar quorum simple; fuera de scope spike (solo 3 nodos) |
| S3 | Verovio lyrics alignment en melismas (bug #1247) | Spot-check manual; documentar como known issue |
| S3 | Font embedding Bravura/Gonville +1.2 MB | Subsetting dinámico en Fase 1 |

---

## §10 Enlaces útiles

- **Quickstart**: `spike/README.md`
- **CI Workflow**: `.github/workflows/spike.yml`
- **Informe consolidado**: `spike/generate_report.sh` (Gate G2)
- **Milestone**: https://github.com/davidjesus516/cemurm/milestone/7
- **Issues S1**: `label:S1` | **S2**: `label:S2` | **S3**: `label:S3`
- **Provisioning hardware**: `spike/hardware/inventory.yml`, `spike/hardware/provision.yml`

---

*Última actualización: 2026-10-10 — v1.0 (basado en spike/README.md)*
