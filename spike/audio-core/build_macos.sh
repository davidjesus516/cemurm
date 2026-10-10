#!/usr/bin/env bash
# S1 Audio Core — Build oboe RhythmGame example para macOS
# Requiere: Xcode, CMake

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build/macos"
mkdir -p "${BUILD_DIR}"

echo "=== Building oboe RhythmGame for macOS ==="

if [ ! -d "${SCRIPT_DIR}/oboe" ]; then
  git clone --depth 1 --branch v1.8.0 https://github.com/google/oboe.git "${SCRIPT_DIR}/oboe"
fi

cmake -B "${BUILD_DIR}" -S "${SCRIPT_DIR}/oboe" \
  -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
  -DOBOE_BUILD_EXAMPLES=ON \
  -DOBOE_BUILD_TESTS=OFF \
  -G Xcode

cmake --build "${BUILD_DIR}" --config Release --target RhythmGame

echo "=== Build macOS completado en ${BUILD_DIR} ==="