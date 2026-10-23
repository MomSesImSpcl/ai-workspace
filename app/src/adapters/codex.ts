import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { home } from '../store.ts';
import { codexHookNotices } from '../sandbox-check.ts';
import { ghBlockArgs, mergeCommand } from '../merge.ts';
import { agentInstructions } from '../prompt.ts';
import { commitRoots, GUARD_MARK, guardedCommand, guardedPath, guardedTree, guardFor, guardNotice, type Guard } from '../worktrees.ts';
import { commandFile, minimalPrompt, runSetup, saveInventory, setupApplies, type SetupItem } from '../setup.ts';
import { awaitAnswer, fingerprint, type AgentProcess, type Body, type Catalog, type Session, type SessionAgent, type TurnEnd, type TurnInput, type Usage, ORCHESTRATION } from '../sessions.ts';

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

/**
 * `path` (a PATH value) with the real folder of each linked program placed before the folder holding its link
 * (#21). Codex's Windows sandbox cannot run a program through a link, such as WinGet's `Links` folder, so a user
 * hook calling `rtk` failed there; the real folder lets the same name find the program itself. Only `.exe` links
 * count, so folders full of other links (Linux `/usr/bin`) are left alone.
 */
export function sandboxPath(path: string): string {
  const out: string[] = [];
  for (const dir of path.split(delimiter)) {
    if (!dir) continue;
    let names: string[] = [];
    try { names = readdirSync(dir).filter((n) => /\.exe$/i.test(n)); } catch { /* missing folder */ }
    for (const n of names) {
      try {
        if (!lstatSync(join(dir, n)).isSymbolicLink()) continue;
        const real = dirname(realpathSync(join(dir, n)));
        if (!out.includes(real)) out.push(real);
      } catch { /* broken link */ }
    }
    if (!out.includes(dir)) out.push(dir);
  }
  return out.join(delimiter);
}

/**
 * Codex settings for its shell on Windows (#21): the Windows sandbox drops `HOME`, so a program a hook runs there
 * (`rtk`) cannot find Claude Code's folder; `CLAUDE_CONFIG_DIR` is passed instead, as Claude Code's own default
 * (`claudeDir`), unless the user's Codex `config.toml` sets it already. Empty on other systems, whose sandboxes
 * keep `HOME`. The value matches the default, so it changes nothing where no sandbox runs.
 */
export function shellEnvArgs(platform: string, claudeDir: string, userConfig: string): string[] {
  // Set as a table key, dotted key or inline table entry; a commented-out line does not count.
  if (platform !== 'win32' || /^[^#\n]*\bCLAUDE_CONFIG_DIR\s*=/m.test(userConfig)) return [];
  return ['-c', `shell_environment_policy.set.CLAUDE_CONFIG_DIR=${JSON.stringify(claudeDir)}`]; // a TOML string
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
  if (item.type === 'mcpToolCall') return { label: item.server === 'aiws' && item.tool === 'start_task' ? 'Starting task' : `Using ${item.server} ${item.tool}`, fp: fingerprint(`mcp ${item.server} ${item.tool}`, item.arguments ?? {}) };
  return null;
}

const failed = (item: Item) => item.status === 'failed' || item.status === 'declined' || (item.exitCode !== undefined && item.exitCode !== null && item.exitCode !== 0);

// What an approval request asks for, as the card shows it.
function approvalCard(method: string, p: Record<string, unknown>): { tool: string; detail: string } {
  if (method === 'item/commandExecution/requestApproval') return { tool: 'Shell', detail: String(p.command ?? p.reason ?? 'a command') };
  if (method === 'item/fileChange/requestApproval') return { tool: 'Edit', detail: String(p.reason ?? (p.grantRoot ? `write access under ${p.grantRoot}` : 'file changes')) };
  return { tool: 'Permissions', detail: String(p.reason ?? JSON.stringify(p.permissions)).slice(0, 400) };
}

type WriteEntry = { access: string; path: { type: string; path?: string; pattern?: string; kind?: string } };

/**
 * The guarded folder an approval request would let the agent write to (selfdev-002), or `undefined`: a command
 * naming it, a file change in it (`edits`: the paths of each file-change item), or write access to a folder
 * holding it.
 */
export function guardedRequest(g: Guard, method: string, p: Record<string, unknown>, edits: Map<string, string[]>): string | undefined {
  const cwd = typeof p.cwd === 'string' ? p.cwd : g.allow;
  if (method === 'item/commandExecution/requestApproval') return typeof p.command === 'string' ? guardedCommand(g, p.command, cwd) : undefined;
  if (method === 'item/fileChange/requestApproval') {
    return (edits.get(String(p.itemId)) ?? []).map((f) => guardedPath(g, f, cwd)).find(Boolean) ?? (typeof p.grantRoot === 'string' ? guardedTree(g, p.grantRoot, cwd) : undefined);
  }
  const fs = (p.permissions as { fileSystem?: { write?: string[] | null; entries?: WriteEntry[] | null } | null } | undefined)?.fileSystem;
  const writes = (fs?.entries ?? []).filter((e) => e.access === 'write');
  if (writes.some((e) => e.path.type === 'special' && e.path.kind === 'root')) return g.deny[0];
  // A glob counts from its folder part (before the first wildcard).
  const dirs = [...(fs?.write ?? []), ...writes.map((e) => e.path.path ?? e.path.pattern?.replace(/[*?[{].*$/, '') ?? '')].filter(Boolean);
  return dirs.map((d) => guardedTree(g, d, cwd)).find(Boolean);
}

// Codex built-in parts that can be switched off for one run (codex-cli 0.163.0, measured on a task call).
const CODEX_FEATURES = [
  ['memories', 'Memories', 'What Codex remembers across sessions, about 3.8k tokens per call'],
  ['shell_tool', 'Shell tool', 'Runs shell commands (git, npm, tests); a task that runs commands needs it'],
  ['goals', 'Goals', 'Goal tracking tools'],
  ['image_generation', 'Image generation', 'Generate images'],
];

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
  private path = ''; // the PATH Codex runs with
  private notes: string[] = []; // start-up notices for the first turn after a start
  private mcp = new Map<string, string>();
  private onMcp?: (exited?: boolean) => void; // called on each MCP start-up status and when the process exits
  private disabledPluginIds?: string[]; // plugins switched off for this run (orchestrator-005)
  readonly model?: string;
  readonly effort?: string;
  readonly permissionMode?: string;
  readonly setup?: string;

  private session: Session;
  private root: string;

  constructor(session: Session, root: string) {
    this.session = session;
    this.root = root;
    this.model = session.model;
    this.effort = session.effort;
    this.permissionMode = session.permissionMode;
    this.setup = session.task?.setup?.join(',');
  }

  private start(): void {
    const [bin, pre] = command();
    // Windows spells it `Path`; the key is kept as it is.
    const pathKey = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
    this.path = sandboxPath(process.env[pathKey] ?? '');
    const env = { ...process.env, [pathKey]: this.path };
    let userConfig = '';
    try { userConfig = readFileSync(join(userCodexHome(), 'config.toml'), 'utf8'); } catch { /* no config */ }
    const shell = shellEnvArgs(process.platform, process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), userConfig);
    const child = spawn(bin, [...pre, ...shell, ...ghBlockArgs(!!this.session.worktree), 'app-server'], { cwd: this.root, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
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
        else if (m.method === 'mcpServer/startupStatus/updated') {
          this.mcp.set(String(m.params?.name), m.params?.status === 'ready' ? 'connected' : String(m.params?.status));
          this.onMcp?.();
        } else this.onMessage?.(m);
      }
    });
    child.stderr.on('data', (d) => (this.err = (this.err + d).slice(-4000)));
    child.on('error', (e) => (this.err += e.message));
    child.on('close', () => {
      this.child = undefined;
      for (const w of this.waiting.values()) w({ error: { message: `codex app-server exited: ${this.err.trim().split('\n').pop() || 'no output'}` } });
      this.waiting.clear();
      this.onMcp?.(true);
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

  private async init(): Promise<void> {
    this.start();
    await this.request('initialize', { clientInfo: { name: 'ai-workspace', title: 'AI Workspace', version: '0.1.0' }, capabilities: null });
    this.send({ method: 'initialized' });
  }

  // What Codex loads besides its own prompt and tools (onboarding-010), listed by the app-server itself: enabled
  // plugins, MCP servers from the config, apps, standalone skills as one item, hooks. Paths of those skills too.
  async inventory(): Promise<{ items: SetupItem[]; skillPaths: string[] }> {
    if (!this.child) await this.init();
    const items: SetupItem[] = [];
    type Plugin = { id: string; name: string; installed?: boolean; enabled?: boolean; interface?: { displayName?: string; shortDescription?: string } };
    const { marketplaces = [] } = await this.request('plugin/list', {}) as { marketplaces?: { plugins: Plugin[] }[] };
    for (const p of marketplaces.flatMap((m) => m.plugins).filter((p) => p.installed && p.enabled)) items.push({ id: `plugin:${p.id}`, kind: 'plugin', title: p.interface?.displayName ?? p.name, description: p.interface?.shortDescription });
    const { config } = await this.request('config/read', { cwd: this.root }) as { config?: { mcp_servers?: Record<string, { command?: string; url?: string }> } };
    for (const [name, c] of Object.entries(config?.mcp_servers ?? {})) items.push({ id: `mcp:${name}`, kind: 'mcp', title: name, description: `MCP server: ${c.command ?? c.url ?? ''}`, path: c.command ? commandFile(c.command) : undefined });
    items.push({ id: 'apps', kind: 'apps', title: 'Apps and connectors', description: 'Codex apps (codex_apps), for example GitHub, Gmail and Google Drive' });
    type Skill = { name: string; path: string; enabled?: boolean; pluginId?: string | null };
    const { data = [] } = await this.request('skills/list', { cwds: [this.root] }) as { data?: { skills: Skill[] }[] };
    const skills = data.flatMap((d) => d.skills).filter((k) => k.enabled !== false && !k.pluginId);
    if (skills.length) items.push({ id: 'skills', kind: 'skills', title: 'Standalone skills', description: `Skills not from a plugin, switched together: ${skills.map((k) => k.name).join(', ')}`, parts: skills.map((k) => ({ name: k.name, path: k.path })) });
    if (existsSync(join(userCodexHome(), 'hooks.json'))) items.push({ id: 'hooks', kind: 'hooks', title: 'Your hooks', description: 'Hooks in your Codex hooks.json', path: join(userCodexHome(), 'hooks.json') });
    // Built-in parts with a feature switch; editing (apply_patch) and command execution always stay.
    for (const [flag, title, description] of CODEX_FEATURES) items.push({ id: `feature:${flag}`, kind: 'feature', title, description });
    items.push({ id: 'prompt', kind: 'prompt', title: "Codex's own instructions", description: 'Its base prompt: coding conventions, editing and sandbox guidance, answer format. Off: a short workspace prompt, about 4k tokens less per call' });
    return { items, skillPaths: skills.map((k) => k.path) };
  }

  // Starts the process and opens the session's thread: the agent's own one when it still exists, else a new one.
  private async open(): Promise<void> {
    await this.init();
    const { task } = this.session;
    const params: Record<string, unknown> = { cwd: this.root, ...(this.model ? { model: this.model } : {}), ...(MODES[this.permissionMode ?? ''] ?? {}) };
    // The workspace server runs gh for request_merge with the user's own login, so it gets what gh needs to find it.
    const wanted = ['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'SYSTEMROOT', 'GH_CONFIG_DIR', 'AI_WORKSPACE_GH'];
    const own = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => v && wanted.includes(k.toUpperCase())) as [string, string][]); // keys as spelled (Windows: Path)
    const aiws = { command: process.execPath, args: [workspaceServer, this.session.id], env: { ...own, AI_WORKSPACE_HOME: home() }, tool_timeout_sec: 2147483 };
    // Chats, orchestrator chats and top-level tasks get the workspace tools; subtasks have none yet.
    if (!task?.parentId) params.config = { 'mcp_servers.aiws': { ...aiws, default_tools_approval_mode: 'approve' } };
    if (!task && this.session.role === ORCHESTRATION) {
      // The orchestrator only reads and runs tasks, whatever agent the role uses (orchestrator-006): no writes, no escalation.
      Object.assign(params, { approvalPolicy: 'never', sandbox: 'read-only' });
    }
    let workspaceRules: string | undefined;
    // Orchestrator chats and tasks load only the chosen items, switched for this run only (orchestrator-005). Codex
    // reads its global AGENTS.md on every run and has no switch for one run, so the global-rules setting does not apply.
    if (setupApplies(this.session)) {
      // A Codex that cannot list keeps its full setup (onboarding-010).
      const { items, skillPaths } = await this.inventory().catch(() => ({ items: [] as SetupItem[], skillPaths: [] as string[] }));
      saveInventory('codex', items);
      const setup = runSetup(this.session, items, this.root);
      const config = (params.config ??= {}) as Record<string, unknown>;
      for (const i of items.filter((i) => !setup.on(i))) {
        if (i.kind === 'plugin') (this.disabledPluginIds ??= []).push(i.id.slice('plugin:'.length));
        else if (i.kind === 'mcp') config[`mcp_servers.${i.title}.enabled`] = false;
        else if (i.kind === 'apps') config['features.apps'] = false;
        else if (i.kind === 'skills') config['skills.config'] = skillPaths.map((path) => ({ path, enabled: false }));
        else if (i.kind === 'hooks') config['features.codex_hooks'] = false;
        else if (i.kind === 'feature') config[`features.${i.id.slice('feature:'.length)}`] = false;
        else if (i.kind === 'prompt') params.baseInstructions = minimalPrompt(this.root);
      }
      workspaceRules = setup.workspaceRules;
    }
    params.developerInstructions = agentInstructions(this.session, { effort: this.effort, workspaceRules });
    if (this.session.worktree && !params.sandbox) {
      const { config } = await this.request('config/read', { cwd: this.root }) as { config?: { sandbox_mode?: string } };
      if (config?.sandbox_mode === 'danger-full-access') params.sandbox = 'danger-full-access';
    }
    if (this.session.worktree) {
      // A worktree session keeps its writes in its folder, so the running app's checkout and storage stay untouched
      // (selfdev-002, ADR 0015). Git's folder of a worktree lies in the checkout, so the parts a commit writes to are
      // added to the sandbox. Full access becomes workspace-write with network, and anything beyond it fails
      // instead of asking (user, 2026-10-19).
      const config = (params.config ??= {}) as Record<string, unknown>;
      try { config['sandbox_workspace_write.writable_roots'] = commitRoots(this.root); } catch { /* not a git folder: commits fail */ }
      if (params.sandbox === 'danger-full-access') {
        Object.assign(params, { sandbox: 'workspace-write', approvalPolicy: 'never' });
        config['sandbox_workspace_write.network_access'] = true;
      }
    }
    let r: Record<string, unknown> | undefined;
    if (this.session.vendorSessionId) {
      try { r = await this.request('thread/resume', { threadId: this.session.vendorSessionId, excludeTurns: true, ...params }); } catch { /* gone: start fresh from the workspace history */ }
    }
    this.fresh = !r;
    r ??= await this.request('thread/start', params);
    this.threadId = (r.thread as { id: string }).id;
    const sandbox = (r.sandbox as { type?: string } | undefined)?.type;
    // Programs the user's hooks call must run inside the sandbox, or the commands they change fail there (#21).
    const hooksOff = (params.config as Record<string, unknown> | undefined)?.['features.codex_hooks'] === false;
    this.notes = sandbox && !/danger/i.test(sandbox) && !hooksOff ? codexHookNotices(userCodexHome(), this.path) : [];
    this.info = { type: 'init', model: r.model as string | undefined, permissionMode: `approval ${String(r.approvalPolicy)}${sandbox ? ` · sandbox ${sandbox}` : ''}`, ruleFiles: r.instructionSources as string[] | undefined };
    if ((params.config as Record<string, unknown> | undefined)?.['mcp_servers.aiws']) await this.aiwsSettled();
  }

  // Codex connects MCP servers in the background and a turn gets only the tools of those connected when it starts,
  // so without this wait a new chat's first turn can lack start_task and the other workspace tools. Codex's own
  // start-up timeout ends the wait with "failed"; the cap covers a Codex that never reports.
  private async aiwsSettled(cap = 30_000): Promise<void> {
    const settled = () => !['starting', undefined].includes(this.mcp.get('aiws'));
    if (settled()) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, cap);
      this.onMcp = (exited) => { if (exited || settled()) { clearTimeout(timer); resolve(); } };
    });
    this.onMcp = undefined;
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
    for (const text of this.notes.splice(0)) emit({ type: 'notice', text });
    const prompt = this.fresh && input.history ? `Earlier in this conversation:\n\n${input.history}\n\nUser: ${input.prompt}` : input.prompt;
    this.fresh = false;
    let text = '';
    let turnId: string | undefined;
    let base: Usage | undefined;
    let usage: Usage = { inputTokens: 0, outputTokens: 0 };
    let error: string | undefined;
    const streamed = new Set<string>();
    const guard = guardFor(this.root);
    const edits = new Map<string, string[]>(); // file-change item -> its paths, for the write guard (selfdev-002)
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
        // A request to write into the running app's checkout or storage is declined without a card (selfdev-002).
        if (this.session.worktree && m.method === 'item/commandExecution/requestApproval' && typeof m.params?.command === 'string' && mergeCommand(m.params.command)) {
          // Merging goes through the workspace's request_merge, after the user's approval (selfdev-004).
          emit({ type: 'notice', text: `${GUARD_MARK}: \`${m.params.command}\` would merge without the user's approval; merging goes through request_merge.` });
          return reply(m.id!, { decision: 'decline' });
        }
        const hit = guardedRequest(guard, m.method!, m.params ?? {}, edits);
        if (hit) {
          const p = m.params ?? {};
          emit({ type: 'notice', text: guardNotice(hit, typeof p.command === 'string' ? { command: p.command } : { file: (edits.get(String(p.itemId)) ?? [])[0] ?? `the folders it asked for (${hit})` }) });
          return reply(m.id!, m.method === 'item/permissions/requestApproval' ? { permissions: {}, scope: 'turn' } : { decision: 'decline' });
        }
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
          if (text && !streamed.has(String(p.itemId))) text += '\n\n'; // a new message right after another
          text += String(p.delta ?? '');
          streamed.add(String(p.itemId));
        } else if (m.method === 'item/started' || m.method === 'item/completed') {
          const item = p.item as Item;
          if (item.type === 'fileChange') edits.set(item.id, (item.changes ?? []).map((c) => c.path));
          if (item.type === 'agentMessage' && m.method === 'item/completed' && !streamed.has(item.id) && item.text) text += (text ? '\n\n' : '') + item.text;
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
      this.request('turn/start', { threadId, input: [{ type: 'text', text: prompt, text_elements: [] }], ...(this.effort ? { effort: this.effort } : {}), ...(this.disabledPluginIds ? { disabledPluginIds: this.disabledPluginIds } : {}) })
        .then((r) => (turnId ??= (r.turn as { id: string }).id))
        .catch((e) => end({ error: (e as Error).message }));
    });
  }
}

/** The user's Codex folder (config.toml, hooks.json, the global AGENTS.md); also named in the Agent Instructions tab (app/src/instructions.ts). */
export const userCodexHome = () => process.env.CODEX_HOME ?? join(homedir(), '.codex');

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
  { id: 'auto', label: 'Edit project files', hint: 'Change files in the project without asking; anything more still asks' },
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
  inventory: async (root) => {
    const p = new CodexProcess({ id: '', projectId: '', title: '', role: '', integration: 'codex', createdAt: '', updatedAt: '' }, root);
    try { return (await p.inventory()).items; } finally { p.kill(); }
  },
};
