import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { home } from '../store.ts';
import { awaitAnswer, fingerprint, type AgentProcess, type Body, type Catalog, type Session, type SessionAgent, type TurnEnd, type TurnInput, type Usage, ORCHESTRATION, orchestratorNote, TASK_NOTE } from '../sessions.ts';

// Codex through `codex app-server` (issue #14): one long-lived process per session with the user's own
// config, rules, plugins and sign-in (ADR 0004). JSON-RPC over stdio: approvals arrive as requests and
// become approval cards, text streams as deltas, usage streams per model call, Stop is `turn/interrupt`.

const workspaceServer = fileURLToPath(new URL('../approval-server.ts', import.meta.url));

// On Windows `codex` is an npm .cmd shim that spawn cannot run without a shell; run its script with node.
function command(): [string, string[]] {
  if (process.env.CODEX_BIN) return /\.(m?js|ts)$/.test(process.env.CODEX_BIN) ? [process.execPath, [process.env.CODEX_BIN]] : [process.env.CODEX_BIN, []];
  if (process.platform === 'win32') {
    for (const dir of (process.env.PATH ?? '').split(delimiter)) {
      const script = join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (existsSync(join(dir, 'codex.cmd')) && existsSync(script)) return [process.execPath, [script]];
    }
  }
  return ['codex', []];
}

// Codex's own approval presets (its /approvals menu), passed per thread; '' keeps the user's config.
const MODES: Record<string, { approvalPolicy: string; sandbox: string }> = {
  'read-only': { approvalPolicy: 'on-request', sandbox: 'read-only' },
  auto: { approvalPolicy: 'on-request', sandbox: 'workspace-write' },
  'full-access': { approvalPolicy: 'never', sandbox: 'danger-full-access' },
};

interface Item { type: string; id: string; text?: string; command?: string; exitCode?: number | null; status?: string; changes?: { path: string }[]; server?: string; tool?: string; arguments?: unknown }
interface Breakdown { inputTokens: number; cachedInputTokens: number; cacheWriteInputTokens: number; outputTokens: number }
type Message = { id?: number | string; method?: string; params?: Record<string, unknown>; result?: Record<string, unknown>; error?: { message?: string } };

const usageOf = (b: Breakdown): Usage => ({ inputTokens: b.inputTokens, outputTokens: b.outputTokens, cachedInputTokens: b.cachedInputTokens, cacheWriteTokens: b.cacheWriteInputTokens });
const minus = (a: Usage, b: Usage): Usage => ({ inputTokens: a.inputTokens - b.inputTokens, outputTokens: a.outputTokens - b.outputTokens, cachedInputTokens: (a.cachedInputTokens ?? 0) - (b.cachedInputTokens ?? 0), cacheWriteTokens: (a.cacheWriteTokens ?? 0) - (b.cacheWriteTokens ?? 0) });

// A tool call as an activity row with its fingerprint (runtime-004), or null for items that are not tool calls.
export function codexActivity(item: Item): { label: string; fp: string } | null {
  if (item.type === 'commandExecution') return { label: `Running \`${item.command ?? ''}\``, fp: fingerprint('commandExecution', item.command ?? '') };
  if (item.type === 'fileChange') {
    const paths = (item.changes ?? []).map((c) => c.path);
    return { label: `Editing ${paths.map((p) => `\`${p}\``).join(', ')}`, fp: fingerprint('fileChange', paths) };
  }
  if (item.type === 'mcpToolCall') return { label: item.server === 'aiws' && item.tool === 'delegate' ? 'Subtask' : item.server === 'aiws' && item.tool === 'start_task' ? 'Starting task' : `Using ${item.server} ${item.tool}`, fp: fingerprint(`mcp ${item.server} ${item.tool}`, item.arguments ?? {}) };
  return null;
}

const failed = (item: Item) => item.status === 'failed' || item.status === 'declined' || (item.exitCode !== undefined && item.exitCode !== null && item.exitCode !== 0);

// What an approval request asks for, as the card shows it.
function approvalCard(method: string, p: Record<string, unknown>): { tool: string; detail: string } {
  if (method === 'item/commandExecution/requestApproval') return { tool: 'Shell', detail: String(p.command ?? p.reason ?? 'a command') };
  if (method === 'item/fileChange/requestApproval') return { tool: 'Edit', detail: String(p.reason ?? (p.grantRoot ? `write access under ${p.grantRoot}` : 'file changes')) };
  return { tool: 'Permissions', detail: String(p.reason ?? JSON.stringify(p.permissions)).slice(0, 400) };
}

export class CodexProcess implements AgentProcess {
  private child?: ChildProcessWithoutNullStreams;
  private next = 0;
  private waiting = new Map<number, (m: Message) => void>();
  private onMessage?: (m: Message) => void;
  private onExit?: () => void;
  private err = '';
  private threadId?: string;
  private fresh = true;
  private info?: Body;
  private mcp = new Map<string, string>();
  readonly model?: string;
  readonly effort?: string;
  readonly permissionMode?: string;

  private session: Session;
  private root: string;

  constructor(session: Session, root: string) {
    this.session = session;
    this.root = root;
    this.model = session.model;
    this.effort = session.effort;
    this.permissionMode = session.permissionMode;
  }

  private start(): void {
    const [bin, pre] = command();
    const child = spawn(bin, [...pre, 'app-server'], { cwd: this.root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let pending = '';
    child.stdout.on('data', (d) => {
      pending += d;
      const parts = pending.split('\n');
      pending = parts.pop() ?? '';
      for (const l of parts) {
        if (!l.trim()) continue;
        let m: Message;
        try { m = JSON.parse(l) as Message; } catch { continue; }
        if (m.id !== undefined && !m.method) this.waiting.get(Number(m.id))?.(m);
        else if (m.method === 'mcpServer/startupStatus/updated') this.mcp.set(String(m.params?.name), m.params?.status === 'ready' ? 'connected' : String(m.params?.status));
        else this.onMessage?.(m);
      }
    });
    child.stderr.on('data', (d) => (this.err = (this.err + d).slice(-4000)));
    child.on('error', (e) => (this.err += e.message));
    child.on('close', () => {
      this.child = undefined;
      for (const w of this.waiting.values()) w({ error: { message: `codex app-server exited: ${this.err.trim().split('\n').pop() || 'no output'}` } });
      this.waiting.clear();
      this.onExit?.();
    });
    this.child = child;
  }

  private send(value: unknown): void {
    this.child?.stdin.write(JSON.stringify(value) + '\n');
  }

  private async request(method: string, params: unknown): Promise<Record<string, unknown>> {
    const id = ++this.next;
    const reply = await new Promise<Message>((resolve) => {
      this.waiting.set(id, resolve);
      this.send({ id, method, params });
    });
    this.waiting.delete(id);
    if (reply.error) throw new Error(`codex ${method}: ${reply.error.message ?? 'failed'}`);
    return reply.result ?? {};
  }

  // Starts the process and opens the session's thread: the agent's own one when it still exists, else a new one.
  private async open(): Promise<void> {
    this.start();
    await this.request('initialize', { clientInfo: { name: 'ai-workspace', title: 'AI Workspace', version: '0.1.0' }, capabilities: null });
    this.send({ method: 'initialized' });
    const { task } = this.session;
    const params: Record<string, unknown> = { cwd: this.root, ...(this.model ? { model: this.model } : {}), ...(MODES[this.permissionMode ?? ''] ?? {}) };
    const aiws = { command: process.execPath, args: [workspaceServer, this.session.id], env: { AI_WORKSPACE_HOME: home() }, tool_timeout_sec: 2147483 };
    if (task && !task.parentId) {
      params.config = { 'mcp_servers.aiws': { ...aiws, default_tools_approval_mode: 'approve' } };
      params.developerInstructions = `AI Workspace task: ${TASK_NOTE} To hand a self-contained part of the work to the agent of another workspace role, use the workspace delegate tool.`;
    } else if (task) {
      params.developerInstructions = `AI Workspace task: ${TASK_NOTE}`;
    } else if (!task) {
      // Starting a task is the chat's job (ADR 0011), so no card; the task asks for its own actions.
      params.config = { 'mcp_servers.aiws': { ...aiws, default_tools_approval_mode: 'approve' } };
      params.developerInstructions = 'AI Workspace session: to run self-contained work in the background as a task, use the workspace start_task tool.';
    }
    if (!task && this.session.role === ORCHESTRATION) {
      // The orchestrator only reads and runs tasks, whatever agent the role uses (orchestrator-006): no writes, no escalation.
      Object.assign(params, { approvalPolicy: 'never', sandbox: 'read-only', developerInstructions: `AI Workspace session: ${orchestratorNote()}` });
    }
    let r: Record<string, unknown> | undefined;
    if (this.session.vendorSessionId) {
      try { r = await this.request('thread/resume', { threadId: this.session.vendorSessionId, excludeTurns: true, ...params }); } catch { /* gone: start fresh from the workspace history */ }
    }
    this.fresh = !r;
    r ??= await this.request('thread/start', params);
    this.threadId = (r.thread as { id: string }).id;
    const sandbox = (r.sandbox as { type?: string } | undefined)?.type;
    this.info = { type: 'init', model: r.model as string | undefined, permissionMode: `approval ${String(r.approvalPolicy)}${sandbox ? ` · sandbox ${sandbox}` : ''}`, ruleFiles: r.instructionSources as string[] | undefined };
  }

  kill(): void {
    const child = this.child;
    this.child = undefined;
    if (!child || child.exitCode !== null) return;
    if (process.platform === 'win32' && child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    else child.kill('SIGTERM');
  }

  close(): void {
    this.child?.stdin.end();
    const child = this.child;
    setTimeout(() => child && child.exitCode === null && this.kill(), 5000).unref();
  }

  async turn(input: TurnInput): Promise<TurnEnd> {
    const { emit, signal } = input;
    try {
      if (!this.child) await this.open();
    } catch (e) {
      this.kill();
      return { error: (e as Error).message };
    }
    const threadId = this.threadId!;
    emit({ ...this.info!, mcp: [...this.mcp].map(([name, status]) => ({ name, status })) } as Body);
    const prompt = this.fresh && input.history ? `Earlier in this conversation:\n\n${input.history}\n\nUser: ${input.prompt}` : input.prompt;
    this.fresh = false;
    let text = '';
    let turnId: string | undefined;
    let base: Usage | undefined;
    let usage: Usage = { inputTokens: 0, outputTokens: 0 };
    let error: string | undefined;
    const streamed = new Set<string>();
    const flush = () => {
      if (text) emit({ type: 'text', text });
      text = '';
    };
    return new Promise<TurnEnd>((resolve) => {
      const timer = setInterval(flush, 250);
      let killTimer: NodeJS.Timeout | undefined;
      let ended = false;
      const end = (r: TurnEnd) => {
        if (ended) return;
        ended = true;
        clearInterval(timer);
        clearTimeout(killTimer);
        signal.removeEventListener('abort', interrupt);
        this.onMessage = undefined;
        this.onExit = undefined;
        flush();
        emit({ type: 'usage', usage });
        resolve({ vendorSessionId: threadId, ...r });
      };
      const kill = (r: TurnEnd) => {
        this.kill();
        end(r);
      };
      const interrupt = () => {
        if (signal.reason === 'kill' || !turnId) return kill({});
        this.send({ id: ++this.next, method: 'turn/interrupt', params: { threadId, turnId } });
        killTimer = setTimeout(() => kill({}), 10000);
      };
      const reply = (id: number | string, result: unknown) => this.send({ id, result });
      const ask = async (m: Message) => {
        const card = approvalCard(m.method!, m.params ?? {});
        const id = `codex-${String(m.params?.itemId ?? m.id)}-${String(m.id)}`;
        emit({ type: 'approval', id, ...card });
        const allow = await awaitAnswer(this.session.id, id);
        if (m.method === 'item/permissions/requestApproval') {
          const p = (m.params?.permissions ?? {}) as Record<string, unknown>;
          return reply(m.id!, { permissions: allow ? { network: p.network ?? undefined, fileSystem: p.fileSystem ?? undefined } : {}, scope: 'turn' });
        }
        reply(m.id!, { decision: allow ? 'accept' : allow === null ? 'cancel' : 'decline' });
      };
      this.onMessage = (m) => {
        const p = m.params ?? {};
        if (m.id !== undefined && m.method) {
          // A request from Codex: approvals become cards; anything else the workspace cannot answer yet.
          if (/^item\/(commandExecution|fileChange|permissions)\/requestApproval$/.test(m.method)) void ask(m);
          else this.send({ id: m.id, error: { code: -32601, message: `${m.method} is not supported by the AI Workspace` } });
          return;
        }
        if (p.threadId !== undefined && p.threadId !== threadId) return;
        if (m.method === 'turn/started') turnId = (p.turn as { id: string }).id;
        else if (m.method === 'item/agentMessage/delta') {
          text += String(p.delta ?? '');
          streamed.add(String(p.itemId));
        } else if (m.method === 'item/started' || m.method === 'item/completed') {
          const item = p.item as Item;
          if (item.type === 'agentMessage' && m.method === 'item/completed' && !streamed.has(item.id) && item.text) text += item.text;
          const a = codexActivity(item);
          if (!a) return;
          flush();
          if (m.method === 'item/completed') return emit({ type: 'activity-done', id: item.id, error: failed(item) || undefined });
          emit({ type: 'activity', id: item.id, ...a });
          // Codex has no pre-run check: a call repeating the interrupted attempt stops the task (ADR 0006 fallback).
          const step = input.repeats?.get(a.fp);
          if (step) kill({ stopped: `possible repeat: ${step} already ran before the interruption` });
        } else if (m.method === 'thread/tokenUsage/updated') {
          const t = p.tokenUsage as { total: Breakdown; last: Breakdown };
          base ??= minus(usageOf(t.total), usageOf(t.last));
          usage = minus(usageOf(t.total), base);
          input.live?.(usage);
        } else if (m.method === 'error' && !p.willRetry) error = (p.error as { message?: string })?.message ?? 'codex error';
        else if (m.method === 'turn/completed') {
          const turn = p.turn as { status: string; error?: { message?: string } | null };
          end({ error: signal.aborted ? undefined : turn.status === 'failed' ? turn.error?.message ?? error ?? 'codex turn failed' : undefined });
        }
      };
      this.onExit = () => end({ error: signal.aborted ? undefined : `codex app-server exited: ${this.err.trim().split('\n').pop() || 'no result'}` });
      signal.addEventListener('abort', interrupt, { once: true });
      if (signal.aborted) return interrupt();
      this.request('turn/start', { threadId, input: [{ type: 'text', text: prompt, text_elements: [] }], ...(this.effort ? { effort: this.effort } : {}) })
        .then((r) => (turnId ??= (r.turn as { id: string }).id))
        .catch((e) => end({ error: (e as Error).message }));
    });
  }
}

const userCodexHome = () => process.env.CODEX_HOME ?? join(homedir(), '.codex');

// shortcut: reads two top-level keys with a regex, not a TOML parser or profiles; upgrade with app-server `config/read`.
export function codexPermissions(): { line: string; warn?: string } {
  const path = join(userCodexHome(), 'config.toml');
  const toml = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const key = (k: string) => new RegExp(`^${k}\\s*=\\s*"([^"]*)"`, 'm').exec(toml)?.[1];
  const sandbox = key('sandbox_mode') ?? 'default';
  const line = `Codex · approval ${key('approval_policy') ?? 'default'} · sandbox ${sandbox}`;
  return { line, warn: sandbox === 'danger-full-access' ? 'Codex runs without a sandbox (danger-full-access)' : undefined };
}

// Codex lists its models and each model's reasoning levels itself (`codex debug models`); cached briefly
// because it starts a process. Without it, only the configured default with Codex's basic levels.
let codexModels: { at: number; catalog: Catalog } | undefined;
interface CodexModel { slug: string; display_name?: string; visibility?: string; default_reasoning_level?: string; supported_reasoning_levels?: { effort: string }[] }
const CODEX_MODES = [
  { id: '', label: "Codex's settings", hint: 'Your own Codex settings decide' },
  { id: 'read-only', label: 'Read only', hint: 'Ask before anything else' },
  { id: 'auto', label: 'Auto', hint: 'Edit the project, ask for more' },
  { id: 'full-access', label: 'Full access', hint: 'Never ask', warn: true },
];
export function parseCodexModels(json: string, configured?: string): Catalog {
  const list = (JSON.parse(json) as { models?: CodexModel[] }).models ?? [];
  const shown = list.filter((m) => m.visibility !== 'hide');
  const efforts = (m?: CodexModel) => m?.supported_reasoning_levels?.map((r) => r.effort) ?? ['low', 'medium', 'high'];
  const own = list.find((m) => m.slug === configured);
  return {
    models: [
      { id: '', label: `Default${configured ? ` (${configured})` : ''}`, efforts: efforts(own), defaultEffort: own?.default_reasoning_level },
      ...shown.map((m) => ({ id: m.slug, label: m.display_name ?? m.slug, efforts: efforts(m), defaultEffort: m.default_reasoning_level })),
    ],
    modes: CODEX_MODES,
  };
}
export function codexCatalog(): Catalog {
  if (codexModels && Date.now() - codexModels.at < 10 * 60_000) return codexModels.catalog;
  const toml = existsSync(join(userCodexHome(), 'config.toml')) ? readFileSync(join(userCodexHome(), 'config.toml'), 'utf8') : '';
  const configured = /^model\s*=\s*"([^"]*)"/m.exec(toml)?.[1];
  const [bin, pre] = command();
  const r = spawnSync(bin, [...pre, 'debug', 'models'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  let catalog: Catalog;
  try { catalog = parseCodexModels(r.stdout, configured); } catch { catalog = { models: [{ id: '', label: `Default${configured ? ` (${configured})` : ''}`, efforts: ['low', 'medium', 'high'] }], modes: CODEX_MODES }; }
  codexModels = { at: Date.now(), catalog };
  return catalog;
}

export const codexSession: SessionAgent = {
  open: (session, root) => new CodexProcess(session, root),
  permissions: codexPermissions,
  catalog: codexCatalog,
};
