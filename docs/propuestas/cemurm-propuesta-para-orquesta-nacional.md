# CEMURM — Propuesta para el sistema de orquesta nacional

**Versión:** 1.0 (borrador para revisión)
**Fecha:** 14 de agosto de 2026
**Audiencia:** Sistema de orquesta nacional (potencial cliente/colaborador)
**Propósito:** Presentar el proyecto, mostrar cómo CEMURM puede servir a un sistema de orquestas con varias agrupaciones y sedes, y recoger su perspectiva de dominio para que el producto responda a la realidad orquestal.

---

## 1. Qué es CEMURM

CEMURM (Community-Centered Musical Repertories Manager) es una aplicación web progresiva (PWA) para que músicos y organizaciones musicales gestionen su repertorio, planifiquen presentaciones y colaboren — desde el celular, la tablet o la laptop, **con o sin conexión a internet**.

Es un **cuaderno de partituras digital** que no depende de Wi-Fi: las salas de ensayo y los auditorios no siempre tienen buena conexión, y CEMURM fue diseñada para ese escenario.

**Estado del proyecto:** estamos en fase de especificación avanzada (42 archivos de features, 656 escenarios de comportamiento, esquema de base de datos de 44 entidades en `docs/database-schema-v2.md`, diseño técnico completo). Buscamos colaboradores como el sistema de orquestas para validar el producto antes de construir, no después.

---

## 2. Por qué el sistema de orquestas nos interesa

El modelo de datos de CEMURM fue diseñado desde el inicio para una estructura jerárquica como la de un sistema de orquestas: **sistema → organizaciones → agrupaciones/sedes → usuarios**. Los escenarios de prueba del proyecto ya citan explícitamente el "Sistema Nacional de Orquestas" como caso de uso.

Su conocimiento del mundo orquestal es invaluable para responder preguntas que ningún documento externo puede resolver:

- ¿Cómo se coordina el repertorio entre orquestas de distinto nivel (sinfónica, juvenil, infantil)?
- ¿Cómo se planifican los conciertos y giras con varias agrupaciones?
- ¿Cómo se cubren las ausencias de músicos (sustituciones) entre orquestas?
- ¿Qué necesitan los directores y los jefes de fila (concertinos) para dirigir ensayos eficientes?
- ¿Qué rol cumple la partitura oficial frente a las versiones personales de cada músico?

---

## 3. Funcionalidades relevantes para un sistema de orquestas

### 3.1 Modelo organizacional jerárquico
- **Catálogo de repertorio a tres niveles:** sistema → organización → agrupación/sede, con roles y permisos por rama.
- **Promover/demover canciones** entre niveles: una obra puede subir de una orquesta regional al repertorio nacional, o bajar de vuelta.
- **Transferencia de repertorio:** si una organización se disuelve, su repertorio puede transferirse a otra sin perder historia.
- **Acceso controlado por rama:** cada orquesta ve solo lo que le corresponde.

### 3.2 Planificación de conciertos (servicios/eventos)
- Estructura de eventos por **bloques ordenados** con presupuesto de tiempo y detección de sobre-ocupación.
- **Asignación de músicos a bloques** con detección de solapamientos (nadie en dos ensayos a la vez).
- **Hoja de llamada** con claves acordadas por pieza.
- **Check-in** el día del evento.
- **Registro histórico** de eventos completados (solo lectura) — trazabilidad institucional.
- Eventos **colaborativos entre organizaciones**, con matriz de visibilidad: un concierto conjunto donde cada orquesta ve y aporta su parte, sin exponer el resto.

### 3.3 Sustituciones y cobertura
- Solicitudes de sustituto para un concierto o ensayo.
- **Proyección de material** para el sustituto: el sistema reúne las piezas, tonalidades y anotaciones que el músico entrante necesita.
- **Estado de cobertura por bloque:** el director sabe en tiempo real si cada sección está cubierta.
- **Colaboración entre orquestas:** un músico de otra agrupación del sistema puede cubrir sin perder sus permisos.

### 3.4 Modo en vivo (escenario)
- Vista de pantalla completa de **alto contraste** para leer partituras/charts en el escenario sin papel.
- **Transposición en tiempo real** (+/− semitonos) para solistas o adaptaciones de último momento.
- Control de tempo con **auto-scroll**.
- Navegación por swipe, teclado o **pedal USB**.
- **100% offline** — los escenarios no tienen Wi-Fi.
- Registro post-concierto de las obras tocadas (útil para programación y reportes).

### 3.5 Repertorio y material
- Canciones/piezas en múltiples formatos: ChordPro (letra + acordes), **MusicXML** (partituras, vía OpenSheetMusicDisplay), ABC, y PDF como respaldo de partituras escaneadas.
- **Ciclo de vida de piezas:** borrador → listo → retirada → eliminada, con historial de versiones y rollback.
- **Modelo "partitura canónica vs. renderizado personal":** la versión oficial de la obra es la fuente de verdad; cada músico puede tener su transposición, capo o anotaciones personales sin pisar la versión oficial. (Un punto que creemos muy relevante para el mundo orquestal.)
- Búsqueda por título, artista, etiquetas, y también por **progresión armónica**.

### 3.6 Teoría musical para músicos avanzados
El proyecto incluye un modelo de teoría musical diseñado con criterio profesional:
- **Escalas** (mayor, menores, pentatónicas, cromática, **modos griegos**, escalas exóticas como la frigia dominante/española) como catálogo de datos.
- **Grados romanos (I–IV–V)** con calidad derivada de la escala — correcto en armonía modal (por ejemplo, E7 como "I" en frigio dominante), sin reglas diatónicas asumidas.
- **Modulación por secciones:** cada sección de una obra puede tener su propio contexto de tonalidad.
- **Spelling enarmónico** correcto (F# vs Gb según la armadura).
- El acorde concreto siempre es la fuente de verdad; el grado es una vista derivada.

### 3.7 Privacidad, derecho de autor y costo
- **Respeto del material con derechos:** el sistema no permite scraping de sitios de terceros; la biblioteca pública se nutre de contribuciones con licencia confirmada — por defecto **CC-BY-4.0** — almacenadas en la entidad `public_songs`, además de dominio público verificado (IMSLP, etc.). El contenido institucional privado permanece privado.
- **Offline por diseño** y sin consumo de datos para los músicos.
- **Costo de beta: $0** durante la fase beta.
- Accesibilidad: meta de conformidad **WCAG 2.1 AA** en la beta pública.

---

## 4. Lo que proponemos como colaboración

1. **Ronda de insights ahora** (sección 5): validar el modelo organizacional y de planificación con expertos del sistema, antes de implementar.
2. **Piloto temprano:** acceso anticipado a la beta para una orquesta o agrupación piloto (primer hito disponible ~2 meses desde el inicio de implementación).
3. **Co-diseño del módulo orquestal:** sesiones con directores, jefes de fila y gestión institucional para ajustar los escenarios BDD a la realidad local (hoja de llamada, sustituciones, eventos colaborativos).
4. **Contenido:** orientación sobre qué repertorio de dominio público (IMSLP, etc.) sería valioso como semilla de la biblioteca.

---


## 5. Preguntas para su insight

Nos ayudaría enormemente que respondan las que puedan, así sea brevemente:

1. **Estructura y roles:** ¿Cómo está organizado el sistema hoy (niveles, agrupaciones, sedes)? ¿Quién tiene autoridad para promover/reincorporar obras al repertorio nacional?
2. **Repertorio:** ¿Cómo se gestiona hoy el repertorio compartido? ¿Cada orquesta guarda su propia biblioteca? ¿Hay un catálogo central?
3. **Planificación de conciertos:** ¿Cómo se arma un programa hoy? ¿Qué información necesita la hoja de llamada en su contexto (claves, ensayos previos, refuerzos)?
4. **Sustituciones:** ¿Cómo se cubren las ausencias? ¿Existen listas de músicos disponibles entre orquestas? ¿Qué información necesita un sustituto con poca anticipación?
5. **Partituras:** ¿Qué formatos manejan (partitura completa, partes individuales, atril)? ¿Cómo usan las anotaciones personales (lápiz, digital)? ¿Les serviría el modelo "versión oficial + renderizado personal"?
6. **Eventos colaborativos:** ¿Organizan conciertos conjuntos entre orquestas del sistema? ¿Cómo coordinan repertorio y ensayos entre agrupaciones?
7. **Tecnología y conectividad:** ¿Qué dispositivos usan los músicos en ensayos y conciertos? ¿Qué nivel de conectividad hay en las salas?
8. **Restricciones:** ¿Qué requisitos institucionales hay (políticas de datos, aprobaciones, transparencia)? ¿Qué software usan hoy y qué les frustra?

---

## 6. Próximos pasos

1. Nos envían su feedback (sección 5) en el formato que prefieran.
2. Con su respuesta, ajustamos los requerimientos de los módulos orquestales (organizacional, planificación, sustituciones, colaboración inter-organizacional).
3. Los invitamos al piloto con una agrupación cuando esten listos los primeros avances.

**Contacto:** [completar]

---

*Documento generado a partir de la especificación del proyecto (42 features BDD, 656 escenarios; esquema de base de datos: `docs/database-schema-v2.md`) — disponible para consulta si lo desean.*
