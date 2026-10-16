import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { home } from '../store.ts';
import { addUsage, writeLiveUsage, type AgentAdapter, type StepResult, type Usage } from '../runtime.ts';

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
    const args = ['-p', sessionId ? 'Continue the task.' : task.goal, '--output-format', 'stream-json', '--verbose', '--tools', '', '--mcp-config', mcpConfig, '--strict-mcp-config', '--setting-sources', '', '--allowedTools', 'mcp__ws', '--max-turns', String(TURNS_PER_STEP)];
    if (task.model) args.push('--model', task.model);
    if (sessionId) args.push('--resume', sessionId);
    else args.push('--append-system-prompt', 'Use only the mcp__ws tools for file access. Paths are relative to the project root.');
    return new Promise((resolvePromise, reject) => {
      const child = spawn(process.env.CLAUDE_BIN ?? 'claude', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MCP_TOOL_TIMEOUT: '3600000' } });
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
