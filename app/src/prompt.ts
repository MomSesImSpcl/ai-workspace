// The instructions every agent starts with, built once for all agents (ADR 0023): the same text for every
// integration, which names workspace tools neutrally. Adapters only deliver it (Claude Code: --append-system-prompt;
// Codex: developerInstructions) and add no rule text of their own.
import { ORCHESTRATION, ownInstructions, type Session } from './sessions.ts';
import { composeText, REGISTRY, type AgentText } from './registry.ts';

/** What a run adds beyond the session: its effort level and the workspace folder's rules (`RunSetup.workspaceRules`). */
export interface PromptRun { effort?: string; workspaceRules?: string }

/** The role's note (Settings → Agent instructions: Role notes), with the sections that apply to this session. */
export function agentInstructions(s: Pick<Session, 'role' | 'task' | 'worktree'>, run: PromptRun = {}): AgentText {
  const task = s.task;
  const orchestrator = !task && s.role === ORCHESTRATION;
  const id = task ? 'note.task' : orchestrator ? 'note.orchestrator' : 'note.chat';
  const instructions = ownInstructions(task ? 'implementationInstructions' : orchestrator ? 'orchestratorInstructions' : 'chatInstructions');
  const offered: Record<string, unknown> = REGISTRY[id].variants;
  const sections = [
    instructions && 'own',
    // App-project chats and top-level tasks merge through the workspace's request_merge (selfdev-004).
    s.worktree && !task?.parentId && 'merge',
    run.workspaceRules && 'rules',
  ].filter((v): v is string => !!v && v in offered);
  return composeText(id, { effort: run.effort ?? "not set by the workspace (the agent's own default)", instructions, rules: run.workspaceRules ?? '' }, sections);
}
