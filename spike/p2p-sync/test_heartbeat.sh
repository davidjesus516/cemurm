#!/usr/bin/env bash
# S2 P2P Sync — Heartbeat + Clock Sync test

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/../results"
mkdir -p "${RESULTS_DIR}"

DURATION="${1:-600}"  # segundos
OUTPUT_CSV="${2:-${RESULTS_DIR}/p2p-heartbeat.csv}"

echo "=== Heartbeat + Clock Sync test: ${DURATION}s ==="

if [ ! -f "${SCRIPT_DIR}/build/heartbeat_test" ]; then
  echo "Building heartbeat test..."
  mkdir -p "${SCRIPT_DIR}/build"
  cmake -B "${SCRIPT_DIR}/build" -S "${SCRIPT_DIR}" -DCMAKE_BUILD_TYPE=Release
  cmake --build "${SCRIPT_DIR}/build" --target heartbeat_test
fi

# Ejecutar maestro + 2 esclavos
"${SCRIPT_DIR}/build/heartbeat_test" --role master --duration "${DURATION}" --output "${OUTPUT_CSV}.master" &
MASTER_PID=$!

sleep 1

"${SCRIPT_DIR}/build/heartbeat_test" --role slave --master-ip 127.0.0.1 --duration "${DURATION}" --output "${OUTPUT_CSV}.slave1" &
SLAVE1_PID=$!

"${SCRIPT_DIR}/build/heartbeat_test" --role slave --master-ip 127.0.0.1 --duration "${DURATION}" --output "${OUTPUT_CSV}.slave2" &
SLAVE2_PID=$!

wait "${MASTER_PID}" "${SLAVE1_PID}" "${SLAVE2_PID}"

# Consolidar y calcular clock drift
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

# Calcular drift entre maestro y esclavos
master = combined[combined['role'] == 'master']
slaves = combined[combined['role'] == 'slave']

for slave_id in slaves['node_id'].unique():
    slave = slaves[slaves['node_id'] == slave_id]
    # Alinear por sequence_number
    merged = pd.merge(master[['seq','timestamp']], slave[['seq','timestamp']], on='seq', suffixes=('_master','_slave'))
    merged['drift_ms'] = (merged['timestamp_slave'] - merged['timestamp_master']) * 1000
    max_drift = merged['drift_ms'].abs().max()
    avg_drift = merged['drift_ms'].abs().mean()
    print(f'Slave {slave_id}: max_drift={max_drift:.3f}ms, avg_drift={avg_drift:.3f}ms')
    if max_drift > 0.5:
        print(f'  ❌ FAIL: drift > 0.5ms')
    else:
        print(f'  ✅ PASS: drift ≤ 0.5ms')
"

echo "=== Heartbeat test completado. Resultados en ${OUTPUT_CSV} ==="