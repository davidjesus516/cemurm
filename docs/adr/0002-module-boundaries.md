# ADR 0002 — Module boundaries: enforced modular monolith, explicit exceptions

- **Status**: accepted
- **Date**: 2026-09-26
- **Deciders**: product owner
- **Related**: `ADR 0001` (no API layer), `docs/engineering-review-backlog.md:13-16`
- **Scope note**: the page and landing changes are in `odd/tasks/cemurm-brand-landing.md`. This
  ADR is only about where code lives.

## Context

`src/` holds 111 files with no enforced boundaries: 46 in `lib/`, 26 pages, 19 hooks, 16
components, 3 entry points, 1 util. The largest module is 1224 lines. There is no design system,
no shared primitive, and no icon library. The import graph is currently a DAG with no file-level
cycle — which is worth preserving.

The engineering review of 2026-09-15 rejected a microservices split and recorded why: *"la API es
CRUD fino sobre RLS. Un split añadiría orquestación, operación y latencia sin concurrencia que lo
demande."* That decision is correct and this ADR does not reopen it.

But rejecting microservices is not the same as having structure. A monolith with no boundaries is
where a 1224-line file and 29 copies of the same button class come from.

The relevant axis here is **codebase scale, not user scale**. Supabase with RLS carries the data
load; the documented trigger for revisiting the architecture is ~500 measured concurrent users
(`docs/engineering-review-backlog.md:16`). The pain that is actually present is cohesion.

The 2026 consensus on growing React applications is a **modular monolith with explicit domain
boundaries**. Micro-frontends pay off when *different teams own different parts*; this is a
one-team repository, and splitting would add orchestration without adding parallelism.

## Decision

```
src/
  app/            composition root: router, providers, boot
  domain/         pure logic. No react, no supabase, no window/document/navigator.
  data/           the ONLY place permitted to import @supabase/supabase-js
  integrations/   third-party API clients
  offline/        IndexedDB cache, write queue, drainer, update manager
  hooks/          shared React hooks (see rule 4)
  ui/             the design system. tokens/ primitives/ patterns/
  features/       vertical slices, one per capability
  content/        i18n content files
  lib/            only what is not yet relocated (see Migration)
```

### The four rules

1. **Dependency direction is one way**: `app → features → ui → domain`. Never the reverse.
2. **`data/` is the only module permitted to import the Supabase client.** Enforced, not
   documented.
3. **`domain/` is pure.** No `react`, no `@supabase/supabase-js`, no `window`, `document`,
   `navigator`, `indexedDB`, `caches`, no `import.meta.env`, and no `Date.now()` read inside a
   function body whose result depends on it.
4. **`ui/` must not import `domain/`, `data/`, `integrations/` or `features/`.** A component that
   knows what a song, setlist, service, block, gig or chart *is* is not a primitive.

### Named exceptions — these four are allowed on purpose

An exception with no name is a leak. These are the only four, and each has a reason:

| Exception | Reason |
|---|---|
| `features/*` may import `app/providers/` | Consuming a provided React context is not a cycle. `app → features` is composition (the route table names the routes); `features → app/providers` is injection. |
| `data/` may import `offline/cache.js` and `offline/queue.js` | The read-through cache and the write queue are infrastructure primitives, not domain. |
| `offline/drainer.js` may import `data/repositories/*` | **The drainer is the exception that justifies the rule.** It replays 30 whitelisted operations against repositories. It is the one place where the dependency legitimately inverts. |
| `data/repositories/enrichments.js` may import `integrations/spotify.js` | Provenance lives with the repository, not with the provider. The reverse hop is what is forbidden (see refactor 4). |

## The six refactors this requires

Relocation alone does not produce compliant boundaries. These are not `git mv`:

| # | Refactor | File | What changes |
|---|---|---|---|
| 1 | **Render model injection** | `components/notation/ChordProRenderer.jsx` | Stop importing `annotations.js`. Accept a resolved `renderModel` (sections with chords, lyrics, and applied substitutions). Each capability builds its own model. This is what makes it a primitive instead of a shared component that knows the domain |
| 2 | **Engine/lookup split** | `lib/degreeResolver.js` | The engine (`noteToSemitone`, `extractRoot`, `rootToDegree`, `qualityForDegree`, `formatRomanNumeral`, `parseKeyContext`) is pure. `resolveDegree` and `resolveDegreeInfo` are `export async` *only* because of `findScaleByName` → `scaleCatalog` → supabase. Split them: pure engine to `domain/music/`, async entry points to `data/` |
| 3 | **Pure/impure split** | `lib/annotations.js`, `lib/exporters/onsong.js` | `noteForLine` / `buildSubstitutionMap` / `applySubstitution` and `serializeOnSong` are pure; `listAnnotations` and `downloadOnSongFile` are not |
| 4 | **Break the 4-hop cycle** | `lib/spotify.js` → `lib/scaleCatalog.js` | `data/repositories/enrichments.js → integrations/spotify.js → data/repositories/scaleCatalog.js → data/supabase.js`. `spotify.js` reads the scale catalog only to normalise a key. Take the scales as a parameter instead |
| 5 | **Inject the clock** | `utils/relativeTime.js` | `relativeTime(iso)` reads `Date.now()` inside the body at `:19`, so the result is not reproducible. `relativeTime(iso, now)` |
| 6 | **Two more impure-in-disguise** | `lib/search.js` (verify), `lib/setlistCollab.js:71` | `isLockStale(lock, now = Date.now())` is a defaulted clock read in an exported signature |

## Two hard constraints that are not negotiable

**1. `public/sw.js` duplicates the predicates of `src/lib/storage.js` inline.** A classic service
worker cannot import ESM, so the file carries its own copy and its header says
*"mirror src/lib/storage.js (tested source)"*.

> **`src/lib/storage.js` does not move.** It stays exactly where it is, for the duration of this
> work, with a paired comment marker in both files and a check that compares the two blocks.

Also note `src/lib/storage.js:67` declares a **local** `const caches = cacheRecords`. It is not
the `CacheStorage` global. Any grep-based purity check will produce a false positive here.

**2. `offline/cache.js` and `offline/queue.js` share a lockstep contract.** `cache.js` exports
`DB_VERSION` and `applyUpgrade`; `queue.js` imports both. They must stay close enough that the
"lockstep by construction" guarantee survives the move, and `public/sw.js` opens the database
versionlessly so it cannot drift against the client's v3.

## Hooks: an explicit rule, because vertical slices do not cover them

Ten of nineteen hooks are imported by two or more capabilities: `useAuth` by all 13, `useSongs`
by 7, `useSetlists` by 5, `usePreferences` by 4, and five more by 2. They cannot live inside a
`features/` folder without creating the horizontal dependency the structure exists to prevent.

| Condition | Home |
|---|---|
| It is a `createContext` provider | `app/providers/` |
| Exactly one capability uses it | that `features/<capability>/` |
| Two or more capabilities use it | `hooks/shared/` |

This rule is mechanically checkable by grep and is the reason `hooks/` exists as a top-level
folder rather than being folded into `app/`.

## Migration

This is delivered as **two PRs**, not one:

- **PR 1a — relocation only.** Move `lib/` into `data/`, `integrations/`, `offline/`,
  `features/` and `hooks/shared/`. Update import paths. **No behaviour change, no refactors.**
  `src/lib/storage.js` stays. `ui/` and `content/` are not part of this: they have zero members
  today and are authored later.
- **PR 1b — the six boundary refactors.** Each is small and independently verifiable.

`ui/` and `content/` are explicitly excluded from the restructure. **No file in the current
repository is a reusable primitive with no domain knowledge** — every component knows what a
song, setlist, service, block, gig, report or chart is. `ui/` is authored, not relocated.

Enforcement ships **with** the structure or it is a suggestion:

1. `dependency-cruiser` — fails on `ui/` importing `data/`, and on any rule-3 violation
2. ESLint `no-restricted-imports` — the Supabase singleton is importable only from `data/`
3. A CI check comparing the `storage.js` block against its `public/sw.js` mirror
4. The token grep already specified in `odd/tasks/cemurm-brand-landing.md` §10.3

## What this ADR does not do

- It does not open the microservices question. That stays closed until measurement, not
  projection, shows the trigger in `docs/engineering-review-backlog.md:16`.
- It does not migrate to TypeScript. That stays closed per
  `docs/engineering-review-backlog.md:7-11`: JSDoc + `checkJs` on domain modules only, and only
  once a test suite exists.
- It does not split the large files. `setlists.js` at 1224 lines, `SongDetail.jsx` at 1160 and
  `App.jsx` importing 30 modules are relocation candidates, and splitting them is separate work
  that needs tests first.
- It does not delete `src/lib/progressions.js`, which is an orphan with no importers, or rename
  any of the three `queue` files. Both are follow-ups, recorded so they are not lost.
