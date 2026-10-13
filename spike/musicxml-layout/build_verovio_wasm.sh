#!/usr/bin/env bash
# S3 MusicXML Layout — Compilar Verovio WASM custom build

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/wasm"
mkdir -p "${OUTPUT_DIR}"

MODULES="${1:-musicxml,layout,transpose,mei}"
VEROVIO_VERSION="${2:-v4.4.0}"

echo "=== Building Verovio WASM (modules: ${MODULES}) ==="

# Clonar Verovio
if [ ! -d "${SCRIPT_DIR}/verovio" ]; then
  git clone --depth 1 --branch "${VEROVIO_VERSION}" https://github.com/rism-digital/verovio.git "${SCRIPT_DIR}/verovio"
fi

cd "${SCRIPT_DIR}/verovio"

# Configurar Emscripten
source /emsdk/emsdk_env.sh 2>/dev/null || true

# Build con módulos mínimos
# Verovio usa CMake + emscripten
emcmake cmake -B build-wasm -S . \
  -DCMAKE_BUILD_TYPE=Release \
  -DVEROVIO_MODULE_MUSICXML=ON \
  -DVEROVIO_MODULE_LAYOUT=ON \
  -DVEROVIO_MODULE_TRANSPOSE=ON \
  -DVEROVIO_MODULE_MEI=ON \
  -DVEROVIO_MODULE_PDF=OFF \
  -DVEROVIO_MODULE_MIDI=OFF \
  -DVEROVIO_MODULE_AUDIO=OFF \
  -DVEROVIO_MODULE_BRAILLE=OFF \
  -DVEROVIO_MODULE_PLOT=OFF \
  -DVEROVIO_MODULE_TOOLKIT=OFF

cmake --build build-wasm --config Release -j$(nproc)

# Copiar artefactos
cp build-wasm/verovio.wasm "${OUTPUT_DIR}/"
cp build-wasm/verovio.js "${OUTPUT_DIR}/"
cp build-wasm/verovio.wasm.map "${OUTPUT_DIR}/" 2>/dev/null || true

# Verificar tamaño
WASM_SIZE=$(stat -c%s "${OUTPUT_DIR}/verovio.wasm")
WASM_GZ_SIZE=$(gzip -c "${OUTPUT_DIR}/verovio.wasm" | wc -c)

echo "=== Verovio WASM build completado ==="
echo "  verovio.wasm: ${WASM_SIZE} bytes (${WASM_GZ_SIZE} bytes gzipped)"
echo "  Target: < 3 MB gzipped (3,145,728 bytes)"

if [ "${WASM_GZ_SIZE}" -lt 3145728 ]; then
  echo "  ✅ PASS: Size OK"
else
  echo "  ❌ FAIL: Excede 3 MB gzipped"
  exit 1
fi