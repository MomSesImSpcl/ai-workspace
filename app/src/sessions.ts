import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import type { SetupItem } from './setup.ts';
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendJsonl, audit, getProject, getWorkspaceRoot, home, placeIn, projectStorage, readJson, storageDir, storageDirs, writeJson } from './store.ts';
import { planWorktree, type Worktree, type WorktreeChoice } from './worktrees.ts';

export interface Usage {
  inputTokens: number; // includes cachedInputTokens and cacheWriteTokens
  cachedInputTokens?: number; // input served from the provider's prompt cache, mostly the agent's fixed prompt
  cacheWriteTokens?: number; // input written to the prompt cache (the fixed prompt on a first or expired call), not task work
  outputTokens: number;
  costUsd?: number; // reported by the provider; subscription agents may report an estimate or nothing
}

// Prompt-cache traffic (read + write): mostly the agent's fixed prompt, shown apart from the work itself.
export const cacheTokens = (u: Usage) => (u.cachedInputTokens ?? 0) + (u.cacheWriteTokens ?? 0);
// Tokens at their real cost, in input-token equivalents: a prompt-cache read costs about a tenth of an input
// token and a cache write about a quarter more (Anthropic list prices; OpenAI charges no write premium). The budget
// and every display use this, so resending the agent's fixed prompt each call counts at what it costs.
// shortcut: one weighting for every provider and model; upgrade with per-agent weights from onboarding (onboarding-009).
export const CACHE_READ = 0.1;
export const CACHE_WRITE = 1.25;
export const used = (u: Usage) => Math.round(u.inputTokens - cacheTokens(u) + u.outputTokens + CACHE_READ * (u.cachedInputTokens ?? 0) + CACHE_WRITE * (u.cacheWriteTokens ?? 0));

// A turn's usage as shown: what it streamed so far while it works, its recorded usage once it ended.
export const turnUsage = (t: { state: string; usage: Usage; liveUsage?: Usage }) => (t.state === 'working' && t.liveUsage ? t.liveUsage : t.usage);

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cachedInputTokens: (a.cachedInputTokens ?? 0) + (b.cachedInputTokens ?? 0),
    cacheWriteTokens: (a.cacheWriteTokens ?? 0) + (b.cacheWriteTokens ?? 0),
    costUsd: a.costUsd === undefined && b.costUsd === undefined ? undefined : (a.costUsd ?? 0) + (b.costUsd ?? 0),
  };
}

// Background tasks have no one to answer a user rule that waits for a reply, such as an effort suggestion.
// Plain chats and tasks see read_repo only in their tool list; this sentence makes them try it (#31).
export const READ_REPO_NOTE = 'For commit history, pull requests, checks and issues of a workspace project, use the workspace tool read_repo.';
export const TASK_NOTE = 'This is a background task: nobody answers until it ends, and its effort level is set by the workspace. Do not stop to suggest an effort level or ask to confirm one; do the work.';

// A session of the orchestrator role (orchestrator-006, ADR 0011). The workspace also blocks its edit tools,
// whatever agent the role uses, so this rule is not the only guard.
export const ORCHESTRATION = 'Orchestration';
export const ORCHESTRATOR_TOOLS = ['start_task', 'reply_task', 'task_status', 'list_agents', 'rename_task', 'read_repo']; // its workspace tools, run without a card
export const ORCHESTRATOR_NOTE = `You are the workspace orchestrator. You never do the work yourself and cannot edit files or run commands. For every message, apply this rule: (1) It changes or corrects the work of a task of this chat that is still running (task_status): send it to that task with reply_task. (2) It asks for anything to be done (create, change, fix, run, set up, write or research something), including more work like a finished task's, or a correction of a finished task: start a new task with start_task, and tell the user it is a new task. When an earlier task of this chat is related, pass its id as basedOn, so the new task starts with that task's goal and result. Read list_agents for the current roles. For implementation tasks, use role Implementation and its currently configured agent and model; omit agent and model in start_task to inherit them unless the user explicitly overrides them. Only an explicit user override permits a different implementer or model. Never switch integration because another agent exposes more setup items or tools. Choose a supported effort from the selected model's catalog and give a one-line reason and a short title of a few words. Size the goal to the task: one or two sentences for a simple, clear request; add acceptance criteria only when the outcome is not obvious; never ask the task to read rule files or to verify more than the request needs. Pass tokenBudget only when the user asked for a cap or accepted your suggestion of one. (3) It only asks a question (about the code, a task's state or why it failed): answer it yourself, reading files, task_status, and read_repo for commit history, pull requests, checks and issues of any workspace project. Ask back only when you cannot name both what to change and the expected outcome, or when a message could either change a running task or be new work. Choosing each task's effort is your job: do not stop to suggest or confirm an effort level. The user continues a finished task with the reply field under it, not through you. To change a task's title, use rename_task. A task starts with its role's always-on items and the agent's capabilities that have no setup switch. list_agents.setup lists only decidable items; setupStatus lists alwaysOn ids and whether requiresBuiltInTool applies. Pass in setup only ids listed for the selected agent that the goal needs. When requiresBuiltInTool is true, ensure at least one built-in tool is enabled (always on or selected): Claude Code uses tool:Read, tool:Edit, tool:Write and tool:Bash. Codex has no tool:* setup ids; its shell is feature:shell_tool, normally always on for implementation tasks. Do not invent equivalent tool:* ids or treat a shorter setup list as missing capabilities. prompt selects the agent's own guidance, not tools. A task that finds setup missing must request it with request_setup and continue on the same agent; if setup is unavailable or switched off by the user, report a blocker rather than switch agents or bypass permissions; a task based on an earlier one keeps that one's items.`;

// The user's own instructions per role (Settings, optional): chat for plain chats, orchestrator for orchestrator
// chats, implementation for tasks. They apply when the agent starts next.
export const INSTRUCTIONS = ['chatInstructions', 'orchestratorInstructions', 'implementationInstructions'] as const;
type Settings = Partial<Record<(typeof INSTRUCTIONS)[number], string>>;
const settingsPath = () => join(home(), 'settings.json');
export const getSettings = () => readJson<Settings>(settingsPath(), {});
export const setSettings = (v: Settings) => writeJson(settingsPath(), { ...getSettings(), ...v });
export function ownInstructions(key: (typeof INSTRUCTIONS)[number]): string {
  const own = getSettings()[key]?.trim();
  return own ? ` The user's own instructions for you, which take precedence over the notes above where they conflict: ${own}` : '';
}
export const orchestratorNote = () => ORCHESTRATOR_NOTE + ownInstructions('orchestratorInstructions');

// Identifies a tool call by tool and input, so a repeat after an interruption is recognised (runtime-004).
export const fingerprint = (tool: string, input: unknown) => createHash('sha256').update(`${tool}\n${JSON.stringify(input)}`).digest('hex').slice(0, 16);

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
  permissionMode?: string; // the agent's own mode for this session (catalog `modes`); unset: the agent's settings
  task?: TaskSpec; // set for a task: delegated background work, optionally with a token cap (task-runtime 4.7)
  taskCap?: number; // a chat's cap for the tasks it starts (the switch next to the chat box); unset: uncapped
  taskMode?: string; // the permission mode of the tasks a chat starts; unset: acceptEdits, '': the agent's settings
  worktree?: Worktree; // the session's own git worktree (selfdev-001); a task shares its chat's; unset: the project folder
  createdAt: string;
  updatedAt: string;
}

export interface TaskSpec {
  tokenBudget?: number; // unset: uncapped (ADR 0011)
  reason?: string; // why the orchestrator chose its agent, model and effort (orchestrator-004)
  overridden?: boolean; // the user changed that choice
  basedOn?: string; // an earlier related task whose goal and reply this one started with
  parentId?: string; // a subtask started by the parent's `delegate` call
  sessionId?: string; // the chat that started it (sessions-002): its approvals, replies and result show there
  cancelled?: boolean;
  setup?: string[]; // ids of the agent's setup items the orchestrator picked for this task (orchestrator-005)
  setupAdded?: string[]; // items the task asked for with request_setup; it continues with them after this turn
}

// The one event contract every adapter reports (sessions-020). `turn` numbers the user's messages.
export type SessionEvent = { at: string; turn: number } & (
  | { type: 'user'; text: string; resume?: boolean } // resume: Resume of a paused task, not a new message
  | { type: 'start'; integration: string }
  | { type: 'init'; model?: string; permissionMode?: string; ruleFiles?: string[]; plugins?: string[]; mcp?: { name: string; status: string }[]; skills?: number }
  | { type: 'text'; text: string }
  | { type: 'notice'; text: string; blocked?: boolean }
  | { type: 'queued'; text: string } // a reply that arrived while the task worked; sent with its next message
  | { type: 'relay'; taskId: string; text: string } // the user wrote to a task of this chat directly; the agent hears it with the next message
  | { type: 'switch'; from: string; to: string; model?: string } // the session moved to another agent (sessions-015) // a message from the agent or its plugins, e.g. a hook that dropped the prompt
  | { type: 'activity'; id: string; label: string; outside?: boolean; fp?: string }
  | { type: 'activity-done'; id: string; error?: boolean }
  | { type: 'approval'; id: string; tool: string; detail: string; repeat?: string }
  | { type: 'approval-answer'; id: string; allow: boolean }
  | { type: 'task'; id: string } // the agent started this task from the chat (sessions-002)
  | { type: 'usage'; usage: Usage }
  | { type: 'live-usage'; usage: Usage } // the running turn's usage so far, replaced by its 'usage' when it ends
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'stopped'; reason?: string } // reason: the workspace stopped it (budget, a repeat), not the user
  | { type: 'interrupted'; step: number; label?: string }
);
export type Body = SessionEvent extends infer E ? (E extends SessionEvent ? Omit<E, 'at' | 'turn'> : never) : never;

export interface TurnInput {
  prompt: string;
  history: string; // earlier turns as text, for an agent that cannot resume its own conversation
  emit: (body: Body) => void;
  signal: AbortSignal; // aborted on Stop; reason 'kill' ends the process tree at once instead of interrupting
  live?: (usage: Usage) => void; // the turn's usage so far, as the agent streams it (budget, runtime-005)
  repeats?: Map<string, string>; // fingerprints the interrupted attempt completed, with their step label
}

export interface TurnEnd { vendorSessionId?: string; error?: string; staleHint?: boolean; stopped?: string }

// One running agent for a session: started with its own tools, settings and permissions (ADR 0004),
// it answers many turns and reports the event contract. The runner records done, error and stopped.
export interface AgentProcess {
  readonly model?: string;
  readonly effort?: string;
  readonly permissionMode?: string; // what it was started with; a change needs a new process
  readonly setup?: string; // a task's picked setup items it was started with, joined
  turn(input: TurnInput): Promise<TurnEnd>;
  close(): void;
}

// What an agent offers, recorded when it is set up (onboarding-008): its models and, per model, the effort
// levels it accepts, and its own permission modes. The composer and later the orchestrator choose only from this.
export interface AgentModel { id: string; label: string; efforts: string[]; defaultEffort?: string }
export interface AgentMode { id: string; label: string; hint?: string; warn?: boolean } // warn: skips every check
export interface Catalog { models: AgentModel[]; modes?: AgentMode[] } // id '' is the agent's own default

export interface SessionAgent {
  open(session: Session, root: string): AgentProcess;
  permissions(root: string): { line: string; warn?: string };
  catalog(): Catalog;
  inventory(root: string): Promise<SetupItem[]>; // what it loads besides its own prompt (onboarding-010)
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
  listed = undefined;
}

// Parsed session files, reused while the file is unchanged (size and modification time).
const sessionCache = new Map<string, { stamp: string; session: Session }>();
export function loadSession(id: string): Session {
  const path = sessionPath(id);
  let stamp = '';
  try { const st = statSync(path); stamp = `${st.size}:${st.mtimeMs}`; } catch { /* missing: readJson reports it */ }
  const known = sessionCache.get(path);
  if (stamp && known?.stamp === stamp) return structuredClone(known.session);
  const s = readJson<Session | null>(path, null);
  if (!s) throw new Error(`Unknown session: ${id}`);
  if (stamp) sessionCache.set(path, { stamp, session: structuredClone(s) });
  return s;
}

// Global sessions belong to no project; they run in the workspace folder (sessions-014).
export const GLOBAL = '';

export function sessionRoot(s: Pick<Session, 'projectId' | 'worktree'>): string {
  if (s.worktree) return s.worktree.path;
  if (s.projectId !== GLOBAL) return getProject(s.projectId).root;
  const root = getWorkspaceRoot();
  if (!root) throw new Error('Session is global: set the workspace folder in Settings first');
  return root;
}

const inDirs = (dirs: string[]) => dirs.filter((d) => existsSync(d)).flatMap((dir) => readdirSync(dir).filter((f) => /^[^.]+\.json$/.test(f)).map((f) => loadSession(f.slice(0, -5))));

// Every session and task in storage.
// One page request asks for it many times (each chat's tasks, each task's subtasks), so it is built once per
// request (forgetSessionList); elsewhere it is kept for half a second. A write in this process clears it at once.
let listed: { at: number; sessions: Session[] } | undefined;
export const forgetSessionList = () => { listed = undefined; };
export const allSessions = (): Session[] => {
  if (!listed || Date.now() - listed.at > 500) listed = { at: Date.now(), sessions: inDirs(storageDirs('sessions')) };
  return listed.sessions.map((x) => structuredClone(x));
};

// The chat list: pinned first (in their pin order), then newest activity first. Tasks are listed apart.
export function listSessions(projectId: string): Session[] {
  // The flat legacy folder still holds items whose runner was alive during migration.
  return inDirs([join(projectStorage(projectId), 'sessions'), join(home(), 'sessions')])
    .filter((s) => s.projectId === projectId && !s.task)
    .sort((a, b) => (a.pinOrder ?? Infinity) - (b.pinOrder ?? Infinity) || b.updatedAt.localeCompare(a.updatedAt));
}

// Pinning does not count as activity, so updatedAt stays as it was.
function savePin(s: Session, pinOrder: number | undefined): void {
  s.pinOrder = pinOrder;
  writeJson(sessionPath(s.id), s);
  listed = undefined;
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
/** `worktree`: how a new chat in the app project picks its worktree (`planWorktree` in `app/src/worktrees.ts`); none: one named after the session (tasks, the CLI). */
export function createSession(projectId: string, role: string, assignment: { integration: string; model?: string }, worktree?: WorktreeChoice): Session {
  sessionRoot({ projectId });
  const now = new Date().toISOString();
  const s: Session = { id: randomUUID().slice(0, 8), projectId, title: 'New session', role, ...assignment, createdAt: now, updatedAt: now };
  if (projectId !== GLOBAL) s.worktree = planWorktree(getProject(projectId), s.id, worktree);
  placeIn('sessions', s.id, projectId);
  saveSession(s);
  audit({ kind: 'session', sessionId: s.id, event: 'created', projectId, role, integration: s.integration });
  return s;
}

export function deleteSession(id: string): void {
  if (sessionWorking(id)) throw new Error('Session is working; stop it first');
  loadSession(id);
  for (const p of [sessionPath(id), eventsPath(id), stopPath(id), sessionFile(id, '.log')]) rmSync(p, { force: true });
  listed = undefined;
  audit({ kind: 'session', sessionId: id, event: 'deleted' });
}

// Logs are append-only, so a log read before is extended with only its new lines; the page polls every second.
// shortcut: a log replaced by a longer one in the same process lifetime is misread; nothing rewrites logs today.
const eventCache = new Map<string, { size: number; events: SessionEvent[] }>();
export function readEvents(id: string): SessionEvent[] {
  const path = eventsPath(id);
  let size: number;
  try { size = statSync(path).size; } catch { eventCache.delete(path); return []; }
  const known = eventCache.get(path);
  if (known && known.size === size) return known.events.slice();
  const from = known && known.size < size ? known.size : 0;
  const fd = openSync(path, 'r');
  let text: string;
  try {
    const buf = Buffer.alloc(size - from);
    readSync(fd, buf, 0, buf.length, from);
    text = buf.toString('utf8');
  } finally { closeSync(fd); }
  // A line still being written has no newline yet: keep it for the next read.
  const end = text.lastIndexOf('\n') + 1;
  const fresh = text.slice(0, end).split('\n').filter(Boolean).map((l) => JSON.parse(l) as SessionEvent);
  const events = from ? [...known!.events, ...fresh] : fresh;
  eventCache.set(path, { size: from + Buffer.byteLength(text.slice(0, end)), events });
  return events.slice();
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

// The message that continues a task after request_setup (orchestrator-005); the task view counts it as part of
// the run that asked, not as a reply that reused the task.
export const setupContinue = (added: string[]) => `The workspace enabled ${added.join(', ')}. Continue the task.`;
export const isSetupContinue = (text: string) => /^The workspace enabled .+\. Continue the task\.$/.test(text);

// Ends a session's idle host (Stop while idle ends it), so its worktree can be removed: Windows keeps a running
// process's folder in use. False while the agent works, or when the host has not ended within `ms`.
export async function endIdleHost(id: string, ms = 10_000): Promise<boolean> {
  if (!turnRunning(id)) return true;
  if (sessionWorking(id)) return false;
  requestStop(id);
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 100))) if (!turnRunning(id)) return true;
  clearStop(id); // so a later turn is not stopped by it
  return false;
}

// The user's answer to an approval card; null when the turn was stopped first. No time limit (runtime-002).
export async function awaitAnswer(id: string, approvalId: string): Promise<boolean | null> {
  for (;;) {
    const a = readEvents(id).find((e) => e.type === 'approval-answer' && e.id === approvalId);
    if (a?.type === 'approval-answer') return a.allow;
    if (stopRequested(id)) return null;
    await new Promise((r) => setTimeout(r, 400));
  }
}

export type TurnState = 'working' | 'done' | 'error' | 'stopped' | 'interrupted';

export interface Turn {
  n: number;
  user: string;
  resume?: boolean; // continues the paused turn before it
  text: string;
  activity: { id: string; label: string; done: boolean; error?: boolean; outside?: boolean; fp?: string }[];
  approvals: { id: string; tool: string; detail: string; repeat?: string; allow?: boolean }[];
  notices: { text: string; blocked?: boolean }[];
  tasks: string[]; // tasks the agent started in this turn
  relays: { taskId: string; text: string }[]; // what the user wrote to those tasks directly after this turn
  switchedTo?: { from: string; to: string; model?: string }; // after this turn the session moved to another agent
  state: TurnState;
  error?: string;
  reason?: string; // why the workspace stopped the turn (budget, a possible repeat)
  usage: Usage;
  liveUsage?: Usage; // while working: usage streamed so far
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
  let prev: SessionEvent | undefined;
  for (const e of events) {
    const before = prev;
    prev = e;
    if (e.type === 'user') {
      out.push({ n: e.turn, user: e.text, resume: e.resume, text: '', activity: [], approvals: [], notices: [], tasks: [], relays: [], state: 'working', usage: zero(), startedAt: e.at });
      continue;
    }
    const t = out.findLast((x) => x.n === e.turn);
    if (!t) continue;
    // Text after a tool step or other event starts a new paragraph; consecutive text events are pieces of one run.
    if (e.type === 'text') t.text += (t.text && e.text && before?.type !== 'text' ? '\n\n' : '') + e.text;
    else if (e.type === 'notice') t.notices.push({ text: e.text, blocked: e.blocked });
    else if (e.type === 'switch') t.switchedTo = { from: e.from, to: e.to, model: e.model };
    else if (e.type === 'init') Object.assign(t, { model: e.model, permissionMode: e.permissionMode, ruleFiles: e.ruleFiles, plugins: e.plugins, mcp: e.mcp, skills: e.skills });
    else if (e.type === 'activity') t.activity.push({ id: e.id, label: e.label, done: false, outside: e.outside, fp: e.fp });
    else if (e.type === 'activity-done') Object.assign(t.activity.find((a) => a.id === e.id) ?? {}, { done: true, error: e.error });
    else if (e.type === 'approval') t.approvals.push({ id: e.id, tool: e.tool, detail: e.detail, repeat: e.repeat });
    else if (e.type === 'approval-answer') Object.assign(t.approvals.find((a) => a.id === e.id) ?? {}, { allow: e.allow });
    else if (e.type === 'task') t.tasks.push(e.id);
    else if (e.type === 'relay') t.relays.push({ taskId: e.taskId, text: e.text });
    else if (e.type === 'usage') t.usage = addUsage(t.usage, e.usage);
    else if (e.type === 'live-usage') t.liveUsage = e.usage;
    else if (e.type === 'done' || e.type === 'stopped' || e.type === 'interrupted') Object.assign(t, { state: e.type === 'done' ? 'done' : e.type, endedAt: e.at, reason: e.type === 'stopped' ? e.reason : undefined });
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
  const at = done.length ? `${what} after step ${done.length}: ${done.at(-1)!.label}` : `${what} before the first step`;
  return t.reason ? `${at} (${t.reason})` : at;
}

// Tool calls the previous attempt completed, when it was interrupted (the runner died) or paused: a matching
// call in the re-run is a possible repeat (runtime-004, runtime-006). Keyed by fingerprint, valued by the step it was.
export function repeatsFor(ts: Turn[]): Map<string, string> {
  const prev = ts.at(-2);
  const out = new Map<string, string>();
  if (prev?.state !== 'interrupted' && prev?.state !== 'stopped') return out;
  prev.activity.forEach((a, i) => a.done && !a.error && a.fp && out.set(a.fp, `step ${i + 1}: ${a.label}`));
  return out;
}

// The conversation as text, for agents that cannot resume their own (Codex exec, an expired hint).
export function transcript(ts: Turn[]): string {
  return ts.map((t) => `User: ${t.user}${t.text ? `\n\nYou: ${t.text}` : ''}${t.marker ? `\n\n[${t.marker}]` : ''}`).join('\n\n');
}

// Records the user's message as a new turn. If the last turn did not finish, its marker is recorded
// and passed to the agent with the message, so user and agent see the same last step (sessions-009).
export function addMessage(id: string, text: string, resume = false): number {
  const s = loadSession(id);
  if (sessionWorking(id)) throw new Error('Session is already working');
  if (s.task?.cancelled) throw new Error('Task is cancelled');
  const events = readEvents(id);
  const queued = queuedReplies(events);
  text = [...queued, text].filter(Boolean).join('\n\n');
  if (!text) throw new Error('Unknown message: text is required');
  const ts = turns(events, false);
  const last = ts.at(-1);
  const turn = (last?.n ?? 0) + 1;
  if (last && last.state === 'interrupted' && !events.some((e) => e.turn === last.n && e.type === 'interrupted')) {
    emit(id, last.n, { type: 'interrupted', step: last.activity.filter((a) => a.done).length, label: last.activity.filter((a) => a.done).at(-1)?.label });
  }
  emit(id, turn, { type: 'user', text, ...(resume && !queued.length ? { resume: true } : {}) });
  if (s.title === 'New session') s.title = text.split('\n')[0].slice(0, 60);
  saveSession(s);
  clearStop(id);
  return turn;
}

// Replies queued since the last message: a task takes them with its next one (orchestrator-006).
export const queuedReplies = (events: SessionEvent[]) => events.slice(events.findLastIndex((e) => e.type === 'user') + 1).flatMap((e) => (e.type === 'queued' ? [e.text] : []));

// A reply to a working task waits in its log; the task's host sends it when the turn ends.
export function queueReply(id: string, text: string): void {
  emit(id, turns(readEvents(id), true).at(-1)?.n ?? 0, { type: 'queued', text });
}

// The last turn's message, prefixed with the previous turn's marker when it did not finish.
export function turnPrompt(ts: Turn[]): string {
  const [prev, cur] = [ts.at(-2), ts.at(-1)!];
  const relays = prev?.relays.map((r) => `[Since your last reply the user wrote directly to task ${r.taskId}: "${r.text}"]`).join('\n') ?? '';
  const head = [prev?.marker ? `[${prev.marker}. Check the current project state before repeating anything.]` : '', relays].filter(Boolean).join('\n');
  return head ? `${head}\n\n${cur.user}` : cur.user;
}
