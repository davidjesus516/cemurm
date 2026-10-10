#!/usr/bin/env bash
# S1 Audio Core — Build oboe RhythmGame example para Windows (MSVC)
# Requiere: Visual Studio 2022, CMake, Git

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build/windows"
mkdir -p "${BUILD_DIR}"

echo "=== Building oboe RhythmGame for Windows ==="

if [ ! -d "${SCRIPT_DIR}/oboe" ]; then
  git clone --depth 1 --branch v1.8.0 https://github.com/google/oboe.git "${SCRIPT_DIR}/oboe"
fi

# Usar Visual Studio generator
cmake -B "${BUILD_DIR}" -S "${SCRIPT_DIR}/oboe" \
  -G "Visual Studio 17 2022" \
  -A x64 \
  -DOBOE_BUILD_EXAMPLES=ON \
  -DOBOE_BUILD_TESTS=OFF

cmake --build "${BUILD_DIR}" --config Release --target RhythmGame

echo "=== Build Windows completado en ${BUILD_DIR} ==="