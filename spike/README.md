# Spike Suite Modular — Quickstart

**Rama**: `spike/suite-modular` | **Milestone**: #7 | **Duración**: 3 semanas (hasta 2026-10-30)

---

## 🎯 Objetivo

Validar 3 núcleos críticos antes de comprometer Fase 1:

| Spike | Capa | Pregunta clave | Criterio PASS |
|-------|------|----------------|---------------|
| **S1** | 2A | Audio Core | Latencia round-trip p99 ≤ 5 ms en iPad 8th / Android mid / Win laptop |
| **S2** | 3A | P2P Sync | Failover < 1s, roaming < 2s, cero audio underruns bajo 10% packet loss |
| **S3** | 1B | MusicXML Layout | Verovio WASM renderiza 5 partituras reales, transposición < 200 ms, mem < 150 MB |

---

## 📁 Estructura

```
spike/
├── audio-core/          # S1: CMake + oboe + cpal + bench Node
├── p2p-sync/            # S2: CMake + flatbuffers + chaos scripts
├── musicxml-layout/     # S3: Verovio WASM + Vitest visual regression
├── hardware/            # Scripts aprovisionamiento runners (Ansible/SSH)
├── results/             # CSV, gráficos, informes (git-lfs + GH Actions artifacts)
└── README.md            # Este archivo
```

---

## 🖥️ Hardware Requerido (4 perfiles)

| Perfil | Dispositivo | OS | Uso |
|--------|-------------|-----|-----|
| **Orquesta (baseline)** | iPad 8th gen (A12) | iOS 17+ | S1, S2, S3 |
| **Rock/BYOD Android** | Samsung Galaxy A53 / Pixel 6a | Android 12+ | S1, S2, S3 |
| **Rock/BYOD Windows** | Laptop i5-8250U / Ryzen 5 3500U | Win10 21H2 / Win11 | S1, S2, S3 |
| **Red / Caos** | 2× Ubiquiti U6-Lite (AP primario + secundario) | — | S2.3, S2.4 |
| **Instrumentación** | Focusrite 2i2 + cable TRS-TRS (loopback) | — | S1.2 |

> **Todos los tests corren en hardware físico. No emuladores.**

---

## 🚀 Quickstart por Spike

### S1 — Audio Core (`spike/audio-core/`)
```bash
cd spike/audio-core
# 1. Compilar oboe RhythmGame example en 4 plataformas
# 2. Implementar loopback test (ver issue #320)
# 3. Correr 1000 iteraciones por dispositivo (issue #321)
# 4. Probar interrupciones (issue #322)
# 5. Documentar config óptima (issue #323)
```
**Entregable**: `spike/results/audio-core-latency.csv`, `audio-interruptions.csv`, `audio-platform-config.md`

### S2 — P2P Sync (`spike/p2p-sync/`)
```bash
cd spike/p2p-sync
# 1. mDNS discovery + leader election (issue #324)
# 2. Heartbeat UDP 20ms + flatbuffers (issue #325)
# 3. Inyectar netem 10% loss (issue #326)
# 4. Roaming AP primario → secundario (issue #327)
# 5. Failover maestro (issue #328)
# 6. Integración S1+S2 (issue #329)
```
**Entregable**: `spike/results/p2p-*.csv`, `integration-s1-s2.csv`

### S3 — MusicXML Layout (`spike/musicxml-layout/`)
```bash
cd spike/musicxml-layout
# 1. Compilar Verovio WASM custom (issue #330)
# 2. Integrar en PWA + cargar corpus 5 partituras (issue #331)
# 3. Benchmarks: first paint, reflow, transposición (issue #332)
# 4. Visual parity vs PDF (issue #333)
# 5. Stress 50 páginas (issue #334)
```
**Entregable**: `spike/results/musicxml-*.csv`, screenshots diff

---

## 📅 Cronograma & Gates

| Semana | Lunes–Miércoles | Jueves | Viernes |
|--------|-----------------|--------|---------|
| **1** | Ejecución S1.1–S1.3, S2.1–S2.2, S3.1–S3.2 | S1.4, S2.3, S3.3 | S1.5, S2.4, S3.4 |
| **2** | **G1 Revisión** (día 5) → ¿algún spike bloqueado? | S2.5, S3.5 | **Integración S1+S2** (S2.6) |
| **3** | Ejecución final completa | **G2 Decisión** (día 10) → Go/Partial/No-Go | Informe consolidado + presentación |

**Gates**:
- **G1 (día 5)**: ¿Algun spike FAIL duro? → Re-plan o kill ese spike
- **G2 (día 10)**: ¿Todos PASS? → Go Fase 1. ¿Parciales? → Scope Fase 1 = solo módulos PASS
- **G3 (día 15)**: Comité aprueba presupuesto Fase 1 con estimaciones validadas

---

## 🏃 Daily Standup

- **Cuándo**: Lunes–Viernes 09:00 (15 min max)
- **Dónde**: [Enlace Meet/Slack huddle]
- **Formato**: Solo bloqueos + métricas clave (latencia actual, failover time, memory)
- **Dashboard compartido**: [Grafana/Notion/Google Sheet link]

---

## 📦 CI / Artifacts

Workflow: `.github/workflows/spike.yml`

- Matrix por label (`S1`, `S2`, `S3`) + dispositivo (`ios`, `android`, `windows`)
- Self-hosted runners etiquetados: `spike-ios`, `spike-android`, `spike-windows`
- Artifacts subidos a `spike/results/` (retención 90 días)
- `git-lfs` para CSV grandes (>10 MB)

---

## 📋 Definition of Done Global (Cierre Spike)

- [ ] 3 informes S1/S2/S3 en `spike/results/` con raw data adjunto
- [ ] G2 resuelto (Go / Partial Go / No-Go) con acta firmada
- [ ] Estimación Fase 1 rellena en `docs/spike-suite-modular.md` §7
- [ ] Known issues triados: `blocker` / `workaround` / `deferred`
- [ ] Hardware devuelto / inventariado
- [ ] PR `spike/suite-modular` → `main` con *squash* solo de resultados + doc actualizado

---

## 🔗 Enlaces Útiles

- **Doc spike completo**: `docs/spike-suite-modular.md`
- **Milestone**: https://github.com/davidjesus516/cemurm/milestone/7
- **Issues S1**: `label:S1` | **S2**: `label:S2` | **S3**: `label:S3`
- **Project Board**: [crear con `gh project create`]

---

## ⚠️ Riesgos Conocidos (del doc spike)

| Spike | Riesgo | Mitigación |
|-------|--------|------------|
| S1 | WASAPI Exclusive bloqueado en algunos OEM Windows | Probar modo shared como fallback; documentar |
| S1 | Android OBoE HAL buggy en dispositivos específicos | Lista negra conocida; probar 2+ dispositivos Android |
| S2 | mDNS no cruza VLANs | Requerir mDNS reflector en red gestionada |
| S2 | Leader election split-brain con 20+ nodos | Validar quorum simple; fuera de scope spike (solo 3 nodos) |
| S3 | Verovio lyrics alignment en melismas (bug #1247) | Spot-check manual; documentar como known issue |
| S3 | Font embedding Bravura/Gonville +1.2 MB | Subsetting dinámico en Fase 1 |

---

*Última actualización: 2026-10-10 — v1.0*