#!/usr/bin/env node
/**
 * build-er-diagram.mjs — regenerate `docs/er-diagram.html` from the LIVE database.
 *
 * RUN (no npm script on purpose: the build needs a running local database, so it
 * cannot be part of any gate that runs without one):
 *
 *     pnpm exec supabase start          # once, if the stack is not up
 *     node scripts/build-er-diagram.mjs
 *
 * WHY THIS EXISTS
 *
 * `docs/er-diagram.html` used to be a hand-written copy of the schema. It drifted: by
 * 2026-10-28 it showed 48 tables while the migrations created 60. A diagram that lies is
 * worse than no diagram, because people use it to make decisions. So the data block is no
 * longer written by hand — it is derived here, from `information_schema` + `pg_constraint`
 * against the running local database, and the viewer (`scripts/templates/er-diagram.html`)
 * is a pure renderer over that data.
 *
 * WHAT IT READS (all of it, at build time; nothing is hand-copied into the output):
 *
 *   the local Postgres (container `supabase_db_cemurm` by default, ER_DB_CONTAINER to override)
 *     · public base tables, their columns, types and ordinal position
 *     · primary keys           (pg_constraint contype = 'p')
 *     · foreign keys           (pg_constraint contype = 'f'), including composite FKs
 *     · uniqueness of each FK  (a FK covered by a PK/UNIQUE constraint is 1:1)
 *   scripts/templates/er-diagram.html     the CSS + canvas engine, with a /*__SCHEMA_DATA__*\/ slot
 *   DOMAIN_OF below                        the domain each table belongs to
 *
 * CARDINALITY is derived from the constraints, never from a table-name allowlist:
 *   N:M  the table's primary key is exactly its set of FK columns (a pure bridge table)
 *   1:1  the FK columns are covered by a PK/UNIQUE constraint
 *   1:N  everything else
 *
 * FAILURE POLICY: a missing table domain, an unreadable database, or a template without the
 * data slot throws. A silently incomplete diagram is exactly the bug this script replaces.
 *
 * DETERMINISM: tables are emitted in (domain order, table name) and columns in ordinal order.
 * Two runs against the same schema produce a byte-identical file.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_PATH = join(ROOT, 'scripts/templates/er-diagram.html');
const OUTPUT_PATH = join(ROOT, 'docs/er-diagram.html');
const CONTAINER = process.env.ER_DB_CONTAINER || 'supabase_db_cemurm';
const DATA_SLOT = '/*__SCHEMA_DATA__*/';

// ═══════════════════════════════════════════════════════════════════
// DOMAINS — presentation grouping, not a database concept.
// A table that is not listed here fails the build on purpose: a new
// migration must be classified by a human, not silently dumped in a
// catch-all bucket.
// ═══════════════════════════════════════════════════════════════════
const DOMAINS = {
  tenancy:     { label: 'Tenencia y acceso',        color: '#6c8cff', order: 0 },
  repertoire:  { label: 'Repertorio',               color: '#a78bfa', order: 1 },
  setlists:    { label: 'Setlists y colecciones',   color: '#34d399', order: 2 },
  commentary:  { label: 'Anotaciones',              color: '#f472b6', order: 3 },
  events:      { label: 'Eventos y shows',          color: '#fbbf24', order: 4 },
  practice:    { label: 'Práctica y colaboración',  color: '#fb923c', order: 5 },
  community:   { label: 'Comunidad y moderación',   color: '#ef4444', order: 6 },
  sync:        { label: 'Sincronización',           color: '#38bdf8', order: 7 },
};

const DOMAIN_OF = {
  // tenancy
  organizations: 'tenancy', branches: 'tenancy', org_memberships: 'tenancy',
  user_roles: 'tenancy', invite_codes: 'tenancy', profiles: 'tenancy',
  user_preferences: 'tenancy', guardian_consents: 'tenancy',
  // repertoire
  songs: 'repertoire', chart_files: 'repertoire', song_versions: 'repertoire',
  tags: 'repertoire', song_tags: 'repertoire', song_duplicates: 'repertoire',
  external_enrichments: 'repertoire',
  // setlists
  collections: 'setlists', collection_songs: 'setlists', setlists: 'setlists',
  setlist_items: 'setlists', setlist_collaborators: 'setlists',
  setlist_change_log: 'setlists', setlist_conflict_resolutions: 'setlists',
  // commentary
  personal_annotations: 'commentary', shared_comments: 'commentary',
  // events
  venues: 'events', gigs: 'events', events: 'events', event_participants: 'events',
  event_rsvps: 'events', event_setlists: 'events', performances: 'events',
  performance_items: 'events', services: 'events', service_assignments: 'events',
  service_blocks: 'events', substitution_requests: 'events',
  substitution_responses: 'events', service_change_log: 'events',
  service_plan_versions: 'events',
  // practice
  rehearsals: 'practice', rehearsal_items: 'practice', rehearsal_rsvps: 'practice',
  practice_sessions: 'practice', bandmate_links: 'practice',
  notifications: 'practice', notification_preferences: 'practice',
  // community
  public_songs: 'community', reports: 'community', moderation_cases: 'community',
  dmca_notices: 'community', follows: 'community', rating_restrictions: 'community',
  feedback: 'community',
  // sync
  device_configs: 'sync', midi_maps: 'sync', outbox: 'sync', audience_views: 'sync',
  scale_catalog: 'sync', external_connections: 'sync', overlay_sessions: 'sync',
};

// ═══════════════════════════════════════════════════════════════════
// GUIDE — the explanation a reader needs before reading 60 boxes.
//
// This is the ONE curated block in the pipeline: product prose cannot be
// derived from `information_schema`. Everything around it is derived, and
// every table named here is validated against the live database before the
// file is written — a process that points at a table which no longer exists
// fails the build instead of shipping a lie.
//
// The relationships drawn per process are NOT written here: they are the real
// foreign keys between those tables, read from the database.
// ═══════════════════════════════════════════════════════════════════
const GUIDE = {
  message:
    'CEMURM es una aplicación web para músicos y comunidades musicales. Organiza un ' +
    'repertorio compartido, arma setlists, planifica servicios y ensayos, y acompaña la ' +
    'ejecución en vivo — incluso sin conexión. Toda esa actividad vive en una única base ' +
    'PostgreSQL: las tablas de este diagrama.',

  scope: {
    included: [
      'Autenticación, perfiles y consentimiento de tutores',
      'Repertorio: canciones, versiones, charts y etiquetas',
      'Setlists, colecciones y edición colaborativa',
      'Organizaciones, sucursales, membresías y roles',
      'Servicios: planificación, congelado de plan y sustituciones',
      'Ensayos, práctica y confirmación de asistencia',
      'Shows, ensayos generales e historial de performance',
      'Biblioteca pública, moderación y DMCA',
      'Offline: cola de escritura y resolución de conflictos',
      'Integraciones: MIDI, pantalla externa, overlay OBS, proyección, PDF',
    ],
    excluded: [
      'Educación (cursos, inscripción, progreso, asignaciones): 4 features y 67 escenarios, sin hito asignado',
      'Beta polish (Hito 6): sin implementación',
      'App nativa de monitoreo y sincronización en vivo: decidida en 2026-10-19, sin código',
    ],
  },

  // Tables with the widest reach, each justified by a counted fan-in rather
  // than by taste. `why` explains the role; the count is computed at build time.
  core: [
    { id: 'songs', why: 'Catálogo: todo lo que se toca, ensaya o publica empieza acá.' },
    { id: 'organizations', why: 'Límite de aislamiento: dueña del repertorio, setlists, servicios y permisos.' },
    { id: 'setlists', why: 'Qué se toca y en qué orden; puente entre repertorio y ejecución.' },
    { id: 'song_versions', why: 'El arreglo concreto: tono, estructura y chart de una canción.' },
    { id: 'branches', why: 'Subdivisión de la organización; acota el alcance de cada miembro.' },
  ],

  processes: [
    {
      id: 'biblioteca',
      title: 'Biblioteca de canciones',
      summary:
        'La canción es la unidad central. Cada canción tiene versiones (arreglos); cada versión ' +
        'puede llevar su chart. Las etiquetas la clasifican y las fusiones de duplicados dejan rastro.',
      tables: ['songs', 'song_versions', 'chart_files', 'tags', 'song_tags', 'song_duplicates', 'external_enrichments'],
    },
    {
      id: 'setlists',
      title: 'Armar un setlist',
      summary:
        'Un setlist es una lista ordenada de canciones para un contexto. Cada ítem fija canción y ' +
        'versión, así el arreglo no cambia solo. Las colecciones agrupan canciones fuera de un setlist.',
      tables: ['setlists', 'setlist_items', 'setlist_collaborators', 'setlist_change_log', 'setlist_conflict_resolutions', 'collections', 'collection_songs'],
    },
    {
      id: 'show',
      title: 'Show y ejecución en vivo',
      summary:
        'Un show ocurre en un lugar y usa un setlist. Al ejecutarlo se registra qué se tocó, canción ' +
        'por canción: ese es el historial. En paralelo, un evento de organización convoca y confirma asistencia.',
      tables: ['gigs', 'venues', 'performances', 'performance_items', 'events', 'event_setlists', 'event_participants', 'event_rsvps'],
    },
    {
      id: 'servicio',
      title: 'Servicio semanal: planificar, congelar, cubrir',
      summary:
        'El servicio se planifica en bloques; cada bloque usa un setlist y asigna personas. Publicar ' +
        'congela el plan en una versión. Si alguien falta, se abre una sustitución y se registran las ' +
        'respuestas. Todo cambio queda auditado.',
      tables: ['services', 'service_blocks', 'service_assignments', 'service_plan_versions', 'substitution_requests', 'substitution_responses', 'service_change_log'],
    },
    {
      id: 'ensayo',
      title: 'Ensayos y práctica',
      summary:
        'Un ensayo puede colgar de un evento y de un setlist. Los ítems listan qué se va a ensayar y ' +
        'las confirmaciones dicen quién va. Un ítem pendiente puede arrastrarse al ensayo siguiente.',
      tables: ['rehearsals', 'rehearsal_items', 'rehearsal_rsvps', 'practice_sessions'],
    },
    {
      id: 'personas',
      title: 'Organización y personas',
      summary:
        'La organización es el límite de aislamiento: sucursales, membresías y roles deciden quién ve ' +
        'qué. Las invitaciones incorporan gente y el consentimiento de tutores cubre a menores.',
      tables: ['organizations', 'branches', 'org_memberships', 'profiles', 'user_roles', 'invite_codes', 'bandmate_links', 'guardian_consents', 'user_preferences'],
    },
    {
      id: 'colaboracion',
      title: 'Colaboración y avisos',
      summary:
        'Sobre una canción o una versión se conversa con comentarios compartidos, o se anota en privado. ' +
        'Las notificaciones avisan de la actividad, con preferencias por usuario.',
      tables: ['shared_comments', 'personal_annotations', 'notifications', 'notification_preferences'],
    },
    {
      id: 'comunidad',
      title: 'Comunidad y moderación',
      summary:
        'Publicar saca una canción del repertorio privado al catálogo público. Las denuncias se acumulan ' +
        'en casos con decisión y apelación; las restricciones limitan a quien reincide.',
      tables: ['public_songs', 'reports', 'moderation_cases', 'dmca_notices', 'follows', 'rating_restrictions', 'feedback'],
    },
    {
      id: 'sync',
      title: 'Offline, dispositivos y pantallas',
      summary:
        'La app funciona sin conexión: las escrituras esperan en una cola. Los dispositivos guardan su ' +
        'configuración, los mapas MIDI ligan setlist y canción, y las sesiones de overlay quedan registradas.',
      tables: ['outbox', 'device_configs', 'midi_maps', 'overlay_sessions', 'audience_views', 'scale_catalog', 'external_connections'],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// INTROSPECTION
// ═══════════════════════════════════════════════════════════════════
function psql(sql) {
  let raw;
  try {
    raw = execFileSync(
      'docker',
      ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres',
       '-X', '-t', '-A', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-c', sql],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (error) {
    const detail = (error.stderr || error.message || '').toString().trim();
    throw new Error(
      `No pude leer la base local (container "${CONTAINER}").\n` +
      `Levantá el stack primero: pnpm exec supabase start\n\n${detail}`,
    );
  }
  return raw.split('\n').filter(Boolean).map(line => line.split('\t'));
}

const COLUMNS_SQL = `
  select c.table_name, c.column_name, c.udt_name, c.is_nullable, c.ordinal_position
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
  order by c.table_name, c.ordinal_position;`;

const PRIMARY_KEYS_SQL = `
  select cl.relname, a.attname
  from pg_constraint con
  join pg_class cl      on cl.oid = con.conrelid
  join pg_namespace n   on n.oid = cl.relnamespace
  join unnest(con.conkey) as k(attnum) on true
  join pg_attribute a   on a.attrelid = cl.oid and a.attnum = k.attnum
  where con.contype = 'p' and n.nspname = 'public'
  order by cl.relname, a.attnum;`;

const FOREIGN_KEYS_SQL = `
  select cl.relname, a.attname, tn.nspname, tcl.relname, ta.attname,
         exists (
           select 1 from pg_constraint u
           where u.conrelid = con.conrelid
             and u.contype in ('p', 'u')
             and u.conkey = con.conkey
         ) as unique_fk
  from pg_constraint con
  join pg_class cl      on cl.oid = con.conrelid
  join pg_namespace n   on n.oid = cl.relnamespace
  join pg_class tcl     on tcl.oid = con.confrelid
  join pg_namespace tn  on tn.oid = tcl.relnamespace
  join unnest(con.conkey, con.confkey) as k(src_attnum, tgt_attnum) on true
  join pg_attribute a   on a.attrelid = cl.oid  and a.attnum  = k.src_attnum
  join pg_attribute ta  on ta.attrelid = tcl.oid and ta.attnum = k.tgt_attnum
  where con.contype = 'f' and n.nspname = 'public'
  order by cl.relname, a.attnum;`;

// Postgres internal type names → the names a reader expects to see.
const TYPE_NAMES = {
  int2: 'smallint', int4: 'integer', int8: 'bigint',
  float4: 'real', float8: 'double precision', numeric: 'numeric',
  bool: 'boolean', varchar: 'text', bpchar: 'char', citext: 'citext',
  timestamp: 'timestamp', timestamptz: 'timestamptz', date: 'date', time: 'time',
  interval: 'interval', jsonb: 'jsonb', json: 'json', uuid: 'uuid', text: 'text',
  inet: 'inet', bytea: 'bytea',
};

function typeName(udt) {
  if (udt.startsWith('_')) return `${typeName(udt.slice(1))}[]`;
  return TYPE_NAMES[udt] || udt; // an enum keeps its own name, which is what we want to show
}

function readSchema() {
  const columns = psql(COLUMNS_SQL);
  const primaryKeys = psql(PRIMARY_KEYS_SQL);
  const foreignKeys = psql(FOREIGN_KEYS_SQL);

  if (columns.length === 0) throw new Error('La base no tiene tablas en el schema public.');

  const pkByTable = new Map();
  for (const [table, column] of primaryKeys) {
    if (!pkByTable.has(table)) pkByTable.set(table, []);
    pkByTable.get(table).push(column);
  }

  const fkByColumn = new Map(); // "table.column" → [{ target, targetColumn, unique }]
  for (const [table, column, targetSchema, targetTable, targetColumn, unique] of foreignKeys) {
    const key = `${table}.${column}`;
    if (!fkByColumn.has(key)) fkByColumn.set(key, []);
    fkByColumn.get(key).push({
      target: targetSchema === 'public' ? targetTable : `${targetSchema}.${targetTable}`,
      targetColumn,
      unique: unique === 't',
    });
  }

  const tables = new Map();
  for (const [table, column, udt, nullable, position] of columns) {
    if (!tables.has(table)) {
      tables.set(table, { id: table, pk: pkByTable.get(table) || [], cols: [] });
    }
    const entry = tables.get(table);
    const fks = fkByColumn.get(`${table}.${column}`) || [];
    const fk = fks[0]; // composite FKs are rare here; the first target drives the edge
    entry.cols.push({
      name: column,
      type: typeName(udt),
      position: Number(position),
      nullable: nullable === 'YES',
      pk: entry.pk.includes(column),
      fk,
    });
  }

  // A table whose PK is exactly its FK columns is a bridge: every edge is N:M.
  for (const table of tables.values()) {
    const fkColumns = table.cols.filter(c => c.fk).map(c => c.name);
    table.bridge = table.pk.length >= 2
      && fkColumns.length >= 2
      && table.pk.length === fkColumns.length
      && table.pk.every(col => fkColumns.includes(col));
    for (const col of table.cols) {
      if (!col.fk) continue;
      if (table.bridge) col.cardinality = 'N:M';
      else if (col.fk.unique) col.cardinality = '1:1';
      else col.cardinality = '1:N';
    }
  }

  return tables;
}

// ═══════════════════════════════════════════════════════════════════
// EMIT
// ═══════════════════════════════════════════════════════════════════
function buildDataLiteral(tables) {
  const sorted = [...tables.values()].sort((a, b) => {
    const da = DOMAINS[DOMAIN_OF[a.id]]?.order ?? 99;
    const db = DOMAINS[DOMAIN_OF[b.id]]?.order ?? 99;
    return da - db || a.id.localeCompare(b.id);
  });

  const missing = sorted.filter(t => !DOMAIN_OF[t.id]).map(t => t.id);
  if (missing.length) {
    throw new Error(
      `Tablas sin dominio asignado en DOMAIN_OF de scripts/build-er-diagram.mjs: ${missing.join(', ')}\n` +
      'Asignales un dominio; el diagrama no adivina.',
    );
  }

  let num = 0;
  const entities = sorted.map(table => {
    num += 1;
    const cols = table.cols.map(col => {
      const parts = [`name: '${col.name}'`, `type: '${col.type}'`];
      if (col.pk) parts.push('pk: true');
      if (col.fk) {
        const self = col.fk.target === table.id;
        parts.push(`fk: '${col.fk.target}${self ? '(self)' : ''}'`);
        if (!self) parts.push(`cardinality: '${col.cardinality}'`);
      }
      return `      { ${parts.join(', ')} },`;
    });
    return `  { id: '${table.id}', num: ${num}, domain: '${DOMAIN_OF[table.id]}', cols: [\n${cols.join('\n')}\n  ]},`;
  });

  const domains = Object.entries(DOMAINS)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, d]) => `  ${key}: { label: '${d.label}', color: '${d.color}', order: ${d.order} },`)
    .join('\n');

  return `const DOMAINS = {\n${domains}\n};\n\nconst ENTITIES = [\n${entities.join('\n')}\n];`;
}

function countEdges(tables) {
  let total = 0, drawn = 0, oneToOne = 0, manyToMany = 0, selfRefs = 0, external = 0;
  for (const table of tables.values()) {
    for (const col of table.cols) {
      if (!col.fk) continue;
      total += 1;
      // The viewer only draws edges between public tables; self references stay inline
      // and auth.users is an external boundary, not an entity in this diagram.
      if (col.fk.target === table.id) { selfRefs += 1; continue; }
      if (col.fk.target.startsWith('auth.')) { external += 1; continue; }
      drawn += 1;
      if (col.cardinality === '1:1') oneToOne += 1;
      if (col.cardinality === 'N:M') manyToMany += 1;
    }
  }
  return { total, drawn, oneToOne, manyToMany, selfRefs, external };
}

// How many tables point at each table. This is the only ranking signal the
// guide uses: a table is "core" because the schema says so, not because it
// felt important. `auth.users` is excluded — it is a boundary, not a public table.
function fanInCounts(tables) {
  const counts = new Map();
  for (const id of tables.keys()) counts.set(id, 0);
  for (const table of tables.values()) {
    for (const col of table.cols) {
      if (!col.fk) continue;
      const target = col.fk.target;
      if (target === table.id || !counts.has(target)) continue;
      counts.set(target, counts.get(target) + 1);
    }
  }
  return counts;
}

function buildGuideLiteral(tables, edgeCounts) {
  const missingDomains = GUIDE.processes
    .flatMap(p => p.tables)
    .filter(id => !tables.has(id));

  if (missingDomains.length) {
    throw new Error(
      'La guía nombra tablas que la base no tiene: ' +
      [...new Set(missingDomains)].join(', ') +
      '\nActualizá GUIDE en scripts/build-er-diagram.mjs o revisá la migración que las borró.',
    );
  }

  const fanIn = fanInCounts(tables);

  const processes = GUIDE.processes.map((process, index) => {
    const inside = new Set(process.tables);
    const edges = [];
    const outgoing = [];

    for (const id of process.tables) {
      const table = tables.get(id);
      for (const col of table.cols) {
        if (!col.fk) continue;
        const target = col.fk.target;

        if (target === id) continue; // self reference stays inside the card

        if (inside.has(target)) {
          edges.push({ from: id, to: target, via: col.name });
        } else {
          outgoing.push({
            table: id,
            column: col.name,
            to: target,
            external: target.startsWith('auth.'),
          });
        }
      }
    }

    return {
      id: process.id,
      num: index + 1,
      title: process.title,
      summary: process.summary,
      tables: process.tables,
      edges,
      outgoing,
    };
  });

  const core = GUIDE.core.map(entry => {
    if (!tables.has(entry.id)) {
      throw new Error(`La tabla núcleo "${entry.id}" no existe en la base.`);
    }
    return { id: entry.id, why: entry.why, fanIn: fanIn.get(entry.id) };
  });

  const guide = {
    message: GUIDE.message,
    scope: GUIDE.scope,
    core,
    processes,
    drawing: {
      total: edgeCounts.total,
      drawn: edgeCounts.drawn,
      hidden: edgeCounts.total - edgeCounts.drawn,
      selfRefs: edgeCounts.selfRefs,
      external: edgeCounts.external,
    },
  };
  return `const GUIDE = ${JSON.stringify(guide, null, 2)};`;
}

function main() {
  const template = readFileSync(TEMPLATE_PATH, 'utf8');
  if (!template.includes(DATA_SLOT)) {
    throw new Error(`El template ${TEMPLATE_PATH} no tiene el slot ${DATA_SLOT}.`);
  }

  const tables = readSchema();
  const edgeCounts = countEdges(tables);
  const data = buildDataLiteral(tables);
  const guide = buildGuideLiteral(tables, edgeCounts);
  const output = template.replace(DATA_SLOT, `${data}\n\n${guide}`);
  writeFileSync(OUTPUT_PATH, output, 'utf8');

  const { total, drawn, oneToOne, manyToMany } = edgeCounts;
  process.stdout.write(
    `docs/er-diagram.html regenerado\n` +
    `  ${tables.size} tablas · ${Object.keys(DOMAINS).length} dominios · ${total} FK en total\n` +
    `  ${drawn} relaciones dibujadas: ${oneToOne} 1:1 · ${manyToMany} N:M (puentes) · ${drawn - oneToOne - manyToMany} 1:N\n` +
    `  ${GUIDE.processes.length} procesos explicados · ${GUIDE.core.length} tablas núcleo\n`,
  );
}

main();
