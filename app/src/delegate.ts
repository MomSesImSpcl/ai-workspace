import { adapterFor, assignmentFor } from './roles.ts';
import { createTask, listTasks, loadTask, runTask, saveTask, type AgentAdapter, type Task } from './runtime.ts';
import { audit, getProject } from './store.ts';

const used = (t: Task) => t.usage.inputTokens + t.usage.outputTokens;

function existingChild(parentId: string, goal: string): Task | undefined {
  return listTasks().find((t) => t.parentId === parentId && t.goal === goal);
}

// Runs a subtask under another role. The child inherits the parent's project and write grant (never
// more), gets at most the parent's remaining budget, and its usage counts against the parent.
// Re-delegating the same goal reuses the existing child, so a resumed parent does not redo it.
export async function delegate(parentId: string, goal: string, role = 'Implementation', lookup: (integration: string) => AgentAdapter = adapterFor): Promise<Task> {
  const parent = loadTask(parentId);
  if (parent.parentId) throw new Error('Delegation depth limit: subtasks cannot delegate');
  const remaining = parent.tokenBudget - used(parent);
  if (remaining <= 0) throw new Error('Parent token budget exhausted');
  let child = existingChild(parentId, goal);
  if (!child) {
    const { integration, model } = assignmentFor(role);
    lookup(integration);
    child = createTask({ projectId: parent.projectId, goal, role, integration, model, write: parent.write, tokenBudget: remaining, parentId });
    audit({ kind: 'delegate', taskId: parentId, childId: child.id, role, integration });
  }
  const before = { ...child.usage };
  child = await runTask(child.id, lookup(child.integration), getProject(child.projectId).root);
  // The parent's runtime reloads its task after the current step, so this usage is kept.
  const p = loadTask(parentId);
  p.usage.inputTokens += child.usage.inputTokens - before.inputTokens;
  p.usage.outputTokens += child.usage.outputTokens - before.outputTokens;
  saveTask(p);
  return child;
}
