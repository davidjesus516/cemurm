# CEMURM — Community-Centered Musical Repertories Manager

**A Progressive Web App for musicians to manage repertoires, build setlists, and collaborate with their community.**

CEMURM lets individual musicians and bands organize their song libraries, create setlists for gigs, and share arrangements with bandmates — all from a responsive web app that works offline on any device.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18+ / Vite / Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| File Storage | Cloudflare R2 |
| Music Notation | ChordPro (custom parser), MusicXML (OpenSheetMusicDisplay), ABC (abcjs) |
| Offline | Workbox Service Workers |
| APIs | LRCLIB, MusicBrainz, Spotify |
| Deployment | Vercel (frontend) + Supabase (backend) + Cloudflare R2 (storage) |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/cemurm.git
cd cemurm

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

## Documentation

- [Technical Specification](docs/technical-spec.md)
- [MVP Scope & Milestones](docs/mvp-scope.md)
- [Copyright Policy](docs/copyright-policy.md)
- [Product Brief for Beta Users](docs/product-brief.md)

## License

MIT — see [LICENSE](LICENSE) for details.
