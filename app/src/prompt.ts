// The instructions every agent starts with, built once for all agents (ADR 0023): the same text for every
// integration, which names workspace tools neutrally. Adapters only deliver it (Claude Code: --append-system-prompt;
// Codex: developerInstructions) and add no rule text of their own.
import { ORCHESTRATION, ownInstructions, type Session } from './sessions.ts';
import { composeText } from './registry.ts';

/** What a run adds beyond the session: the workspace folder's rules (`RunSetup.workspaceRules`). */
export interface PromptRun { workspaceRules?: string }

/**
 * A session's system instructions: its role's fixed note (Settings → Agent instructions: Role notes; none for a plain
 * chat) with the workspace rules when they apply, then the user's own instructions for the role as written. '' when
 * there is neither.
 */
export function agentInstructions(s: Pick<Session, 'role' | 'task' | 'worktree'>, run: PromptRun = {}): string {
  const task = s.task;
  const orchestrator = !task && s.role === ORCHESTRATION;
  const own = ownInstructions(task ? 'implementationInstructions' : orchestrator ? 'orchestratorInstructions' : 'chatInstructions');
  const note = task || orchestrator ? composeText(task ? 'note.task' : 'note.orchestrator', { rules: run.workspaceRules ?? '' }, run.workspaceRules ? ['rules'] : []) : '';
  return [note, own].filter(Boolean).join('\n\n');
}
