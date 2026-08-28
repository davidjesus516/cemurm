# CEMURM — Technical Specification

## 1. Overview

CEMURM (Community-Centered Musical Repertories Manager) is a Progressive Web App that enables musicians to manage song repertoires, build setlists, and collaborate with bandmates. The application must work offline, be installable on any device, and handle multiple music notation formats.

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT (PWA)                             │
│  TypeScript (strict) + React 18 + Vite + Tailwind CSS         │
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
| TypeScript | 5+ (strict mode) | Type safety across frontend, hooks, and utility modules |
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

### PostgreSQL (Supabase)

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Songs
CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT,
  genre TEXT,
  format TEXT NOT NULL CHECK (format IN ('chordpro', 'musicxml', 'abc', 'pdf')),
  content TEXT,                -- inline content for text-based formats
  file_url TEXT,               -- R2 URL for binary formats
  created_by UUID REFERENCES users(id),
  is_public BOOLEAN DEFAULT FALSE,
  license_type TEXT,           -- e.g., 'CC-BY-4.0', 'public-domain', 'proprietary'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Setlists
CREATE TABLE setlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Setlist items (ordered songs within a setlist)
CREATE TABLE setlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id UUID REFERENCES setlists(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  notes TEXT
);

-- Annotations (comments, markings on songs)
CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  timestamp INTERVAL,          -- optional timestamp within the song
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thematic collections (curated sets of songs)
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  curator_id UUID REFERENCES users(id),
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection-song join table
CREATE TABLE collection_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  UNIQUE(collection_id, song_id)
);

-- Indexes
CREATE INDEX idx_songs_created_by ON songs(created_by);
CREATE INDEX idx_songs_is_public ON songs(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_setlists_user_id ON setlists(user_id);
CREATE INDEX idx_annotations_song_id ON annotations(song_id);
CREATE INDEX idx_collection_songs_collection ON collection_songs(collection_id);
```

### Row Level Security (RLS)

```sql
-- Songs: users can read public songs + their own
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public songs are readable by everyone"
  ON songs FOR SELECT
  USING (is_public = TRUE);

CREATE POLICY "Users can read their own songs"
  ON songs FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own songs"
  ON songs FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own songs"
  ON songs FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own songs"
  ON songs FOR DELETE
  USING (auth.uid() = created_by);

-- Similar policies for setlists, annotations, collections
```

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
| Frontend | Vercel | Auto-deploy from `main` branch, TypeScript + Vite build output |
| Database | Supabase | Hosted PostgreSQL + Auth |
| File Storage | Cloudflare R2 | S3-compatible, no egress fees |
| DNS | Cloudflare | Optional, for custom domain |

### Build Output

- Vite compiles TypeScript → optimized JS bundles with code-splitting
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

1. **TypeScript strict mode** — mandatory, non-negotiable from day one
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

1. **Multi-tenancy from day one.** CEMURM's domain IS community-centered: each community/orchestra/church is a natural tenant. This enables sharding by tenant, data isolation, and per-community caching. Every core table carries a tenant identifier (`tenant_id` / `community_id`) so future partitioning is possible without a schema rewrite.

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

- Tenant-aware data model (`tenant_id` on core tables) → enables future sharding.
- Clean module boundaries → enables future service split.
- Versioned, stable API → no client breakage.
- WASM on the client → heavy compute never lives on the server.
- No coupling to non-migratable Supabase features (see Phase 3 independence).

**Decision:** Phase 4 is a documented destination, not a build target. Revisit this section when the user base exceeds ~100k MAU or a confirmed bottleneck appears in search, realtime, or read load.

---

*This section should be revisited when the team composition changes, the user base exceeds 10k MAU, or a performance bottleneck in parsing is confirmed.*

## 11. Free-Tier Validation (itsfree.dev)

Validated against [itsfree.dev](https://itsfree.dev) (revisión jul 2026), catálogo independiente de herramientas con capa gratuita útil, para confirmar que el stack de la §3 y §7 mantiene un coste de **$0/β**.

### 11.1 Confirmado — ya parte del stack

| Tool | Free tier (itsfree.dev) | Role in CEMURM | Spec ref |
|--------|--------------------------|----------------|----------|
| Supabase | 2 proyectos, 500 MB DB, 1 GB storage, 50k MAU | PostgreSQL + Auth + Storage + Realtime | §3.3, §4, §10.1 |
| Cloudflare R2 | 10 GB storage, 10M lecturas/mes | Almacenamiento de archivos grandes (PDF, MusicXML, audio) | §3.3, §7 |
| Vercel | Hobby, 1M peticiones edge, 100 deploys/día | Hosting frontend PWA | §3.3, §7 |
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

