#!/usr/bin/env bash
# S1 Audio Core — Build oboe RhythmGame example para iOS
# Requiere: Xcode, CMake, oboe submodule

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build/ios"
mkdir -p "${BUILD_DIR}"

echo "=== Building oboe RhythmGame for iOS ==="

# Clonar oboe si no existe
if [ ! -d "${SCRIPT_DIR}/oboe" ]; then
  git clone --depth 1 --branch v1.8.0 https://github.com/google/oboe.git "${SCRIPT_DIR}/oboe"
fi

# Configurar CMake para iOS
cmake -B "${BUILD_DIR}" -S "${SCRIPT_DIR}/oboe" \
  -DCMAKE_SYSTEM_NAME=iOS \
  -DCMAKE_OSX_ARCHITECTURES="arm64" \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=13.0 \
  -DOBOE_BUILD_EXAMPLES=ON \
  -DOBOE_BUILD_TESTS=OFF \
  -G Xcode

# Build
cmake --build "${BUILD_DIR}" --config Release --target RhythmGame

echo "=== Build iOS completado en ${BUILD_DIR} ==="