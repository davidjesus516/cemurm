## Decisions Pending Team Discussion — Pre-PR Blockers

These three product/architecture decisions must be resolved with the team before any PR is opened that depends on org_memberships write paths or the institutional amplification scope.

---

### D1: Consentimiento de menores
- **Qué:** Política/implementación para manejar consentimiento cuando el usuario es menor de edad
- **Por qué bloquea:** C1 (identidad y organización) es el hito 1; cualquier flujo de onboarding/registro que involucre menores necesita esta decisión definida
- **Contexto:** Ya apareció en el Judgment Day como hallazgo a investigar; forma parte de las 6 sospechas S-01..S-06 pendientes

### D2: Quién matricula (papa/mama/alumno)
- **Qué:** Modelo de quién tiene autoridad para inscribir a un estudiante en una organización/curso
- **Opciones típicas:**
  - Solo el propio alumno (auto-registro)
  - Padre/tutor con autorización
  - Administrador/organización que da de alta
- **Por qué bloquea:** Define el modelo de RLS y las políticas sobre `org_memberships` y `education_enrollments`; sin esto, el DDL y las políticas quedan en suspenso

### D4: Bandas = organización o entidad?
- **Qué:** ¿Si una "banda" es modelada como una `organization` o como un `entity` (distinto concepto)?
- **Ratio valor/esfuerzo:** Alto — definir esto reestructura cómo `org_memberships`, `org_repertoire`, y los flujos de promoción/democión funcionan
- **Contexto:** El Judgment Day confirmó que `org_memberships` tiene un camino de escritura (`private.org_leave` = auto-baja), pero nada sobre alta de bandas o cambio de rol. La decisión afecta si `org` es el contenedor único o si hay un modelo híbrido.

---

### Estado actual
- ✅ Trabajo técnico (DDL, RLS, wireframes, diagramas) validado y corregido en Judgment Day
- ✅ 18 hallazgos severos corregidos y verificados independientemente
- ⏳ Tres decisiones pendientes de discusión con el equipo
- ⏳ Bloquean la apertura de PRs que toquen org_memberships o los modelos de organización
- 📋 Documentado en: `odd/tasks/decisions-pending-team-discussion.md`

### Próximo paso
Abrir un espacio en la próxima reunión de ingeniería o async para decidir D1, D2 y D4. Una vez resueltas, se pueden abrir los PRs del hito 7 (BDD identidad/roles) y continuar con hitos 8-9.

### Referencia cruzada
- `odd/tasks/judgment-day-ampliacion-r1.md` — ledger completo con todos los hallazgos
- `docs/roadmap-ampliacion.md` — hoja de ruta por hitos 7-9
- `docs/propuestas/cemurm-ampliacion-alcance-11-modulos.md` — matriz 5x11 de requerimientos