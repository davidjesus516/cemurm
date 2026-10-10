#!/usr/bin/env bash
# S1 Audio Core — Generate platform config markdown from results

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${1:-${SCRIPT_DIR}/../results}"
OUTPUT_MD="${2:-${RESULTS_DIR}/audio-platform-config.md}"

echo "=== Generating platform config doc ==="

cat > "${OUTPUT_MD}" << 'EOF'
# Audio Core — Platform Configuration (Spike S1)

*Generado automáticamente desde resultados de spike*

---

## iOS (iPad 8th gen, iOS 17+)

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| AudioSession Category | `playAndRecord` + `mixWithOthers` | Permite mezclarse con otro audio |
| AudioSession Mode | `measurement` | Latencia mínima |
| Buffer Size | 64 frames | Estable en A12 |
| Sample Rate | 48 kHz | Hardware native |
| Thread Priority | `audio` (real-time) | Requiere entitlement |
| Interruption Handling | `beginInterruption`/`endInterruption` | Recovery < 200ms |

**Latencia medida (p99)**: {{IOS_P99}} ms

---

## Android (Samsung A53 / Pixel 6a, Android 12+)

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| OBoE Stream | `AAudio` (preferido) / `OpenSL ES` fallback | `AAudio` = low latency path |
| Performance Mode | `LowLatency` | |
| Sharing Mode | `Exclusive` | Requiere `PRO_AUDIO` feature |
| Buffer Size | 96 frames | Mínimo estable en HAL típico |
| Sample Rate | 48 kHz | |
| Thread Priority | `THREAD_PRIORITY_AUDIO` / `ANDROID_PRIORITY_URGENT_AUDIO` | |
| Audio Focus | `GAIN_TRANSIENT_EXCLUSIVE` | |

**Latencia medida (p99)**: {{ANDROID_P99}} ms

---

## Windows (Laptop i5-8250U, Win10/11)

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| API | `WASAPI Exclusive Mode` | Requiere driver firmado |
| Share Mode | `AUDCLNT_SHAREMODE_EXCLUSIVE` | |
| Buffer Size | 64 frames (1.33ms @ 48kHz) | `AUDCLNT_BUFFERFLAGS_DATA_DISCONTINUITY` handling |
| Sample Rate | 48 kHz | |
| Thread Priority | `AvSetMmThreadPriority` + `AVRT_PRIORITY_CRITICAL` | Requiere `MMCSS` registration |
| Event Driven | `IAudioClient3` + `SetEventHandle` | |

**Latencia medida (p99)**: {{WINDOWS_P99}} ms

---

## macOS (Apple Silicon, macOS 13+)

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| Audio Unit | `kAudioUnitSubType_RemoteIO` | |
| Buffer Size | 64 frames | |
| Sample Rate | 48 kHz | |
| Thread Priority | `thread_policy_set` + `THREAD_TIME_CONSTRAINT_POLICY` | |

**Latencia medida (p99)**: {{MACOS_P99}} ms

---

## Resumen Comparativo

| Plataforma | p50 (ms) | p95 (ms) | p99 (ms) | Underruns (10min) | PASS (≤5ms p99) |
|------------|----------|----------|----------|-------------------|-----------------|
| iOS        | {{IOS_P50}} | {{IOS_P95}} | {{IOS_P99}} | {{IOS_UNDERRUNS}} | {{IOS_PASS}} |
| Android    | {{ANDROID_P50}} | {{ANDROID_P95}} | {{ANDROID_P99}} | {{ANDROID_UNDERRUNS}} | {{ANDROID_PASS}} |
| Windows    | {{WINDOWS_P50}} | {{WINDOWS_P95}} | {{WINDOWS_P99}} | {{WINDOWS_UNDERRUNS}} | {{WINDOWS_PASS}} |
| macOS      | {{MACOS_P50}} | {{MACOS_P95}} | {{MACOS_P99}} | {{MACOS_UNDERRUNS}} | {{MACOS_PASS}} |

---

## Known Issues

- **Windows**: Algunos OEM bloquean WASAPI Exclusive → fallback a Shared Mode (latencia +5-10ms)
- **Android**: Dispositivos con HAL buggy (lista: SM-A536E, Pixel 6a bootloader unlock) → forzar OpenSL ES
- **iOS**: Interruption handling frágil si no se configura `AVAudioSession.setActive(false)` correctamente en background

---

*Última actualización: $(date -Iseconds)*
EOF

# Rellenar placeholders con datos reales si existen los CSVs
for platform in ios android windows macos; do
  CSV="${RESULTS_DIR}/audio-core-latency-${platform}.csv"
  if [ -f "${CSV}" ]; then
    # Extraer percentiles de la fila summary
    SUMMARY=$(tail -1 "${CSV}")
    if [[ "${SUMMARY}" == summary* ]]; then
      IFS=',' read -r _ _ p50 p95 p99 <<< "${SUMMARY}"
      sed -i "s/{{${platform^^}_P50}}/${p50}/g" "${OUTPUT_MD}"
      sed -i "s/{{${platform^^}_P95}}/${p95}/g" "${OUTPUT_MD}"
      sed -i "s/{{${platform^^}_P99}}/${p99}/g" "${OUTPUT_MD}"
      # PASS/FAIL
      PASS=$(python3 -c "print('✅ PASS' if ${p99} <= 5.0 else '❌ FAIL')")
      sed -i "s/{{${platform^^}_PASS}}/${PASS}/g" "${OUTPUT_MD}"
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
    sed -i "s/{{${platform^^}_UNDERRUNS}}/${UNDERRUNS}/g" "${OUTPUT_MD}"
  fi
done

# Rellenar placeholders vacíos con N/A
sed -i 's/{{[A-Z_]*}}/N\/A/g' "${OUTPUT_MD}"

echo "=== Config doc generado en ${OUTPUT_MD} ==="