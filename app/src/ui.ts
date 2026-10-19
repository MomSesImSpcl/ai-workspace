import { homedir } from 'node:os';
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname, isAbsolute, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { assignmentFor, getRoles, setRole } from './roles.ts';
import { addMessage, addUsage, forgetSessionList, getSettings, GLOBAL, INSTRUCTIONS, setSettings, turnUsage, used, type Usage, reorderPinned, sessionFile, sessionRoot, setPinned, createSession, deleteSession, emit, listSessions, loadSession, readEvents, requestStop, saveSession, sessionWorking, turnRunning, turns, type Session } from './sessions.ts';
import { getAgentSetup, itemOn, RULE_ROLES, saveInventory, SETUP_ROLES, setGlobalRules, setItemState, stateOf, type ItemState } from './setup.ts';
import { agentChoice, sessionAgent, sessionAgents, startTurn } from './turn.ts';
import { cancelTask, childrenOf, listTasks, pauseTask, relayToChat, replyTask, resumeTask, startedIn, taskStatus, taskUsed, usageOf } from './tasks.ts';
import { exportStorage, importStorage } from './transfer.ts';
import { getProject, getWorkspaceRoot, home, listProjects, readJson, writeJson, registerProject, removeProject, setProjectArchived, setWorkspaceRoot, unaddedFolders } from './store.ts';

const page = fileURLToPath(new URL('./ui.html', import.meta.url));
const markedJs = join(dirname(createRequire(import.meta.url).resolve('marked')), 'marked.umd.js'); // Markdown in the chat (the browser build, next to the package's main file)
const prefsPath = () => join(home(), 'ui-prefs.json'); // last view of the window, restored on launch
// Integrations a role may name: those with a session agent.
const integrations = Object.keys(sessionAgents);

function tail(path: string, bytes = 8192): string {
  if (!existsSync(path)) return '';
  const size = statSync(path).size;
  const buf = Buffer.alloc(Math.min(size, bytes));
  const fd = openSync(path, 'r');
  readSync(fd, buf, 0, buf.length, size - buf.length);
  closeSync(fd);
  return buf.toString('utf8');
}

class HttpError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
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

// shortcut: folds every task's log per list request, like sessions; upgrade to a summary file when logs grow large.
function taskView(s: Session) {
  const ts = turns(readEvents(s.id), turnRunning(s.id));
  const last = ts.at(-1);
  const step = last?.activity.at(-1);
  const chat = s.task?.sessionId ? loadSession(s.task.sessionId) : undefined;
  const status = taskStatus(s, ts);
  return {
    ...s, goal: ts[0]?.user ?? s.title, status, reason: last?.marker, subtaskUsed: childrenOf(s.id).reduce((n, c) => n + used(usageOf(c.id)), 0), // part of `used`, shown as its own line
    used: taskUsed(s) + (last?.state === 'working' ? used(turnUsage(last)) : 0), usage: last?.state === 'working' ? addUsage(usageOf(s.id), turnUsage(last)) : usageOf(s.id), steps: ts.reduce((n, t) => n + t.activity.length, 0), current: step && !step.done ? step.label : undefined,
    loaded: (getAgentSetup().inventory?.[s.integration] ?? []).filter((i) => itemOn(s, i.id)).map((i) => i.title), // its enabled setup items (orchestrator-005)
    ranModel: ts.findLast((t) => t.model)?.model, // the model the agent reported, also when the task used the agent's default
    finishedAt: status === 'running' || status === 'waiting' ? undefined : last?.endedAt,
    session: chat && { id: chat.id, title: chat.title },
    request: chat && turns(readEvents(chat.id), true).find((t) => t.tasks.includes(s.id))?.user, // the chat message that started it
  };
}

// A task as its starting chat shows it (sessions-002): status, its and its subtasks' pending approvals, the result.
// Open approval cards of a task and its subtasks.
const pendingOf = (s: Session) => [s, ...childrenOf(s.id)].flatMap((t) => {
  const last = turns(readEvents(t.id), turnRunning(t.id)).at(-1);
  return last?.state === 'working' ? last.approvals.filter((a) => a.allow === undefined).map((a) => ({ ...a, taskId: t.id })) : [];
});

function taskCard(s: Session) {
  const pending = pendingOf(s);
  // The task's own conversation after its goal: the user's replies and each answer, oldest first.
  const thread = turns(readEvents(s.id), turnRunning(s.id)).map((t, i) => ({ user: i && !t.resume ? t.user : undefined, text: t.text, working: t.state === 'working', notices: t.notices }));
  return { ...taskView(s), pending, thread };
}

// shortcut: folds every session's log per list request; upgrade to a summary file when logs grow large.
function sessionView(s: Session) {
  const last = turns(readEvents(s.id), turnRunning(s.id)).at(-1);
  const working = last?.state === 'working';
  const own = last?.state === 'working' ? last.approvals.filter((a) => a.allow === undefined).length : 0;
  return { ...s, working, state: last?.state, pendingApprovals: own + startedIn(s.id).reduce((n, t) => n + pendingOf(t).length, 0) };
}

// Agent, model and effort, checked against what the agent offers (its catalog).
function agentConfig(b: Record<string, unknown>, current: { integration: string; model?: string; effort?: string }) {
  try { return agentChoice(b, current); } catch (e) { throw new HttpError(400, (e as Error).message); }
}

const text = (v: unknown, name: string) => {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${name} is required`);
  return v.trim();
};

async function sessionRoute(req: IncomingMessage, url: URL, id?: string, action?: string): Promise<unknown> {
  if (req.method === 'GET' && !id) return listSessions(url.searchParams.get('global') ? GLOBAL : text(url.searchParams.get('project'), 'project')).map(sessionView);
  if (req.method === 'GET' && !action) {
    const s = loadSession(id!);
    return { session: sessionView(s), turns: turns(readEvents(s.id), turnRunning(s.id)), tasks: Object.fromEntries(startedIn(s.id).map((t) => [t.id, taskCard(t)])), permissions: sessionAgent(s.integration).permissions(sessionRoot(s)) };
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
    const config = agentConfig(b, assignment); // the role's agent unless the composer chose another
    const s = createSession(b.global === true ? GLOBAL : text(b.projectId, 'projectId'), role, { integration: config.integration, model: config.model });
    s.effort = config.effort;
    if (Number.isInteger(b.taskCap) && (b.taskCap as number) > 0) s.taskCap = b.taskCap as number;
    if (typeof b.taskMode === 'string' && b.taskMode.length <= 40) s.taskMode = b.taskMode;
    saveSession(s);
    return sessionView(s);
  }
  const s = loadSession(id);
  if (action === 'message') {
    addMessage(id, text(b.text, 'text'));
    if (!turnRunning(id)) startTurn(id); // a running host picks the message up itself
  } else if (action === 'stop') {
    if (sessionWorking(id)) requestStop(id);
  } else if (action === 'approve') {
    const last = turns(readEvents(id), turnRunning(id)).at(-1);
    const pending = last?.state === 'working' && last.approvals.find((a) => a.id === b.approval && a.allow === undefined);
    if (!pending || typeof b.allow !== 'boolean') throw new HttpError(409, 'no such pending approval');
    emit(id, last.n, { type: 'approval-answer', id: pending.id, allow: b.allow });
  } else if (action === 'rename') {
    s.title = text(b.title, 'title').slice(0, 120);
    saveSession(s);
  } else if (action === 'config') {
    if (sessionWorking(id)) throw new HttpError(409, 'the agent is working; stop it or wait for the reply');
    const config = agentConfig(b, s);
    // A switch hands the conversation over as text: the new agent cannot resume the old one's session.
    if (config.integration !== s.integration) {
      const n = turns(readEvents(id), false).at(-1)?.n ?? 0;
      emit(id, n, { type: 'switch', from: s.integration, to: config.integration, model: config.model });
      s.vendorSessionId = undefined;
    }
    Object.assign(s, config);
    if (s.task) s.task.overridden = true; // the user changed the orchestrator's choice (orchestrator-004)
    saveSession(s);
  } else if (action === 'mode') {
    if (b.taskMode !== null && (typeof b.taskMode !== 'string' || b.taskMode.length > 40)) throw new HttpError(400, 'taskMode must be a permission mode, an empty string or null');
    s.taskMode = (b.taskMode as string | null) ?? undefined;
    saveSession(s);
  } else if (action === 'cap') {
    if (b.taskCap !== null && (!Number.isInteger(b.taskCap) || (b.taskCap as number) <= 0)) throw new HttpError(400, 'taskCap must be a positive whole number or null');
    s.taskCap = (b.taskCap as number | null) ?? undefined;
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

// The Settings view of the agent setup: each listed item with its state per role, and the global-rules switches.
function agentSetupView() {
  const setup = getAgentSetup();
  const inventory = setup.inventory ?? {};
  const states = Object.fromEntries(SETUP_ROLES.map((role) => [role, Object.fromEntries(Object.entries(inventory).map(([agent, items]) => [agent, Object.fromEntries(items.map((i) => [i.id, stateOf(setup, role, agent, i.id)]))]))]));
  return { inventory, states, roles: SETUP_ROLES, ruleRoles: RULE_ROLES, globalRules: Object.fromEntries(RULE_ROLES.map((r) => [r, setup.globalRules?.[r] ?? false])) };
}

async function route(req: IncomingMessage, url: URL): Promise<unknown> {
  const [, api, kind, rawId, action] = url.pathname.split('/');
  if (api !== 'api') throw new HttpError(404, 'not found');
  // Task and session ids name files, so they stay strict; project ids are folder names (spaces allowed).
  const id = kind === 'projects' && rawId !== undefined ? decodeURIComponent(rawId) : rawId;
  if (id !== undefined && !(kind === 'projects' ? id.trim() !== '' : /^[\w-]+$/.test(id))) throw new HttpError(400, 'bad id');
  if (kind === 'sessions') return sessionRoute(req, url, id, action);
  if (req.method === 'POST' && kind === 'settings') {
    const b = await body(req);
    const v = Object.fromEntries(INSTRUCTIONS.filter((k) => k in b).map((k) => [k, b[k]]));
    if (!Object.keys(v).length || Object.values(v).some((t) => typeof t !== 'string' || t.length > 4000)) throw new HttpError(400, `${INSTRUCTIONS.join(', ')}: text up to 4000 characters`);
    setSettings(v as Record<string, string>);
    return getSettings();
  }
  if (kind === 'agent-setup') {
    if (req.method === 'POST' && id === 'list') {
      // Lists what every agent loads now (onboarding-010); an agent that cannot list keeps its earlier list.
      for (const [agent, a] of Object.entries(sessionAgents)) await a.inventory(getWorkspaceRoot() ?? homedir()).then((items) => saveInventory(agent, items), () => {});
    } else if (req.method === 'POST') {
      const b = await body(req);
      if (typeof b.globalRules === 'boolean') setGlobalRules(String(b.role), b.globalRules);
      else setItemState(String(b.role), String(b.agent), String(b.item), String(b.state) as ItemState);
    }
    return agentSetupView();
  }
  if (req.method === 'GET' && kind === 'meta') return { settings: getSettings(), projects: listProjects(), roles: getRoles(), integrations, workspaceRoot: getWorkspaceRoot() ?? null, unaddedFolders: unaddedFolders(), storage: home() };
  if (req.method === 'GET' && kind === 'tasks' && !id) return listTasks().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(taskView);
  if (req.method === 'GET' && kind === 'tasks') {
    const s = loadSession(id);
    if (!s.task) throw new HttpError(404, 'not a task');
    // Each message the task got is its own run: the first is the start, later ones are replies that reused it.
    // A Resume continues the run it paused, so its steps, tokens and result join that run.
    type Run = { usage: Usage; n: number; request: string; result: string; state: string; marker?: string; model?: string; permissionMode?: string; startedAt: string; endedAt?: string; used: number; costUsd?: number; paused: number; steps: { label: string; done: boolean; error?: boolean }[] };
    const runs: Run[] = [];
    for (const t of turns(readEvents(id), turnRunning(id))) {
      const steps = t.activity.map((a) => ({ label: a.label, done: a.done, error: a.error }));
      const prev = runs.at(-1);
      if (t.resume && prev) {
        Object.assign(prev, { result: t.state === 'working' ? '' : t.text || prev.result, state: t.state, marker: t.marker, model: t.model ?? prev.model, endedAt: t.endedAt, used: prev.used + used(turnUsage(t)), usage: addUsage(prev.usage, turnUsage(t)), costUsd: prev.costUsd === undefined && t.usage.costUsd === undefined ? undefined : (prev.costUsd ?? 0) + (t.usage.costUsd ?? 0), paused: prev.paused + 1, steps: [...prev.steps, ...steps] });
        continue;
      }
      runs.push({ usage: turnUsage(t), n: t.n, request: t.user, result: t.state === 'working' ? '' : t.text, state: t.state, marker: t.marker, model: t.model, permissionMode: t.permissionMode, startedAt: t.startedAt, endedAt: t.endedAt, used: used(turnUsage(t)), costUsd: turnUsage(t).costUsd, paused: 0, steps });
    }
    return { task: taskCard(s), runs, children: childrenOf(id).map(taskView), permissions: sessionAgent(s.integration).permissions(sessionRoot(s)), log: tail(sessionFile(id, '.log')) };
  }
  if (req.method === 'POST' && kind === 'roles') {
    const b = await body(req);
    if (typeof b.role !== 'string' || !b.role || typeof b.integration !== 'string' || !b.integration) throw new HttpError(400, 'role and integration are required');
    if (!sessionAgents[b.integration]) throw new HttpError(400, `integration must be one of ${integrations.join(', ')}`);
    if (!getRoles()[b.role]) throw new HttpError(400, `role must be one of ${Object.keys(getRoles()).join(', ')}`);
    // Model and effort come from the agent's catalog (onboarding-008); '' or unset is the agent's own default.
    const models = sessionAgents[b.integration]!.catalog().models;
    const model = typeof b.model === 'string' && b.model ? b.model : undefined, effort = typeof b.effort === 'string' && b.effort ? b.effort : undefined;
    const entry = models.find((m) => m.id === (model ?? ''));
    if (model && !entry) throw new HttpError(400, `model must be one of ${models.map((m) => m.id || 'default').join(', ')}`);
    if (effort && !entry?.efforts?.includes(effort)) throw new HttpError(400, `effort must be one of ${entry?.efforts?.join(', ') || 'none for this model'}`);
    setRole(b.role, { integration: b.integration, model, effort });
    return getRoles();
  }
  if (req.method === 'GET' && kind === 'agents') return Object.fromEntries(Object.entries(sessionAgents).map(([k, a]) => [k, a.catalog()]));
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
  // Tasks start from a chat (start_task); the user answers them there (ADR 0010).
  if (req.method === 'POST' && kind === 'tasks' && action === 'reply') {
    const b = await body(req);
    const task = replyTask(id, text(b.text, 'text')); // queued while the task works
    relayToChat(task, text(b.text, 'text'));
    if (!turnRunning(id)) startTurn(id); // a running host picks the message up itself
    return taskView(task);
  }
  if (req.method === 'POST' && kind === 'tasks' && action === 'cancel') return taskView(cancelTask(id));
  if (req.method === 'POST' && kind === 'tasks' && action === 'pause') return taskView(pauseTask(id));
  if (req.method === 'POST' && kind === 'tasks' && action === 'resume') {
    const task = resumeTask(id);
    if (!turnRunning(id)) startTurn(id);
    return taskView(task);
  }
  throw new HttpError(404, 'not found');
}

// Bound to loopback. The Host check blocks DNS rebinding; the Origin check and the JSON-only body
// block other websites from posting to the local API (CSRF).
export function serve(port: number): Server {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const host = req.headers.host ?? '';
    const send = (code: number, type: string, data: string) => res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }).end(data);
    try {
      forgetSessionList(); // each request sees other processes' changes at once
      const { port: actual } = server.address() as { port: number };
      if (host !== `127.0.0.1:${actual}` && host !== `localhost:${actual}`) throw new HttpError(403, 'bad host');
      if (req.method !== 'GET' && req.headers.origin !== `http://${host}`) throw new HttpError(403, 'bad origin');
      const url = new URL(req.url ?? '/', `http://${host}`);
      if (req.method === 'GET' && url.pathname === '/') return send(200, 'text/html; charset=utf-8', readFileSync(page, 'utf8'));
      if (req.method === 'GET' && url.pathname === '/vendor/marked.js') return send(200, 'text/javascript; charset=utf-8', readFileSync(markedJs, 'utf8'));
      send(200, 'application/json', JSON.stringify(await route(req, url)));
    } catch (e) {
      const code = e instanceof HttpError ? e.code : e instanceof SyntaxError ? 400 : /^Unknown |^Task is |^Session is |^Subtask |^No assignment|cannot run sessions|^Project |^Workspace folder |^Import failed|^Not a directory/.test((e as Error).message) ? 400 : 500;
      send(code, 'application/json', JSON.stringify({ error: (e as Error).message }));
    }
  });
  return server.listen(port, '127.0.0.1');
}
