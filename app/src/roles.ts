import { join } from 'node:path';
import { home, readJson, writeJson } from './store.ts';

// Assignments may name integrations the core cannot run (e.g. a manual browser handoff); running
// them fails explicitly until an adapter exists (routing-001).

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
