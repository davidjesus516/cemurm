# CEMURM — Propuesta para academia de música

**Versión:** 1.0 (borrador para revisión)
**Fecha:** 14 de agosto de 2026
**Audiencia:** Academia de música (potencial cliente/colaborador)
**Propósito:** Presentar el proyecto, mostrar cómo CEMURM puede servir a una academia y recoger su perspectiva para que el producto responda a las necesidades reales de la enseñanza musical.

---

## 1. Qué es CEMURM

CEMURM (Community-Centered Musical Repertories Manager) es una aplicación web progresiva (PWA) para que músicos, docentes y organizaciones musicales gestionen su repertorio de canciones, construyan programas de concierto y colaboren — desde el celular, la tablet o la laptop, **con o sin conexión a internet**.

Imagínela como un **cuaderno de partituras digital** que no depende de Wi-Fi: las salas de ensayo, los auditorios y las aulas no siempre tienen buena conexión, y CEMURM fue diseñada para ese escenario.

**Estado del proyecto:** estamos en fase de especificación avanzada. Tenemos 42 archivos de features con 656 escenarios de comportamiento (Gherkin), un esquema de base de datos con 44 entidades normalizadas (`docs/database-schema-v2.md`) y el diseño técnico completo. Buscamos socios como su academia para validar el producto antes de construir, no después.

---

## 2. Por qué su academia nos interesa

Queremos que CEMURM sea útil para la enseñanza musical real, no solo para músicos profesionales. Su perspectiva como academia es clave para responder preguntas que los documentos actuales no resuelven:

- ¿Cómo trabaja un docente hoy con el repertorio de sus alumnos?
- ¿Qué necesita una academia con **varias sedes** para mantener un repertorio unificado?
- ¿Cómo se prepara un recital o una audición con varios profesores y grupos?
- ¿Qué datos de progreso le sirven a un docente (dificultad, tonalidad, tempo, anotaciones)?
- ¿Qué restricciones hay al trabajar con **alumnos menores de edad** (privacidad, consentimiento)? (Ver `features/minors-and-guardian-consent.feature` para los escenarios actuales.)

---

## 3. Funcionalidades relevantes para una academia

### 3.1 Repertorio y organización multi-sede
CEMURM modela una organización musical de forma jerárquica: **organización → sedes → usuarios**, con roles y permisos por rama. Esto está diseñado para academias con sucursales: el repertorio puede compartirse entre sedes o mantenerse privado por sede. Los propios escenarios de prueba del proyecto ya citan ejemplos como una academia con sedes en Madrid, Lima y Bogotá.

### 3.2 Gestión de canciones y material de estudio
- Crear y organizar canciones con letra y acordes (formato ChordPro, ampliamente usado en educación musical).
- Etiquetar por **dificultad, temática, género** — ideal para estructurar material por nivel de alumno.
- Transposición con un toque: adaptar una canción a la tonalidad cómoda para la voz del estudiante.
- Capo visualizado: "Capo 2 · suena D" — un apoyo enorme para alumnos que aún no transponen mentalmente.
- Notación musical: soporte para partituras en MusicXML y ABC, además de PDF como respaldo de partituras escaneadas.

### 3.3 Modelo de teoría musical (útil para clases)
El proyecto incluye un modelo de teoría musical orientado a la enseñanza:
- **Escalas** (mayor, menores natural/armónica/melódica, pentatónicas, cromática, modos griegos y escalas exóticas) almacenadas como datos — el sistema nunca "adivina" la tonalidad: el músico declara, el sistema sugiere.
- **Grados romanos (I–IV–V)**: una canción escrita como "G — C — D" se puede ver como "I — IV — V", lo que ayuda a enseñar armonía y transporte a cualquier tonalidad.
- **Progresiones** conocidas (ii–V–I, blues de 12 compases, cadencia andaluza) como referencia.
- **Sugerencia de tonalidad por rango vocal**: si se anota la melodía, el sistema sugiere "prueba en A" cuando la tonalidad queda demasiado alta o baja.

### 3.4 Ensayos y presentaciones
- **Setlists para recitales**: armar el programa, reordenarlo, calcular duración total, agregar notas por pieza ("solo de piano en la 2ª estrofa").
- **Modo ensayo (rehearsal workflow)**: registro de sesiones, piezas trabajadas, próximos pasos.
- **Modo en vivo**: vista de pantalla completa de alto contraste para tocar sin hojas de papel, con transposición en vivo y control de tempo (auto-scroll).
- **Exportación**: PDF, ChordPro, MusicXML, ABC — el material viaja con el alumno a cualquier otro sistema.

### 3.5 Colaboración
- Compartir setlists entre docentes y alumnos con sincronización en tiempo real.
- Comentarios y anotaciones sobre piezas.
- Colaboración entre organizaciones: por ejemplo, un recital conjunto entre su academia y otra entidad.

### 3.6 Privacidad y costo
- **Offline por diseño**: los alumnos usan la app sin consumir datos ni depender de conexión.
- **Costo de beta: $0** — durante la fase beta las funciones básicas son gratuitas (nuestro modelo prevé funciones gratuitas como base).
- Privacidad pensada para menores: control de permisos por usuario y organización.

---

## 4. Lo que proponemos como colaboración

1. **Piloto temprano:** acceso anticipado a la beta (primer hito disponible ~2 meses desde el inicio de implementación) a cambio de pruebas reales en el aula.
2. **Ronda de insights:** nos interesa su opinión estructurada ahora, antes de escribir código (sección 6).
3. **Contenido:** si lo desean, aportar repertorio de material educativo de dominio público para la biblioteca compartida (con atribución correcta).
4. **Co-diseño:** sesiones cortas con docentes para ajustar funciones de enseñanza (dificultad, progreso, rango vocal).

---


## 5. Preguntas para su insight

Nos ayudaría enormemente que respondan las que puedan, así sea brevemente:

1. **Flujo docente:** ¿Cómo preparan hoy el material de un trimestre? ¿Dónde pierden más tiempo (buscar canciones, transponer, imprimir, mantener versiones)?
2. **Multi-sede:** Si tienen varias sedes, ¿cómo comparten (o no) el repertorio entre ellas hoy? ¿Quién decide qué se comparte?
3. **Alumnos:** ¿Qué rango de edades y niveles atienden? ¿Qué funciones usaría un alumno frente a un docente?
4. **Teoría musical:** ¿Usarían la vista de grados (I–IV–V) y el catálogo de escalas en clase? ¿Qué falta para que sea útil pedagógicamente?
5. **Evaluación/progreso:** ¿Qué les gustaría registrar sobre el avance de un alumno en una pieza (versiones, anotaciones, dificultad)?
6. **Tecnología:** ¿Qué dispositivos usan los docentes y alumnos (celular/tablet/laptop)? ¿Qué nivel de conectividad hay en las aulas?
7. **Restricciones:** ¿Qué requisitos legales o institucionales hay al usar software con menores (consentimiento, datos personales)?
8. **Lo que falta:** ¿Qué herramienta usan hoy y qué les frustra de ella? ¿Qué les haría cambiar?

---

## 6. Próximos pasos

1. Nos envían su feedback (sección 6) en el formato que prefieran.
2. Con su respuesta, ajustamos los requerimientos de los módulos de academia (multi-sede, dificultad, progreso).
3. Los invitamos al piloto cuando el hito 1 esté listo.

**Contacto:** [completar]

---

*Documento generado a partir de la especificación del proyecto (42 features BDD, 656 escenarios; esquema de base de datos: `docs/database-schema-v2.md`) — disponible para consulta si lo desean.*
