# CEMURM — Technical Specification

## 1. Overview

CEMURM (Community-Centered Musical Repertories Manager) is a Progressive Web App that enables musicians to manage song repertoires, build setlists, and collaborate with bandmates. The application must work offline, be installable on any device, and handle multiple music notation formats.

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT (PWA)                             │
│  React 18 + Vite + Tailwind CSS + Workbox Service Worker         │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ ChordPro │ │MusicXML  │ │   ABC    │ │ Stage Mode       │    │
│  │ Parser   │ │ (OSMD)   │ │ (abcjs)  │ │ (fullscreen,     │    │
│  └──────────┘ └──────────┘ └──────────┘ │  transposition,   │    │
│                                         │  pedal support)   │    │
│  ┌──────────────────────────────────────┘                   │    │
│  │ Offline Cache (IndexedDB + Cache API via Workbox)         │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTPS + WebSocket (Realtime)
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │PostgreSQL│ │  Auth    │ │ Storage  │ │ Realtime         │    │
│  │ Database │ │ (JWT)    │ │ (files)  │ │ (WebSocket)      │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘    │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE R2                                │
│  Object storage for large files (PDFs, MusicXML, audio)         │
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
| React | 18+ | UI framework |
| Vite | 5+ | Build tool and dev server |
| Tailwind CSS | 3+ | Utility-first styling |
| React Router | 6+ | Client-side routing |
| Zustand | 4+ | Lightweight state management |

### 3.2 Music Notation

| Format | Library | Notes |
|--------|---------|-------|
| ChordPro | Custom parser | Lyrics with chord symbols, inline directives |
| MusicXML | OpenSheetMusicDisplay (OSMD) | Full notation rendering |
| ABC | abcjs | Text-based notation |
| PDF | PDF.js | Fallback for scanned charts |

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
│   ├── lib/
│   │   ├── supabase.js        # Supabase client init
│   │   ├── r2.js              # R2 upload helpers
│   │   ├── chordpro/
│   │   │   ├── parser.js      # ChordPro text parser
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
| Frontend | Vercel | Auto-deploy from `main` branch |
| Database | Supabase | Hosted PostgreSQL + Auth |
| File Storage | Cloudflare R2 | S3-compatible, no egress fees |
| DNS | Cloudflare | Optional, for custom domain |

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
