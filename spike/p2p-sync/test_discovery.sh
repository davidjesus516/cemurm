#!/usr/bin/env bash
# S2 P2P Sync — mDNS Discovery test (3 nodos)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/../results"
mkdir -p "${RESULTS_DIR}"

NODES="${1:-3}"
OUTPUT_LOG="${2:-${RESULTS_DIR}/p2p-discovery.log}"

echo "=== mDNS Discovery test: ${NODES} nodos ===" > "${OUTPUT_LOG}"

# Compilar si no existe
if [ ! -f "${SCRIPT_DIR}/build/discovery_test" ]; then
  echo "Building discovery test..."
  mkdir -p "${SCRIPT_DIR}/build"
  cmake -B "${SCRIPT_DIR}/build" -S "${SCRIPT_DIR}" -DCMAKE_BUILD_TYPE=Release
  cmake --build "${SCRIPT_DIR}/build" --target discovery_test
fi

# Ejecutar 3 instancias en background con puertos diferentes
PIDS=()
for i in $(seq 1 "${NODES}"); do
  PORT=$((5000 + i))
  "${SCRIPT_DIR}/build/discovery_test" --node-id "node${i}" --port "${PORT}" --log "${RESULTS_DIR}/discovery_node${i}.log" &
  PIDS+=($!)
done

# Esperar descubrimiento (max 10s)
sleep 10

# Matar procesos
for pid in "${PIDS[@]}"; do
  kill "${pid}" 2>/dev/null || true
done

# Consolidar logs
echo "=== Consolidated discovery log ===" >> "${OUTPUT_LOG}"
for i in $(seq 1 "${NODES}"); do
  echo "--- Node ${i} ---" >> "${OUTPUT_LOG}"
  cat "${RESULTS_DIR}/discovery_node${i}.log" >> "${OUTPUT_LOG}" 2>/dev/null || true
done

# Verificar que todos se detectaron mutuamente
DETECTED=$(grep -c "Discovered peer" "${OUTPUT_LOG}" || true)
EXPECTED=$((NODES * (NODES - 1)))  # cada nodo detecta a los otros N-1

echo "=== Resultado: ${DETECTED}/${EXPECTED} peer discoveries ===" | tee -a "${OUTPUT_LOG}"

if [ "${DETECTED}" -eq "${EXPECTED}" ]; then
  echo "✅ PASS: Todos los nodos se detectaron mutuamente" | tee -a "${OUTPUT_LOG}"
  exit 0
else
  echo "❌ FAIL: Descubrimiento incompleto" | tee -a "${OUTPUT_LOG}"
  exit 1
fi