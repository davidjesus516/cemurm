#!/usr/bin/env bash
# S2 P2P Sync — Maestro Failover test (kill maestro, medir nuevo heartbeat)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/../results"
mkdir -p "${RESULTS_DIR}"

OUTPUT_CSV="${1:-${RESULTS_DIR}/p2p-failover.csv}"

echo "=== Maestro Failover test ==="

if [ ! -f "${SCRIPT_DIR}/build/failover_test" ]; then
  echo "Building failover test..."
  mkdir -p "${SCRIPT_DIR}/build"
  cmake -B "${SCRIPT_DIR}/build" -S "${SCRIPT_DIR}" -DCMAKE_BUILD_TYPE=Release
  cmake --build "${SCRIPT_DIR}/build" --target failover_test
fi

# Ejecutar maestro + 2 esclavos
"${SCRIPT_DIR}/build/failover_test" --role master --output "${OUTPUT_CSV}.master" &
MASTER_PID=$!

sleep 1

"${SCRIPT_DIR}/build/failover_test" --role slave --master-ip 127.0.0.1 --output "${OUTPUT_CSV}.slave1" &
SLAVE1_PID=$!

"${SCRIPT_DIR}/build/failover_test" --role slave --master-ip 127.0.0.1 --output "${OUTPUT_CSV}.slave2" &
SLAVE2_PID=$!

# Esperar estabilización (5s)
sleep 5

# Matar maestro (SIGKILL)
echo "Killing master (PID: ${MASTER_PID})..."
kill -9 "${MASTER_PID}"

# Esperar failover (max 5s)
sleep 5

# Matar esclavos
kill "${SLAVE1_PID}" "${SLAVE2_PID}" 2>/dev/null || true

# Analizar tiempo de failover
python3 -c "
import pandas as pd
import glob

files = glob.glob('${OUTPUT_CSV}.*')
all_data = []
for f in files:
    df = pd.read_csv(f)
    all_data.append(df)

combined = pd.concat(all_data)
combined.to_csv('${OUTPUT_CSV}', index=False)

# Buscar: último heartbeat del maestro viejo + primer heartbeat del nuevo maestro
slaves = combined[combined['role'] == 'slave']
for slave_id in slaves['node_id'].unique():
    slave = slaves[slaves['node_id'] == slave_id].sort_values('timestamp')
    # Detectar gap > 100ms (3 heartbeats perdidos @ 20ms = 60ms)
    slave['gap'] = slave['timestamp'].diff()
    max_gap = slave['gap'].max()
    failover_time = max_gap * 1000 if pd.notna(max_gap) else 0
    print(f'Slave {slave_id}: max_gap={failover_time:.1f}ms')
    if failover_time < 1000:
        print(f'  ✅ PASS: failover < 1s')
    else:
        print(f'  ❌ FAIL: failover ≥ 1s')
"

echo "=== Failover test completado. Resultados en ${OUTPUT_CSV} ==="