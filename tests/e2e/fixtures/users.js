// Seeded user fixtures matching supabase/seed.sql
// These are the exact users created by the seed script with deterministic UUIDs

/**
 * @typedef {Object} TestUser
 * @property {string} id
 * @property {string} email
 * @property {string} password
 * @property {string} displayName
 * @property {string} username
 * @property {string} [instrument]
 * @property {string} orgId
 * @property {string} orgName
 * @property {string|null} branchId
 * @property {'org_owner'|'org_member'} role
 * @property {boolean} isDemo
 */

/**
 * Demo user - owns Demo Academy org, Demo Setlist, and 2 songs
 * UUID: 10000000-0000-0000-0000-000000000001
 * @type {TestUser}
 */
export const demoUser = {
  id: '10000000-0000-0000-0000-000000000001',
  email: 'demo@cemurm.app',
  password: 'password1234',
  displayName: 'Demo User',
  username: 'demo',
  instrument: 'guitar',
  orgId: '10000000-0000-0000-0000-0000000000a1',
  orgName: 'Demo Academy',
  branchId: '10000000-0000-0000-0000-0000000000b1',
  role: 'org_owner',
  isDemo: true,
};

/**
 * Isolation user - member of Isolation Org (cross-org isolation proof)
 * UUID: 10000000-0000-0000-0000-000000000002
 * @type {TestUser}
 */
export const isolationUser = {
  id: '10000000-0000-0000-0000-000000000002',
  email: 'isolation@cemurm.app',
  password: 'password1234',
  displayName: 'Isolation User',
  username: 'isolation',
  orgId: '10000000-0000-0000-0000-0000000000a2',
  orgName: 'Isolation Org',
  branchId: null,
  role: 'org_member',
  isDemo: false,
};

/**
 * Outsider user - pending collaborator on Demo Setlist (accepted_at IS NULL)
 * UUID: 10000000-0000-0000-0000-000000000003
 * @type {TestUser}
 */
export const outsiderUser = {
  id: '10000000-0000-0000-0000-000000000003',
  email: 'outsider@cemurm.app',
  password: 'password1234',
  displayName: 'Outsider User',
  username: 'outsider',
  orgId: '10000000-0000-0000-0000-0000000000a2',
  orgName: 'Isolation Org',
  branchId: null,
  role: 'org_member',
  isDemo: false,
};

/**
 * All seeded users as an array for iteration
 * @type {TestUser[]}
 */
export const allSeededUsers = [demoUser, isolationUser, outsiderUser];

/**
 * Get a user by email
 * @param {string} email
 * @returns {TestUser|undefined}
 */
export function getUserByEmail(email) {
  return allSeededUsers.find(u => u.email === email);
}

/**
 * Get a user by ID
 * @param {string} id
 * @returns {TestUser|undefined}
 */
export function getUserById(id) {
  return allSeededUsers.find(u => u.id === id);
}

/**
 * Demo setlist ID from seed
 * @type {string}
 */
export const demoSetlistId = '30000000-0000-0000-0000-000000000001';

/**
 * Demo song IDs from seed
 * @type {Object}
 */
export const demoSongIds = {
  wayMaker: '20000000-0000-0000-0000-000000000001',
  oceans: '20000000-0000-0000-0000-000000000002',
  isolationAnthem: '20000000-0000-0000-0000-000000000003',
};

/**
 * Demo org and branch IDs
 * @type {string}
 */
export const demoOrgId = '10000000-0000-0000-0000-0000000000a1';
export const demoBranchId = '10000000-0000-0000-0000-0000000000b1';

/**
 * Isolation org ID
 * @type {string}
 */
export const isolationOrgId = '10000000-0000-0000-0000-0000000000a2';

/**
 * Demo gig IDs
 * @type {Object}
 */
export const demoGigIds = {
  fridayGig: '61000000-0000-0000-0000-000000000001',
  churchService: '61000000-0000-0000-0000-000000000002',
  isolationGig: '61000000-0000-0000-0000-000000000003',
};

/**
 * Demo venue IDs
 * @type {Object}
 */
export const demoVenueIds = {
  cafeLaLuna: '60000000-0000-0000-0000-000000000001',
  parqueElRetiro: '60000000-0000-0000-0000-000000000002',
};

/**
 * Bandmate link between demo and isolation
 * @type {Object}
 */
export const demoBandmateLink = {
  userId: demoUser.id,
  bandmateId: isolationUser.id,
};

/**
 * Setlist collaborator: isolation is accepted view-only on demo's setlist
 * @type {Object}
 */
export const isolationCollaborator = {
  setlistId: demoSetlistId,
  userId: isolationUser.id,
  canEdit: false,
};

/**
 * Setlist collaborator: outsider is PENDING on demo's setlist
 * @type {Object}
 */
export const outsiderCollaborator = {
  setlistId: demoSetlistId,
  userId: outsiderUser.id,
  canEdit: false,
};