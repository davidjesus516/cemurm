// Data factory fixtures for creating test data with fixed UUIDs
// Uses deterministic UUIDs in the 30000... range reserved for test fixtures (per AGENTS.md)
/* global Buffer */

import { demoUser, demoOrgId, demoBranchId } from './users.js';
import { restUrl, supabaseAnonKey } from '../utils/supabase-url.js';

// UUID counters for deterministic generation
let songCounter = 100;
let setlistCounter = 100;
let gigCounter = 100;
let venueCounter = 100;
let chartFileCounter = 100;
let songVersionCounter = 100;

/**
 * Third-group ranges, one per fixture family.
 *
 * seed.sql occupies 30000000-* (setlists), 30000600-* (songs),
 * 30000700-* (song_versions) and 30000800-* (chart_files). Giving each
 * factory family its own third group keeps fixture rows disjoint from seed
 * rows and keeps the families from colliding with each other.
 * @type {Record<string, string>}
 */
const FIXTURE_RANGE = {
  song: '1000',
  chartFile: '1100',
  songVersion: '1200',
  setlist: '1300',
  setlistItem: '1400',
  gig: '1500',
  venue: '1600',
};

/**
 * Generate a deterministic UUID for a fixture row.
 *
 * The final group is always exactly 12 hex characters - Postgres `uuid_in`
 * rejects any other length - so the family is encoded in the third group
 * rather than prefixed onto the counter.
 *
 * @param {keyof typeof FIXTURE_RANGE} family
 * @param {number} counter - Monotonically increasing counter for the family
 * @returns {string}
 */
function generateFixtureUuid(family, counter) {
  const suffix = counter.toString().padStart(12, '0');
  return `3000${FIXTURE_RANGE[family]}-0000-4000-8000-${suffix}`;
}

/**
 * Create a song via API with fixed UUID
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.artist
 * @param {string} [options.genre]
 * @param {string} [options.ownerId]
 * @param {string} [options.orgId]
 * @param {string|null} [options.branchId]
 * @param {string} [options.chartContent]
 * @param {string} [options.baseKey]
 * @param {number} [options.baseTempo]
 * @param {string} accessToken
 * @returns {Promise<{songId: string, chartFileId: string, songVersionId: string}>}
 */
export async function createSong(request, options, accessToken) {
  songCounter++;
  const songId = generateFixtureUuid('song', songCounter);
  const chartFileId = generateFixtureUuid('chartFile', chartFileCounter++);
  const songVersionId = generateFixtureUuid('songVersion', songVersionCounter++);

  const orgId = options.orgId ?? demoOrgId;
  const branchId = options.branchId ?? demoBranchId;
  const ownerId = options.ownerId ?? demoUser.id;

  // Create the song
  const songResponse = await request.post(restUrl('songs'), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey(),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      id: songId,
      org_id: orgId,
      branch_id: branchId,
      title: options.title,
      artist: options.artist,
      genre: options.genre ?? 'worship',
      created_by: ownerId,
    },
  });

  if (!songResponse.ok()) {
    const error = await songResponse.json();
    throw new Error(`Failed to create song: ${JSON.stringify(error)}`);
  }

  // Create chart file if content provided
  if (options.chartContent) {
    const chartResponse = await request.post(restUrl('chart_files'), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey(),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      data: {
        id: chartFileId,
        song_id: songId,
        format: 'chordpro',
        object_key: `test/${songId}.chordpro`,
        content: options.chartContent,
        size_bytes: Buffer.byteLength(options.chartContent, 'utf8'),
      },
    });

    if (!chartResponse.ok()) {
      const error = await chartResponse.json();
      throw new Error(`Failed to create chart file: ${JSON.stringify(error)}`);
    }

    // Create song version
    const versionResponse = await request.post(restUrl('song_versions'), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey(),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      data: {
        id: songVersionId,
        song_id: songId,
        name: 'Original',
        number: 1,
        chart_file_id: chartFileId,
        base_key: options.baseKey ?? 'C',
        base_tempo: options.baseTempo ?? 120,
        duration_seconds: 180,
        is_ready: true,
        owner_id: ownerId,
        created_by: ownerId,
      },
    });

    if (!versionResponse.ok()) {
      const error = await versionResponse.json();
      throw new Error(`Failed to create song version: ${JSON.stringify(error)}`);
    }
  }

  return { songId, chartFileId, songVersionId };
}

/**
 * Create a setlist via API with fixed UUID
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {Object} options
 * @param {string} options.name
 * @param {string} [options.ownerId]
 * @param {string} [options.orgId]
 * @param {string|null} [options.branchId]
 * @param {'private'|'shared'|'public'} [options.visibility]
 * @param {string[]} [options.songIds]
 * @param {string} accessToken
 * @returns {Promise<{setlistId: string, itemIds: string[]}>}
 */
export async function createSetlist(request, options, accessToken) {
  setlistCounter++;
  const setlistId = generateFixtureUuid('setlist', setlistCounter);

  const orgId = options.orgId ?? demoOrgId;
  const branchId = options.branchId ?? demoBranchId;
  const ownerId = options.ownerId ?? demoUser.id;

  const setlistResponse = await request.post(restUrl('setlists'), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey(),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      id: setlistId,
      org_id: orgId,
      branch_id: branchId,
      owner_id: ownerId,
      name: options.name,
      visibility: options.visibility ?? 'shared',
    },
  });

  if (!setlistResponse.ok()) {
    const error = await setlistResponse.json();
    throw new Error(`Failed to create setlist: ${JSON.stringify(error)}`);
  }

  const itemIds = [];

  // Add songs to setlist if provided
  if (options.songIds && options.songIds.length > 0) {
    for (let i = 0; i < options.songIds.length; i++) {
      setlistCounter++;
      const itemId = generateFixtureUuid('setlistItem', setlistCounter);

      const itemResponse = await request.post(restUrl('setlist_items'), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey(),
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        data: {
          id: itemId,
          setlist_id: setlistId,
          song_id: options.songIds[i],
          position: i + 1,
          agreed_key: null,
        },
      });

      if (!itemResponse.ok()) {
        const error = await itemResponse.json();
        throw new Error(`Failed to create setlist item: ${JSON.stringify(error)}`);
      }

      itemIds.push(itemId);
    }
  }

  return { setlistId, itemIds };
}

/**
 * Create a gig via API with fixed UUID
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {Object} options
 * @param {string} options.name
 * @param {string} [options.ownerId]
 * @param {string} [options.orgId]
 * @param {string|null} [options.branchId]
 * @param {string} [options.venueId]
 * @param {string} options.scheduledAt - ISO string
 * @param {string} [options.setlistId]
 * @param {'planned'|'completed'|'cancelled'} [options.status]
 * @param {string} accessToken
 * @returns {Promise<{gigId: string}>}
 */
export async function createGig(request, options, accessToken) {
  gigCounter++;
  const gigId = generateFixtureUuid('gig', gigCounter);

  const orgId = options.orgId ?? demoOrgId;
  const branchId = options.branchId ?? demoBranchId;
  const ownerId = options.ownerId ?? demoUser.id;

  const gigResponse = await request.post(restUrl('gigs'), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey(),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      id: gigId,
      org_id: orgId,
      branch_id: branchId,
      owner_id: ownerId,
      name: options.name,
      venue_id: options.venueId ?? null,
      scheduled_at: options.scheduledAt,
      setlist_id: options.setlistId ?? null,
      status: options.status ?? 'planned',
    },
  });

  if (!gigResponse.ok()) {
    const error = await gigResponse.json();
    throw new Error(`Failed to create gig: ${JSON.stringify(error)}`);
  }

  return { gigId };
}

/**
 * Create a venue via API with fixed UUID
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {Object} options
 * @param {string} options.name
 * @param {string} options.location
 * @param {'bar'|'outdoor'|'church'|'theater'|'other'} options.type
 * @param {string} [options.ownerId]
 * @param {string} accessToken
 * @returns {Promise<{venueId: string}>}
 */
export async function createVenue(request, options, accessToken) {
  venueCounter++;
  const venueId = generateFixtureUuid('venue', venueCounter);

  const ownerId = options.ownerId ?? demoUser.id;

  const venueResponse = await request.post(restUrl('venues'), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey(),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      id: venueId,
      owner_id: ownerId,
      name: options.name,
      location: options.location,
      type: options.type,
    },
  });

  if (!venueResponse.ok()) {
    const error = await venueResponse.json();
    throw new Error(`Failed to create venue: ${JSON.stringify(error)}`);
  }

  return { venueId };
}

/**
 * Reset all counters (useful for test isolation)
 * @returns {void}
 */
export function resetDataFactoryCounters() {
  songCounter = 100;
  setlistCounter = 100;
  gigCounter = 100;
  venueCounter = 100;
  chartFileCounter = 100;
  songVersionCounter = 100;
}

/**
 * Predefined test data creators for common scenarios
 * @type {Object}
 */
export const testData = {
  /**
   * Create a basic worship song with chord chart
   * @param {import('@playwright/test').APIRequestContext} request
   * @param {string} accessToken
   * @param {Object} [overrides]
   * @returns {Promise<{songId: string, chartFileId: string, songVersionId: string}>}
   */
  async createWorshipSong(request, accessToken, overrides = {}) {
    return createSong(request, {
      title: 'Test Worship Song',
      artist: 'Test Artist',
      genre: 'worship',
      baseKey: 'G',
      baseTempo: 72,
      chartContent: `{title: Test Worship Song}
{artist: Test Artist}
{key: G}
{section: Verse 1}
[G]Amazing [D]grace, how [Em]sweet the [C]sound
[G]That [D]saved a [Em]wretch like [C]me
{section: Chorus}
[G]I [D]once was [Em]lost but [C]now am [G]found
[G]Was [D]blind but [C]now I [G]see`,
      ...overrides,
    }, accessToken);
  },

  /**
   * Create a basic setlist with 2 songs
   * @param {import('@playwright/test').APIRequestContext} request
   * @param {string} accessToken
   * @param {string[]} songIds
   * @param {Object} [overrides]
   * @returns {Promise<{setlistId: string, itemIds: string[]}>}
   */
  async createBasicSetlist(request, accessToken, songIds, overrides = {}) {
    return createSetlist(request, {
      name: 'Test Setlist',
      songIds,
      ...overrides,
    }, accessToken);
  },

  /**
   * Create a planned gig for tomorrow
   * @param {import('@playwright/test').APIRequestContext} request
   * @param {string} accessToken
   * @param {string} setlistId
   * @param {Object} [overrides]
   * @returns {Promise<{gigId: string}>}
   */
  async createPlannedGig(request, accessToken, setlistId, overrides = {}) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);

    return createGig(request, {
      name: 'Test Gig',
      scheduledAt: tomorrow.toISOString(),
      setlistId,
      ...overrides,
    }, accessToken);
  },

  /**
   * Create a completed gig with performance (for hito 2)
   * @param {import('@playwright/test').APIRequestContext} request
   * @param {string} accessToken
   * @param {string} setlistId
   * @param {Object} [overrides]
   * @returns {Promise<{gigId: string}>}
   */
  async createCompletedGig(request, accessToken, setlistId, overrides = {}) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 0, 0, 0);

    return createGig(request, {
      name: 'Completed Gig',
      scheduledAt: yesterday.toISOString(),
      setlistId,
      status: 'completed',
      ...overrides,
    }, accessToken);
  },
};