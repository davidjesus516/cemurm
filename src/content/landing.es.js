// Marketing copy for the landing surface.
//
// Every string a landing component renders resolves from this module, and the
// components hold no marketing literals of their own. A later slice adds
// `landing.en.js` plus a `useLocale()` hook; no i18n library, and no change
// to any app file. A `sections[].id` is the anchor target the header nav and
// the primary CTA link to, so an id is structure rather than copy and stays
// ASCII.
//
// VOCABULARY is reused exactly, never invented: repertorio, chart, chart
// canónico, renderizado personal, setlist, tono acordado, transposición, capo,
// sección, grado, readiness, anotación, colaborador, compañero, ensayo,
// concierto, registro, organización, sede, Stage Mode, Stage Bus.
//
// THREE RULES ARE LOAD-BEARING ENOUGH TO RESTATE HERE:
//
//   1. No tier, number or institutional proof point appears below. None is
//      verified yet, so the page makes no user-count, no customer and no
//      licence claim about code this page cannot show.
//   2. `servicio` never means a worship service. It is ambiguous for a church
//      audience, so this copy never uses `servicio` as the product verb; the
//      page names the live moment `concierto` and `culto` where the concept
//      needs a word.
//   3. `repertorio` is singular, and `Repertorios` belongs to the brand name
//      alone, so the brand string below is bare.
//
// VIDEO/ASSET PLACEHOLDERS: none of these files is real yet. Each component
// that references one accepts a src and renders a placeholder block until the
// real file is connected. Do not read these strings as asset paths that exist.

export const landing = {
  brand: 'CEMURM',

  // Rendered by the hero in L2. Kept here now so the structure is one file the
  // day a second locale exists, and it asserts nothing checkable.
  tagline: 'El cuaderno digital de música.',

  // Labels only: the href is built as `#${item.id}` by the header, so a nav
  // label can never point at a section that does not exist.
  nav: [
    { id: 'problema', label: 'El problema' },
    { id: 'stage-bus', label: 'Stage Bus' },
    { id: 'galeria', label: 'Galería' },
    { id: 'registro', label: 'Registrarme' },
  ],

  // A CTA says exactly what happens. Not "Enviar".
  cta: {
    label: 'Unirme a la lista de espera',
    href: '#registro',
  },

  // Intro loader: short label shown under the logo on the curtain.
  loader: {
    tag: 'CEMURM',
    note: 'El cuaderno digital de música.',
  },

  // ── HERO ──────────────────────────────────────────────────────────────────

  hero: {
    eyebrow: 'Stage Bus',
    title: 'Una canción, tres lecturas.',
    // Keep this one line when it fits; it is the value proposition, not a
    // feature list. When it wraps it wraps once and no further.
    subtitle:
      'El chart, la letra, el setlist, el ensayo y el registro de lo que ' +
      'realmente se tocó. El repertorio vive aquí y se actualiza desde aquí.',
    cta: {
      label: 'Unirme a la lista de espera',
      href: '#registro',
    },
    // The three projection views the hero rotates through. `label` is the tab
    // name, `blurb` is the one-line caption under the frame. Copy lives here
    // so the tab row never holds a literal.
    views: [
      {
        id: 'musicos',
        label: 'Músicos',
        blurb: 'Acordes sobre la letra, con tu tono.',
      },
      {
        id: 'publico',
        label: 'Público',
        blurb: 'La letra sin anotaciones, para emitir.',
      },
      {
        id: 'senal',
        label: 'Señal',
        blurb: 'Título y posición, sin letra ni anotaciones.',
      },
    ],
    // Caption that lives on the figure, not in the hero copy stack. Section
    // 8.2 forbids asserting a licence nobody has checked, and this is the
    // honest place for that claim: on the asset, next to the demo.
    caption: 'Demostración con datos de ejemplo, no una pieza real.',
  },

  // ── PROBLEMA ──────────────────────────────────────────────────────────────

  problema: {
    title: 'Una hoja no alcanza en el escenario.',
    body: [
      'Una hoja lleva un solo tono. En el setlist el tono acordado es uno y ' +
        'cada músico ve el chart canónico renderizado en el suyo, así que la ' +
        'misma pieza necesita una hoja distinta por mano. El setlist no: es el ' +
        'mismo elemento.',
      'La hoja tampoco sabe si está lista. El readiness se calcula por versión, ' +
        'y si faltan la letra, el coro o el tono acordado, el selector del ' +
        'setlist lo avisa antes de que alguien lo descubra en el escenario.',
      'Y una hoja no tiene historia. Cada cambio en un chart deja una versión ' +
        'con editor, fecha y qué cambió, y una sustitución personal se queda en ' +
        'tu dispositivo hasta que tú decides promoverla.',
    ],
  },

  // ── STAGE BUS ─────────────────────────────────────────────────────────────

  stageBus: {
    title: 'Stage Bus.',
    intro:
      'Stage Bus es una sola fuente (el chart canónico y el setlist) que ' +
      'alimenta varias vistas al mismo tiempo, cada una mostrando lo que esa ' +
      'persona necesita y nada más.',
    body:
      'Cada vista recorta lo que no le corresponde, y el recorte no es una ' +
      'copia: es el mismo chart, filtrado en el momento de emitirse. Y si ' +
      'cambia el chart, cambian las tres a la vez. No hay que reemitir nada, ' +
      'ni sincronizar una copia por pantalla.',
    privacy:
      'Lo que un músico escribe para sí mismo no sale de su pantalla. No es ' +
      'que lo escondamos: las vistas de emisión ni siquiera lo leen.',
    // The three projection views for this section. These share the same three
    // ids as the hero so a reader moving between them does not meet two
    // vocabularies for the same thing. The hero already states the concept;
    // this section states the idea and deliberately does NOT repeat the demo
    // frame.
    views: [
      {
        id: 'musicos',
        label: 'Músicos',
        blurb: 'Tu tono, tu capo, tu tempo, sin conexión si hace falta.',
      },
      {
        id: 'publico',
        label: 'Público',
        blurb: 'La letra y el título, sin acordes ni anotaciones.',
      },
      {
        id: 'senal',
        label: 'Señal',
        blurb: 'Lo que la sala ve, sin lo que el músico escribe para sí.',
      },
    ],
  },

  // ── GALERIA ───────────────────────────────────────────────────────────────

  galeria: {
    eyebrow: 'Galería',
    title: 'El repertorio en cada pantalla.',
    // Each item pairs a media src (video or image; both accepted, both
    // placeholder until you connect the real file) with a one-line label. The
    // component decides the layout; this module decides the copy.
    items: [
      {
        id: 'setlist-tablet',
        label: 'Setlist en la tablet del músico',
        type: 'video',
      },
      {
        id: 'vista-practica',
        label: 'Vista de práctica',
        type: 'video',
      },
      {
        id: 'vista-audiencia',
        label: 'Vista de audiencia',
        type: 'video',
      },
      {
        id: 'overlay-escenario',
        label: 'Overlay del escenario',
        type: 'video',
      },
      {
        id: 'slide-proyeccion',
        label: 'Slide de proyección',
        type: 'video',
      },
      {
        id: 'slide-titulo',
        label: 'Slide de título',
        type: 'image',
      },
    ],
    // The media discriminator is data (`video` / `image`); the label a visitor reads is
    // Spanish copy. Rendering `item.type` verbatim put English on a Spanish page six times.
    typeLabels: {
      video: 'Video',
      image: 'Imagen',
    },
    // One caption per media kind, shown under the expanded media. The exclamation mark is
    // part of the string: it was previously written in JSX text and lost its opening mark.
    captions: {
      video: '¡Video de la pantalla!',
      image: '¡Imagen de la pantalla!',
    },
  },

  // ── FEATURES ──────────────────────────────────────────────────────────────

  features: {
    title: 'Capacidades por rol.',
    // Bento copy. Each card is one concept, one headline, one line. No tier
    // billboards, no user counts.
    cards: [
      {
        id: 'chart-canonico',
        eyebrow: 'Modelo',
        title: 'El chart canónico y el renderizado personal.',
        body:
          'Un chart, muchas manos. El chart canónico es uno solo y el setlist ' +
          'fija el tono acordado para todos. Cada dispositivo lo renderiza en ' +
          'el suyo: la transposición y el capo son tuyos, y nadie necesita una ' +
          'copia propia.',
        icon: 'chart',
      },
      {
        id: 'roles',
        eyebrow: 'Rol',
        title: 'Quién hace qué.',
        body:
          'El director de sistema administra el repertorio del sistema. Quien ' +
          'arma el setlist dirige. El músico ve su parte en su tono. El ' +
          'instructor añade canciones a su sede.',
        icon: 'roles',
      },
      {
        id: 'sustitucion',
        eyebrow: 'Cobertura',
        title: 'Sustitución y cobertura.',
        body:
          'Si alguien falta, la parte se cubre con un compañero que la recibe ' +
          'en su propio tono. El plan no se toca y la cobertura queda ' +
          'registrada.',
        icon: 'coverage',
      },
      {
        id: 'proyeccion',
        eyebrow: 'Emisión',
        title: 'Proyección sin filtraciones.',
        body:
          'La proyección muestra la letra y el título de cada sección. Ni ' +
          'acordes, ni tonos, ni anotaciones personales, ni controles. Y lo que ' +
          'un músico escribe para sí mismo no sale de su pantalla.',
        icon: 'projection',
      },
      {
        id: 'offline',
        eyebrow: 'Offline',
        title: 'Offline y datos.',
        body:
          'En el escenario, sin conexión, Stage Mode funciona entero: recorres ' +
          'el setlist, la letra y los acordes se ven, y la transposición y el ' +
          'tempo siguen respondiendo. Lo que escribes sin conexión no se pierde: ' +
          'queda pendiente y se aplica al volver en el orden que lo hiciste.',
        icon: 'offline',
      },
      {
        id: 'historial',
        eyebrow: 'Registro',
        title: 'Historial de versiones.',
        body:
          'Y nada se pierde en silencio. Cada edición deja una versión con autor, ' +
          'fecha y qué cambió, se puede volver a una anterior, y el historial no ' +
          'se edita ni se borra.',
        icon: 'history',
      },
    ],
    // The ordered steps the animated list walks through. Each step is one
    // sentence; the list is the ordered version of the same story the bento
    // tells in cards.
    steps: [
      'Crea tu organización y aporta canciones al repertorio del sistema.',
      'Arma el setlist, fija el tono acordado y publica el plan del culto.',
      'Cada músico ve su parte en su tono, con su capo y su tempo.',
      'En el escenario, Stage Mode funciona sin conexión si hace falta.',
      'Al terminar, queda registro de lo que se tocó y de lo que no.',
    ],
  },

  // ── COMO-FUNCIONA ─────────────────────────────────────────────────────────

  comoFunciona: {
    title: 'Desde el repertorio hasta el escenario.',
    body:
      'El repertorio se arma una vez y se actualiza desde aquí. El setlist fija ' +
      'el tono acordado para todos, y cada dispositivo lo renderiza en el suyo. ' +
      'Al terminar el concierto queda registro de lo que se tocó.',
  },

  // ── REGISTRO ──────────────────────────────────────────────────────────────

  registro: {
    eyebrow: 'Registrarme',
    title: 'Unirme a la lista de espera.',
    subtitle:
      'CEMURM está en beta. El acceso se abre por lista de espera.',
    input: {
      label: 'Tu correo electrónico',
      placeholder: 'tu@email.com',
      button: 'Unirme',
      // Feedback strings for the form, not for the button. This one is deliberately
      // honest: there is no waitlist endpoint behind this page (blocker B1), so the
      // handler can only validate the address locally. Saying "we added you" would
      // promise something the app does not do, which §8.3 forbids for any CTA or
      // confirmation the visitor reads.
      success: 'Correo validado. No se envió nada: este formulario no está conectado.',
      // THE ERROR STRING SAYS WHAT THE CODE DOES, WHICH IS CHECK AN ADDRESS, NOT
      // REACH A SYSTEM. The only condition behind this message is
      // `!email || !email.includes('@')` in Registro.jsx and CtaFinal.jsx: nothing is
      // sent, so nothing can fail in transit. "Algo salió mal. Intenta de nuevo."
      // reported a system or network failure that did not happen, and told the visitor
      // to retry a request that was never made. It now names the address and stays at
      // the level the check can actually back: the check tests for a non-empty string
      // containing an at sign, not deliverability, so the copy claims no more than that.
      // Same rule, same reason as the success string above.
      error: 'Ese correo no parece válido. Revísalo antes de continuar.',
    },
  },

  // ── CTA FINAL ─────────────────────────────────────────────────────────────

  ctaFinal: {
    title: 'El repertorio en tu escenario.',
    subtitle:
      'Gratis durante la beta. Sin planes, sin niveles. El acceso se abre por ' +
      'lista de espera.',
    cta: {
      label: 'Unirme a la lista de espera',
      href: '#registro',
    },
  },

  // ── FAQ ───────────────────────────────────────────────────────────────────

  faq: {
    title: 'Preguntas frecuentes.',
    items: [
      {
        q: '¿Qué es CEMURM?',
        a:
          'El cuaderno digital de música: el chart, la letra, el setlist, el ' +
          'ensayo y el registro de lo que realmente se tocó. El repertorio vive ' +
          'aquí y se actualiza desde aquí.',
      },
      {
        q: '¿Funciona sin conexión?',
        a:
          'En el escenario, sin conexión, Stage Mode funciona entero: recorres ' +
          'el setlist, la letra y los acordes se ven, y la transposición y el ' +
          'tempo siguen respondiendo. Lo que escribes sin conexión no se pierde, ' +
          'queda pendiente y se aplica al volver.',
      },
      {
        q: '¿Qué es Stage Bus?',
        a:
          'Una sola fuente (el chart canónico y el setlist) que alimenta varias ' +
          'vistas al mismo tiempo, cada una mostrando lo que esa persona ' +
          'necesita y nada más.',
      },
      {
        q: '¿Es gratis?',
        a:
          'CEMURM es gratis durante la beta. No hay planes ni niveles: no ' +
          'hemos definido un precio, y preferimos decirlo así antes que anunciar ' +
          'uno que todavía no existe.',
      },
      {
        q: '¿Cómo entra alguien menor de edad?',
        a:
          'Un menor de edad no abre una cuenta como adulto. El consentimiento de ' +
          'su tutor o tutora se pide a un adulto, por correo, con un enlace de un ' +
          'solo uso. Hasta que ese adulto responde, la cuenta permanece cerrada y ' +
          'el consentimiento queda registrado.',
      },
      {
        q: '¿Puedo editar un chart y que se vea distinto para mí?',
        a:
          'Sí. Tienes tu transposición, tu capo y tus anotaciones. Esas cosas ' +
          'son tuyas y no le aparecen a nadie más. Si quieres compartirlas, ' +
          'promueves una versión nueva y queda registrada con su autor.',
      },
    ],
  },

  // ── FOOTER ────────────────────────────────────────────────────────────────

  footer: {
    note: 'CEMURM está en beta. El acceso se abre por lista de espera.',
    license: 'Licencia MIT.',
    // Four nav columns. `label` is the column header, `links` is the list of labels.
    // `anchors` names the labels that are also sections on this page: the exception list:
    // the footer renders an anchor for those and plain text for every other label, because
    // an href="#" announces itself as a link and then takes the reader to the top. Section
    // ids are structure rather than copy, so they stay ASCII.
    columns: [
      {
        label: 'Repertorio',
        links: [
          'Modelo',
          'Organizaciones',
          'Sedes',
          'Canciones',
          'Colaboradores',
        ],
      },
      {
        label: 'Tecnología',
        links: [
          'Chart',
          'Setlist',
          'Stage Bus',
          'Stage Mode',
          'Proyección',
        ],
      },
      {
        label: 'Soluciones',
        links: [
          'Culto',
          'Ensayo',
          'Sustitución',
          'Registro',
          'Comunidad',
        ],
      },
      {
        label: 'Recursos',
        links: [
          'Documentación',
          'Ayuda',
          'Blog',
          'Prensa',
          'FAQ',
        ],
      },
    ],
    anchors: { 'Stage Bus': 'stage-bus', FAQ: 'faq' },
    legal: {
      reserved: 'CEMURM. Derechos reservados.',
      mission:
        'Empoderando la música de comunidad a través de la práctica, el ensayo y el escenario.',
    },
  },
}

export default landing
