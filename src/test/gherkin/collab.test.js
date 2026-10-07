import { describe, it } from 'vitest'
import { createRunner } from './steps/index.js'
import { defineCollabSteps } from './steps/collab.js'
import {
  guardVisibility,
  shareTargets,
  guardTransfer,
  describeActivity,
  applyLock,
  isLockStale,
  reconcileSetlistOp
} from '../../domain/setlist/collab.js'

// Load step definitions
defineCollabSteps()

// Runner with domain functions bound
const runner = createRunner({
  guardVisibility,
  shareTargets,
  guardTransfer,
  describeActivity,
  applyLock,
  isLockStale,
  reconcileSetlistOp
})

describe('shared-setlist-collaboration: VISIBILITY GUARD', () => {
  it('Valid visibility values pass', async () => {
    await runner.runScenario('collab', [
      'Given the setlist visibility is "shared"',
      'When I check visibility "shared"',
      'Then visibility is valid'
    ])
  })

  it('Invalid visibility values fail', async () => {
    await runner.runScenario('collab', [
      'Given the setlist visibility is "org"',
      'When I check visibility "org"',
      'Then visibility is invalid with message "Visibility must be private, shared, or public."'
    ])
  })
})

describe('shared-setlist-collaboration: SHARE TARGETS', () => {
  it('Share targets excludes owner and current collaborators', async () => {
    await runner.runScenario('collab', [
      'Given the owner is "me" and bandmates are "a", "b", "a", "me"',
      'And the collaborators are "b" (accepted) and "c" (pending)',
      'When I compute share targets',
      'Then the share targets are "a"'
    ])
  })
})

describe('shared-setlist-collaboration: TRANSFER GUARD', () => {
  it('Accepted collaborator may take ownership', async () => {
    await runner.runScenario('collab', [
      'Given the collaborators are "jul" (accepted) and "luc" (pending)',
      'When I check if "jul" can take ownership',
      'Then transfer is allowed'
    ])
  })

  it('Pending invitee is rejected', async () => {
    await runner.runScenario('collab', [
      'Given the collaborators are "jul" (accepted) and "luc" (pending)',
      'When I check if "luc" can take ownership',
      'Then transfer is denied with message "The new owner must accept the invitation first."'
    ])
  })
})

describe('shared-setlist-collaboration: ACTIVITY LABELS', () => {
  it('Known actions produce correct labels', async () => {
    await runner.runScenario('collab', [
      'Given the owner is "Julian" and bandmates are "a"',
      'When I describe activity "reorder" by "Julian"',
      'Then the activity label is "Julian reordered the setlist"'
    ])
  })

  it('Unknown actions fall back to actor + action', async () => {
    await runner.runScenario('collab', [
      'Given the owner is "X" and bandmates are "a"',
      'When I describe activity "mystery" by "X"',
      'Then the activity label is "X mystery"'
    ])
  })
})

describe('shared-setlist-collaboration: ADVISORY LOCKS', () => {
  it('Lock acquire and release', async () => {
    await runner.runScenario('collab', [
      'Given the owner is "a" and bandmates are "b"',
      'When I acquire a lock on song "s1" as "a"',
      'Then the lock is held by "a"',
      'When I release the lock on song "s1" as "a"',
      'Then the lock is released'
    ])
  })

  it('Non-holder cannot steal active lock', async () => {
    await runner.runScenario('collab', [
      'Given the owner is "a" and bandmates are "b"',
      'When I acquire a lock on song "s1" as "a"',
      'When I acquire a lock on song "s1" as "b"',
      'Then the lock is held by "a"'
    ])
  })
})

describe('export-and-sharing: SHARE TARGETS', () => {
  it('Share targets same as collaboration', async () => {
    await runner.runScenario('collab', [
      'Given the owner is "me" and bandmates are "a", "b", "a", "me"',
      'And the collaborators are "b" (accepted) and "c" (pending)',
      'When I compute share targets',
      'Then the share targets are "a"'
    ])
  })
})

describe('shared-setlist-collaboration: OFFLINE RECONCILE', () => {
  it('Add superseded by online change drops with notice', async () => {
    await runner.runScenario('collab', [
      'Given the owner is "u" and bandmates are "v"',
      'When I reconcile an add of "m" queued at 1000 against server updated at 2000',
      'Then the add is dropped with notice "superseded"'
    ])
  })

  it('Add with untouched server replays', async () => {
    await runner.runScenario('collab', [
      'Given the owner is "u" and bandmates are "v"',
      'When I reconcile an add of "m" queued at 2000 against server updated at 1000',
      'Then the add replays'
    ])
  })

  it('Remove of present song replays', async () => {
    await runner.runScenario('collab', [
      'Given the owner is "u" and bandmates are "v"',
      'When I reconcile a remove of "a" queued at 1000 against server updated at 2000',
      'Then the remove replays'
    ])
  })

  it('Remove of absent song drops silently', async () => {
    await runner.runScenario('collab', [
      'Given the owner is "u" and bandmates are "v"',
      'When I reconcile a remove of "m" queued at 1000 against server updated at 2000',
      'Then the remove drops silently'
    ])
  })
})