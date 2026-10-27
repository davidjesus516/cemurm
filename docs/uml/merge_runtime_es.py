#!/usr/bin/env python3
"""
merge_runtime_es.py -- agrega al catalogo es las claves que el viewer pide en RUNTIME.

Problema: el catalogo de docs/uml/viewer-es.json solo cubria las claves que
aparecen como {{i18n:*}} en el template. El JS del viewer llama ademas a
viewerText('clave') para 198 claves mas, y esas devolvian la clave cruda
("viewer.passport.relationship.direction.out") porque no estaban en el
diccionario archify-i18n-data.

Este script:
  1. extrae del HTML las claves que el JS pide por su cuenta
  2. pide su texto oficial en ingles al catalogo del skill de archify
  3. mantiene en el catalogo es las claves ya traducidas a mano
  4. reporta las que quedan sin traducir, sin fallar en silencio

Uso:
  python3 docs/uml/merge_runtime_es.py docs/uml/uc-01-add-song.html
"""

import json
import re
import subprocess
import sys
from pathlib import Path

SKILL = Path.home() / ".agents/skills/archify"
I18N = SKILL / "renderers/shared/i18n.mjs"

# Traducciones manuales de las claves de runtime que el usuario ve en el
# panel de pasaporte semantico. Las que no aparecen aqui quedan en ingles,
# que es el idioma por defecto del viewer y preferible a una clave cruda.
MANUAL_ES: dict[str, str] = {
    "viewer.passport.relationship.group.out": "SALIENTES · {count}",
    "viewer.passport.relationship.group.in": "ENTRANTES · {count}",
    "viewer.passport.relationship.group.loop": "CICLOS · {count}",
    # el viewer usa direction.* para etiquetar cada fila de relacion
    "viewer.passport.relationship.direction.out": "→ SALIENTE",
    "viewer.passport.relationship.direction.in": "← ENTRANTE",
    "viewer.passport.relationship.summary": "{out} salientes · {in} entrantes",
    "viewer.passport.relationship.none": "Sin relaciones escritas",
    "viewer.passport.relationship.row": "Relación",
    "viewer.passport.relationship.help": "Relaciones escritas a mano por el autor.",
    "viewer.passport.relationship.inspect": "Inspeccionar relación",
    "viewer.passport.relationship.explorer": "Explorador de relaciones",
    "viewer.passport.relationship.loops": "{count} ciclos",
    "viewer.passport.relationship.pinned": "Relación fijada",
    "viewer.passport.copyRelation": "Copiar enlace de la relación",
    "viewer.passport.copyNode": "Copiar enlace del nodo",
    "viewer.passport.copySource": "Copiar enlace de la fuente",
    "viewer.passport.copyPinned": "Copiar enlace de lo fijado",
    "viewer.passport.reach.noDownstream": "Sin alcance aguas abajo",
    "viewer.passport.reach.noUpstream": "Sin alcance aguas arriba",
    "viewer.passport.reach.status": "Alcance escrito",
    "viewer.passport.verificationScope": "Alcance de verificación",
    "viewer.passport.source.open": "Abrir fuente",
    "viewer.passport.source.openLink": "Abrir evidencia en el repositorio",
    "viewer.passport.sourceMarker": "Fuente",
    "viewer.passport.repository.open": "Abrir repositorio",
    "viewer.nav.camera": "Cámara",
    "viewer.nav.camera.semantic": "Cámara semántica",
    "viewer.nav.camera.title": "Cámara semántica (C)",
    "viewer.nav.detail.full": "Detalle completo",
    "viewer.nav.detail.map": "Detalle del mapa",
    "viewer.nav.detail.read": "Detalle de lectura",
    "viewer.nav.level.auto": "Nivel automático",
    "viewer.intent.loops": "Ciclos",
    "viewer.intent.summary": "Resumen de intención",
    "viewer.route.step": "Paso",
    "viewer.route.position": "Posición {index} de {total}",
    "viewer.route.unreachable": "Sin ruta entre esos nodos",
    "viewer.route.noOutgoing": "Sin relaciones salientes",
    "viewer.route.distinct": "Elegí dos nodos distintos",
    "viewer.route.pause.label": "Pausar recorrido",
    "viewer.route.replay.label": "Repetir recorrido",
    "viewer.radar.nodes": "Nodos",
    "viewer.radar.focus": "Enfocar",
    "viewer.radar.needsSpace": "El radar necesita más espacio de mapa.",
    "viewer.lens.legend": "Leyenda",
    "viewer.lens.single": "Un tipo semántico",
    "viewer.export.copiedPng": "PNG copiado al portapapeles",
    "viewer.export.copiedShare": "Tarjeta copiada",
    "viewer.export.copyFailed": "No se pudo copiar: {message}",
    "viewer.export.unsupported": "No compatible",
    "viewer.export.unknown": "Desconocido",
    "viewer.export.failed": "Falló la exportación",
    "viewer.guide.facts": "Datos",
    "viewer.guide.noStory": "Este diagrama no tiene historia guiada.",
    "viewer.guide.open": "Abrir guía",
    "viewer.finder.noun.nodes": "nodos",
    "viewer.finder.status.all": "{count} nodos",
    "viewer.finder.status.filtered": "{count} de {total}",
    "viewer.theme.": "Tema",
}


def runtime_keys(html: str) -> list[str]:
    keys = set(re.findall(r"viewerText\(\s*'([a-zA-Z0-9_.-]+)'", html))
    # prefijos dinamicos: el JS concatena el sufijo despues, no son claves fijas
    return sorted(k for k in keys if not k.endswith("."))


def english_text(keys: list[str]) -> dict[str, str]:
    script = f"""
import {{ translateMessage }} from '{I18N}';
import {{ readFileSync, writeFileSync }} from 'node:fs';
const keys = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = {{}};
for (const k of keys) {{ try {{ out[k] = translateMessage('en', k); }} catch {{}} }}
writeFileSync(process.argv[3], JSON.stringify(out));
"""
    tmp = Path("/tmp/_mk_in.json")
    out = Path("/tmp/_mk_out.json")
    sp = Path("/tmp/_mk.mjs")
    tmp.write_text(json.dumps(keys))
    sp.write_text(script)
    subprocess.run(["node", str(sp), str(tmp), str(out)], cwd=SKILL, check=True)
    return json.loads(out.read_text())


def main() -> None:
    html_path = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/uml/uc-01-add-song.html")
    es_path = html_path.with_name("viewer-es.json")
    en_path = html_path.with_name("viewer-en.json")

    keys = runtime_keys(html_path.read_text(encoding="utf-8"))
    en_runtime = english_text(keys)

    es = json.loads(es_path.read_text(encoding="utf-8"))
    en = json.loads(en_path.read_text(encoding="utf-8"))

    added = 0
    untranslated: list[str] = []
    for key in keys:
        if key not in en_runtime:
            continue
        en.setdefault(key, en_runtime[key])
        if key in es:
            continue
        es[key] = MANUAL_ES.get(key, en_runtime[key])
        added += 1
        if key not in MANUAL_ES:
            untranslated.append(key)

    es_path.write_text(json.dumps(es, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    en_path.write_text(json.dumps(en, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f" claves runtime detectadas : {len(keys)}")
    print(f" agregadas al catalogo es   : {added}")
    print(f" traducidas a mano          : {sum(1 for k in keys if k in MANUAL_ES)}")
    if untranslated:
        print(f" quedan en ingles ({len(untranslated)}): {', '.join(untranslated[:6])} ...")


if __name__ == "__main__":
    main()