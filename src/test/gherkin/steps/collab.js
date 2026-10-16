import { defineSteps } from './index.js'
import { expect } from 'vitest'
import {
  guardVisibility,
  shareTargets,
  guardTransfer,
  describeActivity,
  applyLock,
  reconcileSetlistOp
} from '../../../domain/setlist/collab.js'

// Tie-break fixtures shared with src/domain/setlist/collab.js demo() (~line 457)
// and scripts/smoke/0037-offline-tie-break.sql: the recorded winner is op key
// 30000000-0000-0000-0000-0000000007f1 at 2026-10-13T10:00:00Z (TIE_MS), the
// greater key …7f2 replays, the lesser …7f0 is superseded. Fixed literals, never
// per-test randomness, so the SQL smoke and the client mirror assert one contract.
const TIE_MS = Date.parse('2026-10-13T10:00:00Z')

export function defineCollabSteps() {
  defineSteps('collab', [
    // Given
    {
      type: 'given',
      pattern: /^the setlist visibility is (?<value>.+)$/,
      handler: (ctx, { value }) => {
        ctx.visibilityValue = value.replace(/^"|"$/g, '')
      }
    },
    {
      type: 'given',
      pattern: /^the owner is (?<owner>.+) and bandmates are (?<bandmates>.+)$/,
      handler: (ctx, { owner, bandmates }) => {
        ctx.ownerId = owner.replace(/^"|"$/g, '')
        ctx.bandmateIds = bandmates.replace(/^"|"$/g, '').split(',').map(s => s.trim().replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'given',
      pattern: /^the collaborators are (?<accepted>.+) \(accepted\) and (?<pending>.+) \(pending\)$/,
      handler: (ctx, { accepted, pending }) => {
        ctx.collaborators = [
          { userId: accepted.replace(/^"|"$/g, ''), accepted_at: '2026-01-01T00:00:00Z' },
          { userId: pending.replace(/^"|"$/g, ''), accepted_at: null }
        ]
      }
    },

    // When
    {
      type: 'when',
      pattern: /^I check visibility (?<value>.+)$/,
      handler: (ctx, { value }) => {
        ctx.visibilityResult = guardVisibility(value.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'when',
      pattern: /^I compute share targets$/,
      handler: (ctx) => {
        ctx.shareResult = shareTargets(ctx.ownerId, ctx.bandmateIds, ctx.collaborators)
      }
    },
    {
      type: 'when',
      pattern: /^I check if (?<candidate>.+) can take ownership$/,
      handler: (ctx, { candidate }) => {
        ctx.transferResult = guardTransfer(ctx.collaborators, candidate.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'when',
      pattern: /^I describe activity (?<action>.+) by (?<actor>.+)$/,
      handler: (ctx, { action, actor }) => {
        ctx.activityResult = describeActivity({
          actor: actor.replace(/^"|"$/g, ''),
          action: action.replace(/^"|"$/g, ''),
          ts: '2026-01-01T00:00:00Z'
        })
      }
    },
    {
      type: 'when',
      pattern: /^I acquire a lock on song (?<songId>.+) as (?<userId>.+)$/,
      handler: (ctx, { songId, userId }) => {
        ctx.locks = applyLock(ctx.locks || {}, {
          userId: userId.replace(/^"|"$/g, ''),
          songId: songId.replace(/^"|"$/g, ''),
          locked: true,
          ts: Date.now(),
          actor: userId.replace(/^"|"$/g, '')
        })
      }
    },
    {
      type: 'when',
      pattern: /^I release the lock on song (?<songId>.+) as (?<userId>.+)$/,
      handler: (ctx, { songId, userId }) => {
        ctx.locks = applyLock(ctx.locks || {}, {
          userId: userId.replace(/^"|"$/g, ''),
          songId: songId.replace(/^"|"$/g, ''),
          locked: false,
          ts: Date.now()
        })
      }
    },
    {
      type: 'when',
      pattern: /^I reconcile an add of (?<songId>.+) queued at (?<queuedAt>\d+) against server updated at (?<updatedAt>\d+)$/,
      handler: (ctx, { songId, queuedAt, updatedAt }) => {
        ctx.reconcileResult = reconcileSetlistOp(
          { name: 'addSongToSetlist', args: ['u', 'sl', songId.replace(/^"|"$/g, '')], queuedAt: parseInt(queuedAt, 10) },
          { itemIds: ['a', 'b'], updatedAt: new Date(parseInt(updatedAt, 10)).toISOString() }
        )
      }
    },
    {
      type: 'when',
      pattern: /^I reconcile a remove of (?<songId>.+) queued at (?<queuedAt>\d+) against server updated at (?<updatedAt>\d+)$/,
      handler: (ctx, { songId, queuedAt, updatedAt }) => {
        ctx.reconcileResult = reconcileSetlistOp(
          { name: 'removeSongFromSetlist', args: ['u', 'sl', songId.replace(/^"|"$/g, '')], queuedAt: parseInt(queuedAt, 10) },
          { itemIds: ['a', 'b'], updatedAt: new Date(parseInt(updatedAt, 10)).toISOString() }
        )
      }
    },

    // Then
    {
      type: 'then',
      pattern: /^visibility is valid$/,
      handler: (ctx) => {
        expect(ctx.visibilityResult).toBeNull()
      }
    },
    {
      type: 'then',
      pattern: /^visibility is invalid with message (?<message>.+)$/,
      handler: (ctx, { message }) => {
        expect(ctx.visibilityResult).toBe(message.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'then',
      pattern: /^the share targets are (?<targets>.+)$/,
      handler: (ctx, { targets }) => {
        const expected = targets.replace(/^"|"$/g, '').split(',').map(s => s.trim().replace(/^"|"$/g, ''))
        expect(ctx.shareResult).toEqual(expected)
      }
    },
    {
      type: 'then',
      pattern: /^transfer is allowed$/,
      handler: (ctx) => {
        expect(ctx.transferResult).toBeNull()
      }
    },
    {
      type: 'then',
      pattern: /^transfer is denied with message (?<message>.+)$/,
      handler: (ctx, { message }) => {
        expect(ctx.transferResult).toBe(message.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'then',
      pattern: /^the activity label is (?<label>.+)$/,
      handler: (ctx, { label }) => {
        expect(ctx.activityResult).toBe(label.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'then',
      pattern: /^the lock is held by (?<userId>.+)$/,
      handler: (ctx, { userId }) => {
        const lock = ctx.locks[Object.keys(ctx.locks)[0]]
        expect(lock.userId).toBe(userId.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'then',
      pattern: /^the lock is released$/,
      handler: (ctx) => {
        expect(Object.keys(ctx.locks).length).toBe(0)
      }
    },
    {
      type: 'then',
      pattern: /^the add is dropped with notice (?<reason>.+)$/,
      handler: (ctx, { reason }) => {
        expect(ctx.reconcileResult.drop).toBe(true)
        expect(ctx.reconcileResult.notice).toBe(true)
        expect(ctx.reconcileResult.reason).toBe(reason.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'then',
      pattern: /^the add replays$/,
      handler: (ctx) => {
        expect(ctx.reconcileResult.drop).toBe(false)
      }
    },
    {
      type: 'then',
      pattern: /^the remove replays$/,
      handler: (ctx) => {
        expect(ctx.reconcileResult.drop).toBe(false)
      }
    },
    {
      type: 'then',
      pattern: /^the remove drops silently$/,
      handler: (ctx) => {
        expect(ctx.reconcileResult.drop).toBe(true)
        expect(ctx.reconcileResult.notice).toBeUndefined()
      }
    },

    // ── 0037 tie-break (features/offline-edit-conflict-policy.feature:47-51) ──
    // The recorded resolution is the arbiter's own state; the op is compared to
    // the winner's queued_at FIRST (the client mirror of apply_setlist_item_op),
    // and only an exact tie reaches the op-key rule. `updatedAt` is set AFTER the
    // recorded queuedAt — the shape production produces once the winner has
    // written — so the tie can only be decided against the recorded rule.
    {
      type: 'given',
      pattern: /^the server recorded an offline resolution for song (?<songId>.+) with op key (?<key>.+) at queued time (?<queuedAt>\d+)$/,
      handler: (ctx, { songId, key, queuedAt }) => {
        ctx.recordedResolution = {
          songId: songId.replace(/^"|"$/g, ''),
          opKey: key.replace(/^"|"$/g, ''),
          queuedAt: parseInt(queuedAt, 10)
        }
      }
    },
    {
      type: 'when',
      pattern: /^I reconcile an add of (?<songId>.+) with op key (?<key>.+) queued at (?<queuedAt>\d+) against the recorded resolution$/,
      handler: (ctx, { songId, key, queuedAt }) => {
        const song = songId.replace(/^"|"$/g, '')
        const rec = ctx.recordedResolution
        ctx.reconcileResult = reconcileSetlistOp(
          { name: 'addSongToSetlist', args: ['u', 'sl', song], queuedAt: parseInt(queuedAt, 10), opKey: key.replace(/^"|"$/g, '') },
          {
            itemIds: [],
            updatedAt: new Date(rec.queuedAt + 5000).toISOString(),
            conflictResolutions: { [rec.songId]: { opKey: rec.opKey, queuedAt: new Date(rec.queuedAt).toISOString() } }
          }
        )
      }
    },
    {
      type: 'when',
      // The quoted captures are deliberate: the two keys arrive quoted in the
      // scenario text, and this step compares them verbatim (no quote stripping).
      pattern: /^I reconcile the tie pair "(?<a>[^"]+)" and "(?<b>[^"]+)" queued at (?<queuedAt>\d+) against the recorded resolution in both orders$/,
      handler: (ctx, { a, b, queuedAt }) => {
        const rec = ctx.recordedResolution
        const t = parseInt(queuedAt, 10)
        const server = {
          itemIds: [],
          updatedAt: new Date(rec.queuedAt + 5000).toISOString(),
          conflictResolutions: { [rec.songId]: { opKey: rec.opKey, queuedAt: new Date(rec.queuedAt).toISOString() } }
        }
        const op = (key) => ({ name: 'addSongToSetlist', args: ['u', 'sl', rec.songId], queuedAt: t, opKey: key })
        const winners = (order) => order.filter(k => !reconcileSetlistOp(op(k), server).drop)
        ctx.tieWinnersForward = winners([a, b])
        ctx.tieWinnersReverse = winners([b, a])
      }
    },
    {
      type: 'then',
      pattern: /^the add replays under the recorded rule (?<rule>.+)$/,
      handler: (ctx, { rule }) => {
        expect(ctx.reconcileResult.drop).toBe(false)
        expect(ctx.reconcileResult.rule).toBe(rule.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'then',
      pattern: /^the add is superseded under the recorded rule (?<rule>.+)$/,
      handler: (ctx, { rule }) => {
        expect(ctx.reconcileResult.drop).toBe(true)
        expect(ctx.reconcileResult.notice).toBe(true)
        expect(ctx.reconcileResult.reason).toBe('superseded')
        expect(ctx.reconcileResult.rule).toBe(rule.replace(/^"|"$/g, ''))
      }
    },
    {
      type: 'then',
      pattern: /^only the greater key "(?<key>[^"]+)" replays in both orders$/,
      handler: (ctx, { key }) => {
        expect(ctx.tieWinnersForward).toEqual([key])
        expect(ctx.tieWinnersReverse).toEqual([key])
      }
    }
  ])
}