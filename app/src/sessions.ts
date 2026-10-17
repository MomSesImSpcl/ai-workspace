import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendJsonl, audit, getProject, getWorkspaceRoot, home, placeIn, projectStorage, readJson, storageDir, writeJson } from './store.ts';
import { addUsage, type Usage } from './runtime.ts';

// A session is a conversation in one project (sessions-001/002). Its history is an append-only
// event log in workspace storage (sessions-003/020); the chat display is built from it.
export interface Session {
  id: string;
  projectId: string;
  title: string;
  role: string;
  integration: string;
  model?: string;
  effort?: string; // unset: the agent's own default; valid values come from the agent's catalog
  archived?: boolean;
  pinOrder?: number; // set when pinned; pinned sessions are listed first in this order
  vendorSessionId?: string; // hint for continuing the agent's own conversation, never the history
  createdAt: string;
  updatedAt: string;
}

// The one event contract every adapter reports (sessions-020). `turn` numbers the user's messages.
export type SessionEvent = { at: string; turn: number } & (
  | { type: 'user'; text: string }
  | { type: 'start'; integration: string }
  | { type: 'init'; model?: string; permissionMode?: string; ruleFiles?: string[]; plugins?: string[]; mcp?: { name: string; status: string }[]; skills?: number }
  | { type: 'text'; text: string }
  | { type: 'notice'; text: string; blocked?: boolean }
  | { type: 'switch'; from: string; to: string; model?: string } // the session moved to another agent (sessions-015) // a message from the agent or its plugins, e.g. a hook that dropped the prompt
  | { type: 'activity'; id: string; label: string; outside?: boolean }
  | { type: 'activity-done'; id: string; error?: boolean }
  | { type: 'approval'; id: string; tool: string; detail: string }
  | { type: 'approval-answer'; id: string; allow: boolean }
  | { type: 'usage'; usage: Usage }
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'stopped' }
  | { type: 'interrupted'; step: number; label?: string }
);
export type Body = SessionEvent extends infer E ? (E extends SessionEvent ? Omit<E, 'at' | 'turn'> : never) : never;

export interface TurnInput {
  session: Session;
  root: string;
  turn: number;
  prompt: string;
  history: string; // earlier turns as text, for agents that cannot resume their own conversation
  emit: (body: Body) => void;
  signal: AbortSignal; // aborted on Stop
}

// One agent product in a session: it runs with its own tools, settings and permissions (ADR 0004)
// and reports the event contract. The runner records done, error and stopped.
// What an agent offers, recorded when it is set up (onboarding-008): its models and, per model, the effort
// levels it accepts. The composer and later the orchestrator choose only from this.
export interface AgentModel { id: string; label: string; efforts: string[]; defaultEffort?: string }
export interface Catalog { models: AgentModel[] } // id '' is the agent's own default model

export interface SessionAgent {
  turn(input: TurnInput): Promise<{ vendorSessionId?: string; error?: string }>;
  permissions(root: string): { line: string; warn?: string };
  catalog(): Catalog;
}

// A session's files live in its project's (or the global) storage folder, see store.ts.
export const sessionFile = (id: string, suffix: string) => join(storageDir('sessions', id), `${id}${suffix}`);
const sessionPath = (id: string) => sessionFile(id, '.json');
const eventsPath = (id: string) => sessionFile(id, '.jsonl');
const runnerPath = (id: string) => sessionFile(id, '.pid');
const stopPath = (id: string) => sessionFile(id, '.stop');

// Runs an agent CLI and hands each stdout line to onLine. Abort ends the whole process tree, since
// agents start their own subprocesses (commands, MCP servers).
export function runLines(bin: string, args: string[], opts: { cwd: string; env?: NodeJS.ProcessEnv; signal: AbortSignal }, onLine: (line: string) => void): Promise<{ code: number | null; err: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let pending = '';
    let err = '';
    const kill = () => {
      if (process.platform === 'win32' && child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
      else child.kill('SIGTERM');
    };
    opts.signal.addEventListener('abort', kill, { once: true });
    child.stdout.on('data', (d) => {
      pending += d;
      const parts = pending.split('\n');
      pending = parts.pop() ?? '';
      for (const l of parts) if (l.trim()) onLine(l.trim());
    });
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => {
      opts.signal.removeEventListener('abort', kill);
      if (pending.trim()) onLine(pending.trim());
      resolve({ code, err: err.trim() });
    });
  });
}

export function saveSession(s: Session): void {
  s.updatedAt = new Date().toISOString();
  writeJson(sessionPath(s.id), s);
}

export function loadSession(id: string): Session {
  const s = readJson<Session | null>(sessionPath(id), null);
  if (!s) throw new Error(`Unknown session: ${id}`);
  return s;
}

// Global sessions belong to no project; they run in the workspace folder (sessions-014).
export const GLOBAL = '';

export function sessionRoot(s: Pick<Session, 'projectId'>): string {
  if (s.projectId !== GLOBAL) return getProject(s.projectId).root;
  const root = getWorkspaceRoot();
  if (!root) throw new Error('Session is global: set the workspace folder in Settings first');
  return root;
}

// Pinned first (in their pin order), then newest activity first.
export function listSessions(projectId: string): Session[] {
  // The flat legacy folder still holds items whose runner was alive during migration.
  const dirs = [join(projectStorage(projectId), 'sessions'), join(home(), 'sessions')].filter((d) => existsSync(d));
  return dirs.flatMap((dir) => readdirSync(dir).filter((f) => /^[^.]+\.json$/.test(f)).map((f) => loadSession(f.slice(0, -5))))
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => (a.pinOrder ?? Infinity) - (b.pinOrder ?? Infinity) || b.updatedAt.localeCompare(a.updatedAt));
}

// Pinning does not count as activity, so updatedAt stays as it was.
function savePin(s: Session, pinOrder: number | undefined): void {
  s.pinOrder = pinOrder;
  writeJson(sessionPath(s.id), s);
}

export function setPinned(id: string, pinned: boolean): Session {
  const s = loadSession(id);
  const last = Math.max(-1, ...listSessions(s.projectId).map((x) => x.pinOrder ?? -1));
  savePin(s, pinned ? (s.pinOrder ?? last + 1) : undefined);
  return s;
}

// Drag and drop: the pinned sessions of one list in their new order.
export function reorderPinned(ids: string[]): void {
  ids.forEach((id, i) => {
    const s = loadSession(id);
    if (s.pinOrder !== undefined) savePin(s, i);
  });
}

// The agent and model come from the role's assignment (Settings), like tasks.
export function createSession(projectId: string, role: string, assignment: { integration: string; model?: string }): Session {
  sessionRoot({ projectId });
  const now = new Date().toISOString();
  const s: Session = { id: randomUUID().slice(0, 8), projectId, title: 'New session', role, ...assignment, createdAt: now, updatedAt: now };
  placeIn('sessions', s.id, projectId);
  saveSession(s);
  audit({ kind: 'session', sessionId: s.id, event: 'created', projectId, role, integration: s.integration });
  return s;
}

export function deleteSession(id: string): void {
  if (sessionWorking(id)) throw new Error('Session is working; stop it first');
  loadSession(id);
  for (const p of [sessionPath(id), eventsPath(id), stopPath(id), sessionFile(id, '.log')]) rmSync(p, { force: true });
  audit({ kind: 'session', sessionId: id, event: 'deleted' });
}

export function readEvents(id: string): SessionEvent[] {
  if (!existsSync(eventsPath(id))) return [];
  return readFileSync(eventsPath(id), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as SessionEvent);
}

// Every event goes to the session log and the workspace audit log.
export function emit(id: string, turn: number, body: Body): void {
  const event = { at: new Date().toISOString(), turn, ...body } as SessionEvent;
  appendJsonl(eventsPath(id), event);
  audit({ kind: 'session', sessionId: id, ...event });
}

// The turn runner is its own process (so a closed window lets the reply finish, sessions-011).
// The runner (a session host, or a one-turn runner) holds `<id>.pid`, created exclusively, so a
// session never has two. `<id>.starting` covers the moment between spawning it and it taking the lock.
const startingPath = (id: string) => sessionFile(id, '.starting');
const STARTING_MS = 20_000;

function pidIn(path: string): boolean {
  try {
    process.kill(Number(readFileSync(path, 'utf8')), 0);
    return true;
  } catch {
    return false; // shortcut: a reused pid reads as alive; upgrade with a runner lease (same as tasks).
  }
}

export const markStarting = (id: string) => writeFileSync(startingPath(id), String(Date.now()));

export function acquireRunner(id: string): boolean {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(runnerPath(id), String(process.pid), { flag: 'wx' });
      rmSync(startingPath(id), { force: true });
      return true;
    } catch {
      if (pidIn(runnerPath(id))) return false;
      rmSync(runnerPath(id), { force: true }); // left by a runner that died
    }
  }
  return false;
}

export function releaseRunner(id: string): void {
  try { if (readFileSync(runnerPath(id), 'utf8') === String(process.pid)) rmSync(runnerPath(id), { force: true }); } catch { /* already gone */ }
}

// A runner process exists (it may be idle between turns).
export function turnRunning(id: string): boolean {
  if (existsSync(runnerPath(id)) && pidIn(runnerPath(id))) return true;
  try { return Date.now() - Number(readFileSync(startingPath(id), 'utf8')) < STARTING_MS; } catch { return false; }
}

// The agent is working on a turn: a runner exists and the last turn has not ended.
export function sessionWorking(id: string): boolean {
  return turnRunning(id) && turns(readEvents(id), true).at(-1)?.state === 'working';
}

// Stop is a marker the runner watches, so it works across processes and platforms (sessions-010).
export const requestStop = (id: string) => writeJson(stopPath(id), true);
export const stopRequested = (id: string) => existsSync(stopPath(id));
export const clearStop = (id: string) => rmSync(stopPath(id), { force: true });

export type TurnState = 'working' | 'done' | 'error' | 'stopped' | 'interrupted';

export interface Turn {
  n: number;
  user: string;
  text: string;
  activity: { id: string; label: string; done: boolean; error?: boolean; outside?: boolean }[];
  approvals: { id: string; tool: string; detail: string; allow?: boolean }[];
  notices: { text: string; blocked?: boolean }[];
  switchedTo?: { from: string; to: string; model?: string }; // after this turn the session moved to another agent
  state: TurnState;
  error?: string;
  usage: Usage;
  model?: string;
  permissionMode?: string;
  ruleFiles?: string[];
  plugins?: string[]; // what the agent loaded from its own setup, reported, never configured here
  mcp?: { name: string; status: string }[];
  skills?: number;
  startedAt: string;
  endedAt?: string;
  marker?: string; // "Interrupted after step N: …" when the turn did not finish (sessions-008)
}

const zero = (): Usage => ({ inputTokens: 0, outputTokens: 0 });

// Folds the log into turns. A turn without an end event whose runner is gone was interrupted
// (app or computer shutdown, crash).
export function turns(events: SessionEvent[], running: boolean): Turn[] {
  const out: Turn[] = [];
  for (const e of events) {
    if (e.type === 'user') {
      out.push({ n: e.turn, user: e.text, text: '', activity: [], approvals: [], notices: [], state: 'working', usage: zero(), startedAt: e.at });
      continue;
    }
    const t = out.findLast((x) => x.n === e.turn);
    if (!t) continue;
    if (e.type === 'text') t.text += e.text;
    else if (e.type === 'notice') t.notices.push({ text: e.text, blocked: e.blocked });
    else if (e.type === 'switch') t.switchedTo = { from: e.from, to: e.to, model: e.model };
    else if (e.type === 'init') Object.assign(t, { model: e.model, permissionMode: e.permissionMode, ruleFiles: e.ruleFiles, plugins: e.plugins, mcp: e.mcp, skills: e.skills });
    else if (e.type === 'activity') t.activity.push({ id: e.id, label: e.label, done: false, outside: e.outside });
    else if (e.type === 'activity-done') Object.assign(t.activity.find((a) => a.id === e.id) ?? {}, { done: true, error: e.error });
    else if (e.type === 'approval') t.approvals.push({ id: e.id, tool: e.tool, detail: e.detail });
    else if (e.type === 'approval-answer') Object.assign(t.approvals.find((a) => a.id === e.id) ?? {}, { allow: e.allow });
    else if (e.type === 'usage') t.usage = addUsage(t.usage, e.usage);
    else if (e.type === 'done' || e.type === 'stopped' || e.type === 'interrupted') Object.assign(t, { state: e.type === 'done' ? 'done' : e.type, endedAt: e.at });
    else if (e.type === 'error') Object.assign(t, { state: 'error', error: e.message, endedAt: e.at });
  }
  const last = out.at(-1);
  if (last?.state === 'working' && !running) last.state = 'interrupted';
  for (const t of out) if (t.state !== 'done' && t.state !== 'working') t.marker = marker(t);
  return out;
}

function marker(t: Turn): string {
  const done = t.activity.filter((a) => a.done);
  const what = t.state === 'stopped' ? 'Stopped' : t.state === 'error' ? 'Failed' : 'Interrupted';
  return done.length ? `${what} after step ${done.length}: ${done.at(-1)!.label}` : `${what} before the first step`;
}

// The conversation as text, for agents that cannot resume their own (Codex exec, an expired hint).
export function transcript(ts: Turn[]): string {
  return ts.map((t) => `User: ${t.user}${t.text ? `\n\nYou: ${t.text}` : ''}${t.marker ? `\n\n[${t.marker}]` : ''}`).join('\n\n');
}

// Records the user's message as a new turn. If the last turn did not finish, its marker is recorded
// and passed to the agent with the message, so user and agent see the same last step (sessions-009).
export function addMessage(id: string, text: string): number {
  const s = loadSession(id);
  if (sessionWorking(id)) throw new Error('Session is already working');
  const events = readEvents(id);
  const ts = turns(events, false);
  const last = ts.at(-1);
  const turn = (last?.n ?? 0) + 1;
  if (last && last.state === 'interrupted' && !events.some((e) => e.turn === last.n && e.type === 'interrupted')) {
    emit(id, last.n, { type: 'interrupted', step: last.activity.filter((a) => a.done).length, label: last.activity.filter((a) => a.done).at(-1)?.label });
  }
  emit(id, turn, { type: 'user', text });
  if (s.title === 'New session') s.title = text.split('\n')[0].slice(0, 60);
  saveSession(s);
  clearStop(id);
  return turn;
}

// The last turn's message, prefixed with the previous turn's marker when it did not finish.
export function turnPrompt(ts: Turn[]): string {
  const [prev, cur] = [ts.at(-2), ts.at(-1)!];
  return prev?.marker ? `[${prev.marker}. Check the current project state before repeating anything.]\n\n${cur.user}` : cur.user;
}
