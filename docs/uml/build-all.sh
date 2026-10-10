#!/usr/bin/env bash
# Regenera TODOS los diagramas UML de docs/uml/ con los mismos parametros.
# Uso: bash docs/uml/build-all.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

if ! curl -sf -o /dev/null --max-time 5 http://127.0.0.1:8000/health; then
  echo "Kroki no responde. Levantalo con:"
  echo "  docker start kroki || docker run -d --name kroki -p 127.0.0.1:8000:8000 yuzutech/kroki:latest"
  exit 1
fi

# id | titulo | base | feature
build() {
  local id="$1" title="$2" base="$3" feature="$4"
  python3 docs/uml/stamp_archify.py "docs/uml/$id.puml" "docs/uml/$id.html" \
    --locale es --lang es --switcher --base "$base" --feature "$feature" \
    --title "$title" \
    --subtitle "Escenario: $(python3 - "$base" <<'PY'
import sys, importlib.util
spec = importlib.util.spec_from_file_location("sa", "docs/uml/stamp_archify.py")
m = importlib.util.module_from_spec(spec)
try: spec.loader.exec_module(m)
except SystemExit: pass
print(" ".join(m.UC_LABELS[sys.argv[1]]["es"][:2]))
PY
) · $feature" \
    --keep-svg "docs/uml/$id.svg" | tail -5
  echo
}

build uc-01-add-song    "CEMURM — UC-01 Agregar una canción al repertorio" UC1 "features/repertoire-mgmt.feature:6"
build uc-02-collections "CEMURM — UC-02 Colecciones temáticas"          UC1 "features/collections.feature:12"
build uc-03-comments    "CEMURM — UC-03 Comentarios y anotaciones"      UC1 "features/collaborative-comments.feature:10"

echo "Consistencia:"
for f in docs/uml/uc-*.puml; do
  printf "  %-28s <<actor>>: %s  skinparam-hash: %s\n" \
    "$(basename "$f")" \
    "$(grep -c '<<actor>>' "$f")" \
    "$(grep -E '^skinparam|^left to right' "$f" | sort | md5sum | cut -c1-8)"
done