#!/usr/bin/env bash
# S3.4 — genera los PDF de referencia de `tests/visual-parity.test.ts`.
#
# La referencia NO sale de nuestro build WASM (sería comparar Verovio consigo
# mismo): sale del Verovio NATIVO de la misma versión, compilado aparte, con las
# mismas opciones. Así la prueba mide lo que de verdad le importa al spike —que
# el build WASM engrave igual que el motor de escritorio— y no solo estabilidad.
#
# Uso:  ./make_ref_pdfs.sh
#   VEROVIO_BIN=/ruta/al/verovio ./make_ref_pdfs.sh
#
# Compilar el nativo (una vez):
#   git clone --depth 1 --branch version-4.4.0 https://github.com/rism-digital/verovio.git /tmp/verovio
#   cmake -S /tmp/verovio/cmake -B /tmp/verovio/build-native -DCMAKE_BUILD_TYPE=Release -DNO_HUMDRUM_SUPPORT=ON
#   cmake --build /tmp/verovio/build-native -j"$(nproc)"
#   -> binario en /tmp/verovio/build-native/verovio
#
# Requiere rsvg-convert (librsvg2-bin). El test usa los `.svg` de aquí como
# fuente del diff y los `.pdf` como referencia para leer a ojo.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VEROVIO_BIN="${VEROVIO_BIN:-/tmp/verovio/build-native/verovio}"
# Datos de Verovio (fuentes SMuFL, elementos): build-native cuelga del árbol del repo.
VEROVIO_DATA="${VEROVIO_DATA:-$(cd "$(dirname "${VEROVIO_BIN}")/.." && pwd)/data}"
OUT_DIR="${SCRIPT_DIR}/ref-pdfs"

[ -d "${VEROVIO_DATA}" ] || {
  echo "❌ No existe el directorio de datos ${VEROVIO_DATA}; pasa VEROVIO_DATA=..." >&2
  exit 1
}

[ -x "${VEROVIO_BIN}" ] || {
  echo "❌ No existe el Verovio nativo en ${VEROVIO_BIN}." >&2
  echo "   Compílalo (ver cabecera) o pasa VEROVIO_BIN=/ruta/al/verovio." >&2
  exit 1
}

echo "Verovio: $("${VEROVIO_BIN}" --version 2>&1 | head -1)"
mkdir -p "${OUT_DIR}"

# Opciones idénticas a las del test: pageWidth 1200, scale 50, adjustPageHeight.
for tool in rsvg-convert; do
  command -v "${tool}" >/dev/null 2>&1 || {
    echo "❌ Falta ${tool} (librsvg2-bin)." >&2
    exit 1
  }
done

for xml in "${SCRIPT_DIR}"/corpus/*.musicxml; do
  name="$(basename "${xml}" .musicxml)"
  # Verovio 4.4.0 no sabe escribir PDF (su salida es svg/mei/midi/timemap): el
  # binario nativo solo produce SVG. El PDF se deriva de ese SVG con
  # rsvg-convert, que es un conversor vectorial estándar y no toca la notación.
  "${VEROVIO_BIN}" "${xml}" \
    -r "${VEROVIO_DATA}" \
    -p 1 \
    -o "${OUT_DIR}/${name}.svg" \
    --page-width 1200 \
    --scale 50 \
    --adjust-page-height \
    2>/dev/null
  rsvg-convert -f pdf -o "${OUT_DIR}/${name}.pdf" "${OUT_DIR}/${name}.svg"
  printf '  %-26s %7s bytes\n' "${name}.pdf" "$(stat -c%s "${OUT_DIR}/${name}.pdf")"
done

echo "✅ Referencias en ${OUT_DIR}/"
