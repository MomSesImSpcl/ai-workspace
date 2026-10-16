import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { audit, home, readJson, writeJson } from './store.ts';

export type Status = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd?: number; // reported by the provider; subscription agents may report an estimate or nothing
}

export interface Task {
  id: string;
  projectId: string;
  goal: string;
  role: string;
  integration: string;
  model?: string;
  write: boolean;
  status: Status;
  reason?: string;
  tokenBudget: number;
  usage: Usage;
  steps: number;
  adapterState?: Record<string, unknown>; // provider hint (e.g. CLI session id), never the durable state
  result?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StepInput {
  task: Task;
  root: string;
}

export interface StepResult {
  done: boolean;
  error?: string;
  text?: string;
  usage: Usage;
  adapterState?: Record<string, unknown>;
}

// One agent product behind the workspace contract. Each call is one bounded step.
export interface AgentAdapter {
  step(input: StepInput): Promise<StepResult>;
}

const taskPath = (id: string) => join(home(), 'tasks', `${id}.json`);

export function saveTask(task: Task): void {
  task.updatedAt = new Date().toISOString();
  writeJson(taskPath(task.id), task);
}

export function loadTask(id: string): Task {
  const task = readJson<Task | null>(taskPath(id), null);
  if (!task) throw new Error(`Unknown task: ${id}`);
  return task;
}

export function createTask(fields: Pick<Task, 'projectId' | 'goal' | 'role' | 'integration' | 'model' | 'write' | 'tokenBudget'>): Task {
  const now = new Date().toISOString();
  const task: Task = { ...fields, id: randomUUID().slice(0, 8), status: 'pending', usage: { inputTokens: 0, outputTokens: 0 }, steps: 0, createdAt: now, updatedAt: now };
  saveTask(task);
  audit({ kind: 'task', taskId: task.id, event: 'created', integration: task.integration, write: task.write });
  return task;
}

const used = (u: Usage) => u.inputTokens + u.outputTokens;

function finish(task: Task, status: Status, reason?: string): Task {
  task.status = status;
  task.reason = reason;
  saveTask(task);
  audit({ kind: 'task', taskId: task.id, event: status, reason });
  return task;
}

// Runs steps until done, failed, or budget exhausted. Every step is checkpointed, so a killed
// process resumes from the last committed step. shortcut: an interrupted step is re-run, so
// non-idempotent tool side effects inside it may repeat; upgrade with per-call idempotency keys.
export async function runTask(id: string, adapter: AgentAdapter, root: string, maxSteps = 20): Promise<Task> {
  let task = loadTask(id);
  if (task.status === 'completed' || task.status === 'failed') return task;
  for (let i = 0; i < maxSteps; i++) {
    if (used(task.usage) >= task.tokenBudget) return finish(task, 'paused', `token budget ${task.tokenBudget} reached (${used(task.usage)} used)`);
    task.status = 'running';
    saveTask(task);
    let result: StepResult;
    try {
      result = await adapter.step({ task, root });
    } catch (e) {
      return finish(task, 'failed', (e as Error).message);
    }
    task = loadTask(id);
    task.steps++;
    task.usage = {
      inputTokens: task.usage.inputTokens + result.usage.inputTokens,
      outputTokens: task.usage.outputTokens + result.usage.outputTokens,
      costUsd: result.usage.costUsd === undefined ? task.usage.costUsd : (task.usage.costUsd ?? 0) + result.usage.costUsd,
    };
    task.adapterState = result.adapterState ?? task.adapterState;
    task.result = result.text ?? task.result;
    audit({ kind: 'step', taskId: id, step: task.steps, integration: task.integration, usage: result.usage, error: result.error });
    if (result.error) return finish(task, 'failed', result.error);
    if (result.done) return finish(task, 'completed');
    saveTask(task);
  }
  return finish(task, 'paused', `step limit ${maxSteps} reached`);
}
