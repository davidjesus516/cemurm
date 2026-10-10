#!/usr/bin/env python3
"""
stamp_archify.py -- convierte un SVG de PlantUML en un diagrama archify instrumentado.

El viewer de archify localiza la semantica del diagrama por atributos data-*
sobre el SVG (no por un modelo de datos interno). Este script estampa esos
atributos sobre un SVG de PlantUML para que el viewer los encuentre.

Uso:
  python3 docs/uml/stamp_archify.py in.puml out.html [--template ruta]

Salida: un HTML standalone con el SVG de PlantUML instrumentado embebido en el
template del viewer de archify, conservando la notacion UML original.
"""

import argparse
import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

DEFAULT_TEMPLATE = Path.home() / ".agents/skills/archify/assets/template.html"
KROKI = "http://127.0.0.1:8000/plantuml/svg"

# Notacion UML -> data-node-kind del viewer
KIND_ACTOR = "external"
KIND_USECASE = "backend"
KIND_DB = "database"
KIND_BOUNDARY = "cloud"


# Nombre legible por idioma para los casos de uso. La clave es el alias de
# PlantUML, que ya viaja en data-qualified-name, asi que no hace falta un id
# inventado ni un mapa de posiciones fragil.
# Las listas deben tener la MISMA cantidad de lineas en ambos idiomas: cada
# linea es un <text> dentro de la elipse, y si un idioma tiene mas o menos
# lineas que el otro, el switcher deja texto huerfano o recortado.
UC_LABELS: dict[str, dict[str, list[str]]] = {
    "UC1": {
        "es": ["Agregar una canción", "al repertorio", "[UC1]"],
        "en": ["Add a song", "to repertoire", "[UC1]"],
    },
    "UC2": {
        "es": ["Validar el archivo", "de acordes", "[UC2]"],
        "en": ["Validate the", "chord file", "[UC2]"],
    },
    "UC3": {
        "es": ["Calcular readiness", "[UC3]"],
        "en": ["Compute readiness", "[UC3]"],
    },
    "UC4": {
        "es": ["Adjuntar escaneo PDF", "[UC4]"],
        "en": ["Attach PDF scan", "[UC4]"],
    },
    "Musician": {"es": ["Músico", "«actor»"], "en": ["Musician", "«actor»"]},
    # UC-02 Collections (features/collections.feature, 14 escenarios).
    # Peer es un actor distinto: el bandmate comparte, pero la bifurcacion
    # garantiza que su edicion no llegue a la copia personal.
    "UC1": {
        "es": ["Gestionar una colección", "temática", "[UC1]"],
        "en": ["Manage a themed", "collection", "[UC1]"],
    },
    "UC2": {
        "es": ["Ordenar canciones", "dentro de la colección", "[UC2]"],
        "en": ["Reorder songs", "inside the collection", "[UC2]"],
    },
    "UC3": {
        "es": ["Bifurcar una colección", "compartida", "[UC3]"],
        "en": ["Fork a shared", "collection", "[UC3]"],
    },
    "UC4": {
        "es": ["Vaciar una colección", "compartida", "[UC4]"],
        "en": ["Empty a shared", "collection", "[UC4]"],
    },
    "Peer": {"es": ["Bandmate", "compartido", "«actor»"], "en": ["Shared", "bandmate", "«actor»"]},
    # UC-03 Comentarios (features/collaborative-comments.feature, 13 escenarios).
    # UC4 (anotacion personal) es un <<extend>> del caso base: es otra forma de
    # trabajar sobre la cancion, no una variante de comentar EN LA BANDA. La
    # diferencia es de alcance (personal vs compartido), y por eso lleva su
    # propia tabla: personal_annotations no tiene ningun campo de comparticion.
    "UC1": {
        "es": ["Comentar una canción", "compartida", "[UC1]"],
        "en": ["Comment on a shared", "song", "[UC1]"],
    },
    "UC2": {
        "es": ["Anclar a una sección", "o a una versión", "[UC2]"],
        "en": ["Anchor to a section", "or to a version", "[UC2]"],
    },
    "UC3": {
        "es": ["Resolver el hilo", "cuando el cambio ya está", "[UC3]"],
        "en": ["Resolve the thread", "once the change landed", "[UC3]"],
    },
    "UC4": {
        "es": ["Escribir una anotación", "personal", "[UC4]"],
        "en": ["Write a personal", "annotation", "[UC4]"],
    },
}

INK = {
    # fill del atributo  ->  clase semantica
    "#F1F1F1": "uc-surface",   # relleno de elipse de caso de uso
    "#232733": "uc-surface",   # relleno de la frontera del sistema
    "#E2E4E9": "uc-ink",       # texto del diagrama (solo fill, NUNCA stroke)
    "#8B8FA3": "uc-muted",     # lineas de asociacion
    "#0F1117": "uc-canvas",    # fondo
    "#1A1D27": "uc-surface",   # relleno del cilindro
}
STROKE = {
    "#4A5068": "uc-edge",
    # El actor (cabeza + extremidades) NECESITA stroke; el texto NO. Con la
    # misma clase para ambos, el texto salia con stroke encima y se veia
    # en negrita y difuminado. De ahi la clase aparte.
    "#E2E4E9": "uc-ink-stroke",
    "#8B8FA3": "uc-muted",
    "#6C8CFF": "uc-accent",
}


def semanticize_colors(svg: str) -> str:
    """Convierte colores inline de PlantUML en clases CSS semanticas.

    Es lo que el propio skill de archify pide: CSS semantic classes, no inline
    colors. Sin esto el SVG queda horneado en un tema y el toggle claro/oscuro
    del viewer no lo alcanza.

    Los atributos de presentacion (fill="...") los sobreescribe una regla CSS
    normal; los estilos inline (style="stroke:...") necesitan !important.
    """
    # Se procesa cada tag una vez: se junta su clase de stroke y su clase de fill

    # Se procesa cada tag una vez: se junta su clase de stroke y su clase de fill
    # en un solo atributo class, en lugar de dos inserciones que colisionan.
    def tag_sub(m: re.Match) -> str:
        tag_body = m.group(0)
        classes: list[str] = []

        sm = re.search(r'style="stroke:(#[0-9A-Fa-f]{6});([^"]*)"', tag_body)
        if sm and sm.group(1) in STROKE:
            classes.append(STROKE[sm.group(1)])
            tag_body = tag_body.replace(sm.group(0), f'style="{sm.group(2)}"')

        fm = re.search(r'\sfill="(#[0-9A-Fa-f]{6})"', tag_body)
        if fm and fm.group(1) in INK:
            classes.append(INK[fm.group(1)])
            tag_body = tag_body.replace(fm.group(0), "")

        if not classes:
            return tag_body
        return re.sub(r"^<(\w+)", rf'<\1 class="{" ".join(classes)}"', tag_body)

    svg = re.sub(r"<[a-zA-Z][^>]*>", tag_sub, svg)
    return svg


def set_font(svg: str, size: int = 14) -> str:
    """Iguala la tipografia del diagrama a la de los subtitulos.

    Se copia el MISMO stack que declara el viewer, no una version abreviada:
    con "JetBrains Mono, ui-monospace, monospace" el navegador resolvia antes
    de tiempo y el texto salia con otro hinted que el resto de la pagina.
    Medido con getComputedStyle sobre .subtitle y svg text: deben coincidir.
    """
    svg = re.sub(
        r'font-family="[^"]*"',
        "font-family=\"&quot;JetBrains Mono&quot;, ui-monospace, SFMono-Regular, Menlo,"
        ' Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace"',
        svg,
        count=1,
    )
    svg = re.sub(r'font-size="1[34]"', f'font-size="{size}"', svg)
    return svg


def render_puml(puml: Path) -> str:
    """Pide el SVG a Kroki. Falla ruidosamente si no responde."""
    data = puml.read_bytes()
    try:
        with urllib.request.urlopen(urllib.request.Request(KROKI, data=data), timeout=30) as r:
            body = r.read().decode("utf-8")
    except Exception as exc:  # noqa: BLE001
        sys.exit(f" Kroki no respondio en {KROKI}: {exc}\nLevantalo con:\n  docker run -d --name kroki -p 127.0.0.1:8000:8000 yuzutech/kroki:latest")
    if not body.lstrip().startswith("<svg"):
        sys.exit(f" Kroki devolvio un error: {body[:200]}")
    return body


def drop_text_length(svg: str) -> str:
    """Quita el textLength de PlantUML.

    PlantUML fija textLength al ancho medido del texto original. Cuando el
    switcher reemplaza el texto por la traduccion, el navegador estira las
    letras para llenar ese ancho fijo y sale "A d d a s o n g". Sin
    textLength, cada idioma usa su ancho natural.
    """
    return re.sub(r'\stextLength="[\d.]+"', "", svg)


def mark_diagram_text(svg: str, lang: str) -> tuple[str, dict[str, str], list[str]]:
    """Marca cada <text> del diagrama con data-i18n para que el switcher lo cambie.

    Los casos de uso viven dentro del SVG, no en el HTML: es texto que PlantUML
    genero, por eso no tenia data-i18n y quedaba fijo en el idioma del render.
    Cada linea de una elipse es un <text> separado, asi que el mapeo es 1:1
    con UC_LABELS[alias][idioma][linea].

    Devuelve (svg_marcado, claves, faltantes).
    """
    keys: dict[str, str] = {}
    missing: list[str] = []

    def sub(match: re.Match) -> str:
        attrs, qualified, body = match.group(1), match.group(2), match.group(3)
        alias = qualified.rsplit(".", 1)[-1]
        options = UC_LABELS.get(alias)
        if not options:
            return match.group(0)
        lines = options.get(lang) or options["en"]

        counter = {"i": 0}

        def mark_text(m: re.Match) -> str:
            key = f"uc.{alias}.{counter['i']}"
            counter["i"] += 1
            keys[key] = m.group(1)
            return m.group(0).replace("<text", f'<text data-i18n="{key}"', 1)

        body = re.sub(r"<text([^>]*)>", mark_text, body)
        if counter["i"] != len(lines):
            missing.append(
                f"{alias}: {counter['i']} <text> vs {len(lines)} lineas en UC_LABELS[{lang}]"
            )
        return f"<g{attrs}>{body}</g>"

    # class="entity" es la clase que PlantUML pone a los nodos; el cluster y
    # los links usan otras. Con .*?</g> sin mas, el primer match se traga el
    # <g class="cluster"> del rectangulo y corta en su </g> interno.
    svg = re.sub(
        r'<g([^>]*class="entity"[^>]*data-qualified-name="([A-Za-z_0-9.]+)"[^>]*)>(.*?)</g>',
        sub,
        svg,
        flags=re.S,
    )
    return svg, keys, missing


def stamp(svg: str, dark_bg: str = "#0F1117") -> str:
    """Estampa los data-* que el viewer busca, conservando los shapes UML."""
    svg = svg.replace("background:#FFFFFF;", f"background:{dark_bg};")

    # 1. Actores: PlantUML los emite como <g> con data-qualified-name, cabeza
    #    (ellipse rx=8) y cuerpo (path). Los casos de uso son <g class="entity">
    #    con una ellipse; las bases de datos usan el cilindro (path).
    def node_gid(name: str) -> str:
        return f"node-{re.sub(r'[^a-z0-9_]+', '_', name.lower())}"

    # Relationships: <g class="link" data-entity-1=".." data-entity-2="..">
    # El SVG de PlantUML ya trae data-entity-1/2, que es la clave que usa el
    # viewer para resolver from/to.

    # PlantUML emite los actores con class="entity" IGUAL que los casos de uso
    # (no hay clase propia), asi que la distincion real es el nombre qualified:
    # los casos de uso viven dentro del paquete ("CEMURM.UC1"), el actor no.
    # Recorrido en un solo pass para no secuir el mismo grupo dos veces.
    id_map: dict[str, str] = {}

    def stamp_entity(m: re.Match) -> str:
        whole, attrs, body = m.group(0), m.group(1), m.group(2)
        qn = re.search(r'data-qualified-name="([^"]*)"', attrs)
        if not qn:
            return whole
        qualified = qn.group(1)
        is_actor = "." not in qualified
        name = qualified.rsplit(".", 1)[-1]
        label = extract_label(body) or name
        kind = KIND_ACTOR if is_actor else (KIND_DB if is_cylinder(body) else KIND_USECASE)
        role = "actor" if is_actor else "use case"
        ent = re.search(r'id="([^"]*)"', attrs)
        if ent:
            id_map[ent.group(1)] = name
        extra = (
            f' data-node-id="{name}" data-node-label="{html.escape(label)}"'
            f' data-node-kind="{kind}" tabindex="0" role="button"'
            f' aria-label="Focus {html.escape(label)}, {role}" aria-pressed="false"'
        )
        return inject(whole, extra)

    svg = re.sub(r'<g ([^>]*class="entity"[^>]*)>(.*?)</g>', stamp_entity, svg, flags=re.S)

    # --- relaciones: data-entity-1/2 son ids internos (ent0001); hay que
    # traducirlos al data-node-id que el viewer usa para resolver from/to ---
    def stamp_link(m: re.Match) -> str:
        whole, attrs, body = m.group(0), m.group(1), m.group(2)
        e1 = re.search(r'data-entity-1="([^"]*)"', attrs)
        e2 = re.search(r'data-entity-2="([^"]*)"', attrs)
        if not (e1 and e2):
            return whole
        frm = id_map.get(e1.group(1), e1.group(1))
        to = id_map.get(e2.group(1), e2.group(1))
        label = stereotype_in(body)
        extra = f' data-edge-from="{frm}" data-edge-to="{to}"'
        if label:
            extra += f' data-edge-label="{html.escape(label)}"'
        return inject(whole, extra)

    svg = re.sub(r'<g ([^>]*class="link"[^>]*)>(.*?)</g>', stamp_link, svg, flags=re.S)

    # --- fondo real: el style background no lo respeta ningun renderer ---
    m = re.search(r'viewBox="([\d.\- ]+)"', svg)
    if m:
        parts = m.group(1).split()
        w, h = parts[2], parts[3]
        bg = f'<rect class="uc-canvas" x="0" y="0" width="{w}" height="{h}" fill="{dark_bg}"/>'
        svg = re.sub(r"(<svg[^>]*>)", r"\1\n" + bg, svg, count=1)

    # --- el viewer controla el tamano; quitar los fijos ---
    svg = re.sub(r'\sstyle="width:\d+px;height:\d+px;[^"]*"', "", svg)
    svg = re.sub(r'\swidth="\d+px"', "", svg, count=1)
    svg = re.sub(r'\sheight="\d+px"', "", svg, count=1)
    return svg


def inject(whole: str, extra: str) -> str:
    """Agrega atributos al <g> de apertura sin duplicar los que ya existen."""
    open_tag = re.match(r"<g\s[^>]*>", whole).group(0)
    for attr in (
        "data-node-id",
        "data-node-kind",
        "data-node-label",
        "data-edge-from",
        "aria-pressed",
        "tabindex",
        "role",
        "aria-label",
    ):
        if f" {attr}=" in open_tag:
            extra = re.sub(rf'\s{attr}="[^"]*"', "", extra)
    return whole.replace(open_tag, open_tag[:-1] + extra + ">", 1)


def is_cylinder(body: str) -> bool:
    """PlantUML dibuja la base de datos como cilindro: 4 curvas C y 2 lineas L
    cerrando el contorno. Un caso de uso es una sola ellipse."""
    for p in re.findall(r"<path[^>]*d=\"([^\"]+)\"", body):
        if p.count("C") >= 4 and p.count("L") >= 2:
            return True
    return False


def stereotype_in(body: str) -> str:
    """PlantUML escribe los stereotypes con guillemets UTF-8 (<<include>>),
    NO con &lt;&lt;include&gt;&gt;. El texto vive dentro del propio <g class="link">."""
    m = re.search(r"«\s*([A-Za-z]+)\s*»|&lt;&lt;\s*([A-Za-z]+)\s*&gt;&gt;", body)
    if not m:
        return ""
    word = m.group(1) or m.group(2)
    return f"<<{word}>>"


def extract_label(body: str) -> str:
    """Primer <text> con contenido real; ignora los vacios de layout."""
    for t in re.finditer(r"<text[^>]*>(.*?)</text>", body, re.S):
        label = re.sub(r"<[^>]+>", "", t.group(1)).strip()
        if label:
            return label
    return ""


def extract_stereotype(attrs: str) -> str:
    """Respaldo: stereotype en los propios atributos del grupo."""
    m = re.search(r"&lt;&lt;\s*([A-Za-z]+)\s*&gt;&gt;", attrs)
    return f"<<{m.group(1)}>>" if m else ""


ARCHIFY_SKILL = Path.home() / ".agents/skills/archify"
I18N_MODULE = ARCHIFY_SKILL / "renderers/shared/i18n.mjs"


VIEWER_ES = Path(__file__).with_name("viewer-es.json")
VIEWER_EN = Path(__file__).with_name("viewer-en.json")


def translate_template(shell: str, catalog: Path | dict) -> tuple[str, list[str]]:
    """Sustituye los {{i18n:*}} con el catalogo indicado.

    El catalogo de archify solo trae en y zh-CN, y editarlo dentro del skill
    se pierde en cada actualizacion. Por eso el catalogo espanol vive aca,
    junto al diagrama que lo usa.

    Devuelve (html, claves_sin_traducir) para no fallar en silencio.
    """
    data = json.loads(catalog.read_text(encoding="utf-8")) if isinstance(catalog, Path) else catalog
    missing: list[str] = []

    def sub(match: re.Match) -> str:
        key = match.group(1)
        if key in data:
            return html.escape(data[key])
        missing.append(key)
        return match.group(0)

    return re.sub(r"\{\{i18n:([a-zA-Z0-9_.-]+)\}\}", sub, shell), missing


PLACEHOLDER = re.compile(r"\{\{i18n:([a-zA-Z0-9_.-]+)\}\}")


def markup_i18n(shell: str) -> str:
    """Marca los {{i18n:*}} para poder cambiar de idioma en runtime.

    Escaneo por tags, no regex global: sobre 774 KB de HTML un patron que
    casea atributos y contenido se vuelve catastrofico y cuelga el proceso.

    - los que estan en CONTENIDO se envuelven en <span data-i18n="clave">
    - los que estan en ATRIBUTOS (title=, aria-label=) se registran como
      data-i18n-title / data-i18n-label en el mismo tag

    Un tag puede traer varios placeholders (title y aria-label del mismo
    boton); por eso se agrupan por tag en vez de editar match por match.
    """
    out: list[str] = []
    for part in re.split(r"(<[^>]*>)", shell):
        if not part.startswith("<"):
            # contenido: envolver cada placeholder
            out.append(
                PLACEHOLDER.sub(
                    lambda m: f'<span data-i18n="{m.group(1)}">{{{{i18n:{m.group(1)}}}}}</span>',
                    part,
                )
            )
            continue
        if "{{i18n:" not in part:
            out.append(part)
            continue
        # tag con placeholders en atributos. Se registra POR ATRIBUTO: un mismo boton
        # suele traer title= y aria-label= con claves distintas, y colapsarlos
        # a un solo slot hacia que uno de los dos no se traduzca.
        slots: list[tuple[str, str]] = []

        def note_attr(m: re.Match) -> str:
            attr, value = m.group(1), m.group(2)
            if "{{i18n:" in value:
                for key in PLACEHOLDER.findall(value):
                    slots.append((attr, key))
            return m.group(0)

        scanned = re.sub(r'([\w:-]+)="([^"]*)"', note_attr, part)
        data_attrs = " ".join(f'data-i18n-{attr}="{key}"' for attr, key in slots)
        out.append(f"{scanned[:-1].rstrip()} {data_attrs}>")
    return "".join(out)


UML_CSS = """
/* Tema claro/oscuro para el diagrama UML.
   Las clases las emite semanticize_colors(). */
html[data-theme="dark"] .uc-canvas { fill: #0F1117; }
html[data-theme="light"] .uc-canvas { fill: #FFFFFF; }
html[data-theme="dark"] .uc-surface { fill: #232733 !important; }
html[data-theme="light"] .uc-surface { fill: #FFFFFF !important; }
html[data-theme="dark"] .uc-ink { fill: #E2E4E9 !important; stroke: none !important; }
html[data-theme="light"] .uc-ink { fill: #1B1F2A !important; stroke: none !important; }
html[data-theme="dark"] .uc-ink-stroke { fill: #E2E4E9 !important; stroke: #E2E4E9 !important; }
html[data-theme="light"] .uc-ink-stroke { fill: #1B1F2A !important; stroke: #1B1F2A !important; }
html[data-theme="dark"] .uc-muted { fill: #8B8FA3 !important; stroke: #8B8FA3 !important; }
html[data-theme="light"] .uc-muted { fill: #5A6072 !important; stroke: #5A6072 !important; }
html[data-theme="dark"] .uc-edge { fill: none !important; stroke: #4A5068 !important; }
html[data-theme="light"] .uc-edge { fill: none !important; stroke: #B9C0D0 !important; }
html[data-theme="dark"] .uc-accent { fill: #1A1D27 !important; stroke: #6C8CFF !important; }
html[data-theme="light"] .uc-accent { fill: #F4F6FB !important; stroke: #3B5BDB !important; }

/* El viewer escala el diagrama para llenar el ancho (medido x1.32), y al
   escalar un SVG el navegador rasteriza el texto: un 14px nativo se dibuja a
   ~18.5px con otro hinted, y se ve difuso frente al chrome, que es HTML y se
   dibuja a pixel nativo. La unica forma de igualarlos es NO escalar: el
   diagrama se dibuja a su tamano de viewBox y el sobrante queda en el lienzo.
   El contenedor real es .diagram-container (verificado en el DOM). */
.diagram-container svg,
.diagram-container > svg,
body svg[data-diagram-type] {
  width: auto !important;
  min-width: 0 !important;
  max-width: 100% !important;
  height: auto !important;
}

/* El pasaporte semantico (focus-chip relationship-lens) se abre como
   posicion:absolute DENTRO de .diagram-container, o sea encima del diagrama,
   tapando nodos. Se lo mueve al contenedor .container para que flota sobre
   la pagina y no sobre el dibujo.
   Los estilos de fila van al final del body a proposito: el stylesheet del
   viewer define .relationship-lens-title con white-space:nowrap y las filas
   se superponen si se les cambia el alto. Se fija alto minimo y se separa el
   titulo de su detalle para que no se pisen. */
.relationship-lens {
  position: fixed !important;
  left: 1.25rem !important;
  bottom: 1.25rem !important;
  top: auto !important;
  right: auto !important;
  z-index: 40;
  max-width: 22rem;
}
.relationship-lens-title,
.semantic-passport-detail {
  display: block !important;
  height: auto !important;
  white-space: normal !important;
  overflow: visible !important;
  line-height: 1.35 !important;
}
.relationship-lens-title { margin-bottom: 0.2rem !important; }
/* La fila del pasaporte tiene 3-4 hijos inline (direccion, nodo, etiqueta)
   sin separador, y salen pegados: "→ ENTRANTEAgregar una canción<<include>>".
   Se los pasa a block para que cada dato ocupe su linea. */
.relationship-lens-group { display: block !important; }
.relationship-lens-group-title { display: block !important; margin-bottom: 0.3rem !important; }
.relationship-lens-row { display: block !important; margin-bottom: 0.4rem !important; }
.relationship-lens-row > * {
  display: block !important;
  white-space: normal !important;
  overflow: visible !important;
}
.relationship-lens-direction { font-weight: 600; opacity: 0.75; margin-bottom: 0.1rem; }
""".strip()


def add_uml_css(shell: str) -> str:
    """Inyecta la hoja de estilo que hace al diagrama sensible al tema.

    Va al FINAL del body, no en el head: el viewer declara `svg { width: 100% }`
    y, a igual especificidad, gana la ultima regla en el orden del documento.
    En el head, el CSS del viewer la pisaba y el diagrama seguia escalandose.
    """
    style = f"<style>{UML_CSS}</style>"
    if "</body>" in shell:
        return shell.replace("</body>", f"{style}\n</body>", 1)
    return shell


def add_i18n_data_node(shell: str, catalogs: dict[str, dict[str, str]], locale: str) -> str:
    """Crea el nodo #archify-i18n-data que el viewer lee en runtime.

    viewerText(key) resuelve contra archifyI18nData.messages. Sin ese nodo
    devuelve la clave cruda: el boton de tema llegaba a mostrar
    "viewer.theme.light" en vez de "Claro".

    El template crudo NO trae el nodo: lo inyecta `archify deliver`, y nosotros
    no pasamos por ahi. Se crea antes de los <script> del viewer.
    """
    payload = json.dumps(
        {"locale": locale, "messages": catalogs.get(locale, {})},
        ensure_ascii=False,
    )
    node = (
        '<script type="application/json" id="archify-i18n-data">'
        + payload.replace("<", "\\u003c")
        + "</script>\n  "
    )
    marker = "  <script>\n    var Archify = {};"
    if marker in shell:
        return shell.replace(marker, node + marker, 1)
    return shell.replace("<body>", f"<body>\n  {node}", 1)


def add_language_switcher(shell: str, catalogs: dict[str, dict[str, str]]) -> str:
    """Inyecta el boton ES/EN: markup data-i18n + ambos catalogos + el switch."""
    payload = json.dumps(catalogs, ensure_ascii=False, separators=(",", ":"))

    button = (
        '\n    <button id="btn-lang" type="button" title="Cambiar idioma / Switch language"'
        ' aria-label="Cambiar idioma" data-lang-toggle>'
        f'      <span class="toolbar-label" id="lang-label">{html.escape("ES")}</span>'
        "    </button>"
    )
    marker = '\n    <button id="btn-theme" type="button"'
    if marker not in shell:
        return shell
    shell = shell.replace(marker, button + marker, 1)

    script = f"""
<script>
(function () {{
  var CATALOGS = {payload};
  var order = {json.dumps(list(catalogs.keys()))};
  var current = {json.dumps(list(catalogs.keys())[0])};
  var btn = document.getElementById('btn-lang');
  var label = document.getElementById('lang-label');
  function apply(locale) {{
    var dict = CATALOGS[locale] || {{}};
    document.querySelectorAll('[data-i18n]').forEach(function (el) {{
      var val = dict[el.getAttribute('data-i18n')];
      if (val !== undefined) el.textContent = val;
    }});
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {{
      var val = dict[el.getAttribute('data-i18n-title')];
      if (val !== undefined) el.setAttribute('title', val);
    }});
    document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {{
      var val = dict[el.getAttribute('data-i18n-aria-label')];
      if (val !== undefined) el.setAttribute('aria-label', val);
    }});
    document.documentElement.setAttribute('lang', locale === 'es' ? 'es' : 'en');
    // el viewer resuelve claves por viewerText(); hay que reinyectar su
    // diccionario o seguiria mostrando el idioma anterior
    var node = document.getElementById('archify-i18n-data');
    if (node) {{
      try {{
        var data = JSON.parse(node.textContent);
        data.locale = locale;
        data.messages = CATALOGS[locale] || {{}};
        node.textContent = JSON.stringify(data);
      }} catch (_) {{}}
    }}
    current = locale;
    if (label) label.textContent = locale.toUpperCase();
  }}
  if (btn) btn.addEventListener('click', function () {{
    var i = order.indexOf(current);
    apply(order[(i + 1) % order.length]);
  }});
  // Sacar el pasaporte semantico del contenedor del diagrama: el viewer lo
  // deja como position:absolute dentro de .diagram-container y tapa el dibujo.
  // Se mueve a .container apenas aparece, sin tocarlo cuando se reimprime.
  var lens = document.querySelector('.relationship-lens');
  var host = document.querySelector('.container');
  if (lens && host && lens.parentElement !== host) {{
    host.appendChild(lens);
  }}
  apply(current);
}})();
</script>
"""
    shell = shell.replace("</body>", script + "</body>", 1)
    return shell


def i18n_left(shell: str) -> int:
    return len(re.findall(r"\{\{i18n:[a-zA-Z0-9_.:-]+\}\}", shell))


def strip_lang(attrs: str) -> str:
    """Quita el lang previo del tag <html> para no duplicarlo."""
    return re.sub(r'\s+lang="[^"]*"', "", attrs)


def localize(shell: str, title: str, subtitle: str, locale: str = "en") -> tuple[str, list[str]]:
    """Resuelve los {{i18n:*}} del viewer.

    Sin esto el template crudo muestra las claves tal cual ({{i18n:viewer.theme.dark}})
    porque el paso de interpolacion ocurre en `archify deliver`, no en el template.
    """
    if locale == "es":
        shell, missing = translate_template(shell, VIEWER_ES)
    else:
        shell, missing = localize_en(shell, locale), []

    shell = shell.replace("[PROJECT NAME] Architecture Diagram", html.escape(title))
    shell = shell.replace("[PROJECT NAME]", html.escape(title.split("—")[0].strip()))
    shell = shell.replace("[Subtitle description]", html.escape(subtitle))
    shell = shell.replace('data-preset="[VISUAL PRESET]"', 'data-preset="classic"')
    shell = re.sub(r'<html([^>]*)>', lambda m: f'<html{strip_lang(m.group(1))} lang="{locale}">', shell, count=1)
    shell = re.sub(r"<title>.*?</title>", f"<title>{html.escape(title)}</title>", shell, count=1)
    return shell, missing


def localize_with_switcher(
    shell: str,
    title: str,
    subtitle: str,
    locale: str,
    lang: str,
    cards: list[dict] | None,
    base: str = "UC1",
    feature: str = "",
) -> tuple[str, list[str]]:
    """Genera el HTML con markup data-i18n y el boton ES/EN en runtime.

    El idioma del viewer se hornea en build time. Para que un boton lo cambie
    sin regenerar, hay que marcar la clave ANTES de resolver el placeholder
    (si se resolviera primero, el texto seria plano y la clave se perderia).
    """
    catalogs = {}
    for path, code in ((VIEWER_ES, "es"), (VIEWER_EN, "en")):
        data = json.loads(path.read_text(encoding="utf-8"))
        catalogs[code] = {k: v for k, v in data.items() if not k.startswith("_")}

    marked = markup_i18n(shell)
    resolved, missing = translate_template(marked, catalogs[locale])

    short = html.escape(title.split("—")[0].strip())
    # el h1 lleva "Architecture" literal: se reemplaza ANTES del [PROJECT NAME]
    # generico, o ese ya lo consumio y este patron ya no matchea
    resolved = resolved.replace(f"<h1>[PROJECT NAME] Architecture</h1>", f"<h1>{short}</h1>")
    resolved = resolved.replace("[PROJECT NAME] Architecture Diagram", html.escape(title))
    resolved = resolved.replace("[PROJECT NAME]", short)
    resolved = resolved.replace("[Subtitle description]", html.escape(subtitle))
    # el subtitulo tambien debe seguir al switcher
    resolved = resolved.replace(
        f'<p class="subtitle">{html.escape(subtitle)}</p>',
        f'<p class="subtitle" data-i18n="content.subtitle">{html.escape(subtitle)}</p>',
    )
    resolved = resolved.replace('data-preset="[VISUAL PRESET]"', 'data-preset="classic"')
    resolved = re.sub(
        r"<html([^>]*)>",
        lambda m: f'<html{strip_lang(m.group(1))} lang="{locale}">',
        resolved,
        count=1,
    )
    resolved = re.sub(
        r"<title>.*?</title>", f"<title>{html.escape(title)}</title>", resolved, count=1
    )
    resolved = add_uml_css(resolved)
    content = content_keys(cards or default_cards(lang), title, subtitle, base, feature)
    for code, extra in content.items():
        catalogs.setdefault(code, {}).update(extra)
    # claves del diagrama: cada <text> de las elipses, por alias y linea
    for alias, options in UC_LABELS.items():
        for code, lines in options.items():
            for i, line in enumerate(lines):
                catalogs.setdefault(code, {})[f"uc.{alias}.{i}"] = line
    resolved = add_i18n_data_node(resolved, catalogs, locale)
    return add_language_switcher(resolved, catalogs), missing


def localize_en(shell: str, locale: str) -> str:
    """Delega en el catalogo del propio skill (solo en / zh-CN)."""
    if not I18N_MODULE.exists():
        return shell
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as tmp:
        tmp.write(shell)
        tmp_path = tmp.name

    script = f"""
import {{ localizeTemplate }} from '{I18N_MODULE}';
import {{ readFileSync, writeFileSync }} from 'node:fs';
// argv[0]=node argv[1]=script argv[2]=in argv[3]=out
const [inPath, outPath] = process.argv.slice(2);
writeFileSync(outPath, localizeTemplate(readFileSync(inPath, 'utf8'), '{locale}'));
"""
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False, encoding="utf-8") as ts:
        ts.write(script)
        script_path = ts.name

    out_path = tmp_path + ".out"
    try:
        proc = subprocess.run(
            ["node", script_path, tmp_path, out_path],
            capture_output=True,
            text=True,
            cwd=ARCHIFY_SKILL,
        )
        if proc.returncode != 0 or not Path(out_path).exists():
            sys.exit(f" localizeTemplate fallo: {proc.stderr[:300]}")
        shell = Path(out_path).read_text(encoding="utf-8")
    finally:
        for p in (tmp_path, script_path, out_path):
            Path(p).unlink(missing_ok=True)

    return shell


CARDS_ES = [
    {
        "dot": "blue",
        "title": "Lo que exige el escenario",
        "items": [
            "Comento, respondo en hilo, edito lo mío y borro lo mío",
            "El comentario se ancla a una sección o a una versión concreta",
            "Al aplicar el cambio, marco el comentario como resuelto",
        ],
    },
    {
        "dot": "amber",
        "title": "Compartido ≠ personal",
        "items": [
            "shared_comments: lo ve la banda que tiene acceso",
            "personal_annotations: solo yo, jamás se comparte",
            "No es un caso con permiso distinto: son dos tablas",
        ],
    },
    {
        "dot": "rose",
        "title": "Lo que decide el modelo",
        "items": [
            "parent_id anida las respuestas; null es la raíz del hilo",
            "resolved colapsa el hilo una vez aplicado el cambio",
            "deleted es lógico: el historial del comentario se conserva",
        ],
    },
]

CARDS_EN = [
    {
        "dot": "blue",
        "title": "What the scenario requires",
        "items": [
            "Comment, reply in a thread, edit mine and delete mine",
            "The comment anchors to a section or a specific version",
            "Once the change lands, mark the comment resolved",
        ],
    },
    {
        "dot": "amber",
        "title": "Shared is not personal",
        "items": [
            "shared_comments: visible to the band that has access",
            "personal_annotations: only me, never shared",
            "Not one case with a different permission: two tables",
        ],
    },
    {
        "dot": "rose",
        "title": "What the model decides",
        "items": [
            "parent_id nests replies; null is the thread root",
            "resolved collapses the thread once the change landed",
            "deleted is soft: the comment history is kept",
        ],
    },
]


def default_cards(lang: str) -> list[dict]:
    return CARDS_ES if lang == "es" else CARDS_EN


def content_keys(
    cards: list[dict], title: str, subtitle: str, base: str = "UC1", feature: str = ""
) -> dict[str, dict[str, str]]:
    """Claves del CONTENIDO (cards, titulo, subtitulo) por idioma.

    El switcher solo cambia lo que tiene data-i18n. Sin esto, las cards y el
    subtitulo quedan fijos en el idioma con que se genero el archivo.

    El subtitulo lleva el nombre del caso de uso (que cambia por idioma via
    UC_LABELS) mas la referencia al archivo .feature (fija). Antes iba como
    texto literal y no cambiaba al cambiar de idioma.
    """
    uc_name = {
        "es": " ".join(UC_LABELS[base]["es"][:2]),
        "en": " ".join(UC_LABELS[base]["en"][:2]),
    }

    def block(cards_: list[dict]) -> dict[str, str]:
        out: dict[str, str] = {}
        for i, card in enumerate(cards_, 1):
            out[f"content.card.{i}.title"] = card["title"]
            for j, item in enumerate(card["items"], 1):
                out[f"content.card.{i}.item.{j}"] = item
        return out

    return {
        "es": {
            "content.title": title,
            "content.subtitle": f"Escenario: {uc_name['es']} · {feature}",
            **block(CARDS_ES),
        },
        "en": {
            "content.title": title,
            "content.subtitle": f"Scenario: {uc_name['en']} · {feature}",
            **block(CARDS_EN),
        },
    }


def replace_cards_slot(shell: str, cards: list[dict] | None, lang: str = "en") -> str:
    """El template trae un slot de cards con contenido demo (Card Title 1..3).
    Se reemplaza por las notas reales del caso; con lista vacia se quita entero."""
    start = shell.find("<!-- ARCHIFY:CARDS_SLOT_START -->")
    end = shell.find("<!-- ARCHIFY:CARDS_SLOT_END -->")
    if start == -1 or end == -1:
        return shell
    cards = cards if cards is not None else default_cards(lang)
    if not cards:
        return shell[:start] + shell[end + len("<!-- ARCHIFY:CARDS_SLOT_END -->") :]

    rendered = ['<div class="cards">']
    for i, c in enumerate(cards, 1):
        rendered.append('      <div class="card">')
        rendered.append('        <div class="card-header">')
        rendered.append(f'          <div class="card-dot {c["dot"]}"></div>')
        rendered.append(
            f'          <h3 data-i18n="content.card.{i}.title">{html.escape(c["title"])}</h3>'
        )
        rendered.append("        </div>")
        rendered.append("        <ul>")
        for j, item in enumerate(c["items"], 1):
            rendered.append(
                f'          <li data-i18n="content.card.{i}.item.{j}">&bull; {html.escape(item)}</li>'
            )
        rendered.append("        </ul>")
        rendered.append("      </div>")
    rendered.append("    </div>")
    return shell[:start] + "\n    " + "\n    ".join(rendered) + "\n    " + shell[end:]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("puml", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE)
    ap.add_argument("--keep-svg", type=Path, help="ademas guarda el SVG crudo instrumentado")
    ap.add_argument("--title", default="CEMURM use case diagram")
    ap.add_argument("--subtitle", default="")
    ap.add_argument("--locale", default="en", choices=["en", "es", "zh-CN"])
    ap.add_argument("--lang", default="en", choices=["en", "es"], help="idioma del contenido, no del viewer")
    ap.add_argument(
        "--switcher",
        action="store_true",
        help="embebe el boton ES/EN que cambia el idioma en runtime",
    )
    ap.add_argument("--base", default="UC1", help="alias del caso base para el subtitulo")
    ap.add_argument("--feature", default="", help="referencia al .feature del escenario")
    ap.add_argument(
        "--cards",
        type=Path,
        help="JSON con las notas del caso; [] para quitar el slot de cards",
    )
    args = ap.parse_args()
    cards = json.loads(args.cards.read_text()) if args.cards else None

    if not args.template.exists():
        sys.exit(f" No existe el template del viewer: {args.template}")

    svg = semanticize_colors(render_puml(args.puml))
    svg = drop_text_length(svg)
    svg = set_font(svg)
    svg = stamp(svg)
    svg, diagram_keys, diag_missing = mark_diagram_text(svg, args.lang)
    if diag_missing:
        print(f" AVISO  lineas de diagrama descuadradas: {diag_missing}")
    if args.keep_svg:
        args.keep_svg.write_text(svg)

    shell = args.template.read_text()
    # El viewer busca el svg del diagrama: se inserta el nuestro en su lugar.
    if "<svg" not in shell:
        sys.exit(" El template no contiene un <svg> donde insertar el diagrama.")
    shell = re.sub(
        r"<svg[^>]*>.*?</svg>",
        lambda m: svg,
        shell,
        count=1,
        flags=re.S,
    )
    shell, missing = (
        localize_with_switcher(shell, args.title, args.subtitle, args.locale, args.lang, cards, args.base, args.feature)
        if args.switcher
        else localize(shell, args.title, args.subtitle, args.locale)
    )
    shell = replace_cards_slot(shell, cards, args.lang)
    args.out.write_text(shell)

    nodes = len(re.findall(r"data-node-id=", shell))
    edges = len(re.findall(r"data-edge-from=", shell))
    print(f" OK  {args.out}")
    print(f"     locale               : {args.locale}")
    print(f"     nodos instrumentados : {nodes}")
    print(f"     relaciones           : {edges}")
    print(f"     placeholders i18n    : {i18n_left(shell)}")
    if missing:
        print(f"     SIN TRADUCIR ({len(missing)}): {', '.join(sorted(set(missing))[:8])}")


if __name__ == "__main__":
    main()