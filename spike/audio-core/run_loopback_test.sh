#!/usr/bin/env bash
# S1 Audio Core — Loopback test: genera click 44.1kHz → salida analógica → entrada → mide delta
# Requiere: interfaz USB (Focusrite 2i2), cable TRS-TRS loopback, jack_iodelay / audiolatency

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/../results"
mkdir -p "${RESULTS_DIR}"

DEVICE="${1:-android}"
ITERATIONS="${2:-1000}"
OUTPUT_CSV="${3:-${RESULTS_DIR}/audio-core-latency-${DEVICE}.csv}"

echo "=== Loopback test: device=${DEVICE}, iterations=${ITERATIONS} ==="

# Verificar herramienta de medición
if command -v jack_iodelay &> /dev/null; then
  LATENCY_TOOL="jack_iodelay"
elif command -v audiolatency &> /dev/null; then
  LATENCY_TOOL="audiolatency"
else
  echo "ERROR: jack_iodelay o audiolatency no encontrado"
  exit 1
fi

# Ejecutar test nativo (compilado desde oboe RhythmGame modificado)
# El binario debe implementar: generate_click() → output → input → measure
BINARY="${SCRIPT_DIR}/build/${DEVICE}/RhythmGame"

if [ ! -f "${BINARY}" ]; then
  echo "ERROR: Binary not found at ${BINARY}. Run build first."
  exit 1
fi

# CSV header
echo "iteration,latency_ms,p50,p95,p99" > "${OUTPUT_CSV}"

# Warmup
for i in {1..10}; do
  "${BINARY}" --loopback --iterations 1 --tool "${LATENCY_TOOL}" 2>/dev/null || true
done

# Mediciones reales
for i in $(seq 1 "${ITERATIONS}"); do
  RESULT=$("${BINARY}" --loopback --iterations 1 --tool "${LATENCY_TOOL}" 2>/dev/null | grep -oE '[0-9]+\.?[0-9]*' | head -1)
  if [ -n "${RESULT}" ]; then
    echo "${i},${RESULT}" >> "${OUTPUT_CSV}"
  fi
  
  # Progress cada 100
  if [ $((i % 100)) -eq 0 ]; then
    echo "  Progreso: ${i}/${ITERATIONS}"
  fi
done

# Calcular percentiles
python3 -c "
import pandas as pd
df = pd.read_csv('${OUTPUT_CSV}')
p50 = df['latency_ms'].quantile(0.50)
p95 = df['latency_ms'].quantile(0.95)
p99 = df['latency_ms'].quantile(0.99)
print(f'p50={p50:.2f}ms, p95={p95:.2f}ms, p99={p99:.2f}ms')
# Añadir fila de resumen
with open('${OUTPUT_CSV}', 'a') as f:
    f.write(f'summary,,{p50:.2f},{p95:.2f},{p99:.2f}\n')
"

echo "=== Loopback test completado. Resultados en ${OUTPUT_CSV} ==="