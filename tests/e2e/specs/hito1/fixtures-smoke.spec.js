// Smoke tests for E2E harness fixtures (PR-1 validation)
// Tests that all fixtures load correctly and have expected structure

import { test, expect } from '@playwright/test';
import { demoUser, isolationUser, outsiderUser, allSeededUsers, demoSetlistId, demoSongIds, demoOrgId, demoBranchId, isolationOrgId } from '../../fixtures/users.js';
import { loginViaApi, injectSession, loginAsDemo, loginAsIsolation, loginAsOutsider } from '../../fixtures/auth.js';
import { createSong, createSetlist, createGig, createVenue, resetDataFactoryCounters, testData } from '../../fixtures/data-factory.js';
import { isolateTest, clearAllStorage } from '../../fixtures/isolation.js';

test.describe('@smoke E2E Harness Fixtures', () => {
  test.describe('User fixtures', () => {
    test('demoUser has correct properties', () => {
      expect(demoUser.id).toBe('10000000-0000-0000-0000-000000000001');
      expect(demoUser.email).toBe('demo@cemurm.app');
      expect(demoUser.password).toBe('password1234');
      expect(demoUser.displayName).toBe('Demo User');
      expect(demoUser.username).toBe('demo');
      expect(demoUser.instrument).toBe('guitar');
      expect(demoUser.orgId).toBe('10000000-0000-0000-0000-0000000000a1');
      expect(demoUser.orgName).toBe('Demo Academy');
      expect(demoUser.branchId).toBe('10000000-0000-0000-0000-0000000000b1');
      expect(demoUser.role).toBe('org_owner');
      expect(demoUser.isDemo).toBe(true);
    });

    test('isolationUser has correct properties', () => {
      expect(isolationUser.id).toBe('10000000-0000-0000-0000-000000000002');
      expect(isolationUser.email).toBe('isolation@cemurm.app');
      expect(isolationUser.password).toBe('password1234');
      expect(isolationUser.displayName).toBe('Isolation User');
      expect(isolationUser.username).toBe('isolation');
      expect(isolationUser.orgId).toBe('10000000-0000-0000-0000-0000000000a2');
      expect(isolationUser.orgName).toBe('Isolation Org');
      expect(isolationUser.branchId).toBeNull();
      expect(isolationUser.role).toBe('org_member');
      expect(isolationUser.isDemo).toBe(false);
    });

    test('outsiderUser has correct properties', () => {
      expect(outsiderUser.id).toBe('10000000-0000-0000-0000-000000000003');
      expect(outsiderUser.email).toBe('outsider@cemurm.app');
      expect(outsiderUser.password).toBe('password1234');
      expect(outsiderUser.displayName).toBe('Outsider User');
      expect(outsiderUser.username).toBe('outsider');
      expect(outsiderUser.orgId).toBe('10000000-0000-0000-0000-0000000000a2');
      expect(outsiderUser.role).toBe('org_member');
      expect(outsiderUser.isDemo).toBe(false);
    });

    test('allSeededUsers contains all three users', () => {
      expect(allSeededUsers).toHaveLength(3);
      expect(allSeededUsers.map(u => u.email).sort()).toEqual([
        'demo@cemurm.app',
        'isolation@cemurm.app',
        'outsider@cemurm.app',
      ]);
    });

    test('constants match seed.sql', () => {
      expect(demoSetlistId).toBe('30000000-0000-0000-0000-000000000001');
      expect(demoSongIds.wayMaker).toBe('20000000-0000-0000-0000-000000000001');
      expect(demoSongIds.oceans).toBe('20000000-0000-0000-0000-000000000002');
      expect(demoSongIds.isolationAnthem).toBe('20000000-0000-0000-0000-000000000003');
      expect(demoOrgId).toBe('10000000-0000-0000-0000-0000000000a1');
      expect(demoBranchId).toBe('10000000-0000-0000-0000-0000000000b1');
      expect(isolationOrgId).toBe('10000000-0000-0000-0000-0000000000a2');
    });
  });

  test.describe('Auth fixtures structure', () => {
    test('loginViaApi is a function', () => {
      expect(typeof loginViaApi).toBe('function');
    });

    test('injectSession is a function', () => {
      expect(typeof injectSession).toBe('function');
    });

    test('loginAsDemo is a function', () => {
      expect(typeof loginAsDemo).toBe('function');
    });

    test('loginAsIsolation is a function', () => {
      expect(typeof loginAsIsolation).toBe('function');
    });

    test('loginAsOutsider is a function', () => {
      expect(typeof loginAsOutsider).toBe('function');
    });
  });

  test.describe('Data factory structure', () => {
    test('createSong is a function', () => {
      expect(typeof createSong).toBe('function');
    });

    test('createSetlist is a function', () => {
      expect(typeof createSetlist).toBe('function');
    });

    test('createGig is a function', () => {
      expect(typeof createGig).toBe('function');
    });

    test('createVenue is a function', () => {
      expect(typeof createVenue).toBe('function');
    });

    test('resetDataFactoryCounters is a function', () => {
      expect(typeof resetDataFactoryCounters).toBe('function');
    });

    test('testData helpers exist', () => {
      expect(typeof testData.createWorshipSong).toBe('function');
      expect(typeof testData.createBasicSetlist).toBe('function');
      expect(typeof testData.createPlannedGig).toBe('function');
      expect(typeof testData.createCompletedGig).toBe('function');
    });
  });

  test.describe('Isolation fixtures structure', () => {
    test('isolateTest is a function', () => {
      expect(typeof isolateTest).toBe('function');
    });

    test('clearAllStorage is a function', () => {
      expect(typeof clearAllStorage).toBe('function');
    });
  });
});