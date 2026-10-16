import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { home } from '../store.ts';
import type { AgentAdapter, StepResult } from '../runtime.ts';

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
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
  message?: string;
}

// Parses `codex exec --json` JSONL. input_tokens already includes cached input.
export function parseEvents(stdout: string): StepResult {
  let text: string | undefined;
  let threadId: string | undefined;
  let error: string | undefined;
  let completed = false;
  const usage = { inputTokens: 0, outputTokens: 0 };
  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) continue;
    const e = JSON.parse(line) as CodexEvent;
    if (e.type === 'thread.started') threadId = e.thread_id;
    else if (e.type === 'item.completed' && e.item?.type === 'agent_message') text = e.item.text;
    else if (e.type === 'turn.completed') {
      completed = true;
      usage.inputTokens += e.usage?.input_tokens ?? 0;
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
      '-c', 'mcp_servers.ws.default_tools_approval_mode="approve"', // the broker is the permission layer
      '-c', `mcp_servers.ws.env={AI_WORKSPACE_HOME=${JSON.stringify(home())}}`,
    ];
    if (task.model) args.push('-m', task.model);
    args.push(`${task.goal}\n\nUse only the ws MCP tools (list_dir, read_file, write_file) for file access. Paths are relative to the project root.`);
    return new Promise((resolvePromise, reject) => {
      mkdirSync(codexHome(), { recursive: true });
      const child = spawn(bin, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CODEX_HOME: codexHome() } });
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
