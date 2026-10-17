import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { home } from '../store.ts';
import { addUsage, writeLiveUsage, type AgentAdapter, type StepResult, type Usage } from '../runtime.ts';
import { runLines, type Body, type SessionAgent, type TurnInput } from '../sessions.ts';

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
    return { events: [{ type: 'init', permissionMode: e.permissionMode, ruleFiles, plugins, mcp, skills: e.skills?.length }], sessionId: e.session_id };
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

function claudeTurn(input: TurnInput, resume?: string): Promise<{ vendorSessionId?: string; error?: string; staleHint?: boolean }> {
  const { session, root, turn, emit, signal } = input;
  const mcpConfig = JSON.stringify({ mcpServers: { wsapprove: { command: process.execPath, args: [approvalServer, session.id, String(turn)], env: { AI_WORKSPACE_HOME: home() } } } });
  const prompt = resume || !input.history ? input.prompt : `Earlier in this conversation:\n\n${input.history}\n\nUser: ${input.prompt}`;
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--mcp-config', mcpConfig, '--permission-prompt-tool', 'mcp__wsapprove__approve'];
  if (session.model) args.push('--model', session.model);
  if (resume) args.push('--resume', resume);
  let sessionId = resume;
  let result: StepResult | undefined;
  let text = '';
  let sawText = false;
  const flush = () => {
    if (text) emit({ type: 'text', text });
    text = '';
  };
  const timer = setInterval(flush, 250); // batch deltas so the log holds chunks, not single tokens
  return runLines(process.env.CLAUDE_BIN ?? 'claude', args, { cwd: root, env: { ...agentEnv(process.env), MCP_TOOL_TIMEOUT: '86400000' }, signal }, (line) => {
    let parsed;
    try { parsed = sessionEvents(line, root); } catch { return; }
    sessionId = parsed.sessionId ?? sessionId;
    result = parsed.result ?? result;
    for (const ev of parsed.events) {
      if (ev.type === 'text') { text += ev.text; sawText = true; continue; }
      flush();
      emit(ev);
    }
  }).then(({ code, err }) => {
    clearInterval(timer);
    flush();
    if (result) emit({ type: 'usage', usage: result.usage });
    const error = result ? result.error : signal.aborted ? undefined : `claude exited ${code}: ${err || 'no result'}`;
    // An expired or unknown vendor session: the workspace history is the source, so start fresh from it.
    const staleHint = !!resume && !sawText && /no conversation found/i.test(`${error ?? ''} ${err}`);
    return { vendorSessionId: sessionId, error, staleHint };
  }, (e) => {
    clearInterval(timer);
    throw e;
  });
}

export const claudeSession: SessionAgent = {
  async turn(input) {
    const first = await claudeTurn(input, input.session.vendorSessionId);
    return first.staleHint ? claudeTurn(input) : first;
  },
  permissions: claudePermissions,
};
