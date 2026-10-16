import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
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
  parentId?: string;
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

export function createTask(fields: Pick<Task, 'projectId' | 'goal' | 'role' | 'integration' | 'model' | 'write' | 'tokenBudget' | 'parentId'>): Task {
  const now = new Date().toISOString();
  const task: Task = { ...fields, id: randomUUID().slice(0, 8), status: 'pending', usage: { inputTokens: 0, outputTokens: 0 }, steps: 0, createdAt: now, updatedAt: now };
  saveTask(task);
  audit({ kind: 'task', taskId: task.id, event: 'created', integration: task.integration, write: task.write });
  return task;
}

export const used = (u: Usage) => u.inputTokens + u.outputTokens;

// Usage of the step in progress, written by adapters that stream it, so the broker can enforce the
// budget mid-step. Kept apart from the task file, which another process may update during a step.
const livePath = (id: string) => join(home(), 'tasks', `${id}.live.json`);
const zero = (): Usage => ({ inputTokens: 0, outputTokens: 0 });
export const liveUsage = (id: string): Usage => readJson<Usage>(livePath(id), zero());
export const writeLiveUsage = (id: string, usage: Usage) => writeJson(livePath(id), usage);
const clearLiveUsage = (id: string) => rmSync(livePath(id), { force: true });

// Set by the broker when it refuses a call for budget, so a step that "finishes" early is paused, not completed.
const budgetStopPath = (id: string) => join(home(), 'tasks', `${id}.budget-stop`);
export const markBudgetStop = (id: string) => writeJson(budgetStopPath(id), true);
function takeBudgetStop(id: string): boolean {
  const stopped = readJson(budgetStopPath(id), false);
  rmSync(budgetStopPath(id), { force: true });
  return stopped;
}

function finish(task: Task, status: Status, reason?: string): Task {
  task.status = status;
  task.reason = reason;
  saveTask(task);
  audit({ kind: 'task', taskId: task.id, event: status, reason });
  return task;
}

// Runs steps until done, failed, or budget exhausted. Every step is checkpointed, so a killed
// process resumes from the last committed step. The interrupted step is re-run; the broker's effect
// ledger keeps its already-committed side effects from repeating.
export async function runTask(id: string, adapter: AgentAdapter, root: string, maxSteps = 20): Promise<Task> {
  let task = loadTask(id);
  if (task.status === 'completed' || task.status === 'failed') return task;
  for (let i = 0; i < maxSteps; i++) {
    // Tokens a killed attempt spent were never committed; charge them before re-running the step.
    const stale = liveUsage(id);
    if (used(stale) > 0) {
      task.usage = { ...task.usage, inputTokens: task.usage.inputTokens + stale.inputTokens, outputTokens: task.usage.outputTokens + stale.outputTokens };
      audit({ kind: 'step', taskId: id, step: task.steps + 1, interrupted: true, usage: stale });
      saveTask(task);
      clearLiveUsage(id);
    }
    if (used(task.usage) >= task.tokenBudget) return finish(task, 'paused', `token budget ${task.tokenBudget} reached (${used(task.usage)} used)`);
    task.status = 'running';
    saveTask(task);
    let result: StepResult;
    try {
      result = await adapter.step({ task, root });
    } catch (e) {
      clearLiveUsage(id);
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
    saveTask(task);
    clearLiveUsage(id);
    if (result.error) return finish(task, 'failed', result.error);
    if (takeBudgetStop(id)) return finish(task, 'paused', `token budget ${task.tokenBudget} reached mid-step (${used(task.usage)} used)`);
    if (result.done) return finish(task, 'completed');
  }
  return finish(task, 'paused', `step limit ${maxSteps} reached`);
}
