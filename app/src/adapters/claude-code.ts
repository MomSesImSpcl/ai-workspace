import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { home } from '../store.ts';
import { addUsage, fingerprint, type AgentProcess, type Body, type Catalog, type Session, type SessionAgent, type TurnEnd, type TurnInput, type Usage } from '../sessions.ts';

// Claude Code with its own tools, settings and permission rules (ADR 0004). Its "ask" prompts go to the
// workspace server, which shows them as approval cards (sessions-019) and offers tasks `delegate`.

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

export function parseResult(line: string): { text?: string; error?: string; usage: Usage } {
  const r = JSON.parse(line) as ClaudeResult;
  const usage = { ...tokens(r.usage ?? {}), costUsd: r.total_cost_usd };
  if (r.is_error || r.subtype !== 'success') return { error: r.result || r.subtype, usage };
  return { text: r.result, usage };
}

const workspaceServer = fileURLToPath(new URL('../approval-server.ts', import.meta.url));
const repeatHook = fileURLToPath(new URL('../repeat-hook.ts', import.meta.url));

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
  if (name === 'mcp__aiws__delegate') return { label: `Subtask: ${s('goal')}` };
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
  message?: { id?: string; usage?: ClaudeUsage; content?: { type: string; id?: string; name?: string; input?: Record<string, unknown>; tool_use_id?: string; is_error?: boolean }[] };
}

// Maps one stream-json line to contract events; text arrives as deltas (--include-partial-messages).
// `usage` is one assistant message's usage so far (later lines of the same message supersede it).
export function sessionEvents(line: string, root: string): { events: Body[]; sessionId?: string; result?: ReturnType<typeof parseResult>; usage?: { id: string; usage: Usage } } {
  if (!line.startsWith('{')) return { events: [] };
  const e = JSON.parse(line) as StreamLine;
  if (e.type === 'system' && e.subtype === 'init') {
    const paths = Array.isArray(e.memory_paths) ? e.memory_paths : e.memory_paths && typeof e.memory_paths === 'object' ? Object.values(e.memory_paths) : [];
    const ruleFiles = paths.map((p) => (typeof p === 'string' ? p : String((p as { path?: string }).path ?? JSON.stringify(p))));
    // Built-in plugins ship with Claude Code; the workspace's own server (aiws) is not the user's. Claude Code drops a server named "workspace".
    const plugins = e.plugins?.filter((p) => p.path !== 'builtin').map((p) => p.name);
    const mcp = e.mcp_servers?.filter((m) => m.name !== 'aiws').map(({ name, status }) => ({ name, status }));
    return { events: [{ type: 'init', model: e.model, permissionMode: e.permissionMode, ruleFiles, plugins, mcp, skills: e.skills?.length }], sessionId: e.session_id };
  }
  // Warnings Claude Code shows in its own UI, for example a plugin hook that dropped the prompt.
  if (e.type === 'system' && e.subtype === 'informational' && e.content) return { events: [{ type: 'notice', text: e.content, blocked: e.prevent_continuation || undefined }] };
  if (e.type === 'stream_event' && e.event?.type === 'content_block_delta' && e.event.delta?.type === 'text_delta') return { events: [{ type: 'text', text: e.event.delta.text ?? '' }] };
  if (e.type === 'assistant') {
    const events = (e.message?.content ?? []).filter((b) => b.type === 'tool_use' && b.id)
      .map((b) => ({ type: 'activity' as const, id: b.id!, ...activityLabel(b.name ?? '', b.input ?? {}, root), fp: fingerprint(b.name ?? '', b.input ?? {}) }));
    return { events, usage: e.message?.id && e.message.usage ? { id: e.message.id, usage: tokens(e.message.usage) } : undefined };
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

// Hook commands run in a shell; forward slashes and quotes work in cmd, PowerShell and sh alike.
const shellPath = (p: string) => `"${p.replaceAll('\\', '/')}"`;

// One Claude Code process for a whole session: messages go in over stdin as stream-json, so plugins
// and hooks keep their in-memory state between turns, as in an interactive Claude Code (issue #15).
export class ClaudeProcess implements AgentProcess {
  private child?: ChildProcessWithoutNullStreams;
  private onLine?: (line: string) => void;
  private onExit?: (code: number | null) => void;
  private err = '';
  fresh = true; // started without --resume: the next prompt must carry the earlier conversation
  readonly effort?: string; // what this process was started with; a change needs a new process
  readonly model?: string;
  readonly permissionMode?: string;
  sessionId?: string;

  private session: Session;
  private root: string;

  constructor(session: Session, root: string) {
    this.session = session;
    this.root = root;
    this.effort = session.effort;
    this.model = session.model;
    this.permissionMode = session.permissionMode;
  }

  get alive() {
    return !!this.child && this.child.exitCode === null;
  }

  private start(resume?: string): void {
    const { session } = this;
    const mcpConfig = JSON.stringify({ mcpServers: { aiws: { command: process.execPath, args: [workspaceServer, session.id], env: { AI_WORKSPACE_HOME: home() } } } });
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--mcp-config', mcpConfig, '--permission-prompt-tool', 'mcp__aiws__approve'];
    if (this.model) args.push('--model', this.model);
    if (this.permissionMode) args.push('--permission-mode', this.permissionMode);
    if (session.task) {
      // A task's own `delegate` runs without a card; a call that repeats an interrupted attempt is held (runtime-004).
      if (!session.task.parentId) args.push('--allowedTools', 'mcp__aiws__delegate');
      const hook = { type: 'command', command: `${shellPath(process.execPath)} ${shellPath(repeatHook)} ${session.id}`, timeout: 30 };
      args.push('--settings', JSON.stringify({ hooks: { PreToolUse: [{ matcher: '*', hooks: [hook] }] } }));
    }
    // The agent is told its level, so rules that depend on it (for example an effort check) can read it.
    if (this.effort) args.push('--effort', this.effort);
    args.push('--append-system-prompt', `AI Workspace ${session.task ? 'task' : 'session'}: effort level ${this.effort ?? "not set by the workspace (the agent's own default)"}. This note is always current: when the user changes the level in the workspace's composer, the agent is restarted with the new level and an updated note.${session.task && !session.task.parentId ? ' To hand a self-contained part of the work to the agent of another workspace role, use the mcp__aiws__delegate tool.' : ''}`);
    if (resume) args.push('--resume', resume);
    this.fresh = !resume;
    this.sessionId = resume;
    this.err = '';
    // CLAUDE_BIN may name a script (tests use a fake CLI), which runs with this Node.
    const bin = process.env.CLAUDE_BIN ?? 'claude';
    const [cmd, pre] = /\.(m?js|ts)$/.test(bin) ? [process.execPath, [bin]] : [bin, []];
    // Approvals wait for the user without a time limit (runtime-002): the longest timeout Node allows.
    const child = spawn(cmd, [...pre, ...args], { cwd: this.root, env: { ...agentEnv(process.env), MCP_TOOL_TIMEOUT: '2147483647' }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
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

  // Runs one turn. Stop sends Claude Code's own interrupt; if it does not end the turn soon, the process is
  // ended. A 'kill' abort (task cancel, budget) ends the process tree at once (runtime-005).
  turn(input: TurnInput): Promise<TurnEnd> {
    if (!this.alive) this.start(this.session.vendorSessionId);
    const { emit, signal } = input;
    const resumed = !this.fresh;
    const prompt = this.fresh && input.history ? `Earlier in this conversation:\n\n${input.history}\n\nUser: ${input.prompt}` : input.prompt;
    this.fresh = false;
    let text = '';
    let sawText = false;
    const messages = new Map<string, Usage>();
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
        if (signal.reason === 'kill') {
          this.kill();
          emit({ type: 'usage', usage: [...messages.values()].reduce(addUsage, { inputTokens: 0, outputTokens: 0 }) });
          return end({});
        }
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
        if (parsed.usage) {
          messages.set(parsed.usage.id, parsed.usage.usage);
          input.live?.([...messages.values()].reduce(addUsage, { inputTokens: 0, outputTokens: 0 }));
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
      if (signal.aborted) return interrupt();
      this.send({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] } });
    });
  }
}

// Claude Code's documented model aliases and permission modes (claude --help); the user's own defaults come from their settings.
const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
export function claudeCatalog(): Catalog {
  let own: string | undefined;
  try { own = (JSON.parse(readFileSync(join(claudeHome(), 'settings.json'), 'utf8')) as { model?: string }).model; } catch { /* no settings */ }
  const models = [['', `Default${own ? ` (${own})` : ''}`], ['fable', 'Fable'], ['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku']];
  return {
    models: models.map(([id, label]) => ({ id: id!, label: label!, efforts: CLAUDE_EFFORTS })),
    modes: [
      { id: '', label: "Claude Code's settings" },
      { id: 'manual', label: 'Ask before acting (manual)' },
      { id: 'acceptEdits', label: 'Accept edits (acceptEdits)' },
      { id: 'auto', label: 'Auto (auto)' },
      { id: 'plan', label: 'Plan only (plan)' },
      { id: 'dontAsk', label: 'Deny what is not allowed (dontAsk)' },
      { id: 'bypassPermissions', label: 'Skip all checks (bypassPermissions)', warn: true },
    ],
  };
}

// A process whose resumed vendor session is gone starts again from the workspace history.
class ClaudeAgent implements AgentProcess {
  private proc: ClaudeProcess;
  private session: Session;
  private root: string;
  constructor(session: Session, root: string) {
    this.session = session;
    this.root = root;
    this.proc = new ClaudeProcess(session, root);
  }
  get model() { return this.proc.model; }
  get effort() { return this.proc.effort; }
  get permissionMode() { return this.proc.permissionMode; }
  async turn(input: TurnInput): Promise<TurnEnd> {
    const r = await this.proc.turn(input);
    if (!r.staleHint) return r;
    this.session.vendorSessionId = undefined;
    this.proc.close();
    this.proc = new ClaudeProcess(this.session, this.root);
    return this.proc.turn(input);
  }
  close() { this.proc.close(); }
}

export const claudeSession: SessionAgent = {
  open: (session, root) => new ClaudeAgent(session, root),
  permissions: claudePermissions,
  catalog: claudeCatalog,
};
