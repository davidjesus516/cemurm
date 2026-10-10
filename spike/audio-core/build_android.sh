#!/usr/bin/env bash
# S1 Audio Core — Build oboe RhythmGame example para Android
# Requiere: Android NDK, CMake, Gradle

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build/android"
mkdir -p "${BUILD_DIR}"

echo "=== Building oboe RhythmGame for Android ==="

if [ ! -d "${SCRIPT_DIR}/oboe" ]; then
  git clone --depth 1 --branch v1.8.0 https://github.com/google/oboe.git "${SCRIPT_DIR}/oboe"
fi

# android.toolchain.cmake from NDK
NDK_PATH="${ANDROID_NDK_HOME:-/opt/android/ndk}"
TOOLCHAIN="${NDK_PATH}/build/cmake/android.toolchain.cmake"

cmake -B "${BUILD_DIR}" -S "${SCRIPT_DIR}/oboe" \
  -DCMAKE_TOOLCHAIN_FILE="${TOOLCHAIN}" \
  -DANDROID_ABI=arm64-v8a \
  -DANDROID_PLATFORM=android-24 \
  -DOBOE_BUILD_EXAMPLES=ON \
  -DOBOE_BUILD_TESTS=OFF

cmake --build "${BUILD_DIR}" --config Release --target RhythmGame

echo "=== Build Android completado en ${BUILD_DIR} ==="