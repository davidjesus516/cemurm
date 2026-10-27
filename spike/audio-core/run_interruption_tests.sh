#!/usr/bin/env bash
# S1 Audio Core — Interruption tests: background/foreground, screen lock, call interruption
# Mide recovery time tras cada tipo de interrupción

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/../results"
mkdir -p "${RESULTS_DIR}"

DEVICE="${1:-android}"
OUTPUT_CSV="${2:-${RESULTS_DIR}/audio-interruptions-${DEVICE}.csv}"

echo "=== Interruption tests: device=${DEVICE} ==="

BINARY="${SCRIPT_DIR}/build/${DEVICE}/RhythmGame"
if [ ! -f "${BINARY}" ]; then
  echo "ERROR: Binary not found at ${BINARY}"
  exit 1
fi

echo "interruption_type,recovery_ms,artifact_detected" > "${OUTPUT_CSV}"

# Test 1: Background → Foreground
echo "Test: Background → Foreground"
for i in {1..20}; do
  # Simular: app a background 2s → foreground
  # En iOS: UIApplication.didEnterBackgroundNotification / willEnterForegroundNotification
  # En Android: Activity.onStop() / onStart()
  # En Windows: WM_ACTIVATEAPP FALSE/TRUE
  RECOVERY=$("${BINARY}" --test-interruption background_foreground 2>/dev/null | grep -oE '[0-9]+\.?[0-9]*' | head -1)
  ARTIFACT=$("${BINARY}" --test-interruption background_foreground --check-artifact 2>/dev/null | grep -oE 'true|false' | head -1)
  echo "background_foreground,${RECOVERY:-0},${ARTIFACT:-false}" >> "${OUTPUT_CSV}"
done

# Test 2: Screen Lock/Unlock
echo "Test: Screen Lock/Unlock"
for i in {1..20}; do
  RECOVERY=$("${BINARY}" --test-interruption screen_lock 2>/dev/null | grep -oE '[0-9]+\.?[0-9]*' | head -1)
  ARTIFACT=$("${BINARY}" --test-interruption screen_lock --check-artifact 2>/dev/null | grep -oE 'true|false' | head -1)
  echo "screen_lock,${RECOVERY:-0},${ARTIFACT:-false}" >> "${OUTPUT_CSV}"
done

# Test 3: Call Interruption (iOS/Android only)
if [[ "${DEVICE}" == "ios" || "${DEVICE}" == "android" ]]; then
  echo "Test: Call Interruption"
  for i in {1..10}; do
    RECOVERY=$("${BINARY}" --test-interruption call 2>/dev/null | grep -oE '[0-9]+\.?[0-9]*' | head -1)
    ARTIFACT=$("${BINARY}" --test-interruption call --check-artifact 2>/dev/null | grep -oE 'true|false' | head -1)
    echo "call_interruption,${RECOVERY:-0},${ARTIFACT:-false}" >> "${OUTPUT_CSV}"
  done
fi

# Resumen
python3 -c "
import pandas as pd
df = pd.read_csv('${OUTPUT_CSV}')
print('=== Resumen Interruptions ===')
for itype in df['interruption_type'].unique():
    subset = df[df['interruption_type'] == itype]
    p99 = subset['recovery_ms'].quantile(0.99)
    artifacts = subset['artifact_detected'].apply(lambda x: str(x).lower() == 'true').sum()
    print(f'  {itype}: p99={p99:.1f}ms, artifacts={artifacts}/{len(subset)}')
"

echo "=== Interruption tests completados. Resultados en ${OUTPUT_CSV} ==="