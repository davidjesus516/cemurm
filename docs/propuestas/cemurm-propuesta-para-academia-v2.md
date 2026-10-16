# CEMURM — Propuesta para academia de música

**Versión:** 2.0 (respuesta a su propuesta de requisitos)
**Fecha:** 13 de octubre de 2026
**Audiencia:** Academia de música (socio colaborador)
**Propósito:** Responder las ocho preguntas que dejamos abiertas en la versión 1.0, y presentar el alcance ampliado que ustedes propusieron con el estado real de cada módulo —lo que ya funciona hoy, lo que está construido pero sin conectar, y lo que hay que construir desde cero.

> Esta versión reemplaza a la del 14 de agosto de 2026. Aquella decía que estábamos "en fase de especificación avanzada, sin implementación real". **Eso ya no es cierto**, y repetirlo les daría una imagen equivocada de dónde estamos.

---

## 1. Qué es CEMURM hoy

CEMURM (Community-Centered Musical Repertories Manager) es una aplicación web progresiva (PWA) para gestionar repertorio, construir escaletas y colaborar — desde el celular, la tablet o la laptop, **con o sin conexión a internet**. Es un **cuaderno de partituras digital** que no depende del Wi-Fi.

**Estado real al 13 de octubre de 2026:**

| Elemento | Estado |
|---|---|
| Especificación de comportamiento | **45 archivos, 713 escenarios** en Gherkin — es la fuente de verdad del producto |
| Base de datos | **34 migraciones** sobre PostgreSQL con seguridad a nivel de fila (RLS) en todas las tablas |
| Aplicación | **En producción local**, cinco hitos entregados: núcleo y autenticación, modo escenario, colaboración, biblioteca pública, integraciones |
| Habilidades en vivo | Transposición en tiempo real, navegación por pantalla táctil, teclado o **pedal USB**, vista de alto contraste, **funciona sin conexión** |
| Recuento de pruebas | Suite automatizada en integración continua. La capa de navegador (Playwright, Chromium/Firefox/WebKit) **arranca la base de datos local real con RLS activa**, pero hoy contiene **un solo archivo de pruebas, con 18 casos**, y los 18 comprueban la estructura de los fixtures y sus constantes: ninguno abre una página ni consulta la base a través de RLS. **Cero escenarios de navegador real contra la base de datos por ahora.** |

Lo que **no** ha ocurrido todavía es la beta pública. Hay seis grupos de trabajo de acabado pendientes, y ahí es donde su propuesta se inserta.

---

## 2. Sus ocho preguntas, respondidas

### 2.1 Flujo docente: cómo preparan hoy el material de un trimestre

El repositorio tiene hoy el **modo práctica**: una vista de estudio con transposición instantánea, para probar una tonalidad antes de tocar. Falta lo que ustedes describen como el cuello de botella real: **asignar trabajo a un alumno concreto y ver quién lo terminó.** Es el requerimiento 8 de su lista, y es exactamente lo que vamos a construir (§3, *Formación y Pedagogía*).

### 2.2 Multi-sede: cómo comparten el repertorio entre sedes

**Ya está resuelto y construido.** El modelo es jerárquico: **organización → sedes → usuarios**, con roles y permisos por rama. Una sede puede tener su propio repertorio o compartir el de la organización, y la visibilidad se controla por rol — `org_owner`, `org_admin`, `branch_admin`, `instructor`, `member`. La aplicacion ya tiene la pantalla de organización multi-sede funcionando.

Lo que falta es el reverso de su pregunta: **quién puede cambiar los roles de los demás**. Hoy el sistema no permite modificar la pertenencia de nadie desde la aplicación — hay que hacerlo por base de datos. Lo corregimos como primer paso de la ampliación (§3, *Identidad*).

### 2.3 Alumnos: qué rango y niveles atienden, y qué usaría un alumno frente a un docente

No podemos responderlo con certeza, y preferimos decirlo a inventarlo. **Su respuesta define el diseño**, porque el avance de un alumno es un dato sensible y —si tienen menores de edad— el sistema **bloquea por defecto** el acceso de un menor sin consentimiento registrado de su tutor. Esa protección ya está implementada y no se va a relajar.

Lo que sí está decidido por nuestro lado: **un docente ve qué ejercicios terminó cada alumno y cuándo. No ve sus sesiones de práctica, ni sus duraciones, ni sus rachas, ni sus notas privadas.** Esa frontera está escrita en las especificaciones de comportamiento, no solo en el código.

### 2.4 Teoría musical: grados romanos y catálogo de escalas en clase

**Ya está construido.** El catálogo de escalas está modelado como datos — mayor, menores natural/armónica/melódica, pentatónicas, cromática, **modos griegos**, escalas exóticas como la frigia dominante. Los grados romanos (**I–IV–V**) se calculan con la calidad derivada de la escala, que es lo correcto en armonía modal: en frigia dominante, **E7 es el I**, y una regla diatónica ingenua lo diría mal.

También hay un modelo que nos parece especialmente útil para la enseñanza: **la partitura concreta es la fuente de verdad, el grado es una vista derivada.** El acorde siempre manda sobre la etiqueta. Y cada sección de una obra puede tener su propio contexto de tonalidad, lo que permite analizar una progresión distinto en el verso y en el puente.

### 2.5 Evaluación y progreso: qué registrar sobre el avance de un alumno

Esto es el requerimiento 9, y **ya lo especificamos antes de que ustedes lo pidieran**: hay **20 escenarios de comportamiento** escritos para el avance del estudiante. Cubren la ruta de aprendizaje con cuatro estados — *Pendiente*, *En progreso*, *Bloqueado*, *Completado*—, el desbloqueo secuencial, el registro de fechas de finalización, el historial de ejercicio y la racha de días activos.

Sobre su pregunta original —"¿qué les gustaría registrar sobre el avance de un alumno: versiones, anotaciones, dificultad?"— **sí, se puede, y ya es parte del diseño**: una canción puede etiquetarse por dificultad y temática, transponerse a la tonalidad cómoda para la voz del estudiante, mostrar el capo ("Capo 2 · suena D"), y llevar anotaciones sin pisar el material de la clase.

Lo que **no** está resuelto, y les pedimos ayuda, es el reverso: **qué nota, qué comentario y qué evaluación qualitative debería poder dejar un docente, y si esa nota es visible para el alumno, para el tutor, o solo para el docente.** Esa es una decisión de su institución, no nuestra.

### 2.6 Tecnología: dispositivos y conectividad en las aulas

**Offline es la decisión de diseño central, no una función agregada.** El alumno descarga el material en el dispositivo y funciona sin red; las ediciones hechas sin conexión se sincronizan al reconectar. Las salas de ensayo y los escenarios no tienen Wi-Fi, y el producto no puede depender de que lo tengan.

Punto honesto: la aplicación **no ha sido probada todavía en un aula real**. Eso es parte de lo que un piloto inicial significaría para nosotros.

### 2.7 Restricciones: requisitos legales con menores

**Es la decisión que más nos importa y la única que bloquea el camino.** El sistema tiene hoy un registro de consentimiento de tutor con **un solo permiso**: autorización de publicación pública. No existe ningún registro que cubra **que un docente consulte el avance académico de un alumno**.

Si sus alumnos son menores, **no podemos construir la función de seguimiento académico sin resolver esto primero.** No es un detalle técnico: es la diferencia entre una herramienta pedagogical legítima y un problema legal. Proponemos agregar un consentimiento **versionado por finalidad**, donde quede registrado exactamente qué accede el docente y con qué motivo. Y les pedimos su criterio sobre qué exemption legal aplica en su jurisdicción.

### 2.8 Lo que falta: qué herramienta usan hoy y qué les frustra

Aquíyadamos la palabra. Jotamos la lista de 11 requerimientos que nos hicieron llegar: gestión de usuarios y roles, reportes, eventos, asistentes, escaleta, repertorio, bandas, actividades, seguimiento, inventario y préstamos. **Nos pasó lo mismo que a ustedes**: la lista crece mucho más rápido que el producto.

Por eso, en lugar de decirles "sí, todo eso", preferimos decirles **dónde está cada cosa hoy** (§3). Dos módulos están completos, tres están construidos pero sin conectar, uno tiene una decisión de diseño pendiente, y cinco hay que construirlos — dos de ellos desde cero, sin una sola línea de base de datos.

---

## 3. El alcance ampliado, con estado real

Organizamos los once requerimientos en las cuatro áreas de su árbol. Para cada módulo: **estado** y **qué falta**.

### 🔵 Eventos y Conciertos — lo que ya está construido

| Requerimiento | Estado | Qué falta |
|---|---|---|
| **Gestión de eventos** | **Construido, sin conectar** | El modelo de datos existe completo: evento, participantes de cada organización, escaleta del evento con visibilidad por organización, y lugares. El sistema de seguridad por fila ya está escrito y probado. Falta la pantalla. |
| **Gestión de asistentes** | **Construido, sin conectar** | Cada miembro responde **sí / no / sin decidir** a un evento, con fecha de respuesta y la garantía de que nadie responde dos veces. Falta la pantalla y las especificaciones de comportamiento. |

Detalle de diseño que nos gusta y queremos destacar: **una escaleta pertenece al evento, no a una organización**. Cuando un concierto conjunto termina, todas las organizaciones participantes la conservan en modo solo lectura. Nadie puede reescribir la historia de lo que se tocó. Esta decisión ya está tomada y documentada.

### 🟢 Repertorio Digital — completo

| Requerimiento | Estado |
|---|---|
| **Gestión de escaleta** | **Completo.** Armar el programa, reordenarlo, agregar notas por pieza, compartirlo con la banda en tiempo real, y usarlo en modo escenario a pantalla completa |
| **Gestión de repertorio musical** | **Completo.** Catálogo centralizado con ChordPro, MusicXML, ABC y PDF; historial de versiones con reversión; etiquetado por género, temática y dificultad; archivos privados con enlaces temporales que expiran |

### 🟡 Formación y Pedagogía — especificado, pendiente de una decisión legal

| Requerimiento | Estado |
|---|---|
| **Gestión de actividades** | **46 escenarios de comportamiento ya escritos** en los tres archivos de formación (13 de cursos y ejercicios + 20 de seguimiento + 13 de asignación docente). Cursos, ejercicios ordenados, ejercicios que apuntan a una canción real y a una sección concreta de esa canción, asignación de trabajo a alumnos |
| **Gestión de seguimiento** | **20 escenarios ya escritos.** Ruta de aprendizaje con cuatro estados, desbloqueo secuencial, historial, XP como registro de eventos, rachas de días activos |

**Dos cosas que debemos resolver antes de construir:**

1. **El consentimiento de menores** (§2.7). Bloqueante.
2. **Quién matricula a un alumno y qué puede ver un administrador.** Nuestra posición: el administrador de la organización matricula; el docente ve **qué se completó y cuándo**, y nada más. Si ustedes necesitan que un docente vea también las notas privadas de sus alumnos, díganos — es una decisión de ustedes, no nuestra.

### 🔴 Inventario y Equipos — desde cero

| Requerimiento | Estado |
|---|---|
| **Gestión de inventario** | **No existe.** Ni tabla, ni pantallas, ni especificaciones. Hay que diseñarlo |
| **Gestión de préstamos y asignaciones** | **No existe.** Ídem |

Diseño que proponemos, y que necesitan su visto bueno:

- **Catálogo de tipos de equipo** (guitarra, amplificador, pedal, atril, micrófono, batería), con los **detalles técnicos** como campos configurables por tipo — marca, modelo, año, especificaciones.
- **Activos individuales** con etiqueta, número de serie, sede, y estado: *disponible*, *prestado*, *en mantenimiento*, *retirado*.
- **Préstamos** con persona que lo lleva, quién lo autorizó, fecha de salida, fecha límite, **vinculación directa al evento donde se va a usar**, y **estado del equipo al devolverlo**. El último punto no es cosmético: es lo que permite decir "se prestó roto" como hallazgo y no como recuerdo.
- **Un equipo no puede estar prestado dos veces.** Regla de base de datos, no de interfaz.

La pregunta abierta: **¿el inventario es por sede o compartido entre toda su organización?** Si cada sede tiene su propio equipo, es por sede. Si el equipo circula entre sedes, necesitamos un modelo de permisos distinto al que tenemos hoy.

### ⚪ Gestión de usuarios y roles — el bloqueo foundational

| Requerimiento | Estado |
|---|---|
| **Gestión de usuarios y roles** | **Parcial.** Existen los usuarios, la autenticación, los roles de organización y de sede, y el registro de pertenencia con estado (activo / anterior / pendiente). **Pero el registro de pertenencia solo se puede leer, con una única excepción:** el propio usuario puede abandonar una organización desde la pantalla de organización. **No se puede unir nadie a una organización, ni cambiar el rol de nadie, ni dar de baja a terceros desde la aplicación** — eso sigue siendo trabajo de base de datos |

**Este módulo tiene que ir primero, y no es una prioridad nuestra: es una dependencia técnica.** Los eventos, las bandas, los cursos y las matrículas **no se pueden construir encima** de una pertenencia a la organización que el cliente no puede escribir. Es la bisagra de la ampliación.

También significa que crearemos la **primera función de administración de cuentas** del sistema, que es un tipo de componente que hoy no tenemos.

### ⚪ Bandas — decisión de diseño abierta

Ustedes piden crear, modificar y eliminar bandas musicales, con asignación de eventos y repertorios. Hoy el sistema tiene:

- **Organizaciones y sedes**, con roles, permisos y repertorio por rama — el contenedor institucional completo.
- **Vínculos entre compañeros** (`bandmate_links`), que son relaciones **entre pares** de usuarios, no una entidad de banda.

Nuestra recomendación: **no crear una entidad nueva de "banda".** Usar el modelo de organización que ya existe y funciona, con bandas como un tipo de organización. Una tabla nueva de bandas duplicaría lo que ya está construido.

**Pero si ustedes manejan bandas de manera muy distinta a como manejan una organización —por ejemplo, un músico que toca en tres bandas que no son de la misma institución—, díganos, porque eso cambiaría la recomendación.**

### ⚪ Reportes y análisis — reorientación necesaria

| Requerimiento | Estado |
|---|---|
| **Gestión de reportes y análisis** | **Especificado, pero con otro enfoque.** Los escenarios existentes miden analítica **personal**: qué canciones usa más cada músico, cómo crece su repertorio, cuántas horas practicó. Lo que ustedes piden son **reportes por módulo**, y eso es trabajo nuevo |

La buena noticia es que **la materia prima ya se registra**: el sistema anota **qué se tocó realmente** en cada concierto, pieza por pieza, incluyendo las que se saltaron. Sobre eso se construyen los reportes de cualquier módulo.

---

## 4. Lo que proponemos

1. **Responder las dos preguntas de la §2.3 y §2.7** — consentimientos y rango de edad. Sin la primera no podemos construir el seguimiento académico.
2. **Aclarar las cuatro decisiones de diseño** de la §3: inventario por sede o por organización, bandas como organización o entidad propia, qué ve un docente además del avance, y si el reporte es por módulo o por sede.
3. **Piloto en aula.** Acceso anticipado al camino de rehearsal y al modo escenario con su Instrumentation real, y con el flujo de alumnos que ustedes describan.
4. **Co-diseño del módulo de formación.** Sesiones con sus docentes para ajustar la ruta de aprendizaje a cómo se enseña realmente, y no a lo que supondríamos desde fuera.
5. **Contenido.** Si lo desean, aportar repertorio educativo de dominio público para la biblioteca compartida, con atribución correcta.

---

## 5. Próximos pasos

1. Nos envían su respuesta en el formato que prefieran — respuestas breves a las preguntas que puedan, con el resto marcado como pendiente.
2. Incorporamos sus respuestas al diseño y cerramos las cuatro decisiones abiertas de la §3.
3. Revisamos en conjunto **el estado real de cada módulo en la §3** y confirmamos si el alcance ampliado les sirve completo o si hay módulos que prefieren posponer. Preferimos decirlo con franqueza: prometer "sí a todo" y entregar la mitad sería peor que ajustar la lista ahora.
4. Los invitamos al piloto cuando el camino de alumnos esté en marcha.

**Contacto:** [completar]

---

*Documento actualizado a partir de la especificación del proyecto al 13 de octubre de 2026: 45 archivos de comportamiento (713 escenarios), 34 migraciones de base de datos, cinco hitos entregados. El detalle técnico completo de cada módulo —incluidos riesgos y decisiones pendientes— está en `docs/propuestas/cemurm-ampliacion-alcance-11-modulos.md`, disponible para consulta si lo desean.*