#!/usr/bin/env bash
# Spike Consolidated Report Generator (Gate G2)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${1:-${SCRIPT_DIR}/../results}"
OUTPUT_MD="${2:-${RESULTS_DIR}/spike-consolidated-report.md}"

echo "=== Generating consolidated spike report ==="

cat > "${OUTPUT_MD}" << 'EOF'
# Spike Suite Modular — Consolidated Report (Gate G2)

**Fecha**: $(date -Iseconds)  
**Rama**: `spike/suite-modular`  
**Milestone**: #7  
**Duración**: 3 semanas  

---

## Resumen Ejecutivo

| Spike | Módulo | Estado | Criterio PASS | Decisión |
|-------|--------|--------|---------------|----------|
| **S1** | Audio Core (Capa 2A) | {{S1_STATUS}} | Latencia p99 ≤ 5ms en iOS/Android/Win/macOS | {{S1_DECISION}} |
| **S2** | P2P Sync (Capa 3A) | {{S2_STATUS}} | Failover <1s, roaming <2s, 0 underruns | {{S2_DECISION}} |
| **S3** | MusicXML Layout (Capa 1B) | {{S3_STATUS}} | Render 5 partituras, transposición <200ms, mem <150MB | {{S3_DECISION}} |

**Decisión global**: {{GLOBAL_DECISION}}

---

## S1 — Audio Core (Capa 2A)

### Resultados de Latencia (p99)

| Plataforma | p50 (ms) | p95 (ms) | p99 (ms) | Underruns (10min) | PASS (≤5ms) |
|------------|----------|----------|----------|-------------------|-------------|
| iOS (iPad 8th) | {{IOS_P50}} | {{IOS_P95}} | {{IOS_P99}} | {{IOS_UNDERRUNS}} | {{IOS_PASS}} |
| Android (A53/6a) | {{ANDROID_P50}} | {{ANDROID_P95}} | {{ANDROID_P99}} | {{ANDROID_UNDERRUNS}} | {{ANDROID_PASS}} |
| Windows (i5/Ryzen) | {{WINDOWS_P50}} | {{WINDOWS_P95}} | {{WINDOWS_P99}} | {{WINDOWS_UNDERRUNS}} | {{WINDOWS_PASS}} |
| macOS (Apple Silicon) | {{MACOS_P50}} | {{MACOS_P95}} | {{MACOS_P99}} | {{MACOS_UNDERRUNS}} | {{MACOS_PASS}} |

### Interrupciones (Recovery Time p99)

| Tipo | iOS | Android | Windows | PASS (<200ms) |
|------|-----|---------|---------|---------------|
| Background → Foreground | {{IOS_BG_FG}}ms | {{ANDROID_BG_FG}}ms | {{WIN_BG_FG}}ms | {{BG_FG_PASS}} |
| Screen Lock/Unlock | {{IOS_LOCK}}ms | {{ANDROID_LOCK}}ms | {{WIN_LOCK}}ms | {{LOCK_PASS}} |
| Call Interruption | {{IOS_CALL}}ms | {{ANDROID_CALL}}ms | N/A | {{CALL_PASS}} |

### Configuración Óptima por Plataforma

Ver: `audio-platform-config.md`

### Known Issues S1

- {{S1_KNOWN_ISSUES}}

---

## S2 — P2P Sync (Capa 3A)

### Discovery & Leader Election

- Nodos probados: 3
- Descubrimiento mutuo: {{S2_DISCOVERY}}%
- Tiempo elección maestro: {{S2_ELECTION_TIME}}ms
- **PASS**: {{S2_DISCOVERY_PASS}}

### Heartbeat & Clock Sync

- Intervalo heartbeat: 20ms
- Clock drift máx (10min): {{S2_MAX_DRIFT}}ms
- **PASS** (≤0.5ms): {{S2_DRIFT_PASS}}

### Caos (Netem 10% loss, 5ms±2ms)

- Duración test: 5min
- Heartbeats perdidos: {{S2_NETEM_LOST}}%
- **PASS** (0% loss tolerado): {{S2_NETEM_PASS}}

### Roaming Wi-Fi (AP primario → secundario)

| Dispositivo | Reconvergence Time | PASS (<2s) |
|-------------|-------------------|------------|
| iOS | {{S2_ROAM_IOS}}ms | {{S2_ROAM_IOS_PASS}} |
| Android | {{S2_ROAM_ANDROID}}ms | {{S2_ROAM_ANDROID_PASS}} |
| Windows | {{S2_ROAM_WIN}}ms | {{S2_ROAM_WIN_PASS}} |

### Failover Maestro (SIGKILL)

- Detección timeout: 3 heartbeats (60ms)
- Tiempo nuevo heartbeat estable: {{S2_FAILOVER_TIME}}ms
- **PASS** (<1s): {{S2_FAILOVER_PASS}}

### Integración S1+S2 (Audio + Sync bajo caos)

- Cero audio underruns durante perturbaciones: {{S2_INTEGRATION_UNDERRUNS}}
- Latencia audio p99 durante perturbaciones: {{S2_INTEGRATION_LATENCY}}ms
- **PASS**: {{S2_INTEGRATION_PASS}}

### Known Issues S2

- {{S2_KNOWN_ISSUES}}

---

## S3 — MusicXML Layout (Capa 1B)

### Verovio WASM Build

- Módulos: musicxml, layout, transpose, mei
- Tamaño WASM (gzipped): {{S3_WASM_SIZE_MB}} MB
- **PASS** (<3MB): {{S3_WASM_PASS}}

### Corpus Load (5 partituras)

| Partitura | Complejidad | Load OK | Primer Paint (p99) |
|-----------|-------------|---------|-------------------|
| Bach BWV 846 | Simple | {{S3_BACH_LOAD}} | {{S3_BACH_PAINT}}ms |
| Mozart K.545 | 2 voces, Alberti | {{S3_MOZART_LOAD}} | {{S3_MOZART_PAINT}}ms |
| Beethoven Op.27 | 3 pentagramas, pedal | {{S3_BEETHOVEN_LOAD}} | {{S3_BEETHOVEN_PAINT}}ms |
| SATB Coral | 4 voces, lyrics | {{S3_SATB_LOAD}} | {{S3_SATB_PAINT}}ms |
| Big Band | Transposición | {{S3_BIGBAND_LOAD}} | {{S3_BIGBAND_PAINT}}ms |

### Performance Benchmarks

| Métrica | Target | Resultado (p99) | PASS |
|---------|--------|-----------------|------|
| First Paint | <500ms | {{S3_FIRST_PAINT_P99}}ms | {{S3_FIRST_PAINT_PASS}} |
| Reflow (320→1920) | <300ms | {{S3_REFLOW_P99}}ms | {{S3_REFLOW_PASS}} |
| Transposición ±6st | <200ms | {{S3_TRANSPOSE_P99}}ms | {{S3_TRANSPOSE_PASS}} |

### Visual Parity vs PDF (≤2% pixel diff)

| Partitura | Diff % | PASS |
|-----------|--------|------|
| Bach BWV 846 | {{S3_BACH_DIFF}}% | {{S3_BACH_DIFF_PASS}} |
| Mozart K.545 | {{S3_MOZART_DIFF}}% | {{S3_MOZART_DIFF_PASS}} |
| Beethoven Op.27 | {{S3_BEETHOVEN_DIFF}}% | {{S3_BEETHOVEN_DIFF_PASS}} |
| SATB Coral | {{S3_SATB_DIFF}}% | {{S3_SATB_DIFF_PASS}} |
| Big Band | {{S3_BIGBAND_DIFF}}% | {{S3_BIGBAND_DIFF_PASS}} |

### Stress Test (50 páginas)

- Memoria pico: {{S3_STRESS_MEM}} MB
- **PASS** (<150MB): {{S3_STRESS_MEM_PASS}}
- Avg frame time (scroll): {{S3_STRESS_FPS}}ms
- **PASS** (60fps): {{S3_STRESS_FPS_PASS}}

### Known Issues S3

- {{S3_KNOWN_ISSUES}}

---

## Estimación Fase 1 (Post-Spike)

| Módulo | Spike | Esfuerzo Fase 1 (semanas) | Riesgo Residual | Dependencias |
|--------|-------|---------------------------|-----------------|--------------|
| Audio Core (2A) | S1 | {{EST_S1_WEEKS}} | {{EST_S1_RISK}} | S2 (sync) |
| P2P Sync (3A) | S2 | {{EST_S2_WEEKS}} | {{EST_S2_RISK}} | S1 (clock) |
| MusicXML Layout (1B) | S3 | {{EST_S3_WEEKS}} | {{EST_S3_RISK}} | Verovio upstream |
| PDF Engine (1A) | — | {{EST_PDF_WEEKS}} | {{EST_PDF_RISK}} | Pdfium / PDFKit |
| WebSockets/SSE (3B) | — | {{EST_WS_WEEKS}} | {{EST_WS_RISK}} | Go/Node backend |
| DRM (4A/4B) | — | **Fase 2** | — | — |

---

## Próximos Pasos

1. **{{GLOBAL_DECISION}}** — {{GLOBAL_DECISION_REASON}}
2. Si **Go**: Iniciar Fase 1 con scope = módulos PASS
3. Si **Partial Go**: Definir scope Fase 1 = {{PARTIAL_SCOPE}}
4. Si **No-Go**: Documentar blockers y re-plan

---

## Anexos

- `spike/results/` — Todos los CSVs, logs, screenshots raw
- `docs/spike-suite-modular.md` — Documento spike actualizado con datos reales
- `spike-consolidated-report.md` — Este informe

---

*Generado automáticamente por `generate_report.sh`*
EOF

# Rellenar placeholders con datos reales de los CSVs
echo "Rellenando placeholders desde resultados..."

# S1 - Audio
for platform in ios android windows macos; do
  CSV="${RESULTS_DIR}/audio-core-latency-${platform}.csv"
  if [ -f "${CSV}" ]; then
    SUMMARY=$(tail -1 "${CSV}")
    if [[ "${SUMMARY}" == summary* ]]; then
      IFS=',' read -r _ _ p50 p95 p99 <<< "${SUMMARY}"
      PLATFORM_UPPER=$(echo "${platform}" | tr '[:lower:]' '[:upper:]')
      sed -i "s/{{${PLATFORM_UPPER}_P50}}/${p50}/g" "${OUTPUT_MD}"
      sed -i "s/{{${PLATFORM_UPPER}_P95}}/${p95}/g" "${OUTPUT_MD}"
      sed -i "s/{{${PLATFORM_UPPER}_P99}}/${p99}/g" "${OUTPUT_MD}"
      PASS=$(python3 -c "print('✅ PASS' if ${p99} <= 5.0 else '❌ FAIL')")
      sed -i "s/{{${PLATFORM_UPPER}_PASS}}/${PASS}/g" "${OUTPUT_MD}"
    fi
  fi
  
  # Underruns
  INT_CSV="${RESULTS_DIR}/audio-interruptions-${platform}.csv"
  if [ -f "${INT_CSV}" ]; then
    UNDERRUNS=$(python3 -c "
import pandas as pd
df = pd.read_csv('${INT_CSV}')
print(int(df['artifact_detected'].apply(lambda x: str(x).lower() == 'true').sum()))
")
    PLATFORM_UPPER=$(echo "${platform}" | tr '[:lower:]' '[:upper:]')
    sed -i "s/{{${PLATFORM_UPPER}_UNDERRUNS}}/${UNDERRUNS}/g" "${OUTPUT_MD}"
  fi
done

# S1 - Interruption recovery times
for platform in ios android windows; do
  INT_CSV="${RESULTS_DIR}/audio-interruptions-${platform}.csv"
  if [ -f "${INT_CSV}" ]; then
    python3 -c "
import pandas as pd
df = pd.read_csv('${INT_CSV}')
for itype in ['background_foreground', 'screen_lock', 'call_interruption']:
    subset = df[df['interruption_type'] == itype]
    if len(subset) > 0:
        p99 = subset['recovery_ms'].quantile(0.99)
        key = itype.upper().replace('_', '_')
        print(f'{platform.upper()}_{key}={p99:.1f}')
        pass_str = '✅ PASS' if p99 <= 200 else '❌ FAIL'
        print(f'{platform.upper()}_{key}_PASS={pass_str}')
" | while IFS='=' read -r key value; do
      sed -i "s/{{${key}}}/${value}/g" "${OUTPUT_MD}"
    done
  fi
done

# S1 Status
S1_ALL_PASS=true
for platform in IOS ANDROID WINDOWS MACOS; do
  if grep -q "${platform}_PASS.*FAIL" "${OUTPUT_MD}" 2>/dev/null; then
    S1_ALL_PASS=false
  fi
done
S1_STATUS=$(if $S1_ALL_PASS; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
S1_DECISION=$(if $S1_ALL_PASS; then echo "Go Fase 1"; else echo "Revisar / Partial"; fi)
sed -i "s/{{S1_STATUS}}/${S1_STATUS}/g" "${OUTPUT_MD}"
sed -i "s/{{S1_DECISION}}/${S1_DECISION}/g" "${OUTPUT_MD}"

# S2 - Parse results (simplificado - en real parsear CSVs)
# Por ahora marcamos como PENDING
sed -i 's/{{S2_STATUS}}/🟡 PENDING/g' "${OUTPUT_MD}"
sed -i 's/{{S2_DECISION}}/Pendiente resultados/g' "${OUTPUT_MD}"
sed -i 's/{{S3_STATUS}}/🟡 PENDING/g' "${OUTPUT_MD}"
sed -i 's/{{S3_DECISION}}/Pendiente resultados/g' "${OUTPUT_MD}"

# Global decision
sed -i 's/{{GLOBAL_DECISION}}/🟡 PENDING — Requiere resultados S2/S3/g' "${OUTPUT_MD}"
sed -i 's/{{GLOBAL_DECISION_REASON}}/Esperando completación de todos los spikes/g' "${OUTPUT_MD}"
sed -i 's/{{PARTIAL_SCOPE}}/TBD tras G2/g' "${OUTPUT_MD}"

# Known issues placeholders
sed -i 's/{{S1_KNOWN_ISSUES}}/Ver audio-platform-config.md/g' "${OUTPUT_MD}"
sed -i 's/{{S2_KNOWN_ISSUES}}/Ver p2p-*.csv/g' "${OUTPUT_MD}"
sed -i 's/{{S3_KNOWN_ISSUES}}/Ver musicxml-*.csv/g' "${OUTPUT_MD}"

# Estimation placeholders
sed -i 's/{{EST_S1_WEEKS}}/TBD/g' "${OUTPUT_MD}"
sed -i 's/{{EST_S1_RISK}}/TBD/g' "${OUTPUT_MD}"
sed -i 's/{{EST_S2_WEEKS}}/TBD/g' "${OUTPUT_MD}"
sed -i 's/{{EST_S2_RISK}}/TBD/g' "${OUTPUT_MD}"
sed -i 's/{{EST_S3_WEEKS}}/TBD/g' "${OUTPUT_MD}"
sed -i 's/{{EST_S3_RISK}}/TBD/g' "${OUTPUT_MD}"
sed -i 's/{{EST_PDF_WEEKS}}/TBD/g' "${OUTPUT_MD}"
sed -i 's/{{EST_PDF_RISK}}/TBD/g' "${OUTPUT_MD}"
sed -i 's/{{EST_WS_WEEKS}}/TBD/g' "${OUTPUT_MD}"
sed -i 's/{{EST_WS_RISK}}/TBD/g' "${OUTPUT_MD}"

# Limpiar placeholders restantes
sed -i 's/{{[A-Z_]*}}/N\/A/g' "${OUTPUT_MD}"

echo "=== Reporte consolidado generado en ${OUTPUT_MD} ==="