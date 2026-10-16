import { spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRoles, newRoleTask } from './roles.ts';
import { cancelTask, listTasks, loadTask, markRunner, runnerAlive, saveTask, terminal, type Task } from './runtime.ts';
import { home, listProjects, registerProject } from './store.ts';

const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
const page = fileURLToPath(new URL('./ui.html', import.meta.url));
const logPath = (id: string) => join(home(), 'tasks', `${id}.log`);

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
  return { ...task, runnerAlive: task.status === 'running' && runnerAlive(task.id) };
}

async function route(req: IncomingMessage, url: URL): Promise<unknown> {
  const [, api, kind, id, action] = url.pathname.split('/');
  if (api !== 'api') throw new HttpError(404, 'not found');
  if (id !== undefined && !/^[\w-]+$/.test(id)) throw new HttpError(400, 'bad task id');
  if (req.method === 'GET' && kind === 'meta') return { projects: listProjects(), roles: getRoles() };
  if (req.method === 'GET' && kind === 'tasks' && !id) return listTasks().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(view);
  if (req.method === 'GET' && kind === 'tasks') {
    const task = loadTask(id);
    return { task: view(task), children: listTasks().filter((t) => t.parentId === id).map(view), events: events(id), log: tail(logPath(id)) };
  }
  if (req.method === 'POST' && kind === 'projects') {
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
      const code = e instanceof HttpError ? e.code : e instanceof SyntaxError ? 400 : /^Unknown |^No assignment|no runnable adapter|^Project |^Not a directory/.test((e as Error).message) ? 400 : 500;
      send(code, 'application/json', JSON.stringify({ error: (e as Error).message }));
    }
  });
  return server.listen(port, '127.0.0.1');
}
