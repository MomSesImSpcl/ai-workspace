import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { home } from '../store.ts';
import { conversation, type AgentAdapter, type StepResult } from '../runtime.ts';
import { runLines, type Body, type SessionAgent } from '../sessions.ts';

const mcpServer = fileURLToPath(new URL('../mcp-server.ts', import.meta.url));

// Built-in Codex tools that bypass the broker. Code mode (`exec`) stays on: MCP tools are only
// reachable through it; its apply_patch is blocked by the read-only sandbox.
const DISABLED = ['shell_tool', 'unified_exec', 'multi_agent', 'apps', 'browser_use', 'browser_use_external', 'in_app_browser', 'computer_use'];

// On Windows `codex` is an npm .cmd shim that spawn cannot run without a shell; run its script with node.
function command(): [string, string[]] {
  if (process.env.CODEX_BIN) return [process.env.CODEX_BIN, []];
  if (process.platform === 'win32') {
    for (const dir of (process.env.PATH ?? '').split(delimiter)) {
      const script = join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (existsSync(join(dir, 'codex.cmd')) && existsSync(script)) return [process.execPath, [script]];
    }
  }
  return ['codex', []];
}

interface CodexEvent {
  type: string;
  thread_id?: string;
  item?: { type: string; text?: string };
  usage?: { input_tokens?: number; cached_input_tokens?: number; cache_write_input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
  message?: string;
}

// Parses `codex exec --json` JSONL. input_tokens already includes cached_input_tokens and cache_write_input_tokens.
export function parseEvents(stdout: string): StepResult {
  let text: string | undefined;
  let threadId: string | undefined;
  let error: string | undefined;
  let completed = false;
  const usage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0 };
  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) continue;
    const e = JSON.parse(line) as CodexEvent;
    if (e.type === 'thread.started') threadId = e.thread_id;
    else if (e.type === 'item.completed' && e.item?.type === 'agent_message') text = e.item.text;
    else if (e.type === 'turn.completed') {
      completed = true;
      usage.inputTokens += e.usage?.input_tokens ?? 0;
      usage.cachedInputTokens += e.usage?.cached_input_tokens ?? 0;
      usage.cacheWriteTokens += e.usage?.cache_write_input_tokens ?? 0;
      usage.outputTokens += e.usage?.output_tokens ?? 0;
    } else if (e.type === 'turn.failed' || e.type === 'error') error = e.error?.message ?? e.message ?? e.type;
  }
  const adapterState = threadId ? { threadId } : undefined;
  if (error || !completed) return { done: false, error: error ?? 'codex produced no completed turn', usage, adapterState };
  return { done: true, text, usage, adapterState };
}

// Dedicated Codex home: the user's ~/.codex AGENTS.md, skills and memories must not steer workspace
// tasks (--ignore-user-config skips only config.toml). Needs a one-time `codex login` with this CODEX_HOME.
export const codexHome = () => process.env.AI_WORKSPACE_CODEX_HOME ?? join(home(), 'codex');

// Codex CLI on the user's ChatGPT sign-in. One step = one `codex exec` turn; file access only via the workspace MCP server.
export const codex: AgentAdapter = {
  step({ task, root }) {
    const [bin, pre] = command();
    const args = [...pre, 'exec', '--json', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '-s', 'read-only', '-C', root,
      ...DISABLED.flatMap((f) => ['--disable', f]),
      '-c', 'web_search="disabled"',
      '-c', 'approval_policy="never"',
      '-c', `mcp_servers.ws.command=${JSON.stringify(process.execPath)}`,
      '-c', `mcp_servers.ws.args=${JSON.stringify([mcpServer, task.id])}`,
      '-c', 'mcp_servers.ws.tool_timeout_sec=3600', // delegate blocks until the subtask finishes
      '-c', 'mcp_servers.ws.default_tools_approval_mode="approve"', // the broker is the permission layer
      '-c', `mcp_servers.ws.env={AI_WORKSPACE_HOME=${JSON.stringify(home())}}`,
    ];
    if (task.model) args.push('-m', task.model);
    // Each step is a fresh `codex exec`, so a reply carries the whole conversation.
    const prompt = task.prompt ? conversation(task).map((m) => `${m.from === 'user' ? 'User' : 'You'}: ${m.text}`).join('\n\n') : task.goal;
    args.push(`${prompt}\n\nUse only the ws MCP tools (list_dir, read_file, write_file, delegate) for file access and subtasks. Paths are relative to the project root.`);
    return new Promise((resolvePromise, reject) => {
      mkdirSync(codexHome(), { recursive: true });
      const child = spawn(bin, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CODEX_HOME: codexHome() }, windowsHide: true });
      let out = '';
      let err = '';
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      child.on('error', reject);
      child.on('close', (code) => {
        const result = parseEvents(out);
        if (result.error && code !== 0 && err.trim()) result.error += ` (${err.trim().split('\n').pop()})`;
        resolvePromise(result);
      });
    });
  },
};

// --- Sessions (ADR 0004): Codex with the user's own config, rules and sign-in. `codex exec` reports
// only completed items and cannot relay approvals: its "ask" becomes a deny (known limit until the
// app-server protocol is adopted). Each turn sends the conversation as text.

interface CodexItem { type: string; id?: string; text?: string; command?: string; exit_code?: number; status?: string; changes?: { path: string }[] }

export function codexSessionEvents(line: string): { events: Body[]; done?: boolean; error?: string } {
  if (!line.startsWith('{')) return { events: [] };
  const e = JSON.parse(line) as Omit<CodexEvent, 'item'> & { item?: CodexItem };
  const item = e.item;
  if (e.type === 'item.completed' && item) {
    const id = item.id ?? randomUUID();
    if (item.type === 'agent_message' && item.text) return { events: [{ type: 'text', text: item.text }] };
    const label = item.type === 'command_execution' ? `Running \`${item.command ?? ''}\`` : item.type === 'file_change' ? `Editing ${(item.changes ?? []).map((c) => `\`${c.path}\``).join(', ')}` : null;
    const failed = (item.exit_code !== undefined && item.exit_code !== 0) || item.status === 'failed' || item.status === 'declined';
    return { events: label ? [{ type: 'activity', id, label }, { type: 'activity-done', id, error: failed || undefined }] : [] };
  }
  if (e.type === 'turn.completed') {
    const u = e.usage ?? {};
    return { events: [{ type: 'usage', usage: { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0, cachedInputTokens: u.cached_input_tokens ?? 0, cacheWriteTokens: u.cache_write_input_tokens ?? 0 } }], done: true };
  }
  if (e.type === 'turn.failed' || e.type === 'error') return { events: [], error: e.error?.message ?? e.message ?? e.type };
  return { events: [] };
}

const userCodexHome = () => process.env.CODEX_HOME ?? join(homedir(), '.codex');

// shortcut: reads two top-level keys with a regex, not a TOML parser or profiles; upgrade with app-server `config/read`.
export function codexPermissions(): { line: string; warn?: string } {
  const path = join(userCodexHome(), 'config.toml');
  const toml = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const key = (k: string) => new RegExp(`^${k}\\s*=\\s*"([^"]*)"`, 'm').exec(toml)?.[1];
  const sandbox = key('sandbox_mode') ?? 'default';
  const line = `Codex · approval ${key('approval_policy') ?? 'default'} · sandbox ${sandbox} · asks are denied (exec)`;
  return { line, warn: sandbox === 'danger-full-access' ? 'Codex runs without a sandbox (danger-full-access)' : undefined };
}

export const codexSession: SessionAgent = {
  async turn({ session, root, prompt, history, emit, signal }) {
    const [bin, pre] = command();
    const text = history ? `Earlier in this conversation:\n\n${history}\n\nUser: ${prompt}` : prompt;
    let done = false;
    let error: string | undefined;
    const { code, err } = await runLines(bin, [...pre, 'exec', '--json', '--skip-git-repo-check', '-C', root, ...(session.model ? ['-m', session.model] : []),
      // Codex knows low, medium and high; the two higher workspace levels map to high.
      ...(session.effort ? ['-c', `model_reasoning_effort="${session.effort === 'low' || session.effort === 'medium' ? session.effort : 'high'}"`] : []), text], { cwd: root, signal }, (line) => {
      let parsed;
      try { parsed = codexSessionEvents(line); } catch { return; }
      for (const ev of parsed.events) emit(ev);
      done ||= !!parsed.done;
      error = parsed.error ?? error;
    });
    if (signal.aborted) return {};
    return { error: error ?? (done ? undefined : `codex exited ${code}: ${err.split('\n').pop() || 'no completed turn'}`) };
  },
  permissions: codexPermissions,
};
