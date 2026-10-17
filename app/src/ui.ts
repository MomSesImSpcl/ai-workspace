import { spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assignmentFor, getRoles, integrations, newRoleTask, setRole } from './roles.ts';
import { addMessage, GLOBAL, reorderPinned, sessionRoot, setPinned, createSession, deleteSession, emit, listSessions, loadSession, readEvents, requestStop, saveSession, turnRunning, turns, type Session } from './sessions.ts';
import { sessionAgent, startTurn } from './turn.ts';
import { exportStorage, importStorage } from './transfer.ts';
import { cancelTask, taskFile, conversation, listTasks, loadTask, markRunner, replyTask, runnerAlive, saveTask, terminal, type Task } from './runtime.ts';
import { getWorkspaceRoot, home, listProjects, readJson, writeJson, registerProject, removeProject, setProjectArchived, setWorkspaceRoot, unaddedFolders } from './store.ts';

const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
const page = fileURLToPath(new URL('./ui.html', import.meta.url));
const logPath = (id: string) => taskFile(id, '.log');
const prefsPath = () => join(home(), 'ui-prefs.json'); // last view of the window, restored on launch

// Each task runs in its own detached `ws resume` process, so closing the UI never stops it.
function startRunner(task: Task): void {
  const log = openSync(logPath(task.id), 'a');
  const child = spawn(process.execPath, [cli, 'resume', task.id], { detached: true, stdio: ['ignore', log, log], windowsHide: true });
  closeSync(log);
  if (child.pid) markRunner(task.id, child.pid); // at once, so a second resume sees the runner
  child.unref();
}

function tail(path: string, bytes = 8192): string {
  if (!existsSync(path)) return '';
  const size = statSync(path).size;
  const buf = Buffer.alloc(Math.min(size, bytes));
  const fd = openSync(path, 'r');
  readSync(fd, buf, 0, buf.length, size - buf.length);
  closeSync(fd);
  return buf.toString('utf8');
}

// shortcut: scans the whole audit log per request; upgrade to an index when it grows large.
function events(id: string): unknown[] {
  const path = join(home(), 'audit.jsonl');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.taskId === id || e.childId === id);
}

class HttpError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

function budget(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) <= 0) throw new HttpError(400, 'budget must be a positive integer');
  return value as number;
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (req.headers['content-type'] !== 'application/json') throw new HttpError(415, 'expected application/json');
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 65536) throw new HttpError(413, 'body too large');
  }
  const value = JSON.parse(raw || '{}');
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new HttpError(400, 'expected a JSON object');
  return value;
}

function view(task: Task) {
  return { ...task, messages: conversation(task), runnerAlive: task.status === 'running' && runnerAlive(task.id) };
}

// shortcut: folds every session's log per list request; upgrade to a summary file when logs grow large.
function sessionView(s: Session) {
  const working = turnRunning(s.id);
  const last = turns(readEvents(s.id), working).at(-1);
  return { ...s, working, state: last?.state, pendingApprovals: last?.approvals.filter((a) => a.allow === undefined).length ?? 0 };
}

const text = (v: unknown, name: string) => {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${name} is required`);
  return v.trim();
};

async function sessionRoute(req: IncomingMessage, url: URL, id?: string, action?: string): Promise<unknown> {
  if (req.method === 'GET' && !id) return listSessions(url.searchParams.get('global') ? GLOBAL : text(url.searchParams.get('project'), 'project')).map(sessionView);
  if (req.method === 'GET' && !action) {
    const s = loadSession(id!);
    const working = turnRunning(s.id);
    return { session: sessionView(s), turns: turns(readEvents(s.id), working), permissions: sessionAgent(s.integration).permissions(sessionRoot(s)) };
  }
  if (req.method !== 'POST') throw new HttpError(404, 'not found');
  const b = await body(req);
  if (id === 'order') {
    if (!Array.isArray(b.ids) || !b.ids.every((v) => typeof v === 'string' && /^[\w-]+$/.test(v))) throw new HttpError(400, 'ids must be session ids');
    reorderPinned(b.ids as string[]);
    return { ok: true };
  }
  if (!id) {
    const role = text(b.role, 'role');
    const assignment = assignmentFor(role);
    sessionAgent(assignment.integration);
    return sessionView(createSession(b.global === true ? GLOBAL : text(b.projectId, 'projectId'), role, assignment));
  }
  const s = loadSession(id);
  if (action === 'message') {
    addMessage(id, text(b.text, 'text'));
    startTurn(id);
  } else if (action === 'stop') {
    if (turnRunning(id)) requestStop(id);
  } else if (action === 'approve') {
    const last = turns(readEvents(id), turnRunning(id)).at(-1);
    const pending = last?.state === 'working' && last.approvals.find((a) => a.id === b.approval && a.allow === undefined);
    if (!pending || typeof b.allow !== 'boolean') throw new HttpError(409, 'no such pending approval');
    emit(id, last.n, { type: 'approval-answer', id: pending.id, allow: b.allow });
  } else if (action === 'rename') {
    s.title = text(b.title, 'title').slice(0, 120);
    saveSession(s);
  } else if (action === 'pin') {
    setPinned(id, b.pinned === true);
  } else if (action === 'archive') {
    s.archived = b.archived === true;
    saveSession(s);
  } else if (action === 'delete') {
    deleteSession(id);
    return { deleted: id };
  } else throw new HttpError(404, 'not found');
  return sessionView(loadSession(id));
}

async function route(req: IncomingMessage, url: URL): Promise<unknown> {
  const [, api, kind, rawId, action] = url.pathname.split('/');
  if (api !== 'api') throw new HttpError(404, 'not found');
  // Task and session ids name files, so they stay strict; project ids are folder names (spaces allowed).
  const id = kind === 'projects' && rawId !== undefined ? decodeURIComponent(rawId) : rawId;
  if (id !== undefined && !(kind === 'projects' ? id.trim() !== '' : /^[\w-]+$/.test(id))) throw new HttpError(400, 'bad id');
  if (kind === 'sessions') return sessionRoute(req, url, id, action);
  if (req.method === 'GET' && kind === 'meta') return { projects: listProjects(), roles: getRoles(), integrations, workspaceRoot: getWorkspaceRoot() ?? null, unaddedFolders: unaddedFolders(), storage: home() };
  if (req.method === 'GET' && kind === 'tasks' && !id) return listTasks().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(view);
  if (req.method === 'GET' && kind === 'tasks') {
    const task = loadTask(id);
    return { task: view(task), children: listTasks().filter((t) => t.parentId === id).map(view), events: events(id), log: tail(logPath(id)) };
  }
  if (req.method === 'POST' && kind === 'roles') {
    const b = await body(req);
    if (typeof b.role !== 'string' || !b.role || typeof b.integration !== 'string' || !b.integration) throw new HttpError(400, 'role and integration are required');
    if (b.model !== undefined && typeof b.model !== 'string') throw new HttpError(400, 'model must be a string');
    setRole(b.role, { integration: b.integration, model: (b.model as string | undefined)?.trim() || undefined });
    return getRoles();
  }
  if (req.method === 'GET' && kind === 'prefs') return readJson<Record<string, string>>(prefsPath(), {});
  if (req.method === 'POST' && kind === 'prefs') {
    const b = await body(req);
    if (typeof b.key !== 'string' || !b.key || b.key.length > 200 || typeof b.value !== 'string' || b.value.length > 1000) throw new HttpError(400, 'key and string value required');
    writeJson(prefsPath(), { ...readJson<Record<string, string>>(prefsPath(), {}), [b.key]: b.value });
    return { ok: true };
  }
  if (req.method === 'POST' && kind === 'storage' && (id === 'export' || id === 'import')) {
    const b = await body(req);
    if (typeof b.path !== 'string' || !isAbsolute(b.path)) throw new HttpError(400, 'an absolute file path is required');
    return id === 'export' ? exportStorage(b.path) : importStorage(b.path);
  }
  if (req.method === 'POST' && kind === 'workspace') {
    const b = await body(req);
    if (typeof b.root !== 'string' || !b.root.trim()) throw new HttpError(400, 'root is required');
    return { workspaceRoot: setWorkspaceRoot(b.root.trim()) };
  }
  if (req.method === 'POST' && kind === 'projects' && action === 'archive') return setProjectArchived(id, (await body(req)).archived === true);
  if (req.method === 'POST' && kind === 'projects' && action === 'remove') {
    removeProject(id);
    return { removed: id };
  }
  if (req.method === 'POST' && kind === 'projects' && !id) {
    const b = await body(req);
    if (typeof b.path !== 'string' || (b.id !== undefined && typeof b.id !== 'string')) throw new HttpError(400, 'path is required');
    return registerProject(b.path.trim(), b.id?.trim() || undefined);
  }
  if (req.method === 'POST' && kind === 'tasks' && !id) {
    const b = await body(req);
    if (typeof b.goal !== 'string' || !b.goal.trim()) throw new HttpError(400, 'goal is required');
    if (typeof b.projectId !== 'string' || typeof b.role !== 'string') throw new HttpError(400, 'projectId and role are required');
    const task = newRoleTask({ projectId: b.projectId, goal: b.goal.trim(), role: b.role, write: b.write === true, tokenBudget: budget(b.budget) });
    startRunner(task);
    return view(task);
  }
  if (req.method === 'POST' && kind === 'tasks' && action === 'resume') {
    const b = await body(req);
    const task = loadTask(id);
    if (terminal(task.status)) throw new HttpError(409, `task is ${task.status}`);
    if (runnerAlive(id)) throw new HttpError(409, 'task is already running');
    if (b.budget !== undefined) task.tokenBudget = budget(b.budget);
    saveTask(task);
    startRunner(task);
    return view(task);
  }
  if (req.method === 'POST' && kind === 'tasks' && action === 'reply') {
    const b = await body(req);
    if (typeof b.text !== 'string' || !b.text.trim()) throw new HttpError(400, 'text is required');
    const task = replyTask(id, b.text.trim());
    startRunner(task);
    return view(task);
  }
  if (req.method === 'POST' && kind === 'tasks' && action === 'cancel') return view(cancelTask(id));
  throw new HttpError(404, 'not found');
}

// Bound to loopback. The Host check blocks DNS rebinding; the Origin check and the JSON-only body
// block other websites from posting to the local API (CSRF).
export function serve(port: number): Server {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const host = req.headers.host ?? '';
    const send = (code: number, type: string, data: string) => res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }).end(data);
    try {
      const { port: actual } = server.address() as { port: number };
      if (host !== `127.0.0.1:${actual}` && host !== `localhost:${actual}`) throw new HttpError(403, 'bad host');
      if (req.method !== 'GET' && req.headers.origin !== `http://${host}`) throw new HttpError(403, 'bad origin');
      const url = new URL(req.url ?? '/', `http://${host}`);
      if (req.method === 'GET' && url.pathname === '/') return send(200, 'text/html; charset=utf-8', readFileSync(page, 'utf8'));
      send(200, 'application/json', JSON.stringify(await route(req, url)));
    } catch (e) {
      const code = e instanceof HttpError ? e.code : e instanceof SyntaxError ? 400 : /^Unknown |^Task is |^Session is |^No assignment|no runnable adapter|cannot run sessions|^Project |^Workspace folder |^Import failed|^Not a directory/.test((e as Error).message) ? 400 : 500;
      send(code, 'application/json', JSON.stringify({ error: (e as Error).message }));
    }
  });
  return server.listen(port, '127.0.0.1');
}
