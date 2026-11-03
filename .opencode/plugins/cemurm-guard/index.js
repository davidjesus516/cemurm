/**
 * CEMURM guard — OpenCode V2 server part.
 *
 * Blocks the same things the Claude Code PreToolUse hook blocks, from the same
 * rules module, so the policy cannot drift between agents:
 *
 *   - destructive SQL through a live client (DROP TABLE / TRUNCATE)
 *   - `supabase db push` and `supabase link` (this stack is local-only)
 *   - forced `git clean` and recursive deletes of the repo root or migrations
 *   - `gh pr create` above the authored changed-line budget
 *
 * Mechanism: `permission.hook("evaluate")` runs after configured rules and before
 * the action executes. Assigning `effect = "deny"` blocks it and hands `message`
 * back to the model as the reason.
 *
 * Plain object export on purpose: `Plugin.define` from `@opencode/plugin` is a
 * build-time helper, and this repository does not install that package. V2 reads
 * `id` and `setup()` from the default export.
 */

import { evaluatePrCreate } from '../../../scripts/hooks/measure-pr.mjs';
import { judgeBash, mentionsPrCreate } from '../../../scripts/hooks/rules.mjs';

export default {
  id: 'cemurm.guard',

  async setup(ctx) {
    await ctx.permission.hook('evaluate', (event) => {
      // Only shell commands are judged here. File content is not visible to this
      // hook (a write's `resources` carry the path, not the bytes), so the
      // migration-content rule stays in CI where it also covers humans.
      if (event.action !== 'shell') return;

      const cwd = ctx.location?.directory ?? process.cwd();

      for (const resource of event.resources ?? []) {
        let verdict;

        try {
          verdict = mentionsPrCreate(resource)
            ? evaluatePrCreate(resource, cwd)
            : judgeBash(resource);
        } catch (error) {
          // Fail closed: a guard that fails open is not a guard.
          event.effect = 'deny';
          event.message =
            `Blocked: the CEMURM guard crashed while judging this command.\n\n  ${String(error)}\n\n` +
            'Fix .opencode/plugins/cemurm-guard/index.js or remove the plugin.';
          return;
        }

        if (!verdict) continue;

        event.effect = 'deny';
        event.message = verdict.reason;
        return;
      }
    });
  },
};
