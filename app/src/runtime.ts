import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { audit, placeIn, readJson, storageDir, storageDirs, writeJson } from './store.ts';

export type Status = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface Usage {
  inputTokens: number; // includes cachedInputTokens and cacheWriteTokens
  cachedInputTokens?: number; // input served from the provider's prompt cache, mostly the agent's fixed prompt
  cacheWriteTokens?: number; // input written to the prompt cache (the fixed prompt on a first or expired call), not task work
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
  messages?: Message[]; // the conversation; absent on tasks recorded before chat (see conversation())
  prompt?: string; // a user reply the next step must send; cleared once a step commits
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  from: 'user' | 'agent';
  text: string;
  at: string;
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

// A task's files live in its project's storage folder (store.ts); side files sit next to the task file.
export const taskFile = (id: string, suffix: string) => join(storageDir('tasks', id), `${id}${suffix}`);
const taskPath = (id: string) => taskFile(id, '.json');

export function saveTask(task: Task): void {
  task.updatedAt = new Date().toISOString();
  writeJson(taskPath(task.id), task);
}

export function loadTask(id: string): Task {
  const task = readJson<Task | null>(taskPath(id), null);
  if (!task) throw new Error(`Unknown task: ${id}`);
  return task;
}

// Task files are `<id>.json`; ids never contain dots, unlike the `<id>.live.json` side files.
export function listTasks(): Task[] {
  return storageDirs('tasks').flatMap((dir) => readdirSync(dir).filter((f) => /^[^.]+\.json$/.test(f)).map((f) => loadTask(f.slice(0, -5))));
}

export function createTask(fields: Pick<Task, 'projectId' | 'goal' | 'role' | 'integration' | 'model' | 'write' | 'tokenBudget' | 'parentId'>): Task {
  const now = new Date().toISOString();
  const task: Task = { ...fields, id: randomUUID().slice(0, 8), status: 'pending', usage: { inputTokens: 0, outputTokens: 0 }, steps: 0, messages: [{ from: 'user', text: fields.goal, at: now }], createdAt: now, updatedAt: now };
  placeIn('tasks', task.id, task.projectId);
  saveTask(task);
  audit({ kind: 'task', taskId: task.id, event: 'created', integration: task.integration, write: task.write });
  return task;
}

// The goal opens the conversation; older tasks only kept their last result.
export function conversation(task: Task): Message[] {
  if (task.messages) return task.messages;
  const messages: Message[] = [{ from: 'user', text: task.goal, at: task.createdAt }];
  if (task.result) messages.push({ from: 'agent', text: task.result, at: task.updatedAt });
  return messages;
}

// A follow-up message continues a finished or paused task in the same agent session.
export function replyTask(id: string, text: string): Task {
  const task = loadTask(id);
  if (task.status === 'cancelled') throw new Error('Task is cancelled');
  if (runnerAlive(id)) throw new Error('Task is already running');
  task.messages = [...conversation(task), { from: 'user', text, at: new Date().toISOString() }];
  task.prompt = text;
  task.status = 'pending';
  task.reason = undefined;
  saveTask(task);
  audit({ kind: 'task', taskId: id, event: 'reply' });
  return task;
}

// Prompt-cache traffic (read + write): mostly the agent's fixed prompt, shown apart from the task's own work.
export const cacheTokens = (u: Usage) => (u.cachedInputTokens ?? 0) + (u.cacheWriteTokens ?? 0);

export const used = (u: Usage) => u.inputTokens + u.outputTokens;

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cachedInputTokens: (a.cachedInputTokens ?? 0) + (b.cachedInputTokens ?? 0),
    cacheWriteTokens: (a.cacheWriteTokens ?? 0) + (b.cacheWriteTokens ?? 0),
    costUsd: a.costUsd === undefined && b.costUsd === undefined ? undefined : (a.costUsd ?? 0) + (b.costUsd ?? 0),
  };
}

// Usage of the step in progress, written by adapters that stream it, so the broker can enforce the
// budget mid-step. Kept apart from the task file, which another process may update during a step.
const livePath = (id: string) => taskFile(id, '.live.json');
const zero = (): Usage => ({ inputTokens: 0, outputTokens: 0 });
export const liveUsage = (id: string): Usage => readJson<Usage>(livePath(id), zero());
export const writeLiveUsage = (id: string, usage: Usage) => writeJson(livePath(id), usage);
const clearLiveUsage = (id: string) => rmSync(livePath(id), { force: true });

// Set by the broker when it refuses a call for budget, so a step that "finishes" early is paused, not completed.
const budgetStopPath = (id: string) => taskFile(id, '.budget-stop');
export const markBudgetStop = (id: string) => writeJson(budgetStopPath(id), true);
function takeBudgetStop(id: string): boolean {
  const stopped = readJson(budgetStopPath(id), false);
  rmSync(budgetStopPath(id), { force: true });
  return stopped;
}

// Cancel is cooperative: a marker the broker and the runner check, so it also works when the
// runner is another process. A cancelled parent cancels its delegated children.
const cancelPath = (id: string) => taskFile(id, '.cancel');
export function cancelRequested(id: string): boolean {
  const { parentId } = loadTask(id);
  return existsSync(cancelPath(id)) || (parentId !== undefined && existsSync(cancelPath(parentId)));
}

// The process running a task, so cancel can tell a live runner from one that crashed.
const runnerPath = (id: string) => taskFile(id, '.pid');
export const markRunner = (id: string, pid: number) => writeFileSync(runnerPath(id), String(pid));
export function runnerAlive(id: string): boolean {
  if (!existsSync(runnerPath(id))) return false;
  try {
    process.kill(Number(readFileSync(runnerPath(id), 'utf8')), 0); // signal 0 only probes
    return true;
  } catch {
    return false; // shortcut: a reused pid reads as alive and the task stays "running" until resumed; upgrade with a runner lease.
  }
}

// Folds a killed attempt's uncommitted step usage into the task.
function chargeStale(task: Task): void {
  const stale = liveUsage(task.id);
  if (used(stale) === 0) return;
  task.usage = addUsage(task.usage, { ...stale, costUsd: undefined });
  audit({ kind: 'step', taskId: task.id, step: task.steps + 1, interrupted: true, usage: stale });
  saveTask(task);
  clearLiveUsage(task.id);
}

export const terminal = (s: Status) => s === 'completed' || s === 'failed' || s === 'cancelled';

export function cancelTask(id: string): Task {
  const task = loadTask(id);
  if (terminal(task.status)) return task;
  writeJson(cancelPath(id), true);
  audit({ kind: 'task', taskId: id, event: 'cancel-requested' });
  if (task.status === 'running' && runnerAlive(id)) return task; // the runner finishes it
  chargeStale(task);
  return finish(task, 'cancelled', 'cancelled by user');
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
  if (terminal(task.status)) return task;
  markRunner(id, process.pid);
  try {
    return await steps(task, adapter, root, maxSteps);
  } finally {
    rmSync(runnerPath(id), { force: true });
  }
}

async function steps(task: Task, adapter: AgentAdapter, root: string, maxSteps: number): Promise<Task> {
  const id = task.id;
  for (let i = 0; i < maxSteps; i++) {
    // Tokens a killed attempt spent were never committed; charge them before re-running the step.
    chargeStale(task);
    if (cancelRequested(id)) return finish(task, 'cancelled', 'cancelled by user');
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
    task.usage = addUsage(task.usage, result.usage);
    task.adapterState = result.adapterState ?? task.adapterState;
    task.result = result.text ?? task.result;
    if (result.text) task.messages = [...conversation(task), { from: 'agent', text: result.text, at: new Date().toISOString() }];
    task.prompt = undefined;
    audit({ kind: 'step', taskId: id, step: task.steps, integration: task.integration, usage: result.usage, error: result.error });
    saveTask(task);
    clearLiveUsage(id);
    if (cancelRequested(id)) return finish(task, 'cancelled', 'cancelled by user');
    if (result.error) return finish(task, 'failed', result.error);
    if (takeBudgetStop(id)) return finish(task, 'paused', `token budget ${task.tokenBudget} reached mid-step (${used(task.usage)} used)`);
    if (result.done) return finish(task, 'completed');
  }
  return finish(task, 'paused', `step limit ${maxSteps} reached`);
}
