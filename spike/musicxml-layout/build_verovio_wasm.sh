#!/usr/bin/env bash
# S3 MusicXML Layout — build de Verovio WASM + wrapper para los tests
#
# Uso:  ./build_verovio_wasm.sh [version]      (por defecto 4.4.0)
#
# Requisitos: emscripten (emcc/emcmake/emmake), git, perl y cmake.
#   emsdk:  git clone https://github.com/emscripten-core/emsdk && cd emsdk \
#           && ./emsdk install 3.1.61 && ./emsdk activate 3.1.61 \
#           && source ./emsdk_env.sh
#
# El build anterior pasaba flags -DVEROVIO_MODULE_* que Verovio NO define: su
# build WASM va por `emscripten/buildToolkit`, y su CMake vive en `cmake/`.
# Con `-w -m` el propio Verovio añade -s SINGLE_FILE=1, así que el wasm queda
# embebido en base64 dentro de verovio.js (un solo fichero, sin verovio.wasm).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/wasm"
VEROVIO_VERSION="${1:-4.4.0}"

echo "=== Verovio WASM (version-${VEROVIO_VERSION}) ==="

for tool in emcc emcmake emmake perl cmake git; do
  command -v "${tool}" >/dev/null 2>&1 || {
    echo "❌ Falta ${tool}. Instala emsdk y haz 'source emsdk_env.sh'." >&2
    exit 1
  }
done

if [ ! -d "${SCRIPT_DIR}/verovio" ]; then
  git clone --depth 1 --branch "version-${VEROVIO_VERSION}" \
    https://github.com/rism-digital/verovio.git "${SCRIPT_DIR}/verovio"
fi

cd "${SCRIPT_DIR}/verovio/emscripten"
perl buildToolkit -w -m -c

mkdir -p "${OUTPUT_DIR}"
cp build/verovio.js "${OUTPUT_DIR}/verovio.js"
# Wrapper JS del propio repo: sin él el módulo emscripten no expone renderToSVG.
cp npm/src/verovio-toolkit.js npm/src/emscripten-proxy.js npm/src/verovio-logger.js "${OUTPUT_DIR}/"

cat > "${OUTPUT_DIR}/index.js" <<'EOF'
// Factoría async: devuelve un VerovioToolkit listo para los tests de S3.
import createVerovioModule from './verovio.js'
import { VerovioToolkit } from './verovio-toolkit.js'

export { VerovioToolkit }

export default async function createToolkit() {
  const module = await createVerovioModule()
  return new VerovioToolkit(module)
}
EOF

cat > "${OUTPUT_DIR}/package.json" <<EOF
{
  "name": "verovio-wasm",
  "version": "${VEROVIO_VERSION}-spike",
  "private": true,
  "type": "module",
  "main": "index.js",
  "module": "index.js"
}
EOF

RAW_SIZE=$(stat -c%s "${OUTPUT_DIR}/verovio.js")
GZ_SIZE=$(gzip -c "${OUTPUT_DIR}/verovio.js" | wc -c)
echo "=== Listo ==="
echo "  verovio.js: ${RAW_SIZE} bytes (${GZ_SIZE} bytes gzip)"
echo "  Objetivo del spike: < 3 MB gzip (3,145,728 bytes)"
if [ "${GZ_SIZE}" -lt 3145728 ]; then
  echo "  ✅ Objetivo de tamano cumplido"
else
  # No se falla el build: probar el objetivo es el trabajo de S3.1, y el
  # resultado (no cumplido) es un hallazgo, no un error de compilacion.
  echo "  ❌ Objetivo de tamano NO cumplido (build completo igualmente)"
fi
