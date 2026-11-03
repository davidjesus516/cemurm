#!/usr/bin/env node
/**
 * Claude Code PreToolUse guard for CEMURM.
 *
 * Contract (https://code.claude.com/docs/en/hooks):
 *   stdin  -> JSON payload: { hook_event_name, tool_name, tool_input, cwd }
 *   exit 0 -> no decision; the normal permission flow applies
 *   exit 2 -> block the tool call; stderr is returned to the model as the reason
 *
 * Registered in .claude/settings.json on the `Bash|Write|Edit` matcher.
 */

import { readFileSync } from 'node:fs';

import { evaluatePrCreate } from './measure-pr.mjs';
import { judgeBash, judgeWrite, mentionsPrCreate } from './rules.mjs';

main();

function main() {
  const payload = readPayload();
  if (!payload) process.exit(0);

  const toolName = String(payload.tool_name ?? '');
  const toolInput = payload.tool_input ?? {};
  const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();

  let verdict = null;

  try {
    if (toolName === 'Bash') {
      const command = String(toolInput.command ?? '');
      verdict = mentionsPrCreate(command) ? evaluatePrCreate(command, cwd) : judgeBash(command);
    } else if (toolName === 'Write' || toolName === 'Edit') {
      verdict = judgeWrite(toolInput);
    }
  } catch (error) {
    // A guard that fails open is decorativo. If the rules themselves break, say so
    // loudly instead of silently letting the command through.
    block(`Blocked: the CEMURM PreToolUse guard crashed.\n\n  ${String(error)}\n\nFix scripts/hooks/pre-tool-guard.mjs or remove its entry from .claude/settings.json.`);
  }

  if (verdict?.reason) block(verdict.reason);
  process.exit(0);
}

/** @returns {Record<string, unknown> | null} */
function readPayload() {
  let raw;
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    return null;
  }

  if (!raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** @param {string} message */
function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
