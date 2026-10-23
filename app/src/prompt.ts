// The instructions every agent starts with, built once for all agents (ADR 0023): the same text for every
// integration, which names workspace tools neutrally. Adapters only deliver it (Claude Code: --append-system-prompt;
// Codex: developerInstructions) and add no rule text of their own.
import { MERGE_NOTE } from './merge.ts';
import { ORCHESTRATION, orchestratorNote, ownInstructions, READ_REPO_NOTE, TASK_NOTE, type Session } from './sessions.ts';
import { WORKSPACE_RULES } from './setup.ts';

/** What a run adds beyond the session: its effort level and the workspace folder's rules (`RunSetup.workspaceRules`). */
export interface PromptRun { effort?: string; workspaceRules?: string }

export function agentInstructions(s: Pick<Session, 'role' | 'task' | 'worktree'>, run: PromptRun = {}): string {
  const task = s.task;
  const orchestrator = !task && s.role === ORCHESTRATION;
  const parts = [`AI Workspace ${task ? 'task' : 'session'}: effort level ${run.effort ?? "not set by the workspace (the agent's own default)"}. This note is always current: when the user changes the level in the workspace's composer, the agent is restarted with the new level and an updated note.`];
  if (task) parts.push(TASK_NOTE, READ_REPO_NOTE);
  else if (orchestrator) parts.push(orchestratorNote());
  else parts.push('To run self-contained work in the background as a task, use the workspace start_task tool.', READ_REPO_NOTE);
  // The orchestrator note already ends with the user's own orchestrator instructions.
  let text = parts.join(' ') + (orchestrator ? '' : ownInstructions(task ? 'implementationInstructions' : 'chatInstructions'));
  // App-project chats and top-level tasks merge through the workspace's request_merge (selfdev-004).
  if (s.worktree && s.role !== ORCHESTRATION && !task?.parentId) text += ` ${MERGE_NOTE}`;
  if (run.workspaceRules) text += `\n\n${WORKSPACE_RULES}\n${run.workspaceRules}`;
  return text;
}
