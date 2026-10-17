import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { home } from '../store.ts';
import { addUsage, writeLiveUsage, type AgentAdapter, type StepResult, type Usage } from '../runtime.ts';
import { type Body, type Catalog, type Session, type SessionAgent, type TurnInput } from '../sessions.ts';

const mcpServer = fileURLToPath(new URL('../mcp-server.ts', import.meta.url));
const TURNS_PER_STEP = 8;

interface ClaudeResult {
  subtype: string;
  is_error: boolean;
  result?: string;
  session_id: string;
  total_cost_usd?: number;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
}

type ClaudeUsage = NonNullable<ClaudeResult['usage']>;
const tokens = (u: ClaudeUsage): Usage => ({
  inputTokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
  outputTokens: u.output_tokens ?? 0,
  cachedInputTokens: u.cache_read_input_tokens ?? 0,
  cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
});

// Live usage from stream-json: one entry per assistant message id (later events of the same id supersede).
export function streamUsage(lines: string[]): Usage {
  const byMessage = new Map<string, ClaudeUsage>();
  for (const line of lines) {
    if (!line.startsWith('{')) continue;
    const e = JSON.parse(line) as { type: string; message?: { id?: string; usage?: ClaudeUsage } };
    if (e.type === 'assistant' && e.message?.id && e.message.usage) byMessage.set(e.message.id, e.message.usage);
  }
  return [...byMessage.values()].map(tokens).reduce(addUsage, { inputTokens: 0, outputTokens: 0 });
}

export function parseResult(stdout: string): StepResult {
  const r = JSON.parse(stdout) as ClaudeResult;
  const u = r.usage ?? {};
  const usage = {
    ...tokens(u),
    costUsd: r.total_cost_usd,
  };
  const adapterState = { sessionId: r.session_id };
  if (r.subtype === 'error_max_turns') return { done: false, usage, adapterState };
  if (r.is_error || r.subtype !== 'success') return { done: false, error: r.result ?? r.subtype, usage, adapterState };
  return { done: true, text: r.result, usage, adapterState };
}

// Claude Code in print mode with every built-in tool disabled: file access only through the
// workspace MCP server, so the broker enforces scope and audits each call. No user/project
// settings are loaded: user rules, hooks and model aliases must not steer a workspace task.
export const claudeCode: AgentAdapter = {
  step({ task, root }) {
    const mcpConfig = JSON.stringify({
      mcpServers: { ws: { command: process.execPath, args: [mcpServer, task.id], env: { AI_WORKSPACE_HOME: home() } } },
    });
    const sessionId = task.adapterState?.sessionId as string | undefined;
    const args = ['-p', sessionId ? (task.prompt ?? 'Continue the task.') : task.goal, '--output-format', 'stream-json', '--verbose', '--tools', '', '--mcp-config', mcpConfig, '--strict-mcp-config', '--setting-sources', '', '--allowedTools', 'mcp__ws', '--max-turns', String(TURNS_PER_STEP)];
    if (task.model) args.push('--model', task.model);
    if (sessionId) args.push('--resume', sessionId);
    else args.push('--append-system-prompt', 'Use only the mcp__ws tools for file access. Paths are relative to the project root.');
    return new Promise((resolvePromise, reject) => {
      const child = spawn(process.env.CLAUDE_BIN ?? 'claude', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MCP_TOOL_TIMEOUT: '3600000' }, windowsHide: true });
      let out = '';
      let err = '';
      let pending = '';
      const lines: string[] = [];
      child.stdout.on('data', (d) => {
        out += d;
        pending += d;
        const parts = pending.split('\n');
        pending = parts.pop() ?? '';
        lines.push(...parts);
        if (parts.some((l) => l.includes('"type":"assistant"'))) writeLiveUsage(task.id, streamUsage(lines));
      });
      child.stderr.on('data', (d) => (err += d));
      child.on('error', reject);
      child.on('close', (code) => {
        try {
          const result = out.split('\n').findLast((l) => l.startsWith('{') && (JSON.parse(l) as { type?: string }).type === 'result');
          resolvePromise(parseResult(result ?? ''));
        } catch {
          reject(new Error(`claude exited ${code}: ${err.trim() || out.trim()}`));
        }
      });
    });
  },
};

// --- Sessions (ADR 0004): Claude Code with its own tools, settings and permission rules. Its "ask"
// prompts go to the workspace approval tool, which shows them as approval cards (sessions-019).

const approvalServer = fileURLToPath(new URL('../approval-server.ts', import.meta.url));

const outsideRoot = (root: string, p: string) => {
  const r = relative(root, resolve(root, p));
  return r.startsWith('..') || isAbsolute(r);
};
const rel = (root: string, p: string) => (outsideRoot(root, p) ? p : relative(root, resolve(root, p)).replaceAll('\\', '/'));
const short = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// A readable label for one tool call, for the live activity list (sessions-007).
export function activityLabel(name: string, input: Record<string, unknown>, root: string): { label: string; outside?: boolean } {
  const path = (input.file_path ?? input.notebook_path) as string | undefined;
  const s = (k: string) => short(String(input[k] ?? ''));
  if (path && ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(name)) return { label: `Editing \`${rel(root, path)}\``, outside: outsideRoot(root, path) || undefined };
  if (path && name === 'Read') return { label: `Reading \`${rel(root, path)}\`` };
  if (name === 'Bash') return { label: `Running \`${s('command')}\`` };
  if (name === 'Grep') return { label: `Searching for \`${s('pattern')}\`` };
  if (name === 'Glob') return { label: `Finding \`${s('pattern')}\`` };
  if (name === 'WebFetch') return { label: `Fetching ${s('url')}` };
  if (name === 'WebSearch') return { label: `Searching the web: ${s('query')}` };
  if (name === 'Task' || name === 'Agent') return { label: `Delegating: ${s('description')}` };
  if (name === 'TodoWrite') return { label: 'Updating the to-do list' };
  return { label: `Using ${name.replace(/^mcp__/, '').replaceAll('__', ' ')}` };
}

interface StreamLine {
  type: string;
  subtype?: string;
  session_id?: string;
  permissionMode?: string;
  memory_paths?: unknown;
  model?: string;
  content?: string;
  level?: string;
  prevent_continuation?: boolean;
  plugins?: { name: string; path?: string }[];
  mcp_servers?: { name: string; status: string }[];
  skills?: unknown[];
  event?: { type: string; delta?: { type: string; text?: string } };
  message?: { content?: { type: string; id?: string; name?: string; input?: Record<string, unknown>; tool_use_id?: string; is_error?: boolean }[] };
}

// Maps one stream-json line to contract events; text arrives as deltas (--include-partial-messages).
export function sessionEvents(line: string, root: string): { events: Body[]; sessionId?: string; result?: StepResult } {
  if (!line.startsWith('{')) return { events: [] };
  const e = JSON.parse(line) as StreamLine;
  if (e.type === 'system' && e.subtype === 'init') {
    const paths = Array.isArray(e.memory_paths) ? e.memory_paths : e.memory_paths && typeof e.memory_paths === 'object' ? Object.values(e.memory_paths) : [];
    const ruleFiles = paths.map((p) => (typeof p === 'string' ? p : String((p as { path?: string }).path ?? JSON.stringify(p))));
    // Built-in plugins ship with Claude Code; the workspace's own approval server is not the user's.
    const plugins = e.plugins?.filter((p) => p.path !== 'builtin').map((p) => p.name);
    const mcp = e.mcp_servers?.filter((m) => m.name !== 'wsapprove').map(({ name, status }) => ({ name, status }));
    return { events: [{ type: 'init', model: e.model, permissionMode: e.permissionMode, ruleFiles, plugins, mcp, skills: e.skills?.length }], sessionId: e.session_id };
  }
  // Warnings Claude Code shows in its own UI, for example a plugin hook that dropped the prompt.
  if (e.type === 'system' && e.subtype === 'informational' && e.content) return { events: [{ type: 'notice', text: e.content, blocked: e.prevent_continuation || undefined }] };
  if (e.type === 'stream_event' && e.event?.type === 'content_block_delta' && e.event.delta?.type === 'text_delta') return { events: [{ type: 'text', text: e.event.delta.text ?? '' }] };
  if (e.type === 'assistant') {
    return { events: (e.message?.content ?? []).filter((b) => b.type === 'tool_use' && b.id).map((b) => ({ type: 'activity' as const, id: b.id!, ...activityLabel(b.name ?? '', b.input ?? {}, root) })) };
  }
  if (e.type === 'user') {
    return { events: (e.message?.content ?? []).filter((b) => b.type === 'tool_result' && b.tool_use_id).map((b) => ({ type: 'activity-done' as const, id: b.tool_use_id!, error: b.is_error || undefined })) };
  }
  if (e.type === 'result') return { events: [], result: parseResult(line), sessionId: e.session_id };
  return { events: [] };
}

const claudeHome = () => process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');

// Allow/ask/deny rules are not in the stream, so they are read from the settings files (user,
// project, local; later wins for the mode). shortcut: managed (enterprise) settings are not read.
export function claudePermissions(root: string): { line: string; warn?: string } {
  const files = [join(claudeHome(), 'settings.json'), join(root, '.claude', 'settings.json'), join(root, '.claude', 'settings.local.json')];
  let mode = 'default';
  const rules: Record<'allow' | 'ask' | 'deny', string[]> = { allow: [], ask: [], deny: [] };
  for (const f of files) {
    if (!existsSync(f)) continue;
    type Perms = { defaultMode?: string; allow?: string[]; ask?: string[]; deny?: string[] };
    let p: Perms | undefined;
    try { p = (JSON.parse(readFileSync(f, 'utf8')) as { permissions?: Perms }).permissions; } catch { continue; }
    if (p?.defaultMode) mode = p.defaultMode;
    for (const k of ['allow', 'ask', 'deny'] as const) rules[k].push(...(p?.[k] ?? []));
  }
  const list = (k: 'ask' | 'deny') => (rules[k].length ? `${k}: ${short(rules[k].join(', '), 60)}` : null);
  const line = ['Claude Code', `mode ${mode}`, list('deny'), list('ask'), rules.allow.length ? `${rules.allow.length} allow rules` : null].filter(Boolean).join(' · ');
  return { line, warn: mode === 'bypassPermissions' ? 'Claude Code skips all permission checks (bypassPermissions)' : undefined };
}

// Started from inside a Claude Code host (e.g. the Claude desktop app), the host's own variables
// (ANTHROPIC_BASE_URL, CLAUDE_CODE_*) would override the user's settings `env` (proxy, model), so the
// session would not behave like the user's Claude Code elsewhere. Drop them; a normal launch is untouched.
export function agentEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (!env.CLAUDECODE) return env;
  return Object.fromEntries(Object.entries(env).filter(([k]) => !/^(CLAUDECODE$|CLAUDE_|ANTHROPIC_)/.test(k)));
}

type TurnEnd = { vendorSessionId?: string; error?: string; staleHint?: boolean };

// One Claude Code process for a whole session: messages go in over stdin as stream-json, so plugins
// and hooks keep their in-memory state between turns, as in an interactive Claude Code (issue #15).
export class ClaudeProcess {
  private child?: ChildProcessWithoutNullStreams;
  private onLine?: (line: string) => void;
  private onExit?: (code: number | null) => void;
  private err = '';
  fresh = true; // started without --resume: the next prompt must carry the earlier conversation
  effort?: string; // the level this process was started with; a change needs a new process
  model?: string; // the model it was started with; likewise
  sessionId?: string;

  private session: Session;
  private root: string;

  constructor(session: Session, root: string) {
    this.session = session;
    this.root = root;
  }

  get alive() {
    return !!this.child && this.child.exitCode === null;
  }

  private start(resume?: string): void {
    const mcpConfig = JSON.stringify({ mcpServers: { wsapprove: { command: process.execPath, args: [approvalServer, this.session.id], env: { AI_WORKSPACE_HOME: home() } } } });
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--mcp-config', mcpConfig, '--permission-prompt-tool', 'mcp__wsapprove__approve'];
    if (this.session.model) args.push('--model', this.session.model);
    // The agent is told its level, so rules that depend on it (for example an effort check) can read it.
    this.effort = this.session.effort;
    this.model = this.session.model;
    if (this.effort) args.push('--effort', this.effort);
    args.push('--append-system-prompt', `AI Workspace session: effort level ${this.effort ?? "not set by the workspace (the agent's own default)"}. This note is always current: when the user changes the level in the workspace's composer, the agent is restarted with the new level and an updated note.`);
    if (resume) args.push('--resume', resume);
    this.fresh = !resume;
    this.sessionId = resume;
    this.err = '';
    // CLAUDE_BIN may name a script (tests use a fake CLI), which runs with this Node.
    const bin = process.env.CLAUDE_BIN ?? 'claude';
    const [cmd, pre] = /\.(m?js|ts)$/.test(bin) ? [process.execPath, [bin]] : [bin, []];
    const child = spawn(cmd, [...pre, ...args], { cwd: this.root, env: { ...agentEnv(process.env), MCP_TOOL_TIMEOUT: '86400000' }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let pending = '';
    child.stdout.on('data', (d) => {
      pending += d;
      const parts = pending.split('\n');
      pending = parts.pop() ?? '';
      for (const l of parts) if (l.trim()) this.onLine?.(l.trim());
    });
    child.stderr.on('data', (d) => (this.err = (this.err + d).slice(-4000)));
    child.on('error', (e) => (this.err += e.message));
    child.on('close', (code) => this.onExit?.(code));
    this.child = child;
  }

  private send(value: unknown): void {
    this.child?.stdin.write(JSON.stringify(value) + '\n');
  }

  // Ends the process and its subprocesses (commands, MCP servers).
  kill(): void {
    const child = this.child;
    this.child = undefined;
    if (!child || child.exitCode !== null) return;
    if (process.platform === 'win32' && child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    else child.kill('SIGTERM');
  }

  // Lets the process finish what it writes, then ends it.
  close(): void {
    this.child?.stdin.end();
    const child = this.child;
    setTimeout(() => child && child.exitCode === null && this.kill(), 5000).unref();
  }

  // Runs one turn. Stop sends Claude Code's own interrupt; if it does not end the turn soon, the process is ended.
  turn(input: Pick<TurnInput, 'prompt' | 'history' | 'emit' | 'signal'>): Promise<TurnEnd> {
    if (!this.alive) this.start(this.session.vendorSessionId);
    const { emit, signal } = input;
    const resumed = !this.fresh;
    const prompt = this.fresh && input.history ? `Earlier in this conversation:\n\n${input.history}\n\nUser: ${input.prompt}` : input.prompt;
    this.fresh = false;
    let text = '';
    let sawText = false;
    const flush = () => {
      if (text) emit({ type: 'text', text });
      text = '';
    };
    return new Promise<TurnEnd>((resolve) => {
      const timer = setInterval(flush, 250); // batch deltas so the log holds chunks, not single tokens
      let killTimer: NodeJS.Timeout | undefined;
      const end = (r: TurnEnd) => {
        clearInterval(timer);
        clearTimeout(killTimer);
        signal.removeEventListener('abort', interrupt);
        this.onLine = undefined;
        this.onExit = undefined;
        flush();
        resolve({ vendorSessionId: this.sessionId, ...r });
      };
      const interrupt = () => {
        this.send({ type: 'control_request', request_id: `stop-${Date.now()}`, request: { subtype: 'interrupt' } });
        killTimer = setTimeout(() => { this.kill(); end({}); }, 10000);
      };
      this.onLine = (line) => {
        let parsed;
        try { parsed = sessionEvents(line, this.root); } catch { return; }
        this.sessionId = parsed.sessionId ?? this.sessionId;
        for (const ev of parsed.events) {
          if (ev.type === 'text') { text += ev.text; sawText = true; continue; }
          flush();
          emit(ev);
        }
        if (parsed.result) {
          emit({ type: 'usage', usage: parsed.result.usage });
          end({ error: signal.aborted ? undefined : parsed.result.error });
        }
      };
      this.onExit = (code) => {
        this.child = undefined;
        const error = signal.aborted ? undefined : `claude exited ${code}: ${this.err.trim() || 'no result'}`;
        // An expired or unknown vendor session: the workspace history is the source, so start fresh from it.
        end({ error, staleHint: resumed && !sawText && /no conversation found/i.test(this.err) });
      };
      signal.addEventListener('abort', interrupt, { once: true });
      this.send({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] } });
    });
  }
}

// A single turn in its own process (used by tests and as the SessionAgent contract); the session host
// keeps one ClaudeProcess for many turns instead.
// Claude Code's documented model aliases (claude --help); the user's own default comes from their settings.
const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
export function claudeCatalog(): Catalog {
  let own: string | undefined;
  try { own = (JSON.parse(readFileSync(join(claudeHome(), 'settings.json'), 'utf8')) as { model?: string }).model; } catch { /* no settings */ }
  const models = [['', `Default${own ? ` (${own})` : ''}`], ['fable', 'Fable'], ['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku']];
  return { models: models.map(([id, label]) => ({ id: id!, label: label!, efforts: CLAUDE_EFFORTS })) };
}

export const claudeSession: SessionAgent = {
  async turn(input) {
    const proc = new ClaudeProcess(input.session, input.root);
    try {
      const first = await proc.turn(input);
      if (!first.staleHint) return first;
      input.session.vendorSessionId = undefined;
      return await new ClaudeProcess(input.session, input.root).turn(input);
    } finally {
      proc.close();
    }
  },
  permissions: claudePermissions,
  catalog: claudeCatalog,
};
