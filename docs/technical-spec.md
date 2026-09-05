# CEMURM — Technical Specification

## 1. Overview

CEMURM (Community-Centered Musical Repertories Manager) is a Progressive Web App that enables musicians to manage song repertoires, build setlists, and collaborate with bandmates. The application must work offline, be installable on any device, and handle multiple music notation formats.

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT (PWA)                             │
│  JavaScript (JS/JSX) + React 18 + Vite + Tailwind CSS         │
│  + WASM modules (Rust → wasm-pack, dynamic import)             │
│  + Workbox Service Worker                                      │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ChordPro  │ │MusicXML  │ │   ABC    │ │ Stage Mode       │ │
│  │ Parser   │ │ (OSMD)   │ │ (abcjs)  │ │ (fullscreen,     │ │
│  │ (WASM)   │ │ WASM)    │ │ WASM)    │ │  transposition,  │ │
│  └──────────┘ └──────────┘ └──────────┘ │  pedal support)   │ │
│                                         └──────────────────┘ │
│  ┌──────────────────────────────────────┐                       │
│  │ WASM Layer (Rust → WASM):            │                       │
│  │  • ChordPro parser (future)          │                       │
│  │  • Key transposition                  │                       │
│  │  • MusicXML lightweight parsing       │                       │
│  └──────────────────────────────────────┘                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Offline Cache (IndexedDB + Cache API via Workbox)       │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────────────┘
                          │ HTTPS + WebSocket (Realtime)
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │PostgreSQL│ │  Auth    │ │ Storage  │ │ Realtime         │ │
│  │ Database │ │ (JWT)    │ │ (files)  │ │ (WebSocket)      │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
└────────────────────────┬─────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE R2                                │
│  Object storage for large files (PDFs, MusicXML, audio)       │
│  S3-compatible API · No egress fees                              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     EXTERNAL APIs                                │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐                      │
│  │ LRCLIB   │ │ MusicBrainz│ │ Spotify  │                      │
│  │ (lyrics) │ │ (metadata) │ │ (art,BPM)│                      │
│  └──────────┘ └────────────┘ └──────────┘                      │
└──────────────────────────────────────────────────────────────────┘
```

## 3. Tech Stack

### 3.1 Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| JavaScript (ES2022+) | JS/JSX | Primary frontend language — TypeScript is planned for a future migration (see §10.8 D1) |
| React | 18+ | UI framework |
| Vite | 5+ | Build tool and dev server |
| Tailwind CSS | 3+ | Utility-first styling |
| React Router | 6+ | Client-side routing |
| Zustand | 4+ | Lightweight state management |

### 3.2 Music Notation

| Format | Library | WASM? | Notes |
|--------|---------|-------|-------|
| ChordPro | Custom parser | ✅ (Rust → WASM, future) | Lyrics with chord symbols, inline directives |
| MusicXML | OpenSheetMusicDisplay (OSMD) | ✅ (OSMD uses WASM internally) | Full notation rendering, playback via MIDI |
| ABC | abcjs | ✅ (WASM variant available) | Text-based notation, client-side rendering |
| PDF | PDF.js | N/A | Fallback for scanned charts |

> **WASM strategy:** ChordPro and transposition logic will be compiled to WebAssembly (Rust → WASM via `wasm-pack` + `wasm-bindgen`) in a future phase. This enables offline parsing without server round-trips. OSMD and abcjs already leverage WASM internally. The WASM modules live under `src/wasm/` and are loaded dynamically.

### 3.3 Backend & Infrastructure

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| Supabase | PostgreSQL, Auth, Storage, Realtime | 500MB DB, 1GB storage, 50k MAU |
| Cloudflare R2 | Large file storage (S3-compatible) | 10GB storage, 10M reads/mo |
| Vercel | Frontend hosting + edge functions | 100GB bandwidth, 100k invocations |
| LRCLIB | Synchronized lyrics | Free (community API) |
| MusicBrainz | Song metadata, cover art | Free (rate-limited) |
| Spotify API | Album art, BPM, key detection | Free (rate-limited) |

### 3.4 Offline Support

- **Workbox** for service worker generation
- **IndexedDB** (via `idb` or Dexie.js) for structured data caching
- **Cache API** for static assets and API responses
- **Background Sync** for queuing writes when offline

## 4. Database Schema

Authoritative schema: **`docs/database-schema-v2.md`** (approved 2026-09-01, merged via PR #10). This section is intentionally a pointer, not a duplicate — the v2 doc is the single source of truth for the DDL contract, the RLS matrix, and the resolved ambiguities (D1–D7, A1–A8). Anything written here previously drifted the moment it diverged from the 44-entity model the feature suite requires.

### What supersedes what (from the v2 doc's mapping clause)

- **§1 inventory (44 entities)** supersedes the old 5-table sketch (`users`, `songs`, `setlists`, `setlist_items`, `annotations`, `collections`, `collection_songs`). Every entity the 42 `.feature` files actually require is enumerated there with its visibility scope.
- **§2 DDL** is the implementation contract. The tech-spec's former single `tenant_id` column is replaced by the `org_id` + `branch_id` (nullable) scope pair, because owner-org ≠ branch-scope (a Sede Lima branch under Academia Musical needs both). RLS scope columns live on the rows where the v2 matrix (§3.1) says they do.
- **§3 RLS matrix** supplies the per-entity policies the old "Similar policies for setlists, annotations, collections" hand-waved past — org/branch/user/system visibility, event matrices, public-library scopes.
- **§4 decisions (D1–D7, A1–A8)** carry forward the tech-spec's own §10.9.1 requirement ("every core table carries a tenant identifier") in a form the features can actually enforce.

### Preserved notes

- `users` is NOT modified (profiles are cross-tenant identity; membership lives in `org_memberships`, not a column on `users`) — unchanged from the previous §4.
- §3 tech stack and §10 decisions remain authoritative; nothing else in this document is affected by the schema replacement.

## 5. Folder Structure

```
cemurm/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker (generated by Workbox)
│   └── icons/                 # PWA icons (192x192, 512x512)
├── src/
│   ├── main.jsx               # Entry point
│   ├── App.jsx                # Root component + router
│   ├── index.css              # Tailwind imports + global styles
│   ├── components/
│   │   ├── layout/            # Header, Sidebar, Footer
│   │   ├── song/              # SongCard, SongEditor, SongViewer
│   │   ├── setlist/           # SetlistCard, SetlistEditor, SetlistPlayer
│   │   ├── notation/          # ChordProRenderer, MusicXMLRenderer, ABCRenderer
│   │   ├── stage/             # StageMode, TransposeControls
│   │   ├── search/            # SearchBar, SearchResults
│   │   └── common/            # Button, Modal, Input, Toast
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Songs.jsx
│   │   ├── SongDetail.jsx
│   │   ├── Setlists.jsx
│   │   ├── SetlistDetail.jsx
│   │   ├── Collections.jsx
│   │   ├── Profile.jsx
│   │   ├── Auth.jsx
│   │   └── NotFound.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useSongs.js
│   │   ├── useSetlists.js
│   │   ├── useOffline.js
│   │   └── useTransposition.js
│   ├── wasm/                # Rust → WASM modules (future phase)
│   │   ├── chordpro/        # ChordPro parser compiled to WASM
│   │   ├── transposition/   # Key transposition logic (WASM)
│   │   └── musicxml/        # Lightweight MusicXML parsing (WASM, future)
│   ├── lib/
│   │   ├── supabase.js        # Supabase client init
│   │   ├── r2.js              # R2 upload helpers
│   │   ├── chordpro/
│   │   │   ├── parser.js      # ChordPro text parser (JS fallback)
│   │   │   ├── parser.wasm    # WASM binary (compiled from Rust)
│   │   │   └── renderer.jsx   # ChordPro React renderer
│   │   ├── apis/
│   │   │   ├── lrclib.js      # LRCLIB lyrics API
│   │   │   ├── musicbrainz.js # MusicBrainz metadata
│   │   │   └── spotify.js     # Spotify API
│   │   └── offline/
│   │       ├── db.js          # IndexedDB setup (Dexie)
│   │       └── sync.js        # Background sync logic
│   ├── store/
│   │   └── index.js           # Zustand stores
│   └── utils/
│       ├── transposition.js   # Key transposition logic
│       └── format.js          # Date/number formatters
├── docs/
│   ├── technical-spec.md
│   ├── mvp-scope.md
│   ├── copyright-policy.md
│   └── product-brief.md
├── .github/
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── CONTRIBUTING.md
├── README.md
└── .gitignore
```

## 6. PWA Requirements

| Requirement | Implementation |
|-------------|---------------|
| Installable | `manifest.json` with icons, `display: standalone` |
| Offline-capable | Workbox precache + runtime caching strategies |
| Responsive | Tailwind responsive utilities, mobile-first design |
| Fast | Vite code splitting, lazy-loaded routes, image optimization |
| Secure | HTTPS enforced, CSP headers, Supabase RLS |

### Service Worker Strategy

- **Static assets**: Precache with Workbox (cache-first)
- **API responses**: Network-first with offline fallback
- **Images**: Stale-while-revalidate
- **Fonts**: Cache-first (long-lived)

## 7. Deployment

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | Vercel | Auto-deploy from `main` branch, JavaScript (Vite) build output |
| Database | Supabase | Hosted PostgreSQL + Auth |
| File Storage | Cloudflare R2 | S3-compatible, no egress fees |
| DNS | Cloudflare | Optional, for custom domain |

### Build Output

- Vite bundles JavaScript (JS/JSX) → optimized JS bundles with code-splitting
- WASM modules (future) are loaded dynamically via `import()` — not bundled in the initial JS payload
- Service worker (Workbox) precaches the JS bundles + WASM binaries

### Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Cloudflare R2
VITE_R2_ACCOUNT_ID=your-account-id
VITE_R2_BUCKET_NAME=cemurm-files

# External APIs (optional, for search/metadata enrichment)
VITE_SPOTIFY_CLIENT_ID=your-spotify-client-id
```

## 8. Free Tier Budget

| Service | Free Tier Limit | Estimated Usage (Beta) |
|---------|----------------|----------------------|
| Supabase DB | 500MB | ~50MB (10%) |
| Supabase Auth | 50k MAU | ~500 MAU (1%) |
| Supabase Storage | 1GB | ~200MB (20%) |
| Cloudflare R2 | 10GB storage | ~2GB (20%) |
| Cloudflare R2 | 10M Class A ops | ~100k (1%) |
| Vercel | 100GB bandwidth | ~20GB (20%) |
| Vercel | 100k edge invocations | ~10k (10%) |

**Estimated monthly cost at beta scale: $0** (within all free tiers)

## 9. Security Considerations

- All database access controlled via Supabase Row Level Security (RLS)
- JWT tokens for authentication, short-lived access tokens + refresh tokens
- File uploads validated server-side (type, size)
- CSP headers configured in Vercel deployment
- No secrets in client-side code (all via `VITE_` env vars are public by design)
- R2 access via signed URLs only (no public bucket)

## 10. Stack Alternatives and Architecture Decisions

This section documents the stack alternatives evaluated during specification and the rationale for the base recommendation. It serves as the decision record for the current architecture and as a reference point for future migration considerations.

### 10.1 Database: Relational Alternatives

| Database | Why Considered | Verdict | Rationale |
|----------|---------------|---------|-----------|
| **PostgreSQL (Supabase)** — base choice | Default backend; RLS native, full SQL | ✅ **Selected for MVP** | RLS is the right security model for per-user data access; free tier covers beta scale |
| CockroachDB | Distributed SQL, Postgres wire-compatible | ⏸ Deferred | Overkill for beta scale; useful if multi-region becomes a requirement |
| MySQL / MariaDB | Familiar, widely deployed | ❌ Rejected | No native RLS; would require row-level filtering in application code |
| SQLite via Turso (libSQL) | Edge SQLite, very low latency for edge computing | ⏸ Deferred | Interesting for edge-only deployment; lacks the relational joins required for CEMURM's collaborative features |
| Firestore (Firebase) | Realtime + offline built into SDK | ⏸ Deferred | Lacks RLS granularity and relational query capabilities (joins across setlists, songs, annotations, collections) |
| MongoDB | Schema flexibility, horizontal scaling | ❌ Rejected | No RLS, document model is a poor fit for the highly relational data (songs ↔ setlists ↔ annotations ↔ collections) |
| DynamoDB (AWS) | Massive scale | ❌ Rejected | No RLS, no joins, pricing at scale is higher than PostgreSQL alternatives for this workload |

### 10.2 Caching Layer: Redis

Redis is **not a database replacement** for CEMURM but a potential acceleration layer:

| Use Case | Redis Helps? | Recommendation |
|----------|-------------|----------------|
| Rate-limiting external APIs (MusicBrainz, LRCLIB) | ✅ Yes | Add at scale (>5k MAU) using Upstash Redis (serverless) |
| Session cache / JWT blacklist | ✅ Yes | Supabase Auth handles this internally for the MVP |
| Pub/sub for realtime collaboration | ⚠️ Redundant | Supabase Realtime already provides WebSocket-based pub/sub |
| Queue for offline sync writes | ⚠️ Partially | IndexedDB in the client handles the client-side queue; no Redis needed |
| Music parsing result cache | ⚠️ Optional | Only if the same song is parsed repeatedly across sessions |

**Decision:** Redis is deferred to the growth phase (>10k MAU). The Supabase ecosystem and client-side IndexedDB cover the needs for beta and early scale.

### 10.3 Backend Languages

#### Option A: TypeScript via Supabase Edge Functions (Recommended)

| Aspect | Details |
|--------|---------|
| Runtime | Deno (edge functions in Supabase) |
| Stack | TypeScript end-to-end: shared types between client and backend |
| Pros | Minimal infra to maintain; same language (TS) for frontend and backend; RLS handles auth; $0 free tier |
| Cons | Edge function cold starts; limited execution time and memory; no heavy CPU-bound processing in edge |
| Best for | MVP, beta, early growth |

#### Option B: Rust (Axum) with PostgreSQL

| Aspect | Details |
|--------|---------|
| Runtime | Compiled binary, async (Tokio) |
| Stack | Rust + Axum + SQLx (compile-time checked queries) + PostgreSQL |
| Pros | 10-50x faster than Node.js for CPU-bound tasks (MusicXML parsing, transcription); memory-safe; binary deployment; WASM export possible |
| Cons | 2-3 weeks additional setup; smaller web ecosystem; steep learning curve; need separate deployment pipeline |
| Best for | Performance-critical parsing workloads; teams with Rust experience |

#### Option C: Java (Spring Boot / Quarkus)

| Aspect | Details |
|--------|---------|
| Runtime | JVM (Quarkus supports native compilation via GraalVM) |
| Stack | Spring Boot or Quarkus + Hibernate + PostgreSQL |
| Pros | Massive ecosystem; mature enterprise tooling; excellent for large teams |
| Cons | Verbose codebase; higher memory footprint; overkill for this application scope |
| Best for | Enterprise environments with existing Java infrastructure |

**Decision:** TypeScript via Supabase edge functions for the MVP. Rust is documented as the preferred backend for Phase 2 if performance becomes a bottleneck (particularly for batch MusicXML processing). Java is not recommended for CEMURM's scope.

### 10.4 Client-Side Processing: WebAssembly (Rust → WASM)

CEMURM's music notation workload (parsing ChordPro, transposing keys, rendering MusicXML) is **CPU-bound** and benefits significantly from client-side WASM processing:

| Workload | Current (JS) | With WASM (Rust) | Impact |
|----------|-------------|-------------------|--------|
| ChordPro parsing | JS parser | Rust compiled to WASM via `wasm-pack` | Instant offline parsing, no server round-trip |
| Key transposition | JS math | Rust WASM module | 10-50x faster, trivial computation but consistent |
| MusicXML parsing | OSMD (already WASM internally) | Custom Rust parser for lightweight extraction | Offload heavy parsing from main thread |
| ABC rendering | abcjs (already WASM internally) | Unchanged | abcjs already uses WASM |

**Path:**
1. **MVP:** All parsing in JavaScript (ChordPro custom parser, OSMD, abcjs)
2. **Phase 2:** Compile ChordPro parser and transposition logic to WASM (Rust → `wasm-pack` → `wasm-bindgen`), loaded dynamically via `import()` with a JS fallback
3. **Phase 3:** Add MusicXML lightweight WASM parser for offline use

**WASM module location:** `src/wasm/` (compiled output from a separate Rust crate workspace)

### 10.5 Deployment Architecture Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│ ARCHITECTURE A: Supabase Native (recommended for MVP)          │
│                                                                 │
│  Vite+TS (Vercel) → Supabase Edge Functions (Deno/TS)          │
│                       → Supabase (PG + Auth + Realtime)         │
│                       → Cloudflare R2 (files)                   │
│                                                                 │
│  Complexity: Low   Cost: $0 beta   Lock-in: Moderate           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ARCHITECTURE B: Rust Backend + Separate Services                │
│                                                                 │
│  Vite+TS+WASM (Vercel) → Vercel Edge (TS) → Axum (Rust/Fly)   │
│                            → Neon (serverless PostgreSQL)       │
│                            → Upstash Redis (cache)              │
│                            → Cloudflare R2 (files)              │
│                                                                 │
│  Complexity: High   Cost: ~$10/mo at scale   Lock-in: Low      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ARCHITECTURE C: Fastify + Railway (TypeScript backend)         │
│                                                                 │
│  Vite+TS+WASM (Vercel) → Fastify (Railway/Fly.io)              │
│                            → Neon (serverless PostgreSQL)       │
│                            → Redis (Upstash, optional)          │
│                            → Cloudflare R2 (files)              │
│                                                                 │
│  Complexity: Medium   Cost: ~$5-20/mo   Lock-in: Low           │
└─────────────────────────────────────────────────────────────────┘
```

### 10.6 Decision Matrix

| Criterion (weight for CEMURM) | Supabase + TS (A) | Rust Axum + Neon (B) | Fastify + Railway (C) |
|-------------------------------|-------------------|---------------------|---------------------|
| MVP setup speed               | ⭐⭐⭐⭐⭐           | ⭐⭐                | ⭐⭐⭐              |
| Offline-first capable         | ⭐⭐⭐              | ⭐⭐⭐⭐⭐ (WASM)      | ⭐⭐⭐              |
| Music parsing performance     | ⭐⭐⭐ (server)     | ⭐⭐⭐⭐⭐ (WASM)      | ⭐⭐⭐ (server)     |
| Realtime collaboration        | ⭐⭐⭐⭐⭐ (built-in) | ⭐⭐⭐ (manual WS)   | ⭐⭐⭐              |
| Free tier beta cost           | ⭐⭐⭐⭐⭐ ($0)      | ⭐⭐⭐               | ⭐⭐⭐              |
| Team learning curve            | ⭐⭐⭐⭐⭐ (TS unified)| ⭐⭐ (Rust curve)   | ⭐⭐⭐⭐            |
| Long-term scalability         | ⭐⭐⭐              | ⭐⭐⭐⭐             | ⭐⭐⭐⭐           |
| RLS / security model           | ⭐⭐⭐⭐⭐ (native)   | ⭐⭐⭐ (must build)   | ⭐⭐⭐              |
| **Composite score**           | **Highest**       | **2nd (growth phase)** | **3rd**        |

### 10.7 Recommended Path

| Phase | Stack | Timeline |
|-------|-------|----------|
| **Phase 0 (MVP)** | Supabase + TypeScript + Workbox | Immediate |
| **Phase 1 (Scale)** | Same stack, optimize WASM for parsers, add Upstash Redis | >5k MAU |
| **Phase 2 (Performance)** | Add Rust WASM modules for ChordPro parsing and transposition; consider dedicated Axum service for batch operations | >10k MAU or performance bottleneck |
| **Phase 3 (Independence)** | Migrate from Supabase to self-hosted PostgreSQL (Neon/Railway) + separate Rust/HTTP backend if lock-in or cost becomes a concern | >50k MAU |
| **Phase 4 (Millions)** | Scale-to-millions architecture: tenant-partitioned PostgreSQL, dedicated realtime layer (CRDTs), search service, worker queues, full observability (see §10.9) | >1M MAU |

### 10.8 Key Decisions to Finalize Before Apply Phase

1. **Frontend language: JavaScript (JS/JSX) today, TypeScript planned** — the repo is plain JS/JSX (React + Vite + Tailwind, per AGENTS.md). TypeScript strict mode is a *planned* migration, NOT adopted — it will be introduced incrementally once the codebase stabilizes, rather than mandated from day one.
2. **WASM strategy** — documented here, implementation deferred to Phase 2
3. **Redis** — deferred; add only when API rate limiting needs it
4. **Java backend** — not recommended for CEMURM's scope; rejected
5. **CockroachDB / DynamoDB** — rejected; PostgreSQL covers all current and near-future needs
6. **Firestore** — rejected; relational model is essential for CEMURM's data relationships

### 10.9 Scale to Millions (Phase 4)

The phases above (1–3) take CEMURM from MVP to ~50k MAU. Reaching millions of users is a **qualitative jump, not a linear extension**: two orders of magnitude where the assumptions change. This section is the north star for architecture decisions — it documents what a million-user CEMURM looks like so that decisions made TODAY do not block the path to it.

#### What changes at millions

| Layer | At 50k MAU | At millions |
|-------|-----------|-------------|
| Database | 1 PostgreSQL instance | PostgreSQL + read replicas + tenant partitioning + cache layer |
| Backend | Supabase edge functions | Stateful service runtimes (long-running processes) |
| Realtime | Supabase Realtime (LISTEN/NOTIFY) | Dedicated WebSocket layer with CRDTs for collaboration |
| Compute | WASM on the client | WASM on the client + worker pools on the server |
| Failure | A concern | Engineered as the norm (chaos engineering) |
| Cost | ~$0 | The #1 design variable |

#### Capabilities a million-user system must have

1. **Multi-tenancy from day one.** CEMURM's domain IS community-centered: each community/orchestra/church is a natural tenant. This enables sharding by tenant, data isolation, and per-community caching. This enables future partitioning without a schema rewrite.

> **Superseded implementation note:** schema v2 (`docs/database-schema-v2.md` §2, D1) replaces the old single `tenant_id` column with the `org_id` + `branch_id` (nullable) scope pair — because owner-org ≠ branch-scope (a Sede Lima branch under Academia Musical needs both). The multi-tenancy rationale and intent (data isolation + future partitioning) stand unchanged; only the concrete column implementation differs.

2. **Offline-first as a scaling strategy, not a feature.** Already in place (Workbox + IndexedDB): every song cached on the musician's device is one fewer server read. At millions, locally-served reads cost nothing — this is the strongest scaling lever in CEMURM's architecture.

3. **Domain separation (modular monolith first).** Not microservices from day one (operational complexity kills small teams), but hard module boundaries (songs, setlists, communities, auth, search, notifications) so modules can explode into services when the load demands it.

4. **Realtime with CRDTs.** For real collaborative editing (two musicians editing the same arrangement), Supabase Realtime does not scale to thousands of subscribers per room. Yjs (or equivalent) over a dedicated WebSocket layer is required. This is a standalone project — ignorable for MVP but NOT patchable on top later.

5. **Queues and workers.** Notifications, exports, search indexing, file processing: everything that is not request/response goes to a queue (Redis/BullMQ or Temporal). Without this, load spikes suffocate the system at millions.

6. **Observability from day one.** Structured logs + metrics + tracing (OpenTelemetry) + SLOs + alerting. This is how million-user systems are operated; without telemetry there is no way to even diagnose the failure.

7. **Dedicated search.** At millions, `ILIKE '%title%'` does not scale. PostgreSQL full-text search first, then a dedicated engine (Meilisearch, Typesense, or OpenSearch) for full-text song search.

8. **Costs as a design input.** Every query costs money at millions. Hot-read caching (song views, repeated searches), R2 lifecycle policies, and cold-data tiering are required disciplines.

#### Target stack at the maximum point

```
Frontend:  React + TypeScript + Vite (offline-first PWA)   ← unchanged
Backend:   Rust (Axum) or Go, modular monolith             ← replaces edge functions
Database:  PostgreSQL (partitioned, read replicas; CockroachDB if multi-region)
Cache:     Redis (ValKey) + BullMQ / Temporal
Realtime:  Yjs + dedicated WebSocket layer (Ably / self-hosted / Elixir / Go)
Search:    Meilisearch or Typesense
Files:     Cloudflare R2 + CDN + presigned URLs             ← unchanged
Edge:      Cloudflare Workers (rate limiting, auth checks, cache)
Observability: OpenTelemetry + Grafana stack (Loki / Tempo / Mimir)
```

#### Decisions that enable the jump (made TODAY)

The million-user stack is NOT chosen now — choosing Rust + sharding + Temporal + CRDTs for a product with no users is the classic over-engineering mistake: slow velocity, dead infra spend, and probable death before 100k MAU. The art is choosing an architecture that LEAVES the door open. That translates into today's decisions:

- Tenant-aware data model (`org_id` + `branch_id` scope pair, superseding the former single `tenant_id` column — see §10.9.1) → enables future sharding.
- Clean module boundaries → enables future service split.
- Versioned, stable API → no client breakage.
- WASM on the client → heavy compute never lives on the server.
- No coupling to non-migratable Supabase features (see Phase 3 independence).

**Decision:** Phase 4 is a documented destination, not a build target. Revisit this section when the user base exceeds ~100k MAU or a confirmed bottleneck appears in search, realtime, or read load.

### 10.10 Client Delivery Model: PWA offline-first vs. native app (ADR)

**Decision:** **Offline-first PWA.** CEMURM is a Progressive Web App (offline-first, installable, runs on any device). Native (React Native/Flutter) and Capacitor (webview-with-store-wrapper) are rejected for the MVP. This ADR records why, so the choice is deliberate and traceable rather than assumed.

| Criterion (weight for CEMURM) | PWA offline-first (chosen) | React Native / Flutter | Capacitor (webview) |
|-------------------------------|---------------------------|------------------------|---------------------|
| Music notation rendering (ChordPro, OSMD MusicXML, abcjs) | ⭐⭐⭐⭐⭐ — reuses the web notation engines directly | ⭐ — must re-implement the notation engine twice, or bridge a webview anyway | ⭐⭐⭐⭐⭐ — webview renders the same engines |
| Stage Mode / external display / OBS overlay | ⭐⭐⭐⭐⭐ — inherently web surfaces (Browser Source, second screen) | ⭐⭐⭐ — no native equivalent without rebuilding | ⭐⭐⭐⭐⭐ — webview |
| Foot pedal (HID) + MIDI | ⭐⭐⭐⭐⭐ — WebHID + Web MIDI cover both | ⭐⭐⭐⭐ — native USB/MIDI fully supported | ⭐⭐⭐⭐ — webview + native bridge |
| Offline + offline sync | ⭐⭐⭐ — same offline problem native must still solve (Workbox + IndexedDB) | ⭐⭐⭐ — must build the same sync, but per-platform | ⭐⭐⭐ — same web offline, plus JSI bridge overhead |
| $0 beta cost (Supabase + R2 + Vercel) | ⭐⭐⭐⭐⭐ — every solution keeps this backend stack; PWA adds no store/tooling cost | ⭐⭐⭐ — store fees + native CI/notarization | ⭐⭐⭐⭐⭐ |
| Distribution | ⭐⭐⭐ — installable from browser/URL, no store | ⭐⭐⭐⭐⭐ — App/Play Store | ⭐⭐⭐⭐⭐ — store, wrapped |
| Hardware beyond Web APIs (camera, GPS, deep sensors) | ⭐⭐ — limited | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Team velocity / single codebase | ⭐⭐⭐⭐⭐ — one web codebase, one deploy | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Why native does not win the core problem:** CEMURM's hard problem is **offline-first with sync** and **rich web notation rendering** — and native does not remove either. A native app still needs a local datastore, a pending-write queue, and a conflict/merge strategy; it still needs a rendering engine for ChordPro/MusicXML that today lives as battle-tested web libraries. Choosing native would double the notation-rendering work and add store/CI overhead, all to buy hardware access (foot pedal, MIDI, camera, GPS) that WebHID, Web MIDI, and PWA installability already deliver for this product's actual surfaces. The features that are uniquely CEMURM — Stage Mode, external display, OBS overlay, congregation projection — are inherently web render surfaces.

**The real decision underneath is "offline-first" vs. "online-with-cache", not "PWA vs. native".** Offline-first (the spec's model: every song cached on device, pending writes queued, full stage/practice use without connectivity) is the product's defining property and the strongest scaling lever (§10.9 point 2). That property holds on any client; native is orthogonal to it. The client choice above simply picks the lowest-cost way to deliver that property with best-fit rendering.

**Trigger to revisit (reconsider Capacitor/native):** only when a user-facing requirement depends on hardware that Web APIs cannot reach, or store-based distribution becomes mandatory for a paying segment. Neither is in the MVP. Revisit if the congregation projection needs native casting beyond browser mirroring, or if a store-distributed premium tier is required to sell.

---

*This section should be revisited when the team composition changes, the user base exceeds 10k MAU, or a performance bottleneck in parsing is confirmed.*

## 11. Free-Tier Validation (itsfree.dev)

Validated against [itsfree.dev](https://itsfree.dev) (revisión jul 2026), catálogo independiente de herramientas con capa gratuita útil, para confirmar que el stack de la §3 y §7 mantiene un coste de **$0/β**.

### 11.1 Confirmado — ya parte del stack

| Tool | Free tier (itsfree.dev) | Role in CEMURM | Spec ref |
|--------|--------------------------|----------------|----------|
| Supabase | 2 proyectos, 500 MB DB, 1 GB storage, 50k MAU | PostgreSQL + Auth + Storage + Realtime | §3.3, §4, §10.1 |
| Cloudflare R2 | 10 GB storage, 10M lecturas/mes | Almacenamiento de archivos grandes (PDF, MusicXML, audio) | §3.3, §7 |
| Vercel | Hobby, 100k invocaciones edge, 100 deploys/día | Hosting frontend PWA | §3.3, §7 |
| Cloudflare (DNS) | Gratis (capa global) | DNS/dominio personalizado opcional | §7 |

No hay hueco funcional en el pilar de datos/hosting/auth: los cuatro servicios ya contemplados cubren las necesidades del MVP sin coste.

### 11.2 No incluido — diferido a fases posteriores

| Tool | Candidate role | Why deferred | Trigger to add |
|------|----------------|--------------|----------------|
| Resend | Emails transaccionales (confirmar cuenta, invitaciones) | Supabase Auth ya gestiona los emails de confirmación | Cuando se necesiten emails de producto propios (SaaS, invitaciones de banda) |
| Sentry | Observabilidad de errores en producción | La observabilidad formal es del plan Phase 4 (§10.9) | Al desplegar para público real; no para el shell de MVP |
| UptimeRobot / Better Stack | Páginas de estado y monitorización de uptime | Sin servicio en producción que vigilar | Tras el primer despliegue público |
| Umami / Cloudflare Web Analytics | Analítica web privacy-first | No requerida por el MVP; metas de producto no definidas | Al definir KPIs de uso |
| Fontshare | Fuentes tipográficas | "Tailwind only" en AGENTS.md; sin necesidad tipográfica identificada | Cuando se defina el diseño visual del branding |
| Contentful / Sanity / Storyblok | CMS headless | El contenido es estructurado en PostgreSQL, no editorial | Solo si aparece un caso de contenido no musical a gestionar |

### 11.3 Decisión

- **MVP (Phase 0):** confirmado en Supabase + Cloudflare R2 + Vercel. Sin dependencias gratuitas adicionales → coste **$0/β** respaldado por la §8.
- **Regla de oro:** no añadir servicios de su catálogo a menos que un hito (`mvp-scope.md`) o un requerimiento funcional los exija. Evaluar cada entrada del catálogo solo cuando el costo de build o el límite del tier gratuito sea un cuello de botella real.

*Revisar de nuevo cuando se alcance un límite de tier gratuito, se añada un servicio en producción, o se defina la estrategia de observabilidad del despliegue público.*

