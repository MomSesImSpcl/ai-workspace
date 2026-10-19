import { join } from 'node:path';
import { home, readJson, writeJson } from './store.ts';

// Assignments may name integrations the core cannot run; running them fails explicitly until an adapter exists (routing-001).

export interface Assignment {
  integration: string;
  model?: string;
  effort?: string; // unset: the agent's own default
  permissionMode?: string; // tasks' default mode, an id of the agent's catalog `modes`; unset: the workspace default, '': the agent's settings
}

// In the order Settings shows them. A role saved earlier but no longer defined is ignored.
const defaults: Record<string, Assignment> = {
  Chat: { integration: 'claude-code' }, // agent for new chat sessions
  Orchestration: { integration: 'codex' },
  Implementation: { integration: 'claude-code' },
};

const rolesPath = () => join(home(), 'roles.json');

export function getRoles(): Record<string, Assignment> {
  const saved = readJson<Record<string, Assignment>>(rolesPath(), {});
  return Object.fromEntries(Object.entries(defaults).map(([role, a]) => [role, saved[role] ?? a]));
}

export function setRole(role: string, assignment: Assignment): void {
  if (!defaults[role]) throw new Error(`Unknown role: ${role}`);
  writeJson(rolesPath(), { ...readJson<Record<string, Assignment>>(rolesPath(), {}), [role]: assignment });
}

export function assignmentFor(role: string): Assignment {
  const assignment = getRoles()[role];
  if (!assignment) throw new Error(`No assignment for role: ${role}`);
  return assignment;
}
