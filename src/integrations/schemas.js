// schemas.js — runtime contracts for the provider payloads this app parses.
//
// WHY THIS FILE EXISTS
// Each provider client used to state the wire shape in a JSDoc cast:
//
//   const body = /** @type {MbSearchBody} */ (await res.json())
//
// A cast is erased at runtime, so the only thing standing between a changed
// response and the database was a chain of `?.` and `||` fallbacks. Those
// fallbacks never fail — they substitute. When MusicBrainz stops sending
// `artist-credit`, `searchRealProvider` writes the artist the user typed as if
// it were the one the API returned, and nothing anywhere reports a problem.
// That is the failure these schemas remove: a wrong TYPE becomes a thrown
// ZodError, the caller's existing `catch` maps it to `{ ok: false, error:
// 'unavailable' }`, and the write never happens.
//
// THE RULE: these schemas validate types, they do NOT make optional fields
// required. Every field the client reads through `?.`, a truthiness check or a
// `typeof` guard stays `.optional()` (and `.nullable()` where the API omits a
// value by sending `null`). Tightening one of those would turn a tolerated
// absence into a provider failure — a behaviour change dressed up as safety.
// What the schemas add is the check the fallbacks cannot do: `key: "C"` is not
// a number, `recordings` is not an array, `track.id` is not a string.
//
// The JSDoc typedefs in each client still document the same shapes for
// readers and for the four files under `@ts-check`. These schemas are the part
// that survives compilation.

import { z } from 'zod'

/**
 * MusicBrainz WS/2 recording-search envelope. Mirrors `MbSearchBody`: the
 * envelope omits `recordings` entirely when nothing matches, and a recording
 * omits every field it does not carry.
 */
export const musicBrainzSearchBody = z.object({
  recordings: z
    .array(
      z.object({
        title: z.string().nullable().optional(),
        releases: z
          .array(z.object({ date: z.string().nullable().optional() }))
          .nullable()
          .optional(),
        tags: z
          .array(z.object({ name: z.string().nullable().optional() }))
          .nullable()
          .optional(),
        // The API's hyphenated key for the credited-artist array.
        'artist-credit': z
          .array(z.object({ name: z.string().nullable().optional() }))
          .nullable()
          .optional(),
      }),
    )
    .nullable()
    .optional(),
})

/**
 * lrclib.net search response — an ARRAY of rows, each carrying either lyric
 * flavour or neither. Mirrors `LrcSearchHit[]`.
 *
 * Note what this deliberately rejects: a non-array body. LRCLIB can answer an
 * error object, and the old `Array.isArray(body) ? body : []` guard folded that
 * into "no match" — the same result as a genuine empty search, so a provider
 * failure was indistinguishable from a song without lyrics. Parsing as an array
 * turns it into `{ ok: false, error: 'unavailable' }` instead.
 */
export const lrclibSearchRows = z.array(
  z.object({
    syncedLyrics: z.string().nullable().optional(),
    plainLyrics: z.string().nullable().optional(),
  }),
)

/**
 * Spotify client-credentials token response. `access_token` stays optional
 * because its absence is the existing explicit throw ('Spotify token missing'),
 * not a parse failure.
 */
export const spotifyTokenBody = z.object({
  access_token: z.string().nullable().optional(),
})

/**
 * Spotify /search envelope. `tracks` and `tracks.items` are omitted on an empty
 * result; `id` and `name` are required here because the client reads them
 * without a guard — `id` builds the /audio-features URL and `name` feeds the
 * match score.
 */
export const spotifySearchBody = z.object({
  tracks: z
    .object({
      items: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            artists: z
              .array(z.object({ name: z.string().nullable().optional() }))
              .nullable()
              .optional(),
            album: z
              .object({
                images: z
                  .array(z.object({ url: z.string().nullable().optional() }))
                  .nullable()
                  .optional(),
              })
              .nullable()
              .optional(),
          }),
        )
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
})

/**
 * Spotify /audio-features entry. All three fields are absent (or null) on a
 * track without an analysis, which is why the client guards each one.
 */
export const spotifyFeatures = z.object({
  key: z.number().nullable().optional(),
  tempo: z.number().nullable().optional(),
  mode: z.number().nullable().optional(),
})
