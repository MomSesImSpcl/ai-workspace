// Tasks are sessions run in the background with a token cap (task-runtime 4.7, ADR 0007): the agent starts
// with its own setup, its "ask" becomes an approval card that waits, and cancel or the cap ends its process
// tree. Status is read from the session's event log.
import { existsSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { assignmentFor } from './roles.ts';
import { addMessage, addUsage, allSessions, createSession, emit, loadSession, readEvents, requestStop, saveSession, sessionFile, sessionWorking, turnRunning, turns, used, type Session, type SessionEvent, type Turn, type Usage } from './sessions.ts';
import { appendJsonl, audit, placeIn, readJson, storageDirs, writeJson } from './store.ts';
import { sessionAgent, startTurn } from './turn.ts';

export type TaskStatus = 'running' | 'waiting' | 'completed' | 'failed' | 'paused' | 'interrupted' | 'cancelled';

export const listTasks = () => allSessions().filter((s) => s.task);
export const childrenOf = (id: string) => listTasks().filter((t) => t.task!.parentId === id);
export const startedIn = (sessionId: string) => listTasks().filter((t) => t.task!.sessionId === sessionId);

const zero = (): Usage => ({ inputTokens: 0, outputTokens: 0 });
export const usageOf = (id: string): Usage => turns(readEvents(id), true).reduce((u, t) => addUsage(u, t.usage), zero());

// Committed tokens of a task and its subtasks: the budget covers both.
export const taskUsed = (s: Session): number => used(usageOf(s.id)) + childrenOf(s.id).reduce((n, c) => n + used(usageOf(c.id)), 0);

export function taskStatus(s: Session, ts: Turn[]): TaskStatus {
  const last = ts.at(-1);
  if (s.task?.cancelled) return 'cancelled';
  if (!last || last.state === 'working') return last?.approvals.some((a) => a.allow === undefined) ? 'waiting' : 'running';
  return last.state === 'done' ? 'completed' : last.state === 'error' ? 'failed' : last.state === 'stopped' ? 'paused' : 'interrupted';
}

export interface NewTask { projectId: string; goal: string; role: string; tokenBudget: number; permissionMode?: string; parentId?: string; sessionId?: string }

// The goal is the first message. The agent comes from the role's assignment; the mode must be one the agent offers.
export function createTask(f: NewTask): Session {
  const { integration, model } = assignmentFor(f.role);
  const agent = sessionAgent(integration);
  if (f.permissionMode && !agent.catalog().modes?.some((m) => m.id === f.permissionMode)) throw new Error(`Unknown permission mode for ${integration}: ${f.permissionMode}`);
  const s = createSession(f.projectId, f.role, { integration, model });
  s.task = { tokenBudget: f.tokenBudget, parentId: f.parentId, sessionId: f.sessionId };
  s.permissionMode = f.permissionMode || undefined;
  saveSession(s);
  addMessage(s.id, f.goal);
  audit({ kind: 'task', taskId: s.id, event: 'created', integration, permissionMode: s.permissionMode, parentId: f.parentId, sessionId: f.sessionId });
  return loadSession(s.id);
}

// The workspace `start_task` tool of a chat session (sessions-002, ADR 0010): the task runs in the chat's
// project in the background, and the chat shows it inline in the turn that started it.
export function startFromSession(sessionId: string, f: Omit<NewTask, 'projectId' | 'parentId' | 'sessionId'>): Session {
  const chat = loadSession(sessionId);
  if (chat.task) throw new Error('Tasks start subtasks with delegate, not start_task');
  if (!Number.isInteger(f.tokenBudget) || f.tokenBudget <= 0) throw new Error('Unknown token budget: a positive whole number is required');
  const t = createTask({ ...f, projectId: chat.projectId, sessionId });
  emit(sessionId, turns(readEvents(sessionId), true).at(-1)?.n ?? 0, { type: 'task', id: t.id });
  startTurn(t.id);
  return t;
}

const taskOf = (id: string) => {
  const s = loadSession(id);
  if (!s.task) throw new Error(`Unknown task: ${id}`);
  return s as Session & { task: NonNullable<Session['task']> };
};

// Cancel ends a working agent's process tree at once (runtime-005) and cancels the subtasks.
export function cancelTask(id: string): Session {
  const s = taskOf(id);
  if (!s.task.cancelled) {
    s.task.cancelled = true;
    saveSession(s);
    audit({ kind: 'task', taskId: id, event: 'cancelled' });
  }
  if (sessionWorking(id)) requestStop(id);
  for (const c of childrenOf(id)) if (!c.task!.cancelled) cancelTask(c.id);
  return s;
}

// Continues a paused, interrupted or finished task, optionally with a new budget. An interrupted attempt's
// marker goes with the message, so the agent checks the project before repeating anything (sessions-009).
export function resumeTask(id: string, tokenBudget?: number, text = 'Continue the task.'): Session {
  const s = taskOf(id);
  if (sessionWorking(id)) throw new Error('Task is already running');
  if (tokenBudget !== undefined) s.task.tokenBudget = tokenBudget;
  if (taskUsed(s) >= s.task.tokenBudget) throw new Error(`Task is at its token budget (${taskUsed(s)} of ${s.task.tokenBudget} used); raise the budget to resume`);
  saveSession(s);
  addMessage(id, text);
  return s;
}

const lastTurn = (id: string) => turns(readEvents(id), turnRunning(id)).at(-1);

// Runs a subtask under another role and returns its final reply (the workspace `delegate` tool). The child
// gets the parent's project, at most its remaining budget, and the parent's mode when it is the same agent.
// Delegating the same goal again reuses the child, so a resumed parent does not redo it.
export async function delegate(parentId: string, goal: string, role = 'Implementation'): Promise<string> {
  const parent = taskOf(parentId);
  if (parent.task.parentId) throw new Error('Delegation depth limit: subtasks cannot delegate');
  const remaining = parent.task.tokenBudget - taskUsed(parent);
  if (remaining <= 0) throw new Error('Parent token budget exhausted');
  let child = childrenOf(parentId).find((c) => turns(readEvents(c.id), true)[0]?.user === goal);
  if (child?.task?.cancelled) throw new Error(`Subtask ${child.id} was cancelled`);
  if (!child) {
    const { integration } = assignmentFor(role);
    child = createTask({ projectId: parent.projectId, goal, role, tokenBudget: remaining, permissionMode: integration === parent.integration ? parent.permissionMode : undefined, parentId });
    audit({ kind: 'delegate', taskId: parentId, childId: child.id, role, integration });
  } else if (lastTurn(child.id)?.state === 'done') {
    return `subtask ${child.id} completed\n${lastTurn(child.id)!.text}`;
  } else if (lastTurn(child.id)?.state !== 'working') {
    resumeTask(child.id, used(usageOf(child.id)) + remaining);
  }
  startTurn(child.id);
  let last = lastTurn(child.id);
  while (last?.state === 'working') {
    await sleep(500);
    last = lastTurn(child.id);
  }
  const status = taskStatus(loadSession(child.id), last ? [last] : []);
  if (status !== 'completed') throw new Error(`subtask ${child.id} ${status}${last?.marker ? `: ${last.marker}` : ''}${last?.error ? ` (${last.error})` : ''}`);
  return `subtask ${child.id} completed\n${last!.text}`;
}

// --- Tasks recorded before they were sessions (core slice 1): converted once into task sessions with the
// same id. The old file is kept as `<id>.migrated.json`; its write grant and effect ledger no longer apply.
interface LegacyTask {
  id: string; projectId: string; goal: string; role: string; integration: string; model?: string; parentId?: string;
  status: string; reason?: string; tokenBudget: number; usage: Usage; result?: string;
  messages?: { from: 'user' | 'agent'; text: string; at: string }[]; createdAt: string; updatedAt: string;
}

function pidAlive(path: string): boolean {
  try { process.kill(Number(readFileSync(path, 'utf8')), 0); return true; } catch { return false; }
}

export function migrateTasks(): number {
  let n = 0;
  for (const dir of storageDirs('tasks')) {
    for (const f of readdirSync(dir).filter((name) => /^[^.]+\.json$/.test(name))) {
      const id = f.slice(0, -5);
      let t: LegacyTask | null;
      try { t = readJson<LegacyTask | null>(join(dir, f), null); } catch { continue; }
      if (!t || typeof t.projectId !== 'string' || pidAlive(join(dir, `${id}.pid`))) continue;
      if (!allSessions().some((s) => s.id === id)) {
        placeIn('sessions', id, t.projectId);
        const messages = t.messages ?? [{ from: 'user' as const, text: t.goal, at: t.createdAt }, ...(t.result ? [{ from: 'agent' as const, text: t.result, at: t.updatedAt }] : [])];
        const lines: SessionEvent[] = [];
        let turn = 0;
        for (const m of messages) {
          if (m.from === 'user') lines.push({ at: m.at, turn: ++turn, type: 'user', text: m.text });
          else if (turn) lines.push({ at: m.at, turn, type: 'text', text: m.text }, { at: m.at, turn, type: 'done' });
        }
        const at = t.updatedAt;
        lines.push({ at, turn, type: 'usage', usage: t.usage });
        if (t.status === 'failed') lines.push({ at, turn, type: 'error', message: t.reason ?? 'failed' });
        else if (t.status === 'paused' || t.status === 'cancelled') lines.push({ at, turn, type: 'stopped', reason: t.status === 'paused' ? t.reason : undefined });
        else if (t.status !== 'completed') lines.push({ at, turn, type: 'interrupted', step: 0 });
        for (const l of lines) appendJsonl(sessionFile(id, '.jsonl'), l);
        const s: Session = { id, projectId: t.projectId, title: t.goal.split('\n')[0]!.slice(0, 60), role: t.role, integration: t.integration, model: t.model, task: { tokenBudget: t.tokenBudget, parentId: t.parentId, cancelled: t.status === 'cancelled' || undefined }, createdAt: t.createdAt, updatedAt: t.updatedAt };
        writeJson(sessionFile(id, '.json'), s);
        n++;
      }
      if (existsSync(join(dir, f))) renameSync(join(dir, f), join(dir, `${id}.migrated.json`));
    }
  }
  return n;
}
