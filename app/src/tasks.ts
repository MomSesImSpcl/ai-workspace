// Tasks are sessions run in the background, optionally with a token cap (task-runtime 4.7, ADRs 0007, 0011): the agent starts
// with its own setup, its "ask" becomes an approval card that waits, and cancel or the cap ends its process
// tree. Status is read from the session's event log.
import { existsSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { assignmentFor } from './roles.ts';
import { addMessage, addUsage, allSessions, createSession, emit, loadSession, queueReply, readEvents, requestStop, saveSession, sessionFile, sessionWorking, turnRunning, turns, used, type Session, type SessionEvent, type Turn, type Usage } from './sessions.ts';
import { appendJsonl, audit, placeIn, readJson, storageDirs, writeJson } from './store.ts';
import { agentChoice, pending, sessionAgent, startTurn } from './turn.ts';

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

// agent, model, effort and reason: the orchestrator's choice (orchestrator-004); unset, the role's assignment.
// defaultMode: used when no mode is given and the agent offers it; basedOn: an earlier related task.
export interface NewTask { projectId: string; goal: string; role: string; tokenBudget?: number; permissionMode?: string; defaultMode?: string; parentId?: string; sessionId?: string; agent?: string; model?: string; effort?: string; reason?: string; basedOn?: string; title?: string }

// Tasks a chat starts edit files without asking unless the chat picks another mode; agents without this mode
// keep their own settings.
export const DEFAULT_TASK_MODE = 'acceptEdits';

// The goal is the first message. Agent, model, effort and mode must be ones the agent offers.
export function createTask(f: NewTask): Session {
  if (f.tokenBudget !== undefined && (!Number.isInteger(f.tokenBudget) || f.tokenBudget <= 0)) throw new Error('Unknown token budget: a positive whole number is required');
  const { integration, model, effort } = agentChoice({ integration: f.agent, model: f.model, effort: f.effort }, assignmentFor(f.role));
  const agent = sessionAgent(integration);
  if (f.permissionMode && !agent.catalog().modes?.some((m) => m.id === f.permissionMode)) throw new Error(`Unknown permission mode for ${integration}: ${f.permissionMode}`);
  const s = createSession(f.projectId, f.role, { integration, model });
  s.effort = effort;
  s.task = { tokenBudget: f.tokenBudget, parentId: f.parentId, sessionId: f.sessionId, reason: f.reason, basedOn: f.basedOn };
  const offers = (m?: string) => !!m && !!agent.catalog().modes?.some((x) => x.id === m);
  s.permissionMode = f.permissionMode || (offers(f.defaultMode) ? f.defaultMode : undefined);
  saveSession(s);
  if (f.title?.trim()) saveSession({ ...s, title: f.title.trim().slice(0, 80) }); // else the goal's first line names it
  addMessage(s.id, f.goal);
  audit({ kind: 'task', taskId: s.id, event: 'created', integration, model, effort, reason: f.reason, permissionMode: s.permissionMode, parentId: f.parentId, sessionId: f.sessionId });
  return loadSession(s.id);
}

// The workspace `start_task` tool of a chat session (sessions-002, ADR 0010): the task runs in the chat's
// project in the background, and the chat shows it inline in the turn that started it. The chat's runner
// starts it (startPendingTasks): a process started inside the agent's tree dies with it (Codex runs its MCP
// servers in a Windows job that is closed with the agent).
export function startFromSession(sessionId: string, f: Omit<NewTask, 'projectId' | 'parentId' | 'sessionId'>): Session {
  const chat = loadSession(sessionId);
  if (chat.task) throw new Error('Tasks start subtasks with delegate, not start_task');
  const t = createTask({ ...f, goal: f.basedOn ? `${f.goal}\n\n${handoff(chat.projectId, f.basedOn)}` : f.goal, tokenBudget: f.tokenBudget ?? chat.taskCap, defaultMode: chat.taskMode ?? DEFAULT_TASK_MODE, projectId: chat.projectId, sessionId });
  emit(sessionId, turns(readEvents(sessionId), true).at(-1)?.n ?? 0, { type: 'task', id: t.id });
  return t;
}

// Starts the chat's tasks that have a message no runner took: new tasks and replies sent with reply_task.
export function startPendingTasks(sessionId: string): void {
  for (const t of startedIn(sessionId)) if (!t.task!.cancelled && !turnRunning(t.id) && pending(t.id)) startTurn(t.id);
}

// A reply to a task started in this chat (the orchestrator's reply_task, orchestrator-006). The chat's runner
// starts it, like a new task.
export function replyFromSession(sessionId: string, taskId: string, text: string): Session {
  const t = startedIn(sessionId).find((x) => x.id === taskId);
  if (!t) throw new Error(`Unknown task in this chat: ${taskId}`);
  // A finished task is continued only by the user, from the reply field under it (orchestrator-006).
  const status = taskStatus(t, turns(readEvents(taskId), turnRunning(taskId)));
  if (status !== 'running' && status !== 'waiting' && status !== 'paused') throw new Error(`Task ${taskId} is ${status}; start a new task with basedOn: ${taskId}`);
  if (status === 'paused') queueReply(taskId, text); // sent with Resume
  else replyTask(taskId, text);
  // The chat shows the task again in this turn, where its new cards and result appear.
  emit(sessionId, turns(readEvents(sessionId), true).at(-1)?.n ?? 0, { type: 'task', id: taskId });
  return t;
}

// A reply to a working task is queued and sent when its turn ends; otherwise it continues the task at once.
export function replyTask(id: string, text: string): Session {
  if (!sessionWorking(id)) return resumeTask(id, undefined, text);
  const s = taskOf(id);
  if (s.task.cancelled) throw new Error('Task is cancelled');
  queueReply(id, text);
  return s;
}

// The reply field under a task goes to the task directly (option 2, chosen 2026-10-18 to test): the chat
// records it, so the orchestrator hears it with the next message and the card moves to the latest turn.
// Option 1, sending it through the orchestrator, stays open (ADR 0011).
export function relayToChat(task: Session, text: string): void {
  const chatId = task.task?.sessionId;
  if (!chatId) return;
  const n = turns(readEvents(chatId), true).at(-1)?.n ?? 0;
  emit(chatId, n, { type: 'relay', taskId: task.id, text });
  emit(chatId, n, { type: 'task', id: task.id });
}

// What a new task learns from an earlier related one (orchestrator-006): its goal and final reply, not its
// whole conversation, so it skips rediscovering the earlier work.
// shortcut: carries text only; add the tools the earlier task used once tasks run lean (orchestrator-005).
function handoff(projectId: string, id: string): string {
  const earlier = loadSession(id);
  if (!earlier.task || earlier.projectId !== projectId) throw new Error(`Unknown task in this project: ${id}`);
  const ts = turns(readEvents(id), turnRunning(id));
  const result = ts.findLast((t) => t.text)?.text ?? '(no reply yet)';
  return `Context from an earlier related task (${id}, ${taskStatus(earlier, ts)}).\nIts goal: ${ts[0]?.user.slice(0, 4000)}\nIts last reply: ${result.slice(-4000)}`;
}

// Pause interrupts a running task's turn; the agent keeps its conversation and Resume continues it (runtime-006).
export function pauseTask(id: string): Session {
  const s = taskOf(id);
  if (!sessionWorking(id)) throw new Error('Task is not running');
  requestStop(id);
  audit({ kind: 'task', taskId: id, event: 'paused' });
  return s;
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
const RESUME = 'Continue the task.';
export function resumeTask(id: string, tokenBudget?: number, text = RESUME): Session {
  const s = taskOf(id);
  if (sessionWorking(id)) throw new Error('Task is already running');
  if (tokenBudget !== undefined) s.task.tokenBudget = tokenBudget;
  if (s.task.tokenBudget !== undefined && taskUsed(s) >= s.task.tokenBudget) throw new Error(`Task is at its token budget (${taskUsed(s)} of ${s.task.tokenBudget} used); raise the budget to resume`);
  saveSession(s);
  addMessage(id, text, text === RESUME);
  return s;
}

const lastTurn = (id: string) => turns(readEvents(id), turnRunning(id)).at(-1);

// Runs a subtask under another role and returns its final reply (the workspace `delegate` tool). The child
// gets the parent's project, at most its remaining budget, and the parent's mode when it is the same agent.
// Delegating the same goal again reuses the child, so a resumed parent does not redo it.
export async function delegate(parentId: string, goal: string, role = 'Implementation'): Promise<string> {
  const parent = taskOf(parentId);
  if (parent.task.parentId) throw new Error('Delegation depth limit: subtasks cannot delegate');
  const remaining = parent.task.tokenBudget === undefined ? undefined : parent.task.tokenBudget - taskUsed(parent);
  if (remaining !== undefined && remaining <= 0) throw new Error('Parent token budget exhausted');
  let child = childrenOf(parentId).find((c) => turns(readEvents(c.id), true)[0]?.user === goal);
  if (child?.task?.cancelled) throw new Error(`Subtask ${child.id} was cancelled`);
  if (!child) {
    const { integration } = assignmentFor(role);
    child = createTask({ projectId: parent.projectId, goal, role, tokenBudget: remaining, permissionMode: integration === parent.integration ? parent.permissionMode : undefined, parentId });
    audit({ kind: 'delegate', taskId: parentId, childId: child.id, role, integration });
  } else if (lastTurn(child.id)?.state === 'done') {
    return `subtask ${child.id} completed\n${lastTurn(child.id)!.text}`;
  } else if (lastTurn(child.id)?.state !== 'working') {
    resumeTask(child.id, remaining === undefined ? undefined : used(usageOf(child.id)) + remaining);
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
