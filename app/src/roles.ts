import { join } from 'node:path';
import { getProject, home, readJson, writeJson } from './store.ts';
import { createTask, type AgentAdapter, type Task } from './runtime.ts';
import { claudeCode } from './adapters/claude-code.ts';
import { codex } from './adapters/codex.ts';

// Integrations the core can actually run. Assignments may name others (e.g. a manual
// browser handoff), but running them fails explicitly until an adapter exists (routing-001).
const adapters: Record<string, AgentAdapter> = { 'claude-code': claudeCode, codex };
export const integrations = [...Object.keys(adapters), 'manual-browser'];

export interface Assignment {
  integration: string;
  model?: string;
}

const defaults: Record<string, Assignment> = {
  ArchitectureReasoning: { integration: 'manual-browser' },
  Orchestration: { integration: 'codex' },
  Implementation: { integration: 'claude-code' },
  Chat: { integration: 'claude-code' }, // agent for new chat sessions
};

const rolesPath = () => join(home(), 'roles.json');

export function getRoles(): Record<string, Assignment> {
  return { ...defaults, ...readJson<Record<string, Assignment>>(rolesPath(), {}) };
}

export function setRole(role: string, assignment: Assignment): void {
  writeJson(rolesPath(), { ...readJson<Record<string, Assignment>>(rolesPath(), {}), [role]: assignment });
}

export function assignmentFor(role: string): Assignment {
  const assignment = getRoles()[role];
  if (!assignment) throw new Error(`No assignment for role: ${role}`);
  return assignment;
}

export function adapterFor(integration: string): AgentAdapter {
  const adapter = adapters[integration];
  if (!adapter) throw new Error(`Integration "${integration}" has no runnable adapter yet`);
  return adapter;
}

// Creates a top-level task for a role, failing before creation if it could not run.
export function newRoleTask(fields: Pick<Task, 'projectId' | 'goal' | 'role' | 'write' | 'tokenBudget'>): Task {
  getProject(fields.projectId);
  const { integration, model } = assignmentFor(fields.role);
  adapterFor(integration);
  return createTask({ ...fields, integration, model });
}
